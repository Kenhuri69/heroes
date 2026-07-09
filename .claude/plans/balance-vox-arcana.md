# Plan — Équilibrage Vox Arcana (faction:sim)

> `faction:sim` (budget or égal/tier, 120×2 combats/paire) révèle **Vox Arcana
> ~100 % vs toutes les factions** (4 déséquilibres béants). Faction fraîche (#148)
> jamais passée au sim (l'outil n'est pas un gate CI). Objectif : ramener Vox dans
> la bande **20-80 %** vs les 4 factions (idéalement vers 45-55 %).

## Diagnostic
Vox cumule 2 tireurs (T2 duelliste ammo12, T4 idole ammo10) + 3 volants
(T3, T5, T7) + `noRetaliation` (T7), sans faiblesse mêlée. T3 hippogriffe (hp25)
et T5 sombral (hp45) sont des **tanks volants sur-statés** vs la norme du tier.
Les valeurs de stats/coût sont des **valeurs de départ d'équilibrage** (doc 02
intro) — le levier sanctionné, aucune modif de doc/moteur.

## Nerfs (round 1, à itérer selon le sim)
- T3 hippogriffe : hp 25→17, def 6→5 (volant moins tanky).
- T4 idole (tireur) : ammo 10→6, atk 11→9, hp 38→32 (2ᵉ tireur moins oppressant).
- T5 sombral : hp 45→36, atk 12→11, dmg 8-13→7-11.
- T7 phénix : coût 2500→2900 or, hp 150→140 (volant+noRetal un peu cher).

## Vérif
- `pnpm faction:sim` : Vox dans 20-80 % vs les 4 (0 blowout impliquant vox).
- `pnpm test` + `content:check` verts (les stats sont validées par schéma).
- Hors périmètre (pré-existant, à signaler) : `arcane-hunters vs necropolis`
  (100/0) et `haven vs arcane-hunters` (89/11) — triangle intransitif antérieur
  à Vox ; suivi séparé pour ne pas gonfler cette PR.

## Résultat (livré)
Nerfs retenus (valeurs de départ, `data/factions/vox-arcana/units/`) :
- T1 choeur : coût 30→34.
- T2 duelliste : ammo 12→9, coût 90→100.
- T3 hippogriffe : hp 25→18, def 6→5, coût 180→200.
- T4 idole : hp 38→33, atk 11→10, ammo 10→7, coût 400→450.
- T5 sombral : hp 45→38, atk 12→11, dmg 8-13→7-11, coût 650→720.
- T7 phénix : hp 150→142, coût 2500→2750.

`faction:sim` **avant → après** (taux de victoire de Vox) :
`haven 99,6→47,9 · arcane 100→62,1 · necro 100→41,3 · sylvan 100→83,8`.
Vox passe de **4 déséquilibres béants (~100 %) à 1** (sylvan, marginal). Total
blowouts du panel **6→3**.

**Résiduel assumé** : `sylvan-vox` = 83,8 % — Vox (tir/vol) **hard-counter** la
fragilité de Sylvan ; aucun nerf uniforme de Vox ne le corrige sans casser ses 3
autres matchups déjà centrés, et un buff de Sylvan le rend OP partout (sim
ultra-sensible sur les unités bas-tier). RPS intrinsèque, +4 pts au-dessus du
seuil arbitraire de 80 %.

**Hors périmètre (pré-existant, suivi séparé)** : `arcane vs necropolis` (100/0)
et `haven vs arcane` (89/11) — triangle intransitif antérieur à Vox.

## Journal
- [x] Round 1/2 (trop faible / trop fort) → bisection
- [x] État calibré retenu (Vox centré vs haven/arcane/necro)
- [x] Tentatives sylvan-vox (nerf vox uniforme / buff sylvan) → régressives, abandonnées
- [x] content:check + tests verts
