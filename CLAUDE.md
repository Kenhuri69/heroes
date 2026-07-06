@.claude/guidelines.md

# Heroes — Mémoire Projet

Recréation navigateur du gameplay de *Might & Magic: Heroes Online* :
exploration par héros sur carte d'aventure, gestion de villes, armées et
combats tactiques tour par tour sur grille hexagonale.
Cible desktop + mobile (touch-first), architecture data-driven modulaire.

> ✅ **Jalon MVP atteint** (doc 01 §5) : partie complète jouable de bout en bout
> (desktop + mobile) — carte, villes, combat hex, héros (sorts/compétences/
> artefacts), **2 factions** (Haven, Necropolis) + une faction de test, 3
> scénarios solo avec **IA d'aventure**, conditions de victoire/défaite,
> sauvegarde IndexedDB. Critères de sortie tenus : 3ᵉ faction sans diff moteur
> (garde-fou CI), budget bundle < 800 Ko gzip, anti-gel throttling ×4
> (arène + carte), accessibilité (3 crans de police, motifs de bannières,
> cibles ≥ 44px), i18n FR/EN complète. Détail des sous-phases 3.x ci-dessous.
>
> 🚧 **Historique : Phase 2 — implémentation** (plan :
> `docs/10-plan-phase-2-implementation.md`). La Phase 2.0 (bootstrap) est
> livrée : monorepo pnpm + TS strict, client PixiJS 8 (damier pan/zoom
> touch-first), smoke test Playwright, CI + déploiement continu sur
> https://kenhuri69.github.io/heroes/ . Phase 2.1 livrée : cœur du moteur pur
> (`GameState`, commandes, RNG PCG32, golden replay). Phase 2.2 livrée :
> pipeline de contenu data-driven (schémas Zod, loader, CLI faction:new /
> faction:validate / content:check, paquets arcane-hunters + test-faction
> chargés dans le navigateur). Phase 2.3 livrée : carte d'aventure jouable
> (carte JSON proto-01 32×32, A* 8 directions avec coûts terrain/route/
> diagonale, tap-tap + prévisualisation chemin avec jours, brouillard 2 états,
> ramassage de ressources, fin de tour, sauvegarde/rechargement IndexedDB).
> Phase 2.4 livrée : arène de combat hex (moteur `engine/combat` — vagues
> d'initiative, riposte, dégâts doc 02 §5.3, moral/chance, 6 capacités, IA
> heuristique + auto-combat déterministe ; scène Pixi + UI avec
> prévisualisation de dégâts ; gardiens neutres sur la carte, interception ⇒
> combat ⇒ pertes appliquées ; testable seule via `/#arena`).
> Phase 2.5 livrée : boucle jouable complète — menu principal
> (Continuer/Nouvelle partie/Options), i18n FR/EN (locales core +
> paquets), sauvegarde IndexedDB gzip avec autosave fin de tour et
> export/import `.heroes`, XP/niveau du héros (attributs), passe mobile
> (tiroir héros, bandeau armée, overlay paysage), toasts, budget bundle
> < 800 Ko gzip vérifié en CI. **Sortie de Phase 2 atteinte.**
>
> 🚧 **Phase MVP en cours** (plan : `docs/11-plan-mvp-implementation.md`,
> découpage 3.x). Phase 3.1 livrée : villes & town building (moteur
> `engine/town` — construire 1/jour, recruter, croissance hebdo, revenu
> quotidien, garnison, capture ; schéma `building` data-driven + ville de
> départ sur proto-01 ; écran de ville liste avec onglets Construire/
> Recruter/Garnison ; l'armée du héros grossit depuis la ville).
> Phase 3.2 livrée : héros — sorts, compétences & artefacts (moteur
> `engine/hero` — 10 sorts cercles 1–3 lançables en combat via `CastSpell`
> (dégâts/soin/buff/debuff, statuts temporaires, mana = Savoir × 10 +
> artefacts, 1 sort/round, prévisualisation sans RNG) ; attributs héros
> Attaque/Défense + Chance/Moral enfin branchés dans les dégâts ; 13
> compétences data-driven à effets déclaratifs (Logistique = PM, Recherche
> = vision, Économie = or/jour, Chance/mêlée/tir/armure/coût mana en combat ;
> Commandement/moral reporté) avec choix à la montée de niveau (`ChooseSkill`,
> 2 propositions, cap rang 3) ; 4 artefacts à bonus cumulés sur 10 slots ;
> UI livre de sorts combat + tiroir héros (compétences/inventaire) + modale
> de choix ; héros de départ doté en données (`config.newGame.startingHero`).
> Phase 3.3 livrée : faction **Haven** 100 % données (`data/factions/haven/` —
> lineup T1–T7 aux stats doc 03, arbre d'habitations 7 dwellings + prérequis,
> manifeste, ressources Cristal/Gemmes, locales FR/EN), **zéro diff moteur/
> client** (critère de modularité doc 11 prouvé : une faction = données pures +
> un test de recrutement). Capacités spéciales / bonus de faction / héros
> nommés différés (moteur MVP à 6 capacités ; points d'extension ouverts plus
> tard, cf. doc 03 « État 3.3 »).
> Phase 3.5 livrée : **scénarios & IA d'aventure** — conditions de victoire/
> défaite déclaratives (`engine/scenario` : eliminateAllEnemies/captureTown/
> defeatHero/surviveDays, élimination de joueur, `GameState.outcome` +
> `GameEnded`, no-op hors scénario) ; **IA d'aventure** déterministe
> (`engine/ai` + commande `AiTurn` : explore/ramasse/attaque/capture/construit/
> recrute, heuristique gloutonne, property « IA vs IA se termine ») ; 3
> scénarios solo data-driven (`data/scenarios/`) ; client : sélection de
> scénario, boucle de pilotage des tours IA, overlay victoire/défaite ; smoke
> « gagner un scénario contre l'IA ». Triggers de carte + scaling différés.
> Phase 3.6 livrée : **finitions & jalon MVP** — accessibilité (3 crans de
> police propagés partout via `rem`, composant `FactionBadge` à motifs
> déterministes non chromatiques, cibles tactiles ≥ 44px), audit i18n (0
> chaîne en dur, parité FR/EN), smoke anti-gel étendu à la carte d'aventure,
> test d'équilibrage grossier Haven/Necropolis (pas de déséquilibre béant à
> valeur égale). Vue de ville peinte + assets finaux = Beta. **Sortie MVP.**
> Phase 3.4 livrée : faction **Necropolis** + **Nécromancie** — le **test de
> modularité n°1**. Faction 100 % données (`data/factions/necropolis/`, lineup
> T1–T7 toutes `undead`) ET ouverture d'**UN** point d'extension moteur
> **générique** : l'effet de faction déclaratif `raiseUndeadOnVictory`
> (`engine/faction`), interprété à la fin d'un combat gagné (relève un % des PV
> vivants ennemis tués en squelettes, plafonné), piloté par le manifeste via
> `factionCatalog`/`hero.factionId` — **zéro `if (faction === …)` dans le
> moteur**. Scaling par compétence/bâtiment, capacités spéciales et héros
> nommés différés (cf. doc 04 « État 3.4 »).
>
> 🔧 **Durcissement post-MVP** (choix utilisateur ; plans `.claude/plans/
> phase-3.7-*` et `-3.8-*`). 3.7 livrée : correction du nom de faction (clé
> locale unique `@loc:faction.<id>.name` par paquet — évite la collision à la
> fusion des locales ; scaffolder `faction:new` corrigé) + couverture save/load
> d'un état de scénario (champs 3.4/3.5). 3.8 livrée : **garde de version de
> sauvegarde** — `CURRENT_SAVE_VERSION` (source de vérité moteur, bump 1→2 pour
> la forme 3.4/3.5) + `readSaveVersion` ; le chargement (IndexedDB + import
> `.heroes`) rejette proprement une sauvegarde d'une autre version au lieu
> d'adopter un état malformé (doc 07 §4). Zéro faction dans le moteur (garde-fou
> vert), golden re-fixé. 3.9 livrée : **échecs de sauvegarde surfacés** — signal
> `SaveFailed` (autosave + save manuel) → toast d'erreur i18n, plus de perte de
> données silencieuse (navigation privée/quota).
>
> 🚀 **Alpha — faction Arcane Hunters** (roadmap doc 09 ; plans `.claude/plans/
> phase-4.*`). 4.1 : cadrage (doc 05) — 3ᵉ faction complète, **test de
> modularité #3**. Sous-lots **4.2→4.10 livrés**, chacun ouvrant **un** point
> d'extension moteur **générique** + les données qui l'exercent, garde-fou
> « zéro faction dans le moteur » maintenu : 4.2 lineup T1–T7 + Marque ;
> 4.3/4.5/4.8 capacité générique `consumeMarks` (executioner / `expose`
> suppression de riposte / `pinningShot` immobilisation) ; 4.4/4.6 ressource de
> faction **Essence** (gain post-victoire puis dépense) + T8 Pénitent
> recrutable ; 4.7 **Cercles** (choix de bâtiment exclusif `exclusiveGroup`) ;
> 4.9 **École de la Traque** (school `traque`, sort `applyMarks`, Entraves) ;
> 4.10 **demonform** (T8, transformation stateful + `magicResistance`). La forme
> de sauvegarde a évolué avec les ressources de faction : `CURRENT_SAVE_VERSION`
> vaut désormais **3** (source de vérité `engine/core/state.ts`).
>
> 🩹 **Remédiation revue de code** (plan `.claude/plans/code-review-remediation.md`,
> lots R1–R8). Livrés : R1 (garde-fous de crash moteur), R5 (résilience du
> pipeline de contenu + CLI de faction), R2 (cycle de vie des scènes client +
> erreurs surfacées, plus de page muette), R3 (identité du joueur humain via
> `humanPlayerId`, plus de `'player-1'` en dur), R4 (noms localisés du contenu),
> R6 (durcissement CI : garde-fou faction dérivé de `data/factions/index.json`,
> tests explicites, `forbidOnly`/`retries` Playwright), R7 (dette & duplication :
> `advanceHeroAlongPath` partagé humain/IA ; helpers purs `@heroes/engine`
> consommés par le client — coût/prérequis/dwellings de ville, `attackableTargets`/
> `meleeOriginsFor` de combat ; mineurs). R8 : cette mise à jour docs.
>
> 🎨 **Intégration des assets** (doc 12 §10) : le client consomme les PNG du
> staging `assets/` via un registre auto-découvert (`import.meta.glob ?url`,
> `assetsInlineLimit: 0` → hors bundle JS, budget < 800 Ko gzip tenu), avec repli
> procédural gracieux. Surfaces branchées : tuiles de terrain, mines/objets de
> carte, vignettes de bâtiments, icônes d'artefacts, icônes de ressources.
> Les docs `docs/0X-*.md` restent la source de vérité du design ; le code doit
> s'y conformer.

---

## Structure des fichiers

```
README.md                        Vue d'ensemble + principes non négociables
docs/
  01-gdd-overview.md             Vision, core loop, piliers, monétisation, scope MVP
  02-mechanics.md                Héros, carte d'aventure, ressources, combat hex, town building
  03-faction-haven.md            Faction Haven : lore, unités T1–T7, bâtiments, bonus, héros
  04-faction-necropolis.md       Faction Necropolis : idem + Nécromancie
  05-faction-arcane-hunters.md   Faction Arcane Hunters : nouvelle maison, 8 tiers, mécaniques uniques
  06-modularity.md               Plan data-driven : dossiers, interfaces, checklist d'intégration de faction
  07-architecture.md             Frontend TS/PixiJS, state management, backend Node.js, sauvegardes, réseau
  08-ui-ux.md                    Écrans principaux, wireframes, adaptation mobile
  09-roadmap.md                  Phases MVP → Alpha → Beta → Live
  10-plan-phase-2-implementation.md  Plan Phase 2 : structure, architecture, build Vite, déploiement GitHub Pages, code prioritaire
  11-plan-mvp-implementation.md  Plan Phase MVP : découpage en sous-phases 3.x (villes, héros, factions, scénarios)
  12-assets-style-guide.md       Guide de style des assets générés : cadre visuel, procédures de génération, intégration client
  13-plan-narrative-polish.md    Plan de polishing narratif : ton, campagnes, quêtes, dialogues data-driven, lots N1→N4
  14-faction-sylvan-court.md     Faction Sylvan Court (Beta, 4ᵉ maison) : cadrage — lineup 7 tiers, signature Symbiose, points d'extension
  templates/faction-template.md  Gabarit pour spécifier une nouvelle maison
.github/workflows/
  ci.yml                         PR : typecheck, lint, tests, build, smoke headless
  deploy.yml                     main : build Vite + smoke sur build de prod + déploiement Pages
packages/
  engine/                        Moteur de règles pur (état, commandes, RNG PCG32) — @heroes/engine
  content/                       Schémas Zod + loader/validateur de paquets de faction — @heroes/content
  client/                        Client Vite + PixiJS 8 (rendu, caméra, scènes) — @heroes/client
  tools/                         CLI : faction:new, faction:validate, content:check — @heroes/tools
data/
  core/abilities.json            Catalogue générique de capacités (doc 02 §5.4)
  core/config.json               Constantes d'équilibrage (mouvement, terrains, vision, combat, héros, ville de départ)
  core/buildings.json            Bâtiments communs des villes (doc 02 §4.1 : hôtel de ville, fort, guilde…)
  core/spells.json               Sorts génériques cercles 1–3 (doc 02 §1.4 : école/cercle/coût/effet)
  core/skills.json               Compétences secondaires + effets par rang (doc 02 §1.3)
  core/artifacts.json            Artefacts à bonus cumulés sur 10 slots (doc 02 §1.1, doc 08 §2.3)
  core/locales/                  Locales FR/EN de l'UI générique (menu, options, toasts, ville)
  factions/                      Paquets de faction (index.json + haven, arcane-hunters, test-faction, necropolis)
  maps/proto-01.map.json         Carte prototype 32×32 (légende, tuiles, routes, objets, départs)
  scenarios/                     Scénarios solo (index.json + tutorial/survival/conquest : joueurs, IA, objectifs)
tests/smoke.spec.ts              Smoke Playwright/Chromium headless (guideline §7) sur le build de prod
playwright.config.ts             Config smoke (desktop + mobile, vite preview)
.claude/
  guidelines.md                  Règles de travail (incluses ci-dessus)
  plans/                         Plans vivants par changement (règle §5 des guidelines)
```

---

## Architecture cible (résumé — détail dans `docs/07-architecture.md`)

- **Moteur de règles pur** : TypeScript strict, déterministe (RNG seedé
  injecté), zéro dépendance au rendu ou au DOM. Testable en unitaire.
- **Rendu** : PixiJS 8 (WebGL/WebGPU, fallback canvas), consomme l'état du
  moteur — jamais l'inverse.
- **Contenu 100 % data-driven** : unités, bâtiments, héros, bonus décrits en
  JSON + manifeste de faction, validés par schémas. Le moteur ne connaît
  aucune faction (checklist d'intégration : `docs/06-modularity.md`).
- **Sauvegarde** : locale (IndexedDB) au MVP ; backend Node.js + WebSocket
  pour l'asynchrone/PvP post-MVP.

---

## Conventions de travail

- **Langue** : documentation et discussions en français ; identifiants de
  code en anglais.
- **Branche par défaut** : `main`. Travailler sur des branches `claude/…`,
  PR ouverte en draft (voir guidelines §6 avant tout push).
- **Toute évolution de design** passe par la mise à jour du document
  `docs/0X-*.md` concerné — les docs sont la source de vérité en Phase 1.
- **Nouvelle faction** : partir de `docs/templates/faction-template.md` et
  suivre la checklist de `docs/06-modularity.md` ; ne jamais introduire de
  cas particulier de faction dans le futur moteur.
- **Plans** : chaque changement non trivial a son plan vivant dans
  `.claude/plans/<feature>.md` (guidelines §5).
