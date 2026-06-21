'use strict';

// ---------------------------------------------------------------------------
// Condition Rule Matrix
// ---------------------------------------------------------------------------

const CONDITION_RULES = {
  blinded: {
    attacksDisadvantage: true,
  },
  charmed: {},
  deafened: {},
  frightened: {
    attacksDisadvantage: true,
    checksDisadvantage: true,
  },
  grappled: {},
  incapacitated: {
    noActions: true,
  },
  invisible: {
    attacksAdvantage: true,
  },
  paralyzed: {
    noActions: true,
    autoFail: ['STR', 'DEX'],
  },
  petrified: {
    noActions: true,
    autoFail: ['STR', 'DEX'],
  },
  poisoned: {
    attacksDisadvantage: true,
    checksDisadvantage: true,
  },
  prone: {
    attacksDisadvantage: true,
  },
  restrained: {
    attacksDisadvantage: true,
    savingThrowDisadvantage: ['DEX'],
  },
  stunned: {
    noActions: true,
    autoFail: ['STR', 'DEX'],
  },
  unconscious: {
    noActions: true,
    autoFail: ['STR', 'DEX'],
  },
};

const BUFF_EFFECTS = {
  'haste': {
    saveAdvantage: ['DEX'],
  },
  'rage': {
    saveAdvantage: ['STR'],
    checkAdvantage: ['STR'],
  }
};

/**
 * Given a character's active conditions and buffs, determine how a requested roll
 * should be modified.
 *
 * @param {string[]} conditions Active conditions
 * @param {object[]} buffs Active buffs
 * @param {string} action The type of roll ('attack', 'ability_check', 'saving_throw', 'initiative')
 * @param {string} ability The ability score involved
 * @returns {object} { advantage: string, autoFail: boolean, incapacitated: boolean, reasons: string[] }
 */
function evaluateRoll(conditions, buffs = [], action, ability) {
  let hasAdvantage = false;
  let hasDisadvantage = false;
  let autoFail = false;
  let incapacitated = false;
  const reasons = [];

  for (const condition of conditions) {
    const rule = CONDITION_RULES[condition.toLowerCase()];
    if (!rule) continue;

    // Incapacitation — can't take actions at all
    if (rule.noActions) {
      incapacitated = true;
      reasons.push(`${condition}: Incapacitated`);
    }

    // Auto-fail certain saving throws
    if (action === 'saving_throw' && ability && rule.autoFail && rule.autoFail.includes(ability)) {
      autoFail = true;
      reasons.push(`${condition}: Auto-fail ${ability} saves`);
    }

    // Attack roll modifiers
    if (action === 'attack') {
      if (rule.attacksDisadvantage) {
        hasDisadvantage = true;
        reasons.push(`${condition}: Disadvantage on attacks`);
      }
      if (rule.attacksAdvantage) {
        hasAdvantage = true;
        reasons.push(`${condition}: Advantage on attacks`);
      }
    }

    // Ability checks
    if (action === 'ability_check' || action === 'initiative') {
      if (rule.checksDisadvantage) {
        hasDisadvantage = true;
        reasons.push(`${condition}: Disadvantage on ability checks`);
      }
    }

    // Saving throw disadvantage for specific abilities
    if (action === 'saving_throw' && ability && rule.savingThrowDisadvantage && rule.savingThrowDisadvantage.includes(ability)) {
      hasDisadvantage = true;
      reasons.push(`${condition}: Disadvantage on ${ability} saves`);
    }
  }

  for (const buff of buffs) {
    const buffName = (buff.name || '').toLowerCase();
    const effect = BUFF_EFFECTS[buffName];
    if (!effect) continue;

    if (action === 'saving_throw' && ability && effect.saveAdvantage && effect.saveAdvantage.includes(ability)) {
      hasAdvantage = true;
      reasons.push(`${buff.name}: Advantage on ${ability} saves`);
    }

    if (action === 'ability_check' && ability && effect.checkAdvantage && effect.checkAdvantage.includes(ability)) {
      hasAdvantage = true;
      reasons.push(`${buff.name}: Advantage on ${ability} checks`);
    }
  }

  // 5e RAW: advantage + disadvantage cancel to a straight roll
  let advantage = 'straight';
  if (hasAdvantage && !hasDisadvantage) advantage = 'advantage';
  else if (hasDisadvantage && !hasAdvantage) advantage = 'disadvantage';

  return { advantage, autoFail, incapacitated, reasons };
}

/**
 * Given conditions and buffs, build a complete modifiers object for all standard actions.
 * @param {string[]} conditions 
 * @param {object[]} buffs 
 * @returns {object} Map of RollIndicator for each major stat/action
 */
function getAllRollModifiers(conditions, buffs = []) {
  const abilities = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  const modifiers = {
    attacks: evaluateRoll(conditions, buffs, 'attack'),
    initiative: evaluateRoll(conditions, buffs, 'initiative'),
    ability_checks: {},
    saving_throws: {}
  };

  for (const ability of abilities) {
    modifiers.ability_checks[ability] = evaluateRoll(conditions, buffs, 'ability_check', ability);
    modifiers.saving_throws[ability] = evaluateRoll(conditions, buffs, 'saving_throw', ability);
  }

  return modifiers;
}

module.exports = {
  evaluateRoll,
  getAllRollModifiers,
  CONDITION_RULES
};
