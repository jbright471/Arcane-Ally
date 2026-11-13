import http from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const express = require('express');
const expressRequire = createRequire(require.resolve('express'));
const proxyaddr = expressRequire('proxy-addr');
const qs = expressRequire('qs');
const multer = require('multer');
const { Server } = require('socket.io');
const { io: connect } = require('socket.io-client');
const cleanup = [];

afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

async function listen(app) {
  const server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  cleanup.push(() => new Promise(resolve => {
    server.closeAllConnections();
    server.close(resolve);
  }));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

function boundedRequest(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(3_000) });
}

describe('patched dependency behavior', () => {
  it('does not trust arbitrary IPv4 peers through a short mapped IPv6 subnet', () => {
    const trust = proxyaddr.compile(['::ffff:10.0.0.0/8']);
    expect(trust('203.0.113.9', 0)).toBe(false);
    const validTrust = proxyaddr.compile(['10.0.0.0/8']);
    expect(validTrust('10.2.3.4', 0)).toBe(true);
    expect(validTrust('203.0.113.9', 0)).toBe(false);
  });

  it('round-trips parsed constructor keys without invoking a hostile isBuffer value', () => {
    const parsed = qs.parse('x[constructor][isBuffer]=synthetic', { plainObjects: true });
    expect(() => qs.stringify(parsed)).not.toThrow();
    expect(qs.stringify(parsed)).toContain('synthetic');
  });

  it('serializes comma arrays without calling an own non-callable toString', () => {
    expect(() => qs.stringify({ items: [{ toString: 'synthetic' }] }, { arrayFormat: 'comma' })).not.toThrow();
  });

  it('keeps normal bounded multipart uploads working and rejects excessive field indexes', async () => {
    const app = express();
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { files: 1, fileSize: 32, fields: 2, fieldSize: 32, fieldArrayIndexLimit: 3 },
    });
    app.post('/upload', upload.single('pdf'), (req, res) => res.json({ bytes: req.file?.size ?? 0 }));
    app.use((error, _req, res, _next) => res.status(error instanceof multer.MulterError ? 413 : 500).json({ code: error.code }));
    const { url } = await listen(app);
    const normal = new FormData();
    normal.append('pdf', new Blob(['%PDF-synthetic'], { type: 'application/pdf' }), 'synthetic.pdf');
    const accepted = await boundedRequest(`${url}/upload`, { method: 'POST', body: normal });
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual({ bytes: 14 });

    const indexed = new FormData();
    indexed.append('items[4]', 'bounded');
    const rejected = await boundedRequest(`${url}/upload`, { method: 'POST', body: indexed });
    expect(rejected.status).toBe(413);
    expect((await rejected.json()).code).toBe('LIMIT_FIELD_ARRAY_INDEX');
  });

  it('parses small compressed JSON and recovers after malformed compressed input', async () => {
    const app = express();
    app.use(express.json({ limit: '1kb' }));
    app.post('/json', (req, res) => res.json(req.body));
    app.get('/health', (_req, res) => res.json({ ok: true }));
    app.use((_error, _req, res, _next) => res.status(400).json({ error: 'Invalid body' }));
    const { url } = await listen(app);
    const headers = { 'content-type': 'application/json', 'content-encoding': 'gzip' };
    const good = await boundedRequest(`${url}/json`, { method: 'POST', headers, body: gzipSync('{"ok":true}') });
    expect(good.status).toBe(200);
    expect(await good.json()).toEqual({ ok: true });
    const bad = await boundedRequest(`${url}/json`, { method: 'POST', headers, body: Buffer.from('not-gzip') });
    expect(bad.status).toBe(400);
    expect((await boundedRequest(`${url}/health`)).status).toBe(200);
  });

  it('retains polling-to-WebSocket upgrade and a fresh reconnect', async () => {
    const { server, url } = await listen((_req, res) => res.end('ok'));
    const io = new Server(server);
    io.on('connection', socket => socket.on('probe', (value, ack) => ack(value)));
    cleanup.push(() => new Promise(resolve => io.close(resolve)));
    for (let attempt = 0; attempt < 2; attempt++) {
      const client = connect(url, { autoConnect: false, forceNew: true, reconnection: false, transports: ['polling', 'websocket'] });
      try {
        const connected = once(client, 'connect', { signal: AbortSignal.timeout(3_000) });
        client.connect();
        await connected;
        if (client.io.engine.transport.name !== 'websocket') {
          await once(client.io.engine, 'upgrade', { signal: AbortSignal.timeout(3_000) });
        }
        expect(client.io.engine.transport.name).toBe('websocket');
        expect(await client.timeout(2_000).emitWithAck('probe', `synthetic-${attempt}`)).toBe(`synthetic-${attempt}`);
      } finally {
        client.disconnect();
      }
    }
  });
});
