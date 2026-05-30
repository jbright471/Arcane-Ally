import { describe, it, expect, beforeEach } from 'vitest';
const Database = require('better-sqlite3');
const { runMigrations } = require('../schema');
const {
    applyPartyEffect,
    previewPartyEffect,
} = require('../services/effects-engine');

describe('Effect Engine Preview & Consent', () => {
    let db;

    beforeEach(() => {
        db = new Database(':memory:');
        // Override the db module export for migrations
        const dbModule = require('../db');
        dbModule.exec = db.exec.bind(db);
        dbModule.prepare = db.prepare.bind(db);
        dbModule.transaction = db.transaction.bind(db);

        runMigrations();

        // Insert dummy character
        db.prepare(`
            INSERT INTO characters (id, name, class, level, max_hp, current_hp, ac, stats, data_json)
            VALUES (1, 'Hero', 'Fighter', 1, 50, 50, 15, '{"STR":16}', '{}')
        `).run();
        db.prepare(`
            INSERT INTO session_states (character_id, current_hp, temp_hp)
            VALUES (1, 50, 0)
        `).run();
    });

    it('should preview a damage effect without committing to the database', () => {
        const effects = [{ type: 'damage', value: 15, damageType: 'fire' }];
        
        const records = previewPartyEffect(db, effects, [{ id: 1, type: 'character' }]);
        
        expect(records.length).toBe(1);
        expect(records[0].success).toBe(true);
        expect(records[0].eventType).toBe('damage');
        expect(records[0].result.newHp).toBe(35); // 50 - 15 = 35

        // Verify the database was NOT updated
        const state = db.prepare('SELECT current_hp FROM session_states WHERE character_id = 1').get();
        expect(state.current_hp).toBe(50); // Original HP
        
        // Verify no event was written
        const events = db.prepare('SELECT count(*) as count FROM effect_events').get();
        expect(events.count).toBe(0);
    });

    it('should preview multiple effects without committing', () => {
        const effects = [
            { type: 'damage', value: 10, damageType: 'cold' },
            { type: 'condition', condition: 'Restrained' }
        ];

        const records = previewPartyEffect(db, effects, [{ id: 1, type: 'character' }]);
        expect(records.length).toBe(2);
        
        // Check DB state
        const state = db.prepare('SELECT current_hp, conditions_json FROM session_states WHERE character_id = 1').get();
        expect(state.current_hp).toBe(50);
        expect(state.conditions_json).toBe('[]');
    });

    it('should correctly apply the effect when applyPartyEffect is called', () => {
        const effects = [{ type: 'damage', value: 20, damageType: 'slashing' }];
        
        const records = applyPartyEffect(db, effects, [{ id: 1, type: 'character' }], 'System', 1, 0, 'action', null);
        
        expect(records.length).toBe(1);
        expect(records[0].success).toBe(true);

        // Verify DB was updated
        const state = db.prepare('SELECT current_hp FROM session_states WHERE character_id = 1').get();
        expect(state.current_hp).toBe(30);
        
        const events = db.prepare('SELECT * FROM effect_events').all();
        expect(events.length).toBe(1);
        expect(events[0].event_type).toBe('damage');
    });
});
