# Lot H-VS-H — Combat héros-vs-héros

> Plan vivant (guidelines §5). Source de vérité : doc 02 §1.5/§5, doc 02 §5.6
> (dépouille). Backlog : `game-feature-gaps.md` (M-TAVERN différé « combat
> héros-vs-héros — `defenderHeroId` toujours `null` »).

## Objectif

Marcher sur un héros **ennemi** (autre joueur, non allié) déclenche un combat
héros-vs-héros (`defenderHeroId` enfin non-null). Le **perdant meurt** (règle de
disparition déjà en place pour l'attaquant vaincu). **Dépouille** : les
**artefacts** du vaincu passent au vainqueur (slots libres ; surplus déposé au
sol sur la tuile du vaincu). L'**XP** du camp gagnant est déjà accordée par
`grantHeroCombatXp` (PV ennemis tués).

## Invariants (guidelines §8)

- Zéro faction moteur (garde-fou CI).
- RNG seedé uniquement (le combat l'est déjà).
- Moteur sans rendu.
- Touch-first : cibler un héros ennemi = même geste tap-tap que gardien.
- **Pas de bump save** : `attackerHeroId`/`defenderHeroId` existent déjà,
  combat transitoire. Golden : **inchangé** — je n'ajoute qu'une BRANCHE
  (`attackerHeroId && defenderHeroId`) sans toucher aux chemins
  gardien/arène/siège que le golden exerce.

## Arbitrages (doc 02 silencieux sur le détail)

- **Attaquant reste adjacent** après victoire (n'entre pas sur la tuile du
  vaincu) — cohérent avec l'interception de gardien (décision phase-2.4).
- **Dépouille** : artefacts du vaincu → slots libres du vainqueur ; le surplus
  qui ne rentre pas est **déposé au sol** (objet `artifact` de carte, réutilise
  le ramassage existant) sur la tuile du vaincu. Fidélité HoMM.
- **Attaquant armée vide** : refusé (parallèle au garde-fou gardien).
- **IA** : ne cible PAS les héros ennemis ce lot (l'A* évite les tuiles
  occupées). Hors périmètre, noté.

## Étapes

1. Moteur — validation du pas sur héros ennemi (`engine.ts validatePath` :
   autoriser un héros ennemi en DERNIER pas ; allié/soi bloquent) + garde
   armée vide.
2. Moteur — `beginHeroCombat` (`combat/setup.ts`, jumeau de `beginTownCombat` :
   attaquant = armée+machines, défenseur = armée+machines de l'ennemi, les DEUX
   `*HeroId` posés). Détection dans `advanceHeroAlongPath` (`movement.ts`),
   renommage `onGuardianEngaged` → `onCombatEngaged` (couvre gardien + héros).
3. Moteur — conséquences (`combat/turns.ts`) : branche H-VS-H (les deux hero
   ids) — armée du vainqueur reconstruite, effets de faction post-victoire,
   vaincu retiré, dépouille d'artefacts transférée/déposée.
4. Tests moteur (`combat-hero-vs-hero.test.ts`) : attaquant gagne (défenseur
   mort, artefacts transférés, surplus au sol), défenseur gagne (attaquant
   mort), rejets (allié, soi, armée vide), XP accordée.
5. Client — pathfinding : un héros ennemi devient destination valide (hint de
   force), `tryCaptureTownAt` inchangé. Hook `findPath` (affordance de test).
6. Smoke — hot-seat skirmish : rapprocher les 2 héros (hook `findPath` +
   `MoveHero`/`EndTurn`), puis tap-tap sur le héros ennemi ⇒ combat ouvert avec
   `attackerHeroId` + `defenderHeroId` non-null ; Auto-Battle ⇒ un héros meurt.
7. Docs : doc 02 §1.5/§5 (état livré), backlog. Vérif complète + PR + merge.

## Journal

- Moteur : `validatePath` autorise un héros ENNEMI en dernier pas (allié/soi
  bloquent) + garde armée vide ; `beginHeroCombat` (setup.ts) ; détection dans
  `advanceHeroAlongPath` + renommage `onGuardianEngaged`→`onCombatEngaged` ;
  branche `applyHeroVsHeroConsequences` (turns.ts) — vainqueur reconstruit,
  vaincu retiré, dépouille (slots libres + surplus au sol). Aucun bump save.
- Test existant `refuse de traverser un autre héros` adapté (traversée = pas
  NON final ⇒ invalidPath ; l'onto-ennemi est désormais un combat). Nouveau
  `combat-hero-vs-hero.test.ts` (6 cas). Golden inchangé (568 tests verts).
- Client : `AdventureScene` tap — héros ennemi = destination valide + hint de
  force ; hook `findPath` (affordance smoke). typecheck OK.
- Smoke : hot-seat skirmish, rapprochement via `findPath`, attaque ⇒ combat
  (2 hero ids) ⇒ Auto-Battle ⇒ un héros meurt. Desktop + mobile verts.
