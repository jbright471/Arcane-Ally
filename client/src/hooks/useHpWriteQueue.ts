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

async function enqueue(entry: Omit<QueueEntry, 'id'>): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).add(entry);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function drainQueue(): Promise<QueueEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req   = store.getAll();
    req.onsuccess = () => {
      const entries: QueueEntry[] = req.result || [];
      if (entries.length > 0) store.clear();
      resolve(entries);
    };
    req.onerror = () => reject(req.error);
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
        const entries = await drainQueue();
        for (const entry of entries) {
          socket.emit('update_hp', {
            characterId: entry.characterId,
            delta: entry.delta,
            damageType: entry.damageType,
            actor: entry.actor,
            requestId: entry.requestId,
          });
          // Small gap to avoid flooding the server
          await new Promise(r => setTimeout(r, 50));
        }
        if (entries.length > 0) {
          console.info(`[HpQueue] Replayed ${entries.length} queued HP update(s) after reconnect.`);
        }
      } finally {
        draining.current = false;
      }
    };

    socket.on('connect', handleConnect);
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
      socket.emit('update_hp', {
        characterId: entry.characterId,
        delta: entry.delta,
        damageType: entry.damageType,
        actor: entry.actor,
        requestId: entry.requestId,
      });
    } else {
      enqueue(entry).catch(err => console.warn('[HpQueue] Failed to enqueue:', err));
    }
  }, []);

  return { emitHp };
}
