# Lot — Équilibrage (passe 1) : correction de l'outlier Dungeon T7

> Direction « go polish gameplay ». `faction:sim` (4000 or/tier, 120×2 combats)
> révèle **5 déséquilibres béants** (hors 20–80 %) : Dungeon écrase Necropolis
> (86 %), AH (69 %) et Haven (64 %) ; Vox écrase AH (97 %) et Dungeon (85 %) ;
> AH↔Sylvan/Necro très swingy. **Données pures, golden-safe** (le golden utilise
> des unités synthétiques `golden-grunt`/`golden-archer`, pas les unités de
> faction ⇒ un changement de stats de faction ne touche pas le hash).

## Constat objectif (levier de la passe 1)

Le **Dragon d'Ombre** (Dungeon T7) est un **outlier de stats** : Attaque **27** /
Défense **25**, là où TOUS les autres T7 sont à ~18–20 / 17–20 (Necro 20/20, AH
18/18, Vox 19/17). C'est ~+35 % Att / +25 % Déf au-dessus de la norme — cause
probable de la domination de Dungeon sur Necro/AH/Haven. Correction d'**outlier**
(pas un nerf arbitraire pour viser un winrate) : ramener Att/Déf dans la bande,
en gardant un léger premium (le dragon a `magicResistance`+`fear`). Dégâts (32–42)
laissés tels quels (dans la bande — Necro dragon 30–50).

## Changement

- `t7-dragon-ombre` : Att 27→**22**, Déf 25→**21** (hp/dmg/spd inchangés).
- `t7-dragon-ombre-elite` : Att 29→**24**, Déf 27→**23** (parité ~1,25× préservée).

## Critère de succès (mesuré)

`faction:sim` : **réduire le nombre de déséquilibres béants** (idéalement
Dungeon↔Necro/AH/Haven rentrent sous 80 %) **sans en créer de nouveau** ;
`balance.test` (cap 85 %) reste vert. Si la passe n'améliore pas nettement, on
revert.

## Vérification

- typecheck, lint, garde-fous, content:check (élite-parité tient : on ne baisse
  aucune capacité), tests contenu, tests moteur (**golden inchangé** — unités
  synthétiques), build, bundle, smoke @core.
- `faction:sim` avant/après (mesure).

## Portée

Passe 1 = l'outlier le plus net (défendable objectivement). Les autres béances
(Vox trop fort, AH swingy) n'ont **pas** d'outlier de stats évident ⇒ leur
correction relèverait d'un tuning arbitraire (décision design) — à arbitrer avec
l'utilisateur après cette passe mesurée.

## Résultat mesuré (faction:sim)

Déséquilibres béants **5 → 4** (net −1). Détail Dungeon :
- necropolis vs dungeon **86 % → 70 %** ✅ (n'est plus béant)
- arcane-hunters vs dungeon **69 % → 52 %** ✅ (sain)
- haven vs dungeon 64 % → 70 % (⚠, non béant)
- vox vs dungeon 85 % → 93 % (déjà béant, approfondi — Dungeon plus faible ⇒
  Vox le domine plus). `balance.test` (cap 85 %) reste **vert**.

**Conclusion** : la correction d'outlier est un gain net objectif. Elle expose que
**Vox est la vraie faction trop forte** (écrase AH 97 %, Dungeon 93 %) et **AH est
swingy** (écrase Necro 92 %, écrasée par Vox/Sylvan) — SANS outlier de stats ⇒
tuning subjectif à arbitrer avec l'utilisateur (passe 2). Passe 1 livrée telle
quelle.
