'use strict';

const crypto = require('crypto');

class CommandConflictError extends Error {
  constructor(message, code = 'COMMAND_CONFLICT') {
    super(message);
    this.name = 'CommandConflictError';
    this.code = code;
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashPayload(payload) {
  return crypto.createHash('sha256').update(stableStringify(payload ?? null)).digest('hex');
}

function parseResult(row) {
  try {
    return JSON.parse(row.result_json || 'null');
  } catch {
    return null;
  }
}

function executeProcessedCommand(db, command, execute) {
  const {
    commandId,
    commandType,
    actorType = 'unknown',
    actorId = null,
    sessionId = null,
    aggregateKey = null,
    expectedVersion = null,
    payload = null,
  } = command;

  if (!commandId || !commandType) {
    throw new CommandConflictError('commandId and commandType are required', 'INVALID_COMMAND');
  }

  const payloadHash = hashPayload(payload);
  const transaction = db.transaction(() => {
    const existing = db.prepare('SELECT * FROM processed_commands WHERE command_id = ?').get(commandId);
    if (existing) {
      if (existing.command_type !== commandType || existing.payload_hash !== payloadHash) {
        throw new CommandConflictError('Command ID was already used with a different payload');
      }
      return {
        commandId,
        replayed: true,
        aggregateVersion: existing.aggregate_version,
        result: parseResult(existing),
      };
    }

    let aggregateVersion = null;
    if (aggregateKey) {
      const versionRow = db.prepare('SELECT version FROM aggregate_versions WHERE aggregate_key = ?').get(aggregateKey);
      const currentVersion = versionRow?.version ?? 0;
      if (expectedVersion !== null && Number(expectedVersion) !== currentVersion) {
        throw new CommandConflictError(
          `Expected aggregate version ${expectedVersion}, received ${currentVersion}`,
          'STALE_AGGREGATE_VERSION',
        );
      }
      aggregateVersion = currentVersion + 1;
    }

    db.prepare(`
      INSERT INTO processed_commands
        (command_id, command_type, actor_type, actor_id, session_id, aggregate_key,
         expected_version, payload_hash, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'processing')
    `).run(
      commandId,
      commandType,
      actorType,
      actorId === null ? null : String(actorId),
      sessionId,
      aggregateKey,
      expectedVersion,
      payloadHash,
    );

    const result = execute();
    const mutationRejected = result?.success === false || result?.mutation?.success === false;
    const mutationSkipped = result?.mutated === false || result?.mutation?.mutated === false;

    if (aggregateKey && !mutationRejected && !mutationSkipped) {
      db.prepare(`
        INSERT INTO aggregate_versions (aggregate_key, version, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(aggregate_key) DO UPDATE SET
          version = excluded.version,
          updated_at = excluded.updated_at
      `).run(aggregateKey, aggregateVersion);
    } else if (aggregateKey) {
      aggregateVersion -= 1;
    }

    db.prepare(`
      UPDATE processed_commands
      SET status = 'committed', result_json = ?, aggregate_version = ?, committed_at = datetime('now')
      WHERE command_id = ?
    `).run(JSON.stringify(result ?? null), aggregateVersion, commandId);

    return { commandId, replayed: false, aggregateVersion, result };
  });

  return transaction.immediate();
}

function pruneProcessedCommands(db, { maxAgeDays = 30, maxRows = 50000 } = {}) {
  db.prepare(`
    DELETE FROM processed_commands
    WHERE status = 'committed'
      AND created_at < datetime('now', ?)
  `).run(`-${Math.max(1, Number(maxAgeDays) || 30)} days`);

  db.prepare(`
    DELETE FROM processed_commands
    WHERE command_id IN (
      SELECT command_id FROM processed_commands
      WHERE status = 'committed'
      ORDER BY created_at DESC
      LIMIT -1 OFFSET ?
    )
  `).run(Math.max(1000, Number(maxRows) || 50000));
}

module.exports = {
  CommandConflictError,
  executeProcessedCommand,
  hashPayload,
  pruneProcessedCommands,
  stableStringify,
};
