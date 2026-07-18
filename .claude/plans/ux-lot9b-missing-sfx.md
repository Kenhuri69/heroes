# Lot 9b (P2) — Audio d'identité : SFX manquants (I8, item 9.4)

> Plan `game-ergonomics-immersion-review.md` §5 Lot 9, item 4. Des accomplissements
> (construction, recrutement, montée de niveau, amélioration) n'ont **pas de retour
> sonore** alors que les fichiers `ui-confirm`/`ui-tap` existent déjà. On les câble,
> en **doublant** un feedback visuel existant (règle d6). **Client uniquement —
> zéro moteur, zéro asset** (réutilise `sfx/ui-confirm`), pas de bump save.

## Changement (client)
- `audio.ts` : extraire `sfxForEvent` en fonction **pure** `sfxIdForEvent(event,
  ctx)` (ctx = `humanId` + lookups `townOwner`/`heroPlayer`) ⇒ testable sans audio.
  Comportement existant préservé (combat/déplacement/ramassage/fin de tour), +
  nouveaux mappings, **gardés au joueur humain** :
  - `TownBuilt` / `UnitsRecruited` / `UnitsUpgraded` (ville possédée) → `ui-confirm`
  - `DwellingRecruited` / `HeroRecruited` (playerId humain) → `ui-confirm`
  - `HeroLevelUp` (héros humain) → `ui-confirm`
- Ouverture/fermeture de modale : **déjà couverte** par le tap `ui-tap` posé sur
  tout `button`/`[role=button]` (initAudio) ⇒ rien à ajouter (évite le double-son).

## Vérification
- **Unitaire client** (`audio.test.ts`) : `sfxIdForEvent` mappe chaque événement
  au bon id ET renvoie `null` pour une ville/héros IA (gating humain).
- typecheck · lint · engine (client-only) · content · client · build · bundle ·
  smoke @core + mobile · gardes.

## Journal
- [x] `sfxIdForEvent(event, ctx)` pur (ctx `humanId`/`townOwner`/`heroPlayer`,
      types `string|null|undefined` car `ownerPlayerId` peut être null) + nouveaux
      mappings gardés humain (TownBuilt/UnitsRecruited/UnitsUpgraded/DwellingRecruited/
      HeroRecruited/HeroLevelUp → `ui-confirm`) ; `sfxForEvent` délègue.
- [x] Unitaire client `audio.test.ts` (4 tests : mappings + gating IA + combat
      préservé + no-op). Recette : typecheck · lint · engine 906 (client-only ⇒
      golden inchangé) · content 154 · **client 17** · build · bundle 342 675 ≤
      819 200 · smoke @core 32 + mobile 13 · gardes faction/couleurs propres.
- Note : ouverture/fermeture de modale déjà couverte par le tap `ui-tap` global
      (initAudio) ⇒ aucun ajout (évite le double-son).
