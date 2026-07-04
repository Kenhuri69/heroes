import type { GameState } from './state';

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** JSON canonique (clés triées récursivement) : deux états égaux ⇒ même texte. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value as Json));
}

function sortKeys(value: Json): Json {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    const out: { [k: string]: Json } = {};
    for (const key of Object.keys(value).sort()) out[key] = sortKeys(value[key] as Json);
    return out;
  }
  return value;
}

export function serializeState(state: GameState): string {
  return stableStringify(state);
}

export function deserializeState(snapshot: string): GameState {
  return JSON.parse(snapshot) as GameState;
}

/**
 * Empreinte FNV-1a 32 bits du JSON canonique — suffisant pour les golden
 * tests de replay et la détection de divergence de simulation (doc 07 §7).
 */
export function hashState(state: GameState): string {
  const text = serializeState(state);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
