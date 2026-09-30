# LE6 — Revenir dans la partie

> Lot LE6 du plan `game-experience-enrichment.md` (§4) : **E1** (fuite HoMM,
> corrige la divergence doc ↔ code) → **B3** (l'IA visite et fuit) → **E2**
> (semaine offerte à la construction). Décision adoptée par l'utilisateur le
> 2026-09-29 (§5, point 7) ; amendements de l'expert repris (§3.1 E1, B3).

## 1. Constat (lu dans le code)

- `Retreat` (`combat/leave.ts`) laisse le héros **sur la carte, armée vide** :
  l'« éclaireur vide » ramasse et révèle sans rien risquer. Doc 02 dit « re-
  recrutable en taverne » : divergence.
- Un héros IA dominé combat jusqu'à la mort et perd ses artefacts (H-VS-H).
- Une habitation bâtie démarre à stock 0 : il faut attendre la semaine suivante
  pour recruter (HoMM III offre une semaine de croissance à la construction).

## 2. Décisions de conception

### E1 — fuite HoMM

- Opt-in `hero.retreatToTavern: true` (absent ⇒ comportement actuel, fixtures
  et golden inchangés).
- La fuite retire le héros de la carte **sans survivant** (canon ; la
  reddition couvre le reste). Il garde niveau, XP, attributs, compétences, sorts,
  artefacts, sac et machines de guerre, et rejoint la **réserve** de son joueur
  (`PlayerState.reserveHeroes?`, optionnel ⇒ pas de bump save).
- Recrutement : `RecruitHero` avec l'id de roster (ou l'id du héros, pour un
  héros de départ sans roster) dans **n'importe quelle** Taverne du joueur,
  toutes factions confondues, au prix normal. Le héros revient tel quel, armée
  vide, avec ses PM du jour. Il est présenté en tête de la Taverne.
- Le pool exclusif compte la réserve : un héros en réserve n'est recrutable par
  personne d'autre.
- Conditions de scénario : un héros en réserve a quitté la carte ⇒
  `defeatHero` est rempli (comportement actuel, canon III). Un joueur sans ville
  ni héros sur la carte est éliminé, réserve comprise.

### B3 — l'IA visite et fuit

- En combat, un camp IA mené par un héros fuit au lieu de combattre quand sa
  force est < `AI_RETREAT_RATIO` (0,25) × celle d'en face, et que la fuite est
  permise (`validateRetreat`) ; **jamais** en défense de sa dernière ville.
- L'IA relance ensuite son héros depuis la réserve (priorité au recrutement).
- « Visite utile » : les lieux de bonus sont déjà collectables par l'IA (LE4 :
  fontaines) ; seul le reste de B3 est à faire.

### E2 — semaine offerte à la construction

- Opt-in `dwellingInitialStock: true` (config d'aventure) : une habitation qui vient d'être
  bâtie reçoit sa croissance hebdomadaire de base (`weeklyGrowthOf`).

## 3. Étapes

1. [x] E1 moteur — config, réserve, fuite, recrutement, pool exclusif ; tests
   (fuite ⇒ réserve ; recrutable dans une autre Taverne du joueur ; recruté avec
   niveau/artefacts ; pas par un autre joueur ; règle absente ⇒ comportement
   actuel).
2. [x] E1 client — Taverne (réserve en tête, niveau), toast ; smoke Taverne.
3. [x] B3 — fuite de l'IA dominée, recrutement de la réserve ; tests.
4. [x] E2 — stock initial ; test.
5. [x] Mesures (bench IA) ; docs 02, CLAUDE.md ; vérifications.

## 4. Mesures

**Bench IA** (jetable, non commité ; 2 IA, 64², 20 graines, 60 jours, normal ;
LE5 actif dans les deux colonnes) :

| | Sans LE6 | **Avec LE6** |
|---|---|---|
| Fuites d'un héros IA dominé | — | 7 |
| Héros de niveau > 1 recrutés (retours de réserve) | 0 | 1 |
| Combats hors gardien (entre joueurs, sièges) | 11 | 30 |
| Parties avec un combat entre joueurs | 3/20 | 6/20 |
| Combats de gardien perdus par l'IA | 35 / 313 | 22 / 303 |
| Ralliements (LE5) | 0 | 2 |

Lecture :
- La semaine offerte (E2) donne des armées plus fournies plus tôt : l'IA perd un
  tiers de combats de gardien en moins et va davantage au contact (combats entre
  joueurs 3 → 6/20, combats hors gardien ×2,7).
- La fuite joue son rôle : 7 héros IA dominés survivent au lieu de mourir. Un
  seul revient avec son niveau : la plupart des IA n'ont pas l'or de relancer un
  héros (2 × 2 500 or de marge) au moment voulu.
- n = 20, bruit fort : tendances, pas mesures fines.

**`faction:sim`** : non concerné (duels sans héros en réserve ni habitation).

## 5. Vérifications

- [x] `pnpm typecheck` · `pnpm lint`
- [x] `pnpm test` — moteur **1093** (+9), contenu 194, client 109, serveur 10 ; golden inchangé
- [x] `pnpm content:check` ; garde-fous faction et couleurs
- [x] `pnpm build` + budget : **383 654 o gzip**
- [x] suite Playwright complète : 146 verts + 1 échec réel (smoke C3 qui attendait le héros en fuite sur la carte — attente mise à jour, repassé) ; +1 test fuite → Taverne

## 6. Journal

- 2026-09-30 : plan ouvert, sur la branche de la PR #555 (LE5, encore ouverte).
- 2026-09-30 : E1, B3, E2 livrés. Écarts :
  - B3 se limite aux combats **héros contre héros hors siège** : un siège n'a pas
    de sortie définie pour la garnison, et l'IA n'attaque jamais un gardien
    qu'elle ne domine pas ;
  - la fuite de l'IA exige `retreatToTavern` (sans réserve, fuir laisserait un
    éclaireur vide) ;
  - un héros de départ sans roster se recrute par son id de héros ;
  - le bilan de combat s'affiche quand c'est l'**adversaire** qui fuit ;
  - `pnpm typecheck` ne couvre pas le build client : l'`exactOptionalPropertyTypes`
    de `retreatToTavern` n'est apparu qu'au `pnpm build`.
