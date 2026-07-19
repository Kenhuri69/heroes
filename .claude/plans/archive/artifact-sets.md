# Plan — Lot 3.2 (doc 18) : panoplies d'artefacts + rareté graduée (C2)

> **Statut** : ✅ livré (2026-07-17).
> Écart couvert : **C2** (doc 18 §2.C) — « le système de sets est livré mais UNE
> seule panoplie existe (panoplie-gladiateur, 2 pièces) sur 11 artefacts ;
> manque : 2-3 panoplies (une par style) + artefacts de rareté graduée en
> profondeur de carte ». Étape 3, après 3.1.

## 0. Objectif & critère de sortie

Trois panoplies au catalogue (une par style) et un placement d'artefacts
**gradué par la profondeur** de la carte générée : près du départ = artefacts
communs, au fond = artefacts rares/pièces maîtresses.

**Critère de sortie mesurable** : 3 panoplies complètes équipables (bonus de
set accordé), 16 artefacts au catalogue ; sur une carte générée, l'artefact
posé en profondeur maximale est de rareté ≥ celui posé près du bord.

## 1. Périmètre & décisions

- **Données pures + mapgen (content)** — zéro diff moteur : le système de sets
  (`ArtifactDef.set`, agrégé par `heroArtifactBonus`) et la poupée existent.
- **Écart au libellé C2** : le style « économie » exigerait un `goldPerDay`
  d'artefact = nouveau point d'extension moteur (câblage revenu quotidien).
  Pivot : 3ᵉ panoplie de style **logistique/exploration** (movement/vision/
  luck — vocabulaire existant). Le set « économie » est différé avec son point
  d'extension (noté doc 18/02).
- **Rareté** : champ **optionnel** `rarity` (1–3, défaut 1) au schéma
  d'artefact — consommé par le SEUL mapgen (le moteur l'ignore : pas un champ
  d'état, pas de bump save).
- **Icônes** : pas de PNG dans ce lot (pipeline `asset-sheet` = lot d'art
  dédié) — replis procéduraux existants (sol + inventaire).
- Le tirage gradué change la génération à graine égale (consommation RNG) —
  précédent assumé (tout ajout au mapgen l'a fait) ; cartes FIXES (proto-01/02)
  intactes.

## 2. État des lieux (points d'ancrage vérifiés)

- Catalogue : 11 artefacts (`data/core/artifacts.json`), 1 set (gladiateur,
  weapon+shield, 2 pièces). Bonus : attack/defense/power/knowledge/luck/
  morale/manaMax/movementFlat/vision (`artifactBonusSchema`, `schemas.ts:611`).
- Sets : chaque membre porte `{ id, pieces, bonus }` identique ; ≥ `pieces`
  équipés ⇒ bonus une fois (`hero/artifacts.ts:49-64`).
- Slots libres : `head`, `torso` (poupée 10 slots, UXD-5b).
- Mapgen : `packages/content/src/mapgen.ts:506-513` — 1-2 artefacts posés en
  profondeur (`place(..., true)`) + sentinelle, tirés UNIFORMÉMENT de
  `opts.artifactIds` (`randInt`). Client : `app/content.ts:122` passe
  `knownArtifactIds(report)`.
- Locales : `artifact.<id>` (nom), `artifact.<id>.lore`,
  `artifactSet.<id>` (nom de panoplie).
- Tests : `content/test/mapgen.test.ts` (artefacts placés ⊂ liste, gardés).

## 3. Étapes

- [ ] a. **Schéma** : `rarity: z.number().int().min(1).max(3).optional()` sur
      `artifactSchema` (doc du champ : consommé par le mapgen seul).
- [ ] b. **Données** — 5 nouveaux artefacts + 2 panoplies (16 au total) :
      - **Regalia de l'Archimage** (magic, 3 pièces, bonus set
        `{power:2, knowledge:2}`) : `couronne-de-l-archimage` (head,
        `{knowledge:2}`, rarity 3), `robe-des-arcanes` (torso, `{power:2}`,
        rarity 2), `anneau-de-mana` (ring, `{manaMax:10}`, rarity 2) ;
      - **Attirail du Grand Voyageur** (logistique, 2 pièces, bonus set
        `{movementFlat:150, luck:1}`) : `boussole-du-voyageur` (misc,
        `{vision:1}`, rarity 1), `eperons-du-vagabond` (feet,
        `{movementFlat:200}`, rarity 2) ;
      - `rarity` posé sur les 11 existants (1 par défaut ; 2 pour les plus
        forts : grimoire/cape/sceau ; gladiateur 1-2).
- [ ] c. **Mapgen** : `opts.artifactRarity?: Record<string, number>` ;
      helper pur exporté `artifactIdForDepth(ids, rarityOf, depth, jitter)`
      (tri rarité puis id — déterministe ; index ∝ profondeur, jitter ±1
      seedé) consommé au placement. Client `app/content.ts` passe les raretés
      du report.
- [ ] d. **Locales FR/EN** : 5 noms + 5 lores + 2 noms de panoplie.
- [ ] e. **Doc** : doc 02 §1.1 (artefacts/panoplies — état 3 sets + rareté
      graduée ; différé « set économie » avec son point d'extension).
- [ ] f. **Tests** (niveau contenu, skill `test-authoring`) : invariant
      GÉNÉRIQUE de catalogue « chaque `set.id` a ≥ `pieces` membres et tous
      portent le même descripteur » ; unitaire du helper
      `artifactIdForDepth` (profondeur 0 ⇒ rarité min, 1 ⇒ rarité max,
      jitter borné) ; mapgen : les artefacts placés restent ⊂ liste (existant,
      re-vérifié).
- [ ] g. **Vérifs standard** : typecheck, lint, moteur (golden inchangé —
      zéro diff moteur), contenu, `content:check`, garde-fou faction, budget,
      smoke `@core`.

## 4. Hors périmètre

- `goldPerDay` d'artefact (point d'extension moteur — avec le futur set
  « économie ») ; icônes PNG (lot d'art `asset-sheet`) ; marchand d'artefacts
  (D2, P3) ; rééquilibrage des artefacts existants.

## 5. Risques

| Risque | Mitigation |
|---|---|
| Golden/save | zéro diff moteur ; `rarity` = donnée de contenu jamais sérialisée dans l'état |
| Cartes générées différentes à graine égale | assumé/documenté (précédents mapgen) ; cartes fixes intactes ; smokes carte aléatoire génériques |
| Set inéquipable (conflit de slots) | 3 slots distincts par panoplie (head/torso/ring ; misc/feet) — vérifié contre la poupée |
| Panoplie incohérente (descripteurs divergents) | test d'invariant générique au niveau contenu |

## 6. Suivi

- [x] Plan rédigé (2026-07-17)
- [x] a→e implémentés — `rarity` (schéma + posé sur les 16 artefacts), 2
      nouvelles panoplies (Regalia head/torso/ring ; Attirail misc/feet),
      `artifactIdForDepth` exporté + branché au placement (jitter ±1 seedé),
      `artifactRarity` passé par `app/content.ts` depuis le catalogue core,
      locales FR/EN (5 noms + 5 lores + 2 panoplies), doc 02 §1.1.
- [x] f tests verts — `artifact-sets.test.ts` (4 cas) : invariant générique
      « panoplie complétable » (≥ pieces membres, descripteurs identiques,
      **slots tous distincts** — deux membres sur le même slot rendraient le
      seuil inatteignable), bornes de rareté, tirage gradué pur (profondeur
      0→commun / 1→rare, jitter borné).
- [x] g vérifs — typecheck ✅ lint ✅ moteur 860/860 (zéro diff moteur,
      golden intact) ✅ contenu 152/152 ✅ `content:check` ✅ garde-fou
      faction ✅ budget 329 Ko/800 Ko ✅ smoke `@core` 19/19 + « carte
      aléatoire » ✅.
