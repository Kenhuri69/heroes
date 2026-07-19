# Plan — Correctifs UX des parties multi-joueurs

Branche : `claude/multiplayer-ux-issues-bcqcb3`

## Problèmes rapportés
1. Au passage joueur → joueur, la vue n'est pas recentrée sur le nouveau joueur actif.
2. À la bascule sur l'IA, le jeu paraît figé/bloqué.
3. Aucun indicateur « qui joue » ni progression des adversaires.

## Diagnostic (client uniquement)
- `runAiLoop` (`app/dispatch.ts`) est une boucle `for(;;)` **synchrone** : aucun
  yield → le navigateur ne repeint jamais entre les tours IA (gel, pas de feedback).
- `centerOnHero` n'est appelé qu'une fois au démarrage (`main.ts` `ensureScenes`) —
  jamais au changement de joueur actif.
- `HandoffOverlay` couvre le hot-seat humain→humain uniquement ; rien pendant l'IA.
- Contrainte : ne PAS casser le contrat des tests (`await dispatch(EndTurn)` doit
  garantir que les tours IA se sont appliqués). Zéro diff moteur, pas de bump save
  (état d'UI `aiTurn` non persisté).

## Étapes

1. **Store** (`app/store.ts`) : ajouter `aiTurn: { seat; done; total } | null` (état
   UI de progression IA). → vérif : typecheck, défaut `null`.
2. **Boucle IA async** (`app/dispatch.ts`) : `runAiLoop` devient `async`, avec
   garde de ré-entrance, calcul du `total` (tours IA consécutifs à venir), et un
   yield rAF + petit délai (coupé si `reduceMotion`) avant chaque tour ; `dispatch`
   `await` la boucle. → vérif : le jeu ne gèle plus (smoke), tests scénario/skirmish
   passent encore (IA jouée après await).
3. **Indicateur de tour** (`ui/shell.tsx`) : composant `TurnIndicator` dans la barre
   de tour — joueur actif (pastille couleur + libellé) et, pendant l'IA, barre de
   progression `done/total` non bloquante. → vérif : `data-testid="turn-indicator"`
   / `ai-progress` visibles au bon moment (smoke).
4. **Recentrage caméra** (`scenes/adventure/AdventureScene.ts`) : au changement de
   joueur humain actif (après validation du passage d'appareil), `panCameraTo` vers
   le héros sélectionné du nouveau joueur. → vérif : hot-seat, la vue suit le J2.
5. **Garde d'entrée** (`AdventureScene.handleTap`, `app/end-turn.ts`) : ignorer les
   actions humaines quand `players[currentPlayer].controller !== 'human'` (la carte
   reste pannable via la caméra). → vérif : pas d'`EngineError`/toast pendant l'IA.
6. **i18n** (`data/core/locales/fr|en.json`) : clés `turn.*` (joueur actif, IA joue,
   progression). → vérif : parité FR/EN, 0 chaîne en dur.
7. **Docs** : note dans `docs/08-ui-ux.md` + entrée `CLAUDE.md`. → vérif : cohérence.
8. **Smoke** (`tests/smoke.spec.ts`) : couvrir l'indicateur IA en skirmish + non-gel.
   → vérif : `pnpm test` + smoke Chromium verts.

## Suivi
- [x] 1. Store `aiTurn` — typecheck vert.
- [x] 2. `runAiLoop` async + `dispatch` await — tests scénario/survie/hot-seat verts.
- [x] 3. `TurnIndicator` (barre) — testids `turn-indicator`/`ai-progress`/`active-player-label`.
- [x] 4. Recentrage caméra au changement de joueur actif.
- [x] 5. Gardes d'entrée (handleTap + requestEndTurn).
- [x] 6. i18n `turn.*` FR/EN.
- [x] 7. Docs 08 + CLAUDE.md.
- [x] 8. Smoke : nouveau test « indicateur de tour + progression IA » (desktop+mobile verts).

## Vérification finale
typecheck, lint, tests unitaires, golden (inchangé — pas de moteur), garde-fou
« zéro faction », budget bundle, smoke headless.
