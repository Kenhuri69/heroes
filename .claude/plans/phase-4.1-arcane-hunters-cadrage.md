# Plan — Phase 4.1 : Cadrage Arcane Hunters (démarrage Alpha)

Premier lot de l'**Alpha** (roadmap doc 09) : produire la 3ᵉ faction complète,
**Arcane Hunters** (doc 05), via le pipeline data-driven — le **grand test de
modularité #3** (doc 06 §5.8 : aucun diff hors `data/factions/<id>/`, sauf
ouverture de points d'extension **génériques**, jamais de littéral de faction
dans le moteur — garde-fou CI).

Ce lot-ci est **du cadrage** (plan + docs), aucun code moteur/données : il
décompose la faction en sous-lots et décide le périmètre Alpha-MVP. C'est un
incrément mergeable à part entière (comme les cadrages 3.1/3.5).

## 1. Inventaire des mécaniques → mapping d'implémentation

| Mécanique (doc 05) | Mapping | Nouveau point d'extension ? |
|---|---|---|
| Lineup 8 tiers (stats/coûts/croissance) | **Données** `units/*.json` | non |
| `sharedGrowthGroup: apex` (T7/T8 partagent 1 croissance, choix hebdo) | **Donnée** (schéma OK) + **choix de recrutement** côté moteur/ville | à vérifier (croissance partagée + sélection) |
| Capacités déjà au moteur MVP (audit : `flying`, `shooter`, `noRetaliation` supposées OK ; `swarm`, `expose`, `executioner`, `pinningShot`, `poisonSting`, `strikeAndReturn`, `spellcaster`, `magicResistance`, `areaAttack` à confirmer) | **Catalogue générique** si présent, sinon **différé/placeholder** | selon audit |
| **Marque du Chasseur** (signature) : à l'attaque, +1 charge (max 3) ; +8 %/charge de dégâts reçus des Hunters + sorts Traque | **NOUVEAU point déclaratif générique** `onAttackApplyStatus` (bonus de faction, cf. doc 06 §3) **branché sur le système de statuts de combat existant** (`stack.statuses[]`, `attackMod`/`defenseMod` déjà sommés dans `combat/damage.ts`) + un champ générique « dégâts reçus +X %/charge » | **OUI (1)** |
| `consumeMarks` (expose/executioner/pinningShot/devourMarks) | **NOUVEAU** : effet de capacité générique « consommer N charges d'un statut → effet » | **OUI (2)** |
| **Essence** (ressource de faction : gagnée en combat vs neutres, dépensée T8/upgrades) | **NOUVEAU** : brancher `factionResources` au gameplay (gain déclaratif post-combat + coût de recrutement/bâtiment) | **OUI (3)** |
| **Choix de Cercle** (Vigile/Traque/Sceau/Abîme — bâtiment exclusif irréversible) | **NOUVEAU** : mécanisme générique `exclusiveBuildingChoice` (utile à toute faction HoMM) | **OUI (4)** |
| **Contrats de chasse** (cible neutre hebdo → or + Essence) | **NOUVEAU** : ouvrir le point `AdventureHook.weekStart` (doc 06 §4) | **OUI (5)** |
| **demonform** (T8 : transformation stateful 1×/combat) | **NOUVEAU** : ouvrir le point `AbilityModule` (état sérialisable, doc 06 §4) | **OUI (6)** |
| École **Art de la Traque** (sorts) | **Données** `spells/traque.json` + qq effets de sort nouveaux (marque par sort, bannissement conditionnel) | partiel |
| Héros (classes, nommés, spécialités) | **Données** + spécialités = effets déclaratifs (certains nouveaux) | partiel |

**Constat** : la faction requiert **6 nouveaux points d'extension moteur
génériques** — c'est l'objet même du test de modularité #3. Chacun doit rester
**générique** (piloté par les données, zéro nom de faction) et passer le
garde-fou CI. C'est un gros jalon : plusieurs sous-lots.

## 2. Séquence de sous-lots proposée

- **4.1 (ce lot)** — cadrage : ce plan + docs 05/09.
- **4.2 — Marque (signature) + lineup data** : point d'extension **(1)**
  `onAttackApplyStatus` déclaratif + statut « vulnérabilité par charge » branché
  sur le système de statuts existant ; audit du catalogue de capacités ; lineup
  8 tiers en **données** avec les capacités **déjà supportées** (mark incluse),
  les capacités exotiques différées (placeholder documenté). Preuve : une pile
  Hunter marque, la cible marquée subit + de dégâts. Faction jouable a minima.
- **4.3 — consumeMarks** : point **(2)** effet générique de consommation de
  charges → unités expose/executioner/pinningShot.
- **4.4 — Essence & Contrats** : points **(3)** + **(5)** (économie de ressource
  de faction + hook d'aventure hebdomadaire).
- **4.5 — Cercles & École de la Traque** : point **(4)** `exclusiveBuildingChoice`
  + sorts Traque (données + effets).
- **4.6 — T8 demonform & apex** : point **(6)** `AbilityModule` + croissance
  partagée apex + héros nommés/spécialités.
- **4.7 — Intégration Alpha** : `faction:sim` (doc 06 §5.6) si outillé, scénario
  dédié, passe IA (`aiProfile.preferredTargets: marked`), équilibrage grossier,
  docs, PR de jalon.

Chaque sous-lot = 1 point d'extension **générique** + les données qui l'exercent,
vérifié bout-en-bout (unitaires moteur + smoke), garde-fou vert.

## 3. Décision de périmètre Alpha-MVP (faction)

Priorité : **jouabilité de la signature d'abord**. 4.2 rend la faction jouable
(lineup + Marque). Les mécaniques lourdes (Essence, Cercles, Contrats,
demonform) suivent en sous-lots ; tant qu'un effet n'est pas livré, l'unité/le
bâtiment concerné porte un **comportement dégradé documenté** (pas de crash,
capacité inerte) — jamais un `if faction`. Assets peints = Beta (placeholders
teintés + `FactionBadge`, cf. 3.6).

## 4. Gouvernance de modularité (doc 06 §5.8)

- Le **seul** diff hors `data/factions/arcane-hunters/` autorisé par sous-lot :
  l'ouverture d'un point d'extension **générique** (schéma + interprète moteur),
  nommé par une capacité/effet, jamais par une faction.
- Garde-fou CI (`grep` des noms de faction dans `packages/`) reste vert : les
  tests identifient la faction par **propriété** (ex. « faction à 8 tiers »,
  « faction portant l'effet `onAttackApplyStatus` »), jamais par id littéral.
- Golden : chaque changement de forme d'état (ex. `stack.statuses` étendu,
  ressource de faction dans l'état) ⇒ re-fixation assumée + note.

## 5. Vérification (ce lot)

Docs uniquement : `content:check` inchangé (le stub arcane-hunters à 1 unité
reste valide), garde-fou vert, typecheck/tests inchangés. Pas de smoke (lot
documentaire, guideline §7).

## Écarts

- `faction:sim` (équilibrage fin winrate 45–55 %) = outil Alpha (doc 06 §5.6) :
  livré au plus tôt en 4.7, sinon sanity-check comme en 3.6.
- Le découpage 4.x peut être réordonné selon les dépendances découvertes en
  implémentation (plan vivant, guideline §5).
