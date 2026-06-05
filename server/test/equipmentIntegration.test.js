import { describe, it, expect } from 'vitest';
const Database = require('better-sqlite3');
const { runMigrations } = require('../schema');
const { getResolvedCharacterState } = require('../lib/rulesIntegration');

describe('Equipment Integration & Stacking Rules', () => {
    let db;

    const setupTestDb = () => {
        db = new Database(':memory:');
        const dbModule = require('../db');
        dbModule.exec = db.exec.bind(db);
        dbModule.prepare = db.prepare.bind(db);
        dbModule.transaction = db.transaction.bind(db);
        runMigrations();
    };

    it('should parse and evaluate level-scaling formulas', () => {
        setupTestDb();
        
        // Character level 10
        // Item stats has acBonus = "1 + floor(level / 5)" -> +3 AC
        // Item stats has statBonuses.STR = "floor(level / 2)" -> +5 STR
        const inventory = [
          {
            id: 'item-1',
            name: 'Gothic Plate',
            type: 'armor',
            equipped: true,
            stats: {
              acBonus: '1 + floor(level / 5)',
              statBonuses: {
                STR: 'floor(level / 2)'
              }
            }
          }
        ];

        db.prepare(`
            INSERT INTO characters (id, name, class, level, max_hp, current_hp, ac, stats, inventory, data_json)
            VALUES (1, 'Vesper', 'Paladin', 10, 80, 80, 10, '{"STR":15,"DEX":10,"CON":10,"INT":10,"WIS":10,"CHA":10}', ?, '{}')
        `).run(JSON.stringify(inventory));

        db.prepare(`
            INSERT INTO session_states (character_id, current_hp, temp_hp, conditions_json, buffs_json)
            VALUES (1, 80, 0, '[]', '[]')
        `).run();

        const state = getResolvedCharacterState(db, 1);
        
        // Base AC is 10 + 3 (formula acBonus) = 13 AC
        expect(state.ac).toBe(13);
        
        // Base STR is 15 + 5 (formula statBonuses.STR) = 20 STR
        expect(state.abilityScores.STR).toBe(20);
    });

    it('should drop equipment bonuses if disabled by active conditions', () => {
        setupTestDb();

        const inventory = [
          {
            id: 'item-1',
            name: 'Tower Shield',
            type: 'shield',
            equipped: true,
            stats: {
              acBonus: 3,
              disabledByConditions: ['paralyzed']
            }
          }
        ];

        // Character level 5
        db.prepare(`
            INSERT INTO characters (id, name, class, level, max_hp, current_hp, ac, stats, inventory, data_json)
            VALUES (2, 'Kaelen', 'Fighter', 5, 50, 50, 10, '{"STR":10,"DEX":10,"CON":10,"INT":10,"WIS":10,"CHA":10}', ?, '{}')
        `).run(JSON.stringify(inventory));

        // 1. Without paralyzed condition
        db.prepare(`
            INSERT INTO session_states (character_id, current_hp, temp_hp, conditions_json, buffs_json)
            VALUES (2, 50, 0, '[]', '[]')
        `).run();

        let state = getResolvedCharacterState(db, 2);
        expect(state.ac).toBe(13); // +3 AC active

        // 2. With paralyzed condition
        db.prepare(`
            UPDATE session_states SET conditions_json = '["paralyzed"]' WHERE character_id = 2
        `).run();

        state = getResolvedCharacterState(db, 2);
        expect(state.ac).toBe(10); // Tower shield disabled, AC back to 10
    });

    it('should deduplicate stacking buffs and inventory items', () => {
        setupTestDb();

        const inventory = [
          // Two shields equipped — only the best one should benefit the character
          {
            id: 'shield-1',
            name: 'Iron Shield',
            type: 'shield',
            equipped: true,
            stats: { acBonus: 2 }
          },
          {
            id: 'shield-2',
            name: 'Spiked Shield',
            type: 'shield',
            equipped: true,
            stats: { acBonus: 1 }
          },
          // Duplicate items by name — only one Ring of Protection should apply
          {
            id: 'ring-1',
            name: 'Ring of Protection',
            type: 'ring',
            equipped: true,
            stats: { acBonus: 1 }
          },
          {
            id: 'ring-2',
            name: 'ring of protection',
            type: 'ring',
            equipped: true,
            stats: { acBonus: 1 }
          }
        ];

        db.prepare(`
            INSERT INTO characters (id, name, class, level, max_hp, current_hp, ac, stats, inventory, data_json)
            VALUES (3, 'Valerie', 'Cleric', 5, 40, 40, 10, '{"STR":10,"DEX":10,"CON":10,"INT":10,"WIS":10,"CHA":10}', ?, '{}')
        `).run(JSON.stringify(inventory));

        // Two Bless buffs with different values — only the higher (+4) should apply
        const activeBuffs = [
          { id: 'buff-1', name: 'Bless', modifierType: 'flatBonus', statAffected: 'STR', modifierValue: 2 },
          { id: 'buff-2', name: 'bless', modifierType: 'flatBonus', statAffected: 'STR', modifierValue: 4 }
        ];

        db.prepare(`
            INSERT INTO session_states (character_id, current_hp, temp_hp, conditions_json, buffs_json)
            VALUES (3, 40, 0, '[]', ?)
        `).run(JSON.stringify(activeBuffs));

        const state = getResolvedCharacterState(db, 3);

        // AC calculation:
        // Base: 10
        // Best Shield (Iron Shield): +2
        // Ring of Protection (1 applied, 1 duplicate ignored): +1
        // Total AC should be 13 (not 10 + 2 + 1 + 1 + 1 = 15)
        expect(state.ac).toBe(13);

        // STR calculation:
        // Base: 10
        // Bless (+4 applied, +2 ignored): +4
        // Total STR should be 14 (not 16)
        expect(state.abilityScores.STR).toBe(14);
    });
});
