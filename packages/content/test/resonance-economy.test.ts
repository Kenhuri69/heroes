import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadContent, type ReadJson } from '../src/loader';

/**
 * Vox Arcana — Résonance (plan phase-16 lot 16.4, doc 16 §3.2). La Résonance
 * réutilise l'acquis Essence : ressource de faction (`factionResources`) +
 * `gainFactionResourceOnVictory` (déjà au moteur depuis 4.4/4.6) — donc **pur
 * contenu**, zéro diff moteur. Le paquet est identifié par sa PROPRIÉTÉ
 * signature (déclare des Maisons ET une ressource de faction), jamais par son
 * id littéral — garde-fou de modularité (ci.yml).
 */
const DATA_DIR = resolve(fileURLToPath(import.meta.url), '../../../../data');

const readJsonFromDisk: ReadJson = async (path) => {
  const text = await readFile(join(DATA_DIR, path), 'utf8');
  return JSON.parse(text) as unknown;
};

describe('Résonance — ressource de faction de l\'académie', () => {
  it('gagne la ressource sur victoire et gate le T8 par cette ressource', async () => {
    const report = await loadContent(readJsonFromDisk);
    expect(report.rejected).toEqual([]);

    // Signature : la faction académie déclare des Maisons ET une ressource de
    // faction (Résonance) — sans la nommer.
    const pack = report.content.packs.find(
      (p) => p.manifest.houses.length > 0 && p.manifest.factionResources.length > 0,
    );
    if (!pack) throw new Error('faction signature (Maisons + ressource) absente');

    // La ressource est déclarée avec une capacité et une icône.
    const resource = pack.manifest.factionResources[0]!;
    expect(resource.cap).toBeGreaterThan(0);
    expect(resource.icon).toBeTruthy();

    // Nom localisé fr/en présent pour la ressource.
    expect(pack.locales.fr[`factionResource.${resource.id}`]).toBeTruthy();
    expect(pack.locales.en[`factionResource.${resource.id}`]).toBeTruthy();

    // On la gagne à la victoire (bonus générique déjà interprété par le moteur).
    const gain = pack.manifest.factionBonuses.find(
      (b) => b.type === 'gainFactionResourceOnVictory' && b.resource === resource.id,
    );
    expect(gain).toBeDefined();

    // Le T8 est gaté : son coût de recrutement inclut la ressource de faction.
    const t8 = pack.units.find((u) => u.tier === 8);
    if (!t8) throw new Error('unité T8 absente du lineup');
    expect((t8.cost as Record<string, number>)[resource.id]).toBeGreaterThan(0);
  });
});
