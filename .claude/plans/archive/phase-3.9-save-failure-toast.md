# Plan — Phase 3.9 : Durcissement — surfacer les échecs de sauvegarde

Suite du durcissement post-MVP. Angle mort : un échec de stockage (IndexedDB
indisponible en navigation privée, quota dépassé…) est **silencieux** —
`autosave.ts` ne fait qu'un `console.warn`, et la sauvegarde manuelle
(`shell.tsx`) est fire-and-forget sans `catch`. Le joueur croit sa partie
sauvée alors qu'elle ne l'est pas : **perte de données silencieuse**, le pire
mode d'échec.

## Objectif

Rendre l'échec **visible** : un toast d'erreur i18n quand une sauvegarde
(auto ou manuelle) échoue. La partie continue (l'autosave reste
fire-and-forget, doc 07 §4) — on informe, on n'interrompt pas.

## Étapes

- [x] 1-4 livrés : `SaveFailed` dans `AppEvent`, émis par `autosave.ts` +
  bouton Sauvegarder de `shell.tsx`, `case 'SaveFailed'` du toast, clés
  `toast.saveFailed` fr/en, smoke du chemin d'échec (`indexedDB.open` stubé) —
  40 smoke verts (+2). Golden inchangé.

1. **Événement app `SaveFailed`** (`app/events.ts`) : ajout à l'union
   `AppEvent` (signal applicatif, comme `GameLoaded`).
2. **Émission** aux deux points de sauvegarde : `autosave.ts` (catch existant)
   et le bouton Sauvegarder de `shell.tsx` (ajout d'un `.catch`). `save.ts`
   (couche basse) reste inchangé — l'émission vit chez les appelants.
3. **Toast** (`ui/toasts.tsx`) : `case 'SaveFailed'` → `t('toast.saveFailed')`.
   Clés `toast.saveFailed` dans `data/core/locales/{fr,en}.json`.
4. **Smoke** : forcer un échec en remplaçant `indexedDB.open` par un throw
   avant de cliquer Sauvegarder → un toast d'erreur apparaît.

## Vérification

typecheck, lint, garde-fou, tests moteur+contenu (inchangés), content:check,
smoke desktop+mobile (+ chemin d'échec), budget bundle. Golden inchangé
(aucune modif moteur).

## Écarts

- Pas de retry ni de file d'attente de sauvegarde : on notifie l'échec, MVP.
- Pas de toast de succès sur save manuel (hors périmètre : on cible la perte
  silencieuse, pas le confort).
