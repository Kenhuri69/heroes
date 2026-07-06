# Plan — Beta 5.1 : cadrage de la 4ᵉ faction (Sylvan Court)

> **Début de la Phase 3 Beta** (doc 09). La Beta comprend un gros item
> **infrastructure** (backend Node.js / PvP asynchrone) qui **requiert des
> décisions d'hébergement/DB/auth relevant de l'utilisateur** — non démarré sans
> direction. Item **autonome et in-paradigme** : la **4ᵉ faction** (doc 09 ligne
> 56), continuation directe du pipeline data-driven prouvé 3× (test-faction,
> Necropolis, Arcane Hunters). Décomposée comme Arcane Hunters (4.1→4.10) :
> **5.1 cadrage** (ce lot, doc) → 5.2 lineup/données → 5.3 `symbiosis` → 5.4
> équilibrage/finitions.

## Décisions de cadrage
- **Faction** : **Sylvan Court** retenue comme **défaut** du créneau
  « vote de la communauté » — mécanique signature la moins coûteuse (1 module de
  combat générique `symbiosis`, **aucun** nouveau point d'extension de framework),
  donc 4ᵉ test de modularité au moindre risque. Choix **réversible** : ce lot ne
  produit qu'un **document** (coût de reprise ~nul si un autre pré-concept est
  préféré).
- **Signature `symbiosis`** : bonus cumulatif Att/Déf tant que la pile ne bouge ni
  n'attaque (Défend/reste), plafonné (max 4 paliers), remis à zéro par une action
  offensive/déplacement. Réutilise l'état de pile existant. Générique, zéro faction.
- **Économie « classique »** (pas de ressource de faction) : variété de preuve vs
  Essence (Arcane) — la modularité tient sans rouvrir ce point d'extension.

## Lots
- [x] Doc de cadrage `docs/14-faction-sylvan-court.md` (gabarit + structure doc 05).
- [x] Roadmap 09 : Beta « 4ᵉ faction » marquée en cours (Sylvan, cadrage).
- [x] `CLAUDE.md` : ajout de `docs/14-*` à la liste de structure.
- [x] Plan à jour.

> Lot **purement documentaire** : pas de code/données modifiés ⇒ smoke non requis
> (guideline §7) ; `content:check` reste vert (aucun contenu touché). Vérif :
> relecture cohérence + garde-fou faction trivialement vert (rien dans `packages/`).

## Suite (hors ce lot)
- **5.2** : `data/factions/sylvan-court/` (manifeste, 7 units, 7 dwellings + 2
  bâtiments propres, locales FR/EN) + `data/factions/index.json` ; test de
  recrutement ; garde-fou faction vert. Scaffold via `pnpm faction:new sylvan-court`.
- **5.3** : point d'extension moteur générique `symbiosis` (ability + interprétation
  dans le tour de combat) + données qui l'exercent + tests unitaires.
- **5.4** : équilibrage `faction:sim` (0 déséquilibre béant, cible 45–55 %) +
  repli procédural d'assets ; smoke étendu (recruter/combattre Sylvan).

## Journal
- **2026-07-06** — Après merge #76 (fin des items implémentables Alpha). Base =
  `origin/main` (5e8e4a2). Cadrage Sylvan Court livré ; démarre la Beta par la 4ᵉ
  faction (l'item backend attend une direction d'infra).
