# Lot C-3 — préviz de chemin : compte de jours (C5)

Remédiation code↔docs §3, dernier item du Lot C.

## Correctif

- **C5** — la prévisualisation de chemin réduisait « jours nécessaires » à un
  booléen `today` (`PreviewStep.today` ; tous les pas au-delà des PM du jour
  étaient « plus tard », sans distinguer jour 2 de jour 5). Doc 02:76 promet le
  COMPTE de jours. Resegmenté par allocation quotidienne de PM
  (`dailyMovementPoints`) : chaque pas porte son `day` (1 = aujourd'hui, 2, …),
  et `PathPreview` colore par jour (vert / jaune / orange 3+).

## Vérif

- typecheck 5/5 · lint · moteur/contenu inchangés · content:check · guards ·
  budget < 800 Ko · smoke (préviz de chemin exercée par le tap-tap ; couleurs par
  jour = raffinement visuel, non asserté finement).
