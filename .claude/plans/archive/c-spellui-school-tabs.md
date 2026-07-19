# C-SPELLUI.1 — Grimoire feuilletable par école (onglets)

Backlog: game-feature-gaps.md « C-SPELLUI ». Doc 08 §2.3 (« grimoire feuilletable par école »).
Sous-lot 1/N : présentation seule. Zéro moteur, zéro bump save, golden inchangé.

## Constat
`SpellBook.tsx:190-241` — liste plate : toutes les écoles empilées (h3) puis
cercles (h4). Doc 08 §2.3 demande un grimoire *feuilletable par école*.
Séparation combat/aventure déjà faite (AdventureSpellbook.tsx). Zone/ciblage-hex
= sous-lot suivant (moteur helper + surbrillance grille).

## Étapes
1. SpellList → onglets par école (une école visible), défaut = 1re école ordonnée.
   Cercles conservés dans l’onglet actif. → verif: typecheck + lint.
2. a11y : onglets = boutons ≥44px, role=tab/tablist/tabpanel, aria-selected.
3. Locales : rien de neuf (réutilise school.<x>). CSS onglets (tokens.css only).
4. Smoke : le test sort existant clique l’onglet « neutral » avant eclair-magique.
   → verif: pipeline complet + smoke vert.
5. Doc 08 §2.3 : note « onglets » dans l’état 3.2.

## Vérif finale
typecheck·lint·vitest engine (golden+save-shape inchangés)·vitest content·
content:check·garde faction (1)·garde couleur (1)·build·bundle<800Ko·smoke.

## Statut
Étapes 1-5 implémentées. Pipeline non-smoke vert (typecheck·lint·engine·content·content:check·gardes 1/1·build·bundle 318Ko). Smoke en cours.
