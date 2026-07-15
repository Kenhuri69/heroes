# Plan — Prompts Gemini manquants : machines de guerre

## Contexte

`tools/assets/gen_prompts.py` dérive des données (`data/`) tous les prompts de
planche LLM (Gemini) des familles A/B/C/D/E (doc 12). Audit de couverture : la
**seule** famille d'entités de jeu définie en données mais **sans prompt** est
`data/core/war-machines.json` (ballista, catapulte, tour de tir). Ce sont des
pièces de combat → **Règle A** (sprites 512² painterly, alpha strict), mais le
générateur ne les émet pas et `assets/units/` n'en contient aucun visuel (repli
procédural en arène).

Toutes les autres familles Gemini ont déjà leur prompt : unités par faction,
artefacts, bâtiments (core + faction), mines, tas de ressources, avatars de
héros (archétypes + nommés), héros/villes/objets/camps de carte, lieux de bonus,
fonds, logo, maisons Vox Arcana, props forêt/montagne, audio.

## Décision

Machines de guerre = contenu **core, faction-agnostique** (pas de `groupId`).
- Style : Règle A, mais sujets = **engins de siège mécaniques**, pas des
  créatures. Palette bois/fer neutre (aucune identité de faction).
- Indices visuels dérivés des capacités (`data/core/abilities.json`) :
  `shooter` → arme à projectile ; `siegeBreaker` → lance de gros rochers ;
  `immobile` → structure fixe.
- Staging : `assets/units/core/<id>.png` (parallèle à `buildings/core/`).
- Approche **data-driven** (guidelines §8) : ajouter une fonction
  `war_machines_sheet()` au générateur qui lit `war-machines.json` + locales,
  jamais un `.md` rédigé à la main.

## Étapes

1. Ajouter `war_machines_sheet()` à `gen_prompts.py`, l'enregistrer dans
   `main()`. → vérif : `python3 tools/assets/gen_prompts.py` crée
   `assets/prompts/war-machines.md`, aucun autre fichier suivi modifié.
2. Relire le prompt produit : grille 3×1, 3 cellules ballista/catapulte/
   arrow-tower avec indices corrects, commande d'extraction `--side 512`,
   dest `assets/units/core/`. → vérif : lecture à l'œil.
3. Partager le contenu du prompt à l'utilisateur.

## Écarts constatés

- Drift pré-existant hors périmètre : le générateur veut désormais scinder les
  artefacts en `artifacts-p1/p2.md` (>8 sujets) et laisse `artifacts.md`
  orphelin. **Non traité ici** (surgical §3) — signalé à l'utilisateur.
- Intégration client (faire consommer `units/core/<id>` par `unitSpriteUrl`
  pour les machines) = lot séparé, hors de cette demande (produire les prompts).
