# 06 — Système de modularité : intégrer une nouvelle Maison

Objectif : **ajouter une faction sans modifier le moteur**. Une faction est un *paquet* auto-contenu : des données JSON validées par schéma, des assets, et — uniquement si nécessaire — des modules JS enregistrés via des points d'extension explicites.

## 1. Principe : moteur générique + contenu déclaratif

```
┌──────────────────────────────────────────────────────────┐
│                        MOTEUR                            │
│  règles de combat · économie · carte · progression       │
│  ne contient AUCUNE référence à "haven", "necropolis"…   │
│                                                          │
│   ┌────────────────┐  ┌───────────────┐  ┌────────────┐  │
│   │ Registre       │  │ Registre      │  │ Registre   │  │
│   │ capacités      │  │ hooks         │  │ contenu    │  │
│   └───────▲────────┘  └──────▲────────┘  └─────▲──────┘  │
└───────────┼──────────────────┼─────────────────┼─────────┘
            │ enregistre       │ enregistre      │ charge & valide
   ┌────────┴──────────────────┴─────────────────┴─────────┐
   │              PAQUET DE FACTION (ex: arcane-hunters)   │
   │   manifest.json · units/ · buildings.json             │
   │   locales/ · story/                                    │
   └────────────────────────────────────────────────────────┘
```

> **État livré** : le plan initial prévoyait des dossiers `spells/`, `heroes/`,
> `abilities/*.ts` et `assets/` par paquet, et deux registres de code (capacités,
> hooks). La réalité livrée est **100 % déclarative** : un paquet est du JSON pur
> (aucun `.ts`), les capacités sont des **entrées génériques inline** sur les
> unités (catalogue `data/core/abilities.json`), les sorts d'école de faction
> vivent au **catalogue CORE** (`data/core/spells.json`), et les assets sont dans
> le staging global `assets/` (doc 12 §10). Les registres « capacités » / « hooks »
> restent des points d'extension ouverts **génériquement, un par sous-lot** (§4).

Le moteur charge au démarrage la liste des paquets (`data/factions/index.json`), valide chaque paquet contre les **schémas Zod** (`@heroes/content`, à l'exécution et en CI), puis enregistre son contenu. Une faction invalide est rejetée avec un rapport d'erreurs précis — jamais de crash en jeu.

## 2. Structure de dossiers d'un paquet

Structure **livrée** (JSON pur, zéro code par paquet) :

```
data/factions/arcane-hunters/
├── manifest.json            # identité, terrain natif, bonus, ressources, ville, unités
├── units/
│   ├── t1-eleve.json        # 1 fichier par unité (stats, capacités par ID, coûts)
│   ├── t1-eleve-elite.json  # variante élite = dwelling niveau 2 (Alpha 4.11)
│   └── … t8-penitent(-elite).json
├── buildings.json           # bâtiments spécifiques + arbre de prérequis (un seul fichier)
├── story/
│   └── campaign.json        # campagne de faction (doc 13 §6.1) — optionnel
└── locales/
    ├── fr.json              # tous les textes, clé = ID de contenu
    └── en.json
```

> **Non par paquet** (contrairement au plan initial) : pas de `spells/` (les
> sorts d'école de faction sont au catalogue CORE `data/core/spells.json`), pas
> de `heroes/`/`skills.json` (attributs de héros = profil global `config.json` ;
> compétences = catalogue CORE `data/core/skills.json`), pas d'`abilities/*.ts`
> (capacités = catalogue générique `data/core/abilities.json`, référencées par
> ID), pas d'`assets/` (staging global `assets/`, doc 12 §10). Les bâtiments
> communs (hôtel de ville, fort, guilde, taverne, forge) ne sont pas « override »
> par paquet : le manifeste les liste dans `town.buildings`.

## 3. Le manifeste

Manifeste **réel** (arcane-hunters, abrégé) :

```jsonc
// manifest.json (extrait fidèle)
{
  "id": "arcane-hunters",
  "schemaVersion": 1,                        // migrations à la 1ʳᵉ évolution de schéma (§7)
  "name": "@loc:faction.arcane-hunters.name",// toute string visible passe par locales/
  "story": "story/campaign.json",            // campagne de faction (optionnel)
  "nativeTerrain": "swamp",
  "keyResources": ["mercury", "gems"],       // exactement 2
  "factionResources": [                      // ressources propres (optionnel)
    { "id": "essence", "icon": "icons/essence.png", "cap": 999 }
  ],
  "factionBonuses": [                        // effets déclaratifs interprétés par le moteur
    { "type": "gainFactionResourceOnVictory", "resource": "essence", "amount": 10 }
  ],
  "spellSchool": "traque",                   // null si la faction n'en a pas
  "heroSkills": [],
  "tiers": 8,
  "sharedGrowthGroups": {},                  // (apex T7/T8 non déclaré aujourd'hui, cf. doc 05)
  "units": ["t1-eleve", … , "t8-penitent-elite"],  // base + variantes élites
  "abilityModules": [],                      // ★ DOIT rester vide (schéma `.max(0)`) tant que
  "hooks": [],                               //   le moteur ne les interprète pas — cf. §4
  "aiProfile": { "aggression": 0.7, "focusFire": 0.9, "preferredTargets": "marked" },
  "town": { "buildings": ["townHall", "fort", …], "dwellings": [ … ] }
}
```

Les **deux seuls** types de `factionBonuses` livrés sont `raiseUndeadOnVictory`
(Nécropolis) et `gainFactionResourceOnVictory` (Essence) — cf. `faction/types.ts`.
Le manifeste liste explicitement ses unités (`units: [...]`, convention
`units/<id>.json`) : un navigateur ne peut pas lister un dossier, le contenu est
donc entièrement déclaré.

## 4. Points d'extension en code (et leurs limites)

Le déclaratif couvre **tous** les besoins livrés à ce jour (stats, coûts, arbres, effets composables du catalogue de capacités — doc 02 §5.4).

> **État livré** : les deux interfaces TypeScript initialement prévues
> (`AbilityModule` / `AdventureHook`, modules de code par paquet) **n'existent
> pas**. Le schéma du manifeste **force `abilityModules` et `hooks` à vide**
> (`z.array(z.string()).max(0)`, `content/schemas.ts`) : charger du code de paquet
> serait un mensonge de validation tant que le moteur ne l'interprète pas. Le
> mécanisme **réellement** utilisé : des **capacités génériques inline**
> paramétrées par les données (une entrée du catalogue `data/core/abilities.json`
> référencée par ID sur l'unité, ex. `consumeMarks` avec ses paramètres
> `suppressRetaliation`/`immobilizeRounds`), plus des **effets déclaratifs de
> manifeste** (`factionBonuses`, `sharedGrowthGroups`) et de bâtiment
> (`exclusiveGroup`). Quand un besoin nouveau apparaît, on ouvre **un** point
> d'extension **générique** dans le moteur (interprété depuis les données), jamais
> un module propre à une faction. Les interfaces ci-dessus restent la cible si un
> jour une capacité échappe au paramétrage ; à ce stade, aucune n'a été
> nécessaire.

> 🚧 **État 4.x** : plusieurs points d'extension **génériques** sont ouverts, un
> par sous-lot, **tous sans nom de faction dans le moteur** — chacun interprété
> depuis les données (manifeste / catalogues résolus par le contenu) :
> `factionBonuses` déclaratifs (`raiseUndeadOnVictory` Nécropolis 3.4, gain de
> ressource de faction post-victoire 4.4) ; capacité générique `consumeMarks`
> et ses effets (`executioner`/`expose`/`pinningShot`, 4.3/4.5/4.8) ; choix de
> bâtiment exclusif `exclusiveGroup` (Cercles, 4.7) ; sort `applyMarks` (4.9) ;
> module de capacité stateful `demonform` (4.10). Le garde-fou CI « zéro faction
> dans le moteur » **dérive désormais les IDs interdits de
> `data/factions/index.json`** (remédiation R6) : le seul diff moteur admis par
> lot est l'ouverture d'**un** point générique, jamais un `if (faction === …)`.

**Invariants du moteur** (déjà tenus par le mécanisme déclaratif ; cible d'un futur module le jour où il en faudra un) :
1. Pas d'accès au rendu, au réseau, à `Date`/`Math.random` — seul le **RNG PCG32 seedé** de l'état est autorisé (interdiction lintée, doc 07 §3).
2. Tout état passe par `GameState` (sérialisable) : les sauvegardes et le multi en dépendent.
3. Frontières d'import ESLint (`no-restricted-imports`) : le client/les outils consomment la surface publique `@heroes/engine` (`index.ts`), jamais les internals — il n'existe pas de package `@heroes/engine-api` séparé.

## 5. Checklist d'intégration d'une nouvelle maison

1. **Design** : remplir le gabarit `docs/templates/faction-template.md` (identité, fantasme, style, faiblesse assumée, 7–8 tiers, 3 bâtiments spéciaux, 2 classes de héros, 1 mécanique signature max).
2. `pnpm faction:new <id>` → génère le squelette de paquet + données d'exemple valides.
3. Remplir `units/`, `buildings/`, `heroes/`, `locales/` ; `pnpm faction:validate <id>` doit passer (schémas + règles croisées : prérequis atteignables, coûts définis, IDs de capacités existants, textes localisés complets).
4. Capacités : d'abord chercher dans le **catalogue générique** ; ne créer un module que si la composition déclarative ne suffit pas (règle : ≤ 3 modules par faction).
5. Assets : suivre `docs/12-assets-style-guide.md` (familles P/A/B/C/D/E, tailles, nommage) ; l'intégration client (registre, hors bundle) est décrite en §10. Placeholders procéduraux autorisés jusqu'à la Beta (repli gracieux en place).
6. **Équilibrage** : le test `balance.test.ts` (paquet `@heroes/content`, lancé par `pnpm test`) rejoue des combats auto à valeur d'or égale et vérifie qu'aucune faction ne domine ; le simulateur CLI dédié **existe** — `pnpm faction:sim` (`packages/tools/src/faction-sim.ts`, rapport de winrate par appariement, Alpha 4.17).
7. Jouabilité : 1 scénario de test dédié + passe IA (le profil `aiProfile` suffit-il ?).
8. PR unique portant le paquet ; la CI rejoue validation + simulation. **Aucun diff hors de `data/factions/<id>/` n'est accepté**, sauf ajout au registre `index.json` — c'est le test automatique de la promesse de modularité.
9. **Narratif** (s'arme avec le chantier doc 13) : remplir le gabarit §8 (identité narrative, lecture de l'arc global, relations, arcs des 2 héros nommés) et livrer les `loreKey` FR/EN de chaque entité dans les locales du paquet ; la campagne de faction (3 chapitres, `data/factions/<id>/story/`) peut arriver dans un second lot. Mêmes garde-fous : zéro diff moteur, zéro modification des autres maisons (doc 13 §8.2).

## 6. Exemples de futures maisons (pré-concepts)

| Maison | Thème | Mécanique signature (pressentie) | Coût en points d'extension |
|--------|-------|-----------------------------------|----------------------------|
| **Sylvan Court** | Nature/elfes, forêt-monde | **Symbiose** : chaque pile lie un « esprit » qui pousse de round en round (buff croissant si la pile ne bouge pas) | 1 module (`symbiosis`) |
| **Cogsworth Combine** | Steampunk/naine, machines | **Surchauffe** : les unités-machines choisissent chaque tour entre mode sûr et mode surchauffé (+ dégâts, risque de panne) ; ressource de faction : Vapeur | 1 module (`overheat`) + hook `dayStart` (production de Vapeur) |
| **Tide Covenant** | Profondeurs, naga/pirates | **Marée** : le champ de bataille a un niveau d'eau qui monte/descend par round, modifiant hexes praticables | 1 module de **terrain de combat** (nouveau point d'extension à ouvrir en Beta — noté comme évolution du framework) |
| **Ashen Horde** | Orcs nomades, cendres | **Rage du sang** : jauge partagée d'armée qui monte avec les pertes, dépensable en actions bonus | 1 module (`bloodrage`) |

Le cas *Tide Covenant* illustre la gouvernance du framework : quand une maison a besoin d'un point d'extension inexistant, on **étend le moteur de façon générique** (ici : « modificateurs de terrain de combat dynamiques »), jamais avec du code spécifique à la faction.

## 7. Versionnement du contenu

- `schemaVersion` dans chaque manifeste (**vaut `1`** aujourd'hui, forcé par le schéma) ; les **migrations de données** de paquet sont **différées** à la première évolution de schéma incompatible (aucune n'existe encore).
- La forme de sauvegarde a sa propre version moteur (`CURRENT_SAVE_VERSION`, doc 07 §4) qui rejette proprement une version incompatible. Le suivi **par paquet** (liste + version des paquets d'une sauvegarde) est **différé** avec les migrations.
