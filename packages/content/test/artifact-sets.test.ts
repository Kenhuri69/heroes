import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadContent, type ReadJson } from '../src/loader';
import { artifactIdForDepth } from '../src/mapgen';

/**
 * Lot 3.2 (doc 18 C2) — panoplies d'artefacts + rareté graduée. Invariants
 * GÉNÉRIQUES sur le catalogue réellement chargé (aucun id littéral obligatoire
 * pour la cohérence des sets — garde-fou de modularité) + unitaire du tirage
 * gradué par la profondeur.
 */
const DATA_DIR = resolve(fileURLToPath(import.meta.url), '../../../../data');

const readJsonFromDisk: ReadJson = async (path) => {
  const text = await readFile(join(DATA_DIR, path), 'utf8');
  return JSON.parse(text) as unknown;
};

describe('panoplies — invariants de catalogue', () => {
  it('chaque panoplie est COMPLÉTABLE : ≥ pieces membres, descripteurs identiques, slots équipables', async () => {
    const { content } = await loadContent(readJsonFromDisk);
    const sets = new Map<string, { pieces: number; bonus: unknown; members: { id: string; slot?: string }[] }>();
    for (const a of content.coreArtifacts) {
      if (!a.set) continue;
      const entry = sets.get(a.set.id);
      if (entry) {
        // Tous les membres portent le MÊME descripteur (doc 02 §1.1).
        expect(a.set.pieces).toBe(entry.pieces);
        expect(a.set.bonus).toEqual(entry.bonus);
        entry.members.push({ id: a.id, ...(a.slot ? { slot: a.slot } : {}) });
      } else {
        sets.set(a.set.id, {
          pieces: a.set.pieces,
          bonus: a.set.bonus,
          members: [{ id: a.id, ...(a.slot ? { slot: a.slot } : {}) }],
        });
      }
    }
    expect(sets.size).toBeGreaterThanOrEqual(3); // une par style (doc 18 C2)
    for (const [setId, { pieces, members }] of sets) {
      // Complétable : assez de membres…
      expect(members.length, `panoplie '${setId}'`).toBeGreaterThanOrEqual(pieces);
      // …ET tous équipables SIMULTANÉMENT (poupée : un artefact par slot typé —
      // deux membres sur le même slot rendraient le seuil inatteignable).
      const slots = members.map((m) => m.slot ?? `bag-${m.id}`);
      expect(new Set(slots).size, `slots de '${setId}'`).toBe(slots.length);
    }
  });

  it('la rareté (si présente) est dans les bornes 1–3', async () => {
    const { content } = await loadContent(readJsonFromDisk);
    for (const a of content.coreArtifacts) {
      if (a.rarity !== undefined) {
        expect(a.rarity).toBeGreaterThanOrEqual(1);
        expect(a.rarity).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe('artifactIdForDepth — tirage gradué par la profondeur (pur)', () => {
  const sorted = ['commun-a', 'commun-b', 'moyen', 'rare'];

  it('profondeur 0 ⇒ le plus commun ; profondeur 1 ⇒ le plus rare', () => {
    expect(artifactIdForDepth(sorted, 0, 0)).toBe('commun-a');
    expect(artifactIdForDepth(sorted, 1, 0)).toBe('rare');
  });

  it('le jitter reste borné aux extrémités de la palette', () => {
    expect(artifactIdForDepth(sorted, 0, -1)).toBe('commun-a');
    expect(artifactIdForDepth(sorted, 1, 1)).toBe('rare');
    expect(artifactIdForDepth(sorted, 0.5, 1)).toBe('rare');
    expect(artifactIdForDepth(['seul'], 0.7, -1)).toBe('seul');
  });
});
