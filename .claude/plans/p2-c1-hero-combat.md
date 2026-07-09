# P2 / C1 — Héros en combat (HoMM3 : hors-grille + attaque héroïque)

> Backlog `gap-audit.md` C1 (irritant utilisateur n°4 : « le héros de l'armée n'a
> pas d'action en combat »). Décision utilisateur : **modèle HoMM3** — héros
> hors-grille, avec un **sprite visible** sur son flanc + une **action « attaque
> du héros »** (dégâts directs sur une pile, **1×/combat**, basés sur Attaque +
> Pouvoir), en plus du sort existant.

## Design

- **Commande** `HeroAttack { targetStackId }` (mirroir de `CastSpell`) : combat en
  cours, camp joueur actif, héros lié, pas déjà utilisée ce combat, cible ennemie
  vivante. Dégâts = `base + perPower×Pouvoir + perAttack×Attaque` (config
  `combat.heroAttack`, **optionnel** ⇒ feature off si absent → fixtures/golden
  épargnés). Applique morts/pertes comme une frappe, émet `HeroStruck`.
- **État** `CombatState.heroAttackUsed: CombatSideId[]` (camps ayant utilisé leur
  attaque ce combat). Bump `CURRENT_SAVE_VERSION`.
- **Client** : bouton « Attaque du héros » (à côté de « Sort héros »), sélection de
  cible + **prévisualisation obligatoire** (doc 08 §2.4) → `HeroAttack` ; **sprite
  du héros** dessiné sur le flanc de chaque camp (avatar de faction, repli picto).
- **IA** : l'attaque héro n'est PAS utilisée par l'IA (cohérent avec « l'IA ne
  lance pas de sort », audit) — parité IA différée.

## Étapes & vérif

- [x] `CombatState.heroAttackUsed` (types.ts) + init aux 3 sites (setup.ts) ;
      bump save version (doc 07 §4).
- [x] Config `combat.heroAttack?` (config.ts + config.json + schéma contenu).
- [x] Commande `HeroAttack` + codes d'erreur (commands.ts) ; event `HeroStruck`
      (events.ts).
- [x] `combat/hero-attack.ts` : `validateHeroAttack` / `handleHeroAttack` /
      `estimateHeroAttack` (preview sans RNG) / `canHeroAttack` ; dispatch engine.ts ;
      exports index.
- [x] Client : bouton + preview (`combat.tsx`), sprite héros (`CombatScene.ts`),
      locales FR/EN.
- [x] Tests moteur (dégâts, 1×/combat, off sans config) ; golden re-fixé ; smoke
      « l'attaque du héros réduit une pile en arène ».

## Invariants
- Moteur faction-agnostique, déterministe. `heroAttack` optionnel ⇒ pas de churn
  sur les fixtures ; golden re-fixé une fois (champ `heroAttackUsed`).

## Journal
- 2026-07-08 — Plan créé après cadrage design utilisateur (HoMM3 hors-grille).
- 2026-07-08 — **C1 livré** : commande `HeroAttack` (1×/combat, dégâts
  `base+perPower×Pouvoir+perAttack×Attaque`, config `combat.heroAttack`), état
  `heroAttackUsed` (save v12), event `HeroStruck`, module `combat/hero-attack.ts`.
  Client : bouton + modale de ciblage + preview obligatoire, chip de présence du
  héros dans le HUD (sprite canvas sur le flanc = polish différé). Vérif :
  typecheck 5/5, lint, 381 tests moteur (dont combat-hero-attack) + 92 contenu,
  content:check, garde-fous, build, smoke (2 tests C1 desktop+mobile). Golden
  re-fixé (champ heroAttackUsed). IA n'utilise pas l'attaque héro (cohérent avec
  « l'IA ne lance pas de sort ») — parité IA différée.
