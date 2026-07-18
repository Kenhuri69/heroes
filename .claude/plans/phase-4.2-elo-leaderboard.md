# Lot 4.2 — Classement Elo + saisons PvP (doc 18 Étape 4, écart E2, taille L)

## Contexte

PvP async fonctionnel (matches, re-sim serveur, forfait, expiration) mais **aucun
classement**. Objectif : table D1 `ratings` (Elo simple), mise à jour à la
résolution d'un match, endpoint classement, écran dans le panneau En ligne.
Saisons = fenêtres de dates.

## Décisions de design

- **Math Elo dans le moteur** (`packages/engine/src/net/elo.ts`, à côté de
  `net/match.ts` déjà partagé avec le worker) : pure, déterministe, sans RNG/date
  ⇒ **couverte par la suite de tests moteur** (déjà gatée en CI) sans monter une
  infra de test worker ; **tree-shakée hors du bundle client** (inutilisée côté
  client, qui lit le classement via l'API). `computeEloUpdate` (départ 1200, K=32).
- **Saisons = clé `'YYYY-MM'`** dérivée du timestamp de résolution (`seasonKey`
  dans le worker, qui utilise librement `Date`). Une note par `(profile_id,
  season)` ⇒ chaque mois repart proprement, sans table de config ni purge.
  Modèle date-window, déterministe.
- **Mise à jour au point d'ancrage `finished`** (`worker.ts`, rejeu ⇒ `outcome`) :
  résolution du gagnant via `match_players.player_id == outcome.winnerPlayerId`,
  Elo pairwise contre chaque autre participant humain (séquentiel pour N>2).
  Vainqueur non inscrit (IA/siège libre) ⇒ no-op. Forfait/abandon **non** classé
  (pas de vainqueur stocké). Exécuté une seule fois (garde de statut existante).
- **Endpoint** `GET /leaderboard[?season=]` (authentifié comme le reste du
  panneau), top 50 `rating DESC` + handle + V/D.
- **Écran** : section « Classement » d'`OnlinePanel`, rang **numéroté** (jamais la
  couleur seule, doc 08).

## Limite de couverture (assumée)

`/leaderboard` + l'écran ne sont **pas** smoke-couverts : le panneau En ligne
n'est monté qu'avec `VITE_BACKEND_URL` (absent du build smoke hors-ligne) et le
réseau n'entre pas dans le smoke déterministe (doc 15 §6). Le risque réel — la
math Elo — est en **unitaire** (`engine/test/elo.test.ts`). Le worker↔D1 se teste
en local (Miniflare), hors CI. Déploiement Cloudflare/D1 **non réalisable dans
cette session** (connecteur non authentifié) : livré en code + schéma + runbook ;
le schéma `ratings` doit être ré-appliqué au déploiement (doc 15 §10 pt 2b).

## Étapes

1. [x] Math Elo pure `engine/net/elo.ts` + export index → `engine/test/elo.test.ts` (5 tests verts)
2. [x] Schéma `ratings` (`server/schema.sql`) + index saison
3. [x] Worker : `seasonKey`/`loadRating`/`writeRating`/`applyMatchElo` + câblage
       `finished` + `GET /leaderboard` → typecheck server ✓
4. [x] Client : SDK `fetchLeaderboard`/`LeaderboardEntry`, section OnlinePanel,
       locales `online.elo.*` FR/EN → typecheck + lint ✓
5. [x] Docs : doc 15 §4/§6b/§10, doc 18 E2 + tableau Étape 4
6. [x] Vérif : typecheck -r ✓, lint ✓, test 876 ✓, content:check ✓, garde-fou
       faction vert, build ✓, budget 330 Ko < 800 ✓, smoke @core 19/19 ✓
