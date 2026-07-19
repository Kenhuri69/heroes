# H-ARTEQUIP.2+ — artefact de résistance magique d'armée (armyMagicResistance)

Effet déclaratif : `ArtifactDef.armyMagicResistance` (fraction 0..1) — réduit les
dégâts des sorts ennemis sur toute l'armée du héros. 2 hooks (résolution
`applySpellToTargets` + préviz `estimateSpellWithPower`) via le helper pur
`heroArmyMagicResistance` ; résistance combinée bornée < 1. Zéro faction, pas de
bump save, golden inchangé.

## Livré
- moteur : `ArtifactDef.armyMagicResistance`, helper `heroArmyMagicResistance`,
  hooks résistance résolution + préviz.
- contenu : schema + propagation buildArtifactCatalog (+ test régression).
- données : Cape du refus (Savoir +1, -25%) + locales fr/en.
- test moteur : préviz de dégâts réduite de 25% avec l'artefact.
- doc 02 §1.1.

## Pipeline : ✅ typecheck 5/5 · lint · engine 810 (golden+save-shape INCHANGÉS) ·
content 142 · content:check · gardes-fous (1/1) · build · bundle 318747 · ⏳ smoke.
