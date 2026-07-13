# Lot CAP-DATAFIX.2 — parité des capacités des unités améliorées (elite)

> **Correction de données pure** (aucun moteur). Constat : chaque unité **améliorée**
> (`*-elite`, débloquée par le dwelling gradué niveau 2) a **perdu les capacités de
> signature de sa version de base** — une amélioration strictement inférieure, ce
> qui contredit le design (docs 03/04/05/16 §lineup : une amélioration conserve et
> renforce). Cause : les lots CAP-* ont ajouté les capacités aux unités de base
> sans répercuter sur les elites (defs standalone, sans héritage moteur —
> `upgradedUnitFor` mappe base→elite sans fusion d'abilities). Backlog §2.2 CAP-DATAFIX.

## Constat (diff base vs elite, 19 unités, 4 factions)

Exemples : `chevalier-griffon-elite` perd **charge + firstStrike** ; `ange-elite`
perd **moraleImmune** ; `pretresse-elite` perd **spellcaster** ; `bibliothecaire-elite`
perd **spellcaster + magicResistance** ; `dragon-os-elite` perd **aura + breathAttack** ;
`vampire-elite` perd **lifeDrain** ; `liche-elite` perd **areaAttack** ; etc.

## Correctif

- Pour chaque paire base/elite : **ajouter à l'elite toute capacité présente sur la
  base et absente de l'elite**, avec les **mêmes params** que la base (parité minimale
  — jamais une amélioration inférieure). Les capacités déjà présentes sur l'elite
  (et leurs params éventuellement spécifiques) sont **préservées** telles quelles.
- Zéro moteur, zéro save, zéro golden. **Zéro impact `faction:sim`** : le sim
  n'utilise que les **unités de base** (`dwellings` tier 1…7), pas les elites ⇒
  winrates inchangés. Le correctif ne renforce que le jeu réel (upgrade opt-in payant).

## Vérification

- Test moteur (`combat-elite-parity`, ids OPAQUES construits en fixture — PAS de
  chargement de faction) : une unité « base » à capacité X et son « elite » sans X
  ⇒ après correctif la parité tient. (Ou test de contenu : chaque elite ⊇ abilities
  de sa base.) → **test de contenu** : parcourt les paquets, vérifie l'invariant
  d'inclusion base ⊆ elite. Garde-fou permanent contre la régression.
- typecheck 5/5 · lint · engine (golden + save-shape **inchangés**) · content +
  content:check (cross-validation spellId des spellcaster restaurés) · garde-fous ·
  build + bundle · `faction:sim` (inchangé — elites hors sim) · smoke.

## Journal

- 2026-07-13 — Plan créé, branche `claude/cap-datafix-elite-parity` depuis origin/main.
- 2026-07-13 — Correctif : 18 elites (4 factions) ont reçu les capacités manquantes
  de leur base (params identiques). Test de contenu `elite-ability-parity` ancre
  l'invariant base ⊆ elite. Docs déjà conformes (le correctif aligne les DONNÉES sur
  le design des lineups) ⇒ aucune mise à jour doc requise.
- 2026-07-13 — Vérif : typecheck 5/5 · lint · engine 701/701 (golden + save-shape
  **inchangés**) · content 126/126 (+1 parité) · content:check · garde-fous · build ·
  bundle gzip 300 Ko < 800 Ko · `faction:sim` **identique** (0 béant — elites hors sim).
