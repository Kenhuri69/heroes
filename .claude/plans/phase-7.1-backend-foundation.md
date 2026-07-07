# Plan — Lot 7.1 : fondation backend Cloudflare (doc 07 §5, doc 09 Phase 4)

Backend **coût 0** sur **Cloudflare Workers + D1** (choix utilisateur : pas de
limite de projets, pas de mise en pause, indépendant des projets Supabase
existants). Besoins doc 07 §5 : comptes (magic-link), cloud saves, PvP asynchrone
+ notifications, **serveur autoritaire par re-simulation**.

## Levier : le moteur déterministe

Une partie ≡ `(seed, StartGame, journal ORDONNÉ de commandes)`. Rejouer le journal
reconstruit l'état exact (déjà prouvé par le golden replay). Le backend se réduit
à **stockage + relais + validation par re-sim** — parfait pour un free tier. Le
Worker importe `@heroes/engine` et **rejoue** chaque tour posté pour l'accepter
(anti-triche gratuit). Le PvP **asynchrone** n'a pas besoin de temps réel :
notifications par **polling** côté client (« est-ce mon tour ? »).

## Découpage (comme N2/6)

- **7.1 (ce lot) — fondation** : helpers **purs** de netcode dans `@heroes/engine`
  (`replayCommands`/`replayHash`/`currentTurnPlayerId`/`appendTurn`) + tests
  unitaires ; **schéma D1** (`server/schema.sql`) ; **base D1 provisionnée** via
  MCP + schéma appliqué ; **doc `docs/15-backend-infra.md`**. AUCUN Worker déployé,
  AUCUN câblage client → zéro régression (le moteur pur ne change pas de
  comportement, golden inchangé).
- **7.2 — le Worker** (`server/`) : API HTTP (auth magic-link, matches, moves,
  saves) sur D1 + wrangler ; typecheck ; déploiement `wrangler deploy` = **étape
  manuelle** (l'MCP Cloudflare n'a pas d'outil de déploiement de Worker → besoin
  des identifiants CF de l'utilisateur).
- **7.3 — client `@heroes/net`** : SDK + écrans (connexion magic-link, liste de
  parties, PvP async par polling), **derrière un flag de config** (URL backend) →
  le jeu hors-ligne et le smoke restent intacts (jamais de réseau dans le smoke).

## Portée 7.1

- `packages/engine/src/net/match.ts` : `replayCommands` (fold `apply` depuis l'état
  vide, lève sur commande illégale), `replayHash` (empreinte via `hashState`),
  `currentTurnPlayerId` (joueur du tour, `null` si `outcome`), `appendTurn`
  (valide qu'un lot est bien du joueur courant et rejoue sans erreur). Export index.
- `packages/engine/test/match.test.ts` : StartGame 2 joueurs (fixtures), rotation
  des tours par `EndTurn`, déterminisme du hash, rejet d'un tour hors-tour /
  illégal.
- `server/schema.sql` : profiles, auth_tokens, sessions, saves, matches,
  match_players, moves.
- Base D1 `heroes` créée + schéma appliqué (via MCP).
- `docs/15-backend-infra.md` : design complet (stack, levier déterministe, modèle
  de données, endpoints, auth, PvP async, stratégie de vérification, déploiement,
  coût 0).

## Vérification 7.1

typecheck 4/4 · moteur (golden **inchangé** + tests match) · content ·
`content:check` · garde-fou faction + couleurs · build < 800 Ko · smoke
desktop + mobile (non-régression — 7.1 sans UI ni réseau).

## Vérification 7.1

- [x] typecheck 4/4
- [x] moteur **326** (golden **inchangé** + 5 tests `match.test.ts`)
- [x] content 82 + `content:check`
- [x] garde-fou faction + couleurs (grep local : propres)
- [x] lint · build client (< 800 Ko gzip)
- [x] smoke desktop + mobile (non-régression — 7.1 sans UI ni réseau)
- [x] **D1 provisionnée** : base `heroes` (uuid `cb83efa4-…`, région WEUR) + 7
      tables créées via MCP (vérifié par `sqlite_master`)

## Décisions / écarts

- **Cloudflare Workers + D1** retenu (choix utilisateur) : Supabase free tier
  plafonné à 2 projets, déjà pleins sur le compte (`hogwarth`/`photobook`) — je
  n'ai PAS touché aux projets existants. Cloudflare : 0 €, pas de plafond de
  projets, pas de mise en pause.
- **`engine/net` dans le moteur** : le netcode se réduit à composer `apply`
  (rejeu) — pur, déterministe, sans faction ni DOM, même esprit que le golden
  replay (doc 07 §7). N'altère aucun comportement existant ⇒ golden inchangé.
- **Déploiement du Worker hors MCP** : l'MCP Cloudflare crée/query D1 (fait) mais
  n'a pas d'outil de déploiement de Worker → `wrangler deploy` = étape manuelle
  (identifiants CF de l'utilisateur), documentée doc 15 §7. C'est pourquoi 7.1 ne
  livre PAS le Worker (7.2) ni le client (7.3).
- **Vérification hors smoke** : un backend externe ne peut pas entrer dans le
  smoke déterministe ; la logique à risque (`engine/net`) est couverte en
  **unitaire**, l'intégration Worker↔D1 se testera en local (wrangler dev), le
  client sera **derrière un flag** (jamais de réseau dans le smoke).
