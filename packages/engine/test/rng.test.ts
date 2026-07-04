import { describe, expect, it } from 'vitest';
import { nextU32, rollRange, seedRng } from '../src/core/rng';

describe('PCG32', () => {
  it('est déterministe : même seed ⇒ même séquence', () => {
    const a = seedRng(42);
    const b = seedRng(42);
    let sa = a;
    let sb = b;
    for (let i = 0; i < 100; i++) {
      const ra = nextU32(sa);
      const rb = nextU32(sb);
      expect(ra.value).toBe(rb.value);
      sa = ra.state;
      sb = rb.state;
    }
  });

  it('des seeds différentes divergent', () => {
    const seqA: number[] = [];
    const seqB: number[] = [];
    let sa = seedRng(1);
    let sb = seedRng(2);
    for (let i = 0; i < 10; i++) {
      const ra = nextU32(sa);
      const rb = nextU32(sb);
      seqA.push(ra.value);
      seqB.push(rb.value);
      sa = ra.state;
      sb = rb.state;
    }
    expect(seqA).not.toEqual(seqB);
  });

  it('est pur : rejouer depuis le même état redonne la même valeur', () => {
    const s = seedRng(7);
    expect(nextU32(s).value).toBe(nextU32(s).value);
    expect(nextU32(s).state).toEqual(nextU32(s).state);
  });

  it("l'état est un JSON d'entiers 32 bits non signés", () => {
    let s = seedRng(123456789);
    for (let i = 0; i < 50; i++) {
      for (const v of [s.hi, s.lo, s.incHi, s.incLo]) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(0xffffffff);
      }
      const roundtrip = JSON.parse(JSON.stringify(s)) as typeof s;
      expect(nextU32(roundtrip).value).toBe(nextU32(s).value);
      s = nextU32(s).state;
    }
  });

  it('rollRange respecte les bornes incluses', () => {
    let s = seedRng(99);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const r = rollRange(s, 1, 6);
      expect(r.value).toBeGreaterThanOrEqual(1);
      expect(r.value).toBeLessThanOrEqual(6);
      seen.add(r.value);
      s = r.state;
    }
    expect(seen.size).toBe(6); // toutes les faces sortent sur 1000 tirages
  });

  it('rollRange rejette les bornes invalides', () => {
    expect(() => rollRange(seedRng(1), 5, 2)).toThrow(RangeError);
    expect(() => rollRange(seedRng(1), 0.5, 2)).toThrow(RangeError);
  });
});
