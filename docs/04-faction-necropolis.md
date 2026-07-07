# 04 — Faction : Necropolis (Nécropole)

> 🚧 **État 3.4 (implémentation)** : faction livrée en données
> (`data/factions/necropolis/`) + **ouverture d'UN point d'extension moteur
> générique** (test de modularité n°1, doc 11 §3.4). **Livré** : lineup T1–T7
> (stats §3, toutes `undead`), arbre d'habitations, locales, et surtout la
> **Nécromancie déclarative** — effet de faction `raiseUndeadOnVictory`
> interprété par le moteur à la fin d'un combat gagné (relève un % des PV
> **vivants** ennemis tués en `t1-squelette`, plafonné `capBase +
> capPerExisting × effectif`), **sans que le moteur connaisse la faction**
> (piloté par le manifeste, appliqué via `factionCatalog`/`hero.factionId`).
> **Différé** : scaling de la Nécromancie par la compétence (Novice/Expert/
> Maître 10/15/20 %) + bâtiment Amplificateur (§2/§4) — effet **plat** en
> données au MVP (15 %) ; capacités spéciales `curseOnHit`/`incorporeal`/
> `lifeDrain`/`areaAttack`/`charge`/`aura`/`breathAttack`, bâtiments spéciaux,
> « Fléau persistant », école Prime, héros nommés (Vhalen/Mère Corbeau).
> Terrain natif : `swamp` (« terre morte » n'existe pas dans les terrains du
> MVP). `raiseUndeadOnVictory` est le SEUL point d'extension ouvert. Ce
> document reste la cible de design.

## 1. Identité

| | |
|---|---|
| **Thème** | Morts-vivants, culte de l'Araignée, froide éternité |
| **Fantasme joueur** | La marée inarrêtable : chaque bataille grossit l'armée, l'attrition ne s'applique qu'à l'adversaire |
| **Style de jeu** | Attrition, quantité, immunités ; faible moral adverse exploité ; snowball par la Nécromancie |
| **Terrain natif** | Terre morte |
| **Ressources clés** | Soufre + Gemmes |
| **École de magie affine** | Nécromancie/Prime (variante Terre au MVP : affaiblissement, animation, drain) |
| **Couleurs / DA** | Noir, vert spectral, os blanchi ; architecture de flèches et cryptes |

**Lore (résumé)** : les Nécromanciens d'Heresh vénèrent Asha sous son aspect de Mort. Pour eux, la non-vie est la purification ultime des passions. Chaque champ de bataille est une moisson.

## 2. Bonus et mécaniques de faction

- **Morts-vivants** : toutes les unités ont `undead` — insensibles au moral (le leur est toujours 0), aux poisons/peurs ; infligent −1 moral aux armées vivantes adverses.
- **Nécromancie** (compétence de faction, signature) : après chaque victoire **en tant qu'attaquant** (remédiation D2 : aucun combat n'a de héros défenseur aujourd'hui — l'extension au défenseur vainqueur suivra la boucle « héros en défense »), relève en **Squelettes** un pourcentage des PV des créatures vivantes ennemies tuées — Novice 10 %, Expert 15 %, Maître 20 % (+ bâtiment Amplificateur). Plafonné par bataille à `2 × effectif **restant** de squelettes + 20` (D7 : le cap lit l'effectif restant après combat, pas l'effectif initial) pour éviter l'explosion exponentielle (levier d'équilibrage en données).
- **Fléau persistant** : les sorts de malédiction lancés par des héros Necropolis durent +1 round.

## 3. Lineup d'unités (T1–T7)

| Tier | Unité | PV | Att | Déf | Dégâts | Vit. | Croiss./sem | Coût | Capacités |
|------|-------|----|-----|-----|--------|------|-------------|------|-----------|
| 1 | **Squelette** | 5 | 2 | 2 | 1–2 | 4 | 16 | 25 or | `undead` ; croissance ↑ via Nécromancie |
| 2 | **Zombie putride** | 14 | 3 | 4 | 2–3 | 3 | 9 | 70 or | `undead`, `curseOnHit(Affaiblissement, 20 %)` |
| 3 | **Spectre** | 16 | 5 | 5 | 3–5 | 7 | 7 | 160 or | `undead`, `flying`, `incorporeal` (20 % d'esquive) |
| 4 | **Vampire** | 28 | 8 | 7 | 5–8 | 6 | 5 | 320 or | `undead`, `noRetaliation`, `lifeDrain(50 %)` (soigne/relève sa pile) |
| 5 | **Liche** | 34 | 9 | 10 | 7–11 | 5 | 4 | 550 or + 1 soufre | `undead`, `shooter(10)`, `areaAttack(nuage 1 hex, épargne les morts-vivants)` |
| 6 | **Cavalier funeste** | 65 | 14 | 12 | 12–18 | 9 | 2 | 1150 or + 1 soufre | `undead`, `curseOnHit(Faux funeste : −20 % dégâts, 100 %)`, `charge(+4 %/hex)` |
| 7 | **Dragon d'os** | 160 | 20 | 20 | 30–50 | 10 | 1 | 3000 or + 2 soufre + 2 gemmes | `undead`, `flying`, `aura(−1 moral ennemi, portée totale)`, `breathAttack` |

## 4. Arbre de bâtiments

Spécifiques Necropolis :

| Bâtiment | Coût | Prérequis | Effet |
|----------|------|-----------|-------|
| **Amplificateur nécromantique** | 1500 or, 5 minerai, 2 soufre | Guilde des mages 1 | +5 % à la Nécromancie de tous les héros du joueur (cumulable entre villes, plafonné +15 %) |
| **Croisée des âmes** | 1000 or, 5 bois, 5 minerai | Fort | Convertit des créatures vivantes recrutables en squelettes (taux 1:1 en PV, arrondi bas) |
| **Puits d'ombre** | 2000 or, 3 gemmes, 3 soufre | Guilde des mages 2 | +3 mana/j aux héros visiteurs ; les sorts de malédiction coûtent −20 % en défense de ville |

Chaîne d'habitations :

```
Fort ──► T1 Cimetière ──► T2 Fosse commune ──► T3 Tour hantée ──► T4 Domaine du sang
                                     │                                  │
                         Guilde des mages 1 ──► T5 Mausolée ──► T6 Écurie funeste ──► T7 Ossuaire draconique
                                                                     (+ Château requis pour T7)
```

## 5. Héros types

| Classe | Orientation | Attributs (A/D/P/S) | Compétences de départ |
|--------|-------------|----------------------|------------------------|
| **Chevalier de la mort** | Might | 30/25/20/25 | Nécromancie N, Attaque au corps N |
| **Nécromancien** | Magic | 15/15/30/40 | Nécromancie N, Magie Prime N |

Héros nommés MVP : *Vhalen* (Chevalier de la mort, spécialité : Vampires +1 att/déf par 2 niveaux), *Mère Corbeau* (Nécromancienne, spécialité : Nécromancie +2 %/niveau).

## 6. Notes d'équilibrage

- La Nécropole doit gagner **en jouant beaucoup de combats** : ses unités coûtent ~10 % de moins mais ses tiers 1–3 sont individuellement plus faibles que Haven.
- Levier anti-snowball principal : le plafond de Nécromancie par bataille (donnée `necromancy.capFormula`).
- L'immunité au moral est forte contre Haven (qui joue le moral) — c'est le matchup asymétrique voulu ; le contre de Haven est la résurrection et le burst du T7.
