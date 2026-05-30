'use strict';

const { createTestDb, insertCharacter, insertMonster } = require('./helpers/testDb.js');
const {
  applyDamageEvent,
  applyHealEvent,
  setTempHpEvent,
  applyBuffEvent,
  removeBuffEvent,
  castConcentrationSpellEvent,
  dropConcentrationEvent,
  applyConditionEvent,
  removeConditionEvent,
  tickConditionsEvent,
  getSessionState,
  getResolvedCharacterState,
} = require('../lib/rulesIntegration.js');
const {
  applyPartyEffect,
  processTurnTriggers,
  processAurasForTurn,
  getCombatTimeline,
  writeConcentrationCheckEvent,
} = require('../services/effects-engine/index.js');

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
    
    this.currentCombatRound = 1;
    this.currentTurnIndex = 0;
  }

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

  emitUpdateHp(socket, { characterId, delta, damageType, skipConcentrationAutoRoll, actor }) {
    let result = delta < 0 
      ? applyDamageEvent(this.db, characterId, Math.abs(delta), damageType || 'untyped')
      : applyHealEvent(this.db, characterId, delta);

    if (result.success) {
      this.broadcastPartyState();
      this.broadcastTimeline();

      if (delta < 0 && result.concentrationCheck && !skipConcentrationAutoRoll) {
        const state = getSessionState(this.db, characterId);
        const charData = getResolvedCharacterState(this.db, characterId);
        const conScore = charData.abilityScores.CON ?? 10;
        const conMod = Math.floor((conScore - 10) / 2);
        
        const roll = socket.mockRoll || 10;
        
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

  emitNextTurn() {
    const tracker = this.db.prepare('SELECT * FROM initiative_tracker ORDER BY initiative DESC, sort_order ASC').all();
    if (tracker.length === 0) return;

    this.db.prepare('UPDATE initiative_tracker SET is_active = 0').run();
    
    this.currentTurnIndex = (this.currentTurnIndex + 1) % tracker.length;
    if (this.currentTurnIndex === 0) {
      this.currentCombatRound += 1;
    }

    const activeEntity = tracker[this.currentTurnIndex];
    this.db.prepare('UPDATE initiative_tracker SET is_active = 1 WHERE id = ?').run(activeEntity.id);

    if (activeEntity.entity_type === 'pc' && activeEntity.character_id) {
      const tickResult = tickConditionsEvent(this.db, activeEntity.character_id);
      if (tickResult.success) {
        this.broadcastPartyState();
        this.broadcastTimeline();
      }
    }

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

// ── Test Runner ──────────────────────────────────────────────────────────────

function run() {
  console.log('--- DnD Party Sync: Running Integration Tests ---');

  // Test 1: Multi-user rounds
  (() => {
    console.log('1. Multi-user rounds test...');
    const db = createTestDb();
    const bus = new MockStateBus(db);
    const idAria = insertCharacter(db, { name: 'Aria', max_hp: 40, current_hp: 40 });
    const idBrom = insertCharacter(db, { name: 'Brom', max_hp: 50, current_hp: 50 });
    
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
    
    bus.emitUpdateHp(socketAria, { characterId: idAria, delta: -10, damageType: 'fire', actor: 'Goblin' });
    if (getSessionState(db, idAria).currentHp !== 30) throw new Error('Aria HP should be 30 after damage');

    bus.emitNextTurn();
    const tracker = db.prepare('SELECT * FROM initiative_tracker ORDER BY initiative DESC').all();
    if (tracker[0].is_active !== 0) throw new Error('Aria should be inactive');
    if (tracker[1].is_active !== 1) throw new Error('Brom should be active');

    bus.emitUpdateHp(socketBrom, { characterId: idAria, delta: 5, actor: 'Brom' });
    if (getSessionState(db, idAria).currentHp !== 35) throw new Error('Aria HP should be 35 after healing');
    console.log('   ✓ Passed');
  })();

  // Test 2: Concentration check and cascading breaks
  (() => {
    console.log('2. Concentration check + cascade breaks test...');
    const db = createTestDb();
    const bus = new MockStateBus(db);
    const idAria = insertCharacter(db, { name: 'Aria', max_hp: 40, current_hp: 40 });
    const idBrom = insertCharacter(db, { name: 'Brom', max_hp: 50, current_hp: 50, con: 14 });
    
    castConcentrationSpellEvent(db, idBrom, 'Banishment');
    if (getSessionState(db, idBrom).concentratingOn !== 'Banishment') throw new Error('Brom should be concentrating on Banishment');

    castConcentrationSpellEvent(db, idAria, 'Bless');
    applyBuffEvent(db, idBrom, { name: 'Bless', sourceName: 'Bless', isConcentration: true });
    
    if (getSessionState(db, idAria).concentratingOn !== 'Bless') throw new Error('Aria should be concentrating on Bless');
    const bromState1 = getResolvedCharacterState(db, idBrom);
    if (!bromState1.buffs.map(b => b.name).includes('Bless')) throw new Error('Brom should have Bless buff');

    const socketBrom = { characterId: idBrom, mockRoll: 6, mockBlessRoll: 3 };
    bus.emitUpdateHp(socketBrom, { characterId: idBrom, delta: -14, damageType: 'piercing', actor: 'Archer' });
    
    if (getSessionState(db, idBrom).concentratingOn !== 'Banishment') throw new Error('Brom should maintain concentration with Bless bonus');

    const socketAria = { characterId: idAria, mockRoll: 2 };
    bus.emitUpdateHp(socketAria, { characterId: idAria, delta: -30, damageType: 'necrotic', actor: 'Lich' });
    
    if (getSessionState(db, idAria).concentratingOn !== null) throw new Error('Aria concentration should be broken');
    
    const droppedChange = resolveConcentrationChange('Bless', null, bromState1.buffs);
    if (droppedChange.droppedBuffIds.length === 0) throw new Error('Bless buff should be dropped');
    removeBuffEvent(db, idBrom, droppedChange.droppedBuffIds[0]);

    const bromState2 = getResolvedCharacterState(db, idBrom);
    if (bromState2.buffs.map(b => b.name).includes('Bless')) throw new Error('Brom should not have Bless anymore');

    const socketBromSecondHit = { characterId: idBrom, mockRoll: 6 };
    bus.emitUpdateHp(socketBromSecondHit, { characterId: idBrom, delta: -14, damageType: 'piercing', actor: 'Archer' });

    if (getSessionState(db, idBrom).concentratingOn !== null) throw new Error('Brom Banishment concentration should be broken on second hit');
    if (bus.broadcasts.concentration_broken.length !== 2) throw new Error('Should have 2 broken concentration events');
    console.log('   ✓ Passed');
  })();

  // Test 3: Aura Stacking vs Buff Immunity
  (() => {
    console.log('3. Aura vs Immunity test...');
    const db = createTestDb();
    const bus = new MockStateBus(db);
    const idAria = insertCharacter(db, { name: 'Aria', max_hp: 40, current_hp: 40 });
    
    db.prepare(`
      INSERT INTO initiative_tracker (entity_name, entity_type, character_id, initiative, is_active)
      VALUES ('Aria', 'pc', ?, 15, 0)
    `).run(idAria);

    applyBuffEvent(db, idAria, { name: 'Heroism', sourceName: 'Paladin' });
    if (!getResolvedCharacterState(db, idAria).buffs.map(b => b.name).includes('Heroism')) throw new Error('Aria should have Heroism buff');

    db.prepare(`
      INSERT INTO automation_presets (name, preset_type, trigger_phase, effects_json, targets_json, is_active)
      VALUES ('Lich Fear Aura', 'aura', 'start_of_turn', ?, '"party"', 1)
    `).run(JSON.stringify([{ type: 'condition', condition: 'Frightened' }]));

    bus.emitNextTurn();

    const ariaState = getResolvedCharacterState(db, idAria);
    if (ariaState.conditions.includes('frightened') || ariaState.conditions.includes('Frightened')) {
      throw new Error('Aria should not be Frightened due to Heroism immunity');
    }
    console.log('   ✓ Passed');
  })();

  // Test 4: Temp HP Overlap
  (() => {
    console.log('4. Temp HP overlap test...');
    const db = createTestDb();
    const idAria = insertCharacter(db, { name: 'Aria', max_hp: 40, current_hp: 40 });
    
    setTempHpEvent(db, idAria, 10);
    if (getSessionState(db, idAria).tempHp !== 10) throw new Error('Aria should have 10 Temp HP');

    setTempHpEvent(db, idAria, 5);
    if (getSessionState(db, idAria).tempHp !== 10) throw new Error('Aria should keep 10 Temp HP (5 should not overwrite)');

    applyDamageEvent(db, idAria, 8, 'slashing');
    if (getSessionState(db, idAria).tempHp !== 2) throw new Error('Aria should have 2 Temp HP remaining');
    if (getSessionState(db, idAria).currentHp !== 40) throw new Error('Aria should have 40 HP');

    setTempHpEvent(db, idAria, 5);
    if (getSessionState(db, idAria).tempHp !== 5) throw new Error('Aria should overwrite 2 Temp HP with 5');
    console.log('   ✓ Passed');
  })();

  // Test 5: Aura-Sync & 5e Stacking Limits
  (() => {
    console.log('5. Aura-Sync & 5e Stacking Limits test...');
    const db = createTestDb();
    const { createOrUpdateAura, toggleAura } = require('../services/effects-engine/auras.js');

    const idAria = insertCharacter(db, { name: 'Aria', max_hp: 40, current_hp: 40 });
    const idBrom = insertCharacter(db, { name: 'Brom', max_hp: 50, current_hp: 50 });

    // Caster A (Aria) toggles Aura of Protection giving +4 to saves
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

    const ariaState = getResolvedCharacterState(db, idAria);
    const bromState = getResolvedCharacterState(db, idBrom);

    if (!ariaState.buffs.map(b => b.name).includes('Aura of Protection')) throw new Error('Aria should have Aura buff');
    if (!bromState.buffs.map(b => b.name).includes('Aura of Protection')) throw new Error('Brom should have Aura buff');
    if (bromState.savingThrows.WIS !== 4) throw new Error('Brom should have +4 WIS save');

    // Caster B (Brom) casts another Aura of Protection giving +3 to saves.
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

    const ariaState2 = getResolvedCharacterState(db, idAria);
    const bromState2 = getResolvedCharacterState(db, idBrom);

    const ariaAuras = ariaState2.buffs.filter(b => b.name === 'Aura of Protection');
    const bromAuras = bromState2.buffs.filter(b => b.name === 'Aura of Protection');

    if (ariaAuras.length !== 1) throw new Error('Aria Aura of Protection should deduplicate');
    if (bromAuras.length !== 1) throw new Error('Brom Aura of Protection should deduplicate');
    if (parseInt(bromAuras[0].modifierValue) !== 4) throw new Error('Brom should retain the higher Aura of Protection (+4)');
    if (bromState2.savingThrows.WIS !== 4) throw new Error('Brom WIS save should remain +4');

    // Toggle off the +4 aura, the +3 aura should take effect
    toggleAura(db, 'aura-of-protection-1', false);

    const bromState3 = getResolvedCharacterState(db, idBrom);
    const bromAuras3 = bromState3.buffs.filter(b => b.name === 'Aura of Protection');
    if (bromAuras3.length !== 1) throw new Error('Brom Aura of Protection should deduplicate to 1');
    if (parseInt(bromAuras3[0].modifierValue) !== 3) throw new Error('Brom should now use the +3 Aura of Protection');
    if (bromState3.savingThrows.WIS !== 3) throw new Error('Brom WIS save should now be +3');

    console.log('   ✓ Passed');
  })();

  console.log('--- ALL INTEGRATION TESTS PASSED SUCCESSFULLY ---');
}

function resolveConcentrationChange(currentConcentration, newSpellName, activeBuffs = []) {
  const droppedSpell = currentConcentration;
  const droppedBuffIds = droppedSpell
    ? activeBuffs.filter(b => b.isConcentration && b.name && b.name.toLowerCase() === droppedSpell.toLowerCase()).map(b => b.id)
    : [];
  return { droppedSpell, droppedBuffIds, newConcentration: newSpellName };
}

run();
