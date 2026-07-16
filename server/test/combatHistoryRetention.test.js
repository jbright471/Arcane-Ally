import { beforeEach, describe, expect, it } from 'vitest';
import { setAutomationRules } from '../lib/automationRules.js';
import { pruneCombatHistory } from '../services/combatHistoryRetention.js';
import { createTestDb } from './helpers/testDb.js';

describe('combat history retention', () => {
  let db;

  beforeEach(() => {
    db = createTestDb();
  });

  function addArchivedSession(name, ageDays) {
    const result = db.prepare(`
      INSERT INTO combat_sessions (name, status, started_at, ended_at)
      VALUES (?, 'archived', datetime('now', ?), datetime('now', ?))
    `).run(name, `-${ageDays} days`, `-${ageDays} days`);
    db.prepare(`
      INSERT INTO effect_events (event_type, actor, combat_session_id)
      VALUES ('damage', 'Test', ?)
    `).run(result.lastInsertRowid);
    return Number(result.lastInsertRowid);
  }

  it('keeps all history by default', () => {
    addArchivedSession('Old', 30);
    expect(pruneCombatHistory(db)).toEqual({ sessionsDeleted: 0, eventsDeleted: 0 });
    expect(db.prepare('SELECT COUNT(*) AS count FROM combat_sessions').get().count).toBe(1);
  });

  it('keeps only the configured number of newest encounters', () => {
    const oldestId = addArchivedSession('Oldest', 30);
    addArchivedSession('Middle', 20);
    addArchivedSession('Newest', 10);
    const rules = setAutomationRules(db, {
      timelineRetentionMode: 'encounters',
      timelineRetentionValue: 2,
    });

    expect(pruneCombatHistory(db, rules)).toEqual({ sessionsDeleted: 1, eventsDeleted: 1 });
    expect(db.prepare('SELECT 1 FROM combat_sessions WHERE id = ?').get(oldestId)).toBeUndefined();
  });

  it('removes encounters and their events after the configured age', () => {
    const oldId = addArchivedSession('Old', 45);
    const recentId = addArchivedSession('Recent', 2);
    const rules = setAutomationRules(db, {
      timelineRetentionMode: 'days',
      timelineRetentionValue: 30,
    });

    expect(pruneCombatHistory(db, rules)).toEqual({ sessionsDeleted: 1, eventsDeleted: 1 });
    expect(db.prepare('SELECT 1 FROM combat_sessions WHERE id = ?').get(oldId)).toBeUndefined();
    expect(db.prepare('SELECT 1 FROM combat_sessions WHERE id = ?').get(recentId)).toBeDefined();
  });
});
