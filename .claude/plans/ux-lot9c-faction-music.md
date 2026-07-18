# Lot 9c (P2) — Audio d'identité : thèmes musicaux par faction (item 9.2)

> Plan `game-ergonomics-immersion-review.md` §5 Lot 9, item 2. La musique de ville
> et de combat est **générique**. On résout d'abord une piste **par faction**
> (`music/town-<faction>`, `music/combat-<faction>`), **repli sur la générique** si
> absente — même patron que les assets peints (zéro churn tant que la piste manque).
> **Client uniquement — zéro moteur, zéro asset**, pas de bump save.

## Changement (client)
- `audio.ts` : helper **pur** `factionTrack(base, faction, has)` (→ `<base>-<faction>`
  si `has(...)`, sinon `base`). `musicContextKey` résout :
  - **ville ouverte** → faction de la ville (`town.factionId`) ⇒
    `factionTrack('music/town', …, registry.has)` ;
  - **combat** → faction du **défenseur** (héros `defenderHeroId` sinon pile
    défenseur dominante via `unitCatalog.groupId`) ⇒ `factionTrack('music/combat', …)`.
  Menu/aventure/fin de partie inchangés.

## Vérification
- **Unitaire client** (`audio.test.ts`) : `factionTrack` renvoie la piste de
  faction quand elle existe, la générique sinon, et la générique si `faction` nul.
- typecheck · lint · engine (client-only) · content · client · build · bundle ·
  smoke @core + mobile · gardes. (Aucune piste `-<faction>` stagée ⇒ comportement
  audible identique ; l'infra se branchera au dépôt des pistes.)

## Journal
- [x] `factionTrack(base, faction, has)` pur + `openTownFaction`/`combatDefenderFaction`
      câblés dans `musicContextKey` (combat → défenseur, ville → `town.factionId`).
- [x] Unitaire client `factionTrack` (3 tests : faction présente / repli si absente /
      repli si nulle). **Ids de faction OPAQUES dans le test** (`alpha`/`beta`) —
      garde-fou « zéro faction dans packages/ » respecté (les vrais ids `haven`/
      `necropolis` l'auraient fait échouer). Recette : typecheck · lint · engine 906
      (client-only ⇒ golden inchangé) · content 154 · **client 20** · build · bundle
      342 872 ≤ 819 200 · smoke @core 32 + mobile 13 · gardes faction/couleurs propres.
- Note : aucune piste `-<faction>` stagée ⇒ audible identique aujourd'hui ; l'infra
      se branchera au simple dépôt d'un `music/town-<faction>.ogg` (patron asset).
