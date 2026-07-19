# Lot — NET-PVPUI (slice C) : polling « c'est ton tour » + fin par statut serveur

> Direction « go C ». Finition du PvP async : plus de « Rafraîchir » manuel, et
> détection de l'abandon/fin côté serveur. Client only, plus petit que la slice B.

## Périmètre (client only, ZÉRO moteur/serveur/donnée)

1. `app/store.ts` : `onlineMatch` gagne `status: string` (statut serveur du match).
2. `app/online-match.ts` :
   - `openOnlineMatch` : stocke aussi `status = detail.status`.
   - `pollOnlineMatch()` : `getMatch(id)` ; si `d.seq >= nextSeq` (l'adversaire a
     joué) ⇒ `refreshOnlineMatch()` (rebuild, l'overlay se lève seul quand c'est
     mon tour) ; sinon si `d.status` a changé ⇒ le refléter dans le store. Erreurs
     réseau avalées (retry au tick suivant).
3. `ui/OnlineWaitOverlay.tsx` :
   - `useEffect` : quand l'overlay est monté (donc en attente) et la partie non
     finie, `setInterval(pollOnlineMatch, POLL_MS)` — coupé si `document.hidden`.
     Nettoyé au démontage (mon tour) ⇒ polling scoppé à l'état d'attente.
   - Fin de partie : `over = game.outcome || status ∈ {finished, abandoned}` ;
     message dédié si l'adversaire a **abandonné**.
   - Hooks appelés inconditionnellement (règles des hooks) : réordonner avant les
     `return null`.
4. i18n core fr/en (`online.wait.abandoned*`).

## Vérification

- typecheck, lint, garde-fous, content:check, build, bundle, smoke @core
  (**régression** hors-ligne : overlay jamais monté sans backend ⇒ pas de polling).
- ⚠️ Chemin en ligne non couvert par le smoke (pas de backend en CI) — franchise §7.

## Garde-fous

- Polling **scoppé au montage de l'overlay** (attente) + coupé `document.hidden`
  ⇒ aucun sondage en partie locale ni écran caché.
- `pollOnlineMatch` no-op hors match. Zéro moteur/serveur ⇒ pas de bump save,
  golden inchangé, garde-fous non concernés.
- Intervalle raisonnable (~12 s) : jeu tour-par-tour asynchrone, pas de temps réel.

## Statut : LIVRÉ (slice C) — NET-PVPUI complet (A+B+C)

Pipeline vert : typecheck (server+client), lint, garde-fous faction/couleurs
(status 1), content:check, build, bundle 324 240 o < 819 200, smoke @core 22/22
(régression hors-ligne : overlay jamais monté ⇒ pas de polling). Zéro moteur/
serveur, pas de bump save, golden inchangé.
