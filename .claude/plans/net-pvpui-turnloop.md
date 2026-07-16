# Lot — NET-PVPUI (slice B) : boucle de tour PvP asynchrone jouable

> Direction utilisateur « go B » (incrémental, 2026-07-16). Suite de la slice A
> (lobby). Rend une partie async **jouable** : reconstruire l'état, jouer son
> tour hors-ligne, poster le lot validé serveur, attendre l'adversaire.

## Contrat (déjà en place, audité)

- `replayCommands([setup, ...tousLesLots])` reconstruit l'état EXACT (moteur pur).
- `POST /matches/:id/moves { seq, commands }` : `seq` = **nombre de lots existants**
  (contigu), validé par `appendTurn(base, monPlayerId, batch)` (bon tour + légalité).
- Un **lot** = les commandes de mon tour **terminées par `EndTurn`**.
- `currentTurnPlayerId(state)` = à qui de jouer.

## Périmètre (client only, ZÉRO moteur/serveur/donnée)

1. `app/net.ts` : persister `profileId` à la connexion (la réponse `/auth/verify`
   le renvoie déjà) ; `export profileId()` ; purge à `logout()`.
2. `app/store.ts` : `onlineMatch: { id, nextSeq, myPlayerId } | null` (+ reset au
   retour menu, comme `playerColors`).
3. `app/online-match.ts` (nouveau) :
   - `openOnlineMatch(id)` : `getMatch`+`getMoves(-1)` → `replayCommands` →
     `setState({ game, onlineMatch, screen:'adventure', modals:[] })` + `GameLoaded`.
     `myPlayerId` = siège dont `profile_id === profileId()`.
   - `refreshOnlineMatch()` : re-`openOnlineMatch(id)` (rebuild déterministe).
   - `recordOnlineTurn(cmd, gameBefore)` : si `onlineMatch` **et** c'était mon tour
     (`currentTurnPlayerId(gameBefore) === myPlayerId`), bufferise `cmd` ; sur
     `EndTurn`, `postMove(id, nextSeq, batch)` → `nextSeq = r.seq+1`, vide le buffer.
     Échec (409/422) ⇒ toast + `refreshOnlineMatch()` (re-sync anti-divergence).
   - `isMyOnlineTurn(game)`.
4. `app/dispatch.ts` : après `emit`, `await recordOnlineTurn(cmd, gameBefore)`
   (avant `runAiLoop`, qui est de toute façon no-op en PvP 2 humains).
5. `ui/OnlineWaitOverlay.tsx` (nouveau) : overlay **bloquant** plein écran quand
   `onlineMatch` **et** pas mon tour (ou statut terminé) — « en attente de
   l'adversaire », **Rafraîchir**, **Abandonner** (`forfeitMatch`), **Quitter**
   (retour menu). Bloque l'entrée pendant le tour adverse sans toucher aux
   handlers de la carte (couvre tout, `pointer-events`).
6. `ui/shell.tsx` : monte `OnlineWaitOverlay` (état `onlineMatch`).
7. `ui/OnlinePanel.tsx` : bouton **Jouer** sur les parties `active` → `openOnlineMatch`.
8. i18n core fr/en (`online.wait.*`, `toast.matchPostError`) + CSS.

## Vérification

- typecheck (server+client), lint, garde-fous, content:check, build, bundle, smoke
  @core (**régression** hors-ligne : `onlineMatch` toujours `null` sans backend ⇒
  overlay jamais monté, `recordOnlineTurn` no-op, `dispatch` inchangé).
- ⚠️ Chemin en ligne **non couvert par le smoke** (pas de backend en CI) —
  dit franchement (guideline §7). Reconstruction/`postMove` = logique pure testée
  indirectement par `engine/net` (déjà couverte côté moteur).

## Garde-fous

- `recordOnlineTurn` ne bufferise/poste QUE si `onlineMatch` non nul ET tour à moi
  ⇒ hors ligne, `dispatch` est bit-à-bit inchangé (smoke intact).
- Pas de suppression de `runAiLoop` : en PvP 2 humains il no-ope déjà.
- Overlay bloquant = gate d'entrée simple (pas de refonte des handlers carte).
- Zéro moteur/serveur/donnée ⇒ pas de bump save, golden inchangé.
- Slice C (polling auto « c'est ton tour ») reste à suivre — ici refresh MANUEL.

## Statut : LIVRÉ (slice B)

Pipeline vert : typecheck (server+client), lint, garde-fous faction/couleurs
(status 1), content:check, build, bundle 324 009 o < 819 200, smoke @core 22/22
(régression du chemin local — `onlineMatch` toujours null sans backend). Zéro
moteur/serveur, pas de bump save, golden inchangé. Slice C (polling auto) à suivre.
