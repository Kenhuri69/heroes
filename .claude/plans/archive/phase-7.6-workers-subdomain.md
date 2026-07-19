# Plan — Lot 7.6 : enregistrement automatisé du sous-domaine workers.dev

## Symptôme

Après le correctif 7.5, `wrangler deploy` **téléverse** bien le Worker
(`Uploaded heroes`, bindings D1 `heroes` + `APP_ORIGIN` reconnus) mais échoue à
la publication :

```
You need to register a workers.dev subdomain before publishing to workers.dev
ERROR: ... or register a workers.dev subdomain here: .../workers/onboarding
```

## Cause

Le compte Cloudflare n'a **jamais enregistré de sous-domaine workers.dev**
(réglage de compte, une fois). Sans lui, aucun Worker n'obtient d'URL publique
`*.workers.dev`. Ce n'est pas un bug de code — c'est de l'onboarding de compte.

## Correctif (CI/config — zéro code applicatif)

L'utilisateur veut l'automatiser « avec le token Cloudflare ». Le token ne peut
pas être manipulé depuis l'environnement de l'agent (garde de sécurité) ; il vit
en secret GitHub. Donc l'enregistrement se fait **en CI** :

- `.github/workflows/deploy-worker.yml` :
  - `workflow_dispatch.inputs.subdomain` (optionnel) ;
  - étape gardée `if: workflow_dispatch && inputs.subdomain != ''` qui, via l'API
    Cloudflare (`GET`/`PUT /accounts/{id}/workers/subdomain`, auth = token secret),
    enregistre le sous-domaine s'il n'existe pas encore (idempotent), puis
    `wrangler deploy` publie sur `heroes.<sous-domaine>.workers.dev`.
- `docs/15 §10` : étape 3 enrichie (champ `subdomain`).

## Vérification

- [x] YAML valide, input `subdomain` présent.
- [ ] Dispatch **Deploy Worker** avec `subdomain=<nom>` → étape d'enregistrement
  `success: True`, puis `wrangler deploy` publie et logge l'URL. Récupérer l'URL
  et la donner à l'utilisateur (→ variable `VITE_BACKEND_URL`).
- Dépend du token secret (déjà posé) et d'un nom de sous-domaine libre
  globalement (sinon l'API renvoie une erreur → réessayer avec un autre nom).

## Décisions

- Enregistrement **en CI** (token en secret), pas depuis l'agent : cohérent avec
  7.4/7.5, aucun secret exposé. Étape **manuelle-seulement** (`workflow_dispatch`)
  et **gardée** par un input non vide ⇒ les déploiements auto (push) n'y touchent
  pas. Idempotente (GET avant PUT) ⇒ rejouable sans risque.
