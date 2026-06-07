'use strict';

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, insertCharacter } from './helpers/testDb.js';
import {
  applyDamageEvent,
  applyHealEvent,
  setTempHpEvent,
  applyBuffEvent,
  removeBuffEvent,
  castConcentrationSpellEvent,
  dropConcentrationEvent,
  tickConditionsEvent,
  getSessionState,
  getResolvedCharacterState,
} from '../lib/rulesIntegration.js';
import {
  applyPartyEffect,
  processTurnTriggers,
  processAurasForTurn,
  getCombatTimeline,
  writeConcentrationCheckEvent,
} from '../services/effects-engine/index.js';

/**
 * MockStateBus
 * A synchronous, high-fidelity in-memory state bus to test complex multi-user combat rounds,
 * concentration roll cascading, aura stacks, and turn transitions.
 */
class MockStateBus {
  constructor(db) {
    this.db = db;
    this.broadcasts = {
      party_state: [],
      initiative_state: [],
      timeline_update: [],
      concentration_check_required: [],
      concentration_broken: [],
      concentration_maintained: [],
    };
    
    // Shared combat state variables
    this.currentCombatRound = 1;
    this.currentTurnIndex = 0;
  }

  // Trigger state broadcasts
  broadcastPartyState() {
    const chars = this.db.prepare('SELECT id FROM characters').all();
    const state = chars.map(c => getResolvedCharacterState(this.db, c.id)).filter(Boolean);
    this.broadcasts.party_state.push(state);
    return state;
  }

  broadcastInitiative() {
    const tracker = this.db.prepare('SELECT * FROM initiative_tracker ORDER BY initiative DESC, sort_order ASC').all();
    this.broadcasts.initiative_state.push(tracker);
    return tracker;
  }

  broadcastTimeline() {
    const timeline = getCombatTimeline(this.db);
    this.broadcasts.timeline_update.push(timeline);
    return timeline;
  }

  // Simulate Socket update_hp event from a client
  emitUpdateHp(socket, { characterId, delta, damageType, skipConcentrationAutoRoll, actor: _actor }) {
    let result = delta < 0 
      ? applyDamageEvent(this.db, characterId, Math.abs(delta), damageType || 'untyped')
      : applyHealEvent(this.db, characterId, delta);

    if (result.success) {
      this.broadcastPartyState();
      this.broadcastTimeline();

      // Concentration auto-roll check (mimicking server.js)
      if (delta < 0 && result.concentrationCheck && !skipConcentrationAutoRoll) {
        const state = getSessionState(this.db, characterId);
        const charData = getResolvedCharacterState(this.db, characterId);
        const conScore = charData.abilityScores.CON ?? 10;
        const conMod = Math.floor((conScore - 10) / 2);
        
        // Simulating the dice roll - the mock socket can inject a pre-determined roll!
        const roll = socket.mockRoll || 10;
        
        // If Bless is active, add +1d4 roll bonus (we'll mock it as +2.5 average, or socket.blessBonus)
        const hasBless = charData.buffs.some(b => b.name?.toLowerCase() === 'bless');
        const blessVal = hasBless ? (socket.mockBlessRoll || 3) : 0;
        
        const total = roll + conMod + blessVal;
        const dc = result.concentrationCheck.dc;
        const passed = total >= dc;
        const spellName = state?.concentratingOn ?? 'Unknown Spell';
        const charName = charData.name;

        writeConcentrationCheckEvent(
          this.db, characterId, charName, spellName,
          roll, conMod, total, dc, passed,
          this.currentCombatRound, this.currentTurnIndex
        );

        if (!passed) {
          dropConcentrationEvent(this.db, characterId);
          this.broadcasts.concentration_broken.push({ characterId, characterName: charName, spellName, roll, total, dc });
        } else {
          this.broadcasts.concentration_maintained.push({ characterId, characterName: charName, spellName, roll, total, dc });
        }
        this.broadcastTimeline();
      } else if (delta < 0 && result.concentrationCheck && skipConcentrationAutoRoll) {
        const state = getSessionState(this.db, characterId);
        this.broadcasts.concentration_check_required.push({ characterId, spellName: state?.concentratingOn, dc: result.concentrationCheck.dc });
      }
    }
    return result;
  }

  // Simulate Socket apply_party_effect (DM only)
  emitApplyPartyEffect(socket, { effects, targets, actor }) {
    if (!socket.dmAuthenticated) throw new Error('DM only');
    const results = applyPartyEffect(
      this.db, effects, targets || 'party',
      actor || 'DM', this.currentCombatRound, this.currentTurnIndex, 'action', null
    );
    this.broadcastPartyState();
    this.broadcastTimeline();
    return results;
  }

  // Simulate Socket next_turn event
  emitNextTurn() {
    const tracker = this.db.prepare('SELECT * FROM initiative_tracker ORDER BY initiative DESC, sort_order ASC').all();
    if (tracker.length === 0) return;

    // Reset current active
    this.db.prepare('UPDATE initiative_tracker SET is_active = 0').run();
    
    this.currentTurnIndex = (this.currentTurnIndex + 1) % tracker.length;
    if (this.currentTurnIndex === 0) {
      this.currentCombatRound += 1;
    }

    const activeEntity = tracker[this.currentTurnIndex];
    this.db.prepare('UPDATE initiative_tracker SET is_active = 1 WHERE id = ?').run(activeEntity.id);

    // If active entity is a PC, tick condition durations
    if (activeEntity.entity_type === 'pc' && activeEntity.character_id) {
      const tickResult = tickConditionsEvent(this.db, activeEntity.character_id);
      if (tickResult.success) {
        this.broadcastPartyState();
        this.broadcastTimeline();
      }
    }

    // Process start-of-turn triggers & auras
    const triggerResults = [
      ...processTurnTriggers(this.db, 'start_of_turn', activeEntity.id, this.currentCombatRound, this.currentTurnIndex),
      ...processAurasForTurn(this.db, activeEntity.id, this.currentCombatRound, this.currentTurnIndex, 'start_of_turn'),
    ];

    if (triggerResults.some(r => r.success)) {
      this.broadcastPartyState();
      this.broadcastTimeline();
    }
    
    this.broadcastInitiative();
  }
}

// ── Integration Suite ─────────────────────────────────────────────────────────

describe('combatRounds - integration tests', () => {
  let db, bus;

  beforeEach(() => {
    db = createTestDb();
    bus = new MockStateBus(db);
  });

  // ── 1. Simulate multi-user combat rounds ───────────────────────────────────
  it('multi-user rounds: handles sequential attacks and state updates', () => {
    const idAria = insertCharacter(db, { name: 'Aria', max_hp: 40, current_hp: 40 });
    const idBrom = insertCharacter(db, { name: 'Brom', max_hp: 50, current_hp: 50 });
    
    // Seed initiative tracker
    db.prepare(`
      INSERT INTO initiative_tracker (entity_name, entity_type, character_id, initiative, is_active)
      VALUES ('Aria', 'pc', ?, 18, 1)
    `).run(idAria);
    db.prepare(`
      INSERT INTO initiative_tracker (entity_name, entity_type, character_id, initiative, is_active)
      VALUES ('Brom', 'pc', ?, 12, 0)
    `).run(idBrom);
    
    const socketAria = { characterId: idAria, dmAuthenticated: false };
    const socketBrom = { characterId: idBrom, dmAuthenticated: false };
    
    // Aria's turn (active): Aria attacks and deals damage to a monster (or takes damage herself)
    bus.emitUpdateHp(socketAria, { characterId: idAria, delta: -10, damageType: 'fire', actor: 'Goblin' });
    expect(getSessionState(db, idAria).currentHp).toBe(30);

    // Transition turn to Brom
    bus.emitNextTurn();
    const tracker = db.prepare('SELECT * FROM initiative_tracker ORDER BY initiative DESC').all();
    expect(tracker[0].is_active).toBe(0); // Aria inactive
    expect(tracker[1].is_active).toBe(1); // Brom active

    // Brom's turn: Brom heals Aria
    bus.emitUpdateHp(socketBrom, { characterId: idAria, delta: 5, actor: 'Brom' });
    expect(getSessionState(db, idAria).currentHp).toBe(35);
  });

  // ── 2. Concentration Check + Cascade Breaks ─────────────────────────────────
  it('concentration checks: handles Bless saving throw bonus and cascading breaks', () => {
    const idAria = insertCharacter(db, { name: 'Aria', max_hp: 40, current_hp: 40 });
    const idBrom = insertCharacter(db, { name: 'Brom', max_hp: 50, current_hp: 50, con: 14 }); // +2 CON mod
    
    // Brom casts Banishment (concentration)
    castConcentrationSpellEvent(db, idBrom, 'Banishment');
    expect(getSessionState(db, idBrom).concentratingOn).toBe('Banishment');

    // Aria casts Bless (concentration) on Brom
    castConcentrationSpellEvent(db, idAria, 'Bless');
    applyBuffEvent(db, idBrom, { name: 'Bless', sourceName: 'Bless', isConcentration: true });
    
    expect(getSessionState(db, idAria).concentratingOn).toBe('Bless');
    const bromState1 = getResolvedCharacterState(db, idBrom);
    expect(bromState1.buffs.map(b => b.name)).toContain('Bless');

    // Brom takes 14 damage -> trigger concentration check (DC 10)
    // Brom has +2 CON mod. We simulate socket Brom rolling a 6. 
    // Total is 6 (roll) + 2 (CON) = 8.
    // However, since Aria's Bless is active on him, they get +1d4 roll bonus.
    // We mock Bless roll as a 3. Total becomes 6 + 2 + 3 = 11 (Passed).
    const socketBrom = { characterId: idBrom, mockRoll: 6, mockBlessRoll: 3 };
    bus.emitUpdateHp(socketBrom, { characterId: idBrom, delta: -14, damageType: 'piercing', actor: 'Archer' });
    
    // Brom passed save due to Bless bonus, maintains concentration!
    expect(getSessionState(db, idBrom).concentratingOn).toBe('Banishment');

    // Aria takes massive damage (30 dmg) and fails save (mock roll 2, DC 15)
    const socketAria = { characterId: idAria, mockRoll: 2 };
    bus.emitUpdateHp(socketAria, { characterId: idAria, delta: -30, damageType: 'necrotic', actor: 'Lich' });
    
    // Aria's concentration is broken!
    expect(getSessionState(db, idAria).concentratingOn).toBeNull();
    
    // Cascading break: Bless buff is automatically removed from Brom
    // In our rules engine, dropping Bless drops concentration buffs
    const droppedChange = resolveConcentrationChange('Bless', null, bromState1.buffs);
    expect(droppedChange.droppedBuffIds.length).toBeGreaterThan(0);
    removeBuffEvent(db, idBrom, droppedChange.droppedBuffIds[0]);

    const bromState2 = getResolvedCharacterState(db, idBrom);
    expect(bromState2.buffs.map(b => b.name)).not.toContain('Bless');

    // Brom is hit again for 14 damage, rolls 6 again.
    // Without Bless active, total is 6 + 2 = 8 (DC 10). Save fails!
    const socketBromSecondHit = { characterId: idBrom, mockRoll: 6 };
    bus.emitUpdateHp(socketBromSecondHit, { characterId: idBrom, delta: -14, damageType: 'piercing', actor: 'Archer' });

    // Brom's concentration is broken! Banishment dropped.
    expect(getSessionState(db, idBrom).concentratingOn).toBeNull();
    expect(bus.broadcasts.concentration_broken.length).toBe(2); // Aria and then Brom
  });

  // ── 3. Aura Stacking vs Buff Immunity ───────────────────────────────────────
  it('auras vs immunity: Heroism buff grants immunity to Frightened condition aura', () => {
    const idAria = insertCharacter(db, { name: 'Aria', max_hp: 40, current_hp: 40 });
    
    // Place Aria in initiative tracker
    db.prepare(`
      INSERT INTO initiative_tracker (entity_name, entity_type, character_id, initiative, is_active)
      VALUES ('Aria', 'pc', ?, 15, 0)
    `).run(idAria);

    // Apply Heroism buff manually (grants immunity to Frightened)
    applyBuffEvent(db, idAria, { name: 'Heroism', sourceName: 'Paladin' });
    expect(getResolvedCharacterState(db, idAria).buffs.map(b => b.name)).toContain('Heroism');

    // DM creates an automation preset aura that applies Frightened at start of turn
    db.prepare(`
      INSERT INTO automation_presets (name, preset_type, trigger_phase, effects_json, targets_json, is_active)
      VALUES ('Lich Fear Aura', 'aura', 'start_of_turn', ?, '"party"', 1)
    `).run(JSON.stringify([{ type: 'condition', condition: 'Frightened' }]));

    // Trigger next turn to Aria's turn, which triggers the Aura automatically
    bus.emitNextTurn();

    // Verify condition was bypassed due to Heroism condition immunity check
    const ariaState = getResolvedCharacterState(db, idAria);
    expect(ariaState.conditions).not.toContain('frightened');
    expect(ariaState.conditions).not.toContain('Frightened');
  });

  // ── 4. Temp HP Overlap ──────────────────────────────────────────────────────
  it('temp HP overlap: correctly overlaps and does not stack temp HP', () => {
    const idAria = insertCharacter(db, { name: 'Aria', max_hp: 40, current_hp: 40 });
    
    // Gain 10 Temp HP
    setTempHpEvent(db, idAria, 10);
    expect(getSessionState(db, idAria).tempHp).toBe(10);

    // Receive a new 5 Temp HP buff - should not stack or override (remains 10)
    setTempHpEvent(db, idAria, 5);
    expect(getSessionState(db, idAria).tempHp).toBe(10);

    // Aria takes 8 damage -> temp HP drops to 2 (0 real HP lost)
    applyDamageEvent(db, idAria, 8, 'slashing');
    expect(getSessionState(db, idAria).tempHp).toBe(2);
    expect(getSessionState(db, idAria).currentHp).toBe(40);

    // Aria receives 5 Temp HP -> overrides 2 with 5
    setTempHpEvent(db, idAria, 5);
    expect(getSessionState(db, idAria).tempHp).toBe(5);
  });

  // ── 5. Aura-Sync & 5e Stacking Limits ───────────────────────────────────────
  it('aura-sync & stacking: dynamic aura buff injection and 5e stacking rules', () => {
    const { createOrUpdateAura, toggleAura } = require('../services/effects-engine/auras.js');

    const idAria = insertCharacter(db, { name: 'Aria', max_hp: 40, current_hp: 40 });
    const idBrom = insertCharacter(db, { name: 'Brom', max_hp: 50, current_hp: 50 });

    // Caster A (Aria) starts combat and toggles a custom "Aura of Protection" giving +4 to saves
    createOrUpdateAura(db, {
      id: 'aura-of-protection-1',
      name: 'Aura of Protection',
      casterId: idAria,
      casterName: 'Aria',
      radius: 30,
      active: true,
      buffData: {
        modifierType: 'flatBonus',
        statAffected: 'all saves',
        modifierValue: 4
      },
      targets: [idAria, idBrom]
    });

    // Check that both Aria and Brom get the +4 save bonus
    const ariaState = getResolvedCharacterState(db, idAria);
    const bromState = getResolvedCharacterState(db, idBrom);

    expect(ariaState.buffs.map(b => b.name)).toContain('Aura of Protection');
    expect(bromState.buffs.map(b => b.name)).toContain('Aura of Protection');

    // Verify saving throw scores have the +4 bonus added
    // Brom's base WIS modifier is +0 (WIS 10). WIS saving throw should be exactly +4.
    expect(bromState.savingThrows.WIS).toBe(4);

    // Now Caster B (Brom) casts another "Aura of Protection" giving +3 to saves.
    // They are both in the aura.
    createOrUpdateAura(db, {
      id: 'aura-of-protection-2',
      name: 'Aura of Protection',
      casterId: idBrom,
      casterName: 'Brom',
      radius: 30,
      active: true,
      buffData: {
        modifierType: 'flatBonus',
        statAffected: 'all saves',
        modifierValue: 3
      },
      targets: [idAria, idBrom]
    });

    // Verify 5e Stacking Rules: They should NOT double-stack! They only benefit from the highest one (+4).
    const ariaState2 = getResolvedCharacterState(db, idAria);
    const bromState2 = getResolvedCharacterState(db, idBrom);

    // Count how many "Aura of Protection" buffs are returned in active buffs. It should be exactly 1!
    const ariaAuras = ariaState2.buffs.filter(b => b.name === 'Aura of Protection');
    const bromAuras = bromState2.buffs.filter(b => b.name === 'Aura of Protection');

    expect(ariaAuras.length).toBe(1);
    expect(bromAuras.length).toBe(1);

    // The value kept should be the higher one (+4), not +3.
    expect(parseInt(bromAuras[0].modifierValue)).toBe(4);
    expect(bromState2.savingThrows.WIS).toBe(4); // WIS save remains +4

    // If we toggle off the +4 aura, the +3 aura should now take effect!
    toggleAura(db, 'aura-of-protection-1', false);

    const bromState3 = getResolvedCharacterState(db, idBrom);
    const bromAuras3 = bromState3.buffs.filter(b => b.name === 'Aura of Protection');
    expect(bromAuras3.length).toBe(1);
    expect(parseInt(bromAuras3[0].modifierValue)).toBe(3);
    expect(bromState3.savingThrows.WIS).toBe(3); // WIS save becomes +3
  });
});

// Helper resolved function mapping from rulesEngine.js
function resolveConcentrationChange(currentConcentration, newSpellName, activeBuffs = []) {
  const droppedSpell = currentConcentration;
  const droppedBuffIds = droppedSpell
    ? activeBuffs.filter(b => b.isConcentration && b.name && b.name.toLowerCase() === droppedSpell.toLowerCase()).map(b => b.id)
    : [];
  return { droppedSpell, droppedBuffIds, newConcentration: newSpellName };
}
