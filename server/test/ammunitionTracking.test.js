import { beforeEach, describe, expect, it } from 'vitest';
import { consumeAmmunitionForAttack } from '../lib/ammunitionTracking.js';
import { setAutomationRules } from '../lib/automationRules.js';
import { createTestDb, insertCharacter } from './helpers/testDb.js';

describe('ammunition tracking', () => {
  let db;
  let characterId;

  beforeEach(() => {
    db = createTestDb();
    characterId = insertCharacter(db);
    db.prepare('UPDATE characters SET attacks = ?, inventory = ? WHERE id = ?').run(
      JSON.stringify([
        { name: 'Longbow', ammunitionName: 'Arrows', ammunitionPerAttack: 1 },
        { name: 'Dagger' },
      ]),
      JSON.stringify([{ name: 'Arrows', quantity: 3 }]),
      characterId,
    );
  });

  function arrowCount() {
    const row = db.prepare('SELECT inventory FROM characters WHERE id = ?').get(characterId);
    return JSON.parse(row.inventory)[0].quantity;
  }

  it('is opt-in and leaves inventory unchanged by default', () => {
    expect(consumeAmmunitionForAttack(db, characterId, 'Longbow')).toMatchObject({
      success: true,
      consumed: 0,
      reason: 'disabled',
    });
    expect(arrowCount()).toBe(3);
  });

  it('decrements explicitly linked ammunition when enabled', () => {
    setAutomationRules(db, { ammunitionTracking: true });
    expect(consumeAmmunitionForAttack(db, characterId, 'longbow')).toMatchObject({
      success: true,
      consumed: 1,
      ammunitionName: 'Arrows',
      remaining: 2,
    });
    expect(arrowCount()).toBe(2);
  });

  it('does not guess ammunition for unlinked weapons', () => {
    setAutomationRules(db, { ammunitionTracking: true });
    expect(consumeAmmunitionForAttack(db, characterId, 'Dagger')).toMatchObject({
      success: true,
      consumed: 0,
      reason: 'unlinked',
    });
    expect(arrowCount()).toBe(3);
  });

  it('rejects attacks that need more ammunition than is available', () => {
    db.prepare('UPDATE characters SET attacks = ? WHERE id = ?').run(
      JSON.stringify([{ name: 'Volley', ammunitionName: 'Arrows', ammunitionPerAttack: 4 }]),
      characterId,
    );
    setAutomationRules(db, { ammunitionTracking: true });
    expect(consumeAmmunitionForAttack(db, characterId, 'Volley')).toMatchObject({
      success: false,
      remaining: 3,
    });
    expect(arrowCount()).toBe(3);
  });
});
