import {
  CURRENT_SAVE_VERSION,
  deserializeState,
  readSaveVersion,
  serializeState,
  type GameState,
} from '@heroes/engine';
import { getSave, putSave } from './net';
import { currentSaveContext, enterLoadedGame, type SaveContext } from './load-game';

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

/**
 * Revue 2026-09 (C1) : une écriture n'est ACQUISE qu'au `complete` de la
 * TRANSACTION — le `onsuccess` de la requête `put` arrive avant le commit, et
 * c'est au commit qu'IndexedDB signale un dépassement de quota (`abort`, Firefox
 * notamment). Attendre la seule requête faisait résoudre `saveGame` (toast
 * « Sauvegardé ») sur une sauvegarde jamais écrite : perte silencieuse.
 */
function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('transaction IndexedDB annulée'));
    tx.onerror = () => reject(tx.error ?? new Error('transaction IndexedDB échouée'));
  });
}

/** Nouveau format d'enregistrement (v3) — un slot IndexedDB. */
interface SaveRecord {
  savedAt: number;
  saveVersion: number;
  /** IDs de paquets référencés par la partie (doc 07 §4), dédupliqués triés. */
  packs: string[];
  data: ArrayBuffer;
  /** Contexte client de la partie (chapitre actif, contrats) — optionnel, hors `GameState` (revue 2026-09). */
  context?: SaveContext;
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
  context: SaveContext | null;
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

/**
 * File d'écriture PAR SLOT (revue 2026-09) : `saveGame` = gzip async puis `put` ;
 * deux appels rapprochés (hot-seat, fin de tour juste après un relais IA court)
 * pouvaient commiter dans le désordre et laisser le snapshot le plus ANCIEN
 * gagner. Les écritures d'un slot sont sérialisées dans l'ordre d'appel.
 */
const writeChains: Partial<Record<SaveSlot, Promise<void>>> = {};

export function saveGame(state: GameState, slot: SaveSlot, context: SaveContext = currentSaveContext()): Promise<void> {
  const prev = writeChains[slot] ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(() => writeSave(state, slot, context));
  writeChains[slot] = run;
  return run;
}

async function writeSave(state: GameState, slot: SaveSlot, context: SaveContext): Promise<void> {
  const record: SaveRecord = {
    savedAt: Date.now(),
    saveVersion: state.saveVersion,
    packs: packsOf(state),
    data: await gzipCompress(serializeState(state)),
    context,
  };
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const done = transactionDone(tx);
    tx.objectStore(STORE).put(record, slot);
    await done;
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
  const stored = await readSlot(slot);
  if (!stored) return false;
  enterLoadedGame(deserializeState(stored.snapshot), { context: stored.context });
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

/**
 * Une sauvegarde n'est chargeable que si la version de forme de son snapshot
 * correspond à la version courante du moteur (doc 07 §4). Sinon on la rejette
 * proprement plutôt que d'adopter un état malformé (champs manquants).
 */
function isCompatible(snapshot: string): boolean {
  return readSaveVersion(snapshot) === CURRENT_SAVE_VERSION;
}

// — Cloud saves (doc 15 §5.2, NET-CLOUDSAVES) : réutilise la MÊME sérialisation
// et la MÊME garde de version que les sauvegardes locales/import. Le SDK `net`
// est inerte hors-ligne (pas de `VITE_BACKEND_URL`) ; ces helpers ne sont
// appelés que derrière `isOnline() && isLoggedIn()`.

/** Envoie l'état courant vers le slot cloud (snapshot moteur + version de forme). */
export async function pushCloudSave(state: GameState, slot: SaveSlot = 'manual'): Promise<void> {
  await putSave(slot, serializeState(state), state.saveVersion);
}

/** Issue d'un chargement cloud : chargé / version incompatible / partie non démarrée. */
export type CloudPullResult = 'ok' | 'incompatible' | 'notStarted';

/**
 * Charge le slot cloud dans le store. Rejette proprement une sauvegarde d'une
 * autre version de forme (même garde que `importSave`, doc 07 §4). Les erreurs
 * réseau / slot vide (404) se propagent en exception — gérées par l'appelant.
 */
export async function pullCloudSave(slot: SaveSlot = 'manual'): Promise<CloudPullResult> {
  const r = await getSave(slot);
  if (!isCompatible(r.state)) return 'incompatible';
  const state = deserializeState(r.state);
  if (!state.started) return 'notStarted';
  // Le cloud ne porte que l'état moteur : aucun contexte client (chapitre,
  // contrats) — la partie repart propre.
  enterLoadedGame(state);
  return 'ok';
}

/** Emballe un snapshot en fichier `.heroes` gzip (format d'export, doc 07 §4). */
export async function encodeHeroesFile(snapshot: string, packs: string[], context?: SaveContext): Promise<Blob> {
  const payload: ExportPayload = { saveVersion: 1, packs, snapshot, ...(context ? { context } : {}) };
  const data = await gzipCompress(JSON.stringify(payload));
  return new Blob([data], { type: 'application/gzip' });
}

/** Export `.heroes` (doc 07 §4) : JSON gzip `{ saveVersion, packs, snapshot, context? }`. */
export async function exportSave(state: GameState): Promise<Blob> {
  return encodeHeroesFile(serializeState(state), packsOf(state), currentSaveContext());
}

/** Import `.heroes` — validation + chargement dans le store ; false si invalide. */
export async function importSave(file: Blob): Promise<boolean> {
  try {
    const json = await gzipDecompress(file);
    const payload: unknown = JSON.parse(json);
    if (!isExportPayload(payload)) return false;
    // Rejet propre d'une sauvegarde d'une autre version de forme (doc 07 §4).
    if (!isCompatible(payload.snapshot)) return false;
    const state = deserializeState(payload.snapshot);
    if (!state.started) return false;
    enterLoadedGame(state, { context: payload.context ?? null });
    return true;
  } catch {
    return false;
  }
}

interface ExportPayload {
  saveVersion: 1;
  packs: string[];
  snapshot: string;
  context?: SaveContext;
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
  const decoded = await decodeFormat(raw);
  // Une sauvegarde d'une autre version de forme est traitée comme absente
  // (doc 07 §4) : « Continuer » se grise au lieu de charger un état malformé.
  if (decoded && !isCompatible(decoded.snapshot)) return null;
  return decoded;
}

async function decodeFormat(raw: unknown): Promise<DecodedSave | null> {
  if (isSaveRecord(raw))
    return { savedAt: raw.savedAt, snapshot: await gzipDecompress(raw.data), context: raw.context ?? null };
  if (isLegacySaveRecord(raw)) return { savedAt: raw.savedAt, snapshot: raw.snapshot, context: null };
  // Très ancien format (compat) : string brute, pas d'horodatage connu.
  if (typeof raw === 'string') return { savedAt: 0, snapshot: raw, context: null };
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
