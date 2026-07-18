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
   expirant) et **envoie** un lien `…/auth/verify?token=…` par e-mail dès que
   `RESEND_API_KEY` est branché (lot 4.3, §10 pt 6) ; sinon il le renvoie dans la
   réponse (`verifyLink`, dev/beta).
2. `GET /auth/verify?token` → jeton valide & non utilisé ⇒ crée/retrouve le
   `profiles`, ouvre une `sessions` (bearer), marque le jeton `used`. **NET-SEC.1** :
   le `handle` (partie locale de l'e-mail, `UNIQUE`) est **désambiguïsé** sur
   collision (suffixe tiré de l'uuid) — deux e-mails de même partie locale ne font
   plus 500.
3. Requêtes suivantes : `Authorization: Bearer <session>`.
4. **`DELETE /session`** (NET-SEC.1) : révoque la session courante côté serveur
   (déconnexion) ; le SDK `logout()` l'appelle en best-effort.
5. **NET-SEC.2** : au `verify` (faible fréquence, après validation du jeton), le
   Worker **purge** les `sessions` et `auth_tokens` expirés (`expires_at < now`) —
   les tables ne croissent plus sans fin. **Reste NET-SEC différé** : rate-limit
   e-mail/IP (exige un state KV, lot à part).

### 5.2 Cloud saves

`PUT /saves/:slot { state, save_version }` (upsert) · `GET /saves/:slot` ·
`GET /saves` (**liste** des slots du profil : `slot`, `save_version`, `updated_at`,
sans le blob `state` — requête légère pour l'UI, NET-CLOUDSAVES.2). Le
client réutilise `serializeState`/`deserializeState` et la **garde de version**
(doc 07 §4, 3.8) déjà en place — un save d'une autre version est rejeté proprement.
Le panneau **En ligne** (`OnlinePanel`) affiche la liste des sauvegardes cloud
(libellé de slot, horodatage, version) avec **Charger** par slot et **Téléverser
la partie en cours** ; le tout gaté par `isOnline()+isLoggedIn()`.
**Garde serveur (NET-SRVGUARD)** : le Worker applique aussi une garde
**anti-downgrade** — un `PUT /saves` dont le `save_version` est **antérieur** à
celui déjà stocké pour ce slot est rejeté (**409**), un client obsolète ne peut
donc pas écraser une sauvegarde plus récente (« le plus récent gagne », doc 07 §4).
Le serveur reste version-agnostique (pas de constante moteur dupliquée). **Copie
de sécurité N-1** (doc 07 §4) : différée (NET-SRVGUARD.2 — évolution de schéma D1).
**Quota de slots (NET-SEC.2)** : un `PUT` vers un slot **nouveau** est rejeté
(**409**) si le profil possède déjà `MAX_SAVE_SLOTS` (20) slots ; mettre à jour un
slot existant reste permis. **Bornage de taille** : tout corps JSON est borné
(`MAX_BODY_BYTES` 256 Ko ; `MAX_SAVE_BYTES` 4 Mo pour `PUT /saves`) — au-delà,
rejet **413** (garde-fou anti-épuisement mémoire du Worker).

### 5.3 PvP asynchrone

> **UI client (NET-PVPUI)** : le panneau **En ligne** (`OnlinePanel`, connecté)
> expose « Parties en ligne » — **slice A (lobby)** : Créer (réutilise le pipeline
> « nouvelle partie » via le drapeau `online` ⇒ le `StartGame` devient le `setup`
> du match, `createMatch`), liste avec statut, Rejoindre, Abandonner. **slice B
> (boucle de tour)** : **Jouer** une partie `active` → `openOnlineMatch`
> (`getMatch`+`getMoves` → `replayCommands` reconstruit l'état) ; à mon tour je
> joue hors-ligne, `dispatch` **capture** mes commandes et poste le lot
> (`postMove`) à l'`EndTurn` ; sinon un **overlay bloquant** (`OnlineWaitOverlay`)
> masque le plateau avec **Rafraîchir** (re-synchro du journal) / **Quitter**.
> `profileId` persisté à la connexion identifie mon siège. **slice C (polling)** :
> tant que l'overlay d'attente est monté, `pollOnlineMatch` sonde `GET /matches/:id`
> (~12 s, coupé si l'onglet est masqué) ; dès que l'adversaire a joué (`seq`
> avancé) l'état se re-synchronise et l'overlay se lève seul ; la fin/abandon
> (statut serveur `finished`/`abandoned`) est surfacée à l'écran.

1. `POST /matches { seed, setup(StartGame), seats }` → `matches` + `match_players`.
2. Un adversaire rejoint un siège libre (`POST /matches/:id/join`).
3. À son tour, un joueur `POST /matches/:id/moves { seq, commands }`. Le Worker
   **rejoue** `base + batch` via `appendTurn` : refuse si ce n'est pas son tour,
   si `seq` n'est pas contigu, ou si une commande est illégale. Sinon insère la
   ligne `moves`.
4. Pour (re)construire l'état de zéro, le client lit d'abord
   **`GET /matches/:id`** → `{ id, seed, setup, players, status, seq }`
   (NET-MATCHDETAIL, livré ; SDK `getMatch`), puis rejoue `base(setup) + batch`.
5. L'adversaire **poll** `GET /matches/:id/moves?since=seq`, rejoue les nouveaux
   lots (`replayCommands`) pour obtenir l'état courant, joue, poste. Fin de partie
   = `GameState.outcome` non nul (le serveur le détecte au rejeu → `status`).
6. **Cycle de vie (NET-LIFECYCLE)** : `POST /matches/:id/forfeit` (un participant
   abandonne ⇒ `status = 'abandoned'`) ; **expiration paresseuse** — une partie
   `active` inactive depuis `TURN_TIMEOUT_MS` (14 j) devient `abandoned` à la
   consultation (`GET /matches/:id`) ou à la tentative d'un coup (`POST …/moves`
   rejeté **409**). Le vainqueur n'est pas stocké (pas de colonne, zéro migration) :
   dans une partie à 2, l'adversaire non-forfaiteur infère sa victoire du statut
   `abandoned` (info ouverte, décision NET-FOG). Le détail expose aussi `createdAt`.

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

## 10. Mise en ligne (automatisée — Live 7.4)

La plomberie (7.1 fondation + 7.2 Worker + 7.3 client) est complète. Le
déploiement passe par **GitHub Actions** : le token Cloudflare vit en **secret
GitHub**, jamais en clair. Étapes de l'utilisateur (une fois) :

1. **Token** — Cloudflare → *My Profile → API Tokens* → template **« Edit
   Cloudflare Workers »** (couvre Workers + D1). Copier le token.
2. **Secrets GitHub** (repo → *Settings → Secrets and variables → Actions →
   Secrets*) :
   - `CLOUDFLARE_API_TOKEN` = le token ;
   - `CLOUDFLARE_ACCOUNT_ID` = l'id de compte (Cloudflare → Workers & Pages →
     colonne de droite « Account ID »).
3. **Déployer le Worker** — Actions → **Deploy Worker** → *Run workflow*. Si le
   compte n'a **jamais enregistré de sous-domaine workers.dev**, le Worker se
   téléverse mais n'a aucune URL publique (erreur *« register a workers.dev
   subdomain »*). Dans ce cas, relancer le workflow en renseignant le champ
   **`subdomain`** (ex. `kenhuri`) : une étape enregistre le sous-domaine via
   l'API Cloudflare (le token secret sert d'auth, idempotent) avant de déployer.
   L'URL apparaît alors dans les logs (`https://heroes.<sous-domaine>.workers.dev`).
4. **Variable GitHub** (même écran, onglet *Variables*) : `VITE_BACKEND_URL` =
   cette URL. **Absente ⇒ client hors-ligne** (défaut sûr).
5. **Publier le client** — Actions → **Deploy to GitHub Pages** → *Run workflow*
   (ou tout push sur `main`). Le client déployé est rebuild AVEC `VITE_BACKEND_URL`
   (le smoke, lui, tourne sur un build hors-ligne) → le bouton **« En ligne »**
   apparaît. `wrangler.toml` référence déjà la base D1 `heroes` (schéma appliqué).
6. **Option e-mail (Resend, lot 4.3)** — le worker envoie **réellement** le lien
   dès que le secret `RESEND_API_KEY` est présent ; sinon il renvoie le lien dans
   la réponse (dev/beta, défaut sûr). Runbook :
   - Créer un compte Resend (free) et une clé API (*API Keys → Create*).
   - `wrangler secret put RESEND_API_KEY` (depuis `server/`, via pnpm) et coller la clé.
   - **Expéditeur** : par défaut `Heroes <onboarding@resend.dev>` (domaine de test
     Resend, fonctionne sans vérification). Pour un domaine propre, le vérifier
     dans Resend puis `wrangler secret put AUTH_EMAIL_FROM` (ex.
     `Heroes <login@mon-domaine.tld>`).
   - Effet : `POST /auth/request` renvoie `{ ok: true, emailed: true }` (plus de
     `verifyLink`) ; le client affiche « lien envoyé par e-mail ». Un échec d'envoi
     Resend ⇒ `502` (on ne retombe pas sur le renvoi du lien pour ne pas ré-ouvrir
     la fuite). **Reste NET-SEC différé** : rate-limit e-mail/IP (state KV).

- Ultérieur : notifications push (au lieu du polling), classement saisonnier
  (doc 09 Beta), re-sim de litige (comparaison de `replayHash`), écrans PvP async
  complets (le SDK `app/net.ts` les expose déjà).
