import { deserializeState, serializeState, type GameState } from '@heroes/engine';
import { appStore } from './store';
import { eventBus } from './events';

/**
 * Sauvegarde IndexedDB — SIGNATURES FIGÉES en cadrage 2.5 (le lot F livre le
 * format complet doc 07 §4 : idb + gzip CompressionStream, export/import
 * `.heroes` versionné référençant les paquets). Implémentation de transition :
 * snapshot brut par slot + horodatage (fourni par l'appelant du navigateur —
 * jamais par le moteur, qui reste sans Date.now).
 */
export type SaveSlot = 'auto' | 'manual';

const DB_NAME = 'heroes';
const STORE = 'saves';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
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

interface StoredSave {
  savedAt: number;
  snapshot: string;
}

export async function saveGame(state: GameState, slot: SaveSlot): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const value: StoredSave = { savedAt: Date.now(), snapshot: serializeState(state) };
    await requestDone(tx.objectStore(STORE).put(value, slot));
  } finally {
    db.close();
  }
}

/** Retourne null si le slot est vide. */
export async function loadGame(slot: SaveSlot): Promise<GameState | null> {
  const stored = await readSlot(slot);
  return stored ? deserializeState(stored.snapshot) : null;
}

/** Recharge un slot dans le store — false si le slot est vide. */
export async function restoreSavedGame(slot: SaveSlot): Promise<boolean> {
  const state = await loadGame(slot);
  if (!state) return false;
  appStore.setState({ game: state, screen: 'game' });
  eventBus.emit([{ type: 'GameLoaded' }]);
  return true;
}

/** « Continuer » (doc 08 §2.5) : la sauvegarde la plus récente, auto ou manuelle. */
export async function restoreLatestSave(): Promise<boolean> {
  const slot = await latestSlot();
  return slot ? restoreSavedGame(slot) : false;
}

/** Y a-t-il quelque chose à « Continuer » ? (grise le bouton du menu sinon). */
export async function hasAnySave(): Promise<boolean> {
  return (await latestSlot()) !== null;
}

/** Export `.heroes` (doc 07 §4) — implémenté par le lot F. */
export function exportSave(state: GameState): Promise<Blob> {
  void state;
  return Promise.reject(new Error('exportSave: lot F en cours'));
}

/** Import `.heroes` — validation + chargement dans le store ; false si invalide. */
export function importSave(file: Blob): Promise<boolean> {
  void file;
  return Promise.reject(new Error('importSave: lot F en cours'));
}

async function latestSlot(): Promise<SaveSlot | null> {
  const [auto, manual] = await Promise.all([readSlot('auto'), readSlot('manual')]);
  if (!auto && !manual) return null;
  if (auto && manual) return auto.savedAt >= manual.savedAt ? 'auto' : 'manual';
  return auto ? 'auto' : 'manual';
}

async function readSlot(slot: SaveSlot): Promise<StoredSave | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readonly');
    const value = await requestDone(tx.objectStore(STORE).get(slot));
    return isStoredSave(value) ? value : null;
  } finally {
    db.close();
  }
}

function isStoredSave(v: unknown): v is StoredSave {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as StoredSave).savedAt === 'number' &&
    typeof (v as StoredSave).snapshot === 'string'
  );
}
