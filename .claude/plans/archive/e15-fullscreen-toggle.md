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

- [x] typecheck / lint verts
- [x] client + content vitest verts (+ `fullscreen.test.ts` : gardes en env node)
- [x] build + budget bundle ≤ 800 Ko gzip
- [x] garde-fous faction / couleurs verts
- [x] smoke @core desktop + mobile
- [x] golden inchangé (aucun fichier moteur touché)

## Note

Clôt **E15**. Bascule purement présentation (Fullscreen API navigateur), aucune
persistance (le plein écran est un état du navigateur, pas une préférence de
jeu).

## Clôture (2026-08-24)

Plan **clos** par la passe `close-open-plans.md` : le code décrit ci-dessus était
déjà sur `main`, seule la trace de vérification manquait. Pipeline rejoué en
entier ce jour — typecheck ✓ · lint ✓ · tests **935 moteur / 165 contenu / 74
client** ✓ · `content:check` (7 paquets, 2 cartes, 16 scénarios) ✓ · garde-fous
faction & couleurs ✓ · build + budget bundle **364 866 o gzip** (cap 819 200) ✓ ·
smoke `@core` desktop + mobile **55/55** ✓ (54 au 1ᵉʳ passage : le test `ville`
mobile a dépassé le timeout **local** de 30 s sous contention CPU du conteneur —
rejoué seul : **22,1 s, vert** ; la CI utilise 45 s pour cette raison) · golden inchangé (aucun fichier
moteur touché).
