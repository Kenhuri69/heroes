# 03 — Faction : Haven (Havre)

> 🚧 **État 3.3 (implémentation)** : la faction Haven est livrée **100 % en
> données** (`data/factions/haven/`, zéro diff moteur/client — critère de
> modularité doc 11). **Livré** : lineup T1–T7 (stats §3 exactes), arbre
> d'habitations (7 dwellings + prérequis, §4), manifeste, ressources clés
> (Cristal/Gemmes), locales FR/EN, recrutement validé par test. **Toutes les
> capacités d'unité du lineup Haven sont désormais interprétées** (plus aucune
> donnée inerte).
> **Livré depuis** : `shieldWall` (Frère-Lame), `unlimitedRetaliation` (Griffon),
> `charge` (Chevalier du Griffon) en A2a ; `moraleImmune` (Ange, immunité au
> moral négatif) en A3a ; `taunt` (Conscrit, attire les frappes de mêlée
> adjacentes) en A2e ; `firstStrike` (Chevalier du Griffon, priorité d'initiative
> à vitesse égale) en A2g ; `spellcaster` (Prêtresse, soin embarqué ×2 —
> engine-first : lancé par l'IA/auto-combat, UI joueur différée) en A2h —
> interprétées par le moteur (catalogue = **27 capacités** génériques, doc 02
> §5.4) ; `resurrectAlly` de l'Ange (CAP-LIFE.1) **réalisé** via le `spellcaster`
> générique embarquant le sort `resurrection` (1×/combat, comme la Prêtresse
> soigne — données pures, aucun code moteur propre à l'Ange) ; côté Haven reste
> inerte
> la compétence de héros Prière de bataille **livrée** (F-SKILLS.2, engine-first) ;
> bâtiments spéciaux **livrés** : **Écuries** (F-BUILDEFF.1) et **Statue du
> Jugement** (F-BUILDEFF.2) via `heroAura`, **Cloître** (F-BUILDEFF.3) via
> `grantSpell` ; **école Lumière livrée** (F-SCHOOLS.1 — `spellSchool: "lumiere"`,
> 4 sorts Trait de Lumière/Aura Sacrée/Soin de Lumière/Châtiment Céleste réutilisant
> les kinds génériques, comme la Scène de Vox) ; classes et héros nommés
> Aldric/Séraphine (§5, pas de pipeline de héros par faction). Les capacités
> riches ci-dessus s'activeront quand le moteur ouvrira les points d'extension
> **génériques** correspondants (le mécanisme réel = capacités inline
> paramétrées par les données, cf. doc 06 §4 — il n'existe pas d'interface
> `AbilityModule`). Le mécanisme d'élite livré = **habitation niveau 2** (§3bis).
> Ce document reste la cible de design.

## 1. Identité

| | |
|---|---|
| **Thème** | Empire humain chevaleresque, lumière, ordre, foi |
| **Fantasme joueur** | La légion disciplinée : des lignes de boucliers qui tiennent, des charges de cavalerie, des anges qui ressuscitent |
| **Style de jeu** | Défensif-économique en début de partie, boule de neige de moral et de soins, très accessible (faction « tutoriel ») |
| **Terrain natif** | Herbe |
| **Ressources clés** | Cristal + Gemmes |
| **École de magie affine** | Lumière — **école propre livrée** (F-SCHOOLS.1, `spellSchool: "lumiere"`) : 4 sorts de soin/bénédiction/protection/châtiment réutilisant les kinds génériques (damage/heal/buff) |
| **Couleurs / DA** | Blanc, or, bleu roi ; architecture gothique claire, bannières |

**Lore (résumé)** : le Saint-Empire du Griffon garde la frontière contre les ténèbres depuis la Première Éclipse. Ses armées mêlent conscrits fervents, ordres monastiques et créatures célestes invoquées par la foi collective.

## 2. Bonus de faction

> ✅ **Livré (F-BONUS)** : Ferveur + Formation via la variante générique
> `combatBonus` du manifeste (`factionBonuses: [{ type:'combatBonus', morale:1,
> defense:2 }]`), interprétée en combat par les helpers par-camp du moteur (moral,
> défense) — **zéro nom de faction**. **Écart assumé** : Formation est modélisée
> en **points de Défense plats** (`defense: 2` ≈ +5 % via la pente 2,5 %/pt) sur
> **toute l'armée** du héros Haven, et non comme une aura conditionnée à
> l'adjacence (simplification générique ; magnitude fidèle). La variante
> `combatBonus` porte aussi un champ `attack` (offensif) réservé.

- **Ferveur** : +1 moral permanent pour les unités Haven.
- **Formation** : +5 % défense pour l'armée Haven (livré en points plats, cf. note).
- Compétence de faction ajoutée au pool des héros Haven : **Prière de bataille** (Novice/Expert/Maître : 1 résurrection de 30/60/100 PV par combat sur une pile alliée). *(livrée, F-SKILLS.2 — engine-first : point d'extension générique `SkillRankEffect.battleResurrectHp` + action de héros `HeroRally` gatée par la compétence, 1×/combat, cœur `resurrectStack` partagé avec le sort de soin ; pilotée par l'IA/auto-combat, UI joueur différée comme `spellcaster`. `CombatState.heroRallyUsed` optionnel ⇒ pas de bump save, golden inchangé. Compétence gatée Haven via `manifest.heroSkills`.)*

## 3. Lineup d'unités (T1–T7)

| Tier | Unité | PV | Att | Déf | Dégâts | Vit. | Croiss./sem | Coût | Capacités |
|------|-------|----|-----|-----|--------|------|-------------|------|-----------|
| 1 | **Conscrit** | 6 | 2 | 2 | 1–2 | 4 | 14 | 40 or | `taunt` (attire les attaques adjacentes) |
| 2 | **Archer** | 10 | 4 | 3 | 2–4 | 4 | 9 | 95 or | `shooter(12)` |
| 3 | **Frère-Lame** | 18 | 6 | 6 | 3–5 | 5 | 7 | 185 or | `shieldWall` (défendre donne +50 % au lieu de +30 %) |
| 4 | **Griffon** | 30 | 8 | 7 | 5–9 | 7 | 5 | 360 or | `flying`, `unlimitedRetaliation` |
| 5 | **Prêtresse** | 36 | 9 | 8 | 7–11 | 5 | 4 | 640 or + 1 gemme | `shooter(8)`, `spellcaster(soin, ×2)` |
| 6 | **Chevalier du Griffon** | 70 | 14 | 11 | 12–20 | 8 | 2 | 1300 or + 1 cristal | `charge(+5 %/hex)`, `firstStrike` |
| 7 | **Ange** | 180 | 22 | 18 | 35–55 | 11 | 1 | 3200 or + 2 cristal + 2 gemmes | `flying`, `resurrectAlly(1×/combat)` (réalisé `spellcaster(resurrection, ×1)`), immunité au moral négatif |

> ⚖️ **Équilibrage (Alpha 4.17)** : première passe via `faction:sim` (auto-combats
> à valeur d'or égale). Havre était strictement dominant (100 % vs Necropolis et
> Arcane Hunters) : défenses ramenées au niveau des autres maisons (T1/T3/T5/T6/T7)
> et coûts en or rehaussés (T1–T6, faction sous-coûtée). Résultat : plus aucun
> déséquilibre béant (Havre ~55–66 % vs les deux autres). Réglage fin vers 45–55 %
> = itérations ultérieures avec l'outil.

### 3bis. Unités élites (habitation niveau 2)

Chaque habitation se **gradue au niveau 2** (Alpha 4.11) : le dwelling amélioré débloque la variante élite. Le mécanisme réel est le **dwelling niveau 2**, pas un champ `upgradeOf`. La base **et** l'élite restent recrutables (façon HoMM, cf. D3) ; la commande `UpgradeUnits` convertit en plus une pile de base déjà recrutée.

| Tier | Élite | PV | Att | Déf | Dégâts | Vit. | Cr./sem | Coût | Capacités |
|------|-------|----|-----|-----|--------|------|---------|------|-----------|
| 1 | **Hallebardier** | 8 | 3 | 4 | 2–3 | 5 | 14 | 50 or | — |
| 2 | **Archer d'Élite** | 13 | 5 | 4 | 3–5 | 5 | 9 | 140 or | `shooter` |
| 3 | **Templier** | 23 | 8 | 10 | 4–7 | 6 | 7 | 260 or | — |
| 4 | **Griffon Royal** | 39 | 10 | 9 | 7–12 | 8 | 5 | 520 or | `flying` |
| 5 | **Grande Prêtresse** | 47 | 12 | 13 | 9–14 | 6 | 4 | 850 or, 2 gemmes | `shooter` |
| 6 | **Champion du Griffon** | 91 | 18 | 18 | 16–26 | 9 | 2 | 1900 or, 2 cristal | — |
| 7 | **Archange** | 234 | 29 | 29 | 46–72 | 12 | 1 | 5400 or, 3 cristal, 3 gemmes | `flying` |

> ⚖️ **Coûts élites (D12, à arbitrer)** : premium en or élite/base = 1,25–1,69× (moyenne ~1,44×), variable selon le tier. À comparer avec Necropolis (~1,6–1,7×, régulier) et Arcane Hunters (**1,80× uniforme**) — asymétrie relevée par l'audit factions. À revoir aussi : certaines élites **perdent la capacité signature** de leur base (Hallebardier sans `taunt`, Templier sans `shieldWall`, Champion sans `charge`/`firstStrike`). Arbitrage coûts + parité de capacités **renvoyé à une passe `faction:sim`** (non tranché ici).

## 4. Arbre de bâtiments

Bâtiments communs : cf. doc 02 §4.1. Spécifiques Haven :

| Bâtiment | Coût | Prérequis | Effet |
|----------|------|-----------|-------|
| **Statue du Jugement** | 1000 or, 5 bois, 5 minerai | Hôtel de ville | +1 moral en combat pour la **garnison** — **livré** (F-BUILDEFF.2, `heroAura combatMoraleBonus`). Volet « héros visiteurs » (héros défenseur en siège) différé avec le modèle de héros défenseur |
| **Cloître** | 2000 or, 5 minerai, 3 gemmes | Guilde des mages 1 | Les héros visiteurs apprennent `Bénédiction` — **livré** (F-BUILDEFF.3, `grantSpell`). +2 mana/j **différé/réconcilié** : la mana se restaure entièrement chaque jour (§1.4), un regen quotidien serait un no-op |
| **Écuries** | 1500 or, 10 bois | Habitation T4 | +400 pts de mouvement/j aux héros qui commencent leur tour dans la ville — **livré** (F-BUILDEFF.1, effet `heroAura`) |

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

> **État livré (H-NAMED.1)** : **Aldric** & **Séraphine** sont **jouables en jeu** —
> fiches `data/factions/haven/heroes/{aldric,seraphine}.json` (convention 16.9,
> `manifest.heroes`) **étendues des champs gameplay** de `heroIdentitySchema`
> (`attributes`, `specialtyEffect`, `startingSkills`, `startingSpells`). Aldric
> (Might : *Meneur* +1 moral, Commandement/Armure) ; Séraphine (Magic : *Liturgiste*
> −15 % coût mana, Sagesse, sorts de Lumière de départ). Un `PlayerSetup.startingHeroId`
> résout cette identité à la création (via `StartGame.heroRoster`, embarqué comme
> `houseCatalog` — `buildHeroRoster` n'expose QUE les fiches portant `attributes`).
> **Différés** : profil de **gain d'attribut par classe** (reste global), **spécialités
> conditionnelles** du doc (+vitesse Griffons / Soin +50 % — rendues par des spécialités
> exprimables), choix du héros nommé de départ à « Nouvelle partie » (H-NAMED.2).
>
> **État livré (M-TAVERN.2 — héros canon)** : le roster Haven compte **5 héros**
> recrutables à la Taverne — les 2 originaux ci-dessus + **3 héros canon du jeu
> d'origine** (`origin: "canon"`, `source: "Might & Magic"`, univers Ashan) :
> **Anton** (Might, duc de Griffon — *Protecteur du Duché*, +2 Défense de
> garnison via l'effet town-scoped `garrisonDefense`), **Freyda** (Might,
> chevalière — *Charge de cavalerie*, +10 % dégâts de mêlée), **Isabel** (Magic,
> reine — *Trésor impérial*, +250 or/jour ; sorts de Lumière de départ).
> Fiches `heroes/{anton,freyda,isabel}.json`, **portraits dédiés** stagés
> (`assets/heroes/haven-<id>.png`, Règle B doc 12 §3) et affichés partout où
> l'avatar apparaît (tiroir, Taverne, pré-combat, combat — M-TAVERN.3).
