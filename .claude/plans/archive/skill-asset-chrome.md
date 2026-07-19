# Plan — skill `asset-chrome` (chrome procédural d'UI)

> Demande utilisateur : combler le trou d'identité relevé — l'UI interactive
> (panneaux, en-têtes) est plate/tokenisée alors que l'art plein cadre (fonds,
> logo, illustrations) porte la gouache. On scaffolde un skill qui **génère le
> chrome décoratif** (cadre 9-slice + ruban d'en-tête) dans le style laiton/
> parchemin, déterministe (Règle P), et on le **branche sur un panneau témoin**.

## Périmètre (scaffold + démonstrateur, pas un rollout complet)

- **Skill** `.claude/skills/asset-chrome/SKILL.md` (jumeau d'`asset-procedural`).
- **Générateur** `tools/assets/gen_chrome.py` (PIL, déterministe, `_preview.png`) :
  - `panel-frame.png` — cadre **9-slice** (coins ornés + rails laiton, centre
    transparent → le fond du panneau reste visible).
  - `ribbon.png` — **ruban d'en-tête** 3-slice horizontal (caps + barre laiton
    à face parchemin).
- **Intégration témoin** : résolveurs `chromeFrameUrl()`/`chromeRibbonUrl()` dans
  `render/assets.ts` (registre auto-découvert existant) ; cadre appliqué en
  `border-image` inline sur la **modale ville** (`.town-screen`), ruban sur le
  bandeau « Chantier du jour » si le rendu est propre. Repli gracieux (URL
  absente ⇒ bordure tokenisée actuelle).
- **Doc 12 : Règle G — chrome procédural** (docs = vérité).

## Invariants

- Déterminisme (re-run = octets identiques). PNG **hors bundle** (registre
  `?url`, budget intact). Garde-fou couleurs : le chrome art a sa propre rampe
  laiton dans le **.py** (les `.css` restent aux tokens/url). Zéro moteur.

## Étapes

- [x] `gen_chrome.py` : frame 9-slice + ribbon 3-slice + `_preview.png`,
      déterministe (2ᵉ run = octets identiques). `assets/ui/chrome/`.
- [x] `SKILL.md` (usage, sortie, intégration, vérif déterminisme, pièges).
- [x] `render/assets.ts` : `chromeFrameUrl` / `chromeRibbonUrl`.
- [x] Témoin : `.town-screen` cadre `border-image` (fallback) + ribbon sur
      `town-build-queue` (face encre → texte clair lisible). `box-sizing:
      border-box` sur les 2 surfaces. CSS = box-sizing + commentaires (0 hex/url).
- [x] Doc 12 §Règle G + ligne de table §0.
- [x] Vérif : gen **déterministe** ✅, typecheck ✅, lint ✅, garde-fou couleurs
      ✅, build (chrome hors bundle `panel-frame`/`ribbon` émis) ✅, **captures
      ux-audit ville** (cadre laiton + rivets + ruban, propre au cran 3 mobile
      grâce à border-box) ✅, **smoke 134 passed / 2 skipped** ✅.
- [ ] Commit + push + PR draft.

## Journal
- **2026-07-09** — Cadrage : pattern PIL/Règle P confirmé (gen_ui_icons),
  intégration via résolveur d'URL + style inline (comme townBackgroundUrl).
  Témoin = modale ville (art plein cadre déjà là, contraste avec le chrome plat).
