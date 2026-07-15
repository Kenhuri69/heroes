# H-ARTEQUIP.2+ — artefact d'immunité de moral (grantsMoraleImmune)

Effet spécial déclaratif : `ArtifactDef.grantsMoraleImmune` — un artefact équipé
plancher le moral de toute l'armée du héros à 0 (miroir héros de la capacité
`moraleImmune`). Un seul hook dans `moraleOf`. Zéro faction, pas de bump save,
golden inchangé (dérivé de l'équipement).

## Livré
- moteur : `ArtifactDef.grantsMoraleImmune?`, helper `heroGrantsMoraleImmune`,
  plancher `moraleOf`.
- contenu : schema + propagation `buildArtifactCatalog` (+ test régression).
- données : Pendentif de bravoure + locales fr/en.
- test moteur : moraleOf planché à 0 avec l'artefact.
- doc 02 §1.1.

## Pipeline : ✅ typecheck 5/5 · lint · engine 808 (golden+save-shape INCHANGÉS) ·
content 141 · content:check · gardes-fous (1/1) · build · bundle 318659 · ⏳ smoke.
