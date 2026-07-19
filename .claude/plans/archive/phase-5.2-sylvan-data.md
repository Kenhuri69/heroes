# Plan — Beta 5.2 : données de la faction Sylvan Court

> Suite du cadrage 5.1 (doc 14). Livre la **faction en données pures** — 4ᵉ test
> de modularité, **zéro diff moteur**. Symbiose (point d'extension) au lot 5.3.

## Décisions constatées (écarts au cadrage 5.1)
- **Terrain natif `water`** (et non `grass`) : la 4ᵉ maison native de l'herbe
  entrerait en collision avec l'identification **par propriété** de Haven dans
  `faction-recruit.test.ts` (`nativeTerrain==='grass' && 7 tiers`). `water` garde
  chaque maison distinguable **sans nom en dur** (respect du garde-fou). Lore
  aligné (forêt liée au fleuve/sources). Doc 14 §1 corrigé.
- **Capacités existantes uniquement** hors Symbiose : T4 Loup = `doubleAttack`
  (au lieu d'`unlimitedRetaliation` inexistant), T5 Licorne sans capacité (pas de
  `magicResistance`), T6 Tréant Symbiose seule (pas de `taunt`). Tient la promesse
  « **1 module moteur total** » (doc 14 §9). Doc 14 §3 corrigé.
- **Unités Symbiose (T3/T6/T7) livrées à `abilities: []`** : lineup complet &
  recrutable dès 5.2 ; la capacité `symbiosis` (en **données**) arrive avec le
  module moteur (5.3).
- **14 unités** (7 base + 7 `-elite`, upgrades Alpha 4.11) ; dwellings `maxLevel:2`.
- **Bâtiment propre `heart-grove` différé (5.4)** : 5.2 suit le patron minimal de
  Haven (dwellings + communs). Doc 14 §4 corrigé.

## Lots
- [x] `data/factions/sylvan-court/` : manifeste, 14 unités, `buildings.json`
  (7 dwellings), locales FR/EN.
- [x] `data/factions/index.json` : ajout `sylvan-court`.
- [x] `faction-recruit.test.ts` : bloc 4ᵉ faction (identifiée eau + 7 tiers) —
  chargement, stats/capacités, recrutement des 7 tiers de base.
- [x] Smoke : liste des factions attendue mise à jour (5 paquets).
- [x] Doc 14 (États 5.1/5.2 + corrections) + plan.

## Vérifications
Typecheck 4/4, lint, **284 tests moteur** (golden intact), **73 tests contenu**
(+3 Sylvan), `content:check` (5 paquets), garde-fou faction vert (grep local),
build, smoke desktop + mobile.

> **Équilibrage NON fait ici (lot 5.4)** : `faction:sim` montre Sylvan hors bande
> (Necro↔Sylvan 99.6 %, Arcane↔Sylvan 86 %) — attendu, l'outil n'est pas un gate
> CI ; le réglage stats/coûts se fait au lot finitions.

## Journal
- **2026-07-06** — Après merge #77 (cadrage 5.1). Base = `origin/main` (3684b92).
  Données Sylvan livrées ; tout vert (hors équilibrage, réservé 5.4).
