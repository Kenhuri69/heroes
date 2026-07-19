# Plan — Alpha 4.16 : sorts d'aventure (Ville-portail)

> Dernier tiers de l'item roadmap doc 09 ligne 47. Contrairement aux 4.14/4.15
> (client seul), celui-ci **ouvre un vrai sous-système moteur** : lancer un sort
> **hors combat** sur la carte. Sort phare = **Ville-portail** (nommé dans la
> roadmap). Point d'extension **générique** (kind `adventure` + effet déclaratif),
> ré-exerçable en pure donnée (Vision, etc.) plus tard.

## Conception (générique, data-driven, zéro faction)
- **Sort d'aventure = nouveau `kind: 'adventure'`** portant un effet déclaratif
  `adventure: { type: 'townPortal' }` (union extensible). Schéma + `SpellDef`.
- **Commande** `CastAdventureSpell { heroId, spellId, playerId, townId? }` :
  hors combat, joueur actif, héros à lui, sort connu ET de kind `adventure`,
  mana suffisante. `townPortal` : téléporte le héros vers la ville possédée
  **cible** (`townId`) ou la **plus proche** par défaut ; révèle le brouillard ;
  décompte la mana. Événement `AdventureSpellCast`.
- **Modèle de mana carte** : le héros a déjà `mana=manaMax` au `StartGame`. On
  **restaure la mana chaque jour** (comme les points de mouvement) dans
  `EndTurn`. Le combat garde son remplissage propre (`initHeroMana`) → équilibre
  combat inchangé. **Golden re-fixé** si la restauration modifie l'état sérialisé.

## Lots
- [x] Moteur : `SpellKind += 'adventure'` + `SpellDef.adventure` (types) ;
  `spellSchema` (kind + champ `adventure` + refine) ; `CastAdventureSpell`
  (commande + event `AdventureSpellCast`) ; `validateCastAdventureSpell`/
  `handleCastAdventureSpell` (hero/index.ts) ; câblage `core/engine.ts`
  (GAME_OVER_BLOCKED, validate, handlers) ; **restauration quotidienne de la
  mana** dans `EndTurn`.
- [x] Données : `data/core/spells.json` (Ville-portail, cercle 3, kind adventure)
  + locales FR/EN `spell.ville-portail`. **Bonus** : `buildSpellCatalog` propageait
  déjà pas `marks` (bug latent applyMarks côté client) — corrigé en même temps
  que l'ajout de `adventure`.
- [x] Tests moteur (`hero-adventure-spell.test.ts`, 7 cas) : téléporte vers ville
  possédée + mana décomptée + brouillard révélé ; rejets (en combat, mana
  insuffisante, hors ville, sort non-aventure) ; restauration quotidienne de la
  mana. **Golden INCHANGÉ** (le héros golden a Savoir 0 ⇒ manaMax 0 ⇒ restauration
  no-op) — pas de re-fix nécessaire.
- [x] Client : `AdventureSpellbook` (tiroir héros) + toast `AdventureSpellCast`,
  i18n. Bouton « lancer » ⇒ `CastAdventureSpell` (Ville-portail → ville la plus
  proche, sans `townId`).
- [x] Smoke : éloigner le héros puis lancer Ville-portail ⇒ saut sur la ville de
  départ + mana −16. Desktop + mobile.
- [x] Docs 02 §1.4 + roadmap 09. Plan à jour.

## Écarts / décisions constatés
- **Golden intact** : la restauration quotidienne de mana ne modifie pas le golden
  (héros de test à Savoir 0). Aucun re-fix.
- **Correctif adjacent `marks`** : `buildSpellCatalog` (content) reconstruisait le
  sort en oubliant `marks` — le moteur le lit pourtant. Propagé (+ `adventure`).
- **Coût en mouvement** de la téléportation différé (v1 = mana seule).
- Le sort `adventure` ne se lance jamais en combat (`validateCastAdventureSpell`
  rejette si combat ; `estimateSpell` combat-only inclut le kind par exhaustivité).

## Invariants
Moteur pur, RNG seedé (téléportation déterministe, pas de RNG), **zéro nom de
faction**, **golden re-fixé explicitement avec note**, budget < 800 Ko, anti-gel,
garde-fou faction local, smoke desktop + mobile.

## Journal
- **2026-07-06** — Création après merge #72 (hot-seat 4.15). Base = `origin/main`
  (edb7e99). Cadrage : sort d'aventure = kind `adventure` générique + commande
  hors combat + restauration quotidienne de la mana ; Ville-portail = 1ᵉʳ effet.
- **2026-07-06** — Implémentation complète. Tout vert : typecheck 4/4, lint,
  281 tests moteur (golden inchangé), 70 contenu, `content:check`, build (~234 Ko
  gzip < 800), smoke desktop + mobile (nouveau cas Ville-portail) + suite complète
  (un flake connu `tap-tap` sous charge, vert en isolation ; CI retries=2),
  garde-fou faction propre. **Fin de l'item roadmap ligne 47.**
