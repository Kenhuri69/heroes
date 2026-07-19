# Lot H-SPELLS.2 — Cercles 4-5 & extension de la Guilde des mages

> Backlog : `game-feature-gaps.md` §2.4 (H-SPELLS.2+). Doc source : **doc 02 §1.4**.
> Branche `claude/map-design-issues-jhjdy6` (repart de `origin/main`).

## Constat

La compétence **Sagesse** (`wisdom`) débloque l'apprentissage des cercles **4-5**
(`learnCircle` 4/5/5) — mais la Guilde des mages **plafonne au niveau 3** et
**aucun sort de cercle 4-5 n'existe** ⇒ Sagesse est **inerte**. Le moteur sait
déjà enseigner un cercle arbitraire (`rollGuildSpells(level)` filtre `circle===level`)
et gater par Sagesse (`heroLearnableCircle`) — **prouvé en test** (`mage-guild.test.ts`
utilise déjà un cercle 4 fictif). Il ne manque que **les données**.

## Spec (DONNÉES pures — zéro moteur, zéro save, golden inchangé)

- `data/core/buildings.json` : `mageGuild` `maxLevel` 3→**5**, ajouter les niveaux
  **4** (cercle 4, `spellCount` 2) et **5** (cercle 5, `spellCount` 1), coûts
  croissants (ressources rares : cristal/gemmes façon HoMM).
- `data/core/spells.json` : ajouter des sorts **cercle 4-5** (mécaniques
  EXISTANTES uniquement — damage/heal/buff/debuff + `area:'all'/'splash'`) :
  - c4 `resurrection` (water, heal fort), `meteore` (fire, damage `splash`)
  - c5 `armageddon` (neutral, damage `area:'all'` — masse), `resurrection-de-masse`
    (water, heal `area:'all'`)
  Locales FR/EN `spell.<id>`.
- **Invariant** : chaque niveau de guilde doit avoir ≥ `spellCount` sorts de son
  cercle (sinon le pool est incomplet). Nouveau test content de cohérence.

## Étapes / vérif

1. Données buildings.json (niv 4-5) + spells.json (4 sorts) + locales.
2. Test content `core-mage-guild.test.ts` : charge le core réel ⇒ pour chaque
   niveau `mageGuild`, `#spells(circle===level) ≥ spellCount` ; cercles 4 & 5
   non vides → `pnpm --filter @heroes/content test`.
3. `content:check`, parité FR/EN.
4. Vérifs : typecheck 5/5, lint, engine (golden inchangé — replay inline), content,
   build (< 800 Ko), garde-fous zéro-faction + couleurs, smoke (non-régression
   guilde/sorts). **Pas de bump save.**
5. Doc 02 §1.4 : Sagesse enfin utile (guilde 5 niveaux, cercles 4-5 livrés).
   Backlog H-SPELLS.2 : tranche guilde+cercles ✅ ; reste (aventure Vision/Rappel,
   invocation, chaîne, résurrection de pile entière) ⬜.

## Journal

- Plan créé ; exploration : `rollGuildSpells`/`learnGuildSpellsAtTown` déjà
  génériques (cercle = `effect.level`), Sagesse `learnCircle` 4/5 déjà branchée,
  mécanique testée avec un cercle 4 fictif. Guilde plafonnée à 3 + 0 sort c4-5 =
  seul trou. Schéma `mageGuild.level` sans max, `cost` sur ressources communes.
- **Livré** : buildings.json (guilde 5 niveaux), spells.json (4 sorts c4-5),
  locales FR/EN, test content `core-mage-guild.test.ts` (cohérence + cercles
  4/5 non vides + guilde monte à 5). **Zéro diff moteur** (mécanique préexistante).
- **Rebase** : main était rouge (typecheck `combat-silence.test.ts` TS2783, hérité
  de #277) — corrigé par une autre session (#280, commit `fix typecheck hérité`).
  Rebasé sur le main réparé (aa914d1) ; mes changements = données pures, aucun
  conflit.
- Vérifs vertes : typecheck 5/5, lint, engine **609** (golden + save-shape
  inchangés), content **119** (+3 `core-mage-guild`, parité), content:check 6
  paquets, build (gzip ≈ 302 Ko < 800), garde-fous zéro-faction (aucun `packages/`
  touché) + couleurs (aucun CSS touché), smoke guilde/sorts 4/4. **Pas de bump
  save, golden inchangé.**
- Doc 02 §1.4 + table §4.1 (guilde 5 niveaux) mises à jour ; backlog H-SPELLS.2 ✅.
