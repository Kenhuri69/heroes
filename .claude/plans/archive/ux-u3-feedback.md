# Plan — U3 : Feedback positif + journal d'événements (doc 08 §3)

> Lot U3 du chantier UX (plan de remédiation §5.3, étape 4). Le **feedback
> positif** existe déjà en grande partie (`ui/toasts.tsx` → `toastMessage` mappe
> ramassage/semaine/revenu/croissance/construction/recrutement/niveau/sort/
> compétence…). Manques réels :
> 1. **Journal consultable** (doc 08 §3 : « file de toasts … consultable dans un
>    journal ») — aujourd'hui les toasts disparaissent en 4 s, aucune trace ;
>    le code le note lui-même (« le journal consultable reste MVP, écart assumé »).
> 2. **Feedback de sauvegarde MANUELLE réussie** — le bouton Sauvegarder n'a
>    aucun retour positif (mineur R7c « Sauvegarder/Charger sans feedback »).
> 3. **Bruit IA** — `toastMessage` notifie aussi les actions des joueurs IA
>    (revenus/recrutements pendant `runAiLoop`) → toasts + journal pollués.

## 1. Objectif & critères de succès

- **Journal** persistant, daté (jour de jeu), consultable : liste des
  notifications de jeu, la plus récente en tête, dans une **modale du routeur**
  (`{ kind: 'journal' }`, acquis U2), ouverte par un bouton HUD (cloche) avec
  **badge de non-lus**.
- **Notifications filtrées au joueur humain** : plus de toast/journal pour les
  actions IA (résolution d'appartenance via l'état). Source unique réutilisée
  (`notify` remplace `toastMessage`) → toasts ET journal cohérents (DRY).
- **Toast de sauvegarde manuelle réussie** (`toast.saved`).
- Invariants : moteur pur intact (aucun changement moteur), budget bundle,
  golden stable, cibles ≥ 44 px.

Vérif : typecheck 4/4 + lint + test + content:check + build + smoke (journal
s'ouvre, enregistre un événement, badge non-lus ; toast de sauvegarde) ;
ux-audit A4 (pile de modales ≤ 2 : journal = 1 niveau).

## 2. Décision de design (pas de fork utilisateur)

Direction fixée par doc 08 §3. Choix d'implémentation :
- **Réutiliser le mapping de notification existant** (`toastMessage`) comme
  source unique, déplacé dans `app/notifications.ts` sous le nom `notify(event,
  game)` : toasts et journal partagent la même vérité (DRY).
- **Journal = historique des notifications de JEU** (événements moteur), PAS des
  toasts d'erreur UI (validation de commande) : le journal s'abonne au flux
  d'événements, pas à `pushToast`. Doc 08 §3 (« croissance hebdo, revenus,
  événements »).
- **Filtre humain** : chaque événement ownable (ville→propriétaire, héros→
  joueur, `playerId`) n'est notifié que s'il appartient au joueur humain ;
  les événements globaux (semaine, fin de combat/partie) restent affichés.
- **Journal en pile de modales** (U2) : plafond 2 respecté (journal seul).

## 3. Contrat figé (pilote)

- `store.ts` : `interface JournalEntry { id: number; day: number; message:
  string }` ; champs `journal: JournalEntry[]` (plafond `MAX_JOURNAL = 100`),
  `journalUnread: number`.
- `router.ts` : `Modal` += `{ kind: 'journal' }`.
- `app/notifications.ts` (NEW, pilote) : `notify(event: AppEvent, game:
  GameState): string | null` (port de `toastMessage` + filtre humain +
  `TownCaptured`) ; `appendJournal(message: string): void` (setState : push
  `{ id, day: game.calendar.day, message }`, tronque à `MAX_JOURNAL`, incrémente
  `journalUnread` sauf si la modale journal est ouverte).
- **Clés i18n figées** (créées par S-i18n, consommées par S-UI/notifications) :
  `toast.saved`, `toast.townCaptured`, `journal.title`, `journal.empty`,
  `journal.open` (aria cloche), `journal.close`, `journal.entryDay` ({day}).

## 4. Découpage (fan-out Sonnet, fichiers disjoints)

- **Pilote** : `store.ts`, `router.ts`, `app/notifications.ts` (contrat + logique
  de filtrage — le cœur). Retire `toastMessage` de `toasts.tsx` (déplacé).
- **S-UI (Sonnet)** : `ui/toasts.tsx` (abonnement → `notify` + `pushToast` +
  `appendJournal`), `ui/Journal.tsx` (+`Journal.css`, modale liste inversée,
  reset non-lus à l'ouverture), `ui/shell.tsx` (bouton cloche HUD + badge
  non-lus + rendu Journal via la pile ; toast de sauvegarde manuelle réussie).
- **S-i18n (Sonnet)** : `data/core/locales/{fr,en}.json` (7 clés ci-dessus).
- **Pilote (après intégration)** : smoke (journal + save toast), `docs/08-ui-ux.md`
  §3 (journal implémenté).

## 5. Journal
- **2026-07-05** — Création. Contrat figé. Feedback positif déjà présent ; U3 =
  journal consultable + save toast + filtre humain. Fan-out à lancer.
- **2026-07-05** — **U3 livré.** Pilote : `store` (JournalEntry + champs
  journal/journalUnread), `router` (Modal += journal), `app/notifications.ts`
  (`notify` filtré humain, port de `toastMessage` + `TownCaptured` ;
  `appendJournal` daté + non-lus). Fan-out Sonnet parallèle : S-UI
  (`toasts.tsx` → `notify`+`appendJournal` ; `Journal.tsx`/`.css` modale ;
  `shell.tsx` cloche HUD + badge + toast de sauvegarde réussie) et S-i18n
  (7 clés fr/en). doc 08 §3 mise à jour. Smoke +1 (`journal & feedback`,
  desktop + mobile) : ramassage humain ⇒ badge + entrée, ouverture ⇒ reset
  non-lus, toast « Partie sauvegardée ». Vérif verte : typecheck 4/4, eslint,
  content:check, build (~227 Ko gzip), **50 smoke**. Aucun code moteur touché →
  golden intact. **Reporté (mineur, documenté)** : agrégation des revenus
  quotidiens (multi-lignes/jour) ; combats IA-vs-neutres encore notifiés
  (même limite que R7c `playerSide`). **Prochain : U4 / U6.**
