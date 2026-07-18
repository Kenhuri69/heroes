# E4 — Combats coopératifs (doc 18 Étape 5, signature MMHO)

Arbitrage utilisateur (2026-07) : **lancer E4**. L'audit exige un **cadrage
préalable** (chantier moteur lourd, P3). Ce lot **E4.1 = cadrage** (design +
décomposition) ; l'implémentation suit par lots atomiques après validation.

## État des lieux (grounded)

- Combat **strictement mono-héros par camp** : `CombatState.attackerHeroId` /
  `defenderHeroId` = **un seul** id (`combat/setup.ts`). Armées = `ArmyStack[]`
  posées par `placeSide`. Pertes/XP réattribuées à l'**unique** héros du camp.
- Précédent proche : le **siège** fusionne **garnison + armée du héros** sur un
  camp (`beginTownCombat`) — mais garnison et héros appartiennent au **même
  joueur**. Le coop généralise à **plusieurs héros de joueurs ALLIÉS**.
- Alliances existantes : `PlayerState.team` (`areAllies`, save v13) — base sociale
  du coop (les alliés ne s'assiègent pas, partagent la victoire).

## Décision de design (proposée, à confirmer)

- **Coop LOCAL, offline-signifiant** : un **héros allié adjacent** (8 dir.) à la
  tuile où un héros engage un **combat PvE** (gardien/siège) fait **rejoindre son
  armée** au même camp. **PvE only** (jamais en héros-vs-héros). Le cadre « MMHO
  online temps réel » de l'audit est **écarté** (on n'a pas l'infra ; le hot-seat
  + alliances rend le coop local jouable dès maintenant).
- **Point d'extension moteur générique** : **attribution de pile par héros
  propriétaire**. Chaque `CombatStack` gagne un `ownerHeroId` (le héros dont vient
  la pile ; défaut = héros-lead du camp). À la fin : **pertes** routées vers
  l'armée du bon héros, **XP** partagée entre les héros du camp vainqueur.
  ⚠️ `CombatStack` est sous garde `Exact<keyof>` (save-shape) ⇒ **bump save +
  golden re-fixé** au lot qui l'ajoute (E4.2).
- **Opt-in** : sans allié adjacent OU hors PvE ⇒ comportement mono-héros
  **bit-identique** (aucune pile n'a de co-propriétaire ⇒ golden épargné hors E4.2).

## Décomposition en lots (PR atomiques)

- **E4.1** (ce PR) : cadrage — doc 02 §6 + ce plan + doc 18 E4.
- **E4.2** : moteur — `CombatStack.ownerHeroId` (bump save) ; à l'ouverture d'un
  combat PvE, l'armée d'un **allié adjacent** rejoint le camp joueur (piles
  marquées de son id, cap de slots à trancher : 7 partagés vs 7/héros) ; à la fin,
  **pertes routées par owner**. Tests : pertes reviennent au bon héros.
- **E4.3** : XP & butin partagés entre les héros alliés du camp vainqueur.
- **E4.4** : actions de héros en coop — chaque héros allié dispose de ses actions
  (sort/attaque/renfort) ce round (généralise `heroCastThisRound`/`heroAttackUsed`
  du booléen-par-camp au **par-héros**).
- **E4.5** : client — invite/consentement de l'allié (ou auto si IA/hot-seat) +
  rendu « à qui appartient la pile » (liseré couleur du propriétaire) ; IA alliée.

## Décisions confirmées (utilisateur, 2026-07)

1. **Modèle** : ✅ **coop local adjacent-ally** (pas de report online).
2. **Consentement** : ✅ **sur invite** — le joueur choisit d'inviter l'allié
   adjacent (pas de jonction automatique). Le moteur reçoit l'id de l'allié invité ;
   l'UI de choix est E4.5.
3. **Cap de plateau** : ✅ **7 slots partagés** entre alliés (zéro changement de
   placement/équilibrage ; les armées combinées sont tronquées/priorisées à 7 piles).
4. **XP** : ✅ **partage égal** entre les héros du camp vainqueur (déterministe,
   pas de suivi de kills par propriétaire).

## Statut

- [x] Cadrage écrit (doc 02 §6, ce plan, doc 18 E4). Zéro code.
- [x] Décisions confirmées (les 4 ci-dessus).
- [x] **E4.2 (moteur, GARDIEN) LIVRÉ** : `CombatStack.ownerHeroId?` (bump save
      **34→35**, StackKey mis à jour, golden re-fixé « forme seule » `7c1cdc04`→
      `a4a17d37` — seul `saveVersion` change) ; `beginGuardianCombat(..., allyHeroId?)`
      + `resolveCoopAlly` (allié/adjacent/armée) ; armée combinée cap **7 partagé**
      (lead prioritaire), piles alliées taguées, **armée de l'allié vidée** à
      l'engagement ; `MoveHero.allyHeroId?` threadé via `AdvanceOptions` ;
      `applyConsequences` route les survivants **par owner**, XP **partagée à
      égalité** (`coopAttackerOwners`) ; défaite = lead meurt, allié survit sans
      armée ; événement `AllyJoinedCombat`. 4 tests `combat-coop.test.ts`. Hors
      coop = **bit-identique**. Vérif : typecheck ✓, lint ✓, 901 engine + 154
      content ✓, content:check ✓, garde-fou vert, build ✓, budget 341 Ko ✓, smoke
      @core 28/28 ✓. **Siège coop différé** (E4.2b) : ce lot couvre le gardien.

## Note
Lot **documentaire** : pas de code, pas de bump save, golden intact. Le smoke n'est
pas requis (guidelines §7, changement doc). Vérif : parité FR/EN n/a (pas de locale),
liens docs cohérents.
