# Lot F-BUILDEFF.4 — Cercle Vigile : défense de garnison (aura de bâtiment)

Backlog §2.3 (F-BUILDEFF, sous-lot .4). Les 4 Cercles AH (doc 05 §3.2) portent des
effets **placeholder** (or/j, croissance) au lieu de leurs passifs de design. Ce
sous-lot rend le **Cercle Vigile** conforme pour son volet exprimable : la
**garnison gagne de la défense**. (Décision auto : l'AskUserQuestion ayant échoué,
je prends l'option la plus proche du doc et à moindre risque — réutilise l'acquis
F-HOUSES `garrisonDefense`.)

## Portée F-BUILDEFF.4

- **Champ d'aura** `garrisonDefense` ajouté à l'effet `heroAura` (`town/types.ts`)
  + schéma — **réutilise** le champ town-scoped déjà livré (F-HOUSES) mais via un
  **bâtiment** (pas une Maison).
- **Câblage** : `wallDefenseBonus` (`town/capture.ts`) somme désormais AUSSI
  l'aura de bâtiment `garrisonDefense` (via `townBuildingAura`, champ élargi), en
  plus du Fort et de la Maison. Le siège en bénéficie côté défenseur.
- **Données** : le Cercle **Vigile** (`arcane-hunters-circle-vigile`) passe du
  placeholder `income +250 or/j` à `heroAura { garrisonDefense: 3 }` — passif de
  design (doc 05 §3.2 : « garnison +déf »).
- **Docs** : doc 05 §3.2 (Vigile : volet défense livré, +vision recrue différé),
  doc 02 §4.1 (`garrisonDefense` sur `heroAura`).

## Réconciliation doc (DOC-STATS)

Doc 05 §3.2 : Vigile « garnison +10 % déf ». Le moteur exprime une défense de
garnison **plate** (comme le Fort et la Maison Blaireau) : rendu par un flat
**+3** (≈ un niveau de Fort). Le volet **« +2 vision des héros recrutés ici »**
est **différé** (recrutement de héros = M-TAVERN, non livré). Cercles Traque
(vitesse recrue) / Sceau (mana d'école) / Abîme (dégâts T7-T8) = sous-lots
suivants (nouvelles surfaces moteur).

## Invariants

- **Zéro faction** (aura opaque `townBuildingAura`) — garde-fou vert.
- **Aucun bump de sauvegarde** : aura lue à l'exécution depuis `town.buildings`.
- **Golden inchangé** : pas de bâtiment `heroAura garrisonDefense` dans le replay.

## Vérifs

typecheck · lint · engine+content (bâtiment garrisonDefense → mur de siège majoré)
· content:check · garde-fou · build · budget · smoke.

## Journal

- branche `claude/f-buildeff-vigile` depuis `main` @ merge #241 (F-BUILDEFF.3).
