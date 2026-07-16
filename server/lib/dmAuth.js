'use strict';

function getDmTokenFromRequest(req) {
  const authHeader = req.headers?.authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  return String(req.headers?.['x-dm-token'] || '').trim();
}

function isValidDmToken(db, token) {
  if (!token) return false;
  const row = db.prepare("SELECT value FROM campaign_state WHERE key = 'dm_token'").get();
  return row?.value === token;
}

function requireDmRequest(db) {
  return (req, res, next) => {
    if (!isValidDmToken(db, getDmTokenFromRequest(req))) {
      return res.status(401).json({ error: 'Unauthorized: Invalid DM token' });
    }
    return next();
  };
}

module.exports = { getDmTokenFromRequest, isValidDmToken, requireDmRequest };
