import { deserializeState, serializeState, type GameState } from '@heroes/engine';
import { appStore } from './store';
import { eventBus } from './events';

/**
 * Sauvegarde IndexedDB (doc 07 §4) : snapshot `serializeState(state)`
 * compressé gzip (`CompressionStream`), stocké en `ArrayBuffer` avec
 * métadonnées `{ savedAt, saveVersion, packs }`. Migration douce à la
 * lecture : les enregistrements de l'ancien format (transition Phase 2.5,
 * JSON non compressé `{ savedAt, snapshot }`, ou une string brute) restent
 * chargeables ; toute nouvelle écriture est au nouveau format.
 *
 * Journal de commandes depuis le dernier snapshot (doc 07 §4, sauvegardes
 * incrémentales) : hors scope 2.5, le snapshot intégral à chaque sauvegarde
 * suffit pour ce lot.
 */
export type SaveSlot = 'auto' | 'manual';

const DB_NAME = 'heroes';
const DB_VERSION = 3;
const STORE = 'saves';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
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

/** Nouveau format d'enregistrement (v3) — un slot IndexedDB. */
interface SaveRecord {
  savedAt: number;
  saveVersion: number;
  /** IDs de paquets référencés par la partie (doc 07 §4), dédupliqués triés. */
  packs: string[];
  data: ArrayBuffer;
}

/** Ancien format (transition 2.5) : snapshot JSON non compressé. */
interface LegacySaveRecord {
  savedAt: number;
  snapshot: string;
}

/** Snapshot décodé, indépendamment du format de stockage rencontré. */
interface DecodedSave {
  savedAt: number;
  snapshot: string;
}

function packsOf(state: GameState): string[] {
  const ids = new Set(Object.values(state.unitCatalog).map((u) => u.groupId));
  return [...ids].sort();
}

async function gzipCompress(text: string): Promise<ArrayBuffer> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

async function gzipDecompress(data: ArrayBuffer | Blob): Promise<string> {
  const source = data instanceof Blob ? data : new Blob([data]);
  const stream = source.stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

export async function saveGame(state: GameState, slot: SaveSlot): Promise<void> {
  const record: SaveRecord = {
    savedAt: Date.now(),
    saveVersion: state.saveVersion,
    packs: packsOf(state),
    data: await gzipCompress(serializeState(state)),
  };
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    await requestDone(tx.objectStore(STORE).put(record, slot));
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

/** Export `.heroes` (doc 07 §4) : JSON gzip `{ saveVersion, packs, snapshot }`. */
export async function exportSave(state: GameState): Promise<Blob> {
  const payload = {
    saveVersion: 1,
    packs: packsOf(state),
    snapshot: serializeState(state),
  };
  const data = await gzipCompress(JSON.stringify(payload));
  return new Blob([data], { type: 'application/gzip' });
}

/** Import `.heroes` — validation + chargement dans le store ; false si invalide. */
export async function importSave(file: Blob): Promise<boolean> {
  try {
    const json = await gzipDecompress(file);
    const payload: unknown = JSON.parse(json);
    if (!isExportPayload(payload)) return false;
    const state = deserializeState(payload.snapshot);
    if (!state.started) return false;
    appStore.setState({ game: state, screen: 'game' });
    eventBus.emit([{ type: 'GameLoaded' }]);
    return true;
  } catch {
    return false;
  }
}

interface ExportPayload {
  saveVersion: 1;
  packs: string[];
  snapshot: string;
}

function isExportPayload(v: unknown): v is ExportPayload {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as ExportPayload).saveVersion === 1 &&
    Array.isArray((v as ExportPayload).packs) &&
    typeof (v as ExportPayload).snapshot === 'string'
  );
}

async function latestSlot(): Promise<SaveSlot | null> {
  const [auto, manual] = await Promise.all([readSlot('auto'), readSlot('manual')]);
  if (!auto && !manual) return null;
  if (auto && manual) return auto.savedAt >= manual.savedAt ? 'auto' : 'manual';
  return auto ? 'auto' : 'manual';
}

async function readSlot(slot: SaveSlot): Promise<DecodedSave | null> {
  const db = await openDb();
  let raw: unknown;
  try {
    const tx = db.transaction(STORE, 'readonly');
    raw = await requestDone(tx.objectStore(STORE).get(slot));
  } finally {
    db.close();
  }
  return decodeStoredValue(raw);
}

async function decodeStoredValue(raw: unknown): Promise<DecodedSave | null> {
  if (isSaveRecord(raw)) return { savedAt: raw.savedAt, snapshot: await gzipDecompress(raw.data) };
  if (isLegacySaveRecord(raw)) return { savedAt: raw.savedAt, snapshot: raw.snapshot };
  // Très ancien format (compat) : string brute, pas d'horodatage connu.
  if (typeof raw === 'string') return { savedAt: 0, snapshot: raw };
  return null;
}

function isSaveRecord(v: unknown): v is SaveRecord {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as SaveRecord).savedAt === 'number' &&
    typeof (v as SaveRecord).saveVersion === 'number' &&
    Array.isArray((v as SaveRecord).packs) &&
    (v as SaveRecord).data instanceof ArrayBuffer
  );
}

function isLegacySaveRecord(v: unknown): v is LegacySaveRecord {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as LegacySaveRecord).savedAt === 'number' &&
    typeof (v as LegacySaveRecord).snapshot === 'string'
  );
}
