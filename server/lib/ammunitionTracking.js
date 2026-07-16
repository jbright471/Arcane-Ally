'use strict';

const { getAutomationRules } = require('./automationRules');

function parseArray(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function consumeAmmunitionForAttack(db, characterId, weaponName) {
  if (!getAutomationRules(db).ammunitionTracking) {
    return { success: true, consumed: 0, reason: 'disabled' };
  }

  return db.transaction(() => {
    const character = db.prepare(
      'SELECT name, attacks, inventory, homebrew_inventory FROM characters WHERE id = ?'
    ).get(characterId);
    if (!character) return { success: false, error: 'Character not found' };

    const attacks = parseArray(character.attacks);
    const weapon = attacks.find(attack => (
      String(attack.name || '').toLowerCase() === String(weaponName || '').toLowerCase()
    ));
    const ammunitionName = String(weapon?.ammunitionName || '').trim();
    if (!weapon || !ammunitionName) {
      return { success: true, consumed: 0, reason: 'unlinked' };
    }

    const amount = Math.min(20, Math.max(1, Math.round(Number(weapon.ammunitionPerAttack) || 1)));
    const inventories = [
      { column: 'inventory', items: parseArray(character.inventory) },
      { column: 'homebrew_inventory', items: parseArray(character.homebrew_inventory) },
    ];

    for (const inventory of inventories) {
      const index = inventory.items.findIndex(item => (
        String(item.name || '').toLowerCase() === ammunitionName.toLowerCase()
      ));
      if (index < 0) continue;

      const available = Math.max(0, Number(inventory.items[index].quantity) || 0);
      if (available < amount) {
        return {
          success: false,
          error: `${character.name} does not have enough ${ammunitionName}`,
          ammunitionName,
          remaining: available,
        };
      }

      const remaining = available - amount;
      inventory.items[index] = { ...inventory.items[index], quantity: remaining };
      db.prepare(`UPDATE characters SET ${inventory.column} = ? WHERE id = ?`)
        .run(JSON.stringify(inventory.items), characterId);
      return { success: true, consumed: amount, ammunitionName, remaining, weaponName: weapon.name };
    }

    return {
      success: false,
      error: `${ammunitionName} is not in ${character.name}'s inventory`,
      ammunitionName,
      remaining: 0,
    };
  }).immediate();
}

module.exports = { consumeAmmunitionForAttack };
