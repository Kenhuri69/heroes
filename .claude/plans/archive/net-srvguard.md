# Lot NET-SRVGUARD — Garde de version des sauvegardes côté serveur

> Backlog `.claude/plans/game-feature-gaps.md` §2.7 NET-SRVGUARD.
> Doc source : `docs/15-backend-infra.md` §5.2 (« un save d'une autre version est
> rejeté proprement »), `docs/07-architecture.md` §4 (« le plus récent gagne + copie
> de sécurité »).

## But

Faire respecter côté **serveur** (Worker) la garde de version des cloud saves :
un `PUT /saves/:slot` dont le `save_version` est **antérieur** à celui déjà stocké
pour ce slot est **rejeté** (409) — un client d'une version obsolète ne peut plus
écraser une sauvegarde plus récente. Aujourd'hui `PUT /saves` accepte tout
`save_version` et upsert sans garde.

## Décisions de conception (« au plus proche du doc »)

- **Anti-downgrade monotone** : rejet si `incoming.save_version < stocké`. Même
  version (autosave normal) ou version **supérieure** (client mis à niveau) ⇒
  upsert. Le serveur reste **version-agnostique** (pas de constante `CURRENT_SAVE_VERSION`
  dupliquée, pas de couplage au moteur ni de fragilité à chaque bump) — il n'impose
  que la monotonie (« le plus récent gagne », doc 07 §4). La garde de version
  EXACTE côté client (3.8) reste la source de vérité de la forme.
- **Réponse** : `409` + message clair (« version de sauvegarde obsolète »).
- **Copie de sécurité N-1** (doc 07 §4) : **différée** (NET-SRVGUARD.2) — nécessite
  une évolution de schéma D1 (table `save_backups` / colonnes `prev_*`) et sa
  migration sur la base live ; hors périmètre de ce lot self-contained/deploy-safe.

## Étapes

1. Server `worker.ts` : dans `PUT /saves/:slot`, lire le `save_version` stocké ;
   rejeter 409 si `incoming < stocké` ; sinon upsert (inchangé).
2. Client `net.ts` : `putSave` propage l'erreur (déjà via `api` qui `throw` sur
   !ok) — documenter le code 409 dans le SDK.
3. Doc 15 §5.2 : note « garde serveur livrée (anti-downgrade) ; copie N-1 différée ».
4. Vérifs : typecheck (server + client), lint. (Pas de harness Worker ⇒ vérifié
   par typecheck ; smoke non-régressé, SDK inerte hors `VITE_BACKEND_URL`.)

## Journal

- Branche `claude/net-srvguard` créée depuis main (006b090).
- **Livré.** Worker `PUT /saves/:slot` : lit le `save_version` stocké, rejette
  409 si `incoming < stocké` (anti-downgrade), sinon upsert. SDK `putSave`
  documente le 409. Doc 15 §5.2 + backlog. Backup N-1 différé (NET-SRVGUARD.2).
- Vérifs : typecheck 5/5 (server + client), lint, garde-fous faction+couleurs
  verts, build, bundle ~296 Ko gzip < 800, smoke (en cours ; non-régression, SDK
  inerte hors `VITE_BACKEND_URL`) — 172 passed. Pas de harness Worker ⇒ intégration à NET-PVPUI.
