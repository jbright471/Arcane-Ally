'use strict';

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './helpers/testDb.js';

describe('Effect Presets Database & Logic', () => {
    let db;

    beforeEach(() => {
        db = createTestDb();
        db.exec(`
            CREATE TABLE IF NOT EXISTS effect_presets (
              id           INTEGER PRIMARY KEY AUTOINCREMENT,
              name         TEXT NOT NULL,
              category     TEXT NOT NULL,
              effects_json TEXT NOT NULL DEFAULT '[]',
              description  TEXT DEFAULT '',
              is_locked    INTEGER DEFAULT 0,
              created_at   TEXT NOT NULL DEFAULT (datetime('now'))
            );
        `);

        // Seed default presets for testing
        const seedPresets = [
            {
                name: 'Bless',
                category: 'spell',
                effects_json: JSON.stringify([
                    {
                        type: 'buff',
                        buffData: { name: 'Bless', modifierType: 'flatBonus', statAffected: 'all saves', modifierValue: '2.5' }
                    }
                ]),
                description: 'Add d4 to saves',
                is_locked: 1
            },
            {
                name: 'Haste',
                category: 'spell',
                effects_json: JSON.stringify([
                    {
                        type: 'buff',
                        buffData: { name: 'Haste', modifierType: 'flatBonus', statAffected: 'ac', modifierValue: '2' }
                    }
                ]),
                description: 'Double speed, +2 AC',
                is_locked: 1
            },
            {
                name: 'Custom Shield',
                category: 'spell',
                effects_json: JSON.stringify([
                    {
                        type: 'buff',
                        buffData: { name: 'Shield', modifierType: 'flatBonus', statAffected: 'ac', modifierValue: '5' }
                    }
                ]),
                description: '+5 AC',
                is_locked: 0
            }
        ];

        for (const preset of seedPresets) {
            db.prepare(`
                INSERT INTO effect_presets (name, category, effects_json, description, is_locked)
                VALUES (?, ?, ?, ?, ?)
            `).run(preset.name, preset.category, preset.effects_json, preset.description, preset.is_locked);
        }
    });

    it('can retrieve all presets ordered by category and name', () => {
        const presets = db.prepare('SELECT * FROM effect_presets ORDER BY category ASC, name ASC').all();
        expect(presets.length).toBe(3);
        expect(presets[0].name).toBe('Bless');
        expect(presets[1].name).toBe('Custom Shield');
        expect(presets[2].name).toBe('Haste');
    });

    it('can insert a new custom preset', () => {
        const result = db.prepare(`
            INSERT INTO effect_presets (name, category, effects_json, description, is_locked)
            VALUES (?, ?, ?, ?, 0)
        `).run(
            'Enlarge',
            'spell',
            JSON.stringify([{ type: 'buff', buffData: { name: 'Enlarge', modifierType: 'flatBonus', statAffected: 'damage', modifierValue: '1d4' } }]),
            'Grow larger'
        );

        expect(result.changes).toBe(1);
        const preset = db.prepare('SELECT * FROM effect_presets WHERE id = ?').get(result.lastInsertRowid);
        expect(preset.name).toBe('Enlarge');
        expect(preset.is_locked).toBe(0);
    });

    it('allows updating unlocked custom presets', () => {
        const custom = db.prepare("SELECT * FROM effect_presets WHERE name = 'Custom Shield'").get();
        expect(custom.is_locked).toBe(0);

        db.prepare(`
            UPDATE effect_presets
            SET name = ?, description = ?
            WHERE id = ?
        `).run('Custom Shield v2', 'Super shield', custom.id);

        const updated = db.prepare('SELECT * FROM effect_presets WHERE id = ?').get(custom.id);
        expect(updated.name).toBe('Custom Shield v2');
        expect(updated.description).toBe('Super shield');
    });

    it('allows deleting unlocked custom presets', () => {
        const custom = db.prepare("SELECT * FROM effect_presets WHERE name = 'Custom Shield'").get();
        
        db.prepare('DELETE FROM effect_presets WHERE id = ?').run(custom.id);
        
        const count = db.prepare('SELECT COUNT(*) AS count FROM effect_presets WHERE id = ?').get(custom.id).count;
        expect(count).toBe(0);
    });
});
