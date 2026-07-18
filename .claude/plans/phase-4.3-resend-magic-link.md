# Lot 4.3 — E-mails magic-link réels via Resend (doc 18 Étape 4, E6, taille S)

## Contexte

`POST /auth/request` du worker (`server/src/worker.ts`) crée un `auth_tokens` et
**renvoie le lien** de vérification dans le corps JSON (`verifyLink`) — pratique
dev/beta mais **fuite** : quiconque demande un lien pour un e-mail le reçoit
directement, sans posséder la boîte. Doc 15 §10 point 6 prévoit de brancher
**Resend** (free tier) pour envoyer réellement l'e-mail. Aucune infra de test
worker n'existe (pas de runner de test côté `server/`).

## Décisions de design

- **Opt-in par secret** : si `env.RESEND_API_KEY` est défini ⇒ le worker envoie
  l'e-mail via l'API Resend et **ne renvoie plus le lien** (`{ ok: true, emailed: true }`).
  Secret absent ⇒ comportement **inchangé** (`{ ok: true, verifyLink }`) pour
  dev/beta. Défaut sûr, zéro régression sans config.
- Expéditeur configurable via `env.AUTH_EMAIL_FROM` (repli `Heroes <onboarding@resend.dev>`
  — domaine de test Resend, fonctionne sans vérification de domaine).
- Échec d'envoi Resend ⇒ `502` (ne PAS retomber sur le renvoi du lien : ce serait
  ré-ouvrir la fuite). Le client affiche l'erreur.
- Client : `verifyLink` devient optionnel ; message « e-mail envoyé » (`online.emailSent`,
  FR/EN) quand `emailed`.

## Étapes

1. **Worker** (`server/src/worker.ts`) → verify: `pnpm --filter @heroes/server typecheck`
   - Env : `RESEND_API_KEY?`, `AUTH_EMAIL_FROM?`.
   - Helper `sendMagicLinkEmail(env, to, link)` (fetch Resend, throw HttpError 502 sur échec).
   - Branche opt-in dans `/auth/request`.
2. **Client** (`net.ts` type, `OnlinePanel.tsx` message) + locales FR/EN → verify: typecheck + lint.
3. **Docs** : doc 15 §10 pt 6 (runbook complet) + §5.1 (mention envoi réel). doc 18
   Étape 4 : cocher 4.3.
4. **Vérif** : typecheck -r, lint, test, content:check, garde-fou faction, build, budget, smoke @core.

## Limite de couverture (assumée, taille S)

Le chemin d'envoi Resend n'est **pas** couvert par un test automatisé : `server/`
n'a pas de runner de test (aucun n'existe dans le repo pour le worker) et l'appel
est un `fetch` réseau externe. La logique ajoutée est un branchement conditionnel
+ construction de payload, validée par typecheck. Le smoke tourne sur un build
client **hors-ligne** (pas de backend) ⇒ ne touche pas ce code. Signalé à l'utilisateur.

## Statut

- [x] 1 worker — Env + `sendMagicLinkEmail` + branche opt-in
- [x] 2 client + locales — net.ts type, OnlinePanel message `online.emailSent` FR/EN
- [x] 3 docs — doc 15 §5.1/§10 pt 6 runbook, doc 18 Étape 4 cochée
- [x] 4 vérif — typecheck ✓, lint ✓, 871 tests moteur ✓, content:check ✓, garde-fou
      faction vert, build ✓, budget 330 Ko < 800 ✓, smoke @core 19/19 ✓
