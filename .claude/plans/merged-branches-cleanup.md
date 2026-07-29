# Nettoyage des branches fusionnées sur `main`

**Demande** : fermer toutes les branches fusionnées sur `main`, et lister celles
qui ont encore des commits à remonter.

**État** : analyse terminée et vérifiée. **La suppression n'a pas pu être exécutée
depuis cette session** (politique du proxy, voir §4) — la commande prête à jouer
est fournie. Ce lot est **purement documentaire** : zéro diff code/données, donc
pas de smoke test (guidelines §7, dernier point).

## 1. Méthode (et pourquoi la première mesure était fausse)

Le clone de session était **shallow** (`.git/shallow`, 127 commits visibles sur
`main` pour 525 PR) : `git branch -r --merged origin/main` ne rendait que
**12** branches. Après `git fetch --unshallow` (1029 commits sur `main`), la
classification devient fiable.

Trois critères combinés, parce que le dépôt mélange merges et **squash merges**
(un squash rend la branche non-ancêtre de `main` alors que son contenu y est) :

1. **Ancêtre de `main`** (`git merge-base --is-ancestor`) ⇒ entièrement contenue.
2. **Squash-mergée** : tip de la branche == `head.sha` d'une PR `merged` (métadonnées
   GitHub des 525 PR, agrégées et dédupliquées).
3. **Contenu présent** : pour les branches restantes, part des lignes ajoutées
   (`> 25` car.) retrouvées dans l'arbre de `main` (`git grep -F`).

Résultat sur **209** branches distantes (hors `main`) :

| Catégorie | Nb |
| --- | --- |
| Ancêtre de `main` (fusion classique) | 176 |
| Squash-mergée (tip == head d'une PR mergée) | 25 |
| Contenu déjà dans `main`, sans PR (`plan-mvp-implementation`, 110/111 lignes) | 1 |
| **Total à supprimer** | **202** |
| **À garder — commits non remontés** | **7** |

Côté PR : 517 mergées, 6 fermées sans merge, 2 ouvertes (aucune PR mergée ne
reste à fermer — un merge ferme la PR).

## 2. Les 7 branches ayant des commits à remonter sur `main`

Classées par ce qu'il reste à en faire.

### En cours — PR ouverte, à merger normalement

| Branche | PR | Commits | Contenu |
| --- | --- | --- | --- |
| `claude/premier-plan-finaliser-cesdux` | **#525 ouverte** | 1 (à jour avec `main`, 0 en retard) | Lot R5b — jeton de héros de repli dans le décor |
| `claude/session-842v9w` | **#513 ouverte** | 3 (37 en retard) | UX menus de départ : audit + allègement « Nouvelle partie » (NG-P0) + contraste du menu |

### Travail réel jamais remonté — décision requise

| Branche | PR | Commits | Contenu |
| --- | --- | --- | --- |
| `claude/r2-ecran-ville-outil` | aucune | 3 (`wip`, 842+/92−, 10 fichiers) | `TownScreen.tsx`, `town.css`, `townView.ts` + test, smoke, docs 02/08 |
| `claude/r3-hud-aventure-se-range` | aucune | 4 (`wip`, 578+/61−, 10 fichiers) | HUD d'aventure : barre d'actions, fondu de ressources, plafond de villes |
| `claude/map-design-issues-jhjdy6` | #289 fermée sans merge | 1 (155+/8−, 7 fichiers) | N-ARCS.2 — arc personnel de Vhalen (Necropolis) |

⚠️ **Piège sur R2/R3** : `main` contient bien des commits « lot R2 » (`3c703b43`)
et « lot R3 » (`37395265`), mais ils viennent de `premier-plan-finaliser-cesdux`
(PR #522/#523) et **portent sur d'autres fichiers** (`assets/layouts/town-*.json`)
— pas sur `TownScreen.tsx`/`town.css`. Ce sont deux implémentations distinctes du
même lot : seulement 8 % (R2) et 11 % (R3) des lignes de ces branches existent
dans `main`. Le code de ces deux branches est donc **perdu si on les supprime**.

### Superseded — contenu refait ailleurs, suppression probablement sans risque

| Branche | PR | Pourquoi |
| --- | --- | --- |
| `claude/h-named-roster` | #253 fermée sans merge | Refaite par `claude/h-named-roster-v2` (**PR #255 mergée**, même lot H-NAMED.1) |
| `claude/code-doc-coherence-remediation` | #136 & #156 fermées sans merge | Lots A→E redécoupés en PR atomiques déjà mergées (cf. `CLAUDE.md`) ; 21 % des lignes retrouvées dans `main`, 64 fichiers, 802 commits de retard |

## 3. Vérifications de sûreté passées

- `main` absent de la liste de suppression.
- Aucune des 7 branches à garder n'est dans la liste de suppression.
- Aucune branche portant une PR **ouverte** dans la liste de suppression.
- Sauvegarde des 210 tips (`branche <TAB> sha`) prise avant l'opération.

## 4. Blocage : la suppression est refusée à cette session

Les deux voies renvoient **403**, ce n'est pas une erreur réseau à réessayer :

- `git push origin --delete …` via le relais git de session
  (`127.0.0.1/git/…`) ⇒ `RPC failed; HTTP 403`. Le proxy d'egress ne
  rapporte aucun échec (`recentRelayFailures: []`) : le refus vient du relais.
- `DELETE /repos/…/git/refs/heads/…` ⇒
  `Write access to this GitHub API path is not permitted through this proxy.`

Commande à jouer depuis un poste ayant les droits (la liste est en §5) :

```sh
# xargs -n 20 : par lots de 20 refs, pour ne pas dépasser la ligne de commande
xargs -n 20 git push origin --delete \
  < .claude/plans/merged-branches-cleanup.branches.txt
```

## 5. Les 202 branches à supprimer

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
claude/map-extension-options-8xt11c
claude/map-generation-resources-5mh7ei
claude/map-missing-elements-5j8ozw
claude/map-tiles-expansion-8kaqr1
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
claude/r0-plus-jamais-en-silence
claude/r1-plateau-combat-visible
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
