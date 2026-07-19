# T-CARAVAN — caravanes inter-villes (doc 02 §4.1)

> « go next » autonome. Backlog `game-feature-gaps.md` T-CARAVAN : transfert
> d'unités entre deux villes possédées, trajet en jours via l'A* existant,
> arrivée en garnison.

## Conception (moteur + client, save bump)
- Commande **`SendCaravan { fromTownId, toTownId, slot }`** : envoie la pile de
  garnison `slot` de la ville A vers la ville B. Les deux villes appartiennent au
  **joueur actif** (convention `state.currentPlayer`, comme Build/Recruit),
  A ≠ B, un **chemin terrestre** doit exister (`findPath` entre les tuiles).
- Durée = `max(1, ceil(coûtChemin / config.movement.base))` jours (caravane à
  vitesse de base ; ne consomme aucun PM de héros).
- État **`GameState.caravans: CaravanState[]`** — `{ id, playerId, toTownId,
  army: ArmyStack[], daysLeft }`. **Save bump 20 → 21.**
- Tick au **`DayStarted`** (`tickCaravans`) : `daysLeft--` ; à ≤ 0, dépose l'armée
  dans la garnison de B **si B appartient toujours au `playerId`** (fusion par
  `unitId`, nouvelle pile = slot libre ≤ 7 ; garnison pleine sans fusion ⇒ la
  caravane **attend** un jour, `daysLeft` reste 0). Si B a été **capturée** entre
  temps ⇒ la caravane **se disperse** (unités perdues), event `CaravanLost`.
- **Non interceptable** (convention HoMM3) — décision documentée.
- Events : `CaravanSent { playerId, fromTownId, toTownId, days }`,
  `CaravanArrived { playerId, toTownId, unitId, count }`, `CaravanLost`.
- Client : dans l'onglet **Garnison** de la ville, chaque pile a un « Envoyer
  vers… » (sélecteur des autres villes possédées) ⇒ `SendCaravan`. Bandeau
  « caravanes en route » minimal + toasts. Locales FR/EN.

## Vérif
- Tests moteur (`caravan.test.ts`) : envoi valide ⇒ pile retirée de A + caravane
  créée avec `daysLeft` cohérent ; arrivée ⇒ garnison de B augmentée, caravane
  retirée ; ville capturée ⇒ `CaravanLost` ; garde-fous (A=B, ville adverse,
  pas de chemin, slot vide). **Golden re-fixé** (forme : `caravans: []` + version).
- save-shape v21. Content 101. Typecheck/lint/build, garde-fou faction. Smoke :
  envoyer une caravane entre 2 villes possédées ⇒ arrivée en garnison.
- doc 02 §4.1 + backlog.

## Différés
- Interception, caravanes de héros (multi-héros non livré), annulation en cours
  de route, file de destination si garnison durablement pleine.

## Journal
- Livré. Commande `SendCaravan` (`town/caravan.ts` : `validateSendCaravan`/
  `handleSendCaravan`/`tickCaravans`), `GameState.caravans` (**save 20→21**),
  event `CaravanSent`/`CaravanArrived`/`CaravanLost`, tick au `DayStarted`, durée
  via A* (`findPath` + somme `stepCost`). Client : onglet Garnison (bouton
  « Caravane » par pile, sélecteur de destination, bandeau des caravanes en
  route) + toasts + locales FR/EN. **Non interceptable** (HoMM3). Golden re-fixé
  `290e3531` (forme : `caravans: []` + version ; journal golden sans caravane ⇒
  `tickCaravans` no-op). Vérif : 486 tests moteur (5 T-CARAVAN), content 101,
  typecheck/lint/build (bundle < 800 Ko), garde-fou faction vert, save-shape v21,
  smoke 146 (dont 1 caravane bout-en-bout : capture 2ᵉ ville → envoi UI →
  arrivée en garnison). doc 02 §4.1 + backlog.
