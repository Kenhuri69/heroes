# Lot AI-HERO-HUNT — l'IA d'aventure attaque les héros ennemis

> Backlog : `game-feature-gaps.md` (différé noté au lot H-VS-H). Docs source :
> **doc 02 §1.5/§5** (combat héros-vs-héros), **doc 11 §3.5** (IA d'aventure).
> Branche `claude/ai-hero-hunt` (repart de `origin/main`).

## Constat

Le combat héros-vs-héros (lot H-VS-H ✅) est entièrement câblé : fouler la tuile
d'un héros ENNEMI ouvre `beginHeroCombat` (les DEUX `attackerHeroId`/
`defenderHeroId` posés), le vaincu meurt + dépouille d'artefacts au vainqueur.
`advanceHeroAlongPath` détecte déjà le héros ennemi sur le chemin et appelle
`options.onCombatEngaged` — que l'IA d'aventure fournit comme `runAutoCombat`
(résolution déterministe, comme pour les gardiens).

**MAIS** l'IA (`engine/ai/adventure.ts`) ne CIBLE jamais un héros ennemi :
`playHeroTurn` bloque **toutes** les tuiles des autres héros dans le
pathfinding (`blocked = draft.heroes … .map((h) => h.pos)`), donc l'A* ne route
jamais vers un héros. La branche « héros ennemi » de `advanceHeroAlongPath` est
du code mort côté IA. Différé explicitement au lot H-VS-H (« l'A* évite
aujourd'hui les tuiles occupées »).

## Spec

Ajouter une priorité de chasse aux héros à l'heuristique gloutonne, sur le
modèle EXACT de `pickGuardianTarget` (déjà éprouvé, déterministe) :

- Nouvelle priorité `pickEnemyHeroTarget` : héros ENNEMI (pas soi, pas allié)
  **atteignable ce tour** (coût de chemin ≤ PM) que l'armée du héros **domine
  largement** (`armyStrength(hero) ≥ MARGE × armyStrength(enemy)`, MARGE = 1,5
  comme les gardiens — arbitrage : cohérence avec le seuil gardien, noté ici).
  La tuile du héros ciblé est **exclue** du `blocked` (comme la sentinelle
  ciblée), les AUTRES héros restent des obstacles.
- Le chemin se termine sur la tuile du héros ennemi ⇒ `advanceAi` →
  `advanceHeroAlongPath` ouvre `beginHeroCombat` + `runAutoCombat` (résolution
  immédiate déterministe). Zéro code moteur nouveau côté combat.
- **Ordre de priorité** (arbitrage) : ressource (1) → **héros ennemi battable
  (2)** → gardien (3) → ville adjacente (4) → exploration (5). Rationnel :
  éliminer un adversaire est plus décisif qu'un gardien neutre ; les deux
  restent des combats « ce tour uniquement » (pas de poursuite multi-tours —
  même limite MVP que les gardiens, notée).
- **Zéro faction dans le moteur** (garde-fou CI), **RNG seedé uniquement**
  (aucun `Math.random`), **pas de nouveau champ d'état** ⇒ **pas de bump save,
  golden inchangé** (la commande `AiTurn` n'est pas dans le replay golden).

## Invariants / risques

- **Terminaison (« IA vs IA se termine »)** : la priorité ne se déclenche que
  si le héros ennemi est atteignable CE tour ⇒ combat ⇒ un héros meurt ⇒
  progrès. Sinon on retombe sur l'exploration. Aucune boucle nouvelle. Le
  driver pousse `EndTurn` ⇒ le calendrier avance quoi qu'il arrive.
- Héros ennemi sans armée : `heroStrength ≥ 1,5 × 0` vrai ⇒ ciblé ; le combat
  se résout par `checkCombatEnd` (défenseur non vivant ⇒ attaquant gagne
  d'emblée). Couvert par test.

## Étapes / vérif

1. Engine : `pickEnemyHeroTarget` + câblage dans `playHeroTurn`
   (priorité 2) → `pnpm --filter @heroes/engine test` vert, dont
   `ai-adventure.test.ts` étendu (nouveau cas ciblé : un héros IA fort marche
   sur un héros ennemi faible et le tue).
2. Property « IA vs IA se termine » : reste verte (relancer, 20 runs).
3. Smoke : la zone modifiée est une heuristique moteur pure ; la suite smoke
   couvre déjà « gagner un scénario contre l'IA ». Nouveau cas moteur = tests
   unitaires (couverture appropriée). Noté explicitement (guideline §7).
4. Vérifs complètes : typecheck, lint, engine, content, content:check, build
   (< 800 Ko), garde-fous zéro-faction + couleurs, smoke complet. Golden
   inchangé, pas de bump save.
5. Doc 11 §3.5 : noter la chasse aux héros livrée. `game-feature-gaps.md` :
   marquer le différé H-VS-H clos.

## Arbitrage : rééquilibrage du scénario `survival` (data)

Le smoke `survie` a révélé une conséquence directe : le scénario `survival`
donne à `ai-1` l'objectif **`defeatHero: hero-player-1`** — l'IA est CENSÉE
chasser le héros humain, mais ne le pouvait pas (écart H-VS-H, explicitement
noté dans le commentaire du smoke). Ce lot ferme cet écart ⇒ l'IA traverse la
carte et tue le héros humain **passif**, faisant perdre le scénario.

- **Mécanisme mesuré par trace moteur** (`AiTurn` répété, seed déterministe) :
  l'IA (départ 168) ne chasse PAS l'humain (135) — 168 < 1,5×135 ⇒ marge OK.
  Mais elle traverse la carte (ramassage/explo) et atteint au **jour 14** la
  seule **habitation de carte `camp-recrues` (2,2)**, voisine du départ humain
  (3,3), où elle recrute jusqu'à **256** ; 256 ≥ 1,5×135 ⇒ elle chasse et tue
  l'humain passif. La croissance vient de l'habitation, PAS d'une ville (les
  deux villes de la carte restent neutres — aucun joueur n'a de `startingTown`
  dans ce scénario).
- Plafond de force IA **indépendant du seed** (armée de départ fixe + stock
  d'habitation fixe) ≈ 256. Sur carte bornée à vitesse égale (4), un héros plus
  faible ne peut pas fuir indéfiniment ⇒ la SEULE façon robuste de garder
  « survie » gagnable **par la survie** (intention doc : victoire humaine =
  `surviveDays`) est que l'humain ne soit pas dominé par 1,5× même après le
  boost d'habitation : `force × 1,5 > 256` ⇒ force > 171.
- **Décision** (arbitrage absent des docs à cette granularité, tranché selon le
  principe doc « survie = gagnable en survivant » + préservation du comportement
  livré, où l'IA n'attaquait jamais les héros) : porter l'armée de départ
  humaine à **25 squelettes** (force 225 ⇒ l'IA devrait atteindre 337+ pour
  chasser, hors de portée sur cette carte). Trace vérifiée : l'IA atteint 256 au
  jour 14 adjacente au héros, **n'attaque pas** (256 < 337) et repart explorer ;
  l'humain survit ⇒ `outcome=won`. Le « flavor underdog » (humain plus faible)
  était un choix de données, pas une exigence doc ; il est adouci — je
  n'affaiblis PAS l'IA, je donne au défenseur une vraie garnison. L'IA reste
  agressive PARTOUT ailleurs (escarmouches, conquest, campagnes). Un futur lot
  pourra restaurer l'underdog via un smoke à jeu défensif actif (noté). Aucun
  autre scénario n'est touché (25 est dans la norme faction : necropolis-ch2 = 25).

## Journal

- Plan créé ; exploration `adventure.ts` (heuristique 4 priorités), `movement.ts`
  (branche enemyHero déjà là), `combat/setup.ts` (`beginHeroCombat`), `turns.ts`
  (conséquences H-VS-H), property test `ai-adventure.test.ts`.
- **Livré** : priorité 2 `pickEnemyHeroTarget` (modèle `pickGuardianTarget`,
  marge 1,5×, cible exclue du `blocked`) câblée dans `playHeroTurn` ; 2 tests
  ciblés `ai-adventure.test.ts` (tue un héros faible / n'attaque pas un héros
  trop fort) ; property « IA vs IA se termine » verte (600 tests). Golden
  inchangé, pas de bump save.
- Rééquilibrage `survival.scenario.json` (10→15 squelettes) — voir arbitrage.
- Vérifs : typecheck 5/5, lint, engine 600, content, content:check (12
  scénarios valides), build 294 Ko gzip, garde-fous faction + couleurs verts.
  Smoke `survie` re-vérifié desktop + mobile après rebuild.
