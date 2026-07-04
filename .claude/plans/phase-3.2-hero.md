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

- [ ] **Cadrage (principal)** : ce plan + surfaces figées + stubs, golden
      refigé, vert.
- [ ] **Lot K (sonnet) — moteur** : sorts en combat (`CastSpell`, dégâts/soin/
      buff/debuff, statuts, mana, `heroCastThisRound`), attributs héros +
      luck/moral branchés dans `damage.ts`, compétences (effets aux points
      existants), choix de compétence (`ChooseSkill` + propositions au
      level-up), artefacts (bonus cumulés). `estimateSpell` sans RNG. Tests
      tabulaires + property « le combat se termine toujours » avec sorts +
      golden.
- [ ] **Lot L (sonnet) — contenu** : schémas spell/skill/artifact + règles
      croisées, `data/core/spells/*` (~10), `skills.json` (12), `artifacts.json`,
      `startingArtifacts`, catalogues, `content:check` étendu, tests.
- [ ] **Lot M (sonnet) — UI** : livre de sorts combat (prévisualisation),
      tiroir héros étendu (compétences + inventaire 10 slots), modale de choix
      de compétence, i18n. Bouton `[Sort héros]` dans la barre de combat.
- [ ] **Intégration (principal)** : résolution des catalogues contenu→moteur,
      héros liés aux camps de combat, smoke « lancer un sort en combat réduit
      une pile » + « montée de niveau → choix de compétence », golden, docs
      (doc 02 §1.3/§1.4, doc 08 §2.3), CLAUDE.md, PR.

## Écarts assumés

- IA ne lance pas de sorts en 3.2 ; sorts d'aventure (sauf principe) = post-MVP ;
  apprentissage à la visite de ville, régénération de mana d'aventure, poupée
  d'équipement typée, cercles 4–5 = raffinements 3.3+.
- Cercles réellement peuplés : 1–3 (Guilde MVP).

## Écarts constatés en cours de route

(à compléter)
