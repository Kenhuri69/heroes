# Plan — Lot 5.4 : équilibrage Sylvan Court + Bosquet du Cœur + finitions

Dernier lot de la 4ᵉ faction (Beta). Trois volets :
1. **Équilibrage** via `faction:sim` (données pures : stats/coûts des unités).
2. **Bosquet du Cœur** (`heart-grove`) : bâtiment propre à `growthBonus`
   (effet **générique** existant, zéro code moteur).
3. **Finitions** : docs à jour, vérification complète.

## Baseline `faction:sim` (avant réglage)

```
⚠ haven          vs arcane-hunters —  65.8 / 34.2
⚠ haven          vs necropolis     —  56.7 / 43.3
⚠ haven          vs sylvan-court   —  26.3 / 73.8   (Sylvan trop fort)
✓ arcane-hunters vs necropolis     —  53.8 / 46.3
✗ arcane-hunters vs sylvan-court   —  82.1 / 17.9   (Sylvan trop faible — blowout)
✗ necropolis     vs sylvan-court   —   0.0 / 100.0  (Sylvan trop fort — blowout)
```

**Constat clé** : la Symbiose (5.3) ne pèse presque rien dans le sim (l'IA ne
Défend qu'en dernier recours) — pré-Symbiose (#78) le sim donnait déjà
Necro↔Sylvan 99.6 % et Arcane↔Sylvan 86 %. L'écart est donc **stats/coûts**,
pas la capacité. Le sim ne compte que le coût **en or** (`recruitCost.gold`),
`floor(4000/or)` exemplaires par tier.

**Non-transitivité** : Sylvan écrase Necro/Haven mais s'effondre contre Arcane
(marks/exécuteur/tir). Un simple levier de puissance uniforme déplace les trois
matchups dans le même sens et ne peut pas résorber les deux blowouts opposés à
la fois. Objectif réaliste et **gate réel** de l'outil : **supprimer les
déséquilibres béants** (tout ramener dans 20–80 %) ; se rapprocher de 45–55 %
au mieux. `faction:sim` n'est **pas** un gate CI (garde-fou d'alerte).

## Étapes

1. Réglage itératif des stats/coûts Sylvan (base + elite cohérents) → re-run
   `faction:sim` après chaque passe, consigner les taux.
   → vérif : 0 blowout (idéalement), écarts consignés.
2. Bosquet du Cœur `heart-grove` : bâtiment `growthBonus` dans
   `buildings.json` + `manifest.town.buildings` + locales FR/EN.
   → vérif : `content:check` vert, arbre de bâtiments résolu.
3. Docs : doc 14 (État 5.4, Bosquet du Cœur), roadmap 09 (5.4 ✅ / Sylvan
   complète).
4. Vérification par lot complète.

## Résultat du réglage (`faction:sim`, données appliquées)

```
⚠ haven          vs sylvan-court —  55.4 / 44.6
⚠ arcane-hunters vs sylvan-court —  55.4 / 44.6
⚠ necropolis     vs sylvan-court —  42.5 / 57.5
faction:sim — 0 déséquilibre(s) béant(s).   (exit 0)
```

Plan retenu = **C3** (deltas sur base + elite) :
- T1 hp −1 ; T2 att +1
- T3 hp −4, déf −3, vit +1, att +1
- T5 hp −9, déf −3, vit +1, att +1
- T6 hp −19, déf −4, vit +2, att +2
- T7 hp −40, déf −4, vit +1, att +2, dégâts −2
- T4 inchangé

## Décisions / écarts

- **Banc d'essai jetable** `packages/tools/src/sylvan-tune.ts` (sweep en mémoire,
  supprimé après réglage). ~30 combinaisons testées.
- **La Symbiose ne pilote pas le sim** (l'IA défend rarement) → l'écart était
  stats/coûts. Confirmé par la comparaison pré-Symbiose (#78 : 99.6 %/86 %).
- **Non-transitivité** : correction impossible par levier de puissance uniforme.
  La bascule tanky→agile corrige les deux blowouts opposés à la fois.
- **Contrainte dure** : re-ralentir T6/T7 ré-effondre Arcane (~5 %) et rouvre
  Necro (~85 %). Les grands anciens **doivent** être mobiles → profil doc 14 §3
  révisé + lecture narrative (anciens *striders*).
- **Sensibilité aux falaises** : le sim est fortement non-monotone (l'ordre des
  morts bascule) ; +25 %/+40 % or effondrait tout. Réglage par stats, pas par or.
- Autres factions **non touchées**.

## Vérification par lot (obligatoire)

- [x] typecheck 4/4
- [x] tests moteur (golden intact)
- [x] tests content (recrutement Sylvan ok)
- [x] `content:check` (42 bâtiments, +Bosquet du Cœur)
- [x] garde-fou faction (grep CI local)
- [x] build client (< 800 Ko gzip)
- [x] smoke desktop + mobile
- [x] `faction:sim` — 0 blowout
