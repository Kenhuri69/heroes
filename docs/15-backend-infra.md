# 15 — Backend & infrastructure (coût 0)

> Statut : **fondation livrée (Live 7.1)**. Ce document est la source de vérité du
> backend (doc 07 §5 : comptes, cloud saves, PvP asynchrone, serveur autoritaire).

## 1. Principe : le moteur déterministe fait le gros du travail

Le moteur est **pur et seedé** (invariant README §2). Donc :

> **une partie ≡ `(seed, StartGame, journal ORDONNÉ de commandes)`**

Rejouer ce journal reconstruit l'état **exact** — c'est déjà ce que prouve le
*golden replay* (doc 07 §7). Conséquence directe : le backend n'a **presque rien
à calculer**. Il **stocke** un journal append-only, le **relaie** entre joueurs, et
**valide** chaque tour posté en le **rejouant** (`engine/net`). Le « serveur
autoritaire par re-simulation » de la doc 07 §5 devient quasi gratuit ; l'anti-
triche est un effet de bord du déterminisme.

Le PvP **asynchrone** n'exige aucun temps réel : les notifications « c'est ton
tour » se font par **polling** léger côté client (ou webhook/push plus tard).

## 2. Stack : Cloudflare Workers + D1 — 0 €

| Besoin (doc 07 §5) | Brique | Coût |
|---|---|---|
| API | **Workers** (100k req/j gratuits) | 0 € |
| Base (comptes, saves, matches, moves) | **D1** (SQLite, 5 Go) | 0 € |
| Auth magic-link | Worker + D1 + e-mail (Resend free / MailChannels) | 0 € |
| PvP async + notifications | Journal D1 + **polling** client | 0 € |
| Re-simulation autoritaire | Worker importe `@heroes/engine` | 0 € |

Choisi plutôt que Supabase (free tier plafonné à 2 projets, déjà pleins sur le
compte) : Cloudflare n'a **ni limite de projets ni mise en pause**. Contrepartie :
l'auth magic-link et les notifications sont à coder (pas « batteries incluses »).

## 3. `engine/net` — le cœur partagé (Live 7.1 ✅)

Helpers **purs et déterministes** de `@heroes/engine`, utilisés par le serveur
(validation) ET le client (rejeu) :

- `replayCommands(commands)` — rejoue un journal depuis l'état vide → `GameState`
  (lève si une commande est illégale).
- `replayHash(commands)` — empreinte canonique d'un journal (deux rejeux honnêtes
  coïncident : socle de l'anti-triche).
- `currentTurnPlayerId(state)` — le joueur du tour (`null` si partie finie).
- `appendTurn(base, playerId, batch)` — valide qu'un lot est bien du joueur
  courant puis le rejoue ; renvoie le journal augmenté ou un motif de rejet.

## 4. Modèle de données (D1 — `server/schema.sql`)

7 tables : `profiles`, `auth_tokens`, `sessions` (comptes) ; `saves` (cloud
saves : `serializeState` + `save_version`) ; `matches` (seed + `StartGame`
sérialisé + statut) ; `match_players` (sièges = ordre de tour) ; `moves`
(journal **append-only** : une ligne = un lot de commandes d'un joueur). La base
`heroes` est **provisionnée** (région WEUR) et le schéma appliqué.

## 5. Flux

### 5.1 Auth (magic-link)

1. `POST /auth/request { email }` → le Worker crée un `auth_tokens` (aléatoire,
   expirant) et envoie un lien `…/auth/verify?token=…`.
2. `GET /auth/verify?token` → jeton valide & non utilisé ⇒ crée/retrouve le
   `profiles`, ouvre une `sessions` (bearer), marque le jeton `used`.
3. Requêtes suivantes : `Authorization: Bearer <session>`.

### 5.2 Cloud saves

`PUT /saves/:slot { state, save_version }` (upsert) · `GET /saves/:slot`. Le
client réutilise `serializeState`/`deserializeState` et la **garde de version**
(doc 07 §4, 3.8) déjà en place — un save d'une autre version est rejeté proprement.

### 5.3 PvP asynchrone

1. `POST /matches { seed, setup(StartGame), seats }` → `matches` + `match_players`.
2. Un adversaire rejoint un siège libre (`POST /matches/:id/join`).
3. À son tour, un joueur `POST /matches/:id/moves { seq, commands }`. Le Worker
   **rejoue** `base + batch` via `appendTurn` : refuse si ce n'est pas son tour,
   si `seq` n'est pas contigu, ou si une commande est illégale. Sinon insère la
   ligne `moves`.
4. L'adversaire **poll** `GET /matches/:id/moves?since=seq`, rejoue les nouveaux
   lots (`replayCommands`) pour obtenir l'état courant, joue, poste. Fin de partie
   = `GameState.outcome` non nul (le serveur le détecte au rejeu → `status`).

## 6. Stratégie de vérification

Le réseau ne peut pas entrer dans le **smoke déterministe** (pas de service
externe en CI). D'où :

- **Logique pure** (`engine/net`, machine à états de tour, framing du journal) →
  **tests unitaires** (`match.test.ts`, déterministes). C'est là que vit le risque.
- **Worker ↔ D1** → testé en local (wrangler dev / Miniflare), hors CI committée.
- **Client `@heroes/net`** → **derrière un flag de config** (URL backend absente
  par défaut) : le jeu hors-ligne et le smoke ne touchent **jamais** le réseau.

## 7. Déploiement (Live 7.2/7.3, hors MCP)

L'MCP Cloudflare crée/query D1 mais **ne déploie pas de Worker**. Le déploiement
se fait avec les identifiants Cloudflare de l'utilisateur :

```
# une fois : lier la base (binding DB) dans server/wrangler.toml
wrangler d1 execute heroes --file=server/schema.sql   # (déjà appliqué via MCP)
wrangler deploy server/worker.ts                       # 7.2
```

Le client 7.3 lit l'URL du Worker depuis une variable de build (Vite env) ; sans
elle, les écrans en ligne restent masqués (jeu 100 % hors-ligne, comme aujourd'hui).

## 8. Coût & limites

Tout sur les free tiers Cloudflare : Workers 100k req/j, D1 5 Go + 5 M lignes
lues/j. Aucune mise en pause. Migration vers un plan payant seulement si le trafic
d'une beta ouverte dépasse ces seuils — improbable avant une audience réelle.

## 9. Reste à faire

- **7.2 ✅** — le Worker (`server/src/worker.ts` + `server/wrangler.toml`) :
  endpoints §5, re-sim via `engine/net`, e-mail magic-link *pluggable* (le lien de
  vérification est renvoyé tant qu'aucun provider n'est branché). `server/` est un
  membre du workspace typechecké en CI (hors build client / smoke). **Déploiement
  `wrangler deploy` = étape manuelle** de l'utilisateur (identifiants CF).
- **7.3 ✅** — client `app/net.ts` (SDK typé : auth / saves / matches / moves),
  **entièrement conditionné par `VITE_BACKEND_URL`** (inerte + invisible sans
  backend) ; panneau « En ligne » de connexion magic-link (l'UI PvP complète est un
  suivi ; le SDK l'expose déjà). `GET /matches` ajouté au Worker.

## 10. Backend code-complet — étapes manuelles restantes

La plomberie (7.1 fondation + 7.2 Worker + 7.3 client) est complète et vérifiée en
CI. Pour **mettre en ligne**, côté utilisateur (identifiants/hébergement lui
appartenant) :

1. `cd server && wrangler deploy` (identifiants Cloudflare) → l'URL du Worker.
2. Construire le client avec `VITE_BACKEND_URL=<url-du-worker>` (le bouton « En
   ligne » apparaît alors ; le smoke, lui, n'a jamais cette variable).
3. Optionnel : brancher un provider d'e-mail (Resend free) pour envoyer réellement
   les liens magic-link au lieu de les renvoyer dans la réponse.
- Ultérieur : notifications push (au lieu du polling), classement saisonnier
  (doc 09 Beta), re-sim de litige (comparaison de `replayHash`).
