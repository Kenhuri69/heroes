# C-HEROSPRITE — Présence visuelle du héros en combat (backlog §2.1, 🎨 S)

Doc 08 §2.4 : le plan C1 a livré `HeroAttack` + HUD, mais le héros n'a aucune
présence sur le canvas de combat — un sort ou une frappe héroïque « sort de
nulle part ». Spec : jeton statique aux flancs de la grille (réutilise
l'avatar `heroes/<faction>-<archétype>`), animation légère au lancer de sort
et à l'attaque héroïque. Client pur (CombatScene), zéro moteur.

## Étapes

1. [x] `CombatScene` : couche `heroLayer` (entre plateau et piles), un jeton
   par camp AVEC héros (`attackerHeroId` à gauche, `defenderHeroId` à droite,
   centrés verticalement hors grille) — cadre circulaire + avatar chargé en
   async (repli disque + initiale), même garde `destroyed` que les jetons.
2. [x] Animations : sur `SpellCast` (camp résolu par heroId) et `HeroStruck`
   (camp dans l'événement), petite ruée du jeton vers le plateau puis retour
   (tween existant) ; retour visuel sur la cible — chiffres de dégâts/soin
   réutilisés (`spawnDamageNumber`/`spawnHealNumber`) selon la nature du sort
   (le lancer de héros n'avait AUCUN feedback canvas).
3. [x] Nettoyage à la fermeture du combat (sync sans combat) + reconstruction
   à l'ouverture.
   → vérif : typecheck/lint/build + smoke combat complet (les tests sort du
   héros / attaque héroïque exercent les nouveaux chemins d'animation) ;
   `prefers-reduced-motion` respecté (tween coupé comme les secousses).
