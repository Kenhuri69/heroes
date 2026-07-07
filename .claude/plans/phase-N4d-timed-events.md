# Plan — Lot N4d : événements temporaires datés (doc 13 §4.3)

Dernier increment de **N4** (et du polish narratif doc 13, N1→N4). Un **événement
= un scénario + une fenêtre de dates**. Vérifié **à l'ouverture du menu** via
l'horloge **client** (le déterminisme de la simulation n'est jamais daté — le
moteur ne touche JAMAIS l'horloge). Un événement expiré reste **rejouable en
archive** (sans récompenses cosmétiques — no-op ici, pas de système cosmétique).
**Zéro diff moteur** : `availability` est un champ de présentation, dépouillé
comme `dialogs`/`combatBarks` avant tout embarquement moteur.

## Portée

- **Contenu** : le scénario gagne `availability?: { from, to }` (dates ISO
  `YYYY-MM-DD`). Optionnel — seuls les scénarios d'événement l'ont.
- **Client** :
  - `app/events.ts`… (déjà pris) → helper `eventStatus(availability, now)` dans
    un module dédié `app/timed-events.ts` : `'active' | 'archived' | 'upcoming'`.
  - `ui/MenuScreen.tsx` : section « Événements » — actifs (badge « Événement »)
    et archivés (badge « Archive », toujours jouables) ; les événements **à
    venir** (avant `from`) sont masqués. `now = Date.now()` (client, présentation).
- **Données** : 2 scénarios d'événement — `event-revenants` (La Semaine des
  Revenants, fenêtre **large** → actif) et `event-curee` (La Grande Curée,
  fenêtre **passée** → archive). Fenêtres choisies pour un smoke **stable dans le
  temps** (actif : 2024→2099 ; archive : 2020). Locales fr/en.
- **Smoke** : au menu, l'événement actif apparaît avec le badge « Événement » et
  démarre ; l'événement passé apparaît avec le badge « Archive » et démarre aussi.

## Vérification par lot

typecheck 4/4 · moteur (golden **inchangé**) · content + `content:check` ·
garde-fou faction + garde-fou couleurs · build < 800 Ko · smoke desktop + mobile.

## Vérification par lot

- [x] typecheck 4/4
- [x] moteur 321 (golden **inchangé** — `availability` = présentation client)
- [x] content 77 + `content:check` (12 scénarios, dont 2 événements)
- [x] garde-fou faction + garde-fou couleurs (grep local : propres)
- [x] lint · build client (254 Ko gzip < 800 Ko)
- [x] smoke desktop + mobile (badge « Événement »/« Archive », archive jouable)

## Décisions / écarts

- **Horloge côté CLIENT uniquement** : `eventStatus` lit `Date.now()` dans le
  client (présentation) ; le moteur ne voit jamais de date (déterminisme intact,
  invariant §8.2 respecté — `Date` interdit dans `packages/engine`, autorisé côté
  client).
- **Smoke stable dans le temps** : plutôt qu'injecter une horloge, les 2
  événements ont des fenêtres fixes — `event-revenants` (2024→2099 → **actif** ~75
  ans) et `event-curee` (2020 → **archive**). Le smoke vérifie les deux badges
  sans dépendre de la date d'exécution.
- **Archive jouable** : un événement expiré reste dans la liste (badge « Archive »)
  et démarre normalement ; « sans récompenses cosmétiques » est un no-op (pas de
  système cosmétique au MVP). Les événements **à venir** (avant `from`) sont
  masqués.
- Champs `availability` dépouillés du chemin moteur comme `dialogs`/`combatBarks`
  (le `StartGame` ne reçoit que joueurs/objectifs).

## Clôture

**N4d clôt N4** et, avec lui, **tout le plan de polish narratif doc 13 (N1→N4)** :
N1 voix du monde, N2 systèmes (quêtes + prologue), N3 campagnes fondatrices
(Haven/Necropolis + finitions), N4 chasse & vivant (campagne Arcane Hunters,
barks, journalières, événements datés). Zéro nom de faction dans `packages/`,
golden inchangé de bout en bout, budget et i18n tenus.
