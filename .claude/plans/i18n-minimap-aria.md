# Plan — trou i18n : aria-label de la mini-carte

> Dernier « loose end » nommé du projet (invariant README/guidelines §8 : « 0
> chaîne en dur, parité FR/EN »). Noté dans `ux-minimap-mobile.md` :
> « `MiniMap` aria-label encore en dur FR (`Mini-carte (N héros)`), hérité
> d'UXD-8 — hole i18n pré-existant, à traiter dans une passe i18n dédiée ».

## Constat

- `MiniMap.tsx:104` : `aria-label={\`Mini-carte (${heroCount} héros)\`}` — chaîne
  FR en dur, cassant la parité pour un lecteur d'écran en anglais.
- Le composant n'importe pas `t` et ne s'abonne pas à `s.locale`.

## Étapes

- [x] Locales : clé `hero.minimapAria` (FR/EN) avec `{count}`.
- [x] `MiniMap.tsx` : importer `t`, s'abonner à `s.locale` (réactivité i18n),
      remplacer la chaîne par `t('hero.minimapAria', { count: heroCount })`.
- [x] Smoke : `mini-map-drawer` porte un `aria-label` localisé
      (`/^Mini-carte \(\d+ héros\)$/` en FR) — desktop + mobile.
- [x] Plan `ux-minimap-mobile.md` : suivi levé.
- [x] Vérif : typecheck ✅, lint ✅, content:check (parité FR/EN) ✅, garde-fou
      couleurs (aucun .css touché) ✅, build ~278 Ko gzip ✅, **smoke 134 passed /
      2 skipped** ✅.
- [ ] Commit + push + PR draft.

## Invariants

- Client only, zéro moteur, zéro faction. Aucun impact bundle/save/golden.

## Journal
- **2026-07-09** — Cadrage : seul trou i18n restant (scan `aria/title/placeholder`
  accentués = 0 autre). Fix bordé.
