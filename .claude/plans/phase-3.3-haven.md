# Plan — Phase 3.3 : Faction Haven complète (data-only)

Réf : doc 11 §Phase 3.3 ; doc 03 (spec Haven) ; doc 06 (checklist modularité).
Critère de sortie doc 11 : **zéro diff moteur** — `git diff --stat` ne touche
que `data/` (+ locales + un test additif). Preuve que le pipeline data-driven
encaisse une faction réelle sans toucher le moteur.

## Périmètre honnête (contraint par le moteur MVP)

Le moteur MVP impose des limites que le contenu ne peut pas contourner (le
loader **rejette** toute donnée que le moteur n'interprète pas — pas de
« mensonge de validation », guideline §8) :

- **Capacités** : seules 6 existent au catalogue (`data/core/abilities.json` :
  `flying`, `shooter`, `noRetaliation`, `mark`, `undead`, `doubleAttack`) — le
  loader (loader.ts L192) rejette toute autre id. Les capacités Haven du doc 03
  (`taunt`, `shieldWall`, `charge`, `firstStrike`, `resurrectAlly`,
  `spellcaster`, `unlimitedRetaliation`, immunité moral) **ne sont pas
  livrables** en 3.3.
- **Effets de bâtiment** : `income`/`growthBonus`/`dwelling`/`mageGuild`/`none`.
  Les bâtiments spéciaux Haven (Statue = +moral, Cloître = apprentissage +
  mana/j, Écuries = +mouvement) reposent sur des effets **inexistants** → non
  livrables.
- **factionBonuses/abilityModules/hooks** : le schéma manifeste les **refuse
  non vides** tant que le moteur ne les interprète pas. Ferveur (+1 moral) et
  Formation (+5 % déf en aura) → non livrables.
- **heroSkills** : la compétence de faction « Prière de bataille »
  (résurrection) exige un effet `SkillRankEffect` inexistant → non livrable.
- **Héros nommés / classes** : pas de pipeline de héros par faction (les héros
  sont générés par le moteur au `StartGame`) → hors périmètre 3.3.
- **spellSchool** : « Lumière » n'est pas une école du moteur (feu/eau/terre/
  air/neutre) et n'est pas consommé → `null` (variante Eau au MVP, doc 03 §1).

**Livrable 3.3** = le **lineup d'unités Haven T1–T7** (stats doc 03, capacités
restreintes aux 6 supportées) + **arbre d'habitations** (7 dwellings + chaîne
de prérequis) + **manifeste** + **locales fr/en** + **ressources clés**,
chargé/validé par le pipeline et **recrutable**. Tout le reste est un écart
documenté, à ouvrir quand le moteur exposera les points d'extension (certains
en 3.4 via `AbilityModule`).

## Décisions de mapping (capacités livrées)

| Tier | Unité | Capacités doc 03 | Livré 3.3 | Différé |
|------|-------|------------------|-----------|---------|
| 1 | Conscrit | taunt | — | taunt |
| 2 | Archer | shooter(12) | `shooter` (12) | — |
| 3 | Frère-Lame | shieldWall | — | shieldWall |
| 4 | Griffon | flying, unlimitedRetaliation | `flying` | unlimitedRetaliation |
| 5 | Prêtresse | shooter(8), spellcaster | `shooter` (8) | spellcaster |
| 6 | Chevalier du Griffon | charge, firstStrike | — | charge, firstStrike |
| 7 | Ange | flying, resurrectAlly, immunité moral | `flying` | resurrectAlly, immunité moral |

Stats (PV/Att/Déf/Dégâts/Vit/Croissance/Coût) reprises **telles quelles** du
doc 03 §3. Coûts multi-ressources (gemmes/cristal) autorisés (`crystal`,
`gems` ∈ ids de ressources).

## Arbre d'habitations (doc 03 §4, effets `dwelling` + `requires`)

Chaîne : Caserne(T1) → Tour d'archers(T2) → Monastère-lame(T3) → Volière(T4) ;
branche Guilde des mages → Chapelle(T5) → Manège seigneurial(T6) → Portail
céleste(T7). Prérequis via `levels[].requires`. Bâtiments communs réutilisés :
`townHall`, `fort`, `mageGuild` (data/core/buildings.json). Un `growthBonus`
(type Fort) optionnel si utile. Bâtiments spéciaux (Statue/Cloître/Écuries) =
différés (effets non supportés).

## Surfaces (aucune — data-only)

Aucune surface de code figée : la 3.3 n'ajoute **aucun** fichier sous
`packages/engine` ni `packages/client/src` (hors test). Le seul code ajouté
est un **test de recrutement** (packages/content/test ou packages/engine/test).

## Lots

- [ ] **Cadrage (principal)** : ce plan + vérif des contraintes moteur
      (capacités, effets, manifeste) — **fait**.
- [ ] **Lot N (sonnet) — contenu Haven** : `data/factions/haven/`
      (`manifest.json`, `units/t1..t7.json`, `buildings.json`, `locales/{fr,
      en}.json`), enregistrement dans `data/factions/index.json`, test
      « recruter une unité Haven de chaque tier » (ville avec les 7 dwellings
      niveau 1 + stock, `RecruitUnits` par tier). Vérif : `content:check`
      liste haven (7 unités, locales OK), tests verts, `pnpm lint`/`typecheck`,
      **`git diff --stat` ne touche que `data/` + le fichier de test**.
- [ ] **Intégration (principal)** : doc 03 « État 3.3 » (livré vs différé),
      CLAUDE.md, smoke/vérif globale, PR draft, merge.

## Écarts assumés

- Capacités taunt/shieldWall/charge/firstStrike/resurrectAlly/spellcaster/
  unlimitedRetaliation + immunité moral : **différées** (moteur MVP à 6
  capacités). À ouvrir quand le combat étendra le catalogue (certaines via
  `AbilityModule` en 3.4).
- Bonus de faction (Ferveur, Formation), compétence de faction (Prière de
  bataille), bâtiments spéciaux (Statue/Cloître/Écuries), école Lumière,
  classes/héros nommés (Aldric/Séraphine) : **différés** (points d'extension
  moteur non ouverts). Le doc 03 reste la cible ; note « État 3.3 » ajoutée.
- Placeholders artistiques : pas d'assets en 3.3 (rendu générique teinté).
