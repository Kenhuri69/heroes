# Plan — Lot 7.4 : automatisation du déploiement backend (mise en ligne)

L'utilisateur veut « le faire ». L'MCP Cloudflare ne déploie pas de Worker et
aucun token CF n'est dans l'environnement → le déploiement passe par **GitHub
Actions** (le token vit en **secret GitHub**, jamais dans le chat ni mon
environnement). Je code toute la tuyauterie ; l'utilisateur n'a que 2-3 réglages
GitHub à faire.

## Portée (CI/config + docs — zéro code applicatif)

- `.github/workflows/deploy-worker.yml` : déploie `server/` via
  `cloudflare/wrangler-action@v3` sur `workflow_dispatch` (manuel) et push `main`
  touchant `server/**`. Secrets : `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- `.github/workflows/deploy.yml` (Pages) : le client déployé est **rebuild avec**
  `VITE_BACKEND_URL` (variable de dépôt) **après** le smoke — le smoke tourne sur
  le build HORS-LIGNE (le test « bouton En ligne absent » reste vert), seul
  l'artefact publié embarque l'URL du backend. Variable absente ⇒ client
  hors-ligne (défaut sûr).
- `docs/15-backend-infra.md` §10 : runbook de mise en ligne (secrets + variable +
  lancement des workflows), option Resend.

## Étapes MANUELLES de l'utilisateur (documentées)

1. Créer un token Cloudflare (template « Edit Cloudflare Workers ») → secret GitHub
   `CLOUDFLARE_API_TOKEN` ; + secret `CLOUDFLARE_ACCOUNT_ID`.
2. Lancer le workflow **Deploy Worker** (Actions → Run workflow) → l'URL du Worker
   (`https://heroes.<sous-domaine>.workers.dev`) dans les logs.
3. Définir la **variable** de dépôt `VITE_BACKEND_URL` = cette URL.
4. Relancer **Deploy to GitHub Pages** → le bouton « En ligne » apparaît.
5. Option : token Resend pour de vrais e-mails.

## Vérification

- YAML des workflows cohérent ; typecheck/tests/build/smoke **inchangés**
  (offline). Vérif manuelle locale : `VITE_BACKEND_URL=… pnpm build` injecte bien
  l'URL (le bundle la contient) — le gate bascule.
- Je ne peux PAS exécuter GitHub Actions ni déployer (pas de token) : la mise en
  ligne effective reste tributaire des secrets que l'utilisateur pose.

## Vérification

- [x] Build en ligne local : `VITE_BACKEND_URL=… pnpm build` **injecte** l'URL dans
  le bundle (gate → online) ; build hors-ligne : URL **absente** (gate → offline).
- [x] typecheck 4/4 · moteur golden inchangé · content · guards · smoke (offline)
  inchangés (7.4 = CI/config + docs, aucun code applicatif).
- [ ] Exécution GitHub Actions / déploiement réel : **impossible sans token**
  (posé par l'utilisateur en secret GitHub).

## Décisions / écarts

- **Token en secret GitHub** (jamais dans le chat/mon environnement) : le plus sûr,
  redéployable. L'MCP Cloudflare ne déploie pas de Worker → `wrangler-action` en CI.
- **Séparation smoke/artefact** dans `deploy.yml` : le smoke tourne sur le build
  HORS-LIGNE (test « bouton En ligne absent » vert), puis un **rebuild avec
  `VITE_BACKEND_URL`** produit l'artefact publié. `net.ts`/`OnlinePanel` sont dans
  les deux builds (même poids) ; seule la chaîne d'URL diffère.
- **Défaut sûr** : variable `VITE_BACKEND_URL` absente ⇒ chaîne vide ⇒ client
  hors-ligne (le bouton « En ligne » n'apparaît pas). Rien ne casse tant que
  l'utilisateur n'a pas posé la variable.
