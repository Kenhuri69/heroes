# LD3 — Escorte de Taverne

Source : `.claude/plans/design-round-3.md` (LD3 + verdict de l'expert, D-LD3 amendé).

## Règle

- Un héros **neuf** recruté à la Taverne arrive avec une escorte : un emplacement
  par entrée de `hero.tavernEscort` (`{ tier, goldMin, goldMax }`).
- Pour chaque entrée : unité **de base** du palier dans la chaîne de la faction du
  héros (niveau 1 d'une habitation `factionId` = faction du héros, unité de ce
  `tier`) ; or tiré au RNG seedé dans `[goldMin, goldMax]` ; effectif =
  `max(1, ⌊or ÷ coût en or de l'unité⌋)`. Palier introuvable ou unité sans coût
  en or ⇒ emplacement sauté.
- Un héros qui revient de la **réserve** reçoit `hero.reserveEscort` (même
  forme ; données : 1 pile T1 de 100–150 or) — jamais une armée vide.
- Ne prélève pas le stock de la ville (canon III).
- Opt-in : bloc absent ⇒ armée vide (comportement d'avant). Données : T1 300–500,
  T2 200–350, T3 150–250.

## Étapes

1. [x] Type de config (`adventure/config.ts`) + schéma Zod (`schemas.ts`) + données.
2. [x] `hero/recruit.ts` : helper `rollEscort`, branché sur neuf + réserve.
3. [x] Tests moteur `hero-escort.test.ts` : bornes, déterminisme, palier absent,
   réserve, opt-in absent.
4. [x] Docs 02 §1.5 + CLAUDE.md + registre.
5. [ ] Check complet + golden inchangé + Playwright.

## Journal
- Écart : le palier se lit sur l'effet `dwelling` (`tier`), pas sur l'unité —
  plus direct, toujours présent.
- Données réelles (niveau 1 des habitations) : AH 8–13 Élèves / 2–3 / 1 ;
  Donjon 4–7 / 1–2 / 1 ; Haven 7–12 / 2–3 / 1 ; Nécropole 10–17 / 2–4 / 1 ;
  Sylvan 10–17 / 2–4 / 1 ; Vox 8–14 / 2–3 / 1.
- Check complet vert (1 138 tests moteur, golden inchangé, bundle 402 Ko).
