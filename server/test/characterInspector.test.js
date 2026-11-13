import http from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, insertCharacter } from './helpers/testDb.js';

const require = createRequire(import.meta.url);
const express = require('express');
const { createRestAuthorizationMiddleware } = require('../lib/restAuthorization');
const { getResolvedCharacterState } = require('../lib/rulesIntegration');
const dbPath = require.resolve('../db');
const routePath = require.resolve('../routes/characters');

describe('read-only character combat inspector route', () => {
  let db;
  let server;
  let url;
  let characterId;
  let missingSessionId;
  let previousDb;
  let previousRoute;
  let changesAfterSeed;

  beforeAll(async () => {
    db = createTestDb();
    characterId = insertCharacter(db, { name: 'Inspector fixture' });
    missingSessionId = insertCharacter(db, { name: 'Missing session fixture' });
    db.prepare('DELETE FROM session_states WHERE character_id = ?').run(missingSessionId);
    db.prepare('UPDATE characters SET inventory = ?, backstory = ?, raw_dndbeyond_json = ? WHERE id = ?').run(
      JSON.stringify([{ name: 'Fixture ring', equipped: true, stats: { statBonuses: { STR: 2 }, acBonus: 1 } }]),
      'PRIVATE_BACKSTORY_SENTINEL', 'PRIVATE_IMPORT_SENTINEL', characterId,
    );
    db.prepare('UPDATE session_states SET conditions_json = ?, buffs_json = ?, active_features_json = ? WHERE character_id = ?').run(
      JSON.stringify(['prone']),
      JSON.stringify([{ name: 'Shield of Faith' }, { name: 'Strength boost', sourceName: 'Fixture buff', modifierType: 'flatBonus', statAffected: 'STR', modifierValue: 2 }]),
      JSON.stringify(['Fixture stance']), characterId,
    );
    db.prepare('INSERT INTO campaign_state (key, value) VALUES (?, ?)').run('active_auras', JSON.stringify([
      { id: 'fixture-aura', name: 'Fixture aura', active: true, targets: [characterId], buffData: { modifierType: 'flatBonus', statAffected: 'STR', modifierValue: 1 } },
    ]));
    changesAfterSeed = db.prepare('SELECT total_changes() AS count').get().count;

    // Inject only the DB singleton; exercise the actual router, authorization
    // middleware, and rules resolver against a real in-memory SQLite database.
    previousDb = require.cache[dbPath];
    previousRoute = require.cache[routePath];
    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };
    delete require.cache[routePath];
    const { router } = require('../routes/characters');
    const app = express();
    app.use(createRestAuthorizationMiddleware({
      authenticateDm: token => token === 'fixture-dm',
      authenticateAccessGrant: token => token === 'fixture-player' || token === 'fixture-cast'
        ? { id: token, role: token.slice('fixture-'.length) } : null,
    }));
    app.use('/api/characters', router);
    server = http.createServer(app);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    url = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
    if (previousDb) require.cache[dbPath] = previousDb;
    else delete require.cache[dbPath];
    if (previousRoute) require.cache[routePath] = previousRoute;
    else delete require.cache[routePath];
    db?.close();
  });

  function request(id = characterId, token = 'fixture-dm') {
    return fetch(`${url}/api/characters/${id}/combat-inspector`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(3_000),
    });
  }

  it('returns authoritative resolved finals and sources, including gear, buffs, auras and active features', async () => {
    const expected = getResolvedCharacterState(db, characterId);
    const response = await request();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(['characterId', 'name', 'ac', 'abilityScores', 'activeConditions', 'activeBuffs'].sort());
    expect(body.characterId).toBe(String(characterId));
    expect(body.name).toBe('Inspector fixture');
    expect(body.ac).toEqual({ finalAC: expected.ac, breakdown: expected.acBreakdown });
    expect(body.ac.finalAC).toBe(19);
    expect(body.abilityScores.STR).toEqual({ final: expected.abilityScores.STR, modifier: expected.abilityModifiers.STR, breakdown: expected.abilityScoresBreakdown.STR });
    expect(body.abilityScores.STR.final).toBe(21);
    expect(body.activeConditions).toEqual(['prone']);
    expect(body.activeBuffs).toEqual(expected.buffs);
    expect(body.activeBuffs.map(buff => buff.name)).toContain('Fixture stance');
    expect(JSON.stringify(body)).not.toMatch(/PRIVATE_BACKSTORY_SENTINEL|PRIVATE_IMPORT_SENTINEL/);
  });

  it.each([[null, 401], ['fixture-player', 403], ['fixture-cast', 403]])('denies %s access through the existing DM-only boundary', async (token, status) => {
    const response = await request(characterId, token);
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ code: 'REST_DM_REQUIRED' });
  });

  it.each(['0', '-1', '1.5', '1suffix', '9007199254740992', '999999'])('returns 404 for invalid or unknown ID %s', async id => {
    const response = await request(id);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Character not found' });
  });

  it('does not create a missing session or mutate SQLite during repeated successful and failed reads', async () => {
    expect((await request(missingSessionId)).status).toBe(409);
    expect(await (await request(missingSessionId)).json()).toEqual({ error: 'Character session state unavailable' });
    expect((await request()).status).toBe(200);
    expect((await request()).status).toBe(200);
    expect(db.prepare('SELECT * FROM session_states WHERE character_id = ?').get(missingSessionId)).toBeUndefined();
    expect(db.prepare('SELECT total_changes() AS count').get().count).toBe(changesAfterSeed);
  });
});
