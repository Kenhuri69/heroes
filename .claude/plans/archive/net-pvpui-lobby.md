# Lot — NET-PVPUI (slice A) : lobby PvP asynchrone

> Direction utilisateur « go pvpui » (2026-07-16). **Audit** : toute la pile PvP
> async existe **déjà** — serveur (`worker.ts` : create/list/detail/join/forfeit/
> moves + validation `appendTurn` + lifecycle/timeout), SDK (`app/net.ts` :
> `listMatches`/`createMatch`/`getMatch`/`joinMatch`/`forfeitMatch`/`getMoves`/
> `postMove`), moteur (`engine/net` : `replayCommands`/`appendTurn`/
> `currentTurnPlayerId`). **Il ne manque que l'UI client.** Gros lot ⇒ découpé.

## Découpage (3 slices)

- **A — Lobby (CE LOT)** : créer / lister / rejoindre / abandonner + statut.
- **B — Boucle de tour** : ouvrir → `replayCommands` reconstruit → jouer son tour
  hors-ligne → `postMove` (validé serveur) ; état « en attente » sinon.
- **C — Polling « c'est ton tour » + reprise/refresh + fin de partie**.

## Slice A — périmètre (client only, ZÉRO moteur/serveur/donnée)

1. `app/game.ts` : `NewGameRawConfig` gagne `online?: boolean` (drapeau optionnel).
2. `main.ts` `startNewGameSetup` : après construction du `command`
   (`newGameStartCommand`), **branche** `if (raw.online)` → `createMatch(seed,
   command)` + toast + `window` event `heroes:matches-changed` (**pas** de
   `dispatch` local ni de navigation) ; sinon chemin local **inchangé** (couvert
   par le smoke).
3. `ui/OnlinePanel.tsx` (section connectée) : « Parties en ligne » —
   - **Créer** : construit un preset async 2 sièges humains (factions/carte/
     ressources `RANDOM` seedé, `mapSize` Petite, seed `Date.now()`) et émet
     `heroes:start-newgame` avec `online:true`.
   - **Liste** : `listMatches()` — statut i18n + date ; **Rejoindre** (`joinMatch`)
     sur `open` ; **Abandonner** (`forfeitMatch`) sur `active`. Rafraîchit sur
     montage, sur `heroes:matches-changed`, et via bouton **Rafraîchir**.
   - État vide, erreurs par toast.
4. i18n core fr/en : `online.matches.*`, `toast.matchCreated/matchError`.
5. Docs 15 §5.3 (UI lobby) + backlog (NET-PVPUI : slice A livrée, B/C à suivre).

## Vérification

- typecheck, lint, garde-fous faction/couleurs, content:check, build, bundle,
  smoke @core (**régression** — le chemin local `startNewGameSetup` sans `online`
  est inchangé ; la branche `online` n'est jamais prise en CI, pas de backend).
- ⚠️ Chemin en ligne **non couvert par le smoke** (pas de backend/`VITE_BACKEND_URL`
  en CI) — dit franchement (guideline §7). Additif derrière `isOnline()+isLoggedIn()`.

## Garde-fous

- Zéro moteur, zéro serveur, zéro donnée de faction ⇒ pas de bump save, golden
  inchangé, garde-fous non concernés.
- La branche `online` de `startNewGameSetup` est gardée (`if (raw.online)`) ⇒ le
  démarrage local (smoke) est bit-à-bit inchangé quand `online` est absent/false.
- Slice A ne rend pas la partie **jouable** (c'est la slice B) — assumé et annoncé.

## Statut : LIVRÉ (slice A)

Pipeline vert : typecheck (server+client), lint, garde-fous faction/couleurs
(status 1), content:check, build, bundle 323 349 o < 819 200, smoke @core 22/22
(régression du chemin local — branche `online` non prise en CI). Zéro moteur/
serveur, pas de bump save, golden inchangé. Slices B (boucle de tour) et C
(polling) à suivre.
