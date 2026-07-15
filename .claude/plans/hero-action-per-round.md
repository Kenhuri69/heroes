# Attaque du héros — 1 action de héros par round (sort OU attaque)

## Contexte (retour de jeu 2026-07)

Capture d'un combat (kenhuri69.github.io) + retour utilisateur :

1. **« les arbalétriers n'avaient aucune attaque à distance possible »**
2. **« l'attaque du héros n'a pu être jouée qu'une seule fois pendant tout le combat »**

## Investigation

### Point 1 — tir des arbalétriers : PAS DE BUG MOTEUR TROUVÉ
- Données : tous les tireurs (`t2-archer`/`t2-archer-elite` Haven, etc.) portent bien
  `shooter` + `ammo` ; audit de toutes les factions ⇒ aucune unité « archer/arbalétrier »
  sans la capacité.
- Chargement : `params.ammo` survit au schéma Zod et à `buildUnitCatalog`.
- Moteur : reproduction avec **les vraies données** (Archer d'Élite Haven réel, ennemi
  distant, champ dégagé) ⇒ `canShoot=true`, `canShootTarget=true`, cible distante bien
  listée par `attackableTargets`. Tir répété round après round OK (ammo décrémenté de 1/tir,
  jamais remis à null en cours de combat).
- Client : le tap sur un ennemi route vers `handleAttackTap` qui calcule `ranged =
  canShootTarget(...)` ⇒ tir si ligne de vue.
- **Conclusion** : les seuls cas où un tireur ne tire pas sont les règles HoMM standard —
  ennemi **au contact** (adjacent), **ligne de vue** bloquée par un obstacle, ou **munitions
  épuisées**. L'utilisateur signale « aucun ennemi adjacent » ⇒ diagnostic du cas précis
  impossible sans sa sauvegarde. **Aucun changement de code** (guideline §2/§3 : ne pas
  « corriger » ce qui n'est pas cassé). → à rapporter, demander l'export `.heroes`.

### Point 2 — attaque du héros 1×/combat : VRAI ÉCART DOC ↔ CODE
- Code + test (`combat-hero-attack.test.ts`) : `heroAttackUsed` verrouille la frappe à
  **1×/combat** (jamais réinitialisé), alors que `heroCastThisRound` (sort) l'est chaque round.
- Doc `02-mechanics.md` **ligne 9** (core loop) : le héros « **agit une fois par round** de
  combat (sort **ou** attaque à distance) » — contredit la ligne 632 « attaque héroïque 1×/combat ».
- **Décision utilisateur** : option **« 1 action de héros par round (sort OU attaque) »** —
  verrou **partagé**, réinitialisé chaque round.

## Changement (point 2 uniquement)

Rendre l'attaque du héros et le sort du héros **mutuellement exclusifs et par round** :
le héros fait **une** action par round (frapper **ou** lancer un sort). `Prière` (rally,
`heroRallyUsed`) reste un special 1×/combat indépendant.

Forme de sauvegarde inchangée (`heroAttackUsed: CombatSideId[]`, sémantique per-combat →
per-round) ⇒ **pas de bump `CURRENT_SAVE_VERSION`**. Zéro faction dans le moteur.

### Étapes

1. `combat/turns.ts` — au reset de round, vider `heroAttackUsed` comme `heroCastThisRound`.
   → vérif : le héros peut re-frapper au round suivant.
2. `combat/hero-attack.ts` `validateHeroAttackTarget` — refuser aussi si le héros a déjà
   **lancé un sort** ce round (`heroCastThisRound.includes(side)`). Message « déjà agi ce round ».
   → vérif : caster puis frapper le même round = refus.
3. `hero/index.ts` `validateCastSpell` — refuser aussi si le héros a déjà **frappé** ce round
   (`heroAttackUsed.includes(side)`).
   → vérif : frapper puis caster le même round = refus.
4. `combat/ai.ts` `maybeHeroAction` — porte du sort : `&& !heroAttackUsed` ; porte de la
   frappe : `&& !heroCastThisRound`. L'IA fait au plus une action de héros/round.
   → vérif : property « IA vs IA se termine » préservée (frappe toujours bornée).
5. `client/ui/combat.tsx` — `canCastSpell` ajoute `!heroAttackUsed` ; `canHeroStrike` ajoute
   `!heroCastThisRound`.
   → vérif : les deux boutons se désactivent mutuellement après une action.
6. Tests `combat-hero-attack.test.ts` — remplacer « refuse une 2ᵉ attaque le même **combat** »
   par « le même **round** » + ajouter : re-frappe autorisée après reset de round, et
   exclusion mutuelle sort↔frappe le même round (test d'intégration avec avance de round).
   → vérif : `pnpm --filter @heroes/engine test`.
7. Doc `02-mechanics.md` — corriger §5.6 (« attaque héroïque 1×/combat » → « 1×/round,
   partagée avec le sort : une action de héros par round ») pour lever la contradiction
   avec la ligne 9. Mettre à jour `CLAUDE.md` (changelog bref).
   → vérif : cohérence ligne 9 ↔ §5.6.
8. Vérif globale : typecheck, lint, golden replay (forme inchangée attendue), tests moteur,
   garde-fou « zéro faction », budget, smoke.

## Statut
- [x] 1 — `turns.ts` vide `heroAttackUsed` au reset de round
- [x] 2 — `hero-attack.ts` refuse la frappe si sort déjà lancé ce round
- [x] 3 — `hero/index.ts` refuse le sort si frappe déjà faite ce round
- [x] 4 — `ai.ts` `maybeHeroAction` : portes croisées (une action de héros/round)
- [x] 5 — `client/ui/combat.tsx` : désactivation mutuelle des boutons + commentaires
- [x] 6 — tests : `combat-hero-attack` (7 tests, dont reset de round + exclusivité) ;
         `combat-ai-hero` libellé aligné → 793 tests moteur verts, golden inchangé
- [x] 7 — doc `02-mechanics.md` §5.6 + commentaires `ai.ts`/`types.ts` + `CLAUDE.md`
- [x] 8 — vérif : typecheck ✓, lint ✓, golden ✓, 793+138 tests ✓, garde-fou faction ✓,
         budget bundle ✓ (147.62 kB gzip index), smoke combat ✓ (suite complète en cours)

## Résultat point 1 (arbalétriers)
Aucun correctif : le tir est vérifié fonctionnel (reproduction moteur avec vraies
données). À rapporter à l'utilisateur + demander l'export `.heroes` du combat concerné
si le problème persiste (diagnostic du cas précis : contact / LoS / munitions).
