const crypto = require('crypto');

function getActiveAuras(db) {
  const row = db.prepare("SELECT value FROM campaign_state WHERE key = 'active_auras'").get();
  if (!row || !row.value) return [];
  try {
    return JSON.parse(row.value);
  } catch (e) {
    return [];
  }
}

function saveActiveAuras(db, auras) {
  db.prepare("INSERT OR REPLACE INTO campaign_state (key, value) VALUES ('active_auras', ?)").run(JSON.stringify(auras));
}

function createOrUpdateAura(db, auraData) {
  const auras = getActiveAuras(db);
  const existingIdx = auras.findIndex(a => a.id === auraData.id);
  
  const aura = {
    id: auraData.id || crypto.randomUUID(),
    name: auraData.name || 'Custom Aura',
    casterId: auraData.casterId || null,
    casterName: auraData.casterName || 'Aura Caster',
    radius: auraData.radius || 30,
    active: auraData.active !== undefined ? !!auraData.active : true,
    buffData: auraData.buffData || {},
    targets: auraData.targets || []
  };

  if (existingIdx >= 0) {
    auras[existingIdx] = aura;
  } else {
    auras.push(aura);
  }
  
  saveActiveAuras(db, auras);
  return aura;
}

function toggleAura(db, auraId, isActive) {
  const auras = getActiveAuras(db);
  const aura = auras.find(a => a.id === auraId);
  if (aura) {
    aura.active = !!isActive;
    saveActiveAuras(db, auras);
    return aura;
  }
  return null;
}

function updateAuraTargets(db, auraId, targetIds) {
  const auras = getActiveAuras(db);
  const aura = auras.find(a => a.id === auraId);
  if (aura) {
    aura.targets = Array.isArray(targetIds) ? targetIds.map(Number) : [];
    saveActiveAuras(db, auras);
    return aura;
  }
  return null;
}

function deleteAura(db, auraId) {
  const auras = getActiveAuras(db);
  const filtered = auras.filter(a => a.id !== auraId);
  saveActiveAuras(db, filtered);
}

function clearAllAuras(db) {
  saveActiveAuras(db, []);
}

function deduplicateCombinedBuffs(buffs) {
  const seen = new Map();
  for (const buff of buffs) {
    const key = (buff.name || '').toLowerCase().trim();
    if (!key) continue;
    if (!seen.has(key)) {
      seen.set(key, buff);
    } else {
      const existing = seen.get(key);
      const existingVal = parseInt(existing.modifierValue || 0, 10);
      const newVal = parseInt(buff.modifierValue || 0, 10);
      if (newVal > existingVal) {
        seen.set(key, buff);
      }
    }
  }
  return [...seen.values()];
}

module.exports = {
  getActiveAuras,
  saveActiveAuras,
  createOrUpdateAura,
  toggleAura,
  updateAuraTargets,
  deleteAura,
  clearAllAuras,
  deduplicateCombinedBuffs
};
