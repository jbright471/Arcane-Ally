const crypto = require('crypto');

function getSmartPins(db) {
  const row = db.prepare("SELECT value FROM campaign_state WHERE key = 'combat_smart_pins'").get();
  if (!row || !row.value) return [];
  try {
    return JSON.parse(row.value);
  } catch (_e) {
    return [];
  }
}

function saveSmartPins(db, pins) {
  db.prepare("INSERT OR REPLACE INTO campaign_state (key, value) VALUES ('combat_smart_pins', ?)").run(JSON.stringify(pins));
}

function addOrUpdatePin(db, pinData) {
  const pins = getSmartPins(db);
  const existingIdx = pins.findIndex(p => p.id === pinData.id);

  const pin = {
    id: pinData.id || crypto.randomUUID(),
    targetType: pinData.targetType || 'combatant', // 'combatant' or 'round'
    targetId: pinData.targetId, // instance_id for combatants, or number/string for rounds
    content: pinData.content || '',
    isPinned: pinData.isPinned !== undefined ? !!pinData.isPinned : true,
    createdAt: pinData.createdAt || new Date().toISOString()
  };

  if (existingIdx >= 0) {
    pins[existingIdx] = pin;
  } else {
    pins.push(pin);
  }

  saveSmartPins(db, pins);
  return pin;
}

function deletePin(db, pinId) {
  const pins = getSmartPins(db);
  const filtered = pins.filter(p => p.id !== pinId);
  saveSmartPins(db, filtered);
}

function clearAllSmartPins(db) {
  saveSmartPins(db, []);
}

function savePinsToTemplate(db, encounterId) {
  if (!encounterId) return { success: false, error: 'No encounterId provided' };
  const pins = getSmartPins(db);

  try {
    db.prepare("UPDATE encounters SET notes_json = ? WHERE id = ?").run(
      JSON.stringify(pins),
      encounterId
    );
    return { success: true, count: pins.length };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = {
  getSmartPins,
  saveSmartPins,
  addOrUpdatePin,
  deletePin,
  clearAllSmartPins,
  savePinsToTemplate
};
