import { describe, it, expect } from 'vitest';
import { resolveStatProvenance } from '../lib/rulesEngine';

describe('Stat Provenance Calculation Harness', () => {
  // Mock character base template
  const baseChar = {
    name: 'Thorin',
    level: 5, // Proficiency bonus = +3
    abilityScores: { STR: 14, DEX: 14, CON: 12, INT: 10, WIS: 10, CHA: 8 },
    speed: 30,
    saveProficiencies: { STR: true, CON: true },
    skills: {
      athletics: { name: 'athletics', ability: 'STR', proficient: true },
      stealth: { name: 'stealth', ability: 'DEX', proficient: false }
    }
  };

  it('calculates ability scores with flat gear and override buffs', () => {
    // Inventory with stat bonuses
    const inventory = [
      {
        name: 'Amulet of Health',
        equipped: true,
        stats: {
          statBonuses: { constitution: 2 }
        }
      },
      {
        name: 'Dull Ring',
        equipped: false, // Unequipped: should not affect scores
        stats: {
          statBonuses: { strength: 5 }
        }
      }
    ];

    // Override active buff (e.g., Giant Strength Belt)
    const buffs = [
      {
        name: 'Gauntlets of Ogre Power',
        modifierType: 'setScore',
        statAffected: 'STR',
        modifierValue: '19'
      }
    ];

    const provenance = resolveStatProvenance(baseChar, buffs, [], inventory);

    // STR: Base 14, Ogre power sets to 19
    expect(provenance.abilityScores.STR.final).toBe(19);
    const strSources = provenance.abilityScores.STR.sources;
    expect(strSources.some(s => s.source === 'Gauntlets of Ogre Power' && s.value === 19)).toBe(true);

    // CON: Base 12, Amulet gives +2 = 14
    expect(provenance.abilityScores.CON.final).toBe(14);
    const conSources = provenance.abilityScores.CON.sources;
    expect(conSources.some(s => s.source === 'Amulet of Health' && s.value === 2)).toBe(true);

    // INT: Unchanged = 10
    expect(provenance.abilityScores.INT.final).toBe(10);
  });

  it('calculates Speed correctly under multiplier and set-to-zero conditions', () => {
    // 1. Normal conditions + Haste (x2 speed)
    const hasteBuff = [{ name: 'Haste' }];
    const hasteRes = resolveStatProvenance(baseChar, hasteBuff, [], []);
    expect(hasteRes.speed.final).toBe(60); // 30 * 2

    // 2. Prone + Haste (Halved, then doubled = 30)
    const pronePr = resolveStatProvenance(baseChar, hasteBuff, ['prone'], []);
    expect(pronePr.speed.final).toBe(30); // Math.floor((30 * 2) * 0.5)

    // 3. Grappled (Sets speed to 0)
    const grappledRes = resolveStatProvenance(baseChar, hasteBuff, ['grappled'], []);
    expect(grappledRes.speed.final).toBe(0);

    // 4. Exhaustion Level 2 (Halves speed)
    const exhaust2 = resolveStatProvenance(baseChar, [], ['Exhaustion 2'], []);
    expect(exhaust2.speed.final).toBe(15);

    // 5. Exhaustion Level 5 (Sets speed to 0)
    const exhaust5 = resolveStatProvenance(baseChar, [], ['Exhaustion 5'], []);
    expect(exhaust5.speed.final).toBe(0);
  });

  it('resolves Armor Class base, heavy armor dex override, and shields', () => {
    // Character with Plate Armor base AC set to 18
    const armorChar = {
      ...baseChar,
      baseAc: 18
    };

    const inventory = [
      {
        name: 'Plate Armor',
        equipped: true,
        type: 'armor',
        stats: {
          ac: 18,
          armorType: 'heavy'
        }
      },
      {
        name: 'Shield of Protection',
        equipped: true,
        type: 'shield',
        stats: {
          acBonus: 2
        }
      }
    ];

    const buffs = [{ name: 'Shield of Faith' }]; // +2 AC

    const provenance = resolveStatProvenance(armorChar, buffs, [], inventory);

    // AC: Plate (18) + Shield (2) + Shield of Faith (2) = 22
    expect(provenance.ac.finalAC).toBe(22);
    const acSources = provenance.ac.breakdown;
    expect(acSources.some(s => s.source === 'Shield of Protection' && s.value === 2)).toBe(true);
    expect(acSources.some(s => s.source === 'shield of faith' && s.value === 2)).toBe(true);
  });

  it('determines Saving Throw proficiency, global bonuses, advantages, and automatic failures', () => {
    // Active Bless spell (+1d4 saves)
    const buffs = [{ name: 'Bless' }];
    // Condition Paralyzed (Auto-fail STR/DEX saves)
    const conditions = ['paralyzed'];

    const provenance = resolveStatProvenance(baseChar, buffs, conditions, []);

    // STR Save: Auto-fail (due to paralyzed)
    expect(provenance.saves.STR.rollState).toBe('auto-fail');

    // CON Save: Proficient (+3) + CON mod (+1) = +4. Bless adds '1d4' bonus roll
    expect(provenance.saves.CON.final).toBe(4);
    expect(provenance.saves.CON.sources.some(s => s.source === 'Proficiency' && s.value === 3)).toBe(true);
    expect(provenance.saves.CON.sources.some(s => s.source === 'Bless' && s.value === '1d4')).toBe(true);

    // CHA Save: Not proficient, modifier = -1
    expect(provenance.saves.CHA.final).toBe(-1);
  });
});
