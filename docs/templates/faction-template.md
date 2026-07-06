# Gabarit de design de faction

> Copier ce fichier en `docs/XX-faction-<id>.md` et remplir chaque section avant de lancer `pnpm faction:new <id>`. Une section vide = design pas prêt.

## 1. Identité

| | |
|---|---|
| **Thème** | |
| **Fantasme joueur** (1 phrase : ce que le joueur *ressent*) | |
| **Style de jeu** (agression/tempo/attrition/économie ?) | |
| **Faiblesse assumée** (obligatoire — ce contre quoi elle perd) | |
| **Terrain natif** | |
| **Ressources clés** (paire de rares) | |
| **École de magie** (existante ou propre) | |
| **Couleurs / DA** | |

**Lore (5–10 lignes)** :

## 2. Mécanique signature (UNE seule)

- Description, contre-jeu adverse, plafond anti-snowball prévu.
- Points d'extension nécessaires (viser 0–3 modules ; si un nouveau point d'extension moteur est requis, le décrire de façon **générique**).

## 3. Lineup (7–8 tiers)

| Tier | Unité | PV | Att | Déf | Dégâts | Vit. | Croiss./sem | Coût | Capacités |
|------|-------|----|-----|-----|--------|------|-------------|------|-----------|
| 1 | | | | | | | | | |
| … | | | | | | | | | |

## 4. Bâtiments spéciaux (2–3) + chaîne d'habitations

## 5. Classes de héros (2) + 2 héros nommés avec spécialités

## 6. Compétence de faction (si applicable) — 3 rangs

## 7. Matchups attendus (vs chaque faction existante : pourquoi ~50 % ?)

## 8. Lore & storytelling (chantier narratif — doc 13 §8)

> Ces blocs vivent ensuite dans le paquet (`locales/`, `heroes/named.json`,
> `story/`) — zéro diff moteur, zéro modification des autres maisons.

- **Identité narrative** (comment la faction *parle* : registre, tics de langage ; ce qu'elle croit ; ce qu'elle se cache) :
- **Lecture de l'arc global** (que voit-elle dans le sceau de Cendregarde — ou l'arc courant ?) :
- **Relations aux maisons existantes** (1 phrase par maison en jeu) :
- **Arcs des 2 héros nommés** (3 étapes chacun, incarnant le thème — cf. §5) :
- **Textes d'ambiance** : engagement à fournir un `loreKey` FR/EN par unité/bâtiment/artefact, écrit du point de vue de la faction.
- **Campagne** (optionnelle au premier lot ; 3 chapitres, format doc 13 §6.1) — pitch par chapitre :
