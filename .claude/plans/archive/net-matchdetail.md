# Lot NET-MATCHDETAIL — Endpoint détail de partie

> Backlog `.claude/plans/game-feature-gaps.md` §2.7 NET-MATCHDETAIL (**bloquant PvP**).
> Doc source : `docs/15-backend-infra.md` §5.3 (le client rejoue `base + batch` —
> il lui faut seed/setup/sièges pour reconstruire l'état).

## But

Ajouter l'endpoint **`GET /matches/:id`** au Worker Cloudflare + la méthode SDK
`getMatch(id)`, renvoyant `{ id, seed, setup, players, status, seq }` — le socle
pour reconstruire l'état d'une partie async côté client (NET-PVPUI plus tard).
Self-contained : **zéro moteur, zéro client rendu** (SDK inerte sans
`VITE_BACKEND_URL`).

## Décisions de conception

- **Info ouverte** (décision NET-FOG actée, async v1) : l'endpoint ne filtre pas
  par participant ; il exige seulement l'authentification (`authProfile`, comme
  les autres routes `/matches`).
- **`seq`** = plus grand `seq` des `moves` de la partie (`MAX(seq)`, `-1` si
  aucun coup) — permet au client de savoir jusqu'où rejouer.
- **`players`** = sièges (`seat`, `player_id`, `profile_id`) triés par siège —
  occupation visible (qui tient quel siège).
- Route regex `^/matches/([\w-]+)$` : ne capture pas `/join` ni `/moves`
  (segments supplémentaires) ⇒ aucun conflit d'ordre.

## Étapes

1. Server `worker.ts` : route `GET /matches/:id` (match + players + seq).
2. Client `net.ts` : `getMatch(id)` + interface `MatchDetail`.
3. Vérifs : typecheck (server + client), lint. (Pas de harness de test Worker ⇒
   pas de test unitaire serveur ; intégration exercée à NET-PVPUI. Smoke
   non-régressé : SDK inerte hors `VITE_BACKEND_URL`.)

## Journal

- Branche `claude/net-matchdetail` créée depuis main (2731e3b).
- **Livré.** Worker : route `GET /matches/:id` (match `seed/setup/status` + sièges
  `match_players` + `MAX(seq)` des `moves`), info ouverte, auth requise. SDK :
  `getMatch(id)` + interfaces `MatchDetail`/`MatchSeat`. Docs 15 §5.3 (étape 4
  ajoutée). Zéro moteur/content/data.
- Vérifs : typecheck 5/5 (server + client), lint, content:check, garde-fous
  faction+couleurs verts, build, bundle ~294 Ko gzip < 800, smoke (en cours,
  non-régression : SDK inerte hors `VITE_BACKEND_URL`) — 170 passed. Pas de harness Worker ⇒
  intégration à NET-PVPUI.
