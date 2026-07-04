import { deserializeState, serializeState, type GameState } from '@heroes/engine';
import { appStore } from './store';
import { eventBus } from './events';

/**
 * Sauvegarde IndexedDB minimale — jalon Phase 0 roadmap : snapshot brut,
 * 1 slot. Le format complet (idb + gzip + journal de commandes + export
 * `.heroes`, doc 07 §4) arrive en Phase 2.5.
 */
const DB_NAME = 'heroes';
const STORE = 'saves';
const SLOT = 'slot-1';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB inaccessible'));
  });
}

function requestDone<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('requête IndexedDB échouée'));
  });
}

export async function saveGame(state: GameState): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    await requestDone(tx.objectStore(STORE).put(serializeState(state), SLOT));
  } finally {
    db.close();
  }
}

/** Recharge le slot dans le store — no-op si le slot est vide. */
export async function restoreSavedGame(): Promise<boolean> {
  const state = await loadGame();
  if (!state) return false;
  appStore.setState({ game: state });
  eventBus.emit([{ type: 'GameLoaded' }]);
  return true;
}

/** Retourne null si le slot est vide. */
export async function loadGame(): Promise<GameState | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readonly');
    const snapshot = await requestDone(tx.objectStore(STORE).get(SLOT));
    return typeof snapshot === 'string' ? deserializeState(snapshot) : null;
  } finally {
    db.close();
  }
}
