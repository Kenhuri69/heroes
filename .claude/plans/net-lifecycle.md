# Lot NET-LIFECYCLE — Forfait volontaire + expiration d'inactivité (PvP async)

> Backlog §2.7 NET-LIFECYCLE (« abandon volontaire, expiration d'inactivité,
> statut `abandoned` »). **Server-only, self-contained** (doc 15). Le jalon
> « PvP stable » (doc 09 Phase 3) implique une fin de partie propre hors victoire.

## Contexte

`server/src/worker.ts` ne connaît que `open | active | finished`. Une partie
async peut donc rester `active` indéfiniment si un joueur ne rejoue plus, et il
n'existe aucun moyen d'abandonner volontairement.

## Décisions design (appliquées, doc 15)

- **Zéro migration de schéma D1** : `abandoned` est une nouvelle VALEUR de la
  colonne `status` (TEXT), pas une colonne. Pas de blocage « migration base live ».
- **Forfait = le caller perd** : dans une partie async (souvent 2 joueurs), le
  client non-forfaiteur infère sa victoire en voyant `abandoned` (info ouverte,
  décision NET-FOG). On ne stocke pas le vainqueur (pas de colonne).
- **Expiration paresseuse** : pas de cron Worker configuré ⇒ une partie `active`
  inactive depuis `TURN_TIMEOUT_MS` (14 j) est marquée `abandoned` au moment où
  on la consulte (détail) ou où on tente d'y jouer.

## Changements (server + SDK)

1. `POST /matches/:id/forfeit` — participant d'une partie `open`/`active` ⇒
   `status = 'abandoned'` (idempotent, borné par `status IN ('open','active')`).
2. **Expiration paresseuse** : `TURN_TIMEOUT_MS` + helper `effectiveStatus`
   (dernière activité = dernier `moves.created_at`, sinon `matches.created_at`).
   Appliqué au **détail GET** (persiste `abandoned` si expiré) et au **move POST**
   (rejet **409** si la partie n'est plus jouable — finished/abandoned/expirée).
   Détail GET expose `created_at` (déjà `seed/setup/status/players/seq`).
3. `net.ts` (SDK) : `forfeitMatch(id)` ; `MatchDetail` documente `abandoned` +
   ajoute `created_at`.

## Vérification (pas de harness Worker — doc lot NET-*)

- [ ] `pnpm typecheck` 5/5 (server + client) · `pnpm lint`
- [ ] tests engine/content non régressés · `content:check`
- [ ] garde-fous faction/couleurs · `pnpm build` + bundle < 800 Ko gzip
- [ ] `pnpm smoke` non régressé (SDK inerte hors `VITE_BACKEND_URL`)
- [ ] golden inchangé, pas de bump save (zéro moteur)

## Journal

- 2026-07-12 — Plan créé, branche `claude/net-lifecycle` depuis main (@0346150).
- 2026-07-12 — **Implémenté**. Worker : `TURN_TIMEOUT_MS` (14 j) + helper
  `effectiveStatus` (expiration paresseuse persistée) ; `POST /matches/:id/forfeit`
  (participant → `abandoned`) ; détail GET applique l'expiration + expose
  `createdAt` ; move POST rejette 409 si non jouable (finished/abandoned/expiré).
  SDK `forfeitMatch` + `MatchDetail.createdAt` + doc `abandoned`. Doc 15 §5.3 +
  backlog mis à jour. Zéro migration de schéma (nouvelle valeur de `status`).
  **Vérifs** : typecheck 5/5 ✅, lint ✅, engine golden+save-shape inchangés ✅,
  content 123 ✅, build + bundle 305 Ko gzip ✅, garde-fous faction/couleurs ✅.
  Zéro moteur/save/golden. Smoke en cours (SDK inerte hors backend).
