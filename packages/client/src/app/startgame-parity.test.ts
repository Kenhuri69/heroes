import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Parité des builders `StartGame` (revue 2026-08).
 *
 * Le bug trouvé en revue : `newGameStartCommand` — le chemin « Nouvelle partie »,
 * le plus emprunté — était le SEUL des builders à oublier `houseCatalog`, ce qui
 * tuait silencieusement la signature Vox Arcana (« Le Choixpeau » stampait la
 * Maison mais résolvait ses effets à `[]`), et irréversiblement.
 *
 * Un test qui vérifierait juste `houseCatalog` ne couvrirait que CE champ. On
 * garde donc l'invariant GÉNÉRIQUE : **tous les builders embarquent les mêmes
 * CATALOGUES**. Tout futur catalogue oublié par un chemin est détecté, quel qu'il
 * soit. (Les champs de scénario/quêtes, eux, varient légitimement d'un chemin à
 * l'autre — le builder générique n'en a pas ; ils sont donc hors invariant.)
 *
 * Contrôle au niveau de la SOURCE (même esprit que les garde-fous CI « zéro id de
 * faction dans packages/ » / « zéro couleur hors tokens.css ») : construire les 4
 * commandes exigerait un `LoadReport` complet et une carte générée — hors de
 * proportion pour cet invariant.
 */
const SOURCE = join(dirname(fileURLToPath(import.meta.url)), 'game.ts');

/** Clés de premier niveau de l'objet littéral qui commence à `open`. */
function literalKeys(src: string, open: number): string[] {
  const keys: string[] = [];
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i]!;
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') {
      depth--;
      if (depth === 0) break;
    } else if (depth === 1) {
      // `clé:` ou raccourci `clé,` en début de ligne — jamais dans une valeur
      // imbriquée (depth > 1) ni dans une chaîne (les clés sont des identifiants).
      const rest = src.slice(i);
      const m = /^\n\s{4}(?:\.\.\.\()?([A-Za-z_$][\w$]*)\s*[:,]/.exec(rest);
      if (m?.[1]) keys.push(m[1]);
    }
  }
  return keys;
}

describe('builders StartGame', () => {
  it('embarquent tous exactement les mêmes catalogues (aucun oubli silencieux)', async () => {
    const src = await readFile(SOURCE, 'utf8');
    const builders: string[][] = [];
    for (let i = src.indexOf("type: 'StartGame'"); i !== -1; i = src.indexOf("type: 'StartGame'", i + 1)) {
      const open = src.lastIndexOf('{', i);
      builders.push(literalKeys(src, open).sort());
    }
    // Catalogues embarqués : leur oubli ne casse RIEN visiblement (l'état prend
    // `{}` par défaut) — c'est exactement la classe de bug à verrouiller.
    const CATALOG = /Catalog$|^heroRoster$|^growthGroups$|^startingArtifacts$/;
    const catalogs = builders.map((keys) => keys.filter((k) => CATALOG.test(k)));
    // Non-vacuité : un test dérivé de la source passe « vert » pour de mauvaises
    // raisons si le motif ne matche plus (renommage, refactor).
    expect(builders.length).toBeGreaterThanOrEqual(3);
    expect(catalogs[0]!.length).toBeGreaterThanOrEqual(8);
    for (const keys of catalogs) expect(keys).toEqual(catalogs[0]);
  });
});
