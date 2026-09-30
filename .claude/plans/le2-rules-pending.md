# LE2 — Règles en suspens

> Lot LE2 du plan `game-experience-enrichment.md` (§4), décisions adoptées par
> l'utilisateur le 2026-09-29 (§5, points 6, 8, 9, 10, 11 + A5/C4). Petits
> correctifs de règles, **golden re-fixé une seule fois** si nécessaire, zéro
> faction, pas de bump `CURRENT_SAVE_VERSION` (champs optionnels).

## 1. Périmètre

| ID | Décision | Site |
|---|---|---|
| D1 (M10) | **Défendre** donne au moins **+1 Déf** (`max(def + 1, ⌊def × mult⌋)`), préviz comprise | `combat/damage.ts` (fonction commune résolution/préviz) |
| D2 (M13) | **Soin ne ressuscite plus** : champ `revive?: boolean` au sort (défaut `false` ⇒ soigne la 1ʳᵉ créature seulement) ; `true` sur `resurrection`, `resurrection-de-masse`, `rappel`. Prière de bataille inchangée (ressusciteur explicite) | `combat/spell-effect.ts`, `hero/types.ts`, schéma contenu, `data/core/spells.json` |
| C1 (M12) | **File de choix de compétence** : une montée de niveau pendant qu'un choix attend incrémente `pendingSkillLevels?` ; le choix suivant est tiré au `ChooseSkill` (propositions toujours valides) | `adventure/experience.ts`, `hero/level-up.ts`, `hero/index.ts` |
| A5 (M14) | `visitTile` exige un **héros du joueur sur la tuile** (arrêt ou passage dans la commande) ; `defeatGuardian` exige que le **joueur** ait vaincu le gardien (`quests.vanquishedBy?`) | `quest/evaluate.ts`, `quest/types.ts` |
| C4 (M19) | Récompense au **héros qui a validé** (sinon le 1ᵉʳ) ; armée pleine ⇒ **garnison** de la ville possédée la plus proche, annoncée par un toast | `quest/evaluate.ts`, event `QuestCompleted`, client `narrative.ts` + locales |
| D-REINF | `CallReinforcements` **consomme l'action de héros du round** (même budget que frappe/sort) | `combat/reinforce.ts` |
| D-POISON | le poison **traverse** le bouclier — statu quo, documenté | docs 02 / 16 |

## 2. Étapes

1. [x] D1 — `max(def + 1, ⌊def × mult⌋)` dans `computeMultiplier` (résolution ET préviz). Test Déf 2 ⇒ 3.
2. [x] D2 — `revive?` (moteur `SpellDef`, schéma réservé aux `heal`, **propagé par `buildSpellCatalog`** — sans quoi Résurrection serait devenue un simple soin en jeu réel) ; données `resurrection`/`resurrection-de-masse`/`rappel`. Tests moteur (soin ⇒ 0 mort relevé ; `revive` ⇒ relève) + contenu (propagation, rejet hors `heal`).
3. [x] C1 — `pendingSkillLevels?` ; la paire suivante est tirée au `ChooseSkill`. IA inchangée.
4. [x] A5 — `visitTile` : héros sur la tuile ou passage (`MoveStepped`) ; `defeatGuardian` : `quests.vanquishedBy?` alimenté par `GuardianVanquished`. Aucune donnée n'utilisait ces conditions ⇒ `by:'sight'` non ajouté (rien à préserver).
5. [x] C4 — héros validant ⇒ récompense ; armée pleine ⇒ garnison la plus proche (`QuestCompleted.rerouted`) + toast client `toast.questRewardRerouted` (FR/EN).
6. [x] D-REINF — gate `heroActionLeftFor` + `heroAttackUsed.push` à l'appel.
7. [x] Docs 02 (§1.2, §1.4, §5, renforts, poison), 13 (§5.3), 16 (poison) ; `faction:sim` avant/après (§4) ; **golden inchangé**.
8. [x] Vérifs (§5).

## 3. Écarts & décisions

- **Pas de bump `CURRENT_SAVE_VERSION`** : `pendingSkillLevels?` et `vanquishedBy?` sont optionnels (absents = 0 / vide), précédent `PlayerState.unitsLost?` ; garde de forme `save-shape.test` mise à jour et changelog `state.ts` annoté.
- `ChooseSkill` consomme désormais du RNG quand une montée attendait (tirage différé) — seulement dans ce cas ; golden inchangé.

## 4. Équilibrage (`faction:sim`, terrain neutre)

| | Avant | Après |
|---|---|---|
| Béances au duel (hors 20–80 %) | 0 | **1** — arcane-hunters vs vox-arcana 23,3 % → **19,2 %** |
| À surveiller (hors 45–55 %) | 15 | 14 |

Isolé : c'est **D1** (Défendre ≥ +1) qui fait basculer ce duel (sans D1 : 23,3 %, 0 béance) ; D2 ne bouge rien de mesurable. Les autres duels varient de ±2,5 pts au plus. **Non re-tuné** (décision d'équilibrage à trancher par l'utilisateur ; duel sensible au seuil, 0,8 pt au-delà de la bande).

## 5. Vérifications

- [x] `pnpm typecheck` · `pnpm lint` verts
- [x] `pnpm test` — moteur **1044** (+10), contenu 187 (+1), client 109, serveur 10 ; nouveaux tests échouent sans le correctif (sauf les cas positifs/garde) ; **golden inchangé**
- [x] `pnpm content:check` vert ; garde-fous faction & couleurs verts
- [x] `pnpm build` + budget : **377 843 o gzip**
- [x] smoke `@core` desktop + mobile : **56/56**

## 6. Journal

- 2026-09-30 : plan ouvert (branche repartie de `main` après la fusion de #551).
- 2026-09-30 : lot livré (§2), mesures (§4), vérifications (§5).
