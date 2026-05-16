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
router.post('/import', (req, res) => {
    const pack = req.body;
    if (!pack || !pack.name || !Array.isArray(pack.monsters)) {
        return res.status(400).json({ error: 'Prep pack must include a "name" and a "monsters" array.' });
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
