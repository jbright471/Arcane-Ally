'use strict';

/**
 * Creates a persistent snapshot of the current combat state, including round/turn,
 * all initiative slots, andvolatile session states of all party members.
 * @param {object} db - better-sqlite3 db instance
 * @param {string} label - Descriptive tag for the rollback state
 * @returns {number} The newly created snapshot ID
 */
function createSnapshot(db, label) {
  // 1. Get round and turn from campaign_state
  let round = 0;
  let turnIndex = 0;
  const roundRow = db.prepare("SELECT value FROM campaign_state WHERE key = 'combat_round'").get();
  const turnRow = db.prepare("SELECT value FROM campaign_state WHERE key = 'combat_turn_index'").get();
  if (roundRow) round = parseInt(roundRow.value, 10) || 0;
  if (turnRow) turnIndex = parseInt(turnRow.value, 10) || 0;

  // 2. Fetch all rows from initiative_tracker
  const trackerRows = db.prepare("SELECT * FROM initiative_tracker").all();

  // 3. Fetch all rows from session_states
  const sessionRows = db.prepare("SELECT * FROM session_states").all();

  const stateObj = {
    combat_round: round,
    combat_turn_index: turnIndex,
    initiative_tracker: trackerRows,
    session_states: sessionRows
  };

  const stateJson = JSON.stringify(stateObj);

  // 4. Save to combat_snapshots
  const result = db.prepare(`
    INSERT INTO combat_snapshots (label, round, turn_index, state_json)
    VALUES (?, ?, ?, ?)
  `).run(label, round, turnIndex, stateJson);

  return result.lastInsertRowid;
}

/**
 * Computes a detailed side-by-side diff between the current active state in the DB
 * and the serialized parameters stored inside a targeted snapshot.
 * @param {object} db - better-sqlite3 db instance
 * @param {number} snapshotId - Target snapshot primary key
 * @returns {object|null} Computed comparison model or null if not found
 */
function computeDiff(db, snapshotId) {
  const snapshot = db.prepare("SELECT * FROM combat_snapshots WHERE id = ?").get(snapshotId);
  if (!snapshot) return null;

  const snapState = JSON.parse(snapshot.state_json);

  // 1. Live Global State
  let liveRound = 0;
  let liveTurn = 0;
  const roundRow = db.prepare("SELECT value FROM campaign_state WHERE key = 'combat_round'").get();
  const turnRow = db.prepare("SELECT value FROM campaign_state WHERE key = 'combat_turn_index'").get();
  if (roundRow) liveRound = parseInt(roundRow.value, 10) || 0;
  if (turnRow) liveTurn = parseInt(turnRow.value, 10) || 0;

  // Find active entity in both
  const liveActive = db.prepare("SELECT entity_name FROM initiative_tracker WHERE is_active = 1").get();
  const snapActive = snapState.initiative_tracker.find(e => e.is_active === 1);

  const globalDiff = {
    round: { current: liveRound, snapshot: snapState.combat_round },
    turnIndex: { current: liveTurn, snapshot: snapState.combat_turn_index },
    activeEntity: {
      current: liveActive ? liveActive.entity_name : 'None',
      snapshot: snapActive ? snapActive.entity_name : 'None'
    }
  };

  // 2. Fetch live data
  const liveTracker = db.prepare("SELECT * FROM initiative_tracker").all();
  const liveSessions = db.prepare("SELECT * FROM session_states").all();

  const getCombatantKey = (e) => {
    if (e.character_id) return `pc-${e.character_id}`;
    if (e.instance_id) return `monster-${e.instance_id}`;
    return `monster-${e.entity_name}`;
  };

  const liveMap = {};
  for (const e of liveTracker) {
    const key = getCombatantKey(e);
    let hp = e.current_hp;
    let tempHp = 0;
    let conditions = [];
    let buffs = [];
    let spellSlotsUsed = {};

    if (e.character_id) {
      const sess = liveSessions.find(s => s.character_id === e.character_id);
      if (sess) {
        hp = sess.current_hp ?? hp;
        tempHp = sess.temp_hp ?? 0;
        try { conditions = JSON.parse(sess.conditions_json || '[]'); } catch(_) {}
        try { buffs = JSON.parse(sess.buffs_json || '[]'); } catch(_) {}
        try { spellSlotsUsed = JSON.parse(sess.slots_used_json || '{}'); } catch(_) {}
      }
    } else {
      if (e.stats_json) {
        try {
          const statsObj = JSON.parse(e.stats_json);
          conditions = statsObj.conditions || [];
          buffs = statsObj.buffs || [];
        } catch(_) {}
      }
    }

    liveMap[key] = {
      name: e.entity_name,
      type: e.entity_type,
      hp,
      tempHp,
      conditions,
      buffs,
      spellSlotsUsed
    };
  }

  const snapMap = {};
  for (const e of snapState.initiative_tracker) {
    const key = getCombatantKey(e);
    let hp = e.current_hp;
    let tempHp = 0;
    let conditions = [];
    let buffs = [];
    let spellSlotsUsed = {};

    if (e.character_id) {
      const sess = snapState.session_states.find(s => s.character_id === e.character_id);
      if (sess) {
        hp = sess.current_hp ?? hp;
        tempHp = sess.temp_hp ?? 0;
        try { conditions = JSON.parse(sess.conditions_json || '[]'); } catch(_) {}
        try { buffs = JSON.parse(sess.buffs_json || '[]'); } catch(_) {}
        try { spellSlotsUsed = JSON.parse(sess.slots_used_json || '{}'); } catch(_) {}
      }
    } else {
      if (e.stats_json) {
        try {
          const statsObj = JSON.parse(e.stats_json);
          conditions = statsObj.conditions || [];
          buffs = statsObj.buffs || [];
        } catch(_) {}
      }
    }

    snapMap[key] = {
      name: e.entity_name,
      type: e.entity_type,
      hp,
      tempHp,
      conditions,
      buffs,
      spellSlotsUsed
    };
  }

  // 3. Compute differences
  const combatantDiffs = [];
  const allKeys = new Set([...Object.keys(liveMap), ...Object.keys(snapMap)]);

  for (const key of allKeys) {
    const live = liveMap[key];
    const snap = snapMap[key];

    if (!live) {
      combatantDiffs.push({
        key,
        name: snap.name,
        type: snap.type,
        action: 'will_be_readded',
        hp: { current: null, snapshot: snap.hp },
        tempHp: { current: null, snapshot: snap.tempHp },
        conditions: { added: snap.conditions, removed: [] },
        buffs: { added: snap.buffs.map(b => b.name || b), removed: [] },
        spellSlots: { current: {}, snapshot: snap.spellSlotsUsed }
      });
      continue;
    }

    if (!snap) {
      combatantDiffs.push({
        key,
        name: live.name,
        type: live.type,
        action: 'will_be_removed',
        hp: { current: live.hp, snapshot: null },
        tempHp: { current: live.tempHp, snapshot: null },
        conditions: { added: [], removed: live.conditions },
        buffs: { added: [], removed: live.buffs.map(b => b.name || b) },
        spellSlots: { current: live.spellSlotsUsed, snapshot: {} }
      });
      continue;
    }

    const hpChanged = live.hp !== snap.hp || live.tempHp !== snap.tempHp;

    const liveCondsSet = new Set(live.conditions.map(c => c.toLowerCase()));
    const snapCondsSet = new Set(snap.conditions.map(c => c.toLowerCase()));
    const addedConds = snap.conditions.filter(c => !liveCondsSet.has(c.toLowerCase()));
    const removedConds = live.conditions.filter(c => !snapCondsSet.has(c.toLowerCase()));

    const liveBuffsSet = new Set(live.buffs.map(b => (b.name || b).toLowerCase()));
    const snapBuffsSet = new Set(snap.buffs.map(b => (b.name || b).toLowerCase()));
    const addedBuffs = snap.buffs.filter(b => !liveBuffsSet.has((b.name || b).toLowerCase())).map(b => b.name || b);
    const removedBuffs = live.buffs.filter(b => !snapBuffsSet.has((b.name || b).toLowerCase())).map(b => b.name || b);

    const spellSlotsChanged = JSON.stringify(live.spellSlotsUsed) !== JSON.stringify(snap.spellSlotsUsed);

    if (hpChanged || addedConds.length > 0 || removedConds.length > 0 || addedBuffs.length > 0 || removedBuffs.length > 0 || spellSlotsChanged) {
      combatantDiffs.push({
        key,
        name: live.name,
        type: live.type,
        action: 'will_be_updated',
        hp: { current: live.hp, snapshot: snap.hp },
        tempHp: { current: live.tempHp, snapshot: snap.tempHp },
        conditions: { added: addedConds, removed: removedConds },
        buffs: { added: addedBuffs, removed: removedBuffs },
        spellSlots: { current: live.spellSlotsUsed, snapshot: snap.spellSlotsUsed }
      });
    }
  }

  const diffResult = {
    id: snapshot.id,
    label: snapshot.label,
    createdAt: snapshot.created_at,
    global: globalDiff,
    combatants: combatantDiffs
  };

  try {
    const changedEntities = combatantDiffs.filter(c => c.action !== 'will_be_readded').map(c => c.name);
    db.prepare(`
      INSERT INTO combat_restore_audit (snapshot_id, action_type, changed_entities_json, status)
      VALUES (?, 'preview', ?, 'success')
    `).run(snapshotId, JSON.stringify(changedEntities));
  } catch (err) {
    console.error("[Audit] Failed to log preview action:", err);
  }

  return diffResult;
}

/**
 * Atomically restores a global combat state from a persistent snapshot.
 * Executes inside a SQLite transaction to prevent corruption.
 * @param {object} db - better-sqlite3 db instance
 * @param {number} snapshotId - Target snapshot primary key
 * @returns {object} Restored state parameters
 */
function restoreSnapshot(db, snapshotId) {
  const snapshot = db.prepare("SELECT * FROM combat_snapshots WHERE id = ?").get(snapshotId);
  if (!snapshot) throw new Error("Snapshot not found");

  const snapState = JSON.parse(snapshot.state_json);

  const executeRestore = db.transaction(() => {
    // 1. Restore round and turn in campaign_state
    db.prepare("INSERT OR REPLACE INTO campaign_state (key, value) VALUES ('combat_round', ?)")
      .run((snapState.combat_round ?? 0).toString());
    db.prepare("INSERT OR REPLACE INTO campaign_state (key, value) VALUES ('combat_turn_index', ?)")
      .run((snapState.combat_turn_index ?? 0).toString());

    // 2. Clear and restore initiative_tracker
    db.prepare("DELETE FROM initiative_tracker").run();
    const insertTracker = db.prepare(`
      INSERT INTO initiative_tracker (
        id, entity_name, entity_type, initiative, current_hp, max_hp, ac,
        is_active, is_hidden, sort_order, character_id, encounter_id, instance_id, stats_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const row of snapState.initiative_tracker) {
      insertTracker.run(
        row.id, row.entity_name, row.entity_type, row.initiative, row.current_hp, row.max_hp, row.ac,
        row.is_active, row.is_hidden, row.sort_order, row.character_id, row.encounter_id, row.instance_id, row.stats_json
      );
    }

    // 3. Clear and restore session_states
    db.prepare("DELETE FROM session_states").run();
    const insertSession = db.prepare(`
      INSERT INTO session_states (
        character_id, session_id, current_hp, temp_hp, death_saves_json,
        conditions_json, buffs_json, concentrating_on, slots_used_json,
        hd_used_json, feature_uses_json, active_features_json, condition_durations_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const row of snapState.session_states) {
      insertSession.run(
        row.character_id, row.session_id, row.current_hp, row.temp_hp, row.death_saves_json,
        row.conditions_json, row.buffs_json, row.concentrating_on, row.slots_used_json,
        row.hd_used_json, row.feature_uses_json, row.active_features_json, row.condition_durations_json, row.updated_at
      );
    }

    // 4. Sync character HPs in characters table to match session states
    const syncCharHp = db.prepare("UPDATE characters SET current_hp = ? WHERE id = ?");
    for (const row of snapState.session_states) {
      syncCharHp.run(row.current_hp, row.character_id);
    }
  });

  try {
    executeRestore();

    try {
      db.prepare(`
        INSERT INTO combat_restore_audit (snapshot_id, action_type, changed_entities_json, status)
        VALUES (?, 'restore', ?, 'success')
      `).run(snapshotId, JSON.stringify(snapState.initiative_tracker.map(e => e.entity_name)));
    } catch (auditErr) {
      console.error("[Audit] Failed to log restore success:", auditErr);
    }

    return snapState;
  } catch (err) {
    try {
      db.prepare(`
        INSERT INTO combat_restore_audit (snapshot_id, action_type, changed_entities_json, status)
        VALUES (?, 'restore', '[]', 'failure')
      `).run(snapshotId);
    } catch (auditErr) {
      console.error("[Audit] Failed to log restore failure:", auditErr);
    }
    throw err;
  }
}

module.exports = {
  createSnapshot,
  computeDiff,
  restoreSnapshot
};
