'use strict';

import { describe, it, expect } from 'vitest';
import { validateImportDiff } from '../lib/importValidator.js';

describe('Import Guardrails Validator', () => {

    describe('New Characters (Absolute Boundaries)', () => {
        it('accepts a normal, valid character without requiring DM approval', () => {
            const incoming = {
                name: 'Garrick',
                level: 3,
                maxHp: 24,
                ac: 16,
                stats: JSON.stringify({ STR: 15, DEX: 14, CON: 13, INT: 10, WIS: 12, CHA: 8 })
            };
            const result = validateImportDiff(null, incoming);
            expect(result.requiresApproval).toBe(false);
            expect(result.flags.length).toBe(0);
        });

        it('flags a level > 20 as danger', () => {
            const incoming = {
                name: 'Epic Garrick',
                level: 21,
                maxHp: 150,
                ac: 18,
                stats: JSON.stringify({ STR: 15, DEX: 14, CON: 13, INT: 10, WIS: 12, CHA: 8 })
            };
            const result = validateImportDiff(null, incoming);
            expect(result.requiresApproval).toBe(true);
            const levelFlag = result.flags.find(f => f.field === 'level');
            expect(levelFlag).toBeDefined();
            expect(levelFlag.severity).toBe('danger');
        });

        it('flags an excessively high Max HP as danger', () => {
            const incoming = {
                name: 'Chunky Garrick',
                level: 5,
                maxHp: 301,
                ac: 15,
                stats: JSON.stringify({ STR: 15, DEX: 14, CON: 13, INT: 10, WIS: 12, CHA: 8 })
            };
            const result = validateImportDiff(null, incoming);
            expect(result.requiresApproval).toBe(true);
            const hpFlag = result.flags.find(f => f.field === 'maxHp');
            expect(hpFlag).toBeDefined();
            expect(hpFlag.severity).toBe('danger');
        });

        it('flags a suspiciously high AC as danger', () => {
            const incoming = {
                name: 'Iron Garrick',
                level: 5,
                maxHp: 40,
                ac: 26,
                stats: JSON.stringify({ STR: 15, DEX: 14, CON: 13, INT: 10, WIS: 12, CHA: 8 })
            };
            const result = validateImportDiff(null, incoming);
            expect(result.requiresApproval).toBe(true);
            const acFlag = result.flags.find(f => f.field === 'ac');
            expect(acFlag).toBeDefined();
            expect(acFlag.severity).toBe('danger');
        });

        it('flags an ability score exceeding 24 as danger', () => {
            const incoming = {
                name: 'God Garrick',
                level: 5,
                maxHp: 40,
                ac: 15,
                stats: JSON.stringify({ STR: 25, DEX: 14, CON: 13, INT: 10, WIS: 12, CHA: 8 })
            };
            const result = validateImportDiff(null, incoming);
            expect(result.requiresApproval).toBe(true);
            const statFlag = result.flags.find(f => f.field === 'stats.STR');
            expect(statFlag).toBeDefined();
            expect(statFlag.severity).toBe('danger');
        });
    });

    describe('Syncing Characters (Diffing Comparisons)', () => {
        const existing = {
            level: 4,
            max_hp: 32,
            ac: 15,
            stats: JSON.stringify({ STR: 14, DEX: 14, CON: 12, INT: 10, WIS: 12, CHA: 8 })
        };

        it('approves standard level-up (+1 level, normal HP, normal AC, stats unchanged)', () => {
            const incoming = {
                level: 5,
                maxHp: 40,
                ac: 15,
                stats: JSON.stringify({ STR: 14, DEX: 14, CON: 12, INT: 10, WIS: 12, CHA: 8 })
            };
            const result = validateImportDiff(existing, incoming);
            expect(result.requiresApproval).toBe(false);
            expect(result.flags.every(f => f.severity === 'info')).toBe(true);
        });

        it('flags a multi-level jump as danger', () => {
            const incoming = {
                level: 7,
                maxHp: 56,
                ac: 15,
                stats: JSON.stringify({ STR: 14, DEX: 14, CON: 12, INT: 10, WIS: 12, CHA: 8 })
            };
            const result = validateImportDiff(existing, incoming);
            expect(result.requiresApproval).toBe(true);
            const flag = result.flags.find(f => f.field === 'level');
            expect(flag.severity).toBe('danger');
        });

        it('flags a level decrease as warning', () => {
            const incoming = {
                level: 3,
                maxHp: 24,
                ac: 15,
                stats: JSON.stringify({ STR: 14, DEX: 14, CON: 12, INT: 10, WIS: 12, CHA: 8 })
            };
            const result = validateImportDiff(existing, incoming);
            expect(result.requiresApproval).toBe(true);
            const flag = result.flags.find(f => f.field === 'level');
            expect(flag.severity).toBe('warning');
        });

        it('flags massive HP increase (> 30%) as danger', () => {
            const incoming = {
                level: 4,
                maxHp: 45, // 32 to 45 is a 40.6% increase
                ac: 15,
                stats: JSON.stringify({ STR: 14, DEX: 14, CON: 12, INT: 10, WIS: 12, CHA: 8 })
            };
            const result = validateImportDiff(existing, incoming);
            expect(result.requiresApproval).toBe(true);
            const flag = result.flags.find(f => f.field === 'maxHp');
            expect(flag.severity).toBe('danger');
        });

        it('flags massive AC shift (+5 AC) as warning', () => {
            const incoming = {
                level: 4,
                maxHp: 32,
                ac: 20, // increase of 5
                stats: JSON.stringify({ STR: 14, DEX: 14, CON: 12, INT: 10, WIS: 12, CHA: 8 })
            };
            const result = validateImportDiff(existing, incoming);
            expect(result.requiresApproval).toBe(true);
            const flag = result.flags.find(f => f.field === 'ac');
            expect(flag.severity).toBe('warning');
        });

        it('flags score exceeding 20 as danger', () => {
            const incoming = {
                level: 4,
                maxHp: 32,
                ac: 15,
                stats: JSON.stringify({ STR: 21, DEX: 14, CON: 12, INT: 10, WIS: 12, CHA: 8 })
            };
            const result = validateImportDiff(existing, incoming);
            expect(result.requiresApproval).toBe(true);
            const flag = result.flags.find(f => f.field === 'stats.STR');
            expect(flag.severity).toBe('danger');
        });
    });
});
