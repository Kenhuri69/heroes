# E4.3 — Butin partagé en coop (doc 18 E4, suite de E4.2/E4.2b)

## Contexte

Coop PvE livré (E4.2 gardien, E4.2b siège, E4.5 client). L'**XP** se partage
déjà à égalité entre les héros propriétaires survivants du camp vainqueur
(`grantHeroCombatXp` via `coopAttackerOwners`). Reste le **butin** (doc 18 E4.3 :
« XP & butin partagés »).

## État des lieux

- Seul le **butin de gardien** (`rewardGuardianDefeat`, adventure/guardian-reward.ts)
  est un loot divisible : **or** + **ressource** (→ `player.resources`) +
  **artefact** (→ `hero.artifacts`/`backpack`). Aujourd'hui tout va au **lead**.
- Siège : pas de loot divisible (la ville va au lead — indivisible).
- Contrat de chasse (`rewardHuntContract`) : propre au lead (il porte le contrat)
  ⇒ **hors périmètre**.
- Effets de faction post-victoire (nécromancie) : appliqués au lead ⇒ hors
  périmètre (E4.4/faction).

## Décision de design

Miroir de l'XP (décision utilisateur « égal entre les héros du camp ») :

- **Or & ressources (divisibles)** : partage **égal** entre les **joueurs**
  co-participants (lead + alliés dont une pile a survécu, `coopAttackerOwners`).
  Reste de division → au **lead** (déterministe, somme exacte préservée).
- **Artefact (indivisible)** : au **lead** (l'invitant), fidélité « l'hôte
  ramasse la trouvaille ».
- **Événement `GuardianVanquished`** : inchangé (rapporte le **total** lâché par
  le gardien + `playerId` du lead) — sémantique « drop du gardien », zéro churn
  event/client. Simplification assumée en coop (le total ≠ la part du lead).

## Invariants

- Aucun **nouveau tirage RNG** (distribution = arithmétique post-tirage) ⇒
  séquence identique ⇒ **golden épargné** ; solo (n=1) **bit-identique** (le lead
  reçoit tout). Config `guardianReward` absente ⇒ no-op (inchangé).
- Pas de bump save (aucun champ sérialisé nouveau). Zéro faction moteur.

## Étapes

1. `rewardGuardianDefeat(..., coopHeroIds?)` : collecte les joueurs participants
   (lead + owners distincts), split or/ressource via helper `distributeEqually`.
   → verify: test coop (2 joueurs) ⇒ or/ressource ~moitié chacun, artefact au lead ;
     solo ⇒ inchangé.
2. `turns.ts applyConsequences` : passe `[...coopAttackerOwners(combat)]` à
   `rewardGuardianDefeat`.
   → verify: 904+ engine, golden inchangé.
3. Test `combat-coop.test.ts` : gardien riche gagné en coop ⇒ les 2 joueurs
   reçoivent de l'or ; l'artefact (si tombé) au lead.
4. Docs 02 §6 + 18 E4 + ce plan.
   → verify: typecheck/lint/tests/content:check/guardrail/build/budget/smoke.

## Statut

- [x] **LIVRÉ**. `rewardGuardianDefeat(…, coopHeroIds?)` + helpers `rewardPlayers`
      (joueurs distincts, lead d'abord) / `distributeEqually` (reste au lead, somme
      exacte). Câblé dans `turns.ts` (`[...coopAttackerOwners(combat)]`). Or &
      ressource partagés ; artefact au lead ; événement = total. Solo bit-identique
      (n=1), **golden inchangé** (zéro tirage ajouté), pas de bump save, zéro
      faction. 2 tests `guardian-reward.test.ts` (split coop + solo identique).
      Vérif : typecheck ✓, 906 engine ✓, golden ✓.
