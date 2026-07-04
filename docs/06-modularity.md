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
   │   manifest.json · units/ · buildings/ · spells/       │
   │   heroes/ · abilities/*.ts (optionnel) · assets/      │
   └────────────────────────────────────────────────────────┘
```

Le moteur charge au démarrage la liste des paquets (`data/factions/index.json`), valide chaque paquet contre les **schémas JSON** (`schemas/*.schema.json`, validés par Zod à l'exécution et en CI), puis enregistre son contenu. Une faction invalide est rejetée avec un rapport d'erreurs précis — jamais de crash en jeu.

## 2. Structure de dossiers d'un paquet

```
data/factions/arcane-hunters/
├── manifest.json            # identité, terrain natif, bonus, ressources de faction
├── units/
│   ├── t1-eleve.json        # 1 fichier par unité (stats, capacités par ID, coûts)
│   └── … t8-penitent.json
├── buildings/
│   ├── common-overrides.json  # skins/renommages des bâtiments communs
│   └── specials.json          # bâtiments spécifiques + arbre de prérequis
├── spells/
│   └── traque.json          # école de faction (optionnelle)
├── heroes/
│   ├── classes.json         # classes, probas d'attributs, compétences de départ
│   └── named.json           # héros nommés + spécialités (par ID d'effet)
├── skills.json              # compétences ajoutées au pool (ex: Chasse rituelle)
├── abilities/               # ★ SEUL code autorisé — modules de capacités/hooks
│   ├── consume-marks.ts
│   ├── demonform.ts
│   └── hooks/on-week-start.ts   # ex: contrats de chasse
├── assets/
│   ├── units/*.png          # spritesheets (convention de nommage stricte)
│   ├── town/*.png           # vue de ville + états des bâtiments
│   ├── icons/*.png
│   └── audio/*.ogg
└── locales/
    ├── fr.json              # tous les textes, clé = ID de contenu
    └── en.json
```

## 3. Le manifeste

```jsonc
// manifest.json (extrait)
{
  "id": "arcane-hunters",
  "schemaVersion": 3,
  "name": "@loc:faction.name",              // toute string visible passe par locales/
  "nativeTerrain": "mistmoor",
  "keyResources": ["mercury", "gems"],
  "factionResources": [                      // ressources propres (optionnel)
    { "id": "essence", "icon": "icons/essence.png", "cap": 999 }
  ],
  "factionBonuses": [                        // effets déclaratifs interprétés par le moteur
    { "type": "onAttackApplyStatus", "status": "mark", "maxStacks": 3 }
  ],
  "spellSchool": "traque",                   // null si la faction n'en a pas
  "heroSkills": ["ritual-hunt"],
  "tiers": 8,
  "sharedGrowthGroups": { "apex": ["t7-manticore", "t8-penitent"] },
  "abilityModules": ["abilities/consume-marks", "abilities/demonform"],
  "hooks": ["abilities/hooks/on-week-start"],
  "aiProfile": { "aggression": 0.7, "focusFire": 0.9, "preferredTargets": "marked" }
}
```

## 4. Points d'extension en code (et leurs limites)

Le déclaratif couvre ~90 % des besoins (stats, coûts, arbres, effets composables du catalogue de capacités — doc 02 §5.4). Pour le reste, **2 interfaces TypeScript et uniquement elles** :

```ts
// Capacité custom : logique de combat pure, déterministe, sérialisable
interface AbilityModule {
  id: string;                                  // ex: "demonform"
  /** événements de combat écoutés */
  on: Partial<{
    beforeAttack(ctx: CombatCtx, ev: AttackEvent): void;
    afterAttack(ctx: CombatCtx, ev: AttackEvent): void;
    turnStart(ctx: CombatCtx, unit: StackRef): void;
    activate(ctx: CombatCtx, unit: StackRef, target?: HexOrStack): void; // capacité active
  }>;
  /** état persistant de la capacité — DOIT être un objet JSON sérialisable */
  initialState?(unit: StackRef): Json;
  /** métadonnées UI : icône, tooltip, ciblage */
  ui: AbilityUiSpec;
}

// Hook d'aventure : réagit au temps/événements de la carte
interface AdventureHook {
  id: string;
  on: Partial<{
    weekStart(ctx: AdventureCtx, player: PlayerRef): void;   // ex: contrats de chasse
    dayStart(ctx: AdventureCtx, player: PlayerRef): void;
    combatEnd(ctx: AdventureCtx, result: CombatResult): void; // ex: Nécromancie… qui est en fait déclarative
    townCaptured(ctx: AdventureCtx, town: TownRef): void;
  }>;
}
```

**Règles imposées aux modules** (vérifiées par lint + revue) :
1. Pas d'accès au rendu, au réseau, à `Date`/`Math.random` — le contexte fournit `ctx.rng` (seedé) et `ctx.now` (temps de jeu).
2. Tout état passe par `ctx.state` (sérialisable) : les sauvegardes et le multi en dépendent.
3. Un module n'importe que l'API publique `@heroes/engine-api` (interdiction d'importer les internals du moteur — frontière vérifiée par ESLint `no-restricted-imports`).

## 5. Checklist d'intégration d'une nouvelle maison

1. **Design** : remplir le gabarit `docs/templates/faction-template.md` (identité, fantasme, style, faiblesse assumée, 7–8 tiers, 3 bâtiments spéciaux, 2 classes de héros, 1 mécanique signature max).
2. `pnpm faction:new <id>` → génère le squelette de paquet + données d'exemple valides.
3. Remplir `units/`, `buildings/`, `heroes/`, `locales/` ; `pnpm faction:validate <id>` doit passer (schémas + règles croisées : prérequis atteignables, coûts définis, IDs de capacités existants, textes localisés complets).
4. Capacités : d'abord chercher dans le **catalogue générique** ; ne créer un module que si la composition déclarative ne suffit pas (règle : ≤ 3 modules par faction).
5. Assets : suivre `docs/asset-conventions.md` (tailles, ancres, noms) ; placeholders générés autorisés jusqu'à la Beta.
6. **Équilibrage** : `pnpm faction:sim <id>` lance N×1000 combats auto contre chaque faction existante (armées de valeur égale, semaine 1/4/8) et sort un rapport de winrate ; cible : 45–55 % par matchup et par palier.
7. Jouabilité : 1 scénario de test dédié + passe IA (le profil `aiProfile` suffit-il ?).
8. PR unique portant le paquet ; la CI rejoue validation + simulation. **Aucun diff hors de `data/factions/<id>/` n'est accepté**, sauf ajout au registre `index.json` — c'est le test automatique de la promesse de modularité.

## 6. Exemples de futures maisons (pré-concepts)

| Maison | Thème | Mécanique signature (pressentie) | Coût en points d'extension |
|--------|-------|-----------------------------------|----------------------------|
| **Sylvan Court** | Nature/elfes, forêt-monde | **Symbiose** : chaque pile lie un « esprit » qui pousse de round en round (buff croissant si la pile ne bouge pas) | 1 module (`symbiosis`) |
| **Cogsworth Combine** | Steampunk/naine, machines | **Surchauffe** : les unités-machines choisissent chaque tour entre mode sûr et mode surchauffé (+ dégâts, risque de panne) ; ressource de faction : Vapeur | 1 module (`overheat`) + hook `dayStart` (production de Vapeur) |
| **Tide Covenant** | Profondeurs, naga/pirates | **Marée** : le champ de bataille a un niveau d'eau qui monte/descend par round, modifiant hexes praticables | 1 module de **terrain de combat** (nouveau point d'extension à ouvrir en Beta — noté comme évolution du framework) |
| **Ashen Horde** | Orcs nomades, cendres | **Rage du sang** : jauge partagée d'armée qui monte avec les pertes, dépensable en actions bonus | 1 module (`bloodrage`) |

Le cas *Tide Covenant* illustre la gouvernance du framework : quand une maison a besoin d'un point d'extension inexistant, on **étend le moteur de façon générique** (ici : « modificateurs de terrain de combat dynamiques »), jamais avec du code spécifique à la faction.

## 7. Versionnement du contenu

- `schemaVersion` dans chaque manifeste ; le moteur embarque des migrations de données (comme des migrations de BDD) pour charger les paquets plus anciens.
- Les sauvegardes stockent la **liste et version des paquets** utilisés ; charger une sauvegarde sans le paquet requis propose le téléchargement (futur) ou refuse proprement.
