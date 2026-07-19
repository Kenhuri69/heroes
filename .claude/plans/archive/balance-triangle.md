# Plan — Équilibrage du triangle pré-existant (faction:sim)

> Après la rebalance Vox (#161), `faction:sim` gardait 2 déséquilibres béants
> **antérieurs à Vox** : `arcane vs necropolis` (100/0) et `haven vs arcane`
> (89/11). Objectif : réduire ces blowouts sans casser les matchups déjà centrés.

## Diagnostic
Intransitif : haven counter arcane (89), arcane counter necro (100/0 — le pire,
**zéro counterplay**). Necropolis était la faction faible vs le haut de tableau
(kitée par les tireurs/volants+marques d'Arcane car lente et mêlée).

**Leçon (vue sur Vox et confirmée ici)** : un nerf/buff **uniforme** de faction
casse les matchups à ~50 % (courbe de winrate très raide côté effectif). Un nerf
Haven pour corriger haven-arcane (89) a inversé haven-necro (68→19) et haven-vox
(52→17) → abandonné. Le levier gagnant est **ciblé sur la faiblesse structurelle**.

## Livré — buff de survie/mobilité de Necropolis
`data/factions/necropolis/units/` (valeurs de départ) : les unités lentes kitées
gagnent de la vitesse, deux gagnent de la survie.
- T2 zombie : vitesse 3→4.
- T4 vampire : hp 28→32.
- T5 liche : vitesse 5→6.
- T6 cavalier funeste : vitesse 9→10.

`faction:sim` avant→après (matchups de Necro) :
`arcane 0→39,6 · haven 32→59,6 · sylvan 60→48,3 · vox 41→65,4`.
→ **arcane-necro 100/0 → 60/40** (blowout **résolu**, du counterplay), et **tous
les matchups de Necro passent en bande 20-80** (Necro n'est plus la faction
faible). **Zéro nouveau blowout.** Panel : 3 → **2** blowouts.

## Résiduel assumé (RPS intrinsèque)
- `haven-arcane` **89/11** : hard-counter. Non corrigeable par stats uniformes —
  tout nerf Haven re-casse haven-necro (désormais à 40, sensible) et haven-vox ;
  tout buff Arcane pousse arcane-necro/sylvan vers de nouveaux blowouts. Le
  corriger demanderait un **outil anti-Haven de design** (capacité), pas du stat.
- `sylvan-vox` **83,8** : résiduel documenté de #161 (Vox tir/vol counter Sylvan).

## Vérif
- `pnpm faction:sim`, `content:check` (6 paquets), `pnpm test` (92 contenu +
  376 moteur, dont équilibrage grossier) verts. Golden inchangé.
