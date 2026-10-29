# LD4 — Montée de niveau HoMM III (avec garanties)

Source : `.claude/plans/design-round-3.md` (LD4, verdict de l'expert, D-LD4 → (b)).

## Règle

- Deux propositions : une **montée** (compétence connue, rang < 3) et une
  **nouvelle** (moins de 6 connues) ; à défaut d'un genre, deux de l'autre.
- Tirage pondéré par archétype : `config.hero.skillWeightsByArchetype`
  (archétype → compétence → poids, 1 par défaut ; 0 = jamais proposée comme
  nouvelle ; une montée pèse au moins 1).
- Garanties génériques : `config.hero.skillGuarantees` — Sagesse tous les 6
  niveaux, une école de magie tous les 4 ; compteur par héros
  `HeroState.skillOfferCounters?` (optionnel, sans bump), remis à 0 quand la
  garantie est proposée, avancé seulement si le héros peut l'apprendre.
- IA : compétence de faction d'abord, puis poids d'archétype × 1,5 pour une
  montée ; aucun tirage.
- UI : étiquette « Montée » / « Nouvelle » sur chaque proposition.

## Étapes

1. [x] Config + schéma + champ d'état optionnel (garde de forme mise à jour).
2. [x] `hero/level-up.ts` : `skillPools`, `weightedPick`, garanties, `aiSkillPick`.
3. [x] Données `config.json` (poids might/magic, garanties).
4. [x] Tests `level-up-ld4.test.ts` (6) ; golden inchangé.
5. [x] Client : étiquette de genre (`skillChoice.upgrade/new`, FR/EN).
6. [x] Doc 02 §1.2, CLAUDE.md, registre.
7. [x] Mesure + Playwright.

## Journal

- Golden **inchangé** (le replay ne monte pas de niveau avec choix différent).
- Mesure (2 IA, 64², 90 j, 60 graines, j56) : rang moyen de la compétence de
  faction des héros IA 0,40 → **0,58** ; compétences par héros 3,04 → 1,98 (l'IA
  approfondit plutôt que de s'éparpiller — effet du bonus de montée) ; Sagesse
  des héros de magie 78 % → 78 % ; parties conclues 29 → 28 (bruit).
- Écart au plan : rien de mémorisé hors compteurs ; les poids des compétences
  de faction (`necromancy`…) sont des clés de données, jamais lues par le moteur.
