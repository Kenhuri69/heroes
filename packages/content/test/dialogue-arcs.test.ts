import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadContent, loadScenarios, type ReadJson } from '../src/loader';

/**
 * Arcs personnels de campagne (doc 13 §5.4, N-ARCS.1-5 + N3c.2).
 *
 * La MÉCANIQUE « un choix de dialogue pose un drapeau persistant » vit côté
 * client (app/narrative.ts) et reste couverte par le smoke (2 parcours UI
 * représentatifs) ; la DONNÉE des arcs se valide ici en contenu, à coût ~ms —
 * ce qui permet au smoke de ne plus rejouer les 6 arcs (plan
 * test-performance-optimization §9, axes F/G).
 *
 * Invariants FACTION-AGNOSTIQUES (aucun ID de faction/scénario en dur : le
 * garde-fou modularité de la CI grepe `packages/`, doc 06 / README §1) : on
 * charge tous les scénarios et on vérifie l'intégrité de leurs nœuds de choix.
 */
const DATA_DIR = resolve(fileURLToPath(import.meta.url), '../../../../data');
const readJsonFromDisk: ReadJson = async (path) =>
  JSON.parse(await readFile(join(DATA_DIR, path), 'utf8')) as unknown;

async function loadDialogNodes() {
  const report = await loadContent(readJsonFromDisk);
  const { content } = await loadScenarios(readJsonFromDisk, report);
  return content.scenarios.flatMap((s) => s.dialogs ?? []);
}

describe('arcs de dialogue de campagne (data/scenarios/)', () => {
  it('tout drapeau de choix est unique dans le corpus (pas de collision d’arc)', async () => {
    const nodes = await loadDialogNodes();
    const flags = nodes.flatMap((d) => (d.choices ?? []).flatMap((c) => (c.setFlag ? [c.setFlag] : [])));

    expect(flags.length).toBeGreaterThan(0); // des arcs à choix existent
    const dupes = flags.filter((f, i) => flags.indexOf(f) !== i);
    expect(dupes, `drapeaux dupliqués : ${[...new Set(dupes)].join(', ')}`).toEqual([]);
  });

  it('chaque nœud à choix est une décision complète (toutes les options posent un drapeau distinct)', async () => {
    const nodes = await loadDialogNodes();
    const choiceNodes = nodes.filter((d) => (d.choices?.length ?? 0) > 0);

    // Au moins les nœuds de décision binaires des arcs personnels livrés.
    const binaryDecisions = choiceNodes.filter(
      (d) => d.choices!.length === 2 && d.choices!.every((c) => !!c.setFlag),
    );
    expect(binaryDecisions.length).toBeGreaterThanOrEqual(6);

    for (const node of binaryDecisions) {
      const flags = node.choices!.map((c) => c.setFlag);
      expect(new Set(flags).size, `nœud ${node.id} : drapeaux distincts`).toBe(flags.length);
    }
  });
});
