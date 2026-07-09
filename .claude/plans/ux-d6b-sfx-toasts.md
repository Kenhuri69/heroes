# Plan — UXD-6b : SFX de toasts (ui-confirm / ui-error)

> Suivi restant du lot UXD-6 (`.claude/plans/ux-d6-audio.md` §Reste, plan maître
> `ux-design-overhaul.md` §6) : les sons **ui-confirm** / **ui-error** étaient
> différés car « ils demandent un typage des toasts ». Ce lot type les toasts
> (info / succès / erreur) et branche le SFX correspondant à l'affichage.

## Constat de départ

- `pushToast(message)` (non typé) → `{ id, message }`. Appelé directement pour
  les **erreurs** (`commandErrorMessage(err)`, échecs new-game/scénario/skirmish)
  et un **succès** (`toast.saved`) ; et via `notify()` (event bus) pour les
  toasts événementiels.
- `app/audio.ts` : `playSfx('sfx/<id>')` (hors bundle, lazy, silence si absent).
  SFX déjà câblés : combat-hit/spell/death, end-turn, map-step/pickup, ui-tap.
  `ui-confirm`/`ui-error` **manquent** (fichiers + recette).
- `gen_sfx.py` : synthèse procédurale déterministe (stdlib + ffmpeg OGG/M4A).

## Conception

- **Typage minimal** : `ToastKind = 'info' | 'success' | 'error'` (défaut
  `info`). `pushToast(message, kind?)`. Le `kind` porte : (1) le **SFX**
  (`success → ui-confirm`, `error → ui-error`, `info → aucun`), joué depuis
  `pushToast` — couvre les toasts directs ET événementiels ; (2) un **accent
  visuel** discret (filet gauche coloré par kind). A5 respecté : l'info est
  portée par le **texte** du toast, la couleur n'est que décor.
- **Classement** : un helper `toastKind(event)` classe les toasts
  événementiels (succès = actions positives confirmées : construction,
  recrutement, capture, combat/partie gagnés, quête… ; erreur = `SaveFailed` ;
  le reste = info). Les appels directs passent leur kind explicitement.
- **SFX** : `ui-confirm` (ping bicorde montant, bref, positif) et `ui-error`
  (buzz grave descendant, bref) — recettes déterministes `gen_sfx.py`, OGG+M4A
  hors bundle (Règle F : < 60 Ko).

## Invariants (guidelines §8)

- **Moteur intact** (client + assets + données locales), zéro faction.
- Budget < 800 Ko gzip (audio hors bundle). i18n : aucun nouveau texte (messages
  déjà localisés). A5 : le son et la couleur **doublent** le texte, jamais seuls.
- Anti-gel : SFX one-shot jetables, aucun coût par-frame.

## Étapes

- [x] `gen_sfx.py` : recettes `ui-confirm` + `ui-error` ; générer les 4 fichiers
      (`assets/audio/sfx/ui-confirm.{ogg,m4a}`, `ui-error.{ogg,m4a}`). Seuls les
      2 nouveaux commités (les `.ogg` existants changent d'octets sans changer
      le son — restaurés).
- [x] Store (`app/store.ts`) : `ToastKind` + `toasts: {id,message,kind}[]`.
- [x] `ui/toasts.tsx` : `pushToast(message, kind='info')` → pose le kind, joue
      `ui-confirm`/`ui-error` selon kind ; rend `data-kind` + classe. Helper
      `toastKind(event)` ; ToastHost passe le kind.
- [x] Appelants directs : erreurs (`commandErrorMessage` ×12, `newGameFailed`,
      `scenarioFailed`, `skirmishFailed`) → `'error'` ; `toast.saved` +
      `questCompleted` → `'success'`.
- [x] `ui/toasts.css` : filet gauche par kind (tokens `--ok-text`/`--danger-text`).
- [x] Doc / plans : `ux-d6-audio.md` §6G (ui-confirm/error livrés) +
      `ux-design-overhaul.md` §6.
- [x] Smoke : le toast d'échec de sauvegarde porte `data-kind="error"`, la
      sauvegarde réussie `data-kind="success"` (desktop + mobile).
- [x] Vérif verte : typecheck ✅, lint ✅, moteur 401 (golden intact) ✅,
      content ✅, content:check ✅, garde-fou couleurs ✅, build ~278 Ko gzip ✅,
      **smoke 133 passed / 2 skipped** (1 flaky pré-existant `raccourci E`,
      vert 3/3 en isolement, rejoué 2× en CI).
- [ ] Commit + push + PR draft.

## Journal
- **2026-07-09** — Cadrage : audio.ts/toasts/notify/gen_sfx lus, ffmpeg installé
  dans l'env. `combat-shoot` reste hors périmètre (bloqué golden, champ `ranged`).
