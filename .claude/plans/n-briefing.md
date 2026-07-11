# Lot N-BRIEFING — Fiche de scénario avant lancement

> Backlog : `game-feature-gaps.md` §2.8 (N-BRIEFING). Doc source : **doc 08 §2.5**
> (« fiche de scénario (objectifs) »). **Client pur — zéro moteur, zéro save,
> zéro golden.** Branche `claude/cities-screen-ux-wemh1n` (repart de `main`).

## Constat

`MenuScreen.tsx` lance un scénario **directement** au clic (`heroes:start-scenario`),
sans montrer objectifs/faction/adversaires (doc 08 §2.5 demande une fiche
d'information avant lancement). Les campagnes ont déjà une intro narrative
(`openingDialog`) ⇒ hors périmètre ; on cible **scénarios permanents + événements**.

## Spec

Interposer une **modale de briefing** entre le clic et le démarrage :
- Nouveau kind de modale `{ kind: 'briefing'; scenarioId }` (router).
- Bouton scénario/événement ⇒ `openModal({ kind:'briefing', scenarioId })` au
  lieu du dispatch direct.
- `BriefingScreen` lit le scénario du store par id et affiche :
  - **nom** localisé (`resolveScenarioName`),
  - **faction** du 1er joueur humain (localisée `@loc:faction.<id>.name`),
  - **objectif de victoire** + **condition de défaite** (localisés, génériques,
    `days` interpolé pour `surviveDays`),
  - **adversaires** : nombre de joueurs IA.
  - Bouton **Commencer** ⇒ dispatch `heroes:start-scenario` + ferme la modale ;
    bouton/backdrop/Échap ⇒ retour (modale simple dans la pile, doc 08 §3).
- Locales FR/EN `briefing.*` (titre, labels, 4 objectifs, adversaires, boutons).
- CSS `.briefing-*` **tokens uniquement** (réutilise `modal`/`chrome-framed`).

## Étapes / vérif

1. Router : ajouter le kind `briefing` → typecheck.
2. `BriefingScreen.tsx` + `briefing.css` (tokens) → typecheck/lint.
3. Câbler dans `shell.tsx` (rendu) + `MenuScreen.tsx` (ouvre la modale).
4. Locales FR/EN (parité) → `pnpm --filter @heroes/content test`.
5. Smoke : adapter les 2 flux menu (tutoriel, event-curée) pour cliquer
   « Commencer » ; nouveau test « la fiche montre objectif + faction ».
6. Vérifs complètes : typecheck 5/5, lint, engine test, content test, build
   (< 800 Ko gzip), garde-fous zéro-faction + couleurs, smoke.
7. Doc 08 §2.5 : noter la fiche livrée. Backlog N-BRIEFING ✅.

## Journal

- plan créé ; exploration faite (Scenario schema, router, shell, MenuScreen, smoke).
- **Livré** : router (kind `briefing`), `BriefingScreen.tsx` + `briefing.css`
  (tokens), câblage `shell.tsx`, ouverture depuis `MenuScreen.tsx` (scénarios +
  événements), locales FR/EN `briefing.*`, doc 08 §2.5 à jour, backlog ✅.
- Smoke : 2 flux menu adaptés (tutoriel + event-curée cliquent « Commencer ») ;
  le test tutoriel vérifie en plus la présence objectif + faction dans la fiche.
- Vérifs vertes : typecheck 5/5, lint, engine 530, content 110, build
  (JS gzip ≈ 285 Ko < 800), garde-fous zéro-faction + couleurs, smoke 148 passed
  (2 skipped). **Zéro diff moteur/save/golden.**
