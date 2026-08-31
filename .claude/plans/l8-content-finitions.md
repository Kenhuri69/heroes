# Lot L8 — finitions de contenu : Salle des Reliques & mois des créatures

> Lot 8 du plan `.claude/plans/missing-features-2026-08.md` (**G6**). Deux
> promesses de doc écrites mais jamais livrées.

## 1. Constats

| # | Manque | Source |
|---|---|---|
| a | **Salle des Reliques** (Arcane Hunters) : bâtiment spécifié, « jamais livrée (absente des reports) — différée » | doc 05 §4 |
| b | **« Mois des créatures »** façon HoMM3 (apparition de piles neutres sur la carte) : la table d'événements de mois existe (croissance, ruée, savoir) mais rien ne **peuple** la carte | doc 02 §2.3 |

## 2. Étapes

1. **Salle des Reliques** — UN point d'extension générique : champ d'aura
   `heroAura.learnCircleBonus` (le vocabulaire d'aura existe déjà :
   `movementBonusFlat`, `combatMoraleBonus`, `garrisonDefense`,
   `eliteDamagePct`). Le héros **présent** dans la ville gagne `+N` cercles
   apprenables — la Guilde des mages lui enseigne donc des sorts plus hauts.
   Données AH : bâtiment `arcane-hunters-relic-hall` (1600 or, 3 mercure,
   prérequis Grand Amphithéâtre) + locales.
   → verify: unitaires (aura lue à la visite, sans aura = base) + contenu.
2. **Mois des créatures** — champ générique `CalendarMonthEventDef.spawnCreatures
   { stacks, size }` : à la bascule de mois, `stacks` piles neutres d'une unité
   **tirée au RNG seedé** parmi les recrutables (même patron que `growthUnit`)
   apparaissent sur des tuiles libres. Événement `CalendarCreaturesSpawned`.
   Données : mois `creature-month`.
   → verify: unitaires (spawn déterministe, tuiles libres, no-op sans config).
3. Docs 05 §4 et 02 §2.3 alignées (dont les **divergences assumées**, cf. §3).
4. Vérification complète.

## 3. Divergences assumées (documentées, pas silencieuses)

La Salle des Reliques promettait deux effets. Le lot en livre **un** :

- ✅ « sorts de Traque **+1 cercle d'accès** » → livré en **générique** (tous les
  cercles, quelle que soit l'école). Scoper le bonus par école demanderait de
  faire descendre l'école dans la boucle d'apprentissage de la Guilde, qui
  raisonne aujourd'hui en **cercles** — un deuxième point d'extension pour un
  gain de fidélité mince.
- ⬜ « +1 slot d'artefact *trophée* » → **différé** : `hero.artifacts` est un
  tableau de 10 slots **sérialisé** ; un cap variable change la forme de
  sauvegarde et l'UI de la poupée d'équipement. À traiter avec un lot H-ARTEQUIP.

## 4. Journal

- **2026-08-31 — livré**. Notes :
  - Le prérequis « Grand Amphithéâtre » du doc n'existe **pas** comme bâtiment
    (les Cercles sont gatés sur `mageGuild 1`) : la Salle des Reliques suit la
    même porte, et le doc a été corrigé plutôt que d'inventer un bâtiment.
  - Le tirage d'unité recrutable, dupliqué entre `growthUnit` et le spawn, a été
    factorisé en `pickRecruitableUnit` — une seule écriture de la règle.
  - Le spawn borne ses essais (`stacks × 8`) : une carte saturée accueille moins
    de piles au lieu de boucler, et le RNG consommé reste **borné et
    reproductible** (property testée : mêmes positions à état égal).
  - Aucun RNG n'est consommé sans `spawnCreatures` ⇒ les parties et sauvegardes
    existantes gardent leur séquence (test dédié).

## 5. Vérification (rejouée en entier le 2026-08-31)

- [x] `pnpm typecheck` (5 projets) · `pnpm lint`
- [x] tests **moteur 973/973** (+5 : 3 spawn, 2 aura), contenu 167, client 85
- [x] `pnpm content:check` (7 paquets, 2 cartes, 20 scénarios)
- [x] garde-fou faction · build + bundle **368 020 o gzip** (cap 819 200)
- [x] smoke `@core` **55/55** · `@e2e` **3/3**
- [x] **golden inchangé** — la config du golden n'a ni `calendar` ni aura de
      bâtiment : les deux ajouts y sont des no-op stricts
