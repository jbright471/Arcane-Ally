/**
 * Character Validation Logic
 * Catches common LLM extraction errors and normalizes output.
 */

'use strict';

const ABILITY_SCORES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

function validateCharacter(c) {
    const errors = [];
    const warnings = [];

    // ── Identity ────────────────────────────────────────────────────────────
    if (!c.name || String(c.name).trim() === '') {
        // Check for common LLM key mistakes
        if (c.character_name) {
            warnings.push('LLM used "character_name" instead of "name". Auto-corrected.');
            c.name = c.character_name;
        } else {
            errors.push('name is empty');
        }
    }

    if (!c.species) {
        if (c.race) {
            warnings.push('LLM used "race" instead of "species". Auto-corrected.');
            c.species = c.race;
        } else {
            errors.push('species is missing');
        }
    }

    if (!c.classes || c.classes.length === 0) {
        errors.push('classes array is empty');
    }

    // ── Level ───────────────────────────────────────────────────────────────
    const totalLevel = (c.classes || []).reduce((sum, cls) => sum + (cls.level || 0), 0);
    if (totalLevel < 1 || totalLevel > 20) {
        errors.push(`Total level ${totalLevel} is outside valid range 1–20`);
    }

    // ── HP ───────────────────────────────────────────────────────────────────
    if (c.baseMaxHp !== undefined && c.baseMaxHp !== null) {
        if (c.baseMaxHp <= 0) {
            errors.push(`baseMaxHp must be > 0 (got ${c.baseMaxHp})`);
        }
    } else {
        warnings.push('baseMaxHp is missing — may need to be set manually');
    }

    // ── AC ───────────────────────────────────────────────────────────────────
    if (c.baseAc !== undefined && c.baseAc !== null) {
        if (c.baseAc < 1 || c.baseAc > 30) {
            errors.push(
                `baseAc = ${c.baseAc} is outside valid range 1–30. ` +
                `LLM may have extracted an incorrect value.`
            );
        }
    }

    // ── Ability Scores ──────────────────────────────────────────────────────
    if (c.abilityScores) {
        for (const ability of ABILITY_SCORES) {
            const score = c.abilityScores[ability];
            if (score === undefined || score === null) {
                errors.push(`abilityScores.${ability} is missing`);
            } else if (score < 1 || score > 30) {
                errors.push(
                    `abilityScores.${ability} = ${score} is outside valid range 1–30. ` +
                    `LLM may have extracted the modifier instead of the score.`
                );
            }
        }

        // Flag if all scores look like modifiers (range -5 to +10)
        const values = ABILITY_SCORES.map(a => c.abilityScores[a]).filter(v => v !== undefined);
        if (values.length === 6 && values.every(s => s >= -5 && s <= 10)) {
            warnings.push(
                'All ability scores are in the range -5 to +10. ' +
                'LLM may have extracted modifiers instead of base scores. ' +
                'Expected values like 8, 14, 18 — not -1, +2, +4.'
            );
        }
    } else {
        errors.push('abilityScores object is missing');
    }

    // ── Spell Slots ─────────────────────────────────────────────────────────
    if (c.spellcasting && c.spellcasting.length > 0 && (!c.spellSlots || Object.keys(c.spellSlots).length === 0)) {
        warnings.push('Character has spellcasting entries but no spellSlots — spell slot data may not have been extracted');
    }

    if (c.spellSlots) {
        for (const [level, count] of Object.entries(c.spellSlots)) {
            if (count > 4) {
                warnings.push(
                    `spellSlots[${level}] = ${count} — 5e caps slots per level at 4 for most classes. ` +
                    `LLM may have miscounted the bubble characters.`
                );
            }
            if (count < 0) {
                errors.push(`spellSlots[${level}] cannot be negative (got ${count})`);
            }
        }
    }

    // ── Hit Dice ────────────────────────────────────────────────────────────
    const totalHitDice = Object.values(c.hitDice || {}).reduce((sum, n) => sum + n, 0);
    if (c.hitDice && totalHitDice !== totalLevel) {
        warnings.push(
            `Total hit dice count ${totalHitDice} doesn't match total level ${totalLevel}. ` +
            `hitDice may be incomplete.`
        );
    }

    // ── Skills ──────────────────────────────────────────────────────────────
    if (c.skills && Array.isArray(c.skills)) {
        const uniqueSkills = new Set(c.skills.map(s => String(s).toLowerCase()));
        if (uniqueSkills.size < c.skills.length) {
            warnings.push(
                `skills array has ${c.skills.length - uniqueSkills.size} duplicate entries. ` +
                `LLM may have listed the same skill multiple times.`
            );
        }
    }

    // ── Inventory / Spells Presence ─────────────────────────────────────────
    if (!c.inventory || c.inventory.length === 0) {
        warnings.push('inventory is empty — most characters carry at least basic equipment');
    }

    const allItems = [...(c.inventory || []), ...(c.homebrewInventory || [])];
    for (const item of allItems) {
        if (item && item.stats) {
            if (item.stats.disabledByConditions !== undefined) {
                if (!Array.isArray(item.stats.disabledByConditions) || !item.stats.disabledByConditions.every(s => typeof s === 'string')) {
                    errors.push(`Item "${item.name || 'Unnamed'}" stats.disabledByConditions must be an array of strings`);
                }
            }
            const keysToEvaluate = ['acBonus', 'ac', 'speedBonus', 'saveBonus', 'initiativeBonus'];
            for (const key of keysToEvaluate) {
                const val = item.stats[key];
                if (val !== undefined && val !== null) {
                    if (typeof val === 'string') {
                        if (!isValidFormula(val)) {
                            errors.push(`Item "${item.name || 'Unnamed'}" stats.${key} formula "${val}" is invalid`);
                        }
                    } else if (typeof val !== 'number') {
                        errors.push(`Item "${item.name || 'Unnamed'}" stats.${key} must be a number or a formula string`);
                    }
                }
            }
            const dictKeys = ['statBonuses', 'statOverrides', 'saveBonuses', 'skillBonuses'];
            for (const key of dictKeys) {
                const dict = item.stats[key];
                if (dict && typeof dict === 'object' && !Array.isArray(dict)) {
                    for (const [k, val] of Object.entries(dict)) {
                        if (val !== undefined && val !== null) {
                            if (typeof val === 'string') {
                                if (!isValidFormula(val)) {
                                    errors.push(`Item "${item.name || 'Unnamed'}" stats.${key}.${k} formula "${val}" is invalid`);
                                }
                            } else if (typeof val !== 'number') {
                                errors.push(`Item "${item.name || 'Unnamed'}" stats.${key}.${k} must be a number or a formula string`);
                            }
                        }
                    }
                } else if (dict !== undefined && dict !== null) {
                    errors.push(`Item "${item.name || 'Unnamed'}" stats.${key} must be an object`);
                }
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

function isValidFormula(val) {
    if (typeof val === 'number') return true;
    if (typeof val !== 'string') return false;
    const formula = val.replace(/\blevel\b/g, '1');
    try {
        new Function('floor', 'ceil', `return ${formula}`);
        return true;
    } catch (e) {
        return false;
    }
}

module.exports = {
    validateCharacter,
};
