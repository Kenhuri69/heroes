# Plan — Contraste texte sombre + carte d'unité de l'armée

Constat (captures mobiles utilisateur, `kenhuri69.github.io`) :

1. **Texte noir sur fond sombre illisible** — l'overlay « passage d'appareil »
   (`Au tour du joueur 2` / `Passez l'appareil…`), les chips d'armée
   (`Chœur d'apprentis ×30`, `Conscrit ×30`), et d'autres messages s'affichent
   en **noir** sur fond sombre.
   - **Cause racine vérifiée** (rendu headless Chromium) : aucune couleur de
     texte par défaut n'est posée sous `#ui-root` → héritage de la couleur
     par défaut du navigateur (`rgb(0,0,0)`). Confirmé : `.map-card-line`,
     `.modal.outcome-overlay h2/p`, `.army-slot-name` calculent tous `rgb(0,0,0)`.
2. **Armée** : l'utilisateur veut l'**asset de l'unité dans un cadre avec sa
   quantité**, et une **popin** donnant **stats + compétences** de l'unité.

## Périmètre : client + données (locales) uniquement. Zéro diff moteur.

## Étapes

1. **Défaut de couleur de texte** → `packages/client/src/ui/styles.css` :
   `#ui-root { color: var(--parchment); }`.
   Corrige d'un coup handoff, armée, confirmation fin de tour, fiche de pile
   combat et « autres messages ». Les surfaces sur fond clair (MapEditor…)
   posent déjà leur couleur explicite ⇒ pas de régression.
   - verify : rendu headless ⇒ les 4 éléments repères ne sont plus `rgb(0,0,0)`.

2. **Locales des capacités** → `data/core/locales/{fr,en}.json` :
   `ability.<id>` (nom) + `ability.<id>.desc` (effet court) pour les 27
   capacités du catalogue (doc 02 §5.4). Clés `army.card.*` de la popin.
   - verify : parité FR/EN, `content:check` vert.

3. **i18n** → `packages/client/src/app/i18n.ts` : `resolveAbilityName(id)` +
   `resolveAbilityDescription(id)` (repli sur l'id / null).

4. **Chip d'armée en cadre + popin** → `packages/client/src/ui/shell.tsx` +
   `styles.css` :
   - `ArmySlots` : slot rempli = **bouton** avec `AssetImg` (sprite
     `units/<groupId>/<unitId>`, repli = nom) + **badge quantité** ; ouvre la
     popin `UnitCard` (état local à `ArmySlots`).
   - `UnitCard` : portrait encadré, nom, stats (PV/Att/Déf/Dégâts/Vitesse),
     liste des compétences (nom + description). Fermeture backdrop/Échap/×,
     cible ≥ 44px.
   - verify : build + capture headless (chip encadré + popin lisible).

5. **Smoke** → `tests/smoke.spec.ts` : ouvrir/fermer la popin d'unité depuis
   le bandeau d'armée (non-régression). Sinon le signaler.

6. **Vérif finale** : `typecheck`, `lint`, `test`, `build`, garde-fou
   « zéro faction moteur », budget bundle, smoke. Commit + push + PR draft.

## État — livré ✅

Toutes les étapes réalisées et vérifiées :
- **1** `#ui-root { color: var(--parchment) }` — rendu headless : handoff, chips
  d'armée, toasts, fiches ne sont plus en noir (captures à l'appui).
- **2/3** 28 capacités (nom + desc) FR/EN, parité 713/713, `content:check` vert,
  helpers `resolveAbilityName`/`resolveAbilityDescription`.
- **4** Chips d'armée = vignettes encadrées (sprite + badge ×N) ouvrant `UnitCard`
  (portrait, stats, capacités localisées) — capture Conscrit ⇒ « Provocation »
  + description affichée.
- **5** Smoke : `bandeau d'armée : tap sur une vignette ⇒ fiche d'unité` (desktop
  + mobile). Test X3 existant toujours vert.
- **6** typecheck ✓ · lint ✓ · test 521 ✓ · content:check ✓ · build ✓ (bundle
  ~291 Ko gzip < 800) · smoke ciblé ✓. Zéro diff moteur (golden intact).

## Décisions
- Popin dédiée à l'aventure (distincte de `StackSheet` de combat, qui montre
  l'état de combat live) — même famille visuelle.
- État de la popin **local** à `ArmySlots` (pas de champ store) — surgical.
