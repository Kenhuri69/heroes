# LE5 — Neutres vivants

> Lot LE5 du plan `game-experience-enrichment.md` (§4) : **F1** (division des
> piles neutres) → **A4** (fuite proposée, ralliement, Diplomatie). Décisions
> adoptées par l'utilisateur le 2026-09-29 (§5, points 3, 4 et 13) ;
> amendements de l'expert repris (§3.1 A4, §3.3 F1).

## 1. Constat (lu dans le code)

- Un gardien = **une seule pile** au combat (`beginGuardianCombat`,
  `combat/setup.ts`) : les tireurs la démontent sans risque et la tactique
  s'appauvrit. La fin de combat additionne déjà les piles défenseures
  (`persistDefenderRemnants`) : scinder ne touche que la mise en place.
- Tout gardien croisé est un combat, même 10 gobelins face à une armée de
  dragons : ratissage obligatoire, sans décision.
- 23 compétences, aucune n'agit sur les neutres (Diplomatie reportée de LE4).

## 2. Décisions de conception

### F1 — division des piles

- Bloc opt-in `combat.neutralSplit { maxStacks }` (absent ⇒ une pile, golden et
  fixtures inchangés).
- Nombre de piles selon la force du héros face au gardien (`armyStrength`),
  table canon HoMM III (valeurs de wiki, marquées incertaines) : rapport
  < 0,5 ⇒ 7 ; < 0,67 ⇒ 6 ; < 1 ⇒ 5 ; < 1,5 ⇒ 4 ; < 2 ⇒ 3 ; sinon 2. Puis
  variation −1/0/+1 tirée au RNG seedé. Borné par `maxStacks` et par l'effectif.
- Effectif réparti également, le reste sur les premières piles. Un héros faible
  affronte plus de piles : la division pèse sur celui qui ratisse de trop tôt.
- Valeur : `maxStacks: 5` (l'arène a 11 rangées ; 7 piles gardiennes + 7 piles
  de héros resteraient jouables, mais 5 garde les combats courts).

### A4 — fuite proposée, ralliement, Diplomatie

- Bloc opt-in `adventure.neutralReactions { fleeRatio, fleeChanceFrom, joinRatio }`.
- À l'interception d'un gardien (pas dessus ou zone de contrôle), rapport
  `r = force héros / force gardien` :
  - **Fuite** : `r ≥ fleeRatio` ⇒ le gardien propose de fuir ; entre
    `fleeChanceFrom` et `fleeRatio`, proposition tirée au RNG seedé avec une
    probabilité linéaire (la « zone grise »).
  - **Ralliement** : le héros a Diplomatie (effet `neutralJoinDiscountPct`
    25/50/75) et `r ≥ joinRatio` ⇒ le gardien propose de rejoindre l'armée
    contre son coût de recrutement réduit du pourcentage. Plafonné : une pile
    de même unité, ou un emplacement libre (7 piles).
  - Aucun des deux ⇒ combat immédiat, comme avant.
- Jamais de proposition pour un gardien **`neverFlee`** : champ en données, ou
  implicite quand un objet est `guardedBy` lui (banques, butins gardés) ou qu'une
  quête `defeatGuardian` le vise.
- Proposition = `GameState.pendingNeutralOffer?` (optionnel, patron
  `pendingTriggerChoice`) ; le déplacement s'arrête. Commande
  `ResolveNeutralOffer { heroId, choice: 'fight' | 'release' | 'join' }` :
  - `fight` : combat de gardien (le pas est déjà payé) ;
  - `release` : le gardien quitte la carte, **sans XP ni butin** (canon) ;
  - `join` : or payé, pile ajoutée à l'armée, gardien retiré.
  Fuite et ralliement mettent le respawn en file comme une victoire.
- IA déterministe : rallie si elle peut payer, sinon combat (elle garde ainsi
  son comportement de ratissage et son XP).
- Client : modale forcée (patron `TriggerChoice`) « Combattre / Laisser
  partir / Rallier (coût) », toasts de fuite et de ralliement.
- Valeurs : `fleeRatio: 3`, `fleeChanceFrom: 2`, `joinRatio: 1.5`.
- Diplomatie ajoutée à `data/core/skills.json` (rangs 25/50/75 %).

## 3. Étapes

1. [x] F1 — config + schéma, division dans `beginGuardianCombat`, activée en
   données. Tests : sans bloc ⇒ 1 pile ; rapport faible ⇒ plus de piles ;
   somme des effectifs conservée ; survivants réécrits sur le gardien.
2. [x] A4 moteur — config, `neverFlee`, offre à l'interception, commande,
   gardes « choix en attente », IA. Tests : fuite ≥ 3× ; jamais sous 2× ;
   `neverFlee` (champ, `guardedBy`, quête) ; ralliement payant et plafonné ;
   refus ⇒ combat ; IA rallie ou combat.
3. [x] A4 données + client — Diplomatie, modale, toasts, locales FR/EN ;
   smoke du choix.
4. [x] Mesures : bench IA (combats de gardien, pertes) ; `faction:sim`
   (inchangé attendu : duels sans gardien).
5. [x] Docs 02 (§1.3, §2.2, §5), CLAUDE.md ; vérifications (§5).

## 4. Mesures

**`faction:sim`** : inchangé (1 béance, la même qu'en LE2) — ses duels
n'opposent pas de gardien.

**Bench IA** (jetable, non commité ; 2 IA, 64², 20 graines, 60 jours, normal) :

| | Sans LE5 | Division seule | **Division + propositions** |
|---|---|---|---|
| Combats de gardien | 257 | 284 | 313 |
| Combats de gardien perdus par l'IA | 32 | 32 | 35 |
| Propositions de neutres (toutes combattues) | — | — | 126 |
| Ralliements | — | — | 0 |
| Parties avec un combat entre joueurs | 3/20 | 2/20 | 3/20 |
| Parties conclues en 60 jours | 15/20 | 14/20 | 10/20 |

Lecture :
- La division ne rend pas l'IA plus fragile face aux neutres : ses pertes restent
  stables (32 → 32 → 35 pour un peu plus de combats).
- 40 % des combats de gardien de l'IA sont des ratissages de neutres dominés
  (126 propositions). Elle les combat tous, comme décidé (XP de ratissage).
- **Aucun ralliement** : l'IA ne prend Diplomatie qu'au hasard des tirages de
  niveau, et n'en a jamais eu sur ces 20 parties. Le ralliement reste un outil du
  joueur ; faire viser Diplomatie à l'IA serait un chantier de choix de
  compétences (LE6/LE7).
- Moins de parties conclues (15 → 10) : l'arrêt prématuré sur `defeatHero` (héros
  de départ tué, relevé en LE3) recule. Le bruit est fort sur n = 20.

## 5. Vérifications

- [x] `pnpm typecheck` · `pnpm lint`
- [x] `pnpm test` — moteur **1084** (+17), contenu 194, client 109, serveur 10 ; golden inchangé
- [x] `pnpm content:check` ; garde-fous faction et couleurs
- [x] `pnpm build` + budget : **382 927 o gzip**
- [x] suite Playwright complète : **146/146** (+1 test « Laisser partir »)

## 6. Journal

- 2026-09-30 : plan ouvert (branche repartie de `main` après la fusion de #554).
- 2026-09-30 : F1 et A4 livrés. Écarts :
  - la place d'armée suit `heroArmyCap` (emplacements bonus des archétypes) et
    non 7 fixe ;
  - la fuite et le ralliement mettent le respawn en file, comme une victoire ;
  - smoke : les combats de gardien de la carte de test passent désormais par la
    proposition (32 contre 4 ⇒ fuite proposée) ; le helper `reachPreBattle`
    répond « Combattre », et un test dédié couvre « Laisser partir ».
