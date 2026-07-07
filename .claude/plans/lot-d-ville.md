# Lot D-ville — décisions design ville (D3, D4, D9)

Sous-lot de `code-doc-coherence-remediation.md` (Lot D). Trois écarts
code↔doc sur le town building, corrigés **côté code/données** (l'arbitrage
des trois retient la fidélité HoMM / la doc comme vérité).

## Portée

- **D3** — Stock de base orphelin après upgrade du dwelling niveau 2.
- **D4** — « un seul Capitole par joueur » (doc 02 §4.1) non appliqué.
- **D9** — Tableau des Contrats gaté par `townHall` au lieu de `tavern`
  (doc 05 §3.3), alors que la Taverne n'était même pas dans la ville AH.

## Étapes & vérification

1. **D3** — `town/helpers.ts` : `unitIsRecruitable` et `builtDwellings`
   itèrent TOUS les niveaux bâtis d'un dwelling gradué (base niv 1 +
   améliorée niv 2), au lieu du seul niveau courant.
   → vérif : `town-upgrade.test.ts` « au niveau 2 » — `builtDwellings` =
   `['red-grunt', ELITE]`, base toujours recrutable après upgrade. ✅
2. **D4** — flag générique `uniquePerPlayer` (data-driven) :
   - `town/types.ts` : `BuildingLevel.uniquePerPlayer?: boolean | undefined`
     (le `| undefined` requis par `exactOptionalPropertyTypes`).
   - `content/schemas.ts` : `buildingLevelSchema` gagne le champ optionnel.
   - `data/core/buildings.json` : townHall niveau 4 (Capitole) le porte.
   - `town/build.ts` : après le check exclusiveGroup, rejet (code
     `uniquePerPlayer`) si une AUTRE ville du joueur porte déjà ce niveau.
   - `core/commands.ts` : `uniquePerPlayer` ajouté à l'union `CommandError.code`.
   → vérif : `town-build.test.ts` — 2 villes p1, Capitole en ville-1 ⇒
   validate en ville-2 renvoie `uniquePerPlayer`. Le moteur ignore le nom du
   bâtiment (garde-fou faction intact). ✅
3. **D9** — la Taverne précède le Tableau des Contrats :
   - `arcane-hunters/manifest.json` : `tavern` ajoutée à `town.buildings`.
   - `arcane-hunters/buildings.json` : contrat `requires` `tavern@1` (au lieu
     de `townHall@1`).
   → vérif : test contenu `arcane-hunters-mark.test.ts` (repérage du contrat
   par son EFFET `huntContract`, jamais par un id de faction) + smoke
   `contrat de chasse` ajusté (bâtir la taverne j1, le contrat j2 — une
   construction/jour). ✅

## Invariants (rappel guidelines §7/§8)

- Golden replay **inchangé** (`48c3a5e5`) — aucune règle de simulation
  déterministe touchée.
- Garde-fou « zéro faction dans le moteur/tests » vert (D9 repéré par effet).
- typecheck 5/5, `pnpm lint` clean, engine + content verts, content:check OK,
  color-token guard OK, build < 800 Ko gzip (260 Ko), smoke desktop + mobile.

## État : livré. PR à ouvrir en draft puis passer ready ; merge sur CI verte.
