# Nettoyage des branches fusionnées sur `main`

**Demande** : fermer toutes les branches fusionnées sur `main`, lister celles qui
ont encore des commits à remonter, puis **récupérer le code** qui risquait d'être
perdu.

**Résultat** : sur **210** branches distantes, **209 sont intégralement couvertes
par `main`** et **1 seule** porte du travail en attente (`claude/session-842v9w`,
PR #513 ouverte). **Il n'y a aucun code à récupérer** — voir §3, qui corrige la
première version de ce document.

**La suppression n'a pas pu être exécutée depuis la session** (politique du proxy,
§5) ; la commande prête à jouer est fournie. Lot **purement documentaire** : zéro
diff code/données, donc pas de smoke test (guidelines §7, dernier point).

## 1. Méthode

Deux pièges ont faussé les mesures naïves.

**Clone shallow** : `.git/shallow` présent, 127 commits visibles sur `main` pour
525 PR ⇒ `git branch -r --merged origin/main` ne rendait que **12** branches.
Après `git fetch --unshallow` (1029 commits), la classification devient fiable.

**Squash merges** : le dépôt mélange merges classiques et squash. Une branche
squash-mergée n'est pas ancêtre de `main` alors que son contenu y est. Critères
combinés :

1. **Ancêtre de `main`** (`git merge-base --is-ancestor`) ⇒ entièrement contenue.
2. **Squash-mergée** : tip == `head.sha` d'une PR `merged` (métadonnées des 525 PR).
3. **Réimplémentée** : pour le reste, comparaison **fonctionnelle** — pas
   textuelle (§3).

## 2. Inventaire

| Catégorie | Nb |
| --- | --- |
| Ancêtre de `main` (dont la branche du lot d'inventaire, PR #526) | 178 |
| Squash-mergée (tip == head d'une PR mergée) | 25 |
| Contenu déjà dans `main`, sans PR | 1 |
| **Réimplémentée puis mergée sous une autre forme** (§3) | **5** |
| **Total à supprimer** | **209** |
| **À garder** — `claude/session-842v9w`, PR #513 ouverte | **1** |

Côté PR : 519 mergées, 6 fermées sans merge, 1 ouverte. Aucune PR mergée ne reste
à fermer — un merge ferme la PR.

## 3. Correction : les 5 branches « à récupérer » sont en fait réimplémentées

La première version de ce document annonçait que 5 branches portaient du code
non remonté, dont 2 « perdues si on les supprime ». **C'était faux.** Le critère
n°3 employé alors était la part des **lignes ajoutées** retrouvées dans `main`
(`git grep -F`) : 8 % pour R2, 11 % pour R3, 23 % pour N-ARCS.2. Une métrique
**textuelle** ne voit pas une **réimplémentation** — même fonction, autre code.
La vérification par *fonctionnalité* renverse la conclusion :

| Branche | Ce que `main` contient à la place |
| --- | --- |
| `r2-ecran-ville-outil` | Le lot R2 **entier** (H1/H2/U8) via PR #522, autrement factorisé : repli du panorama par le helper **partagé** `useCollapsed('town.view', narrow)` + `SectionToggle` (la branche refaisait `localStorage` + `matchMedia` en local), nom de marqueur **permanent** `town-view-name` (la branche l'affichait à l'inspection), et clés `town.incomeGoldShort` / `town.growthInShort` (la branche abrégeait les clés de base). Plan R2 versionné dans `main`. |
| `r3-hud-aventure-se-range` | Le lot R3 **entier** via PR #523 : plan `main` R3.1→R3.4 = exactement les constats **H3 / H6 / H7 / U7** des étapes A→D de la branche. |
| `map-design-issues-jhjdy6` | L'arc personnel de Vhalen, sous l'id `vhalen-sceau` (`kind: personal`, 3 étapes, dialogues `dlg-vhalen-1` / `-2` / `-choice`, choix à 2 branches) — structure identique au `vhalen-archives` de la branche. Livré par la vague `n-arcs-*` (PR #302/#303 et voisines). |
| `h-named-roster` | Refaite par `h-named-roster-v2`, **PR #255 mergée** (même lot H-NAMED.1). |
| `code-doc-coherence-remediation` | Lots A→E redécoupés en PR atomiques déjà mergées (cf. `CLAUDE.md`). |

**Leçon** : pour juger si une branche est remontée, comparer les
**fonctionnalités** (symboles, ids de données, constats du plan), jamais la
similarité ligne à ligne — un lot refait proprement ailleurs affiche un
recouvrement textuel faible tout en étant intégralement couvert.

`claude/premier-plan-finaliser-cesdux` (PR #525) a été mergée depuis : elle est
désormais ancêtre de `main`.

## 4. Vérifications de sûreté

- `main` absent de la liste de suppression.
- `claude/session-842v9w` (seule PR ouverte) absente de la liste.
- Aucune autre branche portant une PR ouverte.
- Sauvegarde des tips (`branche <TAB> sha`) prise avant l'opération.

## 5. La suppression est refusée à la session

Les deux voies renvoient **403** — refus de politique, pas une erreur réseau :

- `git push origin --delete …` via le relais git de session (`127.0.0.1/git/…`)
  ⇒ `RPC failed; HTTP 403`, sans échec côté proxy d'egress
  (`recentRelayFailures: []`).
- `DELETE /repos/…/git/refs/heads/…` ⇒ `Write access to this GitHub API path is
  not permitted through this proxy.`

Commande à jouer depuis un poste habilité :

```sh
# xargs -n 20 : par lots de 20 refs, pour ne pas dépasser la ligne de commande
xargs -n 20 git push origin --delete \
  < .claude/plans/merged-branches-cleanup.branches.txt
```

## 6. Les 209 branches à supprimer

```
claude/a1-rules-data-fixes
claude/a2a-combat-capabilities
claude/a2b-combat-capabilities
claude/a2c-combat-debuffs
claude/a2d-devour-marks
claude/a2e-taunt
claude/a2f-poison-sting
claude/a2g-first-strike
claude/a2h-spellcaster
claude/a3a-morale-auras
claude/a3b-swarm
claude/a3c-area-attack
claude/a3d-breath-attack
claude/agathe-hero-character-kb160v
claude/ai-code-ui-blocking-2pgml0
claude/ai-hero-hunt
claude/asset-classification-llm-lvw63t
claude/asset-combat-backgrounds
claude/asset-creation-strategy-tedqm8
claude/asset-grail-vignettes
claude/asset-integration
claude/asset-map-positioning-32gukw
claude/asset-ordering-guardian-town
claude/asset-ordering-issue-dm1j8f
claude/asset-residual-elements-curated
claude/asset-residual-elements-o7u0sw
claude/asset-sheets-production-xl6dmp
claude/asset-sort-related-elements-rdr8jq
claude/battle-scene-graphics-analysis-fcq255
claude/battlefield-ux-improvements-t97xvr
claude/c-siege2-arrow-tower
claude/c-siege2-catapult
claude/c-siege2-catapult-bombard
claude/c-siege2-moat
claude/c-siege2-moat-damage
claude/c-siege2-tower-only
claude/c-siege2-walls
claude/c-spellui-grid-highlight
claude/c-spellui-mastery
claude/c-spellui-school-tabs
claude/c-spellui-zone-list
claude/cap-cast-bibliothecaire
claude/cap-cast-ui
claude/cap-datafix-elite-parity
claude/cap-life-angel-resurrect
claude/cap-life-rebirth
claude/cap-spell-immune
claude/checkerboard-field-mismatch-g14qac
claude/cities-screen-ux-rem6er
claude/cities-screen-ux-wemh1n
claude/code-doc-coherence-remediation
claude/code-review-performance-hv0uel
claude/code-review-remediation-plan-ukl5n9
claude/coffre-gold-xp-ratio-tn22pj
claude/combat-spawn-position-xmiv3g
claude/crossbowman-ranged-attack-u119fx
claude/dark-elf-faction-plan-yuiz5v
claude/dark-elf-faction-plan-yuiz5v-17.3
claude/dark-elf-faction-plan-yuiz5v-17.4
claude/dark-elf-faction-plan-yuiz5v-17.5
claude/dark-elf-faction-plan-yuiz5v-campaign
claude/dark-elf-faction-plan-yuiz5v-campaign23
claude/dark-text-contrast-units-863p95
claude/dungeon-hero-accessibility-uici1g
claude/f-bonus-curse-duration
claude/f-bonus-faction
claude/f-buildeff-5
claude/f-buildeff-6
claude/f-buildeff-aura
claude/f-buildeff-cloister
claude/f-buildeff-morale
claude/f-buildeff-vigile
claude/f-elitevox
claude/f-houses-vox
claude/f-reson-2
claude/f-reson-cap
claude/f-schools-3
claude/f-schools-4
claude/f-schools-5
claude/f-schools-6
claude/f-schools-7
claude/f-schools-8
claude/f-schools-lumiere
claude/f-schools-morale
claude/f-schools-prime
claude/f-skills-battle-prayer
claude/f-skills-battle-prayer-ui
claude/f-skills-faction
claude/fix-skillcatalog-school
claude/fix-spellcatalog-area-chain
claude/forest-assets-issue-itff54
claude/game-assets-generation-yq641e
claude/game-balance-combat-ui-dymnn8
claude/game-code-doc-review-fg3pp5
claude/game-divergence-homm-online-mdnj0k
claude/game-ergonomics-immersion-review-8j8bhr
claude/game-ergonomics-plan-5tr6ak
claude/game-feature-gaps-e64omm
claude/game-features-audit-2asmdy
claude/game-implementation-checklist-hrgj9x
claude/game-review-remediation-plan-kl0y2w
claude/game-setup-map-generation-6ur2r7
claude/game-ux-review-plan-slwa74
claude/gemini-prompts-war-machines-2teezq
claude/generation-options-resources-lw1ve7
claude/h-artequip
claude/h-artequip-army-magic-resistance
claude/h-artequip-grant-spell
claude/h-artequip-loot-backpack
claude/h-artequip-morale-immune
claude/h-artequip-movement
claude/h-artequip-sets
claude/h-artequip-spell-immune
claude/h-artequip-status-immune
claude/h-artequip-typed-slots
claude/h-artequip-vision
claude/h-cond
claude/h-cond-exact
claude/h-named-2
claude/h-named-3
claude/h-named-roster
claude/h-named-roster-v2
claude/h-spells-adventure-march
claude/h-spells-cartography
claude/h-spells-chain
claude/h-spells-dispel
claude/h-spells-resurrect-full
claude/h-spells-summon
claude/h-vs-h
claude/hero-system-tavern-eob1jr
claude/heroes-alpha-adventure-map-lz2u8n
claude/heroes-implementation-phase-2-3-15p00b
claude/heroes-marathon-session-2y6lv4
claude/heroes-marathon-session-pacy61
claude/heroes-mvp-roadmap-nb6kvq
claude/heroes-narrative-polish-plan-o4td5z
claude/hogwath-claude-rules-cww0ph
claude/homm-browser-game-design-gu1yn4
claude/implementation-phase-2-3-w5clgx
claude/incomplete-plan-launch-6gmrai
claude/llm-asset-generation-plants-c5asp7
claude/llm-asset-identification-bo3e1j
claude/m-calendar-creature-week
claude/m-calendar-resource-windfall
claude/m-calendar-xp
claude/m-tavern-4
claude/m-tavern-golden-hotfix
claude/m-tavern-recruit
claude/m-visit-artifact
claude/m-visit-experience
claude/m-visit-mana-well
claude/m-visit-morale
claude/m-visit-war-machine
claude/m-visit-witch-hut
claude/map-assets-monster-layout-skcwgu
claude/map-design-issues-jhjdy6
claude/map-extension-options-8xt11c
claude/map-generation-resources-5mh7ei
claude/map-missing-elements-5j8ozw
claude/map-tiles-expansion-8kaqr1
claude/merged-branches-cleanup-tptm7m
claude/missing-assets-dungeon-dawo4p
claude/missing-game-asset-o64og2
claude/mm-heroes-phase-2-plan-rht00n
claude/multiplayer-hero-visibility-2gxdqj
claude/multiplayer-ux-issues-bcqcb3
claude/n-arcs-marchmont
claude/n-arcs-mere-corbeau
claude/necromancer-hero-olivier-pdz23o
claude/net-lifecycle
claude/net-matchdetail
claude/net-sec-1
claude/net-sec-2
claude/net-srvguard
claude/new-faction-hogwarts-demons-nrth0w
claude/olivier-shadow-assassin-hero-1dbt0s
claude/olivier-shadow-assassin-hero-djwfsv
claude/plan-mvp-implementation
claude/plan-to-finish-iqrgfp
claude/plans-en-cours-faire-gou8ca
claude/pr-490-muraille-gabarit-htkbu7
claude/premier-plan-finaliser-cesdux
claude/r0-plus-jamais-en-silence
claude/r1-plateau-combat-visible
claude/r2-ecran-ville-outil
claude/r3-hud-aventure-se-range
claude/r4-nouvelle-partie-trois-taps
claude/r6-incarnation-finition
claude/r7-hygiene-build-charge
claude/siege-visual-overhaul-gks0p0
claude/siege-visual-remediation-fcr6cf
claude/siege-wall-faction-colors-zbg4ql
claude/spell-cure
claude/t-grail-building
claude/t-grail-dig
claude/t-grail-obelisks
claude/test-performance-optimization-gdbplp
claude/ultracode-remediation-plan-nyatt9
claude/unfinished-plan-cmlo37
claude/ux-design-ergonomics-review-6iru34
claude/ux-heroswap
claude/ux-townview-anchor-tune
claude/ux-townview-backgrounds
claude/ux-townview-painted-layout
claude/ux-townview-painted-scene-mr2kez
claude/ux-townview-polish
claude/vox-arcana-hero-balance-83ppt4
claude/vox-arcana-missing-assets-aqovit
claude/vox-arcane-hunter-hero-g9jtcw
```
