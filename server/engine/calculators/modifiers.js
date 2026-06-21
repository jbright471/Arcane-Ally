'use strict';

/**
 * Calculates the standard ability modifier for a given score.
 * e.g., 10 -> 0, 12 -> 1, 8 -> -1
 * 
 * @param {number} score 
 * @returns {number}
 */
function calculateAbilityModifier(score) {
    if (typeof score !== 'number' || isNaN(score)) return 0;
    return Math.floor((score - 10) / 2);
}

/**
 * Formats a numeric modifier as a string with a leading plus or minus.
 * e.g., 1 -> "+1", -2 -> "-2", 0 -> "+0"
 * 
 * @param {number} mod 
 * @returns {string}
 */
function formatModifier(mod) {
    if (typeof mod !== 'number' || isNaN(mod)) return '+0';
    return mod >= 0 ? `+${mod}` : `${mod}`;
}

/**
 * Calculates and formats an ability score's modifier in one step.
 * 
 * @param {number} score 
 * @returns {string}
 */
function getFormattedAbilityModifier(score) {
    const mod = calculateAbilityModifier(score);
    return formatModifier(mod);
}

module.exports = {
    calculateAbilityModifier,
    formatModifier,
    getFormattedAbilityModifier
};
