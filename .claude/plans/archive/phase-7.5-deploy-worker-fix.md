# Plan — Lot 7.5 : correctif du déploiement du Worker (npm ↔ workspace:*)

## Symptôme

Le workflow **Deploy Worker** (7.4) échoue à l'étape « Deploy (wrangler) ».
Les secrets Cloudflare sont bien présents (l'étape de vérification passe). Erreur :

```
npm error code EUNSUPPORTEDPROTOCOL
npm error Unsupported URL Type "workspace:": workspace:*
```

## Cause

`cloudflare/wrangler-action@v3` installe wrangler avec **npm**. En s'exécutant
dans `server/`, npm lit `server/package.json` qui déclare
`"@heroes/engine": "workspace:*"` — protocole compris par **pnpm**, pas par npm →
l'install de wrangler avorte avant tout déploiement.

## Correctif (CI/config — zéro code applicatif)

- `server/package.json` : ajouter `wrangler` en `devDependencies` (installé par le
  `pnpm install --frozen-lockfile` déjà présent). Lockfile mis à jour.
- `.github/workflows/deploy-worker.yml` : remplacer l'étape `wrangler-action` par
  un appel direct **pnpm** :
  ```yaml
  - name: Deploy (wrangler via pnpm)
    working-directory: server
    run: pnpm exec wrangler deploy
    env:
      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  ```
  pnpm comprend `workspace:*` ; wrangler/esbuild embarque la source TS de
  `@heroes/engine` (export `./src/index.ts`) dans le bundle.
- `CLAUDE.md` : référence « wrangler via pnpm ».

## Vérification

- [x] `pnpm --filter @heroes/server exec wrangler deploy --dry-run` : bundle OK
  (166 KiB / 37,74 KiB gzip), bindings D1 `heroes` + `APP_ORIGIN` reconnus, aucun
  token requis. `workerd` (script d'install ignoré par pnpm) n'est PAS nécessaire
  au `deploy` (uniquement à `wrangler dev`), le dry-run le prouve.
- [x] YAML du workflow valide ; typecheck inchangé (server code inchangé).
- [ ] Déploiement réel : au merge sur `main` (push touchant `server/**` ⇒
  redéclenchement auto), ou re-run manuel. Tributaire des secrets (déjà posés).

## Décisions

- Abandon de `wrangler-action` au profit de `pnpm exec wrangler` : le monorepo est
  pnpm, l'action force npm — incompatible avec `workspace:*`. Plus simple, moins de
  magie, une seule chaîne d'outils.
