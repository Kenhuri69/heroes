# Lot F-BONUS — bonus passifs de faction (Ferveur / Formation)

Backlog `game-feature-gaps.md` §2.3 (F-BONUS) : bonus de combat passifs déclarés
au manifeste de faction — Ferveur +1 moral, Formation +5 % déf (Haven, doc 03 §2).
Ouvre **une** variante générique de `FactionBonus` (`combatBonus`), interprétée en
combat. Zéro nom de faction dans le moteur. **Pas de save bump** (le
`factionCatalog` est déjà sérialisé ; les bonus sont des données).

## Modèle

Nouvelle variante déclarative `FactionBonus` : `{ type: 'combatBonus'; attack?;
defense?; morale? }` — **points plats**, sommés dans les helpers par-camp
existants :
- `morale` → `heroMoraleForSide` (state-helpers) ;
- `attack` → `heroAttackOf` (damage) ;
- `defense` → `heroDefenseOf` (damage).

Mapping doc→données (pente Défense = 2,5 %/pt) : **Ferveur** = `{ morale: 1 }` ;
**Formation +5 % déf** ≈ `{ defense: 2 }` (2 × 2,5 % = 5 % de réduction). Aucune
chirurgie de la formule de dégâts (les 3 helpers alimentent déjà attaque/défense/
moral).

## Étapes

1. **Type** — `CombatBonus` ajouté à l'union `FactionBonus` (`faction/types.ts`).
2. **Helper** — `factionCombatBonus(state, combat, side) → {attack,defense,morale}`
   (`state-helpers.ts`) : lit `factionCatalog[hero.factionId].bonuses`, somme les
   `combatBonus`. Générique.
3. **Câblage** — folded dans `heroMoraleForSide` / `heroAttackOf` / `heroDefenseOf`.
4. **Schéma contenu** — variante `combatBonus` dans `factionBonusSchema`
   (`packages/content/src/schemas.ts`) ; validation loader tolérante (aucune réf
   externe à vérifier).
5. **Données** — manifeste Haven : `factionBonuses` Ferveur+Formation.
6. **Docs** — doc 03 §2 (bonus livrés) ; doc 06 §4 (nouvelle variante générique).
7. **Test** — moteur : une pile Haven (héros + factionCatalog) gagne +1 moral et
   +2 défense ; sans faction ⇒ inchangé. Golden **inchangé** (factionCatalog
   golden vide).
8. **Vérif** — `pnpm test`, typecheck, lint, `content:check`, garde-fou, build,
   smoke. **Pas de bump save**, golden inchangé.

## Journal

- branche `claude/f-bonus-faction` depuis `main` @ 9b27b90.
- Type `CombatBonus` ajouté à l'union `FactionBonus` ; helper `factionCombatBonus`
  (state-helpers) ; folded dans `heroMoraleForSide`/`heroAttackOf`/`heroDefenseOf`.
- Schéma contenu : variante `combatBonus` (`.default(0)` pour matcher le type
  moteur optionnel sous `exactOptionalPropertyTypes` — évite `number | undefined`).
- Données : manifeste Haven `factionBonuses: [{combatBonus, morale:1, defense:2}]`.
- Test : `combat-faction-bonus.test.ts` (faction de TEST générique) — +1 moral /
  +2 déf au porteur / rien sans faction / n'affecte pas l'adversaire.
- Écart relevé : main était **rouge au garde-fou** (comment #224 dans
  `client/src/app/content.ts` citait `test-faction`/`sylvan-court`) — reformulé
  pour retirer les ids littéraux (drive-by minimal, débloque la CI).
- Vérif : `pnpm test` = 493 (engine, +3) + 101 (content) ; typecheck 5/5 ; lint ;
  `content:check` ; garde-fou **vert** ; build 279 Ko < 800 ; golden **inchangé**
  (factionCatalog golden vide), **pas de bump save**. Smoke en cours.
- Docs : doc 03 §2 (livré + écart Formation plate) ; doc 06 §4 (variante).
