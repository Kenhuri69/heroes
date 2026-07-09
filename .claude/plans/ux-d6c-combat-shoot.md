# Plan — UXD-6c : SFX de tir `combat-shoot`

> Dernier item du lot audio UXD-6 (`ux-d6-audio.md` §Reste). Il était noté
> « bloqué : demande un champ `ranged` sur `StackAttacked` (impact golden
> replay) ». **Réévaluation** : le golden hache l'ÉTAT FINAL (`hashState`), pas
> les événements ; `StackAttacked` est transitoire (jamais sérialisé). Ajouter
> `ranged` à l'événement **n'impacte donc PAS le golden** — l'item n'était pas
> réellement bloqué.

## Constat

- `sfxForEvent` (`app/audio.ts`) joue `combat-hit` sur tout `StackAttacked` —
  aucune distinction tir/mêlée.
- `performStrike` (`combat/damage.ts`) reçoit déjà `params.ranged` (true pour un
  tir, false pour mêlée/riposte, décidé par `canShoot` dans `actions.ts`) mais
  ne le propage pas dans l'événement.
- Aucun test ne fige la forme complète de `StackAttacked` (`toEqual`) ⇒ ajout de
  champ sûr. `CombatScene.animateAttack` déstructure des champs précis ⇒ champ
  en plus ignoré.

## Étapes

- [x] `core/events.ts` : `ranged: boolean` sur `StackAttacked`.
- [x] `combat/damage.ts` : propager `ranged` dans l'événement émis.
- [x] `gen_sfx.py` : recette `combat-shoot` (swish + twang), OGG+M4A hors bundle
      (~5 Ko). Seul le nouveau fichier commité.
- [x] `app/audio.ts` : `StackAttacked` ⇒ `combat-shoot` si `event.ranged`,
      sinon `combat-hit`.
- [x] Tests moteur (`combat-damage.test.ts`) : le tir émet `ranged: true`, la
      mêlée forcée `ranged: false`.
- [x] Docs/plans : `ux-d6-audio.md` §6H + `ux-design-overhaul.md` §6 (UXD-6
      complet).
- [x] Vérif : typecheck ✅, lint ✅, tests moteur 401 (**golden inchangé** —
      confirme que l'événement n'entre pas dans l'état haché) ✅, content 96 ✅,
      content:check ✅, build ~278 Ko gzip ✅, **smoke 134 passed / 2 skipped** ✅.
- [ ] Commit + push + PR draft.

## Invariants

- **Moteur pur** : `ranged` reflète une règle déjà calculée (`canShoot`), aucun
  cas de faction. Champ d'événement (présentation/feedback), pas d'état ⇒ pas de
  bump save, **golden inchangé** (à confirmer par le test).
- Budget < 800 Ko gzip (SFX hors bundle). Anti-gel : one-shot jetable.

## Journal
- **2026-07-09** — Cadrage : golden = hash d'état, pas d'événements ⇒ item non
  bloqué. `ranged` déjà dispo dans `performStrike`.
