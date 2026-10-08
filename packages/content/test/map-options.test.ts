import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { knownArtifactIds, knownUnitIds, loadContent, loadMap, standardMapOptions, type ReadJson } from '../src/loader';
import { generateMap } from '../src/mapgen';

/**
 * Lot LE8 — options de génération partagées par le client et la CLI `map:gen`.
 * Seuls les prédicats d'illustration changent d'un environnement à l'autre : à
 * prédicats égaux, la carte est identique. Faction-agnostique (aucun id en dur).
 */
const DATA_DIR = resolve(fileURLToPath(import.meta.url), '../../../../data');
const readJsonFromDisk: ReadJson = async (path) => JSON.parse(await readFile(join(DATA_DIR, path), 'utf8')) as unknown;

describe('standardMapOptions (lot LE8)', () => {
  it('suit les prédicats d’illustration, avec repli sur toutes les unités', async () => {
    const report = await loadContent(readJsonFromDisk);
    const units = [...knownUnitIds(report)];
    const firstPack = report.content.packs[0]!;
    const onlyFirst = standardMapOptions(report, {
      hasUnitArt: (_unit, factionId) => factionId === firstPack.manifest.id,
      hasTownArt: (factionId) => factionId === firstPack.manifest.id,
    });
    expect(onlyFirst.guardianUnits).toEqual(firstPack.units.map((u) => u.id));
    expect(onlyFirst.townFactionIds).toEqual([firstPack.manifest.id]);
    // Aucune unité peinte : mieux vaut des gardiens procéduraux que pas de gardiens.
    const none = standardMapOptions(report, { hasUnitArt: () => false, hasTownArt: () => false });
    expect(none.guardianUnits).toEqual(units);
    expect(none.townFactionIds).toEqual([]);
    // Rareté de chaque artefact du catalogue (défaut 1).
    expect(Object.keys(none.artifactRarity ?? {})).toEqual(report.content.coreArtifacts.map((a) => a.id));
  });

  it('lot R3 : sanctuaires et cabanes n’enseignent jamais l’école ni la compétence d’une faction', async () => {
    const report = await loadContent(readJsonFromDisk);
    const opts = standardMapOptions(report, { hasUnitArt: () => true, hasTownArt: () => true });
    const schools = new Set(report.content.packs.flatMap((p) => (p.manifest.spellSchool ? [p.manifest.spellSchool] : [])));
    const factionSkills = new Set(report.content.packs.flatMap((p) => p.manifest.heroSkills));
    const schoolOf = new Map(report.content.coreSpells.map((sp) => [sp.id, sp.school]));
    expect(opts.shrineSpells?.length).toBeGreaterThan(0);
    for (const sp of opts.shrineSpells ?? []) {
      expect(schools.has(schoolOf.get(sp.id)!), sp.id).toBe(false);
      expect(sp.circle).toBeLessThanOrEqual(3);
    }
    expect(opts.hutSkills).toContain('wisdom'); // D-R3 : Sagesse et écoles de magie comprises
    for (const id of opts.hutSkills ?? []) expect(factionSkills.has(id), id).toBe(false);
    // Une carte générée avec ces options est valide pour le vrai `loadMap` (sorts, compétences, machines connus).
    const map = generateMap('random', 11, { ...opts, width: 64, height: 64 });
    expect(map.objects.some((o) => o.type === 'visitable' && o.effect.kind === 'grantSkill')).toBe(true);
    const readJson: ReadJson = (path) => (path === 'maps/random.map.json' ? Promise.resolve(map) : readJsonFromDisk(path));
    await expect(
      loadMap(readJson, 'random', report.content.config, knownUnitIds(report), knownArtifactIds(report)),
    ).resolves.toBeDefined();
  });

  it('à prédicats et graine égaux, deux appelants génèrent la même carte', async () => {
    const report = await loadContent(readJsonFromDisk);
    const art = { hasUnitArt: () => true, hasTownArt: () => true };
    const a = generateMap('random', 7, { ...standardMapOptions(report, art), width: 32, height: 32 });
    const b = generateMap('random', 7, { ...standardMapOptions(report, art), width: 32, height: 32 });
    expect(a).toEqual(b);
  });
});
