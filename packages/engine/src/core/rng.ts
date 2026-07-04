/**
 * PCG32 (O'Neill) — RNG seedé du moteur (doc 07 §3).
 * Fonctions pures : l'état vit dans `GameState`, exposé en 4 entiers 32 bits
 * non signés (JSON-sérialisable). Arithmétique 64 bits via BigInt en interne.
 */

export interface RngState {
  hi: number;
  lo: number;
  incHi: number;
  incLo: number;
}

const MULT = 6364136223846793005n;
const MASK64 = (1n << 64n) - 1n;
const DEFAULT_SEQ = 54n; // flux par défaut (constante de la référence PCG)

function toBig(hi: number, lo: number): bigint {
  return (BigInt(hi >>> 0) << 32n) | BigInt(lo >>> 0);
}

function split(v: bigint): { hi: number; lo: number } {
  return { hi: Number((v >> 32n) & 0xffffffffn), lo: Number(v & 0xffffffffn) };
}

function step(state: bigint, inc: bigint): bigint {
  return (state * MULT + inc) & MASK64;
}

function output(oldState: bigint): number {
  const xorshifted = Number((((oldState >> 18n) ^ oldState) >> 27n) & 0xffffffffn);
  const rot = Number(oldState >> 59n);
  return ((xorshifted >>> rot) | (xorshifted << (-rot & 31))) >>> 0;
}

/** Initialisation de référence PCG : state=0 ; step ; state+=seed ; step. */
export function seedRng(seed: number, seq: bigint = DEFAULT_SEQ): RngState {
  const inc = ((seq << 1n) | 1n) & MASK64;
  let state = step(0n, inc);
  state = (state + (BigInt(Math.trunc(seed)) & MASK64)) & MASK64;
  state = step(state, inc);
  const s = split(state);
  const i = split(inc);
  return { hi: s.hi, lo: s.lo, incHi: i.hi, incLo: i.lo };
}

/** Entier uniforme sur [0, 2^32). */
export function nextU32(s: RngState): { value: number; state: RngState } {
  const oldState = toBig(s.hi, s.lo);
  const inc = toBig(s.incHi, s.incLo);
  const next = split(step(oldState, inc));
  return {
    value: output(oldState),
    state: { hi: next.hi, lo: next.lo, incHi: s.incHi, incLo: s.incLo },
  };
}

/**
 * Entier uniforme sur [min, max] (bornes incluses), par modulo simple :
 * le biais est < range/2^32, négligeable pour des tirages de gameplay.
 */
export function rollRange(
  s: RngState,
  min: number,
  max: number,
): { value: number; state: RngState } {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new RangeError(`rollRange: bornes invalides [${min}, ${max}]`);
  }
  const { value, state } = nextU32(s);
  return { value: min + (value % (max - min + 1)), state };
}
