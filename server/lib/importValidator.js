'use strict';

/**
 * Validates a character import/sync.
 * Compares incoming character payload with the existing database state (if syncing)
 * or checks absolute safety boundaries (if importing a new character).
 * 
 * @param {Object|null} existing - The existing character from DB (null if new import)
 * @param {Object} incoming - The incoming parsed character data
 * @returns {Object} { diff, flags, requiresApproval }
 */
function validateImportDiff(existing, incoming) {
    const diff = {};
    const flags = [];

    // Parse stats
    const incomingStats = typeof incoming.stats === 'string' ? JSON.parse(incoming.stats) : (incoming.stats || {});
    const existingStats = existing 
        ? (typeof existing.stats === 'string' ? JSON.parse(existing.stats) : (existing.stats || {}))
        : null;

    if (existing) {
        // ---- SYNC COMPARISONS ----
        
        // 1. Level check
        const oldLevel = Number(existing.level || 1);
        const newLevel = Number(incoming.level || 1);
        if (oldLevel !== newLevel) {
            const levelDiff = newLevel - oldLevel;
            diff.level = { old: oldLevel, new: newLevel };
            if (levelDiff < 0) {
                flags.push({
                    severity: 'warning',
                    field: 'level',
                    message: `Level decreased from ${oldLevel} to ${newLevel}.`
                });
            } else if (levelDiff > 1) {
                flags.push({
                    severity: 'danger',
                    field: 'level',
                    message: `Suspicious level jump: +${levelDiff} levels (Level ${oldLevel} ➔ ${newLevel}).`
                });
            } else {
                flags.push({
                    severity: 'info',
                    field: 'level',
                    message: `Leveled up to Level ${newLevel}.`
                });
            }
        }

        // 2. Max HP check
        const oldMaxHp = Number(existing.max_hp || 10);
        const newMaxHp = Number(incoming.maxHp || incoming.max_hp || 10);
        if (oldMaxHp !== newMaxHp) {
            diff.maxHp = { old: oldMaxHp, new: newMaxHp };
            const ratio = newMaxHp / oldMaxHp;
            const diffVal = newMaxHp - oldMaxHp;

            if (ratio > 1.3 || diffVal > 50) {
                flags.push({
                    severity: 'danger',
                    field: 'maxHp',
                    message: `Suspicious Max HP jump: +${diffVal} HP (${oldMaxHp} ➔ ${newMaxHp}).`
                });
            } else if (diffVal > 15) {
                flags.push({
                    severity: 'warning',
                    field: 'maxHp',
                    message: `Max HP increased by +${diffVal} HP (${oldMaxHp} ➔ ${newMaxHp}).`
                });
            } else {
                flags.push({
                    severity: 'info',
                    field: 'maxHp',
                    message: `Max HP updated from ${oldMaxHp} to ${newMaxHp}.`
                });
            }
        }

        // 3. Armor Class check
        const oldAc = Number(existing.ac || 10);
        const newAc = Number(incoming.ac || 10);
        if (oldAc !== newAc) {
            diff.ac = { old: oldAc, new: newAc };
            const acDiff = newAc - oldAc;
            if (newAc > 25) {
                flags.push({
                    severity: 'danger',
                    field: 'ac',
                    message: `AC reaches suspicious level: ${newAc} (increased by +${acDiff}).`
                });
            } else if (acDiff > 4) {
                flags.push({
                    severity: 'warning',
                    field: 'ac',
                    message: `AC increased significantly by +${acDiff} (${oldAc} ➔ ${newAc}).`
                });
            } else {
                flags.push({
                    severity: 'info',
                    field: 'ac',
                    message: `AC updated from ${oldAc} to ${newAc}.`
                });
            }
        }

        // 4. Ability Scores check
        diff.stats = {};
        for (const stat of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']) {
            const oldVal = Number(existingStats[stat] || 10);
            const newVal = Number(incomingStats[stat] || 10);
            if (oldVal !== newVal) {
                diff.stats[stat] = { old: oldVal, new: newVal };
                const statDiff = newVal - oldVal;
                if (newVal > 20) {
                    flags.push({
                        severity: 'danger',
                        field: `stats.${stat}`,
                        message: `${stat} score exceeds standard limit of 20: reaches ${newVal} (+${statDiff}).`
                    });
                } else if (Math.abs(statDiff) > 4) {
                    flags.push({
                        severity: 'warning',
                        field: `stats.${stat}`,
                        message: `${stat} shifted drastically: ${oldVal} ➔ ${newVal} (${statDiff > 0 ? '+' : ''}${statDiff}).`
                    });
                } else {
                    flags.push({
                        severity: 'info',
                        field: `stats.${stat}`,
                        message: `${stat} updated: ${oldVal} ➔ ${newVal}.`
                    });
                }
            }
        }
    } else {
        // ---- NEW IMPORT ABSOLUTE BOUNDARIES ----

        // 1. Level boundaries
        const incomingLevel = Number(incoming.level || 1);
        if (incomingLevel > 20) {
            flags.push({
                severity: 'danger',
                field: 'level',
                message: `Character level exceeds maximum standard rules: Level ${incomingLevel}.`
            });
        }

        // 2. Max HP boundaries
        const incomingMaxHp = Number(incoming.maxHp || incoming.max_hp || 10);
        if (incomingMaxHp > 300) {
            flags.push({
                severity: 'danger',
                field: 'maxHp',
                message: `Anomalously high Max HP: ${incomingMaxHp} HP.`
            });
        } else if (incomingMaxHp > 180 && incomingLevel < 10) {
            flags.push({
                severity: 'warning',
                field: 'maxHp',
                message: `High Max HP (${incomingMaxHp} HP) for a level ${incomingLevel} character.`
            });
        }

        // 3. AC boundaries
        const incomingAc = Number(incoming.ac || 10);
        if (incomingAc > 25) {
            flags.push({
                severity: 'danger',
                field: 'ac',
                message: `Suspiciously high Armor Class (AC): ${incomingAc}.`
            });
        } else if (incomingAc > 21) {
            flags.push({
                severity: 'warning',
                field: 'ac',
                message: `High Armor Class (AC): ${incomingAc}.`
            });
        }

        // 4. Ability Scores boundaries
        for (const stat of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']) {
            const val = Number(incomingStats[stat] || 10);
            if (val > 24) {
                flags.push({
                    severity: 'danger',
                    field: `stats.${stat}`,
                    message: `Extreme ability score for ${stat}: ${val} (maximum standard is 20).`
                });
            } else if (val > 20) {
                flags.push({
                    severity: 'warning',
                    field: `stats.${stat}`,
                    message: `High ability score for ${stat}: ${val}.`
                });
            }
        }
    }

    const requiresApproval = flags.some(f => f.severity === 'danger' || f.severity === 'warning');

    return {
        diff,
        flags,
        requiresApproval
    };
}

module.exports = {
    validateImportDiff
};
