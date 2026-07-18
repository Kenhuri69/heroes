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

## Questions ouvertes (à trancher avec l'utilisateur avant E4.2)

1. **Modèle confirmé** : coop local adjacent-ally (proposé) vs report total online ?
2. **Consentement** : l'allié adjacent rejoint-il **automatiquement**, ou sur
   **invite** (le joueur choisit) ? (hot-seat : l'allié est un autre humain/IA.)
3. **Cap de plateau** : 7 slots **partagés** entre alliés, ou 7 **par héros** (plus
   fidèle mais change le placement/l'équilibrage) ?
4. **XP** : partage **égal** entre héros du camp, ou **au prorata** des dégâts/PV tués ?

## Statut

- [x] Cadrage écrit (doc 02 §6, ce plan, doc 18 E4). Zéro code.
- [ ] Confirmation utilisateur des 4 questions ⇒ E4.2 (moteur).

## Note
Lot **documentaire** : pas de code, pas de bump save, golden intact. Le smoke n'est
pas requis (guidelines §7, changement doc). Vérif : parité FR/EN n/a (pas de locale),
liens docs cohérents.
