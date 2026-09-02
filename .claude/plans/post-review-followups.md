# Suite de la revue 2026-09 — reliquats

> Contexte : la revue complète (`.claude/plans/code-review-2026-09.md`, lots
> R1→R10) est **mergée** (PR #547). Ce plan traite les **restes documentés** de
> son bilan, dans l'ordre valeur/risque. Branche repartie de `main`.

## Périmètre

| Lot | Contenu | Bump save ? | État |
|---|---|---|---|
| **A — Équilibrage passe 3** | résorber les **béances de duel** mesurées par `faction:sim` sur **terrain neutre** (la passe 2 avait été calibrée sur la mesure biaisée par le terrain natif). Données pures. | non | ✅ |
| **B — Hygiène P3 client** | couleurs en dur dans du **TSX** (`FactionBadge`, `OutcomeOverlay`, `MiniMap`) → `ui/palette.ts` + **garde-fou CI étendu au TSX** ; plafond d'instances `new Audio` | non | ✅ |
| **C — Contenu** | `startingTown.level` de scénario validé au load (P3 R7 différé) | non | ✅ |
| **Hors périmètre** | snapshot par match (migration D1 en prod — à faire avec l'opérateur), icône PWA maskable (pas d'outil de génération d'image), `map:gen` CLI ≠ options client | — | — |

## Critères de vérification (tous lots)

1. `pnpm typecheck` (5 paquets + smoke-tsc) → vert
2. `pnpm lint` → vert
3. `pnpm test` (moteur **golden inchangé**, contenu, client, serveur) → vert
4. garde-fous CI locaux (zéro faction, couleurs) → verts
5. `pnpm content:check` → vert
6. `pnpm build` (< 800 Ko gzip) + smoke `@core` headless → vert

## Journal

- 2026-09-02 : PR #547 mergée (`61a1284`). Branche repartie de `main`, plan ouvert.

### Lot A — équilibrage passe 3 (données pures)

**Mesure de départ** (`faction:sim`, terrain neutre) : **3 béances** — haven-vs-necropolis
14,6 %, haven-vs-dungeon 84,6 %, arcane-vs-dungeon 84,2 % ; gauntlet étalé 3,0 → 2,2.
Diagnostic chiffré : le Donjon a le plus faible **réservoir de PV par budget**
(1 927 contre 2 231–2 673) et les plus faibles dégâts ; la Nécropole le plus élevé.

**Itérations** (le simulateur est *sensible au seuil* : les duels basculent en bloc) :

| # | Levier | Résultat |
|---|--------|----------|
| 1 | Donjon **+13 % PV** (+ att/dégâts) | renverse le classement : sylvan-vs-dungeon 6,3 %, vox 16,3 % ⇒ toujours 3 béances |
| 2 | Donjon **+5 % PV** seuls | haven 77,1 ✓, arcane 68,8 ✓, mais sylvan 17,9 ✗ ⇒ 2 béances |
| 3 | Donjon **+15 % dégâts** + coupe Nécropole (PV) | les dégâts profitent surtout **contre les fragiles** : sylvan 13,3 ✗, vox 8,3 ✗ ⇒ 3 béances |
| 4 | Donjon **+3,6 % PV** + demi-coupe Nécropole (PV) | 1 béance (haven-vs-necro 17,5) ; gauntlet resserré |
| 5 | idem + Nécropole : **dégâts** rabotés au lieu des PV | **0 béance** ✓ |

**Enseignement réutilisable** : les **PV** pèsent contre les adversaires *fragiles*,
les **dégâts** contre les adversaires *robustes*. Choisir l'axe permet de corriger
un duel sans casser son symétrique — c'est ce qui débloque l'étape 5.

**Livré** : Donjon +1 à +5 PV sur T2–T7 (base **et** élites, parité tenue) ;
Nécropole zombie 14→13 PV et dégâts −1 cran sur Spectre/Vampire/Cavalier/Dragon d'os.
36 lignes de données, **zéro moteur**, pas de bump `CURRENT_SAVE_VERSION`,
**golden inchangé** (les unités de faction ne sont pas celles du replay).

| Duel (hors bande 20–80 avant) | Avant | Après |
|---|---|---|
| haven vs necropolis | 14,6 % ✗ | **27,1 %** |
| haven vs dungeon | 84,6 % ✗ | **74,6 %** |
| arcane-hunters vs dungeon | 84,2 % ✗ | **74,6 %** |
| sylvan vs dungeon (témoin) | 31,7 % | 21,3 % |
| necropolis vs sylvan (témoin) | 26,7 % | 25,0 % |

Gauntlet : 3,0 / 2,8 / 2,7 / 2,5 / 2,3 / 2,3 (avant : 3,0 / 3,0 / 2,8 / 2,3 / 2,3 / 2,2).
Docs 04 §3 et 17 §3 alignées (l'att/déf du T7 Donjon y divergeait déjà des données
depuis le lot 17.4 — corrigé au passage).

### Lot B — hygiène client

`ui/palette.ts` : seul dépôt des littéraux de couleur hors CSS (canvas 2D de la
mini-carte, attributs SVG inline qui ne résolvent pas `var(--…)`). Le garde-fou CI
couvre désormais les `*.tsx` en plus des `*.css` — motif restreint aux hex **entre
guillemets** côté TSX (sinon un `#416` de commentaire déclenche), et l'ordre
`set -e` corrigé (la version naïve faisait échouer l'étape quand tout allait bien).
`playSfx` plafonne les instances `Audio` jetables (8 simultanées, relâchées sur
`ended`/`error`/refus de lecture) — un round de combat pouvait en allouer des
dizaines. Branche `!combat` de `CombatScene.sync()` : **laissée telle quelle**
(elle sert au démontage de fin de combat, la revue la disait « quasi morte » à tort).

### Lot C — contenu

La validation de la ville de départ d'un scénario lisait la tuile de **surface**
même quand la ville est déclarée au souterrain (`level: 1`, L10.2) : mauvaise
couche, donc ville acceptée dans la roche ou refusée à tort. Index empilé
(`(level × height + y) × width + x`, comme `tileIndex` moteur) + refus explicite
d'une couche que la carte n'a pas. 2 tests (couche inexistante ; tuile
franchissable en surface mais pas dessous).
