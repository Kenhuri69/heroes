# A10 — Re-passe d'équilibrage post-capacités (backlog §3, données pures)

La vague de capacités (Nécromancie graduée, spellcaster, fear, charge, aura,
lifeDrain, bonus de faction…) a déplacé l'équilibre mesuré par `faction:sim`
(120×2 combats/paire, armées à budget d'or égal T1–T7) :

Baseline (main, 2026-07-11) :
- ✗ haven/necropolis **18,8 %** et ✗ necropolis/vox **90 %** (hors bande 20–80)
- Moyennes par faction : arcane ~68 %, necro ~69 %, haven ~40 %, vox ~46 %,
  sylvan ~27 % — proxy de puissance brute à budget égal : necro 5100,
  arcane 4247, haven 4086, sylvan 4036, vox 3874.

## Décision

Rééquilibrage **par les coûts de recrutement** (données pures, zéro moteur) :
le coût pilote l'effectif à budget égal (sim) ET l'économie réelle — c'est le
levier le plus doux (aucune stat de combat ne change, les sensations d'unité
restent). Cibles : plus de blowout hors 20–80, resserrer vers 45–55 sans en
créer de nouveaux. Les docs de faction (tables « coût ») sont mises à jour
dans le même commit (guidelines §8.6).

## Étapes

1. [ ] Itération sur les coûts (necro ↑, arcane ↑ léger, sylvan ↓, vox ↓ mi-tiers),
   `faction:sim` entre chaque passe (≤ 4 itérations).
2. [ ] Docs 03/04/05/14/16 : tables de coûts alignées sur les données.
3. [ ] Vérif : content:check + tests (content/engine), garde-fous, build.
4. [ ] Backlog : sous-item « re-passe faction:sim post-capacités » d'A10 ✅
   (C-AIPARITY et C-TACTICS restent des items séparés).

## Journal des itérations

1. Nerf necro (squelette 25→30, zombie 70→80, vampire 320→340) + nerf léger
   arcane (élève 35→38, lame 620→650, chasseresse 1200→1280) + buff sylvan
   (dryade 160→150, licorne 560→520, tréant 1200→1150) + buff vox (idole
   450→410, sombral 720→660) ⇒ 4 matchups à ~50, MAIS arcane/necro passe à
   90,8 (la masse squelette était l'anti-burst de necro) et arcane/vox tombe
   à 25,4.
2. Trim arcane (familier 90→95, préfet 170→185) + demi-retour vox ⇒
   arcane/vox 17,1 ✗ : tout nerf global d'arcane effondre son seul matchup
   faible. Leçon : arcane est structurellement polarisé, leviers asymétriques
   obligatoires.
3. Retour complet des coûts vox à l'origine (le blowout necro/vox était déjà
   résolu par le nerf necro) + squelette 30→28 (anti-burst partiel) ⇒
   **0 blowout**, extrêmes 79,6 / 75,0 / 72,9.
4. Buff doux sylvan (lucine 30→28, archer 80→76, loup 320→300) ⇒ **final** :
   0 blowout, 2 matchups supplémentaires à ~50, moyennes par faction
   46/55/47/50/51 (baseline : 40/68/69/27/46).

## Coûts finaux modifiés (base ; élites inchangées, ratios 1,4–1,7 préservés)

- necropolis : squelette 25→28, zombie 70→80, vampire 320→340
- arcane-hunters : élève 35→38, familier 90→95, préfet 170→185,
  lame 620→650, chasseresse 1200→1280
- sylvan-court : lucine 30→28, archer 80→76, dryade 160→150, loup 320→300,
  licorne 560→520, tréant 1200→1150
- vox-arcana : inchangé (buffs testés puis entièrement rendus)

## Matrice finale (winrate ligne, 120×2/paire)

| | arcane | necro | sylvan | vox |
|---|---|---|---|---|
| haven | 35,8 | 43,8 | 47,1 ✓ | 57,1 |
| arcane | — | 79,6 | 50,0 ✓ | 27,1 |
| necro | — | — | 38,8 | 73,8 |
| sylvan | — | — | — | 36,3 |
