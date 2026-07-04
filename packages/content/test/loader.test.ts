import { describe, expect, it } from 'vitest';
import { loadContent, type ReadJson } from '../src/loader';

/** Fixture : arborescence data/ en mémoire, clonable et corruptible par test. */
function makeData(): Record<string, unknown> {
  return {
    'core/abilities.json': { abilities: ['flying', 'shooter', 'mark'] },
    'factions/index.json': { factions: ['proto'] },
    'factions/proto/manifest.json': {
      id: 'proto',
      schemaVersion: 1,
      name: '@loc:faction.name',
      nativeTerrain: 'plains',
      keyResources: ['crystal', 'gems'],
      factionResources: [{ id: 'essence', icon: 'icons/essence.png', cap: 999 }],
      spellSchool: null,
      tiers: 7,
      sharedGrowthGroups: { duo: ['t1-grunt', 't2-archer'] },
      units: ['t1-grunt', 't2-archer'],
      aiProfile: { aggression: 0.5, focusFire: 0.5, preferredTargets: 'nearest' },
    },
    'factions/proto/units/t1-grunt.json': {
      id: 't1-grunt',
      tier: 1,
      name: '@loc:unit.t1-grunt.name',
      stats: { hp: 6, attack: 3, defense: 2, damage: [1, 2], speed: 4 },
      growthPerWeek: 14,
      cost: { gold: 30, essence: 1 },
      abilities: [],
    },
    'factions/proto/units/t2-archer.json': {
      id: 't2-archer',
      tier: 2,
      name: '@loc:unit.t2-archer.name',
      stats: { hp: 8, attack: 5, defense: 2, damage: [2, 4], speed: 5 },
      growthPerWeek: 9,
      cost: { gold: 80 },
      abilities: [{ id: 'shooter', params: { ammo: 12 } }],
    },
    'factions/proto/locales/fr.json': {
      'faction.name': 'Prototype',
      'unit.t1-grunt.name': 'Recrue',
      'unit.t2-archer.name': 'Archère',
    },
    'factions/proto/locales/en.json': {
      'faction.name': 'Prototype',
      'unit.t1-grunt.name': 'Recruit',
      'unit.t2-archer.name': 'Archer',
    },
  };
}

function reader(data: Record<string, unknown>): ReadJson {
  return (path) => {
    if (!(path in data)) return Promise.reject(new Error(`fichier introuvable: ${path}`));
    return Promise.resolve(structuredClone(data[path]));
  };
}

describe('loadContent', () => {
  it('charge et valide un paquet complet', async () => {
    const report = await loadContent(reader(makeData()));
    expect(report.rejected).toEqual([]);
    const pack = report.content.packs[0];
    expect(pack?.manifest.id).toBe('proto');
    expect(pack?.units.map((u) => u.id)).toEqual(['t1-grunt', 't2-archer']);
    expect(pack?.locales.fr['unit.t2-archer.name']).toBe('Archère');
  });

  it('rejette une stat invalide avec le fichier et le champ en cause', async () => {
    const data = makeData();
    (data['factions/proto/units/t1-grunt.json'] as { stats: { hp: unknown } }).stats.hp = -5;
    const report = await loadContent(reader(data));
    expect(report.content.packs).toEqual([]);
    expect(report.rejected[0]?.id).toBe('proto');
    expect(report.rejected[0]?.errors.join()).toContain('units/t1-grunt.json: stats.hp');
  });

  it('rejette une capacité absente du catalogue', async () => {
    const data = makeData();
    (data['factions/proto/units/t2-archer.json'] as { abilities: unknown[] }).abilities = [
      { id: 'demonform' },
    ];
    const report = await loadContent(reader(data));
    expect(report.rejected[0]?.errors.join()).toContain("capacité inconnue au catalogue 'demonform'");
  });

  it('rejette une clé de locale manquante (dans la langue fautive uniquement)', async () => {
    const data = makeData();
    delete (data['factions/proto/locales/en.json'] as Record<string, string>)[
      'unit.t1-grunt.name'
    ];
    const report = await loadContent(reader(data));
    const errors = report.rejected[0]?.errors ?? [];
    expect(errors).toContain("locales/en.json: clé manquante 'unit.t1-grunt.name'");
    expect(errors.join()).not.toContain('locales/fr.json');
  });

  it('rejette coût en ressource inconnue, tier hors manifeste et groupe orphelin', async () => {
    const data = makeData();
    (data['factions/proto/units/t1-grunt.json'] as { cost: object }).cost = { gold: 30, vapeur: 2 };
    (data['factions/proto/units/t2-archer.json'] as { tier: number }).tier = 8;
    (data['factions/proto/manifest.json'] as { sharedGrowthGroups: object }).sharedGrowthGroups = {
      apex: ['t7-titan', 't1-grunt'],
    };
    const report = await loadContent(reader(data));
    const all = (report.rejected[0]?.errors ?? []).join('\n');
    expect(all).toContain("ressource de coût inconnue 'vapeur'");
    expect(all).toContain('tier 8 > tiers du manifeste (7)');
    expect(all).toContain("sharedGrowthGroups.apex référence l'unité inconnue 't7-titan'");
  });

  it('un fichier manquant rejette le paquet sans crasher le chargement', async () => {
    const data = makeData();
    delete data['factions/proto/units/t2-archer.json'];
    const report = await loadContent(reader(data));
    expect(report.rejected[0]?.errors.join()).toContain('fichier introuvable');
  });

  it('un paquet invalide n’empêche pas les autres de charger', async () => {
    const data = makeData();
    (data['factions/index.json'] as { factions: string[] }).factions = ['ghost', 'proto'];
    const report = await loadContent(reader(data));
    expect(report.rejected.map((r) => r.id)).toEqual(['ghost']);
    expect(report.content.packs.map((p) => p.manifest.id)).toEqual(['proto']);
  });

  it('refuse les points d’extension non câblés (abilityModules/hooks non vides)', async () => {
    const data = makeData();
    (data['factions/proto/manifest.json'] as { abilityModules?: string[] }).abilityModules = [
      'abilities/demonform',
    ];
    const report = await loadContent(reader(data));
    expect(report.rejected[0]?.errors.join()).toContain('abilityModules');
  });
});
