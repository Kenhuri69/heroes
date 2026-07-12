# Lot NET-SEC.2 — Durcissement backend : bornage de body, quota de slots, purge des sessions

> Backlog : `.claude/plans/game-feature-gaps.md` §2.7 NET-SEC (« Reste
> (NET-SEC.2+) : rate limit par e-mail/IP, bornage taille de body + quota de
> slots, purge des sessions expirées »). Le rate-limit e-mail/IP exige un state
> KV ⇒ lot séparé, HORS périmètre ici.
>
> **Server-only, self-contained** (doc 15 §2/§8). Zéro moteur, zéro faction,
> pas de bump de save, golden inchangé, SDK inerte hors `VITE_BACKEND_URL` ⇒
> smoke non régressé.

## Contexte

Le Worker (`server/src/worker.ts`) parse `request.json()` sans borne de taille
(risque d'épuisement mémoire du Worker), n'impose aucun plafond au nombre de
slots de save par profil (un client peut créer des slots à l'infini), et ne
purge jamais les sessions/jetons expirés (la table `sessions` croît sans fin).

## Changements (server-only)

1. **Bornage de la taille de body** — helper `body<T>(request, max)` qui lit
   `request.text()`, rejette **413** si la taille dépasse la borne, puis
   `JSON.parse` (rejet **400** si JSON invalide). Deux bornes :
   - `MAX_BODY_BYTES` (256 Ko) pour auth / matches / moves (petits corps) ;
   - `MAX_SAVE_BYTES` (4 Mo) pour `PUT /saves/:slot` (état de jeu sérialisé,
     grandes cartes 256²).
   Erreur typée `HttpError(status, message)` remontée par le `try` externe
   (sinon `500`). Remplace les 4 `await request.json()`.

2. **Quota de slots de save** — constante `MAX_SAVE_SLOTS` (20). Sur
   `PUT /saves/:slot` vers un slot **nouveau** (pas de ligne existante), si le
   profil possède déjà `MAX_SAVE_SLOTS` slots ⇒ **409** « quota atteint ». La
   mise à jour d'un slot existant reste toujours permise. Réutilise la requête
   `existing` déjà présente (garde anti-downgrade).

3. **Purge opportuniste des sessions/jetons expirés** — sur `/auth/verify`
   (faible fréquence, après validation du jeton), `DELETE FROM sessions WHERE
   expires_at < now()` et `DELETE FROM auth_tokens WHERE expires_at < now()`.
   Best-effort, empêche la croissance sans fin des tables.

Client : note de doc sur `putSave` (le 409 couvre désormais aussi le quota).

## Vérification

- [ ] `pnpm typecheck` (5/5 — inclut `@heroes/server`)
- [ ] `pnpm lint`
- [ ] `pnpm --filter @heroes/engine test` + `@heroes/content` (non régressés)
- [ ] `pnpm content:check`
- [ ] garde-fou « zéro faction » (grep) + garde-fou couleurs
- [ ] `pnpm build` + budget bundle gzip < 800 Ko
- [ ] `pnpm smoke` (SDK inerte ⇒ non régressé)
- [ ] golden inchangé, pas de bump `CURRENT_SAVE_VERSION`

## Journal

- 2026-07-12 — Plan créé, branche `claude/net-sec-2` depuis main (@d6aa155).
- 2026-07-12 — **Implémenté** : helper `body<T>(request, max)` + `HttpError`
  (413/400), `MAX_BODY_BYTES`/`MAX_SAVE_BYTES`/`MAX_SAVE_SLOTS` ; 4
  `request.json()` remplacés ; quota sur slot nouveau (réutilise `existing`) ;
  purge `sessions`/`auth_tokens` expirés au `verify` ; catch `HttpError` externe.
  Doc 15 §5.1/§5.2 mise à jour, backlog coché. SDK `putSave` : note 409/413.
  **Vérifs** : typecheck 5/5 ✅, lint ✅, engine 642 / content 119 tests ✅,
  content:check ✅, garde-fou faction ✅ + couleurs ✅, build + bundle 303 Ko gzip
  ✅, golden inchangé (aucun diff moteur) ✅, pas de bump save. Smoke en cours.
