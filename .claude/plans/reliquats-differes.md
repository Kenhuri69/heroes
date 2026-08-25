# Reliquats différés (issus des plans clôturés)

> Créé le 2026-08-24 par la passe de clôture (`close-open-plans.md`). Les plans
> archivés ce jour portaient des cases **volontairement** non cochées : des
> chantiers différés par décision, pas des oublis. Ce fichier est le **seul**
> endroit vivant qui les porte — l'archive ne se relit pas.
>
> Ce n'est pas un plan d'exécution : chaque entrée s'ouvre, le jour où on la
> traite, dans son propre plan (guideline §5). Les plans sources cités sont dans
> `.claude/plans/archive/` (clôturés) sauf mention contraire.
>
> **Passe du 2026-08-24** (`reliquats-traitement.md`) : §2, §3 et le crossfade du
> §4 sont **traités**. Reste ouvert : §1 (attend des planches d'images générées
> par l'utilisateur), les 2 niceties écartées par arbitrage du §4, et §5 (roadmap).

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

## 2. Audio — ✅ **traité le 2026-08-24**

- **Ambiances par biome** (Lot 9.3) : **livré**. Les pistes manquaient ⇒ elles
  sont **synthétisées** comme les SFX et les jingles victoire/défaite
  (`tools/assets/gen_ambience.py`, même moule que `gen_sfx.py` : stdlib `wave` +
  ffmpeg, RNG seedé, encodage `-bitexact`) : `assets/audio/ambience/{forest,snow,
  sand,swamp,river}` (~22 s bouclées, crête 0.22). Client : 2ᵉ canal SOUS la
  musique (`AMBIENCE_MIX`), clé résolue par le terrain foulé par le héros actif
  (`ambienceKey`, pur + testé), silence pour un terrain sans piste, coupé par le
  mute et par un volume musique à 0.
  *Reste possible (pas un blocage)* : remplacer une nappe synthétique par une
  vraie prise de son — même nom de fichier, zéro ligne de code.
- **Sprint S5 « monde qui respire & audio »** (`phase-alpha-e2e-ergonomics`) :
  son seul contenu résiduel était ce point ⇒ **épuisé**.

## 3. Polish visuel du siège — ✅ **traité le 2026-08-24**

L'entrée recopiait la case non cochée de `siege-visual-overhaul` Lot 3, écrite
**avant** les itérations de remédiation qui ont suivi. Vérification item par item
sur le code livré :

| Item Lot 3 | État | Preuve |
|---|---|---|
| props d'obstacles **peints** | déjà livré | `assets/combat/obstacle-rock-{1,2,3}.png` + `CombatScene.syncObstacles` (« item 4a ») ; `drawBoulder` n'est plus que le repli |
| **FX de bombardement** calés sur la scène | déjà livré | `WallBombarded` ⇒ `spawnProjectile(shape:'boulder')` + `spawnRubbleImpact`, impact recalé sur `layout.wallX` (« item 3 ») |
| **tour de tir** intégrée à l'enceinte | déjà livré | `siege-piece-arrow-tower[-<faction>]` + ruine `-razed` (« itération 9 »), `syncStructureRuins` |
| **machines de guerre** | déjà livré | `assets/units/core/{catapulte,ballista,first-aid-tent,ammo-cart,arrow-tower}.png` résolus par `unitSpriteUrl` (repli core) |
| **porte ouverte/brisée** | **livré ce jour** | `gen_siege_gate_broken.py` (art dérivé de la matière peinte) + `isGateBroken` + bascule des tranches dans `CombatScene` |

Voir aussi `docs/19-analyse-graphique-siege.md`.

## 4. Niceties écartées par arbitrage (valeur/coût)

- **Filtre par catégorie** du journal de combat (`e14`) : taggerait chaque
  événement de `combat-log.ts` — plomberie disproportionnée ; le filtre texte
  livré couvre le besoin.
- **« Équilibrer » la garnison** (`game-ergonomics-immersion-review` Lot 4) :
  périmètre ambigu (quelle répartition ?), les transferts en un geste sont livrés.
- ~~**Crossfade / titre vivant** de la fin de partie (Lot 7, items 4-5)~~ →
  **livré le 2026-08-24** : `OutcomeOverlay.css` — l'art arrive en fondu long, le
  voile de lisibilité se pose après, le panneau entre sur un battement et le
  titre se resserre en place ; coupé en `prefers-reduced-motion` et par l'option
  de jeu. CSS seul, tokens seuls.

## 5. Gros chantiers à cadrer séparément

`game-ergonomics-immersion-review` **Lot 10** (P3) et, plus largement, les manques
inventoriés dans `game-feature-gaps.md` (document vivant, reste en racine). Ces
chantiers relèvent d'une décision de roadmap (doc 09), pas d'un lot d'ergonomie.
