# Lot C-2 — sorts de départ & brouillard (C3 + C4)

Remédiation code↔docs §3 (client/UI). C5 (préviz de chemin : compte de jours) en
PR suivante (C-3).

## Correctifs

- **C3** — les sorts de départ étaient TOUS les sorts de cercle ≤ 3, toutes
  écoles ⇒ un héros Haven connaissait les sorts de Traque (école d'Arcane
  Hunters) dès le jour 1. Désormais : écoles UNIVERSELLES (fire/water/earth/air/
  neutral) + l'école de SA faction, lue du **manifeste** (`spellSchool`, donnée)
  — jamais un nom de faction/école en dur côté logique.
- **C4** — le rendu du brouillard dessinait « en vision » avec un rayon UNIFORME
  (`config.visionRadius`), alors que le moteur révèle par héros avec
  `visionRadius + heroVisionBonus` (compétence Recherche) ⇒ anneau faussement
  grisé autour d'un éclaireur. `FogOverlay.update` prend désormais une entrée par
  héros `{pos, radius}` avec le rayon EFFECTIF (`heroVisionBonus` exporté).

## Vérification

- typecheck 5/5 · lint · moteur/contenu inchangés (2 exports ajoutés) ·
  content:check · guards faction/couleur · budget < 800 Ko · smoke (brouillard 2
  états + flux de sort = non-régression ; le héros de départ connaît toujours les
  sorts universels ≤ 3, dont `bolt`).
