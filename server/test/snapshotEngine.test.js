'use strict';

import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './helpers/testDb.js';
import snapshotEngine from '../lib/snapshotEngine.js';

const { createSnapshot, computeDiff, restoreSnapshot } = snapshotEngine;

describe('combat snapshot lifecycle', () => {
  let db;
  let characterId;

  beforeEach(() => {
    db = createTestDb();
    db.exec(`
      CREATE TABLE combat_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        round INTEGER NOT NULL,
        turn_index INTEGER NOT NULL,
        state_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE combat_restore_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id INTEGER,
        action_type TEXT NOT NULL,
        dm_identity TEXT DEFAULT 'DM',
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        changed_entities_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'success'
      );
    `);

    characterId = Number(db.prepare(`
      INSERT INTO characters (name, class, level, max_hp, current_hp, ac)
      VALUES ('Snapshot Hero', 'Fighter', 3, 24, 24, 15)
    `).run().lastInsertRowid);
    db.prepare(`
      INSERT INTO session_states (character_id, current_hp)
      VALUES (?, 24)
    `).run(characterId);
    db.prepare(`
      INSERT INTO initiative_tracker (
        entity_name, entity_type, initiative, current_hp, max_hp, ac,
        is_active, sort_order, character_id, instance_id
      ) VALUES ('Snapshot Hero', 'pc', 14, 24, 24, 15, 1, 0, ?, 'snapshot-hero')
    `).run(characterId);
    db.prepare("INSERT OR REPLACE INTO campaign_state (key, value) VALUES ('combat_round', '2')").run();
    db.prepare("INSERT OR REPLACE INTO campaign_state (key, value) VALUES ('combat_turn_index', '0')").run();
  });

  it('previews and restores tracker and session HP atomically', () => {
    const snapshotId = createSnapshot(db, 'Before damage');

    db.prepare('UPDATE initiative_tracker SET current_hp = 7 WHERE character_id = ?').run(characterId);
    db.prepare('UPDATE session_states SET current_hp = 7 WHERE character_id = ?').run(characterId);
    db.prepare('UPDATE characters SET current_hp = 7 WHERE id = ?').run(characterId);

    const diff = computeDiff(db, snapshotId);
    expect(diff.combatants).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Snapshot Hero' }),
    ]));

    restoreSnapshot(db, snapshotId);

    expect(db.prepare('SELECT current_hp FROM initiative_tracker WHERE character_id = ?').get(characterId).current_hp).toBe(24);
    expect(db.prepare('SELECT current_hp FROM session_states WHERE character_id = ?').get(characterId).current_hp).toBe(24);
    expect(db.prepare('SELECT current_hp FROM characters WHERE id = ?').get(characterId).current_hp).toBe(24);
  });
});
