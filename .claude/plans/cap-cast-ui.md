# Lot CAP-CAST (UI) — lancer de sort d'unité jouable à la main

> Backlog §2.2 CAP-CAST « Reste (suivi UI) : bouton de lancer en combat pour une
> pile jouée à la main (A2h ne pilote que l'IA/auto-combat) ». Le moteur supporte
> DÉJÀ le lancer de sort d'unité par le joueur (`CombatAction { action:
> { type: 'castSpell', targetStackId } }` — `validateCombatAction`/`applyCastSpell`) ;
> seul le **bouton client** manquait. **Client-only + petits exports purs.**

## Contexte

Une pile `spellcaster` (ex. Prêtresse Haven, soin ×2) ne peut lancer son sort
embarqué que via l'IA/auto-combat — le joueur humain n'a aucune action pour le
déclencher. Le chemin moteur existe (`castSpell` action de combat), inutilisé UI.

## Changements

- **Moteur (exports purs, zéro logique nouvelle sauf préviz)** :
  - export `spellcasterParams` + `isSilenced` (le client détecte une pile
    lanceuse jouable + le gate de silence sans réimplémenter).
  - `estimateUnitSpell(state, casterStackId, targetStackId)` : préviz du sort
    embarqué avec le **Pouvoir de la capacité** (refactor : cœur partagé
    `estimateSpellWithPower`). Zéro save/golden.
- **Client (`combat.tsx`)** : bouton « Sort (unité) » actif quand la pile active
  du joueur est `spellcaster`, a des charges, non silenciée. Modale de ciblage
  (patron `HeroAttackModal`) — cibles amies/ennemies selon `spellTargetsEnemy(kind)`,
  préviz obligatoire (`estimateUnitSpell`), confirmation ⇒ `CombatAction castSpell`.
  Locales FR/EN.

## Vérification

- typecheck 5/5 · lint · engine tests (golden inchangé) + content · content:check
- garde-fous faction/couleurs · build + bundle < 800 Ko · smoke
  (nouveau : Prêtresse lance son soin à la main) — si scriptable ; sinon noter.

## Journal

- 2026-07-12 — Plan créé, branche `claude/cap-cast-ui` depuis main (@52e5582).
- 2026-07-12 — **Implémenté**. Moteur : exports `spellcasterParams`/`isSilenced`,
  `estimateUnitSpell` (refactor cœur partagé `estimateSpellWithPower`). Client :
  bouton `combat-unit-spell` + `UnitSpellModal` (cibles amies/ennemies selon
  `spellTargetsEnemy`, préviz `estimateUnitSpell`, `CombatAction castSpell`),
  locales FR/EN `combat.unitSpell`. Backlog CAP-CAST « UI livrée ».
  **Vérifs** : typecheck 5/5 ✅, lint ✅, engine (+1 `combat-spellcaster`
  `estimateUnitSpell`, golden + save-shape inchangés) ✅, content:check ✅, parité
  FR/EN ✅, garde-fous faction/couleurs ✅, build + bundle 306 Ko gzip ✅. Zéro
  save/golden. Smoke : non-régression (le bouton rend désactivé hors spellcaster) ;
  l'interaction complète (Prêtresse contrôlée) reste couverte en unitaire — non
  scriptable en smoke faute d'un combat piloté par une pile lanceuse.
