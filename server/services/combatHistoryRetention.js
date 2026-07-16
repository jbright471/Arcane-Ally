'use strict';

const { getAutomationRules } = require('../lib/automationRules');

function getArchivedSessionIdsToPrune(db, rules) {
  if (rules.timelineRetentionMode === 'encounters') {
    const keep = Math.max(1, Number(rules.timelineRetentionValue) || 1);
    return db.prepare(`
      SELECT id FROM combat_sessions
      WHERE status = 'archived'
      ORDER BY COALESCE(ended_at, started_at) DESC, id DESC
      LIMIT -1 OFFSET ?
    `).all(keep).map(row => row.id);
  }
  if (rules.timelineRetentionMode === 'days') {
    const days = Math.max(1, Number(rules.timelineRetentionValue) || 1);
    return db.prepare(`
      SELECT id FROM combat_sessions
      WHERE status = 'archived'
        AND COALESCE(ended_at, started_at) < datetime('now', ?)
    `).all(`-${days} days`).map(row => row.id);
  }
  return [];
}

function pruneCombatHistory(db, providedRules = null) {
  const rules = providedRules || getAutomationRules(db);
  if (rules.timelineRetentionMode === 'unlimited' || !rules.timelineRetentionValue) {
    return { sessionsDeleted: 0, eventsDeleted: 0 };
  }

  return db.transaction(() => {
    const ids = getArchivedSessionIdsToPrune(db, rules);
    if (ids.length === 0) return { sessionsDeleted: 0, eventsDeleted: 0 };
    const placeholders = ids.map(() => '?').join(',');
    const eventsDeleted = db.prepare(
      `DELETE FROM effect_events WHERE combat_session_id IN (${placeholders})`
    ).run(...ids).changes;
    const sessionsDeleted = db.prepare(
      `DELETE FROM combat_sessions WHERE id IN (${placeholders})`
    ).run(...ids).changes;
    return { sessionsDeleted, eventsDeleted };
  }).immediate();
}

module.exports = { getArchivedSessionIdsToPrune, pruneCombatHistory };
