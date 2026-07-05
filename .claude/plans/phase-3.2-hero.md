# Plan — Phase 3.2 : Héros (compétences, sorts & artefacts)

Réf : doc 11 §Phase 3.2 ; doc 02 §1.1–§1.4, §5 ; doc 06 §2–§4 ; doc 08
§2.3–§2.4. Orchestration : lots Sonnet, surfaces figées au cadrage. Dépend de
3.1 (Guilde des mages, déjà en données). Cible d'expressivité : Lumière
(Haven, 3.3) et Nécromancie/Prime (Necropolis, 3.4) ajoutables **en données**.

## Périmètre resserré (premier incrément jouable)

Livrer : **le héros lance un sort en combat** (dégâts + soin/buff), **ses
attributs Attaque/Défense agissent enfin** sur les dégâts, il **gagne des
compétences** à la montée de niveau, et **porte des artefacts** à bonus. Les
schémas `spell`/`skill`/`artifact` sont assez expressifs pour les factions.

## Décisions préalables (points non spécifiés)

1. **Mana** : `HeroState.mana` + `manaMax = knowledge × 10` (doc 02 §1.1).
   Rempli à `manaMax` à l'ouverture du combat ; régénération d'aventure
   (Cloître/Puits) = 3.3/3.4. `saveVersion` reste 1 (pas d'anciennes saves).
2. **Action héros en combat** : commande `CastSpell { spellId, targetStackId }`,
   **1 sort/round** (doc 02 §5.2). Le héros n'est pas dans l'initiative :
   `CastSpell` est jouable quand c'est le tour du camp joueur (une pile de
   `playerSide` est active) et que `heroCastThisRound` est faux ; résolu
   immédiatement, `heroCastThisRound` remis à faux au début de chaque round.
   `CombatState` gagne `attackerHeroId`/`defenderHeroId` (nullable) +
   `heroCastThisRound`. L'IA ne lance pas de sort en 3.2 (post-incrément).
3. **Formule de dégâts de sort** : `round((base + perPower × Pouvoir) ×
   (1 − magicResistance) × (lucky ? 2 : 1))` — hors du plafond ±60/−70 %
   (réservé attaque/défense d'armée). `base`/`perPower`/`school`/`circle`/
   `manaCost`/`kind` (`damage`|`heal`|`buff`|`debuff`) dans les données du sort.
   Soin : rend des PV (ressuscite des créatures entières + PV entamés).
   Buff/debuff : effet temporaire `Pouvoir` rounds (min 1) sur une pile —
   modélisé comme statut `{ attackMod?, defenseMod?, speedMod?, roundsLeft }`.
   Estimation SANS RNG (`estimateSpell`) pour la prévisualisation obligatoire.
4. **Attribut héros branché en combat** (dette doc 02 §5.3) : dans
   `computeMultiplier`, l'attaque effective = `unit.attack + heroAttack(camp
   attaquant)`, la défense effective = `unit.defense + heroDefense(camp cible)`.
   `luck` réactivé : `luck = hero.luckBonus` (compétence Chance + artefacts),
   borné [0,3]. Le moral du héros (Commandement) s'ajoute au moral de pile.
5. **Compétences** : `HeroState.skills: Record<skillId, 1|2|3>` (rang). Les 12
   compétences sont **des données** (`data/core/skills.json`) à effets
   déclaratifs ; le moteur applique les effets aux points existants :
   - `movementBonus%` → PM quotidiens (Logistique) ;
   - `visionBonus` → rayon de vision (Recherche) ;
   - `goldPerDay` → revenu (Économie) ;
   - `meleeDamage%`/`rangedDamage%`/`armorReduction%` → multiplicateur combat ;
   - `luckBonus`/`moraleBonus` → combat (Chance/Commandement) ;
   - `spellCircleUnlock`/`manaCostReduction%` (Magie par école) ;
   - `learnCircle` (Sagesse).
   Effets appliqués selon le rang (tableaux Novice/Expert/Maître en données).
6. **Choix de compétence à la montée de niveau** (doc 02 §1.2) : au
   `HeroLevelUp`, en plus du +1 attribut, le moteur tire **2 propositions**
   (compétence nouvelle ou +1 rang, RNG de l'état) dans `HeroState.
   pendingSkillChoices`. Commande `ChooseSkill { heroId, skillId }` applique
   le choix. Si le héros a déjà 6 compétences, les propositions se limitent à
   des montées. Cap rang 3, 6 slots (doc 02 §1.3).
7. **Sorts appris** : `HeroState.spells: string[]` (ids connus). En 3.2, le
   héros **connaît d'emblée** les sorts que sa Guilde des mages (niveau) et
   ses compétences (Sagesse/Magie) autorisent — apprentissage à la visite de
   ville = raffinement ultérieur. Gating : un sort est lançable si `circle ≤
   mageGuildLevel de la ville de départ` (ou appris) ET mana suffisant.
   Décision simple 3.2 : le héros connaît tous les sorts de cercle ≤ 3 (Guilde
   MVP) ; Sagesse/Magie ouvrent 4/5 (hors premier incrément de données).
8. **Sorts livrés (~10, cercles 1–3)** : Feu `boule-de-feu` (dégâts),
   `trait-de-feu` ; Eau `soin`, `benediction` (buff attaque) ; Terre
   `bouclier-de-pierre` (buff défense), `affaiblissement` (debuff défense) ;
   Air `hate` (buff vitesse), `lenteur` (debuff vitesse) ; neutre
   `eclair-magique` (dégâts), `dissipation`. Répartis école×cercle.
9. **Artefacts** : `HeroState.artifacts: (string|null)[]` de longueur 10
   (slots génériques, doc 08 §2.3 « 10 slots »). Effet déclaratif cumulatif
   (`attack`/`defense`/`power`/`knowledge`/`luck`/`morale`/`manaMax`).
   Artefacts de départ via `config.newGame.startingArtifacts?: string[]`.
   Poupée par type de slot = raffinement (10 slots génériques en 3.2).
10. **UI** (doc 08 §2.3) : livre de sorts en combat (bouton `[Sort héros]`,
    prévisualisation obligatoire), compétences + inventaire dans le **tiroir
    héros** (le doc 08 §2.3 décrit un « écran héros » — réconcilié : tiroir
    étendu, note ajoutée au doc 08). Choix de compétence à la montée = modale.

## Surfaces figées au cadrage

- **Moteur** (`HeroState`) : `mana`, `manaMax`, `skills: Record<string,number>`,
  `spells: string[]`, `artifacts: (string|null)[]`, `pendingSkillChoices:
  string[]`. `HeroSkillDef`/`SpellDef`/`ArtifactDef` (résolus, dans l'état via
  catalogues `skillCatalog`/`spellCatalog`/`artifactCatalog`).
  `CombatState` : `attackerHeroId`, `defenderHeroId` (string|null),
  `heroCastThisRound: boolean` ; `CombatStack.statuses: SpellStatus[]`.
  Commandes : `CastSpell { spellId, targetStackId }` (combat),
  `ChooseSkill { heroId, skillId }` (aventure). Événements : `SpellCast`,
  `SkillLearned`.
- **Contenu** : schémas `spell`/`skill`/`artifact` ; `data/core/{spells,
  skills.json,artifacts.json}` ; `config.newGame.startingArtifacts` ;
  catalogues résolus.
- **Client** : store `heroScreenTab`, livre de sorts combat, tiroir compétences
  /inventaire, modale de choix de compétence.

## Lots

- [x] **Cadrage (principal)** : ce plan + surfaces figées + stubs, golden
      refigé, vert.
- [x] **Lot K (sonnet) — moteur** : sorts en combat (`CastSpell`, dégâts/soin/
      buff/debuff, statuts, mana, `heroCastThisRound`), attributs héros +
      luck/moral branchés dans `damage.ts`, compétences (effets aux points
      existants), choix de compétence (`ChooseSkill` + propositions au
      level-up), artefacts (bonus cumulés). `estimateSpell` sans RNG. Tests
      tabulaires + property « le combat se termine toujours » avec sorts +
      golden. Livré : `hero/{spells,skills,artifacts,level-up}.ts` (règles
      pures) + `hero/index.ts` (validate/handle CastSpell & ChooseSkill,
      estimateSpell) ; `combat/damage.ts` (attaque/défense/luck du héros +
      statuts attackMod/defenseMod + %mêlée/tir/armure injectés dans
      `computeMultiplier`, sans régression arène) ; `combat/turns.ts`
      (reset `heroCastThisRound` + décrément/expiration des statuts +
      `speedMod` dans l'ordre de jeu) ; `combat/setup.ts` (mana du héros
      lié = `manaMax` à l'ouverture) ; `adventure/experience.ts` (tirage de
      2 propositions de compétence à chaque niveau franchi, RNG de l'état).
      31 tests ajoutés (150 au total) dans `test/hero-{spells,skills,
      level-up,property}.test.ts`. Golden **inchangé** (hash `f85c9e64`) :
      le héros du journal golden reste niveau 1/attributs à 0/sans
      artefact ni compétence au moment du combat, donc tous les bonus
      héros valent 0 — `pnpm --filter @heroes/engine test/typecheck`,
      `pnpm lint` verts.
- [x] **Lot L (sonnet) — contenu** : schémas spell/skill/artifact + règles
      croisées, `data/core/spells/*` (~10), `skills.json` (12), `artifacts.json`,
      `startingArtifacts`, catalogues, `content:check` étendu, tests. Livré :
      `spellSchema`/`skillSchema`/`artifactSchema` + catalogues fichiers,
      `data/core/spells.json` (10), `skills.json` (13 — voir écart),
      `artifacts.json` (4), `config.newGame.startingArtifacts`,
      `buildSpellCatalog`/`buildSkillCatalog`/`buildArtifactCatalog`,
      `content:check` étendu (3 catalogues), 16 tests ajoutés (35 au total),
      `pnpm --filter @heroes/content test/typecheck`, `content:check`, `lint`
      verts.
- [x] **Lot M (sonnet) — UI** : livre de sorts combat (prévisualisation),
      tiroir héros étendu (compétences + inventaire 10 slots), modale de choix
      de compétence, i18n. Bouton `[Sort héros]` dans la barre de combat.
      Livré : `SpellBook`/`HeroSkills`/`HeroInventory`/`SkillChoice`, bouton
      `combat-spell`, `resolveSpellName`/`resolveSkillName`/`resolveArtifactName`
      dans `i18n.ts` (repli sur l'id — les `SpellDef`/`HeroSkillDef`/`ArtifactDef`
      figés n'ont pas de `name`), 33 clés locales ×2 langues, 13/13 smokes
      desktop verts, bundle client 55 Ko gzip.
- [x] **Intégration (principal)** : catalogues sorts/compétences/artefacts
      résolus contenu→moteur (`buildHeroSetup` dans `game.ts` ; gating MVP
      « cercle ≤ 3 » appliqué côté contenu, hors moteur). Héros de départ doté :
      attributs `config.newGame.startingHero` (Savoir 4 ⇒ 40 mana), sorts
      connus d'emblée, artefacts ; `PlayerSetup` gagne `startingAttributes`/
      `startingSpells` (défaut 0/[] ⇒ golden intact). Mana initialisée à
      l'ouverture de combat (lot K) ET à `StartGame` (affichage tiroir). Effets
      de compétence hors combat branchés dans `engine.ts` : Logistique = PM
      (`heroDailyMovement`), Recherche = vision (`revealAround`), Économie =
      or/jour (EndTurn). Smoke « lancer un sort réduit une pile » (E2E UI
      complet) + gating modale de choix. Golden **inchangé** (`f85c9e64`).
      Docs 02 §1.3/§1.4 + 08 §2.3 + CLAUDE.md. Vérif : 150 tests moteur, 35
      contenu, 15 smokes desktop / 14 mobile, lint, bundle < 800 Ko — tous verts.

## Écarts assumés

- IA ne lance pas de sorts en 3.2 ; sorts d'aventure (sauf principe) = post-MVP ;
  apprentissage à la visite de ville, régénération de mana d'aventure, poupée
  d'équipement typée, cercles 4–5 = raffinements 3.3+.
- Cercles réellement peuplés : 1–3 (Guilde MVP).

## Écarts constatés en cours de route

- **Lot L** : le pool de compétences du doc 02 §1.3 énumère « Magie (par
  école ×4) » comme une ligne unique mais représente en réalité 4 skills
  (`magic-fire/water/earth/air`) — le pool livré compte donc **13** entrées
  (7 skills « simples » + 4 écoles de magie + Sagesse + Économie), pas 12
  pile (le doc lui-même dit « ~12 »). Décision : livrer les 13, cadrage
  explicite du lot listant chaque id de magie séparément.
- **Lot L** : `spell`/`skill`/`artifact` n'ont pas reçu de champ `name`
  (`@loc:` optionnel dans le schéma) faute de besoin d'affichage en 3.2 — pas
  de clé de locale ajoutée à `data/core/locales/`. Lot M (UI) devra soit
  ajouter les `name`/locales, soit dériver l'affichage autrement.
- **Lot L** : le sort neutre « dissipation » (dispel) est modélisé en
  `debuff` (`attackMod`/`defenseMod` négatifs) faute de `SpellKind` dédié
  dans la surface figée — pas de vrai retrait de statut en 3.2, cohérent
  avec le lot K qui n'implémente que damage/heal/buff/debuff.
- **Lot K** : moral du héros (Commandement, `heroMorale` dans
  `hero/skills.ts`) **NON branché** au moral de pile — `moraleOf` vit dans
  `combat/state-helpers.ts`, hors périmètre exclusif du lot (seuls
  `damage.ts`/`turns.ts`/`setup.ts` étaient modifiables côté combat).
  Point d'intégration à traiter par la session principale ou un lot dédié.
- **Lot K** : PM quotidiens (Logistique), rayon de vision (Recherche), or/jour
  (Économie) et réduction de coût de mana par école (Magie) restent des
  fonctions pures exposées (`hero/skills.ts` : `heroMovementBonus`,
  `heroVisionBonus`, `heroGoldPerDay`) mais **NON branchées** à
  `adventure/config.ts` (`dailyMovementPoints`), `adventure/fog.ts`
  (`revealAround`) ni au revenu de ville — hors périmètre exclusif du lot
  (« NE modifie pas dailyMovementPoints/town/economy toi-même »).
  `heroManaCostReduction` EST branché (dans `hero/spells.ts`, coût de sort).
- **Lot K** : plafond de soin — `CombatStack` (types.ts figé) ne porte pas
  l'effectif initial de la pile. Approximé par `effectif courant + pertes
  déjà enregistrées pour cette unité/ce camp` (bilan interne du combat via
  `collectCasualties`) ; les dégâts sur PV entamés sans mort (frappes
  partielles) ne sont pas comptés dans ce plafond, ce qui peut sous-estimer
  légèrement l'effectif maximal réel dans de rares cas. Documenté dans
  `hero/index.ts`.
- **Lot K** : distinction mêlée/tir du bonus de compétence (Attaque au
  corps vs Tir) approximée dans `combat/damage.ts` par `striker.ammo !==
  null && !meleePenalized` (riposte toujours traitée comme mêlée). Un
  tireur doté d'une capacité `noMeleePenalty` combattant au contact (aucune
  unité de ce type dans les données actuelles) serait classé « tir » par
  erreur — edge case non couvert, `actions.ts` étant hors périmètre du lot.
- **Lot K** : `hero.pendingSkillChoices` est **remplacé** (pas accumulé) à
  chaque niveau franchi dans `grantXp` — une chaîne de montées multiples en
  un seul appel ne laisse en attente que les 2 propositions du dernier
  niveau atteint (décision documentée dans `adventure/experience.ts`).
- **Intégration** : effets de compétence hors combat désormais **branchés**
  (Logistique/Recherche/Économie via `engine.ts`) ; en revanche le **moral du
  héros** (Commandement, `heroMorale`) reste **NON branché** au moral de pile
  (`combat/state-helpers.ts` `moraleOf`) — reporté (raffinement 3.3+), car il
  faut décider comment le moral du héros lié à un camp module chaque pile.
- **Intégration** : smoke « montée de niveau → choix de compétence » **non
  jouable** dans une partie fraîche (niveau 2 ≈ 3732 XP, un gardien ≈ 20 XP).
  Le flux moteur (level-up → `pendingSkillChoices` → `ChooseSkill`) est couvert
  par `hero-level-up.test.ts` (11 tests) ; le smoke navigateur ne vérifie que
  le **gating** de la modale (absente au niveau 1). L'E2E complet du sort
  (livre → cible → prévisualisation → `CastSpell` → pile réduite) est, lui,
  couvert en navigateur.
- **Intégration** : le héros de départ reçoit des attributs de base
  (`config.newGame.startingHero`, Savoir 4) — sans quoi `manaMax = Savoir × 10`
  vaudrait 0 et le système de sorts serait inerte en partie réelle. Choix
  data-driven (pas de valeur en dur), défaut 0 si le champ est absent.
