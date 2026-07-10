# Plan — V-1 (cibles ressources) + rollout asset-chrome

> Deux suites de l'audit accueil/ville (`ux-audit-accueil-ville.md`) et du skill
> `asset-chrome`, demandées ensemble.

## V-1 — cibles tactiles de la barre de ressources
- **Constat audit** : `resource-open-{crystal,gems,sulfur,mercury}` 36–39 px de
  large (< 44) — `.resource` avait `min-height:44px` mais pas de `min-width`.
- **Fix** (`ui/styles.css`) : `min-width: 44px` + `justify-content: center` sur
  `.resource`. Cible ≥ 44 px sur les DEUX axes.
- **Vérif** : re-passe `ux-audit` ⇒ **0 warning `resource-open`** (desktop +
  mobile, 3 crans) ; la barre mobile scrolle toujours (overflow-x), pas de
  débordement cassant.

## Rollout asset-chrome — classe partagée + generator enrichi
- **Mécanisme partagé** : `main.ts` pose `--chrome-frame` / `--chrome-ribbon`
  (`:root`) depuis le registre d'assets ; classes `.chrome-framed` /
  `.chrome-ribbon` (`styles.css`, `border-image` sur ces variables,
  `box-sizing: border-box`, repli gracieux si variable absente). Remplace le
  style inline du témoin ville.
- **Surfaces habillées** : modale de ville (`.town-screen` + ruban sur
  `town-build-queue`), **Options** (`.options-panel`), **Journal**
  (`.journal-panel`), **pré-combat** (`.pre-battle`). Pour chacune, la bordure
  tokenisée est **déléguée** à la classe partagée (retirée du CSS spécifique
  pour éviter le conflit de spécificité `.modal.<x>` > `.chrome-framed`).
- **Générateur enrichi** (`gen_chrome.py`) : ornement de coin = rivet **+
  perlage** (3 perles décroissantes le long de chaque rail), confiné au bloc de
  coin du 9-slice (bords toujours répétables). Déterministe.

## Invariants
- Zéro moteur/faction. PNG hors bundle (budget ~278 Ko gzip). Garde-fou couleurs
  vert (var/tokens en CSS ; rampe laiton dans le `.py`). `box-sizing` évite tout
  décalage de layout.

## Étapes
- [x] V-1 : `min-width:44px` + centrage sur `.resource`.
- [x] `main.ts` : variables CSS `--chrome-frame`/`--chrome-ribbon` au bootstrap.
- [x] `styles.css` : classes `.chrome-framed` / `.chrome-ribbon`.
- [x] Habiller ville (refactor inline→classe), Options, Journal, pré-combat ;
      déléguer les bordures.
- [x] `gen_chrome.py` : perlage de coin. Régénéré, déterministe.
- [x] Doc 12 Règle G : classe partagée + surfaces habillées.
- [x] Vérif : typecheck ✅, lint ✅, garde-fou couleurs ✅, build ✅, gen
      déterministe ✅, captures (V-1 **0 warning `resource-open`**, cadre laiton
      enrichi sur ville + options via classe partagée) ✅, **smoke 133 passed /
      2 skipped** — seul échec = flaky pré-existant `raccourci E` (chemin
      clavier/fin-de-tour non touché ; snapshot d'échec = écran sain ; tous les
      tests de modales verts ; rejoué 2× en CI).
- [x] Commit + push + PR.
