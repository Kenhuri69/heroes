# M-GUARDLINK — objets gardés (doc 02 §2.2)

> « go next » autonome. Item M du backlog. Un objet ramassable peut être **gardé**
> par une sentinelle : impossible de contourner le gardien pour rafler le butin.

## Conception (bornée, sans bump save)
- Champ **optionnel** `guardedBy?: string` (id de gardien) sur `ResourceObjectDef`
  / `TreasureObjectDef` / `ArtifactObjectDef` (`map.ts`).
- `movement.ts` : avant ramassage, si l'objet est gardé ET que le gardien lié
  existe encore dans `map.objects` ⇒ **skip** (objet inerte). Sentinelle retirée
  (vaincue) ⇒ objet ramassable normalement.
- Contenu : schéma (`schemas.ts`) accepte `guardedBy` ; résolution (`loader.ts`)
  le passe au moteur ; **validation croisée** : `guardedBy` doit désigner un
  `guardian` présent sur la carte.
- Données : `data/maps/proto-01` — `gold-2` (12,28) gardé par `guard-gold`
  (11,28), adjacents.
- Champ optionnel absent des cartes golden ⇒ **golden inchangé, pas de bump**.

## Vérif
- Tests moteur : `map-objects.test.ts` — gardé ⇒ non ramassé (objet reste,
  ressources inchangées) ; sentinelle absente ⇒ ramassé. Golden inchangé.
- Content : proto-01 charge sans erreur (référence `guardedBy` valide).
- typecheck/lint/build ; smoke (non-régression — le seul objet gardé est loin
  du départ, mécanique couverte en unitaire comme les modales de montée).
- doc 02 §2.2 + backlog mis à jour.

## Journal
- Livré. `guardedBy?` sur 3 defs + gate `movement.ts` + schéma/loader + validation
  croisée + data proto-01. 461 tests moteur (dont 2 M-GUARDLINK), content 101,
  golden inchangé (pas de bump). Différé : liaison auto dans `generateMap`.
