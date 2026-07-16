# 17 — Nouvelle Maison : Dungeon (« le Donjon »)

> **Cadrage de la 5ᵉ faction jouable** : le **Donjon** (*Dungeon*), la maison des
> **elfes noirs** de Heroes of Might & Magic. Nom repris tel quel de HoMM
> (français : « Donjon » ; anglais : « Dungeon »). Peuple souterrain de cavernes,
> de cultes du serpent et de sorciers-suzerains, pendant sombre des elfes
> sylvestres de la **Sylvan Court** (doc 14).
>
> Ce document remplit le gabarit `docs/templates/faction-template.md` et suit la
> structure de la doc 16 (Vox Arcana). Il est la **source de vérité de design**
> avant `pnpm faction:new dungeon` (checklist doc 06 §5). Choix de design
> **réversibles** tant qu'aucune donnée n'est écrite.

## 1. Identité

| | |
|---|---|
| **Thème** | Elfes noirs souterrains : cavernes, cultes du serpent, sorciers-suzerains (le *Dungeon* de HoMM) |
| **Fantasme joueur** | « Ma magie ne connaît pas de rempart, et mes tueurs frappent avant qu'on les voie. » |
| **Style de jeu** | Tempo agressif + **suprématie magique** : sorts destructeurs à cercle élevé, unités rapides sans riposte, glass-cannon assumé |
| **Faiblesse assumée** | Fragile en PV/défense (peu de tanks hors Minotaure/Hydre) ; s'effondre contre une faction qui **encaisse le premier tour** et la force à l'attrition longue (Necropolis, Haven en formation) ; dépendante du héros-sorcier (si la magie est neutralisée, le lineup manque de coffre) |
| **Terrain natif** | `rough` (badlands / cavernes affleurantes — équivalent souterrain) |
| **Ressources clés** | `sulfur` + `gems` (soufre des profondeurs + gemmes de pouvoir arcanique — le soufre est la rare historique du Donjon dans HoMM) |
| **École de magie** | Réutilise les écoles destructrices existantes (`fire`, `neutral`) ; **école propre `ombre` différée** à un sous-lot ultérieur (comme `traque`/`scene`) |
| **Couleurs / DA** | Violet sombre, noir, éclats de magenta arcanique ; motif de bannière : serpent lové (motif non chromatique, `FactionBadge`) |

**Lore (5–10 lignes)** : Bannis sous la surface après une trahison antique, les
elfes noirs ont troqué la lumière des cimes contre le pouvoir brut des
profondeurs. Leurs **Suzerains** (Overlords) règnent par la crainte ; leurs
**Sorciers d'Ombre** (Warlocks) ont appris à arracher à la magie destructrice
tout ce que les autres écoles bridaient — leurs sorts **ignorent les
protections**. La société du Donjon est une hiérarchie d'assassins, de furies
fanatiques et de bêtes domestiquées dans le noir : minotaures gardiens, hydres à
têtes multiples, dragons d'ombre qui aspirent la lumière. Ils voient dans le
sceau de Cendregarde non une menace mais une **serrure** : ce qui enferme peut
être retourné en arme.

## 2. Mécanique signature (UNE seule) — **Magie Irrésistible**

**Description.** Les sorts **de dégâts** lancés par un héros du Donjon (a)
**ignorent une fraction de la résistance magique GRADUÉE** de la cible
(`magicResistance`) et (b) reçoivent un **bonus de puissance** (+X % de dégâts).
C'est l'identité *Dungeon / Irresistible Magic* de HoMM : le sorcier elfe noir
est la meilleure artillerie magique du jeu. **L'immunité TOTALE aux sorts**
(`spellImmune`, ex. Dragon d'ombre élite) **reste un bloc de ciblage entier** :
total = total, la signature ne pierce que la résistance partielle.

**Contre-jeu adverse.** Réduire la **mana** disponible (courses longues, déni
d'or → moins de Guilde), tuer/immobiliser le héros-sorcier, ou **encaisser** :
la signature ne touche que la magie, pas les statistiques d'armée — une faction
qui survit au barrage initial affronte ensuite un lineup fragile. Les sorts non
offensifs (buffs/soins) ne bénéficient d'aucun bonus.

**Plafond anti-snowball (obligatoire).** Le bonus est **plat et borné** (pas
d'effet cumulatif de partie) : +% fixe défini en données (`spellBonusPercent`),
et le contournement de résistance est **une fraction bornée** (`resistancePierce`
∈ [0,1], plafonnée à 1) de la seule résistance **graduée** — l'immunité **totale**
n'est jamais franchie. Aucune boucle de croissance : la puissance vient du
Savoir/Pouvoir du héros, déjà plafonnés par la courbe de niveau. **Valeurs
livrées** : `spellBonusPercent: 30`, `resistancePierce: 0.5`.

**Points d'extension nécessaires — UN, générique.**
- Nouveau **type de `factionBonus` déclaratif** : `irresistibleMagic`
  (`{ type, spellBonusPercent, resistancePierce }`), rangé dans
  `engine/faction` à côté de `raiseUndeadOnVictory` / `combatBonus`.
- **Interprétation** : dans le chemin de résolution de sort de combat
  (`CastSpell` / `castHeroSpell`), lorsque le héros lanceur porte ce bonus (via
  `hero.factionId` → `factionCatalog`, **jamais** `if (faction === …)`), les
  dégâts sont majorés de `spellBonusPercent` et la réduction de résistance de la
  cible est atténuée de `resistancePierce`.
- **Zéro nom de faction dans le moteur** : le garde-fou CI (IDs dérivés de
  `data/factions/index.json`) reste vert ; le seul diff moteur admis est
  l'ouverture de ce point générique, exercé par le manifeste.
- **Save** : le bonus est du contenu (manifeste), pas de l'état → **pas de bump
  `CURRENT_SAVE_VERSION`** *a priori*. À confirmer au lot moteur si un statut de
  combat temporaire devait être stocké (il ne l'est pas dans ce design).

## 3. Lineup (7 tiers)

Stats **cibles de design** (magnitude alignée sur Haven/Necropolis/Sylvan ;
valeurs finales calées au lot d'équilibrage `faction:sim`, bande 45–55 %). Toutes
les capacités listées **existent déjà** au catalogue générique
(`data/core/abilities.json`) — **zéro nouvelle capacité de code**.

| Tier | Unité (FR / rôle HoMM) | PV | Att | Déf | Dégâts | Vit. | Croiss./sem | Coût (or +) | Capacités (catalogue) |
|------|------------------------|----|-----|-----|--------|------|-------------|-------------|-----------------------|
| 1 | **Éclaireur** (Assassin / tireur) | 6 | 4 | 3 | 2–3 | 6 | 14 | 65 | `shooter`, `poisonSting` |
| 2 | **Furie Sanglante** (Blood Fury / assaut) | 11 | 7 | 4 | 2–4 | 8 | 9 | 130 | `noRetaliation` |
| 3 | **Minotaure** (garde / tank moral) | 25 | 9 | 8 | 6–9 | 6 | 6 | 260, +1 `sulfur` | `moraleImmune`, `doubleAttack` |
| 4 | **Chevaucheur des Ténèbres** (Dark Raider / cavalerie) | 32 | 12 | 9 | 7–10 | 9 | 4 | 480 | `charge` |
| 5 | **Sorcière d'Ombre** (Shadow Matron / caster) | 30 | 11 | 10 | 7–11 | 7 | 3 | 620, +1 `gems` | `spellcaster`, `curseOnHit` |
| 6 | **Hydre** (Hydra / mêlée de zone) | 68 | 16 | 14 | 10–15 | 5 | 2 | 1100, +1 `sulfur` | `areaAttack` (0.35), `noRetaliation` |
| 7 | **Dragon d'Ombre** (Shadow Dragon / apex volant) | 160 | 27 | 25 | 32–42 | 11 | 1 | 3000, +2 `sulfur` +1 `gems` | `flying`, `fear`, `magicResistance` |

> **Valeurs calées au lot 17.4** (`faction:sim`, budget or égal) : la version de
> cadrage sur-calibrait le Donjon (blowout 80.8 % vs Necropolis) ; les tiers
> porteurs (Furie T2, Chevaucheur T4, Hydre T6, Dragon T7) ont été atténués
> (dégâts/PV, `areaAttack` 0.5→0.35) ⇒ **0 déséquilibre béant**, Donjon dans la
> bande vs Haven (52 %) / Arcane (49 %), ⚠ maîtrisé ailleurs (60/57/37 %).

> Upgrades (habitation `maxLevel: 2` = variante `-elite`, comme toutes les
> factions depuis 4.11) : chaque unité a sa variante améliorée (stats +, une
> capacité en plus — ex. Éclaireur-élite `noRetaliation`, Hydre-élite `breathAttack`,
> Dragon-élite `spellImmune`). Détail au lot données.

## 4. Bâtiments spéciaux (2–3) + chaîne d'habitations

- **7 habitations** `dungeon-dwelling-t1..t7` (chaîne de prérequis identique au
  modèle Sylvan : t1 ⇐ `fort`, t(n) ⇐ t(n-1), t5 ⇐ `mageGuild`, chacune
  `maxLevel: 2` pour l'upgrade).
- **Puits de Malédiction** (`dungeon-cursed-well`) — bâtiment propre,
  `effect: growthBonus +25 %` (analogue au Bosquet du Cœur Sylvan), prérequis
  `fort@1`. Habillage : source souterraine qui « nourrit » les couvées.
- **Graal** (`dungeon-grail`, gaté par le méta-puzzle obélisques → fouille) : or
  noir mercantile — `income` +1500 or/j. Cf. doc 02 §2.2 (table par-faction).
- **Guilde de Sorcellerie** — la faction s'appuie fortement sur `mageGuild`
  (accès cercle 3 pour exploiter la signature) ; aucun bâtiment de code
  spécifique, juste priorité de construction reflétée dans `aiProfile`.
- Bâtiments communs standard : `townHall`, `fort`, `mageGuild`, `forge`,
  `taverne`, `market` (déclarés dans `town.buildings`).

## 5. Classes de héros (2) + 2 héros nommés

- **Classes** : **Suzerain** (*Overlord*, might — attaque/défense d'armée) et
  **Sorcier d'Ombre** (*Warlock*, magic — pouvoir/savoir, moteur de la signature).
- **Héros nommés** (`origin: canon`, `source: "Might & Magic"`, avatars stagés
  convention client ; **identité seule** au premier lot, cf. doc 06 §2) — les deux
  héros canon du Donjon de HoMM V :
  - **Raelag** (Suzerain / might) — spécialité *Meneur d'Ombre* : bonus aux
    Furies Sanglantes (via le point générique `conditional`/`conditionalUnitBonus`
    déjà livré, scopé `unitId`). Attributs type might.
  - **Shadya** (Sorcière d'Ombre / magic) — spécialité *Voile Irrésistible* :
    `startingSpells` destructeur + `wisdom` de départ (accès cercle 3 tôt, doc 02
    §1.3), incarne la signature. Attributs type magic (`power`/`knowledge`).
- **Héros original** (`origin: original`, sans `source`) — création propre au jeu :
  - **Olivier**, la Coupe Silencieuse (Suzerain / might) — assassin de l'ombre au
    poison. Spécialité *Poison Certain* : ses **Éclaireurs** (lignée tireuse à
    `poisonSting`) gagnent attaque + célérité, à échelle de niveau (via le point
    générique `conditional`/`conditionalUnitBonus`, `perLevels`) — « ne laisse pas
    de place à la chance ». `archery` de départ (jamais `luck`), attributs might.
- Les **spécialités conditionnelles avancées** (au-delà de `conditional`) restent
  différées comme pour les autres factions (point d'extension distinct).

## 6. Compétence de faction (si applicable)

**Aucune compétence de faction propre au premier lot.** La signature vit dans
`factionBonuses` (§2), pas dans une compétence. Variété de preuve vs
Nécromancie (compétence `external`) et vs Sylvan (aucune) : la modularité tient
avec un `factionBonus` de type nouveau sans toucher au tirage de compétences.
*Optionnel, différé* : une compétence `irresistibleMagic` graduant
`spellBonusPercent` par rang (réutiliserait le motif `scaleSkillId`/`percentByRank`
déjà livré pour `raiseUndeadOnVictory`) — noté comme évolution, hors premier lot.

## 7. Matchups attendus (pourquoi ~50 % ?)

- **vs Haven** : Haven encaisse (défense + Ferveur/Formation) et soigne → force
  le Donjon à dépenser sa mana tôt ; le Donjon gagne s'il *burst* avant que la
  formation Haven se mette en place. Équilibré par la fragilité elfe noir.
- **vs Necropolis** : mauvais matchup assumé — les morts-vivants sont `moraleImmune`
  et l'attrition/relève neutralise le tempo ; le Donjon compense par la magie de
  zone (Hydre + sorts) sur les grandes piles de squelettes. ~45 % attendu (§1).
- **vs Arcane Hunters** : course de burst — les Marques AH vs la magie irrésistible ;
  départage par qui frappe en premier (vitesse Furie/Chevaucheur aide le Donjon).
- **vs Sylvan Court** : miroir thématique — Symbiose récompense l'immobilité, le
  Donjon la **punit** en frappant à distance (Éclaireurs) + magie ; le Donjon force
  le tempo. Équilibré si Sylvan tient ses lignes.
- **vs Vox Arcana** : deux factions magiques ; départage par l'école et la mana.
  La signature donne l'avantage offensif, Vox compense par ses Maisons/soutien.

Objectif chiffré : **aucun blowout** au `faction:sim` initial, cible **45–55 %**
par appariement après réglage (comme les 4 factions livrées).

## 8. Lore & storytelling (chantier narratif — doc 13 §8)

> Ces blocs vivent dans le paquet (`locales/`, `heroes/*.json`, `story/`) — zéro
> diff moteur, zéro modification des autres maisons.

- **Identité narrative** : registre froid, impérieux, sûr de son fait ; mépris
  pour la « faiblesse » de la lumière ; se cache à elle-même qu'elle *envie* ce
  qu'elle a perdu en surface.
- **Lecture de l'arc global** : le sceau de Cendregarde est une **serrure** — donc
  une clé pour qui saura la retourner. Là où Haven veut le préserver et Necropolis
  le franchir, le Donjon veut le **posséder**.
- **Relations aux maisons** : Sylvan Court — parents reniés (haine intime) ;
  Haven — proie arrogante ; Necropolis — rivale respectée sur le terrain de la
  mort ; Arcane Hunters — outils utiles à retourner ; Vox Arcana — curiosités à
  étudier puis asservir.
- **Arcs des 2 héros nommés** (3 étapes chacun) :
  - *Raelag* : exilé de surface → conquérant souterrain → doute sur le prix payé.
  - *Shadya* : apprentie bridée → maîtresse de la magie irrésistible → tentation
    de briser la serrure elle-même.
- **Textes d'ambiance** (✅ lot 17.5) : `loreKey` FR/EN livré sur les **14 unités**
  (base + élites) et le **Puits de Malédiction**, écrits à la 1ʳᵉ personne du point
  de vue du Donjon (voix froide et impérieuse). Parité FR/EN vérifiée par
  `content:check`. Les héros nommés portent déjà leur `bio` FR/EN (lot 17.2).
- **Campagne** (lot 17.6, en cours) : **Chapitre 1 — *La Descente*** ✅ livré
  (`data/factions/dungeon/story/campaign.json` + scénario `dungeon-ch1` sur
  `proto-01` : le Donjon prend racine face à une incursion de la **Sylvan Court**
  — les parents reniés ; dialogue d'ouverture Raelag/Shadya, quête « bâtir le Fort »,
  barks de combat). Chapitres **2 — *La Couvée d'Ombre*** et **3 — *La Serrure***
  restent à écrire (mêmes garde-fous : données pures, zéro diff moteur).

## 9. Résumé des points d'extension (test de modularité #5)

| Besoin | Mécanisme | Diff moteur ? |
|--------|-----------|---------------|
| Lineup, stats, coûts, upgrades | Données pures (`units/`, `buildings.json`, manifeste) | **Non** |
| Capacités d'unité | Catalogue générique existant (`abilities.json`) | **Non** |
| Habitations + Puits de Malédiction | `buildings.json` (`dwelling`, `growthBonus`) | **Non** |
| Héros nommés (Raelag, Shadya) | `heroes/*.json` (identité) + `conditional`/`startingSpells` existants | **Non** |
| Ressources clés `sulfur`/`gems` | Déjà dans le jeu (existantes) | **Non** |
| **Signature Magie Irrésistible** | **UN** nouveau `factionBonus` générique `irresistibleMagic` | **Oui — 1 point générique** |

**Total : 1 point d'extension moteur générique**, exercé par le manifeste, garde-fou
« zéro faction dans le moteur » maintenu — 5ᵉ validation de la promesse de la doc 06.
