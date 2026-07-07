# Plan — Lot 7.3 : client `@heroes/net` (derrière un flag de config)

Dernier increment du backend. Le client parle au Worker (7.2) via un **SDK mince**,
**entièrement conditionné par un flag** : `import.meta.env.VITE_BACKEND_URL`.
Sans cette variable (cas du smoke et du build actuel), le SDK est **inerte** et
**aucune UI en ligne** n'apparaît → jeu hors-ligne et smoke **strictement
inchangés** (jamais de réseau dans le smoke). Zéro diff moteur.

## Portée

- `packages/client/src/app/net.ts` — SDK typé : `isOnline()`/`isLoggedIn()`,
  auth (`requestMagicLink`/`verifyMagicLink`/`logout`), cloud saves
  (`putSave`/`getSave`), parties (`listMatches`/`createMatch`/`joinMatch`),
  tours (`getMoves`/`postMove`). Lit `VITE_BACKEND_URL` ; session en localStorage
  (bearer). Toute fonction lève « hors-ligne » si l'URL est absente.
- Typage Vite : `ImportMetaEnv.VITE_BACKEND_URL?`.
- `ui/OnlinePanel.tsx` — panneau minimal **AUTH** (e-mail → magic-link → le lien de
  vérification renvoyé est affiché ; coller le token → connecté ; déconnexion).
- `ui/MenuScreen.tsx` — bouton **« En ligne »** rendu **seulement si `isOnline()`**,
  ouvrant le panneau. Les écrans PvP complets (créer/rejoindre/jouer une partie
  async) = suite ; le SDK les expose déjà.
- `server/src/worker.ts` — ajoute `GET /matches` (parties ouvertes + les miennes)
  pour compléter le SDK.
- Locales fr/en (`menu.online`, `online.*`).
- Smoke : au menu (build sans `VITE_BACKEND_URL`), le bouton **« En ligne » est
  ABSENT** → le flag fonctionne, non-régression prouvée.

## Vérification

typecheck 4/4 + server · moteur (golden inchangé) · content · `content:check` ·
garde-fous faction/couleurs · build < 800 Ko · smoke desktop + mobile.

## Manuel (utilisateur, après ce lot)

`wrangler deploy` (identifiants CF) ; définir `VITE_BACKEND_URL` pour le client
déployé ; option : clé Resend pour l'envoi réel des e-mails magic-link.

## Vérification 7.3

- [x] typecheck 4/4 + server
- [x] moteur 326 (golden inchangé) · content 82 · `content:check`
- [x] lint · garde-fous faction/couleurs propres
- [x] build client (257 Ko gzip < 800 Ko)
- [x] smoke desktop + mobile : bouton « En ligne » ABSENT sans `VITE_BACKEND_URL`

## Décisions / écarts

- **Tout est gaté par `VITE_BACKEND_URL`** : `isOnline()` false par défaut → ni
  bouton « En ligne », ni appel réseau. Le build de smoke n'a pas la variable ⇒
  non-régression stricte, le SDK reste inerte.
- **UI 7.3 = auth seulement** (login magic-link / logout) — socle vérifiable ; les
  écrans PvP complets (créer/rejoindre/jouer une partie async par polling) sont un
  suivi, mais le SDK les expose déjà (`createMatch`/`joinMatch`/`getMoves`/
  `postMove`/`listMatches`).
- **E-mail non branché** : `/auth/request` renvoie le `verifyLink`, affiché dans le
  panneau (dev/beta) — prêt pour un provider (Resend) au déploiement.
- `GET /matches` ajouté au Worker pour compléter le SDK (parties ouvertes + les
  miennes).

## Backend CODE-COMPLET

7.1 (fondation `engine/net` + D1) + 7.2 (Worker) + 7.3 (client) = plomberie
complète. **Étapes manuelles restantes (utilisateur)** : `wrangler deploy`
(identifiants CF) ; `VITE_BACKEND_URL` du client déployé ; option clé Resend pour
les e-mails magic-link réels.
