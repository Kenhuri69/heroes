# Plan — Lot 7.2 : le Worker Cloudflare (doc 15 §5)

Sur la fondation 7.1 (`engine/net` + schéma D1 provisionné), livrer **le Worker** :
l'API HTTP du backend, qui **valide chaque tour posté par re-simulation** (jamais
de confiance au client). **Zéro diff moteur** (golden inchangé). Le Worker est
**hors build client** et **hors smoke** (service externe).

## Portée

- `server/` devient un **membre du workspace** (ajout à `pnpm-workspace.yaml`) :
  - `server/package.json` — `@heroes/server`, dépend UNIQUEMENT de
    `@heroes/engine` (workspace) ; aucun paquet réseau (le type D1 est déclaré à
    la main, les types web viennent de la lib `WebWorker`). Script `typecheck`.
  - `server/tsconfig.json` — extends base, `lib: ["ES2022","WebWorker"]`.
  - `server/src/worker.ts` — handler `fetch` + routage + accès D1 ; type D1
    minimal déclaré localement.
  - `server/wrangler.toml` — binding D1 `DB` → base `heroes`
    (id `cb83efa4-81f2-404c-b83d-5626117cda56`).
- **Endpoints** (doc 15 §5) :
  - `POST /auth/request { email }` → jeton magic-link ; l'e-mail est **pluggable**
    (pour l'instant le lien est renvoyé dans la réponse / loggé, pas envoyé).
  - `GET /auth/verify?token` → profil + session (bearer).
  - `PUT /saves/:slot` · `GET /saves/:slot` (auth).
  - `POST /matches` · `POST /matches/:id/join`.
  - `POST /matches/:id/moves` → **`appendTurn` (re-sim)** valide seq contigu, bon
    joueur, commandes légales avant insertion.
  - `GET /matches/:id/moves?since=seq`.
- **Déploiement = étape MANUELLE** `wrangler deploy` (l'MCP Cloudflare ne déploie
  pas de Worker → identifiants CF de l'utilisateur). Je ne déploie PAS.

## Vérification

- typecheck 4/4 **+ server** (tsc) · moteur (golden inchangé) · content ·
  `content:check` · garde-fous faction/couleurs · build client (server exclu) ·
  smoke desktop + mobile (non-régression — Worker hors smoke).
- Lockfile pnpm mis à jour (nouveau membre workspace, dep workspace uniquement →
  pas de téléchargement réseau).

## Différé (hors CI)

- Test d'intégration Worker↔D1 via `wrangler dev`/Miniflare (local, hors CI).
- E-mail réel (Resend/MailChannels) : clé fournie par l'utilisateur.

## Vérification 7.2

- [x] typecheck 4/4 **+ server** (`server` membre du workspace, tsc propre)
- [x] moteur 326 (golden **inchangé** + match)
- [x] content 82 + `content:check`
- [x] lint (server inclus dans `eslint .`) · garde-fous faction/couleurs propres
- [x] build client (< 800 Ko) — server **exclu** du build client
- [x] smoke desktop + mobile (non-régression — Worker hors smoke)
- [x] lockfile pnpm mis à jour (dep workspace uniquement, aucun téléchargement)

## Décisions / écarts

- **`server/` = membre du workspace** (`pnpm-workspace.yaml`), typechecké par
  `pnpm -r`. Aucune dépendance réseau : le type D1 est **déclaré à la main** dans
  `worker.ts` et les types web viennent de `lib: WebWorker` → pas de
  `@cloudflare/workers-types`, lockfile stable (relink workspace seul).
- **Anti-triche par re-simulation** dans `POST /moves` : le Worker reconstruit
  `[StartGame, …lots]`, vérifie la contiguïté du `seq`, puis `appendTurn` (bon
  joueur + commandes légales) — refus 409/422 sinon. Fin de partie détectée au
  rejeu (`outcome`) → `status = finished`.
- **E-mail magic-link pluggable** : `/auth/request` renvoie le lien de
  vérification (au lieu de l'envoyer) tant qu'aucun provider n'est branché —
  suffisant pour tester en local, prêt à recevoir Resend/MailChannels.
- **Déploiement NON effectué** (l'MCP Cloudflare ne déploie pas de Worker) :
  `wrangler deploy` reste l'étape manuelle de l'utilisateur.
- CI : `pnpm typecheck` couvre server ; `pnpm test`/`build`/`smoke` l'ignorent
  (service externe, non déterministe).
