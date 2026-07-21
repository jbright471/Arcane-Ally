/**
 * Offline HP write queue — backed by IndexedDB.
 * Queues HP delta emissions when the socket is disconnected.
 * Drains the queue in order on reconnect.
 */
import { useEffect, useRef, useCallback } from 'react';
import socket from '../socket';
import { generateRequestId } from '../lib/requestId';

const DB_NAME  = 'arcane-ally';
const STORE    = 'hp_write_queue';
const DB_VERSION = 1;

interface QueueEntry {
  id?: number;          // IndexedDB auto key
  characterId: number;
  delta: number;
  damageType: string | null;
  actor: string;
  requestId: string;
  timestamp: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = e => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror   = () => reject(req.error);
  });
}

async function enqueue(entry: Omit<QueueEntry, 'id'>): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).add(entry);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror   = () => reject(req.error);
  });
}

async function getQueuedEntries(): Promise<QueueEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req   = store.getAll();
    req.onsuccess = () => resolve((req.result || []) as QueueEntry[]);
    req.onerror = () => reject(req.error);
  });
}

class HpCommandError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

async function removeQueuedEntry(id: number): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function emitWithAck(entry: Omit<QueueEntry, 'id'>): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.timeout(5000).emit('update_hp', {
      characterId: entry.characterId,
      delta: entry.delta,
      damageType: entry.damageType,
      actor: entry.actor,
      requestId: entry.requestId,
    }, (error: Error | null, response: { success?: boolean; error?: string } | undefined) => {
      if (error) return reject(new HpCommandError(error.message, true));
      if (!response?.success) return reject(new HpCommandError(response?.error || 'HP update was rejected', false));
      resolve();
    });
  });
}

/**
 * Emit an HP update immediately if connected, or queue it for replay on reconnect.
 * Returns a function: `emitHp(characterId, delta, damageType, actor)`.
 */
export function useHpWriteQueue() {
  const draining = useRef(false);

  // Drain queued writes on socket reconnect
  useEffect(() => {
    const handleConnect = async () => {
      if (draining.current) return;
      draining.current = true;
      try {
        const entries = await getQueuedEntries();
        let replayed = 0;
        for (const entry of entries) {
          if (entry.id === undefined) continue;
          try {
            await emitWithAck(entry);
            await removeQueuedEntry(entry.id);
            replayed += 1;
          } catch (error) {
            if (error instanceof HpCommandError && !error.retryable) {
              await removeQueuedEntry(entry.id);
              console.warn('[HpQueue] Removed a server-rejected HP update:', error.message);
              continue;
            }
            console.warn('[HpQueue] Replay paused; queued updates remain available:', error);
            break;
          }
        }
        if (replayed > 0) {
          console.info(`[HpQueue] Replayed ${replayed} queued HP update(s) after reconnect.`);
        }
      } finally {
        draining.current = false;
      }
    };

    socket.on('connect', handleConnect);
    if (socket.connected) void handleConnect();
    return () => { socket.off('connect', handleConnect); };
  }, []);

  const emitHp = useCallback((
    characterId: number,
    delta: number,
    damageType: string | null = null,
    actor = 'Player',
  ) => {
    const entry: Omit<QueueEntry, 'id'> = {
      characterId,
      delta,
      damageType,
      actor,
      requestId: generateRequestId(),
      timestamp: Date.now(),
    };

    if (socket.connected) {
      emitWithAck(entry).catch(error => {
        if (error instanceof HpCommandError && !error.retryable) {
          console.warn('[HpQueue] HP update was rejected:', error.message);
          return;
        }
        console.warn('[HpQueue] HP acknowledgement failed; queuing for retry:', error);
        enqueue(entry).catch(queueError => console.warn('[HpQueue] Failed to enqueue:', queueError));
      });
    } else {
      enqueue(entry).catch(err => console.warn('[HpQueue] Failed to enqueue:', err));
    }
  }, []);

  return { emitHp };
}
