# Plan — Audit ergonomique de référence (chantier UX §5, étape 1)

> Première passe de l'audit outillé prévu au plan de remédiation §5.3 (étape 1 :
> « créer la skill `ux-audit` + première passe de captures — état de
> référence »). Skill livrée : `.claude/skills/ux-audit/` (SKILL.md +
> `capture.mjs`). Ce fichier consigne l'état de référence ; chaque lot UX ouvrira
> ensuite son propre `.claude/plans/ux-<écran>.md`.

## 1. Méthode
- Skill `ux-audit` exécutée sur le **build de prod** (`vite preview`), 24
  captures = 4 écrans (menu, aventure, ville, combat) × 2 viewports
  (desktop 1280×800, mobile 360×640 portrait) × 3 crans de police.
- `capture.mjs` mesure en plus toutes les cibles tactiles **DOM** et signale
  celles < 44 px (A1). Les hexes/tuiles du **canvas** ne sont pas mesurables en
  DOM — traités à part (A7).

## 2. Constats de référence (2026-07-05)

| # | Verdict | Détail |
|---|---|---|
| **A1** cibles ≥ 44 px (DOM) | ✅ | 0 cible DOM < 44 px sur les 24 captures, y compris mobile × font1–3. |
| **A5** jamais la couleur seule | ✅ | Ville : badges « Verrouillé » = couleur **+ libellé** ; prérequis en texte ; `FactionBadge` à motif. |
| **A6** 3 crans de police | ⚠️ | Le texte grandit partout (rem). **Défaut** : la barre d'onglets de la ville (`Construire/Recruter/Garnison`) déborde à droite en mobile × font3 — « Garnison » tronqué. |
| **A7** zoom/pan + cibles combat | ❌ | **CL7 confirmé** : en combat mobile portrait, le plateau 12×10 est écrasé (hexes nettement < 44 px), une pile est coupée au bord droit, l'overlay « Rotation en paysage recommandée » est un contournement, pas une mise en page portrait (doc 08 §2.4). **Cible du lot U1.** |
| A2 hover/appui long, A3 tap-tap, A4 pile modales, A8 i18n | ⏳ | Non re-vérifiés dans cette passe (déjà couverts par les smokes existants : tap-tap, i18n FR/EN, modale unique). À repasser par écran lors des lots dédiés. |

Captures de référence : régénérables à l'identique via la skill (voir SKILL.md
§2). Non versionnées (binaires) — l'état est reproductible.

## 3. Suite (ordre plan §5.3)
- [x] Étape 1 — skill `ux-audit` + passe de référence (ce lot).
- [x] Étape 2 — **U2 routeur d'écrans livré** (`.claude/plans/ux-u2-routeur.md`) :
      route de base menu⇄adventure + pile de modales typée (doc 08 §3), combat
      dérivé de l'état moteur, handler global de retour (Échap + back Android).
- [x] Étape 3 — **U1 combat mobile livré** (`.claude/plans/ux-u1-combat-mobile.md`) :
      plateau de combat dans une caméra (plancher 44 px + pan/pinch), overlay
      rotation supprimé → **A7 corrigé** ; onglets ville `flex-wrap` → **A6
      corrigé**. Re-capture ux-audit à l'appui.
- [ ] Étapes 4–5 — U3 (feedback + journal), U4 (multi-héros/villes), U6 (écrans
      manquants), U5 (DA / ville peinte, jalon Beta).
