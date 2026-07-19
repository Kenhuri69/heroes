# H-ARTEQUIP typed slots — `EquipArtifact` respecte `artifact.slot`

## But
Le moteur fait respecter le TYPE d'emplacement d'un artefact à l'équipement :
on ne peut pas équiper un 2ᵉ artefact d'un type d'emplacement EXCLUSIF déjà
porté (2 casques, 2 armes…). `misc` et `slot` absent restent non contraints.
Clôt le « raffinement ultérieur » de UXD-5b (doc 08 §2.3) — la poupée typée
existait en lecture seule ; l'équipement devient typé.

## Mécanique (générique, zéro faction, pas de bump save)
- `artifact.slot` (déjà en données, doc 02 §1.1) devient LU par le moteur au seul
  point `validateEquipArtifact`. Slot EXCLUSIF = défini et ≠ `misc`.
- Helper pur exporté `artifactSlotConflict(hero, catalog, artifactId)` (partagé
  moteur + client, patron R7). Placement inchangé (1er slot libre) ⇒ tableau plat
  `hero.artifacts` intact, bonus toujours sommés, **pas de bump save**.
- Nouveau code d'erreur `slotOccupied` + locales `cmdError.slotOccupied`.
- Client `HeroInventory` : bouton du sac désactivé (préviz) si le slot est occupé,
  raison affichée — pas de tap mort (doc 08 : préviz avant action).
- Ramassage (auto, 1er libre) et transfert inter-héros restent hors périmètre
  (placement passif) — documenté.

## Étapes / vérif
1. `core/commands.ts` : code `slotOccupied`. → typecheck
2. `hero/equip.ts` : helper `artifactSlotConflict` + contrainte validate. → engine test
3. exporter le helper (`hero/index.ts` ou barrel engine). → typecheck
4. locales fr/en `cmdError.slotOccupied`. → build
5. `hero/types.ts` : MAJ commentaire `ArtifactSlot` (moteur lit slot à l'équip).
6. client `HeroInventory.tsx` : désactiver le bouton sac si conflit + raison. → build+smoke
7. test `hero-equip.test.ts` : refuse 2ᵉ même slot ; accepte slots différents ;
   accepte 2 `misc` ; accepte slot absent. → engine
8. docs 08 §2.3 + 02 §1.1 alignées (slot désormais lu à l'équipement).

## Pipeline complet vert AVANT push (exit réels, pas de pipe tail)
✅ typecheck 5/5 · ✅ lint · ✅ vitest engine 795 (golden+save-shape INCHANGÉS,
hero-equip 9 tests) · ✅ vitest content 138 · ✅ content:check · ✅ garde-fou
faction (status 1) · ✅ garde-fou couleur (status 1) · ✅ build · ✅ bundle
317711 < 819200 · ⏳ smoke.

Commit 428251c (non-smoke vert). Reste : confirmer smoke, rebaser origin/main,
push, PR draft, CI, merge, resync.
