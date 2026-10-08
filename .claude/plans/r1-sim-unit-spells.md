# R1 — Le sim voit la magie des unités, puis le Maître de Sortilèges

> Lot R1 du plan `game-experience-enrichment.md` (§5bis.2), amendé par l'expert
> (§5bis.4) et tranché par l'utilisateur le 2026-10-08 (§5bis.5) : sim corrigé,
> **IA sort contre frappe**, Maître = **Dissonance**. Passe 4 d'équilibrage
> seulement si la mesure d'après la justifie (D-R1a).

## 1. Constat

- `simulateAutoCombat` / `simulateHeroCombat` (`combat/simulate.ts`) ne posent
  jamais `state.spellCatalog` ⇒ `chooseSpellcast` sort sur `if (!spell)` : en
  `faction:sim`, la Prêtresse, l'Ange, le Bibliothécaire et la Sorcière frappent
  au lieu de lancer. En vraie partie, le catalogue est chargé : ils lancent.
- `chooseSpellcast` lance **d'office** dès qu'un allié a perdu 1 PV ; un sort
  `revive` ne compte pas les créatures mortes (l'Ange choisit l'allié le plus
  entamé, pas le plus décimé) ; un débuff peut être relancé sur une cible qui le
  porte déjà.
- Maître de Sortilèges (Vox T6 et élite) : `abilities: []`, le `spellcaster`
  prévu au doc 16 attendait le sim.

## 2. Décisions

- **Outillage** : `spellCatalog` en dernier paramètre optionnel (défaut `{}`) de
  `simulateAutoCombat` et `simulateHeroCombat` ; `faction:sim` passe
  `buildSpellCatalog`. Aucune règle neuve.
- **IA** (`combat/ai.ts`) : soin et dégâts d'unité rendent leur valeur en PV
  (PV réellement rendus via `resolveResurrect`, morts comprises pour `revive` ;
  dégâts plafonnés à la pile) ; le sort passe devant la frappe seulement s'il vaut
  au moins les dégâts moyens de la meilleure frappe légale. Débuff/silence : jamais
  sur une cible qui porte déjà ce sort. Buff et marques : inchangés. Les frappes
  légales sont extraites dans `legalAttackCandidates` (partagées, calculées une fois).
- **Données** : Maître `spellcaster { dissonance, charges 2, power 3 }`, élite
  `charges 3` (même pouvoir : l'élite lance plus souvent).

## 3. Étapes

1. [x] `simulate.ts` : paramètre `spellCatalog`
2. [x] IA sort contre frappe + débuff non relancé ; tests (`combat-spellcaster`)
3. [x] `faction:sim` passe le catalogue
4. [x] Maître de Sortilèges (base + élite)
5. [x] Mesures avant / intermédiaire / après ; décision passe 4
6. [x] Docs 16 (et 02 §5.6 / 06 §5.6), CLAUDE.md, plan d'enrichissement
7. [ ] Vérifications

## 4. Vérifications

- [ ] typecheck (sans `-s`), lint, build ; budget ; garde-fous faction et couleurs
- [ ] tests moteur / contenu / client / serveur ; golden inchangé
- [ ] Playwright complet comme en CI (hors @perf, puis @perf mono-worker)

## 5. Journal

- 2026-10-08 : plan ouvert.
  - Observé en passant : deux lancers du même sort de statut **s'empilent**
    (`statuses.push`, somme des modificateurs) au lieu de rafraîchir la durée
    comme dans HoMM. Question de règle, hors R1 : l'IA ne relance plus un débuff
    déjà posé, mais un joueur (ou un héros) le peut encore. À trancher plus tard.
  - Test `combat-silence` : le sort de dégâts du lanceur passe de 10 à 30 PV pour
    rester préférable à sa frappe (5 × 4), l'intention du test est inchangée.
- 2026-10-08 : mesures `faction:sim` (winrate moyen au duel de base, %) :

  | Relevé | Haven | AH | Necro | Sylvan | Vox | Dungeon | Béances |
  |---|---|---|---|---|---|---|---|
  | Avant | 53,4 | 51,5 | 50,4 | 53,9 | 43,9 | 46,9 | 1 (AH-Vox 19,2) |
  | Sorts vus + IA sort/frappe | 60,9 | 50,7 | 45,2 | 56,8 | 41,4 | 45,0 | 0 |
  | + Maître (Dissonance) | 61,4 | 51,9 | 44,6 | 55,4 | 38,8 | 47,8 | 1 (Haven-Vox 81,7) |

  - L'IA sort contre frappe change la donne par rapport au relevé jetable du
    designer (sorts vus, IA d'origine : Haven 42,0, béance Haven-Sylvan 13,3 %) :
    Haven, qui soigne et ressuscite à bon escient, devient la plus forte.
  - Facteur d'égalité des élites : toujours ✓ partout (Haven ×1,027, Vindicateur
    ×1,030, AH ×1,033, Dungeon ×0,962, Vox ×1,050 — en limite).
  - Duel des élites contre élites (lecture, fil du rasoir) : 10 → 11 ✗, Haven très bas.
  - Écart max entre factions 10 → 22,6 pts ⇒ **la passe 4 est justifiée** (D-R1a),
    données seules ; placement à confirmer par l'utilisateur.
