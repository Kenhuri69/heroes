# Plan — Identification des assets à générer par LLM (Gemini)

## Objectif

Recenser **tous** les assets qui doivent passer par un LLM image (Gemini /
Nano Banana), croiser avec le staging `assets/` existant, et produire les
prompts prêts à coller. Workflow retenu : *je fournis le prompt, l'utilisateur
fournit l'image générée*, puis extraction/placement via l'outillage
`tools/assets/`.

## Méthode

1. `python3 tools/assets/gen_prompts.py` régénère les 35 fichiers de prompts
   depuis les données (source de vérité). → verify : diff des prompts.
2. Croisement des IDs attendus par les planches (`--ids` de chaque prompt) vs
   les PNG présents sous `assets/`. → verify : script de cross-référence.
3. Classement des manques : **vrai contenu absent** (aucun repli) vs
   **cosmétique** (le client a un repli qui masque le trou). → verify :
   `packages/client/src/render/assets.ts`.

## Rappel des familles (doc 12 §0)

| Règle | Famille | Passe par LLM ? |
|---|---|---|
| P | Tuiles terrain, icônes UI, chrome, blasons | **Non** (procédural, Pillow) |
| A | Sprites d'unités (512² RGBA transparent) | **Oui** — planche + `sheet_extract` |
| B | Avatars de héros (256²) | **Oui** — planche ou grimage photo |
| C | Icônes artefacts, vignettes bâtiments, mines | **Oui** — planche + `sheet_extract` |
| D | Fonds d'ambiance (1920×1080) | **Oui** — pièce unique |
| E | Logo | **Oui** — pièce unique |

Seules les familles **A / B / C / D / E** concernent Gemini. Les tuiles,
icônes d'UI, chrome et blasons sont procéduraux (`gen_tiles.py`,
`gen_ui_icons.py`, `gen_chrome.py`, `gen_faction_badge.py`) et **hors** de ce
lot.

## Résultat du croisement (2026-07-13)

214 sujets référencés par les planches ; **la quasi-totalité est déjà en
staging**. Manques réels après filtrage des faux positifs (ids camelCase) :

### A. Contenu absent — à générer en priorité (aucun repli visuel)

| # | Asset | Règle | Prompt source | Extraction |
|---|---|---|---|---|
| 1 | `grimoire-arcanique` (artefact +1 Pouvoir, nouveau) | C | `assets/prompts/artifacts.md` (planche 4×2, **cell 5**) | `--ids …,grimoire-arcanique` |
| 2 | `vox-arcana-scene` (bâtiment « La Scène / École de la Scène », nouveau) | C | `assets/prompts/buildings-vox-arcana-p2.md` (**cell 1**) | `--ids vox-arcana-scene,…` |
| 3 | `vox-arcana-hermione`, `vox-arcana-rumi` (avatars héros nommés) | B | `assets/prompts/faction-vox-arcana.md` §1 (planche 2×1) | `--ids vox-arcana-hermione,vox-arcana-rumi` |

> Note : l'artefact 1 et le bâtiment 2 sont désormais **des cellules ajoutées
> à une planche existante**. Pour ne pas régénérer toute la planche, option
> image unique via `tools/assets/process_sprite.py` après une génération 1
> sujet sur fond gris `#c8c8c8`.

### B. Cosmétique — repli actif côté client (non bloquant)

Le client fait le repli **unité améliorée → sprite de base**
(`render/assets.ts:83-94`) : le jeu s'affiche correctement sans ces sprites,
mais la parité visuelle avec les autres factions (qui ont des élites distincts)
manque.

| Asset | Règle | Prompt source |
|---|---|---|
| 8 sprites élites Vox Arcana `t1-choeur-elite` … `t8-avatar-elite` | A | `assets/prompts/units-vox-arcana-p2.md` (planche 4×2, entièrement absente) |
| `t1-recruit-elite` (test-faction, placeholder assumé) | A | `assets/prompts/units-test-faction.md` — **skip** sauf demande |

### C. Prompts rafraîchis (art existant OK, aucune régénération d'image requise)

`gen_prompts.py` a réaligné 4 fichiers sur les données courantes :
- `artifacts.md` (4×1 → 4×2, ajout grimoire) — **image à produire** (cf. A#1)
- `buildings-vox-arcana-p2.md` (ajout La Scène) — **image à produire** (cf. A#2)
- `units-haven-p2.md`, `units-necropolis-p2.md` — simple reformulation de
  posture (t6 « charging forward ») ; **les PNG existants restent valables**,
  rien à regénérer.

## Périmètre retenu (décision utilisateur)

**Bloc A (3 manques réels) + les 8 sprites élites Vox Arcana du bloc B.**
`t1-recruit-elite` (test-faction) reste hors périmètre.

## Livraison

- [x] Régénération des prompts (`gen_prompts.py`).
- [x] Croisement complet + classement des manques.
- [x] Ce document consigne l'audit et sert de bon de commande.
- [x] Génération des images par l'utilisateur (Gemini) : bloc A + planche des
      8 élites Vox Arcana — reçues.
- [x] Extraction (`sheet_extract.py`, floodfill déterministe) + QC **verte
      12/12** + copie vers `assets/<famille>/…` :
  - `assets/artifacts/grimoire-arcanique.png` (512² RGBA)
  - `assets/buildings/vox-arcana/vox-arcana-scene.png` (512² RGBA)
  - `assets/heroes/vox-arcana-hermione.png`, `vox-arcana-rumi.png` (256² RGB,
    aplatis sur fond sombre pour matcher les avatars existants)
  - `assets/units/vox-arcana/t{1..8}-…-elite.png` (512² RGBA transparent)

Les IDs de fichiers correspondent aux IDs des données (registre client
auto-découvert via `import.meta.glob`, aucun câblage requis).
