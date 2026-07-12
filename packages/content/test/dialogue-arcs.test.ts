import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadContent, loadScenarios, type ReadJson } from '../src/loader';

/**
 * Arcs personnels de campagne (doc 13 §5.4, N-ARCS.1-5 + N3c.2).
 *
 * La MÉCANIQUE « un choix de dialogue pose un drapeau persistant » vit côté
 * client (app/narrative.ts) et reste couverte par le smoke ; mais la DONNÉE de
 * chaque arc — l'existence d'un nœud de choix binaire posant les deux drapeaux
 * attendus — se valide ici en contenu, à coût ~ms. Le smoke ne rejoue donc plus
 * que 2 arcs représentatifs (parcours UI simple + chaîné) au lieu de 6
 * (plan test-performance-optimization §9, axes F/G).
 */
const DATA_DIR = resolve(fileURLToPath(import.meta.url), '../../../../data');
const readJsonFromDisk: ReadJson = async (path) =>
  JSON.parse(await readFile(join(DATA_DIR, path), 'utf8')) as unknown;

const ARCS = [
  { scenario: 'haven-ch2', flags: ['aldric-merciful', 'aldric-ruthless'] },
  { scenario: 'haven-ch3', flags: ['seraphine-faith', 'seraphine-doubt'] },
  { scenario: 'necropolis-ch2', flags: ['vhalen-repair', 'vhalen-feed'] },
  { scenario: 'necropolis-ch2', flags: ['corbeau-pact', 'corbeau-refuse'] },
  { scenario: 'arcane-ch2', flags: ['evadne-embrace', 'evadne-sever'] },
  { scenario: 'arcane-ch2', flags: ['marchmont-reveal', 'marchmont-protect'] },
] as const;

describe('arcs de dialogue de campagne (data/scenarios/)', () => {
  it('chaque arc expose un nœud de choix binaire posant ses deux drapeaux', async () => {
    const report = await loadContent(readJsonFromDisk);
    const { content } = await loadScenarios(readJsonFromDisk, report);

    for (const arc of ARCS) {
      const scenario = content.scenarios.find((s) => s.id === arc.scenario);
      expect(scenario, `scénario ${arc.scenario} chargé`).toBeDefined();

      const node = (scenario!.dialogs ?? []).find(
        (d) =>
          d.choices?.length === 2 &&
          arc.flags.every((flag) => d.choices!.some((c) => c.setFlag === flag)),
      );
      expect(node, `${arc.scenario}: nœud de choix ${arc.flags.join(' / ')}`).toBeDefined();
    }
  });

  it('aucun drapeau d’arc n’est réutilisé par deux choix différents', async () => {
    const report = await loadContent(readJsonFromDisk);
    const { content } = await loadScenarios(readJsonFromDisk, report);

    const seen = new Set<string>();
    for (const arc of ARCS) {
      for (const flag of arc.flags) {
        expect(seen.has(flag), `drapeau ${flag} unique`).toBe(false);
        seen.add(flag);
      }
    }
    // Et chaque drapeau attendu existe bien dans les données chargées.
    const allFlags = new Set(
      content.scenarios.flatMap((s) => (s.dialogs ?? []).flatMap((d) => d.choices ?? [])).flatMap((c) => (c.setFlag ? [c.setFlag] : [])),
    );
    for (const arc of ARCS) {
      for (const flag of arc.flags) expect(allFlags.has(flag), `drapeau ${flag} présent`).toBe(true);
    }
  });
});
