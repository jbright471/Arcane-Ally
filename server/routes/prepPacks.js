const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * POST /api/prep-packs/import
 * Imports a JSON Prep Pack and creates an Encounter record.
 * 
 * Expected Schema:
 * {
 *   name: string,
 *   monsters: Array<{ name, hp, ac, initiative_mod, is_hidden, stats }>,
 *   maps: Array<{ name, image_path, grid_size }>,
 *   notes: Array<{ title, content, tags }>,
 *   automation_presets: Array<{ name, preset_type, trigger_phase, effects_json, targets_json, description }>
 * }
 */
function validateEncounterPack(pack) {
    if (!pack || typeof pack !== 'object') throw new Error("Pack must be a JSON object.");
    if (!pack.name || typeof pack.name !== 'string') throw new Error("Pack must have a valid 'name' string.");
    if (!Array.isArray(pack.monsters)) throw new Error("'monsters' must be an array.");
    
    pack.monsters.forEach((m, idx) => {
        if (!m.name || typeof m.name !== 'string') throw new Error(`Monster at index ${idx} missing 'name'.`);
        if (typeof m.hp !== 'number') throw new Error(`Monster at index ${idx} missing numeric 'hp'.`);
        if (typeof m.ac !== 'number') throw new Error(`Monster at index ${idx} missing numeric 'ac'.`);
    });

    if (pack.maps && !Array.isArray(pack.maps)) throw new Error("'maps' must be an array if provided.");
    if (pack.notes && !Array.isArray(pack.notes)) throw new Error("'notes' must be an array if provided.");
    
    if (pack.automation_presets) {
        if (!Array.isArray(pack.automation_presets)) throw new Error("'automation_presets' must be an array if provided.");
        pack.automation_presets.forEach((p, idx) => {
            if (!p.name) throw new Error(`Preset at index ${idx} missing 'name'.`);
            if (p.effects_json) {
                try {
                    const effects = typeof p.effects_json === 'string' ? JSON.parse(p.effects_json) : p.effects_json;
                    if (!Array.isArray(effects)) throw new Error("must be an array");
                    p.effects_json = JSON.stringify(effects);
                } catch (e) {
                    throw new Error(`Invalid effects_json in preset '${p.name}': ${e.message}`);
                }
            }
        });
    }
}

router.post('/import', (req, res) => {
    const pack = req.body;
    try {
        validateEncounterPack(pack);
    } catch (validationErr) {
        return res.status(400).json({ error: validationErr.message });
    }

    try {
        const mapsJson = JSON.stringify(pack.maps || []);
        const notesJson = JSON.stringify(pack.notes || []);
        const presetsJson = JSON.stringify(pack.automation_presets || []);
        const monstersJson = JSON.stringify(pack.monsters || []);

        const result = db.prepare(`
            INSERT INTO encounters (name, monsters, maps_json, notes_json, automation_presets_json)
            VALUES (?, ?, ?, ?, ?)
        `).run(pack.name, monstersJson, mapsJson, notesJson, presetsJson);

        const enc = db.prepare('SELECT * FROM encounters WHERE id = ?').get(result.lastInsertRowid);
        
        enc.monsters = JSON.parse(enc.monsters);
        enc.maps_json = JSON.parse(enc.maps_json || '[]');
        enc.notes_json = JSON.parse(enc.notes_json || '[]');
        enc.automation_presets_json = JSON.parse(enc.automation_presets_json || '[]');

        res.status(201).json(enc);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
