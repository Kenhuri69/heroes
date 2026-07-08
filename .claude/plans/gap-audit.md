# Audit d'écart — implémentations partielles vs jeu attendu

> Audit du **code réel** (pas des cases « ✅ » des docs), déclenché par le constat
> utilisateur que de nombreux systèmes déclarés « livrés » sont en réalité des
> squelettes. Chaque entrée cite `fichier:ligne`, un **type** (🐞 bug de règle /
> 🕳️ feature absente / 🎨 façade UI), et un **effort** indicatif (S/M/L).
>
> Méthode : 4 audits parallèles (combat, carte, villes/éco, héros) lisant le code
> source, croisés avec les 4 exemples remontés par l'utilisateur (brouillard
> héros-seul, bâtiments cross-faction en ville, livre de sorts pauvre, héros sans
> action en combat) — **tous confirmés**.
>
> ⚠️ **Méta-constat** : docs/roadmap ne sont PAS un signal fiable de complétude.
> Systèmes déclarés livrés mais creux (guilde des mages, siège, artefacts) ; et
> à l'inverse le CLAUDE.md dit « moral reporté » alors que le moral est câblé.
> Ce backlog doit alimenter une relance élargie de `code-doc-coherence-remediation`.

## Légende
- **Type** : 🐞 bug de règle (comportement faux) · 🕳️ feature absente · 🎨 façade UI (structure là, rendu/UX manquant)
- **Effort** : S ≈ ½ j · M ≈ 1–3 j · L ≈ 1 sem+
- **État** : ⬜ à faire · ✅ fait — mis à jour au fil de l'eau

---

## P0 — Bugs de règles (comportement faux, à corriger en premier)

### G1 — Habitations d'autres factions constructibles dans une ville 🐞 M — ✅ FAIT
- **Symptôme** : dans une ville Haven, on voit ET on peut **réellement construire**
  les habitations Necropolis/Sylvan/Arcane, puis recruter leurs créatures.
- **Cause** : `buildBuildingCatalog` (`packages/content/src/loader.ts:529-546`)
  agrège les bâtiments de tous les paquets dans un catalogue plat sans faction.
  `validateBuildStructure` (`packages/engine/src/town/build.ts:13-77`) ne vérifie
  que prérequis/exclusif/unique/coût — jamais l'appartenance à la faction de la
  ville. Les dwellings t1 ne requièrent que `fort@1` (core).
  `manifest.town.buildings` (liste propre à la faction) est validé au chargement
  (`loader.ts:452-456`) puis **jamais reporté dans `TownState` ni consulté**.
- **Piste** : porter la liste des bâtiments autorisés de la faction dans
  `TownState` (au `StartGame`/capture), la faire respecter côté moteur
  (`build.ts`) ET filtrer l'affichage (`TownScreen.tsx:217,266`) par cette liste.
  Garder le catalogue global (les ids restent uniques) mais restreindre le
  *constructible* par ville. Golden replay à re-fixer.
- **Vérif** : test moteur « BuildStructure d'un dwelling hors-faction rejeté » +
  smoke « écran de ville n'affiche que core + faction ».

### G2 — Guilde des mages inerte : aucun apprentissage de sort 🐞/🕳️ L — ✅ FAIT (couplé H2)
- **Symptôme** : un héros n'apprend **aucun** sort de toute la partie ; construire
  la guilde ne change rien à son grimoire.
- **Cause** : l'effet `mageGuild` n'existe que dans le type
  (`packages/engine/src/town/types.ts:17`) — **zéro consommateur** dans
  `engine/src`. `hero.spells` peuplé seulement au `StartGame` via `startingSpells`
  (`core/engine.ts:410`), jamais augmenté. Aucune commande `LearnSpell`.
- **Piste** : (a) données — pool de sorts par niveau de guilde (par faction ?) ;
  (b) moteur — à la visite d'une ville avec héros présent, offrir/apprendre les
  sorts du niveau de guilde ≤ construit (borné par une future compétence Sagesse,
  cf. H3). Décision de design requise (apprentissage auto vs choix, dépendance
  Sagesse) → **à cadrer avec l'utilisateur**.
- **Vérif** : test « héros visitant une ville guilde niv. N connaît les sorts ≤ N ».

### G3 — Villes non colorées par joueur 🐞 S — ✅ FAIT
- **Symptôme** : une ville IA (rouge) et une ville neutre sont indistinctes.
- **Cause** : rendu binaire humain/non-humain (`render/townsLayer.ts:7-8,43,75-81`)
  au lieu d'une couleur par `ownerPlayerId` comme les mines (`mapObjects.ts:193-207`).
- **Piste** : réutiliser la palette `ownerColor` par joueur des mines pour les villes.
- **Vérif** : smoke visuel / test de la fonction de couleur par propriétaire.

---

## P1 — Brouillard & possession (ton point n°1)

### F1 — Vision liée aux héros uniquement 🕳️ M — ✅ FAIT
- **Symptôme** : villes/mines/habitations possédées n'éclairent rien ; une ville
  capturée retombe dans le noir dès que le héros part.
- **Cause** : `revealAround` appelé seulement au pas de héros
  (`adventure/movement.ts:63`) et au départ (`core/engine.ts:426`). `economy.ts`
  ne touche jamais `player.explored`.
- **Piste** : révéler autour des villes/mines possédées (rayon dédié) au
  `StartGame`, à la capture et au `DayStarted`. Décider si la vision de bâtiment
  est **persistante** (drapeau) ou recalculée (comme la vision de héros côté rendu).
- **Vérif** : test « capturer une ville révèle son voisinage » + smoke fog.

### F2 — Pas de bâtiment donneur de vision (tour de guet) 🕳️ S — ✅ FAIT
- Type d'objet « avant-poste/tour de guet » inexistant. À ajouter en données une
  fois F1 en place (un `visitable` à effet `vision` ou une propriété d'objet).

---

## P2 — Combat (tes points n°3 et n°4)

### C1 — Héros absent du champ de bataille, sans action physique 🕳️ L
- **Symptôme** : le héros n'est pas dessiné sur la grille ; sa seule action est
  1 sort/round via un bouton DOM. Pas d'attaque héroïque, pas de « défendre ».
- **Cause** : ordre de jeu itère uniquement `combat.stacks` (`combat/turns.ts:43-98`) ;
  `CombatScene.ts` ne construit des jetons que pour les piles (`buildStackToken`).
- **Piste** : décision de design — modèle HoMM3 (héros hors-grille, sort + bonus
  passifs, ce qui est déjà ~le cas → il « manque » surtout la présence visuelle
  et l'action « attaque de héros » optionnelle) vs modèle HoMM5/HO (héros sur la
  grille). **À cadrer.** Minimum viable : sprite de héros aux flancs + action
  « attaque du héros » optionnelle.
- **Vérif** : selon design retenu.

### C2 — Livre de sorts = liste plate, ciblage pauvre 🎨/🕳️ M
- Liste verticale groupée école/cercle (`ui/SpellBook.tsx:170-213`), pas de
  feuilletage par école, pas d'onglets. Ciblage = liste texte de piles
  (`TargetList:218-252`) : **pas de ciblage d'hex, pas de sorts de zone/masse**,
  pas de séparation combat/aventure, pas d'indication de maîtrise.
- **Piste** : dépend de C7 (sorts de zone) et du design du grimoire (doc 08 §2.3).

### C3 — Pas de reddition ni de fuite 🕳️ M
- Aucune commande surrender/retreat (`combat/commands.ts`). Impossible de quitter
  un combat en abandonnant/rachetant l'armée.

### C4 — Siège rudimentaire 🕳️ L
- « Murs » = bonus de défense plat `+3 × niveau de Fort` (`town/capture.ts:11-24`
  → `combat/damage.ts:254`). Pas de murs sur la grille, porte/herse, douves, tours
  de tir, catapulte/bélier jouables. Machines de guerre existent hors-combat
  seulement.

### C5 — Obstacles ne bloquent pas la ligne de tir 🐞 S
- Obstacles bloquent le déplacement (`combat/actions.ts:34-35`) mais aucun test de
  ligne de vue dans `canShoot` (`actions.ts:79-82`). Tir bloqué de façon binaire
  si ennemi adjacent, sans notion de LoS ni de malus de distance.

### C6 — Malchance inexistante 🐞 S
- « Chance » ne fait que ×2 dégâts, bornée [0,3] (`combat/damage.ts:177,288-292`).
  Pas de demi-dégâts (malchance), pas de critique distinct.

### C7 — Sorts mono-cible uniquement 🕳️ M
- Tous les `damage` visent un seul `targetStackId` (`hero/index.ts:60,208`). Pas
  de zone/masse/chaîne. Bloque C2 (ciblage) et H1 (sorts iconiques).

---

## P3 — Carte d'aventure

### M1 — Un seul héros par joueur, pas de recrutement 🕳️ L
- `StartGame` crée un unique `hero-${p.id}` (`core/engine.ts:389-419`). Aucune
  commande `RecruitHero` ; Taverne à effet `none` (`town/types.ts:28-30`). Pas de
  résurrection de héros vaincu, pas de pool de héros à la taverne.

### M2 — Gardiens non attachés aux trésors 🕳️ M
- `guardian` est un objet autonome sur sa tuile (`map.ts:24-37`) ; mines/trésors/
  artefacts/ressources se ramassent « en passant » sans garde intrinsèque
  (`adventure/movement.ts:86-162`). Aucun lien gardien↔objet gardé.

### M3 — Aucune navigation ni topologie avancée 🕳️ L
- Eau infranchissable (`data/core/config.json:13`), pas de bateau/chantier naval,
  pas de téléporteur/monolithe, pas de souterrain (carte mono-niveau,
  `map.ts:149-162`), pas de gué.

### M4 — Objets visitables pauvres 🕳️ M
- 4 effets génériques (`luck`/`movement`/`levelXp`/`resource`, `map.ts:44-52`).
  Manque : sanctuaire de sort, cabane de sorcière, bonus permanents (arène, statue
  de moral/chance, etc.).

### M5 — Habitations hors ville non capturables 🕳️ S
- `dwelling` de carte = stock recruté en passant sans propriétaire ni drapeau ni
  revenu (`adventure/visitable.ts:67-92`, `mapObjects.ts:143-156`).

---

## P4 — Héros (sorts / compétences / artefacts)

### H1 — Sorts iconiques absents 🕳️ M
- 23 sorts, 6 écoles, mais **1 seul sort d'aventure** (Ville-portail ;
  `AdventureEffect` = union à 1 variante, `hero/types.ts:25`). Manque :
  résurrection/relève (le soin retire une pile morte, `hero/index.ts:236-240`),
  invocation, sorts de masse/zone/chaîne (dépend C7), dissipation réelle
  (`dissipation` n'est qu'un debuff stat).

### H2 — Pas de compétence Sagesse → cercles 4-5 morts 🕳️ M — ✅ FAIT (mécanisme ; contenu 4-5 = H1)
- Champs `spellCircleUnlock`/`learnCircle` déclarés mais jamais lus
  (`hero/types.ts:58-59`) ; `circle` n'est pas un gate de lancement
  (`hero/index.ts:40-71`). Aucun sort de cercle > 3 en données. Manque aussi
  `magic-neutral`/`magic-traque`, Mysticisme, Diplomatie, etc.

### H3 — Artefacts : 4, stats pures, non équipables, sans sets 🕳️/🎨 M
- Bonus de stats sommés uniquement (`hero/artifacts.ts:21-47`) ; aucun effet
  spécial, aucun set, 10 slots indifférenciés, **inventaire lecture seule**
  (pas de commande Equip/Unequip, `ui/HeroInventory.tsx:11-13`).

### H4 — Ni spécialités, ni classes, ni biographies 🕳️ L
- `HeroState` sans `specialty`/`name`/`bio` (`core/state.ts:65-95`) ; profil
  d'attributs unique (`adventure/config.ts:79`, « classes différées »).

### H5 — Attributs de niveau auto-tirés (pas de choix joueur) 🎨 S
- `rollAttribute` pondéré au RNG (`adventure/experience.ts:29-42`) ; pas
  d'allocation manuelle. Montée en chaîne écrase les propositions en attente
  (`experience.ts:69-72`).

---

## P5 — Villes / économie (compléments)

### T1 — Pas de Graal 🕳️ L — aucun bâtiment/effet grail dans `data/` ni moteur.
### T2 — Pas de bâtiments de bonus au héros 🕳️ M — moral/chance/XP de ville absents.
### T3 — Pas de caravanes ni transfert inter-villes 🕳️ M — `GarrisonTransfer` limité à garnison↔héros sur la même tuile (`town/transfer.ts:21`).
### T4 — Croissance : cumul plafonné à 2× hebdo (conforme HoMM) mais pas d'affichage base/accumulée 🎨 S.

---

## Ordre de traitement proposé

1. **P0 (bugs de règles)** — G1 puis G3 (rapides, corrigent un comportement
   faux et visible), G2 après cadrage design.
2. **P1 brouillard** — F1 (ton irritant n°1), F2 dans la foulée.
3. **P2 combat** — C5/C6 (petits bugs) d'abord, puis cadrer C1 (design héros en
   combat) et C7 (zone) qui débloquent C2/H1.
4. **P3/P4/P5** — features par lots, chacune avec son plan `.claude/plans/`.

Chaque item = une PR atomique (guidelines §5/§6/§7 : plan, golden re-fixé si
moteur touché, smoke, budget). Les items 🕳️ « feature » impliquant du design
(G2, C1, M1, M3, T1) passent par un cadrage utilisateur avant code.

## Journal
- **2026-07-08** — Backlog créé depuis 4 audits de code parallèles. Les 4
  exemples utilisateur confirmés dans le source. Rien encore implémenté.
- **2026-07-08** — **G2 + H2 livrés** (guilde des mages + Sagesse) : pool de
  sorts seedé par niveau de guilde (`town.spellPool`, save v9), apprentissage
  automatique à la visite (`learnGuildSpellsAtTown`), compétence `wisdom`
  débloquant les cercles 4-5 (`heroLearnableCircle`, base 3), onglet Guilde
  informatif. Vérif : typecheck 5/5, lint, 358 tests moteur + 83 contenu (dont
  `mage-guild.test.ts`), content:check, build, smoke **106** (nouveau test
  guilde). Golden re-fixé (`33739bfa`, forme `spellPool`). Docs 02 §1.4/§4.1 +
  07 §4 mises à jour. Contenu des sorts de cercle 4-5 = **H1** (Sagesse reste
  inerte tant qu'ils n'existent pas).
- **2026-07-08** — **G1 livré** : bâtiments tagués `factionId` opaque dans le
  catalogue (`content/loader.ts buildBuildingCatalog`), rejet moteur
  `wrongFactionBuilding` (`engine/town/build.ts`, code ajouté à `CommandError`),
  filtre UI par faction (`TownScreen.tsx townBuildingIds`). Tests : moteur
  (rejet faction étrangère + autorisation de la sienne), contenu (tagging).
  **G3 livré** : donjon de ville coloré à la bannière du propriétaire via
  `playerColor` (`render/townsLayer.ts` + `AdventureScene.ts`), plus de binaire
  humain/non-humain. Vérif : typecheck 5/5, lint, 348 tests moteur + 83 contenu,
  content:check, build (254 Ko gzip), smoke 104 passed. Golden intact (fixtures
  sans `factionId`). G2 (guilde des mages) : demande un cadrage design → en attente.
