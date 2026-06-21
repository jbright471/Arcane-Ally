// server/lib/rulesEngine.js
//
// Pure rules engine for D&D 5e mechanics.
// All functions are pure where possible — they take state in, return results out.
// DB writes are handled by the integration layer (rulesIntegration.js), not here.
// This makes the logic fully testable without a database.

'use strict';

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

const DAMAGE_TYPES = [
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning',
  'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing',
  'thunder',
  'magical bludgeoning', 'magical piercing', 'magical slashing',
];

const CONDITION_EFFECTS = {
  blinded: {
    description: 'Attacks against you have advantage. Your attacks have disadvantage.',
    attacksAgainstAdvantage: true,
    attacksDisadvantage: true,
    autoFail: ['sight-based checks'],
  },
  charmed: {
    description: 'Cannot attack the charmer. Charmer has advantage on social checks.',
    socialAdvantageForCharmer: true,
  },
  deafened: {
    description: 'Cannot hear. Auto-fail hearing checks.',
    autoFail: ['hearing checks'],
  },
  exhaustion: {
    description: 'Cumulative penalties by level (1-6).',
    isLeveled: true,
  },
  frightened: {
    description: 'Disadvantage on checks/attacks while source is in sight. Cannot move closer.',
    attacksDisadvantage: true,
    checksDisadvantage: true,
  },
  grappled: {
    description: 'Speed = 0.',
    speedOverride: 0,
  },
  incapacitated: {
    description: 'Cannot take actions or reactions.',
    noActions: true,
    noReactions: true,
  },
  invisible: {
    description: 'Attacks against you have disadvantage. Your attacks have advantage.',
    attacksAgainstDisadvantage: true,
    attacksAdvantage: true,
  },
  paralyzed: {
    description: 'Incapacitated. Auto-fail STR/DEX saves. Attacks against have advantage. Hits within 5ft are crits.',
    noActions: true,
    noReactions: true,
    autoFail: ['STR', 'DEX'],
    attacksAgainstAdvantage: true,
    critRangeWithin5ft: true,
  },
  petrified: {
    description: 'Incapacitated, can\'t move/speak, unaware. Resistance to all damage. Immune to poison/disease.',
    noActions: true,
    noReactions: true,
    speedOverride: 0,
    resistAll: true,
    attacksAgainstAdvantage: true,
    autoFail: ['STR', 'DEX'],
  },
  poisoned: {
    description: 'Disadvantage on attack rolls and ability checks.',
    attacksDisadvantage: true,
    checksDisadvantage: true,
  },
  prone: {
    description: 'Disadvantage on attacks. Attacks against: advantage within 5ft, disadvantage at range.',
    attacksDisadvantage: true,
    attacksAgainstAdvantageCloseMelee: true,
    attacksAgainstDisadvantageRanged: true,
    halveMoveSpeed: true,
  },
  restrained: {
    description: 'Speed = 0. Disadvantage on attacks. Attacks against have advantage. Disadvantage on DEX saves.',
    speedOverride: 0,
    attacksDisadvantage: true,
    attacksAgainstAdvantage: true,
    savingThrowDisadvantage: ['DEX'],
  },
  stunned: {
    description: 'Incapacitated, can\'t move, can only speak falteringly. Auto-fail STR/DEX saves. Attacks against have advantage.',
    noActions: true,
    noReactions: true,
    speedOverride: 0,
    attacksAgainstAdvantage: true,
    autoFail: ['STR', 'DEX'],
  },
  unconscious: {
    description: 'Incapacitated, can\'t move or speak, unaware. Drop whatever held, fall prone. Auto-fail STR/DEX saves. Attacks against advantage. Hits within 5ft are crits.',
    noActions: true,
    noReactions: true,
    speedOverride: 0,
    prone: true,
    attacksAgainstAdvantage: true,
    critRangeWithin5ft: true,
    autoFail: ['STR', 'DEX'],
  },
};

const BUFF_EFFECTS = {
  'bless': {
    description: '+1d4 to attack rolls and saving throws.',
    attackBonusRoll: '1d4',
    saveBonusRoll: '1d4',
  },
  'haste': {
    description: '+2 AC, advantage on DEX saves, additional action.',
    acBonus: 2,
    saveAdvantage: ['DEX'],
  },
  'shield of faith': {
    description: '+2 AC.',
    acBonus: 2,
  },
  'bane': {
    description: '-1d4 to attack rolls and saving throws.',
    attackBonusRoll: '-1d4',
    saveBonusRoll: '-1d4',
  },
  'rage': {
    description: 'Resistance to bludgeoning, piercing, and slashing damage. Advantage on STR checks/saves.',
    saveAdvantage: ['STR'],
    damageResistance: ['bludgeoning', 'piercing', 'slashing']
  },
  'slow': {
    description: '-2 AC, -2 to DEX saves, speed halved, limited actions.',
    acBonus: -2,
    savePenalty: ['DEX', -2]
  }
};

const KNOWN_CONCENTRATION_SPELLS = new Set([
  "bless", "bane", "faerie fire", "hunters mark", "hunter's mark",
  "hex", "hypnotic pattern", "hold person", "hold monster",
  "web", "entangle", "fog cloud", "silence", "darkness",
  "fly", "haste", "slow", "polymorph", "greater invisibility",
  "concentration spell",
  "shield of faith", "spirit guardians", "call lightning",
  "conjure animals", "conjure woodland beings", "wall of fire",
  "heat metal", "barkskin", "moonbeam", "plant growth",
  "magic weapon", "levitate", "suggestion", "zone of truth",
  "protection from evil and good", "protection from evil",
  "aid", "invisibility", "spiritual weapon",
]);

// ---------------------------------------------------------------------------
// LOGIC
// ---------------------------------------------------------------------------

function resolveDamage(currentState, rawDamage, damageType = 'untyped', resistances = [], immunities = [], vulnerabilities = [], activeConditions = [], activeBuffs = []) {
  const { currentHp, tempHp = 0, maxHp: _maxHp } = currentState;
  const type = damageType.toLowerCase().trim();

  let finalResistances = [...resistances];
  for (const buff of activeBuffs) {
    const buffName = (buff.name || '').toLowerCase();
    const effect = BUFF_EFFECTS[buffName];
    if (effect && effect.damageResistance) {
      finalResistances.push(...effect.damageResistance);
    }
  }

  if (immunities.map(i => i.toLowerCase()).includes(type)) {
    return { newCurrentHp: currentHp, newTempHp: tempHp, damageDealt: 0, absorbed: 0, overkill: 0, modifier: 'immune' };
  }

  const isPetrified = activeConditions.map(c => c.toLowerCase()).includes('petrified');
  const isVulnerable = vulnerabilities.map(v => v.toLowerCase()).includes(type);
  const isResistant = !isPetrified && finalResistances.map(r => r.toLowerCase()).includes(type);

  let effectiveDamage = rawDamage;
  if (isPetrified || isResistant) {
    effectiveDamage = Math.floor(rawDamage / 2);
  } else if (isVulnerable) {
    effectiveDamage = rawDamage * 2;
  }

  const tempAbsorbed = Math.min(tempHp, effectiveDamage);
  const remainingDamage = effectiveDamage - tempAbsorbed;
  const newTempHp = tempHp - tempAbsorbed;
  const newCurrentHp = Math.max(0, currentHp - remainingDamage);
  const overkill = Math.max(0, remainingDamage - currentHp);

  return {
    newCurrentHp, newTempHp, damageDealt: effectiveDamage, absorbed: tempAbsorbed, overkill,
    modifier: isPetrified || isResistant ? 'resistance' : isVulnerable ? 'vulnerability' : 'normal',
  };
}

function resolveHeal(currentState, amount) {
  const { currentHp, tempHp = 0, maxHp } = currentState;
  const newCurrentHp = Math.min(maxHp, currentHp + amount);
  return { newCurrentHp, newTempHp: tempHp, healed: newCurrentHp - currentHp };
}

function resolveTempHp(currentTempHp, newAmount) {
  const newTempHp = Math.max(currentTempHp, newAmount);
  return { newTempHp, replaced: newAmount > currentTempHp };
}

function resolveDeathSave(current, isSuccess, isCriticalFail = false, isCriticalSuccess = false) {
  let { successes, failures } = current;
  if (isCriticalSuccess) return { successes: 0, failures: 0, stabilized: true, died: false, nat20: true };
  if (isCriticalFail) failures = Math.min(3, failures + 2);
  else if (isSuccess) successes = Math.min(3, successes + 1);
  else failures = Math.min(3, failures + 1);

  const stabilized = successes >= 3;
  const died = failures >= 3;
  if (stabilized || died) return { successes: 0, failures: 0, stabilized, died, nat20: false };
  return { successes, failures, stabilized: false, died: false, nat20: false };
}

function resolveConcentrationChange(currentConcentration, newSpellName, activeBuffs = []) {
  const droppedSpell = currentConcentration;
  const droppedBuffIds = droppedSpell
    ? activeBuffs.filter(b => b.isConcentration && b.name && b.name.toLowerCase() === droppedSpell.toLowerCase()).map(b => b.id)
    : [];
  return { droppedSpell, droppedBuffIds, newConcentration: newSpellName };
}

function isConcentrationSpell(spellName, characterSpells = []) {
  const lower = spellName.toLowerCase().trim();
  const known = characterSpells.find(s => s.name.toLowerCase() === lower);
  if (known !== undefined) return known.isConcentration;
  return KNOWN_CONCENTRATION_SPELLS.has(lower);
}

function resolveConcentrationCheckDC(damageTaken, concentratingOn) {
  if (!concentratingOn || damageTaken === 0) return { required: false, dc: 0 };
  const dc = Math.max(10, Math.floor(damageTaken / 2));
  return { required: true, dc };
}

function resolveFinalAbilityScores(character, allInventory = [], activeBuffs = [], activeConditions = []) {
  const { dedupedBuffs, finalInventory } = preprocessState(character, activeBuffs, activeConditions, allInventory);
  const base = character.abilityScores || { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 };
  const finalScores = { ...base };
  const MAP = {
    'strength': 'STR', 'dexterity': 'DEX', 'constitution': 'CON',
    'intelligence': 'INT', 'wisdom': 'WIS', 'charisma': 'CHA',
    'str': 'STR', 'dex': 'DEX', 'con': 'CON', 'int': 'INT', 'wis': 'WIS', 'cha': 'CHA'
  };

  const breakdown = {
    STR: [{ source: 'Base', value: base.STR ?? 10 }],
    DEX: [{ source: 'Base', value: base.DEX ?? 10 }],
    CON: [{ source: 'Base', value: base.CON ?? 10 }],
    INT: [{ source: 'Base', value: base.INT ?? 10 }],
    WIS: [{ source: 'Base', value: base.WIS ?? 10 }],
    CHA: [{ source: 'Base', value: base.CHA ?? 10 }]
  };

  // 1. Process items flat bonuses
  for (const item of finalInventory) {
    if (item.equipped && item.stats) {
      if (item.stats.statBonuses) {
        for (let [stat, bonus] of Object.entries(item.stats.statBonuses)) {
          const upper = stat.toUpperCase();
          const norm = MAP[upper] || MAP[stat.toLowerCase()] || upper;
          if (finalScores[norm] !== undefined) {
            finalScores[norm] += bonus;
            breakdown[norm].push({ source: item.name, type: 'gear-bonus', value: bonus });
          }
        }
      }
    }
  }

  // 2. Process buffs flat bonuses
  for (const buff of dedupedBuffs) {
    if (buff.modifierType === 'flatBonus' && buff.statAffected) {
      const upper = buff.statAffected.toUpperCase();
      const norm = MAP[upper] || MAP[buff.statAffected.toLowerCase()] || upper;
      const bonus = parseInt(buff.modifierValue, 10);
      if (!isNaN(bonus) && finalScores[norm] !== undefined) {
        finalScores[norm] += bonus;
        breakdown[norm].push({ source: buff.sourceName || buff.name, type: 'buff-bonus', value: bonus });
      }
    }
  }

  // 3. Process item overrides (e.g. Gauntlets of Ogre Power)
  for (const item of finalInventory) {
    if (item.equipped && item.stats && item.stats.statOverrides) {
      for (let [stat, value] of Object.entries(item.stats.statOverrides)) {
        const upper = stat.toUpperCase();
        const norm = MAP[upper] || MAP[stat.toLowerCase()] || upper;
        if (finalScores[norm] !== undefined && finalScores[norm] < value) {
          finalScores[norm] = value;
          breakdown[norm].push({ source: item.name, type: 'gear-override', value: value });
        }
      }
    }
  }

  // 4. Process buff overrides
  for (const buff of dedupedBuffs) {
    if ((buff.modifierType === 'setStat' || buff.modifierType === 'setScore') && buff.statAffected) {
      const upper = buff.statAffected.toUpperCase();
      const norm = MAP[upper] || MAP[buff.statAffected.toLowerCase()] || upper;
      const setValue = parseInt(buff.modifierValue, 10);
      if (!isNaN(setValue) && finalScores[norm] !== undefined && finalScores[norm] < setValue) {
        finalScores[norm] = setValue;
        breakdown[norm].push({ source: buff.sourceName || buff.name, type: 'buff-override', value: setValue });
      }
    }
  }

  return { finalScores, breakdown };
}

const SKILL_ABILITIES = {
  acrobatics: 'DEX',
  'animal handling': 'WIS',
  arcana: 'INT',
  athletics: 'STR',
  deception: 'CHA',
  history: 'INT',
  insight: 'WIS',
  intimidation: 'CHA',
  investigation: 'INT',
  medicine: 'WIS',
  nature: 'INT',
  perception: 'WIS',
  performance: 'CHA',
  persuasion: 'CHA',
  religion: 'INT',
  'sleight of hand': 'DEX',
  stealth: 'DEX',
  survival: 'WIS'
};

function resolveSavingThrows(character, activeBuffs = [], activeConditions = [], allInventory = []) {
  const { dedupedBuffs, finalInventory } = preprocessState(character, activeBuffs, activeConditions, allInventory);
  const { finalScores } = resolveFinalAbilityScores(character, finalInventory, dedupedBuffs, activeConditions);
  const proficiencyBonus = Math.floor((character.level - 1) / 4) + 2;

  const stats = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  const finalSaves = {};
  const breakdown = {};

  for (const stat of stats) {
    const baseMod = getAbilityModifier(finalScores[stat]);
    finalSaves[stat] = baseMod;
    breakdown[stat] = [{ source: `${stat} Mod`, value: baseMod }];

    const isProficient = character.saveProficiencies?.[stat] || character.saveProficiencies?.[stat.toLowerCase()];
    if (isProficient) {
      finalSaves[stat] += proficiencyBonus;
      breakdown[stat].push({ source: 'Proficiency', value: proficiencyBonus });
    }

    for (const item of finalInventory) {
      if (item.equipped && item.stats) {
        const universalBonus = item.stats.saveBonus ?? item.stats.savingThrowBonus;
        if (universalBonus) {
          finalSaves[stat] += universalBonus;
          breakdown[stat].push({ source: item.name, type: 'gear-bonus', value: universalBonus });
        }
        const specificBonus = item.stats.saveBonuses?.[stat] ?? item.stats.saveBonuses?.[stat.toLowerCase()];
        if (specificBonus) {
          finalSaves[stat] += specificBonus;
          breakdown[stat].push({ source: item.name, type: 'gear-bonus', value: specificBonus });
        }
      }
    }

    for (const buff of dedupedBuffs) {
      const name = (buff.name || '').toLowerCase().trim();
      if (name === 'bless') {
        finalSaves[stat] += 2.5;
        breakdown[stat].push({ source: 'Bless', type: 'buff-bonus', value: 2.5, dice: '1d4' });
      }
      if (name === 'bane') {
        finalSaves[stat] -= 2.5;
        breakdown[stat].push({ source: 'Bane', type: 'buff-penalty', value: -2.5, dice: '-1d4' });
      }
      if (name === 'slow' && stat === 'DEX') {
        finalSaves[stat] -= 2;
        breakdown[stat].push({ source: 'Slow', type: 'buff-penalty', value: -2 });
      }

      if (buff.modifierType === 'flatBonus' && buff.statAffected) {
        const affected = buff.statAffected.toLowerCase();
        if (affected.includes('save') || affected.includes('saving')) {
          let matches = false;
          if (affected.includes(stat.toLowerCase()) || affected.includes(stat)) {
            matches = true;
          } else if (!stats.some(s => affected.includes(s.toLowerCase()))) {
            matches = true;
          }
          if (matches) {
            const val = parseInt(buff.modifierValue, 10);
            if (!isNaN(val)) {
              finalSaves[stat] += val;
              breakdown[stat].push({ source: buff.sourceName || buff.name, type: 'buff-bonus', value: val });
            }
          }
        }
      }
    }
  }

  return { finalSaves, breakdown };
}

function resolveSkills(character, activeBuffs = [], activeConditions = [], allInventory = []) {
  const { dedupedBuffs, finalInventory } = preprocessState(character, activeBuffs, activeConditions, allInventory);
  const { finalScores } = resolveFinalAbilityScores(character, finalInventory, dedupedBuffs, activeConditions);
  const proficiencyBonus = Math.floor((character.level - 1) / 4) + 2;

  const finalSkills = {};
  const breakdown = {};

  for (const [skillName, ability] of Object.entries(SKILL_ABILITIES)) {
    const abilityMod = getAbilityModifier(finalScores[ability]);
    finalSkills[skillName] = abilityMod;
    breakdown[skillName] = [{ source: `${ability} Mod`, value: abilityMod }];

    let mult = 0;
    let sourceName = 'Proficiency';
    const prof = character.skillProficiencies?.[skillName] ?? character.skillProficiencies?.[skillName.toLowerCase()];
    if (prof === 2 || prof === 'expertise' || prof === 'expert') {
      mult = 2;
      sourceName = 'Expertise';
    } else if (prof === 1 || prof === 'proficient' || prof === 'prof' || prof === true) {
      mult = 1;
      sourceName = 'Proficient';
    } else if (prof === 0.5 || prof === 'half-proficient' || prof === 'half-prof' || prof === 'half') {
      mult = 0.5;
      sourceName = 'Half-Proficient';
    }

    if (mult > 0) {
      const bonus = Math.floor(mult * proficiencyBonus);
      finalSkills[skillName] += bonus;
      breakdown[skillName].push({ source: sourceName, value: bonus });
    }

    for (const item of finalInventory) {
      if (item.equipped && item.stats) {
        const bonus = item.stats.skillBonuses?.[skillName] ?? item.stats.skillBonuses?.[skillName.toLowerCase()];
        if (bonus) {
          finalSkills[skillName] += bonus;
          breakdown[skillName].push({ source: item.name, type: 'gear-bonus', value: bonus });
        }
      }
    }

    for (const buff of dedupedBuffs) {
      if (buff.modifierType === 'flatBonus' && buff.statAffected) {
        const affected = buff.statAffected.toLowerCase().trim();
        if (affected === skillName.toLowerCase() || affected === `skill:${skillName.toLowerCase()}`) {
          const val = parseInt(buff.modifierValue, 10);
          if (!isNaN(val)) {
            finalSkills[skillName] += val;
            breakdown[skillName].push({ source: buff.sourceName || buff.name, type: 'buff-bonus', value: val });
          }
        }
      }
    }
  }

  return { finalSkills, breakdown };
}

function resolveSpeed(character, activeBuffs = [], activeConditions = [], allInventory = []) {
  const { dedupedBuffs, finalInventory } = preprocessState(character, activeBuffs, activeConditions, allInventory);
  let baseSpeed = character.speed ?? 30;
  if (typeof baseSpeed === 'object') {
    baseSpeed = baseSpeed.walk ?? baseSpeed.base ?? 30;
  }
  let finalSpeed = baseSpeed;
  const breakdown = [{ source: 'Base Speed', value: baseSpeed }];

  for (const item of finalInventory) {
    if (item.equipped && item.stats && item.stats.speedBonus) {
      finalSpeed += item.stats.speedBonus;
      breakdown.push({ source: item.name, type: 'gear-bonus', value: item.stats.speedBonus });
    }
  }

  for (const buff of dedupedBuffs) {
    if (buff.modifierType === 'flatBonus' && (buff.statAffected || '').toLowerCase().includes('speed')) {
      const val = parseInt(buff.modifierValue, 10);
      if (!isNaN(val)) {
        finalSpeed += val;
        breakdown.push({ source: buff.sourceName || buff.name, type: 'buff-bonus', value: val });
      }
    }
  }

  let multiplier = 1;
  const multipliersUsed = [];

  const hasHaste = dedupedBuffs.some(b => b.name?.toLowerCase() === 'haste' || b.sourceName?.toLowerCase() === 'haste');
  if (hasHaste) {
    multiplier *= 2;
    multipliersUsed.push({ source: 'Haste', multiplier: 2 });
  }

  const hasBootsOfSpeed = finalInventory.some(item => item.equipped && (item.name?.toLowerCase().includes('boots of speed') || item.stats?.doubleSpeed));
  if (hasBootsOfSpeed) {
    multiplier *= 2;
    multipliersUsed.push({ source: 'Boots of Speed', multiplier: 2 });
  }

  if (multiplier !== 1) {
    finalSpeed = finalSpeed * multiplier;
    for (const m of multipliersUsed) {
      breakdown.push({ source: m.source, type: 'multiplier', value: `x${m.multiplier}` });
    }
  }

  let exhaustionLevel = 0;
  for (const cond of activeConditions) {
    const lower = cond.toLowerCase().trim();
    if (lower.startsWith('exhaustion')) {
      const match = lower.match(/\d+/);
      if (match) exhaustionLevel = parseInt(match[0], 10);
      else exhaustionLevel = 1;
    }
  }

  if (exhaustionLevel >= 2 && exhaustionLevel < 5) {
    finalSpeed = Math.floor(finalSpeed / 2);
    breakdown.push({ source: `Exhaustion Level ${exhaustionLevel}`, type: 'penalty', value: 'Halved' });
  }

  const isProne = activeConditions.some(c => c.toLowerCase() === 'prone');
  if (isProne) {
    finalSpeed = Math.floor(finalSpeed / 2);
    breakdown.push({ source: 'Prone', type: 'penalty', value: 'Halved' });
  }

  const speedZeroConditions = ['grappled', 'restrained', 'stunned', 'paralyzed', 'unconscious', 'petrified'];
  const activeZeroCond = activeConditions.find(c => speedZeroConditions.includes(c.toLowerCase()));

  if (activeZeroCond) {
    finalSpeed = 0;
    breakdown.push({ source: activeZeroCond.charAt(0).toUpperCase() + activeZeroCond.slice(1).toLowerCase(), type: 'override', value: 0 });
  } else if (exhaustionLevel >= 5) {
    finalSpeed = 0;
    breakdown.push({ source: `Exhaustion Level ${exhaustionLevel}`, type: 'override', value: 0 });
  }

  return { finalSpeed, breakdown };
}

function resolveInitiative(character, activeBuffs = [], activeConditions = [], allInventory = []) {
  const { dedupedBuffs, finalInventory } = preprocessState(character, activeBuffs, activeConditions, allInventory);
  const { finalScores } = resolveFinalAbilityScores(character, finalInventory, dedupedBuffs, activeConditions);
  const dexMod = getAbilityModifier(finalScores.DEX || 10);

  let finalInitiative = dexMod;
  const breakdown = [{ source: 'DEX Modifier', value: dexMod }];

  const features = character.features || [];
  const alertFeat = features.find(f => f.name && f.name.toLowerCase().includes('alert'));
  if (alertFeat) {
    finalInitiative += 5;
    breakdown.push({ source: 'Alert Feat', type: 'feat', value: 5 });
  }

  for (const item of finalInventory) {
    if (item.equipped && item.stats) {
      const bonus = item.stats.initiativeBonus;
      if (bonus) {
        finalInitiative += bonus;
        breakdown.push({ source: item.name, type: 'gear-bonus', value: bonus });
      }
    }
  }

  for (const buff of dedupedBuffs) {
    if (buff.modifierType === 'flatBonus' && (buff.statAffected || '').toLowerCase().includes('initiative')) {
      const val = parseInt(buff.modifierValue, 10);
      if (!isNaN(val)) {
        finalInitiative += val;
        breakdown.push({ source: buff.sourceName || buff.name, type: 'buff-bonus', value: val });
      }
    }
  }

  return { finalInitiative, breakdown };
}

function resolveCurrentAC(character, activeBuffs = [], activeConditions = [], allInventory = []) {
  const { dedupedBuffs, finalInventory } = preprocessState(character, activeBuffs, activeConditions, allInventory);
  const { finalScores: scores } = resolveFinalAbilityScores(character, finalInventory, dedupedBuffs, activeConditions);
  const dexMod = getAbilityModifier(scores.DEX || 10);
  const wisMod = getAbilityModifier(scores.WIS || 10);
  const conMod = getAbilityModifier(scores.CON || 10);

  let baseAC = character.baseAc || 10;
  let acMethod = 'imported';

  // Fix known issue where PDF import LLM sometimes extracts ONLY the dex mod as AC
  if (baseAC === dexMod && baseAC < 10) {
    baseAC = 10 + dexMod;
    acMethod = 'imported-fixed';
  }

  const equippedArmors = finalInventory.filter(item => {
    if (!item.equipped) return false;
    const name = (item.name || '').toLowerCase();
    return name.includes('leather') || name.includes('studded') || name.includes('chain') ||
      name.includes('scale') || name.includes('breastplate') || name.includes('half plate') ||
      name.includes('ring mail') || name.includes('plate');
  });

  // Calculate unarmored options
  let unarmoredAC = 10 + dexMod;
  let unarmoredMethod = 'unarmored-default';

  const features = character.features || [];
  const unarmoredDefense = features.find(f => f.name && f.name.toLowerCase().includes('unarmored defense'));

  if (unarmoredDefense) {
    const desc = (unarmoredDefense.description || '').toLowerCase();
    if (desc.includes('constitution')) {
      unarmoredAC = 10 + dexMod + conMod;
      unarmoredMethod = 'unarmored-barbarian';
    } else if (desc.includes('wisdom')) {
      unarmoredAC = 10 + dexMod + wisMod;
      unarmoredMethod = 'unarmored-monk';
    }
  }

  const hasMageArmor = dedupedBuffs.some(b => b.name?.toLowerCase() === 'mage armor' || b.sourceName?.toLowerCase() === 'mage armor');
  if (hasMageArmor) {
    if (13 + dexMod > unarmoredAC) {
      unarmoredAC = 13 + dexMod;
      unarmoredMethod = 'mage-armor';
    }
  }

  // If no armor is equipped, take the best unarmored AC or the imported AC
  if (equippedArmors.length === 0) {
    if (unarmoredAC > baseAC) {
      baseAC = unarmoredAC;
      acMethod = unarmoredMethod;
    }
  } else {
    // If wearing armor, trust the imported baseAC, but fallback if it's completely wrong
    if (baseAC < 10) {
      baseAC = unarmoredAC;
    }
  }

  let acFlatBonus = 0;
  let acSetOverride = null;
  const breakdown = [{ source: acMethod, value: baseAC }];

  for (const item of finalInventory) {
    if (item.equipped && item.stats && item.stats.acBonus) {
      acFlatBonus += item.stats.acBonus;
      breakdown.push({ source: item.name, type: 'gear-bonus', value: item.stats.acBonus });
    }
  }

  for (const buff of dedupedBuffs) {
    const name = (buff.name || '').toLowerCase();
    const effect = BUFF_EFFECTS[name];
    if (effect && effect.acBonus) {
      acFlatBonus += effect.acBonus;
      breakdown.push({ source: name, type: 'buff', value: effect.acBonus });
    }
    if (buff.modifierType === 'setAC') {
      const setValue = parseInt(buff.modifierValue, 10);
      if (!isNaN(setValue)) {
        acSetOverride = acSetOverride === null ? setValue : Math.max(acSetOverride, setValue);
        breakdown.push({ source: buff.sourceName || buff.name, type: 'setAC', value: setValue });
      }
    } else if (buff.modifierType === 'flatBonus' && (buff.statAffected || '').toLowerCase().includes('ac')) {
      const bonus = parseInt(buff.modifierValue, 10);
      if (!isNaN(bonus)) {
        acFlatBonus += bonus;
        breakdown.push({ source: buff.sourceName || buff.name, type: 'flatBonus', value: bonus });
      }
    }
  }

  const resolvedBase = acSetOverride !== null ? Math.max(baseAC, acSetOverride) : baseAC;
  const finalAC = resolvedBase + acFlatBonus;
  return { finalAC, breakdown, acMethod };
}

function applyCondition(currentConditions, condition) {
  const normalized = condition.toLowerCase().trim();
  if (currentConditions.map(c => c.toLowerCase()).includes(normalized)) return { newConditions: currentConditions, alreadyPresent: true };
  return { newConditions: [...currentConditions, normalized], alreadyPresent: false };
}

function removeCondition(currentConditions, condition) {
  const normalized = condition.toLowerCase().trim();
  const filtered = currentConditions.filter(c => c.toLowerCase() !== normalized);
  return { newConditions: filtered, wasPresent: filtered.length !== currentConditions.length };
}

function resolveConditionModifiers(conditions) {
  const result = { attacksAdvantage: false, attacksDisadvantage: false, attacksAgainstAdvantage: false, attacksAgainstDisadvantage: false, checksDisadvantage: false, speedOverride: null, halveMoveSpeed: false, autoFail: [], savingThrowDisadvantage: [], noActions: false, noReactions: false, resistAll: false };
  for (const condition of conditions) {
    const effects = CONDITION_EFFECTS[condition.toLowerCase()];
    if (!effects) continue;
    if (effects.attacksAdvantage) result.attacksAdvantage = true;
    if (effects.attacksDisadvantage) result.attacksDisadvantage = true;
    if (effects.attacksAgainstAdvantage) result.attacksAgainstAdvantage = true;
    if (effects.attacksAgainstDisadvantage) result.attacksAgainstDisadvantage = true;
    if (effects.checksDisadvantage) result.checksDisadvantage = true;
    if (effects.speedOverride !== undefined) result.speedOverride = result.speedOverride === null ? effects.speedOverride : Math.min(result.speedOverride, effects.speedOverride);
    if (effects.halveMoveSpeed) result.halveMoveSpeed = true;
    if (effects.autoFail) result.autoFail.push(...effects.autoFail);
    if (effects.savingThrowDisadvantage) result.savingThrowDisadvantage.push(...effects.savingThrowDisadvantage);
    if (effects.noActions) result.noActions = true;
    if (effects.noReactions) result.noReactions = true;
    if (effects.resistAll) result.resistAll = true;
  }
  if (result.attacksAdvantage && result.attacksDisadvantage) { result.attacksAdvantage = false; result.attacksDisadvantage = false; result.netAttackRoll = 'straight'; }
  return result;
}

function useSpellSlot(slotsMax, slotsUsed, slotLevel) {
  const max = slotsMax[slotLevel] || 0;
  const used = slotsUsed[slotLevel] || 0;
  if (max - used <= 0) return { newSlotsUsed: slotsUsed, success: false, error: `No level ${slotLevel} spell slots remaining` };
  return { newSlotsUsed: { ...slotsUsed, [slotLevel]: used + 1 }, success: true, error: null };
}

function restoreAllSpellSlots() { return {}; }

function useFeatureCharge(featureUses, featureName, characterFeatures) {
  const feature = characterFeatures.find(f => f.name.toLowerCase() === featureName.toLowerCase());
  if (!feature) return { newFeatureUses: featureUses, success: false, error: `Feature "${featureName}" not found` };
  if (feature.maxUses === null) return { newFeatureUses: featureUses, success: false, error: `"${featureName}" is not a charged resource` };
  const used = featureUses[featureName] || 0;
  if (feature.maxUses - used <= 0) return { newFeatureUses: featureUses, success: false, error: `No uses of "${featureName}" remaining`, remaining: 0 };
  return { newFeatureUses: { ...featureUses, [featureName]: used + 1 }, success: true, error: null, remaining: feature.maxUses - used - 1 };
}

function shortRestFeatures(featureUses, characterFeatures) {
  const newUses = { ...featureUses };
  for (const f of characterFeatures) { if (f.resourceType === 'shortRest') delete newUses[f.name]; }
  return newUses;
}

function longRestFeatures() { return {}; }
function getAbilityModifier(score) { return Math.floor((score - 10) / 2); }
function formatModifier(score) { const mod = getAbilityModifier(score); return mod >= 0 ? `+${mod}` : `${mod}`; }

function resolveStatProvenance(character, activeBuffs = [], activeConditions = [], allInventory = []) {
  // 1. Ability Scores
  const { finalScores, breakdown: abilityBreakdown } = resolveFinalAbilityScores(character, allInventory, activeBuffs, activeConditions);
  const abilityScores = {};
  for (const [stat, val] of Object.entries(finalScores)) {
    abilityScores[stat] = {
      final: val,
      sources: abilityBreakdown[stat]
    };
  }

  // 2. AC
  const ac = resolveCurrentAC(character, activeBuffs, activeConditions, allInventory);

  // 3. Saves
  const { finalSaves, breakdown: saveBreakdown } = resolveSavingThrows(character, activeBuffs, activeConditions, allInventory);
  const saves = {};
  for (const [stat, val] of Object.entries(finalSaves)) {
    const isAutoFail = activeConditions.some(c => {
      const lower = c.toLowerCase();
      return (lower === 'paralyzed' || lower === 'petrified' || lower === 'stunned' || lower === 'unconscious') && (stat === 'STR' || stat === 'DEX');
    });

    let adjustedVal = val;
    const hasBless = activeBuffs.some(b => b.name?.toLowerCase() === 'bless');
    const hasBane = activeBuffs.some(b => b.name?.toLowerCase() === 'bane');
    if (hasBless) adjustedVal -= 2.5;
    if (hasBane) adjustedVal += 2.5;

    saves[stat] = {
      final: adjustedVal,
      sources: saveBreakdown[stat].map(s => {
        if (s.source === 'Bless') {
          return { ...s, value: '1d4' };
        }
        if (s.source === 'Bane') {
          return { ...s, value: '-1d4' };
        }
        return s;
      }),
      rollState: isAutoFail ? 'auto-fail' : 'normal'
    };
  }

  // 4. Speed
  const { finalSpeed, breakdown: speedBreakdown } = resolveSpeed(character, activeBuffs, activeConditions, allInventory);
  const speed = {
    final: finalSpeed,
    breakdown: speedBreakdown
  };

  // 5. Skills
  const { finalSkills, breakdown: skillBreakdown } = resolveSkills(character, activeBuffs, activeConditions, allInventory);
  const skills = {};
  for (const [skill, val] of Object.entries(finalSkills)) {
    skills[skill] = {
      final: val,
      sources: skillBreakdown[skill]
    };
  }

  return {
    abilityScores,
    ac,
    saves,
    speed,
    skills
  };
}

module.exports = {
  resolveDamage, resolveHeal, resolveTempHp, resolveDeathSave,
  resolveConcentrationChange, isConcentrationSpell, resolveConcentrationCheckDC,
  resolveCurrentAC, resolveFinalAbilityScores, resolveSavingThrows, resolveSkills, resolveSpeed, resolveInitiative,
  resolveStatProvenance,
  applyCondition, removeCondition, resolveConditionModifiers, CONDITION_EFFECTS, BUFF_EFFECTS,
  useSpellSlot, restoreAllSpellSlots,
  useFeatureCharge, shortRestFeatures, longRestFeatures,
  getAbilityModifier, formatModifier, DAMAGE_TYPES,
};

function evaluateEquipmentProperty(value, level) {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const formula = value.replace(/\blevel\b/g, String(level));
    try {
      const safeEval = new Function('floor', 'ceil', `return ${formula}`);
      const res = safeEval(Math.floor, Math.ceil);
      return typeof res === 'number' && !isNaN(res) ? res : 0;
    } catch (err) {
      console.error('Error evaluating formula:', value, err);
      return 0;
    }
  }
  return 0;
}

function preprocessState(character, activeBuffs = [], activeConditions = [], allInventory = []) {
  const level = character?.level || 1;
  const normalizedConditions = (activeConditions || []).map(c => c.toLowerCase().trim());

  // 1. Evaluate Dynamic Equipment Properties (formulas) and disable if condition matches
  const evaluatedInventory = (allInventory || []).map(item => {
    if (!item.equipped) return item;

    // Check disabled conditions
    const disabledBy = item.stats?.disabledByConditions || [];
    const isDisabled = disabledBy.some(cond => normalizedConditions.includes(cond.toLowerCase().trim()));
    if (isDisabled) {
      return { ...item, equipped: false, disabledByCondition: true };
    }

    // Evaluate stats properties using character level
    if (!item.stats) return item;
    const newStats = { ...item.stats };

    const keysToEvaluate = ['acBonus', 'ac', 'speedBonus', 'saveBonus', 'initiativeBonus'];
    for (const key of keysToEvaluate) {
      if (newStats[key] !== undefined) {
        newStats[key] = evaluateEquipmentProperty(newStats[key], level);
      }
    }

    const dictKeys = ['statBonuses', 'statOverrides', 'saveBonuses', 'skillBonuses'];
    for (const key of dictKeys) {
      if (newStats[key]) {
        const newDict = { ...newStats[key] };
        for (const [k, val] of Object.entries(newDict)) {
          newDict[k] = evaluateEquipmentProperty(val, level);
        }
        newStats[key] = newDict;
      }
    }

    return { ...item, stats: newStats };
  });

  // 2. Stacking Buff Interceptor: Deduplicate buffs by name (case-insensitive)
  const uniqueBuffsMap = new Map();
  for (const buff of activeBuffs || []) {
    const name = (buff.name || '').toLowerCase().trim();
    if (!name) continue;
    if (!uniqueBuffsMap.has(name)) {
      uniqueBuffsMap.set(name, buff);
    } else {
      const existing = uniqueBuffsMap.get(name);
      const valExisting = parseFloat(existing.modifierValue || 0);
      const valNew = parseFloat(buff.modifierValue || 0);
      if (valNew > valExisting) {
        uniqueBuffsMap.set(name, buff);
      }
    }
  }
  const dedupedBuffs = Array.from(uniqueBuffsMap.values());

  // 3. Stacking Item Interceptor: Only benefit from one shield, and no duplicate items by name
  const activeItemsByName = new Map();
  let bestShield = null;

  for (const item of evaluatedInventory) {
    if (!item.equipped) continue;
    const name = (item.name || '').toLowerCase().trim();
    const type = (item.type || '').toLowerCase().trim();

    if (type === 'shield' || name.includes('shield')) {
      if (!bestShield) {
        bestShield = item;
      } else {
        const existingAC = bestShield.stats?.acBonus || 0;
        const newAC = item.stats?.acBonus || 0;
        if (newAC > existingAC) {
          bestShield = item;
        }
      }
      continue;
    }

    if (!activeItemsByName.has(name)) {
      activeItemsByName.set(name, item);
    } else {
      const existing = activeItemsByName.get(name);
      const existingAC = existing.stats?.acBonus || 0;
      const newAC = item.stats?.acBonus || 0;
      if (newAC > existingAC) {
        activeItemsByName.set(name, item);
      }
    }
  }

  const dedupedInventory = Array.from(activeItemsByName.values());
  if (bestShield) {
    dedupedInventory.push(bestShield);
  }

  // Create final inventory where suppressed items are marked equipped: false
  const finalInventory = evaluatedInventory.map(item => {
    if (!item.equipped) return item;
    const isKeep = dedupedInventory.some(keep => keep.id === item.id);
    if (!isKeep) {
      return { ...item, equipped: false, suppressedByStacking: true };
    }
    return item;
  });

  return {
    dedupedBuffs,
    finalInventory
  };
}
