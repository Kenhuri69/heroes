# LE4 — Magie & build du héros

> Lot LE4 du plan `game-experience-enrichment.md` (§4) : **F3** (pool de
> compétences élargi) → **F2** (la maîtrise d'école change l'effet du sort) →
> **C2** (mana persistante). Décisions adoptées par l'utilisateur le 2026-09-29
> (§5, points 5, 13 et 14) ; amendements de l'expert repris (§3.1 C2, §3.3 F2/F3).

## 1. Constat (lu dans le code)

- 16 compétences, dont 4 écoles de magie qui ne font que **baisser le coût en
  mana**. Aucune ne pilote les machines de guerre livrées (baliste, catapulte,
  tente de soins). Savoir n'a donc qu'un effet (mana max).
- La mana est **pleine à chaque combat** (`initHeroMana`, `combat/setup.ts`) et
  **à chaque aube** (`advanceSeat`, `core/engine.ts`). Elle n'est jamais une
  ressource : le Puits de magie et la régénération n'ont aucun sens.
- `faction:sim` est **aveugle à la magie** : ses héros de simulation n'ont ni
  Savoir, ni Pouvoir, ni sorts (`simHero`, `combat/simulate.ts`). La « lecture
  sim préalable » demandée par l'expert se fait donc au **bench IA** (sorts
  lancés, mana au début des combats, issue des parties), pas au sim (§4).

## 2. Décisions de conception

### F3 — sept compétences, que des effets branchés

| Compétence | Champ | Rangs | Branchement |
|---|---|---|---|
| Sorcellerie `sorcery` | `spellDamagePct` | 5 / 10 / 15 | dégâts des sorts du héros (résolution **et** préviz) |
| Intelligence `intelligence` | `manaMaxPct` | 25 / 50 / 100 | `heroManaMax` |
| Résistance `resistance` | `magicResistancePct` | 5 / 10 / 20 | `heroArmyMagicResistance` (ajouté à l'`armyMagicResistance` des artefacts) |
| Mysticisme `mysticism` | `manaRegenPerDay` | 2 / 3 / 4 | régénération quotidienne (C2) |
| Artillerie `artillery` | `warMachineDamagePct` | 50 / 100 / 150 | frappes des piles `warMachine` du camp (résolution et préviz) |
| Premiers soins `first-aid` | `firstAidHealPct` | 50 / 100 / 200 | soin `healPerRound` des piles du camp |
| Balistique `ballistics` | `siegeDamagePct` | 50 / 100 / 150 | dégâts de la catapulte aux remparts |

Reportés, notés : **Orientation** (réduction de pénalité de terrain). Elle
toucherait l'API de coût de pas (`stepCost`, `findPath` et leurs appelants), qui
ne connaît pas le héros. **Diplomatie** est rattachée à LE5 (ralliement des
neutres, A4).

### F2 — la maîtrise d'école change l'effet

- `SpellDef.mastery?: { rank: 1 | 2 | 3; base?; perPower?; area? }[]`. Au rang
  de maîtrise du héros dans l'école du sort (`heroSchoolMastery`), les
  surcharges des paliers atteints s'appliquent (le plus haut gagne). Aucune
  nouvelle règle de calcul : on ne réécrit que des champs existants.
- Helper unique `heroSpellDef(state, hero, spellId)` consommé par le lancer
  (`castHeroSpell`), la préviz (`estimateSpell`, `spellAffectedStacks`), l'IA de
  combat et le grimoire client ⇒ préviz = résolution.
- Les sorts d'unité (`spellcaster`) et les écoles sans compétence (neutre,
  écoles de faction) ne changent pas.
- Données : sorts de dégâts/soin des 4 écoles plus forts aux rangs 2 et 3 ;
  **Bouclier de pierre** et **Lenteur** deviennent de masse au rang 3 (canon
  HoMM III) ; **Brasier** et **Brouillard glacial** passent en zone. Les sorts
  qui ont déjà leur version de masse (Bénédiction, Hâte, Affaiblissement) ne
  changent pas.

### C2 — mana persistante (redéfinie par l'utilisateur le 2026-09-30)

> « Le mana ne se recharge pas après un combat, mais il faut des situations de
> recharge : chaque jour une quantité basée sur la stat du héros ; aller dans la
> ville recharge à 50 %, à 100 % avec la tour de magie ; des fontaines de mana
> sur la carte rechargent à 100 %. »

- Bloc opt-in `hero.mana { persistent, basePerDay, perKnowledge, townRestorePct }`
  (`hero/mana.ts`), absent ⇒ comportement actuel (fixtures et golden inchangés).
- **Aube** : `max(basePerDay, ⌊Savoir effectif × perKnowledge⌋)` + Mysticisme. La
  stat qui règle la mana max (Savoir × 10) règle aussi la recharge, qui vaut ~10 %
  du max. Intelligence augmente le max, pas la recharge : un héros Intelligence a
  plus à perdre, pas plus à regagner.
- **Ville** (y entrer, ou y commencer sa journée) : palier `townRestorePct` = 50 %
  du max, 100 % avec une Guilde des mages (la « tour de magie » ; détectée par le
  pool de sorts de la ville, sans id de bâtiment). Jamais de baisse ni de cumul.
  Événement `ManaRestored`, toast client.
- **Fontaine de mana** : visitable `restoreMana` à 100 %, nouvelle fréquence
  `oncePerHeroPerDay` (Puits de magie de HoMM III, une fois par jour).
- **Dérivé** : les cartes générées v2 posent 1 à 2 fontaines par tranche de 24²,
  hors rotation des lieux de bonus. Sous 50 % de mana (et avec des sorts),
  l'IA vise une fontaine à portée ou, sur plusieurs jours, une fontaine ou une de
  ses villes à Guilde. La carte d'objet s'appelle « Fontaine de mana ».
- Valeurs : `basePerDay: 1`, `perKnowledge: 1`, `townRestorePct: 50`.
- IA économe : en combat, l'IA ne lance plus de sort quand son camp domine
  largement (force ≥ 3× celle d'en face).

## 3. Étapes

1. [x] F3 — champs moteur + schéma + données + locales FR/EN ; tests par effet
   (échouent sans le branchement).
2. [x] F2 — `mastery` (moteur, schéma, loader, données) ; tests : rang 0 ⇒ sort
   de base, rang 3 ⇒ masse/base accrue ; préviz = résolution.
3. [x] C2 — bloc `hero.mana`, aube, combat, Guilde, IA ; tests ; activé en
   données.
4. [x] Mesures (§4) : bench IA avant/après ; `faction:sim` rejoué (doit être
   inchangé, aveugle à la magie).
5. [x] Docs 02 (§1.3, §1.4), CLAUDE.md ; vérifications (§5).

## 4. Mesures

**`faction:sim`** (terrain neutre) : **identique** à la sortie de LE2, avec la
même béance (AH vs Vox 19,2 %). C'est attendu : les héros du sim n'ont ni
Savoir, ni Pouvoir, ni sorts (§1), si bien que F2 et C2 ne l'atteignent pas.
Le sim ne permet donc pas de mesurer l'équilibrage de la magie ; il faudrait lui
donner des héros lanceurs (chantier d'outillage distinct, noté ici).

**Bench IA** (jetable, non commité ; 2 IA, 64², 20 graines, 60 jours, normal ;
F3 + F2 actifs dans les deux colonnes) :

| | Mana pleine à chaque combat/aube | Mana persistante |
|---|---|---|
| Sorts de combat par combat (médiane) | 3,22 | **1,75** |
| Sorts d'aventure lancés (8 graines) | 782 | **421** |
| Combats de gardien perdus par l'IA | 52 / 287 | 34 / 289 |
| Parties avec un combat entre joueurs | 7/20 | 2/20 |
| Villes de joueur capturées | 3/20 | 0/20 |

Lecture :
- La mana devient une ressource : l'IA lance deux fois moins de sorts, et
  surtout deux fois moins de **Marche forcée**. Elle se déplace donc moins, et
  les armées se croisent plus rarement.
- L'IA ne s'est pas affaiblie contre les neutres : elle perd même moins de
  combats de gardien. Elle s'y engage avec la même règle de force (marge 1,5×).
- Les effectifs sont petits (n = 20) : l'écart sur les rencontres (7 → 2) est
  une tendance, pas une mesure fine. La métrique « partie conclue » du bench
  n'est pas fiable : l'objectif `defeatHero` du point de vue du joueur 1 clôt la
  partie dès que son héros de départ tombe.
- **Non re-tuné** : la rareté de la mana est la décision adoptée (§5 du plan
  d'enrichissement). Deux leviers si la mi-partie paraît trop lente : baisser la
  réserve de mana de l'IA pour la Marche forcée, ou relever `pctPerDay`.

**Bench après la redéfinition utilisateur** (Savoir/jour, ville 50/100 %,
fontaines quotidiennes, IA qui va se recharger ; mêmes 20 graines) :

| | Mana pleine | Persistante v1 | **Persistante v2** |
|---|---|---|---|
| Sorts de combat par combat (médiane) | 3,22 | 1,75 | 1,57 |
| Sorts d'aventure (20 graines) | ~1 950 | ~1 050 | **1 164** |
| Recharges en ville / à une fontaine | — | — | 60 / 51 |
| Combats de gardien perdus par l'IA | 52 / 287 | 34 / 289 | 32 / 256 |
| Parties avec un combat entre joueurs | 7/20 | 2/20 | 1/20 |

L'IA va bien se recharger (111 recharges), et elle relance un peu plus de Marche
forcée qu'en v1. La mana reste rare, ce qui est voulu. Les rencontres entre
joueurs restent basses, et le bruit est fort sur 20 graines : 13 parties
s'arrêtent tôt, parce que le héros de départ du joueur 1 tombe contre un gardien
(`defeatHero`). Ce cas était déjà relevé en LE3, pour LE5/LE6.

## 5. Vérifications

- [x] `pnpm typecheck` · `pnpm lint` verts
- [x] `pnpm test` — moteur **1065** (+15), contenu **194** (+1), client 109, serveur 10 ; **golden inchangé**
- [x] `pnpm content:check` vert ; garde-fous faction et couleurs verts
- [x] `pnpm build` + budget : **381 079 o gzip** (après la redéfinition C2)
- [x] suite Playwright complète (après la redéfinition C2) : 143 verts + 1 instable (aide « ? ») + 1 échec `@perf` (carte throttlée ×4) en parallèle ; les deux repassent seuls (8,9 fps)

## 6. Journal

- 2026-09-30 : plan ouvert (branche repartie de `main` après la fusion de #552).
- 2026-09-30 : F3, F2, C2 livrés. Écarts :
  - Résistance porte un champ en % (`magicResistancePct`) plutôt que la
    fraction des artefacts, pour un libellé lisible.
  - Le Puits de magie rejoint les lieux de bonus des cartes v2 : sans lui, seule
    une ville à Guilde recharge.
  - Le grimoire affiche « (masse) » pour les sorts de zone `all`, jusqu'ici sans
    libellé.
  - Mesures §4 : le sim est aveugle à la magie ; le bench IA montre moins de
    déplacements.
- 2026-09-30 : **C2 redéfini par l'utilisateur** (PR #553 ouverte) : recharge
  quotidienne sur le Savoir, ville 50 % / 100 % avec Guilde, fontaines de mana
  quotidiennes. Dérivés : fontaines posées par le générateur v2, IA qui va se
  recharger, toast « la ville restaure la mana ». `pctPerDay` remplacé par
  `perKnowledge` ; le Puits de la rotation est retiré au profit des fontaines.
- 2026-09-30 : #553 fusionnée avec F3, F2 et la C2 d'origine ; la redéfinition C2
  part dans une nouvelle PR (même branche, `main` fusionnée).
