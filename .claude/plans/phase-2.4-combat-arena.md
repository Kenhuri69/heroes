# Plan — Phase 2.4 : Arène de combat hex

Réf : doc 10 §3 (Phase 2.4) et §5.5 ; doc 02 §5 (combat), §2.2 (gardiens) ;
doc 08 §2.4 (écran combat) ; doc 05 §3.1 (`mark`). Livrée testable seule via
`/#arena`. Orchestration : lots délégués à des sous-agents Sonnet
(`.claude/prompts/lancer-phase.md`), types partagés figés d'abord.

## Décisions préalables (points non spécifiés dans les docs)

Tranchés ici ; les sémantiques de capacités et précisions de formule sont
reportées dans doc 02 dans le même lot (guidelines §8.6). Valeurs chiffrées
dans `data/core/config.json` (`combat`), jamais en dur.

1. **`flying`** : le déplacement ignore obstacles et unités (survol), portée
   = vitesse, atterrissage sur hex libre uniquement.
2. **`doubleAttack`** : deux frappes (mêlée ou tir) ; la riposte éventuelle
   s'intercale après la 1ʳᵉ frappe ; la 2ᵉ frappe n'a pas lieu si la pile
   attaquante est détruite par la riposte.
3. **`shooter(ammo, noMeleePenalty?)`** : portée illimitée, pas de pénalité de
   distance en 2.4 ; 1 munition/tir ; à 0 munitions → attaque en mêlée ;
   ennemi adjacent → mêlée à ½ dégâts sauf `noMeleePenalty`.
4. **`undead`** (catalogue 2.4 = doc 02 §5.3 seul) : moral figé à 0 (ne subit
   ni ne donne), ne compte pas dans le malus multi-faction. Les extensions
   doc 04 (immunités, −1 moral aux vivants) = Alpha.
5. **`mark`** générique sans faction : chaque attaque applique 1 charge à la
   cible (max 3, persistantes tout le combat) ; chaque charge = +8 %
   (`bonusPerStack` paramétrable) de dégâts subis depuis les piles **du même
   camp que le marqueur**.
6. **Placement initial** : attaquant colonne offset 0, défenseur colonne 11 ;
   pour n piles, rangée du slot i = `floor((i + 0,5) × 10 / n)`.
7. **Obstacles** : tirés au RNG du combat — nombre 2–5, colonnes 3..8, hexes
   distincts et libres. Pas de symétrie garantie.
8. **Moral négatif** : symétrique du positif — 4 %/point de tour sauté.
9. **Défendre** : Défense de la pile ×1,3 (arrondi bas) jusqu'à son prochain
   tour.
10. **Attendre** : rejoue en fin de round par vitesse **croissante** (HoMM),
    une seule attente par pile et par round.
11. **Riposte** : après application des pertes ; une pile détruite ne riposte
    pas ; 1 riposte/round/pile (`noRetaliation` la supprime).
12. **Formule** : §5.3 symétrique retenue — `±0,05 × (AttTotale − DéfTotale)`,
    borné [−0,70 ; +0,60]. La pente −2,5 %/pt de §1.1 concerne l'attribut
    Défense du héros (hors 2.4, pas de héros dans l'arène) ; note ajoutée en
    doc 02 §5.3.
13. **AttTotale/DéfTotale 2.4** = stats de l'unité seules (le héros s'ajoute
    au MVP).
14. **Gardiens** : pile unique `{unitId, count}` dans la carte ; fourchettes
    d'affichage (« quelques » 1–4, « plusieurs » 5–9, « groupe » 10–19,
    « troupe » 20–49, « horde » 50–99, « foule » 100–249, « légion » 250+)
    dans `config.json`, libellés côté client.
15. **Pas de héros dans l'arène 2.4** : ni sort ni attaque héroïque (doc 10 §3
    ne les liste pas) ; boutons `[Sort héros]` et fuite absents (fuite = MVP).
16. **Vitesse = portée de déplacement en hexes** (pathfinding hex, obstacles
    et unités bloquants sauf `flying`).
17. **Moral ±** : borné [−3 ; +3], chance [0 ; +3] ; terrain natif +1 vitesse
    +1 moral (natif = `nativeTerrain` du groupe de l'unité).

## Architecture (figée en cadrage, session principale)

- **Catalogue d'unités dans l'état** : `StartGame` embarque
  `unitCatalog: Record<string, CombatUnitDef>` (résolu par le client depuis
  les paquets : stats + capacités + `groupId` (id de faction, opaque pour le
  moteur) + `nativeTerrain`). Le moteur ne lit que des IDs — zéro faction.
- **Combat dans `GameState`** : `combat: CombatState | null`. Déclenchement :
  - `MoveHero` sur un gardien ⇒ le moteur ouvre le combat (interception) ;
  - commande `StartCombat` (arène `/#arena` et tests) avec deux armées.
- **Commandes** : `CombatAction` (move/attack/wait/defend de la pile active du
  joueur) + `AutoCombat` (l'IA joue le camp du joueur jusqu'à la fin). Le camp
  IA (gardien / arène B) est joué automatiquement par le moteur après chaque
  commande — le journal ne contient que les actions du joueur.
- **Fin de combat** : pertes appliquées à l'armée du héros, gardien retiré si
  vaincu, héros retiré si défaite ; événements pour l'UI.
- **Héros** : `HeroState.army: ArmyStack[]` (≤ 7) ; armée de départ dans
  `config.newGame.startingArmy` ; PM quotidiens activent `+50 × vitesse la
  plus lente` (formule complète doc 02 §1.5).

## Lots

- [x] **Cadrage (principal)** : ce plan ; types figés
      (`engine/src/combat/types.ts`, `hex.ts`, extensions `commands.ts`/
      `events.ts`/`state.ts`) ; `engine.ts` câblé vers des stubs
      `combat/index.ts` ; typecheck vert avec stubs.
- [x] **Lot A (sonnet) — règles de combat** : `engine/src/combat/`
      (placement, obstacles, vagues d'initiative, actions, riposte, dégâts
      §5.3, moral/chance, 6 capacités, fin + application des pertes) +
      `engine/test/combat-*.test.ts` (cas tabulaires de dégâts, property
      « un combat se termine toujours »). Ne touche PAS core/ ni types figés.
- [x] **Lot C (sonnet) — scène combat client** : `client/src/render/hexgrid.ts`
      (doc 10 §5.5), `client/src/scenes/combat/`, `client/src/ui/combat*.tsx`
      + `combat.css` (bandeau armées + round, surbrillances, prévisualisation
      de dégâts OBLIGATOIRE, tap-tap, vitesses ×1/×2/×4, bouton Auto).
      Rend un `CombatState` construit à la main en dev ; branchement réel en
      intégration. Ne touche pas aux fichiers existants hors imports.
      Livré : `CombatScene` (constructor(app), pas de dépendance à `Camera`,
      auto-layout centré/mis à l'échelle via `ResizeObserver` sur
      `app.canvas`) + `scenes/combat/preview.ts` (mini-store) + `ui/combat.tsx`
      réécrit + `ui/combat.css`. Tous les appels moteur (estimateDamage/
      reachableHexes/canShoot) sont encapsulés try/catch (stubs lot A
      lèvent actuellement). typecheck/lint/build verts. Pas de test live
      possible (stubs + pas de branchement main.ts) — voir écart ci-dessous.
- [ ] **Lot B (sonnet, après A) — IA + auto-combat** :
      `engine/src/combat/ai.ts` (heuristique §5.6 : score = dégâts espérés ×
      valeur cible − riposte − exposition ; tireurs kitent, lents défendent)
      + test « même seed ⇒ même résultat » répété.
- [x] **Lot D (principal, après A+C) — intégration aventure & contenu** :
      schéma map `guardian` + gardiens sur proto-01, `startingArmy`
      + `config.combat` (schémas + données), résolution du catalogue
      d'unités content→engine, interception ⇒ combat ⇒ retour carte avec
      pertes, route `/#arena`, fourchettes de force.
- [ ] **Intégration finale (principal)** : relecture des diffs, golden replay
      étendu/refigé, smoke « victoire contre le gardien » + arène, vérif
      complète (typecheck/lint/test/content:check/build/smoke), docs même lot
      (doc 02 §5.3/§5.4 précisions, CLAUDE.md), guideline §6, push, PR draft.

## Écarts assumés

- Pas de héros en combat (sorts/attaque héroïque : MVP) ; fuite : MVP ;
  reddition : post-MVP ; placement tactique : hors scope.
- Test 60 fps throttlé ×4 (doc 10 §6 « au plus tard 2.4 ») : mesure ajoutée au
  smoke arène avec seuil conservateur (≥ 25 fps) pour éviter la CI flaky ;
  seuil à durcir en 2.5.
- Terrain de combat 2.4 = terrain de la tuile du défenseur (gardien) ; arène :
  herbe par défaut.

## Écarts constatés en cours de route

- **Lot A** : bilan de pertes (`CombatEnded.casualties`) porté par une
  extension runtime privée du `CombatState` (`_losses`, non déclarée dans le
  type public figé) — vivante uniquement pendant le combat ; à promouvoir en
  champ typé si un besoin UI durable apparaît (2.5). Tour bonus de moral
  encodé via la sémantique de `acted` (pas de nouveau champ).
- **Lot A** : tirage de chance conservé dans la séquence RNG avec luck = 0
  (stabilité du golden quand la chance arrivera avec les artefacts).
- **`mark` simplifié** : +8 %/charge sur TOUS les dégâts subis par la cible
  (équivalent à « du camp du marqueur » en combat à 2 camps) — à raffiner si
  un 3ᵉ camp apparaît.
- **Smoke fluidité** : runner CI partagé + rendu logiciel (SwiftShader) ⇒
  ~10 fps mesurés sous ×4, variables avec la charge — tout seuil de perf y
  serait flaky (attrapé par la CI : 22 fps local, 10 fps runner). Le test
  logge la mesure (annotation `fps-throttled-x4`) et n'asserte qu'un plancher
  anti-gel de 5 fps ; budget 60 fps réel = mesure device en 2.5. Tap-tap DANS
  le combat non couvert par le smoke (AutoCombat le couvre indirectement) —
  dit explicitement, guideline §7.
- **Interception** : le pas d'engagement vers le gardien est payé en PM mais
  le héros reste sur sa tuile ; l'armée vide n'est pas bloquée à la
  validation de `MoveHero` (impossible avec l'armée de départ des données —
  garde-fou à ajouter avec le recrutement, MVP).

- **Lot C** : le survol souris (`hovered` de `drawBoard`) est câblé côté API
  (`render/hexgrid.ts`) mais pas encore alimenté par `CombatScene` — seul le
  tap-tap (`onTap`) pilote la sélection/prévisualisation, conformément au
  périmètre demandé au lot. Le hover souris (doc 08 §1 "hover = prévisualisation
  à la souris") reste à ajouter si voulu, hors scope du lot C tel que cadré.
- **Lot C** : `onTap` (existant, hors périmètre du lot) attache ses listeners
  à `app.stage` sans mécanisme de retrait — `CombatScene.destroy()` ne peut
  donc pas désinscrire son propre handler ; un drapeau interne `destroyed`
  neutralise les taps après destruction, mais la session principale doit
  s'assurer qu'une seule scène (aventure OU combat) est active à la fois lors
  du branchement (lot D), sans quoi les deux gestionnaires de tap coexistent
  sur le même stage.
