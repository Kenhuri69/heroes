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

- [ ] **Cadrage (principal)** : ce plan + surfaces ci-dessus, vert.
- [ ] **Lot E (sonnet) — moteur XP/niveau** : gain d'XP à la victoire dans la
      résolution de combat (côté héros uniquement), montées de niveau en
      chaîne (cap 30), +1 attribut pondéré au RNG, événements. Tests :
      courbe/cap/multi-niveaux, pondérations (RNG seedé), golden intact ou
      refigé consciemment. Périmètre : `engine/src/combat/turns.ts` (gain à la
      fin de combat), nouveau `engine/src/adventure/experience.ts`, tests.
- [ ] **Lot F (sonnet) — sauvegarde complète (doc 07 §4)** : `idb` + gzip
      `CompressionStream`, slots `auto`/`manual`, autosave à chaque
      `TurnEnded` (`app/autosave.ts` branché au bus), export/import `.heroes`.
      Périmètre : `client/src/app/save.ts` (corps — signatures figées),
      `app/autosave.ts`. Vérif : typecheck/lint/build (smoke en intégration).
- [ ] **Lot G (sonnet) — menu, options, i18n, mobile, toasts** :
      `scenes/menu/` (DOM), Options (langue/taille police/vitesse combat),
      `app/i18n.ts`, strings UI localisées (shell + combat), CSS portrait
      (tiroir héros : armée 7 slots lecture seule + attributs/XP ; bandeau
      repliable), overlay rotation combat, toasts. Périmètre : `client/src/ui/`,
      `client/src/scenes/menu/`, `client/src/app/i18n.ts`.
- [ ] **Intégration (principal)** : flux menu dans `main.ts`, budget bundle
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

(à compléter)
