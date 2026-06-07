'use strict';

import { describe, it, expect } from 'vitest';
import {
  resolveCurrentAC,
  resolveSavingThrows,
  resolveSkills,
  resolveSpeed,
} from '../lib/rulesEngine.js';

describe('D&D 5e Rules Engine Provenance Calculations', () => {

  // 1. Unarmored Defense (Monk vs Barbarian)
  describe('Unarmored Defense', () => {
    it('calculates Monk Unarmored Defense (10 + DEX mod + WIS mod)', () => {
      const character = {
        level: 1,
        baseAc: 10,
        abilityScores: { STR: 10, DEX: 14, CON: 10, INT: 10, WIS: 16, CHA: 10 },
        features: [
          { name: 'Unarmored Defense', description: 'While you are wearing no armor and not wielding a shield, your AC equals 10 + your Dexterity modifier + your Wisdom modifier.' }
        ]
      };
      // DEX mod = +2, WIS mod = +3 -> AC = 10 + 2 + 3 = 15
      const result = resolveCurrentAC(character, [], [], []);
      expect(result.finalAC).toBe(15);
      expect(result.acMethod).toBe('unarmored-monk');
    });

    it('calculates Barbarian Unarmored Defense (10 + DEX mod + CON mod)', () => {
      const character = {
        level: 1,
        baseAc: 10,
        abilityScores: { STR: 10, DEX: 14, CON: 16, INT: 10, WIS: 10, CHA: 10 },
        features: [
          { name: 'Unarmored Defense', description: 'While you are not wearing any armor, your Armor Class equals 10 + your Dexterity modifier + your Constitution modifier.' }
        ]
      };
      // DEX mod = +2, CON mod = +3 -> AC = 10 + 2 + 3 = 15
      const result = resolveCurrentAC(character, [], [], []);
      expect(result.finalAC).toBe(15);
      expect(result.acMethod).toBe('unarmored-barbarian');
    });
  });

  // 2. Boots of Speed + Grappled
  describe('Boots of Speed + Grappled interaction', () => {
    it('doubles speed with Boots of Speed, but overrides to 0 if Grappled', () => {
      const character = { speed: 30 };
      const inventory = [
        { name: 'Boots of Speed', equipped: true, stats: { doubleSpeed: true } }
      ];
      // Only Boots of Speed -> 30 * 2 = 60
      const activeSpeed = resolveSpeed(character, [], [], inventory);
      expect(activeSpeed.finalSpeed).toBe(60);

      // Boots of Speed + Grappled -> 0
      const grappledSpeed = resolveSpeed(character, [], ['grappled'], inventory);
      expect(grappledSpeed.finalSpeed).toBe(0);
      expect(grappledSpeed.breakdown[grappledSpeed.breakdown.length - 1].source).toBe('Grappled');
    });
  });

  // 3. Boots of Elvenkind (Stealth)
  describe('Boots of Elvenkind', () => {
    it('applies a +5 skill bonus to Stealth from Boots of Elvenkind', () => {
      const character = {
        level: 1,
        abilityScores: { STR: 10, DEX: 14, CON: 10, INT: 10, WIS: 10, CHA: 10 },
        skillProficiencies: { stealth: 1 } // proficient in stealth (+2 proficiency bonus)
      };
      const inventory = [
        { name: 'Boots of Elvenkind', equipped: true, stats: { skillBonuses: { stealth: 5 } } }
      ];
      // DEX modifier = +2, Proficiency = +2, Boots = +5 -> Total = +9
      const result = resolveSkills(character, [], [], inventory);
      expect(result.finalSkills.stealth).toBe(9);
      expect(result.breakdown.stealth).toContainEqual(expect.objectContaining({ source: 'Boots of Elvenkind', value: 5 }));
    });
  });

  // 4. Cloak of Protection + Bless (Saving Throws)
  describe('Cloak of Protection + Bless', () => {
    it('accumulates +1 flat save bonus from Cloak of Protection and +2.5 avg from Bless', () => {
      const character = {
        level: 1,
        abilityScores: { STR: 10, DEX: 14, CON: 10, INT: 10, WIS: 10, CHA: 10 },
        saveProficiencies: { dex: true } // DEX mod = +2, Proficiency = +2
      };
      const inventory = [
        { name: 'Cloak of Protection', equipped: true, stats: { saveBonus: 1 } }
      ];
      const buffs = [
        { name: 'Bless', sourceName: 'Cleric' }
      ];
      // DEX save = 2 (mod) + 2 (prof) + 1 (cloak) + 2.5 (bless) = 7.5
      const result = resolveSavingThrows(character, buffs, [], inventory);
      expect(result.finalSaves.DEX).toBe(7.5);
      expect(result.breakdown.DEX).toContainEqual(expect.objectContaining({ source: 'Cloak of Protection', value: 1 }));
      expect(result.breakdown.DEX).toContainEqual(expect.objectContaining({ source: 'Bless', value: 2.5 }));
    });
  });

  // 5. Expertise in Athletics
  describe('Expertise in Athletics', () => {
    it('calculates Athletics using STR mod + (proficiencyBonus * 2)', () => {
      const character = {
        level: 5, // proficiency bonus = +3
        abilityScores: { STR: 16, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
        skillProficiencies: { athletics: 2 } // Expertise
      };
      // STR mod = +3, Expertise bonus = 2 * 3 = +6 -> Total Athletics = 9
      const result = resolveSkills(character, [], [], []);
      expect(result.finalSkills.athletics).toBe(9);
      expect(result.breakdown.athletics).toContainEqual(expect.objectContaining({ source: 'Expertise', value: 6 }));
    });
  });

  // 6. Haste Buff + Exhaustion
  describe('Haste + Exhaustion interaction', () => {
    it('doubles speed with Haste, and halves it with Exhaustion Level 2', () => {
      const character = { speed: 30 };
      const buffs = [
        { name: 'Haste', sourceName: 'Wizard' }
      ];
      // Only Haste -> 30 * 2 = 60
      const hasteSpeed = resolveSpeed(character, buffs, [], []);
      expect(hasteSpeed.finalSpeed).toBe(60);

      // Haste + Exhaustion Level 2 -> (30 * 2) / 2 = 30
      const exhaustedHasteSpeed = resolveSpeed(character, buffs, ['Exhaustion 2'], []);
      expect(exhaustedHasteSpeed.finalSpeed).toBe(30);
      expect(exhaustedHasteSpeed.breakdown).toContainEqual(expect.objectContaining({ source: 'Haste', value: 'x2' }));
      expect(exhaustedHasteSpeed.breakdown).toContainEqual(expect.objectContaining({ source: 'Exhaustion Level 2', value: 'Halved' }));
    });
  });

});
