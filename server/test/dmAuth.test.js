import { describe, expect, it, vi } from 'vitest';
import { getDmTokenFromRequest, isValidDmToken, requireDmRequest } from '../lib/dmAuth.js';
import { createTestDb } from './helpers/testDb.js';

describe('DM HTTP authentication', () => {
  it('accepts bearer and DM token headers', () => {
    expect(getDmTokenFromRequest({ headers: { authorization: 'Bearer secret' } })).toBe('secret');
    expect(getDmTokenFromRequest({ headers: { 'x-dm-token': 'header-secret' } })).toBe('header-secret');
  });

  it('validates the current campaign DM token', () => {
    const db = createTestDb();
    db.prepare("INSERT INTO campaign_state (key, value) VALUES ('dm_token', 'secret')").run();
    expect(isValidDmToken(db, 'secret')).toBe(true);
    expect(isValidDmToken(db, 'wrong')).toBe(false);
  });

  it('rejects unauthenticated requests and allows valid requests', () => {
    const db = createTestDb();
    db.prepare("INSERT INTO campaign_state (key, value) VALUES ('dm_token', 'secret')").run();
    const middleware = requireDmRequest(db);
    const next = vi.fn();
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));

    middleware({ headers: {} }, { status }, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'Unauthorized: Invalid DM token' });
    expect(next).not.toHaveBeenCalled();

    middleware({ headers: { 'x-dm-token': 'secret' } }, { status }, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
