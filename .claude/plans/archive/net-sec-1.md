# Lot NET-SEC.1 — Désambiguïsation de handle + révocation de session

> Backlog `.claude/plans/game-feature-gaps.md` §2.7 NET-SEC (sous-lot .1).
> Doc source : `docs/15-backend-infra.md` §2/§8, doc 07 §5.

## But

Deux correctifs serveur **self-contained** de la piste B, tirés du plus gros
NET-SEC :
1. **Collision de handle** : `/auth/verify` crée un profil avec
   `handle = partie locale de l'e-mail`. `handle` est `UNIQUE` ⇒ deux e-mails de
   même partie locale (`a@x.com`, `a@y.com`) font **500** sur la contrainte
   `UNIQUE`. Désambiguïser le handle sur collision.
2. **Révocation de session** : `logout()` est purement local (aucun
   `DELETE /session`) ⇒ la session reste valide côté serveur. Ajouter l'endpoint
   `DELETE /session` (supprime la session du bearer courant) + le câbler au SDK.

## Décisions de conception

- **Handle** : base = partie locale (tronquée 40) ; si déjà pris, suffixe
  `-<6 hex de l'uuid>` (fraîchement tiré ⇒ unicité pratique). Résiduel
  astronomiquement improbable ⇒ acceptable (pas de boucle de retry).
- **DELETE /session** : requiert l'authentification (`profileId`) ; supprime la
  ligne `sessions WHERE id = <bearer> AND profile_id = <moi>` (on ne révoque que
  SA propre session). Idempotent (`{ ok: true }` même si déjà supprimée).
- CORS `Allow-Methods` gagne `DELETE`.
- SDK `logout()` : appelle `DELETE /session` (best-effort) avant de purger l'état
  local ; l'échec réseau ne bloque pas la déconnexion locale.

## Étapes

1. Server `worker.ts` : désambiguïsation du handle dans `/auth/verify`.
2. Server `worker.ts` : route `DELETE /session` (après le gate `profileId`).
3. Server `worker.ts` : CORS `Allow-Methods += DELETE`.
4. Client `net.ts` : `logout()` appelle `DELETE /session` (best-effort, async).
5. Doc 15 : note NET-SEC.1 (handle + révocation) ; reste NET-SEC différé
   (rate-limit, quotas, purge des sessions expirées).
6. Vérifs : typecheck (server + client), lint. (Pas de harness Worker ⇒ typecheck ;
   smoke non-régressé, SDK inerte hors `VITE_BACKEND_URL`.)

## Journal

- Branche `claude/net-sec-1` créée depuis main (7632c33).
- **Livré.** Worker : désambiguïsation du handle (`/auth/verify`, suffixe uuid sur
  collision UNIQUE) ; route `DELETE /session` (révoque le bearer courant) ; CORS
  `+DELETE`. SDK : `logout()` appelle `DELETE /session` (best-effort, capture
  synchrone du bearer avant purge locale). Docs 15 §5.1 + backlog. Reste NET-SEC
  différé (rate-limit, quotas, purge sessions expirées).
- Vérifs : typecheck 5/5 (server + client), lint, garde-fous faction+couleurs
  verts, build, bundle ~296 Ko gzip < 800, smoke (en cours ; non-régression, SDK
  inerte hors `VITE_BACKEND_URL`) — 172 passed.
