# Reliquats différés (issus des plans clôturés)

> Créé le 2026-08-24 par la passe de clôture (`close-open-plans.md`). Les plans
> archivés ce jour portaient des cases **volontairement** non cochées : des
> chantiers différés par décision, pas des oublis. Ce fichier est le **seul**
> endroit vivant qui les porte — l'archive ne se relit pas.
>
> Ce n'est pas un plan d'exécution : chaque entrée s'ouvre, le jour où on la
> traite, dans son propre plan (guideline §5). Les plans sources cités sont dans
> `.claude/plans/archive/` (clôturés) sauf mention contraire.

## 1. Planches d'assets à générer (skills `asset-*`)

Bloqué sur une session de génération d'images dédiée (prompts déjà écrits).

| Reliquat | Source | Prompts prêts |
|---|---|---|
| Vignettes de **bâtiments événement** + bâtiments core | `game-ergonomics-immersion-review` Lot 6 (item 3) | oui |
| Planches **unités / avatars / ville** restantes | idem (items 4-6) | oui |
| **Fonds de combat** par terrain (8) | idem, Lot 6 tail | oui |
| Planches d'unités **Sylvan Court** (`assets/units/`) | `map-design-issues` §suivi | oui |
| **Tas de ressources** (`assets/resources/pile-<res>.png`) | idem (`gen_prompts.py`, famille `resource-piles`) | `assets/prompts/resource-piles-p1/p2.md` |

Chaîne connue : générer la planche (Gemini) → `_incoming/` → extraction QC du
skill `asset-sheet` → staging `assets/` → aucun câblage client (registre
auto-découvert). Voir aussi `llm-asset-generation-plants.md` (resté en racine :
il attend les images de l'utilisateur).

## 2. Audio

- **Ambiances par biome** (`game-ergonomics-immersion-review` Lot 9.3) : dépend
  de pistes audio à produire ; l'infra de résolution par faction/contexte est
  livrée (`factionTrack`, repli générique) ⇒ un dépôt de piste suffira.
- **Sprint S5 « monde qui respire & audio »** (`phase-alpha-e2e-ergonomics`) :
  optionnel, jamais arbitré ; son contenu se réduit désormais à ce point.

## 3. Polish visuel du siège

`siege-visual-overhaul` **Lot 3** (après retour porteur) : props d'obstacles
peints, FX de bombardement calés sur la scène, tour de tir intégrée à l'enceinte,
porte ouverte/brisée, machines de guerre. Voir aussi `docs/19-analyse-graphique-siege.md`.

## 4. Niceties écartées par arbitrage (valeur/coût)

- **Filtre par catégorie** du journal de combat (`e14`) : taggerait chaque
  événement de `combat-log.ts` — plomberie disproportionnée ; le filtre texte
  livré couvre le besoin.
- **« Équilibrer » la garnison** (`game-ergonomics-immersion-review` Lot 4) :
  périmètre ambigu (quelle répartition ?), les transferts en un geste sont livrés.
- **Crossfade / titre vivant** de la fin de partie (Lot 7, items 4-5).

## 5. Gros chantiers à cadrer séparément

`game-ergonomics-immersion-review` **Lot 10** (P3) et, plus largement, les manques
inventoriés dans `game-feature-gaps.md` (document vivant, reste en racine). Ces
chantiers relèvent d'une décision de roadmap (doc 09), pas d'un lot d'ergonomie.
