# Lot M-VISIT — lieu visitable `grantArtifact`

## Objectif
Ouvrir un nouveau `VisitableEffect` **générique** `grantArtifact { artifactId }` :
un lieu visitable (classique HoMM « Chariot »/« Dépouille »/« Coffre marin »)
donne un artefact précis au héros visiteur. Réutilise le routage de ramassage au
sol (`hero.artifacts` 1er slot libre, sinon `hero.backpack`) — donc **zéro champ
d'état neuf ⇒ pas de bump save, golden inchangé** (le golden-replay n'a aucun
visitable). Patron identique aux 6 kinds `VisitableEffect` déjà livrés.

## Invariants
- Zéro nom de faction dans le moteur/tests (ids opaques dans les tests).
- `artifactId` cross-validé au chargement contre `core/artifacts.json`.
- Déterministe, aucun RNG.

## Étapes & vérifs
1. **Moteur** `adventure/map.ts` : ajouter la variante `{ kind: 'grantArtifact';
   artifactId: string }` à `VisitableEffect`. → verify: typecheck.
2. **Moteur** `adventure/visitable.ts` : brancher le `kind` dans `visitBonus` —
   même routage que le ramassage au sol (1er slot `null` de `hero.artifacts`,
   sinon `hero.backpack.push`). `amount = 1` (toujours placé, sac non borné).
   → verify: test.
3. **Content** `schemas.ts` : variante Zod `grantArtifact` (artifactId idSchema).
   `loader.ts` : ajouter la variante à la union `ResolvedMapObject.effect` +
   cross-validation `artifactId ∈ knownArtifactIds` dans la validation de carte.
   → verify: content test + content:check.
4. **Client** : `MapObjectCard` (ligne d'effet), `notifications` (toast, `amount>0`),
   `render/mapObjects` (teinte + silhouette coffre) + locales FR/EN. → verify: build.
5. **Données** proto-01 : visitable `depouille-1` (11,7) → `lame-aiguisee`,
   `oncePerHero`. → verify: content:check.
6. **Doc** 02 §2.2 : ajouter `grantArtifact` à la liste des lieux de bonus.
7. **Test** `map-visitables.test.ts` : le lieu donne l'artefact (slot libre),
   déborde vers le sac si les 10 slots pleins, visite consommée à vie.

## Pipeline complet (avant push)
typecheck 5/5 · lint · vitest engine (golden + save-shape INCHANGÉS) · vitest
content · content:check · garde-fou faction (==1) · garde-fou couleur (==1) ·
build · bundle < 819200 · smoke. Pas de faction:sim (aucun équilibrage faction).

## Journal
- plan créé, branche `claude/m-visit-artifact` depuis origin/main.
- implémenté (moteur + content + client + données proto-01 `depouille-1` +
  doc 02 §2.2 + 2 tests). Pipeline local vert : typecheck 5/5, lint, vitest
  engine **735** (golden + save-shape INCHANGÉS, +2 `map-visitables`), vitest
  content 126, content:check (6 paquets/2 cartes/13 scénarios), garde-fou
  faction ==1, garde-fou couleur ==1, build OK, bundle **313 022** octets
  (< 819 200). Pas de faction:sim (aucun équilibrage faction). Smoke **101/101**.
- **Livré.** Pipeline complet vert.
