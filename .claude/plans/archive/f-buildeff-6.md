# Lot F-BUILDEFF.6 — Vox : La Scène (production de Résonance)

> Backlog `.claude/plans/game-feature-gaps.md` §2.3 F-BUILDEFF.6+.
> Doc source : `docs/16-faction-vox-arcana.md` §5 (« La Scène (Amphithéâtre) —
> Production / bonus de **Résonance** », prérequis Fort).

## But

Ouvrir un point d'extension moteur **générique** : un effet de bâtiment
`factionResourceIncome { resource, amount }` qui crédite chaque jour une
**ressource de faction** (`player.factionResources`, plafonnée) — parallèle du
`income` de ressources communes. Câbler le bâtiment **La Scène** de Vox (produit
de la Résonance/jour). Zéro nom de faction dans le moteur.

> Note : le **Sanctuaire du Honmoon** du doc = habitation T8 (Avatar) déjà livrée
> (`vox-arcana-dwelling-t8`). Le seul bâtiment manquant est **La Scène**.

## Décisions de conception

- **Générique** : nouvel effet `factionResourceIncome { resource: string (opaque),
  amount }`. Le moteur ne connaît aucune ressource nommée.
- **Plafond** : réutilise le cap de la ressource (F-RESON.1) — lu du bonus
  `gainFactionResourceOnVictory` du `factionCatalog[town.factionId]`. Inline dans
  economy.ts pour éviter un cycle d'import (economy ↔ faction/effects via
  state-helpers). Cap absent ⇒ non plafonné.
- **Câblage** : au `DayStarted`, dans `applyDailyIncome`, une 2ᵉ branche crédite
  `player.factionResources` (comme le gold income des bâtiments). Silencieux (pas
  d'event → pas de toast quotidien ; la barre de ressources montre la croissance).
- **Pas de nouvel état persisté** ⇒ **pas de bump save, golden inchangé**.

## Étapes

1. Engine `town/types.ts` : effet `factionResourceIncome`.
2. Content `schemas.ts` : variante `factionResourceIncome` au `buildingEffectSchema`.
3. Engine `town/economy.ts` : branche `factionResourceIncome` dans `applyDailyIncome`
   (crédit plafonné) + helper local de cap.
4. Données `data/factions/vox-arcana/` : bâtiment `vox-arcana-scene`
   (`factionResourceIncome { resource: resonance, amount }`, requires fort) +
   `manifest.buildings` + locales FR/EN.
5. Doc 16 §5 : La Scène livrée.
6. Tests : engine (crédit quotidien plafonné, autre joueur non, cap respecté) ;
   content (le bâtiment valide, `content:check`).
7. Pipeline complet.

## Journal

- Branche `claude/f-buildeff-6` créée depuis main (76f95f7).
- **Livré.** Effet générique `factionResourceIncome { resource, amount }` (type
  moteur + schéma + cross-validation loader). Branché dans `applyDailyIncome`
  (crédit quotidien plafonné, helper local `factionResourceCapFor` inline pour
  éviter le cycle economy↔faction/effects). Données : bâtiment `vox-arcana-scene`
  (La Scène, requiert Fort, +5 Résonance/jour) + locales FR/EN. Doc 16 §5 +
  État 16.11. Sanctuaire du Honmoon = T8 dwelling déjà livré (noté).
- Aucun état persisté nouveau ⇒ **pas de bump save, golden inchangé**.
- Vérifs : typecheck 5/5, lint, engine 634 (+4 `building-faction-income`), content
  119, content:check, garde-fous faction+couleurs verts, build, bundle ~294 Ko
  gzip < 800, smoke 170 passed.
