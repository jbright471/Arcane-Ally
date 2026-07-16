import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, insertCharacter } from './helpers/testDb.js';
import { getAutomationRules, normalizeAutomationRules, setAutomationRules } from '../lib/automationRules.js';
import {
  applyBuffEvent,
  applyDamageEvent,
  applyHealEvent,
  getResolvedCharacterState,
  getSessionState,
  saveSessionState,
} from '../lib/rulesIntegration.js';
import { processTurnTriggers } from '../services/effects-engine/index.js';

describe('campaign automation rules', () => {
  let db;

  beforeEach(() => {
    db = createTestDb();
  });

  it('keeps existing automation enabled by default', () => {
    expect(getAutomationRules(db)).toMatchObject({
      automaticUnconscious: true,
      clearUnconsciousOnHeal: true,
      concentrationCleanup: true,
      concentrationChecks: 'automatic',
      conditionDurations: true,
      turnTriggers: true,
      auras: true,
      reactiveHandlers: true,
      initiativeSync: true,
      bloodiedDetection: true,
      bloodiedThresholdPercent: 50,
      ammunitionTracking: false,
      modifierPropagation: true,
      timelineRetentionMode: 'unlimited',
      timelineRetentionValue: 0,
    });
  });

  it('normalizes thresholds and retention settings', () => {
    expect(normalizeAutomationRules({
      bloodiedThresholdPercent: 120,
      timelineRetentionMode: 'encounters',
      timelineRetentionValue: -10,
    })).toMatchObject({
      bloodiedThresholdPercent: 99,
      timelineRetentionMode: 'encounters',
      timelineRetentionValue: 0,
    });
  });

  it('reports bloodied transitions using the configured threshold', () => {
    const characterId = insertCharacter(db, { current_hp: 40, max_hp: 40 });

    expect(applyDamageEvent(db, characterId, 20).bloodiedTransition).toBe('entered');
    expect(getResolvedCharacterState(db, characterId).isBloodied).toBe(true);
    expect(applyHealEvent(db, characterId, 1).bloodiedTransition).toBe('exited');

    setAutomationRules(db, { bloodiedThresholdPercent: 25 });
    expect(applyDamageEvent(db, characterId, 10).bloodiedTransition).toBe(null);
    expect(applyDamageEvent(db, characterId, 1).bloodiedTransition).toBe('entered');
  });

  it('does not emit bloodied transitions when detection is disabled or HP reaches zero', () => {
    const characterId = insertCharacter(db, { current_hp: 40, max_hp: 40 });
    setAutomationRules(db, { bloodiedDetection: false });
    expect(applyDamageEvent(db, characterId, 20).bloodiedTransition).toBe(null);

    setAutomationRules(db, { bloodiedDetection: true });
    expect(applyDamageEvent(db, characterId, 20).bloodiedTransition).toBe(null);
  });

  it('keeps active buffs visible when modifier propagation is disabled', () => {
    const characterId = insertCharacter(db);
    applyBuffEvent(db, characterId, {
      name: 'Shield of Faith',
      modifierType: 'flatBonus',
      statAffected: 'ac',
      modifierValue: '2',
    });

    expect(getResolvedCharacterState(db, characterId).ac).toBe(18);
    setAutomationRules(db, { modifierPropagation: false });
    const resolved = getResolvedCharacterState(db, characterId);
    expect(resolved.ac).toBe(16);
    expect(resolved.buffs).toHaveLength(1);
  });

  it('persists partial updates without resetting other rules', () => {
    const updated = setAutomationRules(db, { turnTriggers: false, concentrationChecks: 'prompt' });
    expect(updated.turnTriggers).toBe(false);
    expect(updated.concentrationChecks).toBe('prompt');
    expect(updated.automaticUnconscious).toBe(true);
    expect(getAutomationRules(db)).toEqual(updated);
  });

  it('does not apply or clear unconscious when those policies are disabled', () => {
    const characterId = insertCharacter(db, { current_hp: 5, max_hp: 20 });
    setAutomationRules(db, { automaticUnconscious: false, clearUnconsciousOnHeal: false });

    applyDamageEvent(db, characterId, 10);
    expect(getSessionState(db, characterId).activeConditions).not.toContain('unconscious');

    const state = getSessionState(db, characterId);
    state.activeConditions.push('unconscious');
    saveSessionState(db, state);
    applyHealEvent(db, characterId, 5);
    expect(getSessionState(db, characterId).activeConditions).toContain('unconscious');
  });

  it('skips turn-trigger presets when disabled', () => {
    const characterId = insertCharacter(db);
    db.prepare(`
      INSERT INTO automation_presets (name, preset_type, trigger_phase, effects_json, targets_json)
      VALUES ('Turn Burn', 'turn_trigger', 'start_of_turn', '[{"type":"damage","value":5}]', ?)
    `).run(JSON.stringify([{ id: characterId, type: 'character' }]));
    setAutomationRules(db, { turnTriggers: false });

    expect(processTurnTriggers(db, 'start_of_turn', 1, 1, 0)).toEqual([]);
    expect(getSessionState(db, characterId).currentHp).toBe(40);
  });
});
