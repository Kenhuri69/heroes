# 03 — Faction : Haven (Havre)

## 1. Identité

| | |
|---|---|
| **Thème** | Empire humain chevaleresque, lumière, ordre, foi |
| **Fantasme joueur** | La légion disciplinée : des lignes de boucliers qui tiennent, des charges de cavalerie, des anges qui ressuscitent |
| **Style de jeu** | Défensif-économique en début de partie, boule de neige de moral et de soins, très accessible (faction « tutoriel ») |
| **Terrain natif** | Herbe |
| **Ressources clés** | Cristal + Gemmes |
| **École de magie affine** | Lumière (variante de l'école Eau/soutien au MVP : sorts de soin, bénédiction, protection) |
| **Couleurs / DA** | Blanc, or, bleu roi ; architecture gothique claire, bannières |

**Lore (résumé)** : le Saint-Empire du Griffon garde la frontière contre les ténèbres depuis la Première Éclipse. Ses armées mêlent conscrits fervents, ordres monastiques et créatures célestes invoquées par la foi collective.

## 2. Bonus de faction

- **Ferveur** : +1 moral permanent pour les unités Haven.
- **Formation** : les piles adjacentes à une autre pile alliée Haven gagnent +5 % défense (aura passive, non cumulable).
- Compétence de faction ajoutée au pool des héros Haven : **Prière de bataille** (Novice/Expert/Maître : 1 résurrection de X PV par combat sur une pile vivante).

## 3. Lineup d'unités (T1–T7)

| Tier | Unité | PV | Att | Déf | Dégâts | Vit. | Croiss./sem | Coût | Capacités |
|------|-------|----|-----|-----|--------|------|-------------|------|-----------|
| 1 | **Conscrit** | 6 | 2 | 3 | 1–2 | 4 | 14 | 30 or | `taunt` (attire les attaques adjacentes) |
| 2 | **Archer** | 10 | 4 | 3 | 2–4 | 4 | 9 | 80 or | `shooter(12)` |
| 3 | **Frère-Lame** | 18 | 6 | 8 | 3–5 | 5 | 7 | 150 or | `shieldWall` (défendre donne +50 % au lieu de +30 %) |
| 4 | **Griffon** | 30 | 8 | 7 | 5–9 | 7 | 5 | 300 or | `flying`, `unlimitedRetaliation` |
| 5 | **Prêtresse** | 36 | 9 | 10 | 7–11 | 5 | 4 | 500 or + 1 gemme | `shooter(8)`, `spellcaster(soin, ×2)` |
| 6 | **Chevalier du Griffon** | 70 | 14 | 14 | 12–20 | 8 | 2 | 1100 or + 1 cristal | `charge(+5 %/hex)`, `firstStrike` |
| 7 | **Ange** | 180 | 22 | 22 | 35–55 | 11 | 1 | 3200 or + 2 cristal + 2 gemmes | `flying`, `resurrectAlly(1×/combat)`, immunité au moral négatif |

Les **unités améliorées** (Conscrit → Hallebardier, etc.) sont spécifiées en Alpha ; le schéma de données les supporte dès le MVP (`upgradeOf`).

## 4. Arbre de bâtiments

Bâtiments communs : cf. doc 02 §4.1. Spécifiques Haven :

| Bâtiment | Coût | Prérequis | Effet |
|----------|------|-----------|-------|
| **Statue du Jugement** | 1000 or, 5 bois, 5 minerai | Hôtel de ville | +1 moral en combat pour la garnison et les héros visiteurs |
| **Cloître** | 2000 or, 5 minerai, 3 gemmes | Guilde des mages 1 | Les héros visiteurs apprennent `Bénédiction` ; +2 mana/j régénérés |
| **Écuries** | 1500 or, 10 bois | Habitation T4 | +400 pts de mouvement/j aux héros qui commencent leur tour dans la ville |

Chaîne d'habitations (prérequis) :

```
Fort ──► T1 Caserne ──► T2 Tour d'archers ──► T3 Monastère-lame ──► T4 Volière
                                    │                                   │
                        Guilde des mages 1 ──► T5 Chapelle ──► T6 Manège seigneurial ──► T7 Portail céleste
                                                                    (+ Château requis pour T7)
```

## 5. Héros types

| Classe | Orientation | Attributs (proba de gain A/D/P/S) | Compétences de départ |
|--------|-------------|------------------------------------|------------------------|
| **Chevalier** | Might | 30/30/20/20 | Commandement N, Armure N |
| **Clerc** | Magic | 15/25/30/30 | Magie de Lumière N, Sagesse N |

Héros nommés MVP : *Aldric* (Chevalier, spécialité : +1 vitesse Chevaliers du Griffon), *Séraphine* (Clerc, spécialité : Soin +50 %).
