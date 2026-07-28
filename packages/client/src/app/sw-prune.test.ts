import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Élagage du cache du service worker (R7/P3, doc 07 §6) — la décision d'éviction
 * vit dans `data/sw-prune.js`, script CLASSIQUE chargé par `importScripts` depuis
 * `data/sw.js` (hors bundle, servi tel quel). On l'évalue ici avec un `self`
 * factice : le SW reste un script classique, et la fonction pure est testable
 * sans navigateur (niveau *unitaire client*, cf. skill `test-authoring`).
 */
type Select = (sizes: number[], maxEntries: number, maxBytes: number) => number;

const scope = {} as { selectAssetEvictions: Select };
const src = readFileSync(
  fileURLToPath(new URL('../../../../data/sw-prune.js', import.meta.url)),
  'utf8',
);
new Function('self', src)(scope);
const selectAssetEvictions = scope.selectAssetEvictions;

const MB = 1024 * 1024;
const MAX_ENTRIES = 300;
const MAX_BYTES = 50 * MB; // même budget que `data/sw.js`

describe('selectAssetEvictions', () => {
  it('sous les deux plafonds : rien à évincer', () => {
    const sizes = new Array(150).fill(100_000); // 150 entrées, ~14 Mio
    expect(selectAssetEvictions(sizes, MAX_ENTRIES, MAX_BYTES)).toBe(0);
  });

  it('plafond d’ENTRÉES seul : n’évince que l’excédent (comportement historique)', () => {
    const sizes = new Array(MAX_ENTRIES + 1).fill(1000);
    expect(selectAssetEvictions(sizes, MAX_ENTRIES, MAX_BYTES)).toBe(1);
    const sizes2 = new Array(MAX_ENTRIES + 42).fill(1000);
    expect(selectAssetEvictions(sizes2, MAX_ENTRIES, MAX_BYTES)).toBe(42);
  });

  it('plafond d’OCTETS seul : évince jusqu’à retomber sous le budget', () => {
    // 10 entrées de 8 Mio = 80 Mio, très loin du plafond d'entrées : sans budget
    // en octets (le défaut d'avant R7) rien n'était évincé. Il faut en retirer 4
    // pour repasser à 48 Mio ≤ 50 Mio.
    const sizes = new Array(10).fill(8 * MB);
    expect(selectAssetEvictions(sizes, MAX_ENTRIES, MAX_BYTES)).toBe(4);
  });

  it('les deux plafonds se cumulent', () => {
    // 302 entrées : 2 évincées par le plafond d'entrées, ce qui laisse 300 ×
    // 400 Ko = 117 Mio > 50 Mio ⇒ l'élagage continue en octets.
    const sizes = new Array(302).fill(400 * 1024);
    const drop = selectAssetEvictions(sizes, MAX_ENTRIES, MAX_BYTES);
    expect(drop).toBeGreaterThan(2);
    const kept = sizes.slice(drop).reduce((s, n) => s + n, 0);
    expect(kept).toBeLessThanOrEqual(MAX_BYTES);
  });

  it('éviction par ORDRE D’INSERTION : les plus anciennes d’abord', () => {
    // 60 Mio en tête de file : évincer LA PLUS ANCIENNE (20 Mio) suffit à
    // repasser sous le budget — les récentes ne sont jamais touchées.
    const sizes = [20 * MB, 20 * MB, 20 * MB, 1000, 1000];
    expect(selectAssetEvictions(sizes, MAX_ENTRIES, MAX_BYTES)).toBe(1);
    const kept = sizes.slice(1).reduce((s, n) => s + n, 0);
    expect(kept).toBeLessThanOrEqual(MAX_BYTES);
  });

  it('jamais plus d’évictions que d’entrées (entrée unique surdimensionnée)', () => {
    expect(selectAssetEvictions([80 * MB], MAX_ENTRIES, MAX_BYTES)).toBe(1);
    expect(selectAssetEvictions([], MAX_ENTRIES, MAX_BYTES)).toBe(0);
  });

  it('taille inconnue (en-tête absent ⇒ 0 o) : borne best-effort, pas de panique', () => {
    const sizes = new Array(100).fill(0);
    expect(selectAssetEvictions(sizes, MAX_ENTRIES, MAX_BYTES)).toBe(0);
  });
});
