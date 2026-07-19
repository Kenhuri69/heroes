# E15 (reliquat) — Bascule plein écran

Dernier reliquat du constat **E15** du plan `game-ergonomics-immersion-review.md`
(« … Pas de bascule plein écran non plus »). La découvrabilité des raccourcis
(bouton « Voir les raccourcis ») était déjà livrée ; il manquait le **plein
écran**. Client seul, zéro moteur, pas de bump save, golden inchangé.

## Changement

- **`app/fullscreen.ts`** (nouveau) : helpers purs et gardés
  (`fullscreenSupported()`, `isFullscreen()`, `toggleFullscreen()`) autour de la
  Fullscreen API (`requestFullscreen`/`exitFullscreen`), tous no-op si l'API
  est absente (mobile Safari) ou hors DOM (tests node).
- **`OptionsPanel.tsx`** : dans la section raccourcis, un bouton **plein écran**
  (`aria-pressed`, libellé Entrer/Quitter selon l'état, synchronisé sur
  l'événement `fullscreenchange`). Affiché **uniquement si l'API est supportée**.
- Locales FR/EN `options.fullscreenEnter` / `options.fullscreenExit`.
- Réutilise la classe `.options-shortcuts-button` (aucun nouveau CSS ⇒ aucun
  risque garde-fou couleurs).

## Vérification

- [ ] typecheck / lint verts
- [ ] client + content vitest verts (+ `fullscreen.test.ts` : gardes en env node)
- [ ] build + budget bundle ≤ 800 Ko gzip
- [ ] garde-fous faction / couleurs verts
- [ ] smoke @core desktop + mobile
- [ ] golden inchangé (aucun fichier moteur touché)

## Note

Clôt **E15**. Bascule purement présentation (Fullscreen API navigateur), aucune
persistance (le plein écran est un état du navigateur, pas une préférence de
jeu).
