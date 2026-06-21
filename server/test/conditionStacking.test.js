import { describe, it, expect } from 'vitest';
const Database = require('better-sqlite3');
const { runMigrations } = require('../schema');
const { getResolvedCharacterState } = require('../lib/rulesIntegration');

describe('Condition & Item Stacking Integration', () => {
    let db;

    const setupTestDb = () => {
        db = new Database(':memory:');
        const dbModule = require('../db');
        dbModule.exec = db.exec.bind(db);
        dbModule.prepare = db.prepare.bind(db);
        dbModule.transaction = db.transaction.bind(db);
        runMigrations();
    };

    it('should correctly recalculate stats when an item is unequipped', () => {
        setupTestDb();
        
        const inventory = [
          {
            id: 'item-1',
            name: 'Gauntlets of Ogre Power',
            type: 'gear',
            equipped: true,
            stats: {
              statBonuses: {
                STR: 5
              }
            }
          }
        ];

        db.prepare(`
            INSERT INTO characters (id, name, class, level, max_hp, current_hp, ac, stats, inventory, data_json)
            VALUES (1, 'Vesper', 'Fighter', 5, 50, 50, 10, '{"STR":10,"DEX":10,"CON":10,"INT":10,"WIS":10,"CHA":10}', ?, '{}')
        `).run(JSON.stringify(inventory));

        db.prepare(`
            INSERT INTO session_states (character_id, current_hp, temp_hp, conditions_json, buffs_json)
            VALUES (1, 50, 0, '[]', '[]')
        `).run();

        // 1. Validate equipped state
        let state = getResolvedCharacterState(db, 1);
        expect(state.abilityScores.STR).toBe(15); // Base 10 + 5 from Gauntlets

        // 2. Unequip the item by updating the DB record
        const unequippedInventory = [{...inventory[0], equipped: false}];
        db.prepare(`
            UPDATE characters SET inventory = ? WHERE id = 1
        `).run(JSON.stringify(unequippedInventory));

        // 3. Validate unequipped state
        state = getResolvedCharacterState(db, 1);
        expect(state.abilityScores.STR).toBe(10); // Back to base 10
    });

    it('should resolve conflicting spell and item effects correctly', () => {
        setupTestDb();

        const inventory = [
          {
            id: 'item-1',
            name: 'Amulet of Health',
            type: 'gear',
            equipped: true,
            stats: {
              statBonuses: {
                CON: 4
              }
            }
          }
        ];

        db.prepare(`
            INSERT INTO characters (id, name, class, level, max_hp, current_hp, ac, stats, inventory, data_json)
            VALUES (2, 'Lyra', 'Wizard', 5, 30, 30, 10, '{"STR":10,"DEX":10,"CON":10,"INT":10,"WIS":10,"CHA":10}', ?, '{}')
        `).run(JSON.stringify(inventory));

        // Let's add conflicting effects:
        // A buff that gives +2 CON (should stack with item)
        // A buff that gives -6 CON (should subtract from total)
        // And an effect that sets a condition
        const activeBuffs = [
          { id: 'buff-1', name: 'Bear Endurance', modifierType: 'flatBonus', statAffected: 'CON', modifierValue: 2 },
          { id: 'buff-2', name: 'Sickening Radiance', modifierType: 'flatBonus', statAffected: 'CON', modifierValue: -6 }
        ];

        db.prepare(`
            INSERT INTO session_states (character_id, current_hp, temp_hp, conditions_json, buffs_json)
            VALUES (2, 30, 0, '[]', ?)
        `).run(JSON.stringify(activeBuffs));

        const state = getResolvedCharacterState(db, 2);

        // Calculation:
        // Base CON: 10
        // Amulet of Health: +4
        // Bear Endurance: +2
        // Sickening Radiance: -6
        // Expected: 10
        expect(state.abilityScores.CON).toBe(10);
    });

    it('should properly format and calculate ability modifiers with both items and conditions applied', () => {
        setupTestDb();

        const inventory = [
          {
            id: 'item-1',
            name: 'Belt of Dwarvenkind',
            type: 'gear',
            equipped: true,
            stats: {
              statBonuses: {
                CON: 2
              }
            }
          }
        ];

        db.prepare(`
            INSERT INTO characters (id, name, class, level, max_hp, current_hp, ac, stats, inventory, data_json)
            VALUES (3, 'Thorek', 'Barbarian', 5, 50, 50, 10, '{"STR":18,"DEX":14,"CON":16,"INT":10,"WIS":10,"CHA":10}', ?, '{}')
        `).run(JSON.stringify(inventory));

        const activeBuffs = [
          { id: 'buff-1', name: 'Enhance Ability (Bear)', modifierType: 'flatBonus', statAffected: 'CON', modifierValue: 2 }
        ];

        db.prepare(`
            INSERT INTO session_states (character_id, current_hp, temp_hp, conditions_json, buffs_json)
            VALUES (3, 50, 0, '[]', ?)
        `).run(JSON.stringify(activeBuffs));

        const state = getResolvedCharacterState(db, 3);

        // CON Calculation:
        // Base: 16
        // Belt: +2
        // Buff: +2
        // Total CON: 20
        expect(state.abilityScores.CON).toBe(20);

        // Modifier Calculation: floor((20 - 10) / 2) = +5
        expect(state.abilityModifiers.CON).toBe(5);
        expect(state.formattedModifiers.CON).toBe('+5');
    });
});
