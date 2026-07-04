# Plan — Phase 2.5 : Boucle jouable & finitions prototype

Réf : doc 10 §3 (Phase 2.5) et §5.6/§6 ; doc 08 §2.1/§2.5/§3/§4 ; doc 02
§1.1–§1.2 ; doc 07 §4. Orchestration : lots sous-agents Sonnet
(`.claude/prompts/lancer-phase.md`), surfaces figées au cadrage.

## Décisions préalables (points non spécifiés)

1. **Options minimales** : langue FR/EN + taille de police (3 crans, doc 08
   §4) + vitesse d'animation de combat par défaut (×1/×2/×4, réutilise
   `combatSpeed`). Audio (rien à régler), daltonisme (bannières multi-joueurs)
   et le reste = MVP.
2. **Sources d'XP 2.5** : combats uniquement — `XP = PV des unités ennemies
   tuées × xpPerHpKilled` (coefficient **1**, dans `config.json` — le doc 02
   §1.2 ne le chiffrait pas). Coffres (`PickChoice`) et lieux de savoir = MVP.
3. **Attributs** : +1/niveau, tirage au RNG de l'état, pondérations dans
   `config.json` (`30/30/20/20` — profil « chevalier », les classes data-driven
   arrivent avec les paquets héros au MVP). Pouvoir/Savoir stockés mais sans
   effet (sorts = MVP) ; Attaque/Défense héros : câblage combat au MVP
   (décision 2.4 n°13). Courbe `xp(niveau) = 1000 × niveau^1.9`, cap **30**.
4. **`.heroes` (P2, livré)** : JSON gzip `{ saveVersion, packs: [ids],
   snapshot }` ; export `<a download>`, import `<input type=file>` avec
   validation (version + désérialisation) ; refus propre sinon.
5. **i18n UI** : `data/core/locales/{fr,en}.json` (schéma `localeSchema`),
   chargées par `loadContent` ; `app/i18n.ts` : `t(key, params?)`,
   `setLocale`, résolution des `@loc:` du contenu via les locales du paquet ;
   langue initiale = navigateur si fr/en sinon fr, persistée en
   `localStorage`. Repli : clé affichée telle quelle (jamais de crash).
6. **« Continuer »** = sauvegarde la plus récente (auto ou manuelle) ; bouton
   désactivé si aucune.
7. **Toasts** livrés (ressource ramassée, jour/semaine, fin de combat,
   niveau) ; le journal consultable = MVP (écart assumé).
8. **Rotation paysage** : simple overlay CSS dismissible en combat portrait
   (pas d'API Screen Orientation).
9. **Flux de démarrage** : menu d'abord ; `?seed=N` démarre directement une
   partie (smoke reproductible), `#arena` idem + combat.

## Surfaces figées au cadrage (session principale)

- Moteur : `HeroState` + `xp`, `level`, `attributes {attack, defense, power,
  knowledge}` ; `AdventureConfig.hero` (`xpPerHpKilled`, `levelCurve {base,
  exponent}`, `maxLevel`, `attributeWeights`) ; événements `XpGained`,
  `HeroLevelUp`. Golden refigé (forme d'état).
- Contenu : `config.json` + section `hero` ; locales core dans `LoadedContent`.
- Client : store + `locale`, `fontScale`, `toasts` ; API de `app/save.ts`
  figée : `saveGame(state, slot)`, `loadGame(slot)`, `restoreSavedGame(slot)`,
  `restoreLatestSave()`, `exportSave()`, `importSave(file)` avec
  `slot: 'auto' | 'manual'`.

## Lots

- [x] **Cadrage (principal)** : ce plan + surfaces ci-dessus, vert.
- [x] **Lot E (sonnet) — moteur XP/niveau** : gain d'XP à la victoire dans la
      résolution de combat (côté héros uniquement), montées de niveau en
      chaîne (cap 30), +1 attribut pondéré au RNG, événements. Tests :
      courbe/cap/multi-niveaux, pondérations (RNG seedé), golden intact ou
      refigé consciemment. Périmètre : `engine/src/combat/turns.ts` (gain à la
      fin de combat), nouveau `engine/src/adventure/experience.ts`, tests.
- [x] **Lot F (sonnet) — sauvegarde complète (doc 07 §4)** : `idb` + gzip
      `CompressionStream`, slots `auto`/`manual`, autosave à chaque
      `TurnEnded` (`app/autosave.ts` branché au bus), export/import `.heroes`.
      Périmètre : `client/src/app/save.ts` (corps — signatures figées),
      `app/autosave.ts`. Vérif : typecheck/lint/build (smoke en intégration).
- [x] **Lot G (sonnet) — menu, options, i18n, mobile, toasts** :
      `scenes/menu/` (DOM), Options (langue/taille police/vitesse combat),
      `app/i18n.ts`, strings UI localisées (shell + combat), CSS portrait
      (tiroir héros : armée 7 slots lecture seule + attributs/XP ; bandeau
      repliable), overlay rotation combat, toasts. Périmètre : `client/src/ui/`,
      `client/src/scenes/menu/`, `client/src/app/i18n.ts`.
      Livré : `app/i18n.ts` (`initI18n`/`t`/`resolveLoc`/`resolveUnitName`/
      `setLocale`), `ui/MenuScreen.tsx` + `menu.css` (au lieu de
      `scenes/menu/`, pas de rendu DOM séparé du reste de l'UI), `ui/
      OptionsPanel.tsx` + `options.css`, `ui/toasts.tsx` + `toasts.css` ;
      `shell.tsx`/`combat.tsx`/`styles.css`/`combat.css` i18n + tiroir héros +
      bandeau armée repliable + overlay paysage ; `data/core/locales/{fr,en}
      .json` étendus (63 clés chacun). Vérifs vertes : typecheck, lint, build,
      content:check. Écarts notés ci-dessous.
- [x] **Intégration (principal)** : flux menu dans `main.ts`, budget bundle
      < 800 Ko gzip en CI, smoke étendu (menu → nouvelle partie, autosave →
      Continuer, bascule EN, XP après victoire gardien, export/import),
      golden, docs même lot (doc 02 §1.2 coefficient, doc 08 écarts),
      CLAUDE.md, PR draft.

## Écarts assumés

- Journal de notifications consultable : MVP (toasts seuls en 2.5).
- Mini-map dans le tiroir (doc 08 §2.1) : MVP — le tiroir 2.5 contient le
  panneau héros (armée + attributs), il n'y a ni villes ni multi-héros.
- Boutons [Ville] [Sorts] du layout desktop : sans objet en Phase 2.

## Écarts constatés en cours de route

- **Intégration** : scènes construites paresseusement dans main.ts (une partie
  peut naître du menu, d'une sauvegarde, d'un import ou de `?seed`) ; le smoke
  force `locale: fr-FR` (l'i18n suit la langue navigateur — headless = en-US,
  attrapé par le smoke) ; le test d'autosave attend l'écriture IndexedDB
  durable avant de naviguer (course écriture/navigation attrapée par le
  smoke). Export/import couvert par un aller-retour via hook de test
  (`saveRoundtrip`) — le téléchargement réel `<a download>` n'est pas
  exercé en headless (dit explicitement, guideline §7).
- **Lot E** : golden refigé 692c827e (hero.xp renseigné après la victoire
  golden — cause vérifiée par l'agent, pas de désynchro RNG).
- **Lot F** : dépendance `idb` non ajoutée (IndexedDB natif suffisant,
  guideline §2) ; journal de commandes incrémental différé (doc 07 §4 le
  prévoit pour les sauvegardes incrémentales futures).

- **Lot G** : `initI18n` n'est PAS appelé depuis `main.ts` (hors périmètre du
  lot, cf. consigne « branchement en intégration ») — tant que l'intégration
  ne l'appelle pas après `loadGameContent()`, `t()`/`resolveLoc()` retombent
  sur la clé brute (jamais de crash, mais textes non traduits). Le smoke
  test existant régresse donc temporairement sur les libellés (ex.
  `getByTestId('calendar')` afficherait `turnBar.calendar` au lieu de
  « Jour 2 · Semaine 1 ») jusqu'à ce que l'intégration branche `initI18n`.
  Aucun test navigateur complet exécuté par ce lot, comme prévu.
- Export/Import : `saveGame`/`restoreSavedGame` restent dans la barre
  principale (`turnBar`, testids `save`/`load` inchangés pour ne pas casser
  le smoke) ; le panneau Options en jeu ajoute *seulement* Exporter/Importer
  (nouveau), pas de doublon des boutons existants — lecture retenue de
  « Sauvegarder/Charger existants + NOUVEAU : Exporter/Importer … dans le
  panneau d'options (pas dans la barre principale) ».
  `exportSave`/`importSave` rejettent encore (« lot F en cours ») : le
  panneau affiche alors `options.exportError`/`options.importError` tant que
  le lot F n'a pas livré le corps de `save.ts`.
  Contrat d'intégration exact : bouton « Nouvelle partie » du menu émet
  `window.dispatchEvent(new CustomEvent('heroes:new-game'))` — `main.ts`
  doit l'écouter pour construire/lancer `StartGame` (le composant ne connaît
  pas la config/carte).
- Options accessibles depuis le menu (état local à `MenuScreen`) et depuis
  l'aventure (bouton discret ⚙ dans `TurnBar`, état local à `Shell`) — pas
  ajoutées à l'écran de combat (le layout doc 08 §2.4 n'a pas de bouton
  menu/options dans la barre de combat).
- `resolveUnitName` (au-delà des 3 fonctions listées) : ajouté car
  `resolveLoc` seul exige la ref `@loc:` de l'unité, non disponible aux
  points d'appel (vignettes de combat, tiroir) qui n'ont que `unitId` — le
  moteur ne connaît que des ids (doc 06). `i18n.ts` indexe `unitId → nom`
  depuis `LoadReport.content.packs[].units[]` à l'initialisation.
  Fallback : le nom brut de l'unité `unitId` si l'id est inconnu de l'index
  (ne devrait pas arriver avec un contenu validé).
- Traduction des ressources ramassées (toast) limitée aux 7 ressources
  communes (`resource.*` core) : une ressource de faction (ex. `essence`)
  retomberait sur la clé `resource.essence` faute de traduction dédiée —
  cas non rencontré au MVP (les gains de carte utilisent les ressources
  communes).
