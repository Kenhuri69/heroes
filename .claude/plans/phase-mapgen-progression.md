# Génération de carte — variété d'objets & progression — plan vivant

Demande utilisateur : les cartes aléatoires (« Nouvelle partie ») manquent de
contenu structuré. On veut, comme sur une vraie carte HoMM, un **panel** varié —
bâtiments (habitations), ressources, monstres, artefacts, fontaines/écuries — et
une **progression** : ce qu'on trouve devient meilleur (et mieux gardé) à mesure
qu'on s'éloigne des départs. Exemple cité : « une écurie pour gagner du mouvement ».

## 1. État des lieux (vérifié dans le code)

Tous les types d'objets sont **déjà** supportés de bout en bout (moteur + schéma
`mapFileSchema` + client), et la carte écrite à la main `proto-01` les utilise
tous : `resource`, `mine`, `treasure`, `guardian` (+ `roamRadius`), `artifact`,
`dwelling`, `town`, `visitable` (`luck`/`movement`/`vision`/`levelXp`/`resource`).

Le trou est **uniquement dans `packages/content/src/mapgen.ts`** (`generateMap`,
le générateur aléatoire de « Nouvelle partie ») : il ne pose QUE des `resource`,
`mine`, `treasure`, **une seule** `visitable` (luck) et des `guardian`. Absents :
- aucun **artefact** au sol ;
- aucune **habitation** (`dwelling`) — donc aucun renfort d'armée hors ville ;
- une seule sorte de **lieu de bonus** (pas d'écurie/tour de guet/moulin/arbre) ;
- aucune **progression de récompense** liée à la profondeur (seuls les gardiens
  gradaient déjà tier/pile selon l'éloignement du départ).

⇒ Améliorer `generateMap` (contenu pur, **zéro diff moteur**, invariant §8.1
respecté). Les deux appelants (`client/app/content.ts`, `tools/src/map-gen.ts`)
passent déjà `knownArtifactIds` / `knownUnitTiers` — il suffit de leur transmettre
la palette d'artefacts.

## 2. Conception

`depthAt(x,y)` (distance au départ le plus proche ÷ rayon de l'anneau, 0→1) est
**hoisté** du bloc gardien pour piloter toute la richesse. Palette de gardiens
triée par tier (`byTier`) hoistée aussi (sert aux gardiens de champ ET aux
sentinelles).

Nouveaux objets posés par `generateMap` :
- **Lieux de bonus variés** (au lieu d'1 fontaine) : `scaled(3–5)` visitables
  tirés en rotation dans { fontaine `luck`, **écurie `movement`**, tour de guet
  `vision`, sanctuaire `levelXp`, moulin `resource` } — magnitudes calées sur
  `proto-01` (mvt 300–600, vision 4–7, luck 1, mill 1–3). Fréquence : `levelXp`
  = `oncePerHero` (un seul niveau), le reste `oncePerHeroPerWeek` (récurrent).
- **Habitations** (`dwelling`, si palette d'unités) : `scaled(1–2)`, **placées en
  profondeur** (`preferDeep`), tier de l'unité gradué par la profondeur (bas tier
  près des départs, haut tier au centre), stock initial ∝ (9 − tier).
- **Artefacts** (`artifact`, si palette d'artefacts) : `scaled(1–2)`, **en
  profondeur**, id tiré dans la palette.
- **Progression / garde** : chaque objet premium (habitation, artefact) reçoit
  une **sentinelle** (`guardian`) sur une tuile adjacente libre, force graduée par
  la profondeur → un monstre garde l'artefact, plus fort au centre.
- **Trésors** : montants `gold`/`xp` mis à l'échelle par la profondeur (jusqu'à
  ×2 au centre) → coffres plus riches loin des départs.

`preferDeep` : `freeTile` échantillonne jusqu'à 60 tuiles libres et retient la
**plus profonde** (jamais d'échec silencieux — repli sur la meilleure vue).

Nouvelle option `MapGenOptions.artifactIds` (vide ⇒ aucun artefact, comme
`guardianUnits`). Les habitations réutilisent `guardianUnits`/`unitTiers` (= les
unités connues, déjà passées par les appelants).

## 3. Étapes & vérifications

1. [x] Inventaire (ci-dessus) — trou isolé à `generateMap`.
2. [x] `mapgen.ts` : hoist `depthAt`/`byTier`, `freeTile(preferDeep)`, visitables
   variés, dwellings gradués, artefacts, sentinelles, trésors ∝ profondeur, option
   `artifactIds`.
3. [x] Appelants : `resolveGeneratedMap` (client) + `map-gen.ts` (tool) passent
   `artifactIds`.
4. [x] Tests `mapgen.test.ts` : nouveaux cas (variété de visitables, artefacts
   posés+gardés, dwellings présents) ; anciens cas (validité loadMap, déterminisme,
   grading gardiens, densité res monotone) **restent verts**.
5. [x] `pnpm -r typecheck && lint && test` verts ; golden inchangé (données hors
   replay, aucun diff moteur). Smoke : la « Nouvelle partie » charge toujours.
6. [x] Docs 02 §2.2 (note sur la génération) + plan coché, commit + push + PR draft.

## 4. Décisions & écarts

- Zéro diff moteur : tout passe par des objets déjà interprétés. Pas de bump
  `CURRENT_SAVE_VERSION` (aucune forme d'état nouvelle).
- Sentinelle = garde **adjacente** best-effort (pas d'encerclement complet : le
  moteur bloque la tuile du gardien, pas un chokepoint parfait) — suffisant pour
  matérialiser « artefact gardé » sans logique de pathfinding.
- Habitations réutilisent la palette de gardiens (= unités connues) plutôt qu'une
  option dédiée : garde les appelants inchangés, gate propre si palette vide.
