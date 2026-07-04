# 11 — Plan d'implémentation Phase MVP : partie HoMM complète

> **Suite directe du doc 10.** La Phase 2 du projet (bootstrap → boucle
> jouable : carte, combat hex, XP, sauvegarde, i18n, menu) est **livrée**. Ce
> document découpe la **Phase MVP de la roadmap (doc 09 § Phase 1)** en
> sous-phases `3.x` implémentables et déployées en continu sur
> `https://kenhuri69.github.io/heroes/`, sur le même modèle que le doc 10.

**Objectif de sortie** (doc 01 §5) : une **partie solo complète** jouable
desktop + mobile — construire une ville, recruter et faire croître une armée,
apprendre des compétences et des sorts, explorer, livrer des combats, gagner
un scénario contre une IA d'aventure — avec deux factions complètes (Haven,
Necropolis) et 60 fps mobile. Critère de modularité n°1 : la Nécromancie
passe **entièrement par le pipeline de contenu**, zéro `if faction` dans le
moteur.

**Conformité** : applique les invariants du README / guidelines §8 (moteur
sans faction, déterminisme RNG seedé, moteur sans rendu, touch-first), la
méthode d'orchestration (`.claude/prompts/lancer-phase.md` : cadrage → surfaces
figées → lots Sonnet parallèles → intégration → PR) et les garde-fous CI
existants (typecheck/lint/tests/golden replay/content:check/smoke/budget
bundle < 800 Ko gzip).

## Acquis de la Phase 2 (socle réutilisé)

- Moteur pur `apply(state, cmd) → {state, events}`, RNG PCG32 seedé, golden
  replay, sérialisation ; carte d'aventure (A* 8 dir, brouillard, ramassage) ;
  combat hex 12×10 complet (initiative, riposte, dégâts, moral/chance, 6
  capacités, IA + auto-combat) ; XP/niveau/attributs du héros.
- Pipeline de contenu : schémas Zod (manifest, unit, config, map),
  `loadContent`/`loadMap`, règles croisées, CLI `faction:new/validate`,
  `content:check`, locales core + paquets.
- Client Pixi 8 + Preact : scènes aventure/combat, store, dispatch, bus
  d'événements, i18n FR/EN, sauvegarde IndexedDB gzip, menu, passe mobile.

## Écarts assumés vs roadmap (tranchés ici, révisables)

| Sujet | Roadmap | Décision MVP |
|---|---|---|
| Ordre des piliers | non ordonnés | **villes d'abord** (prérequis économique : recruter alimente armées et combats), puis héros (compétences/sorts), puis factions complètes, puis scénarios/IA |
| Vue de ville | « liste d'abord, vue peinte simple » | **liste d'abord** en 3.1 ; vue peinte simple si le temps le permet en 3.6 |
| Upgrades d'unités | post-MVP (Alpha) | hors scope MVP (confirmé doc 01 « Exclus ») |
| Hot-seat local | « si le temps le permet, sinon Alpha » | **Alpha** — le MVP vise le solo vs IA |

---

## Découpage en sous-phases

Chaque sous-phase = un incrément déployé + critères vérifiables + smoke étendu
+ docs à jour dans le même lot. Priorités P0 = bloque la suite, P1 = cœur.

### Phase 3.1 — Villes & town building (P0, ~2 semaines)

*Le maillon manquant du core loop HoMM (doc 02 §4).*

1. **Moteur** : `TownState` dans `GameState` (bâtiments construits,
   file d'attente de recrutement, propriétaire, garnison) ; commandes
   `BuildStructure` (1/ville/jour), `RecruitUnits` (débité des ressources +
   stock), `CaptureTown` ; croissance hebdomadaire au `WeekStarted` (stock
   plafonné 2 semaines) ; revenu quotidien (or + ressources) au `DayStarted` ;
   capture (ville sans garnison ⇒ immédiate ; règle « 7 jours pour reprendre
   une ville sinon défaite » — doc 02 §4.1). → vérif : unitaires (1 build/jour
   rejeté au 2ᵉ, recrutement plafonné au stock, revenu au bon jour), property
   (« or ≥ 0 »), golden étendu.
2. **Contenu** : schéma `building` (id, prérequis, coût, effets déclaratifs :
   `dwelling(tier)`, `income(resource, n)`, `growthBonus`, `mageGuild(level)`,
   `capitol`, `fort`), schéma `hero`/`town` du manifeste ; ville de départ
   dans `config.newGame`. Bâtiments communs (doc 02 §4.1) en données core,
   habitations par faction. → vérif : `content:check` valide l'arbre
   (prérequis résolubles, coûts en ressources connues).
3. **Client** : écran de ville en **liste** (arbre de bâtiments, construire ;
   recruter par tier ; garnison), bouton [Ville] du layout (doc 08 §2.1),
   toasts revenus/croissance. → vérif : smoke « construire un bâtiment,
   recruter une unité, l'armée du héros augmente ».

### Phase 3.2 — Compétences, sorts & artefacts du héros (P1, ~2 semaines)

Réf doc 02 §1.1–§1.4. Dépend de 3.1 (Guilde des mages).

1. **Moteur** : 12 compétences secondaires (3 rangs, 6 slots) à effets
   déclaratifs branchés (Logistique → PM, Recherche → vision, Chance/Moral →
   combat, Attaque/Tir/Armure → dégâts, Économie → or, Sagesse/Magie →
   sorts) ; choix de compétence à la montée de niveau (les 2 propositions,
   doc 02 §1.2) ; **sorts en combat** (mana = Savoir×10, 1 sort/round, école
   Feu/Eau/Terre/Air + neutres, ~20 sorts) ; inventaire d'artefacts (10 slots,
   bonus déclaratifs). → vérif : cas tabulaires (un sort de dégâts, un buff),
   property « le combat se termine toujours » tient avec sorts, golden.
2. **Contenu** : schémas `spell`, `skill`, `artifact` ; `data/core/spells/`
   (~20), pool de compétences core, artefacts de départ. → vérif :
   `content:check`.
3. **Client** : livre de sorts en combat (prévisualisation obligatoire),
   arbre de compétences du héros (tiroir), inventaire d'artefacts. → vérif :
   smoke « lancer un sort en combat réduit une pile ».

### Phase 3.3 — Faction Haven complète (P1, ~1 semaine)

100 % données (doc 03) — **zéro diff moteur** (critère CI). T1–T7,
bâtiments, héros, bonus de faction, école de sorts, locales. Placeholders
artistiques teintés. → vérif : `content:check` + smoke « recruter une unité
Haven de chaque tier », `git diff --stat` ne touche que `data/`.

### Phase 3.4 — Faction Necropolis + Nécromancie (P1, ~1,5 semaine)

Doc 04. **Test de modularité n°1** : la Nécromancie (relever des morts après
combat) passe par un `AbilityModule`/hook générique du moteur (point
d'extension ouvert **une fois**, sans connaître la faction). T1–T7, bonus,
héros. → vérif : combat gagné ⇒ squelettes ajoutés ; critère CI « le diff
hors `data/` se limite à l'ouverture du point d'extension générique ».

### Phase 3.5 — Scénarios & IA d'aventure (P1, ~2 semaines)

1. **Moteur** : conditions de victoire/défaite data-driven (doc 02 §6 :
   `eliminateAllEnemies`, `captureTown`, `defeatHero`, `surviveDays`…) ;
   triggers de carte (`onVisit`, `onDay`). **IA d'aventure** simple
   (déterministe) : explore, ramasse, construit, recrute, attaque — un
   adversaire jouable sur la carte. → vérif : property « une partie IA vs IA
   se termine » ; golden d'un scénario scripté.
2. **Contenu** : 3 scénarios solo (cartes + objectifs + armées de départ).
   → vérif : smoke « gagner le scénario tutoriel contre l'IA ».

### Phase 3.6 — Finitions MVP & critères de sortie (P1/P2, ~1 semaine)

Vue de ville peinte simple (P2), équilibrage de départ (winrates
grossiers), passe d'accessibilité (motifs de bannières, 3 crans partout),
perf 60 fps mobile re-vérifiée (throttling ×4), i18n complète des nouveaux
écrans. → **Jalon MVP** (doc 01 §5) : partie complète desktop + mobile,
3ᵉ faction de test chargée sans diff moteur, budgets tenus.

---

## Garde-fous ajoutés au MVP

| Invariant | Mécanisme |
|---|---|
| Nécromancie sans `if faction` | point d'extension `AbilityModule` générique ouvert **une fois** (3.4), critère CI « diff hors `data/` = ouverture générique seule » |
| 1 build/ville/jour, économie | unitaires moteur + property « ressources ≥ 0 » |
| Sorts déterministes | golden replay étendu à un combat avec sorts |
| Budgets perf | bundle < 800 Ko gzip (déjà en CI) ; 60 fps throttlé ×4 re-mesuré en 3.6 |

## Méthode d'exécution

Chaque sous-phase suit `.claude/prompts/lancer-phase.md` : la session
principale fait le cadrage (plan vivant `.claude/plans/phase-3.x-*.md`, décisions
sur les points non spécifiés, **surfaces figées** — types d'état, commandes,
événements, schémas), délègue les lots disjoints à des sous-agents Sonnet
(moteur / contenu / client), puis intègre, étend le smoke, met à jour les
docs `0X` concernées dans le même lot, et ouvre une PR draft.
