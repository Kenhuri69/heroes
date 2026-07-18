# Revue complète — ergonomie & immersion (2026-07)

> **Session documentaire** : ce document est le livrable. Aucun code n'est
> modifié dans ce lot. Chaque lot du plan (§5) ouvrira, à son implémentation,
> son propre plan `.claude/plans/<lot>.md` (guidelines §5) et mettra à jour
> `docs/08-ui-ux.md` / `docs/12-assets-style-guide.md` dans le même commit
> (docs = source de vérité).

## 0. Méthode

1. **Audit instrumenté** (skill `ux-audit`) sur le build de prod : 96 captures
   Playwright (16 écrans × desktop 1280×800 / mobile 360×640 × 3 crans de
   police), mesures A1 automatiques. Résultat : **0 cible < 44 px, 0 étape en
   échec** (sortie du script, exit 0).
2. **Inspection visuelle** d'une sélection de captures (menu, carte réelle,
   ville réelle, héros, pré-combat, combat, marché, hot-seat, quêtes, fin de
   partie, options — desktop + mobile, crans 1 et 3).
3. **Inventaire du code client** (écrans, patterns d'interaction, feedback,
   accessibilité, options) et **inventaire immersion** (audio, assets vs
   replis, animations/VFX, narratif, identité UI).
4. **Bilan des ~40 chantiers UX passés** (doc 08 + plans `ux-*`,
   `game-feature-gaps.md`) pour ne pas re-proposer du livré ni rater les
   différés actés.

### Résultat de la checklist doc 08 (A1–A8)

| # | Exigence | État |
|---|---|---|
| A1 | Cibles ≥ 44 px | ✅ 0 warning (DOM) ; hexes combat couverts par min-scale U1 (`CombatScene.ts:55-57`). Le bug V-1 (`.resource` ~36 px) signalé par `ux-audit-accueil-ville.md` est **déjà corrigé** (`styles.css:56-59`) — l'ancien audit est périmé sur ce point. |
| A2 | Parité hover / appui long | ✅ appui long 450 ms souris+tactile (`input/pointer.ts:63-109`) ; aucun `title=`/`:hover` porteur d'info exclusive repéré. |
| A3 | Tap-tap avant action irréversible | ✅ déplacement/attaque/sort/placement (préviz chemin+jours, aperçu dégâts). ⚠️ nuance E8 : pas de garde-fou supplémentaire sur une attaque « suicidaire ». |
| A4 | Pile de modales ≤ 2 | ✅ `MAX_MODAL_DEPTH = 2` structurel (`app/router.ts:33-45`), retour Android/Échap unifiés. |
| A5 | Jamais la couleur seule | ✅ généralisé (FactionBadge à motifs, formes de camp, glyphes ★/⚑/☠, pastilles + libellés). |
| A6 | 3 crans de police | ✅ 100/112,5/125 % en `rem`, aucun débordement bloquant constaté sur les captures cran 3. 🟡 nuances : libellés de vignettes de ville qui s'empilent sur l'art (I6), astuce raccourcis coupée au bord du cadre Options mobile cran 3 (scrollable). |
| A7 | Zoom/pan tactiles | ✅ même `Camera` carte et combat (pan/pinch/molette). ⚠️ reste E10 : pan de combat non borné + re-fit sur resize qui réinitialise le pan (différé U1). |
| A8 | i18n complète | ✅ audit i18n CI, bascule FR/EN OK. |

**Lecture d'ensemble** : le socle ergonomique normé (cibles, tap-tap, retour,
a11y, i18n) est **tenu** — la dette n'est pas dans les fondations mais dans le
**confort de jeu** (combat mobile, navigation au pouce, gestion) et dans
l'**immersion** (placeholders visibles, combat statique, moments forts nus).

## 1. Forces (à préserver, ne pas rouvrir)

- Navigation robuste : routeur + pile ≤ 2, retour Android, overlays forcés
  justifiés ; combat dérivé de l'état moteur.
- Tap-tap systématique avec préviz (chemin en jours, aperçu de dégâts sans RNG).
- Accessibilité exemplaire pour un jeu web : reduce-motion double source,
  motifs non chromatiques, `aria-*` abondants, 3 crans de police réels.
- Audio complet et discret (6 musiques contextuelles, 10 SFX, volumes persistés,
  jamais canal unique).
- Identité « gouache + laiton & parchemin » cohérente (chrome `border-image`,
  Cinzel, icônes mipmap), menu titre et fonds peints de belle qualité.
- Confort déjà acquis : « Tout recruter », bilan de combat, journal + badge,
  indicateur de tours IA non bloquants, mini-map, raccourcis + aide `?`.

## 2. Constats — ergonomie

Sévérité : 🔴 gêne récurrente en partie · 🟠 friction notable · 🟡 polish.
Chaque constat cite sa preuve (capture de l'audit et/ou fichier:ligne).

- **E1 🔴 Combat mobile : la barre d'action dévore l'écran.** 10 boutons +
  3 vitesses s'empilent sur ~5 rangées ≈ moitié basse du viewport 360×640 ;
  le plateau est réduit à un bandeau et le bandeau d'aide (« Sélectionnez une
  cible… ») flotte au centre du champ de bataille, sur les jetons.
  Preuve : `combat-mobile-font1.png` ; `ui/combat.tsx:248` + `combat.css:277`.
- **E2 🟠 Boutons de combat désactivés sans raison.** `Prière`, `Sort (unité)`,
  `Fuir`, `Se rendre` grisés sans explication accessible (pas de sous-libellé,
  pas d'appui long) — la ville, elle, affiche ses prérequis. Au passage le
  libellé `Se rendre (0 or)` est absurde quand le coût est nul.
  Preuve : `combat-desktop-font1.png` ; `ui/combat.tsx:255-284`.
- **E3 🟠 File d'initiative mobile tronquée sans affordance.** Les chips
  suivantes sont coupées au bord droit, rien n'indique qu'on peut défiler ;
  pas de portraits (cf. I5). Preuve : `combat-mobile-font1.png`.
- **E4 🟠 Navigation au pouce incomplète sur la carte.** « Héros suivant avec
  mouvement » n'existe qu'au clavier (`N`, `shell.tsx:85-94`) ; aucun bouton
  HUD « centrer sur mon héros » / « aller à la ville » (T ouvre la modale, le
  recentrage ne passe que par la mini-map). Sur mobile, enchaîner plusieurs
  héros = ouvrir le tiroir à chaque fois.
- **E5 🟠 Garnison : transfert slot par slot.** Un bouton par slot
  (`TownScreen.tsx:857-937`), pas de « tout transférer » héros↔garnison ni
  d'« équilibrer » — la préparation d'armée avant bataille est laborieuse.
- **E6 🟡 Marché peu tactile.** `<input type=number>` + `<select>`
  (`TownScreen.tsx:1084-1130`) : au doigt, mieux vaut steppers ±/Max et taux
  affiché en continu. Preuve : `market-desktop-font1.png`.
- **E7 🟡 Tiroir héros dense, non repliable.** Armée/compétences/équipement/
  grimoire/quêtes/mini-map en une colonne à défilement ; sections repliables
  différées (M8, doc 08 §2.5). Preuve : `hero-real-mobile-font1.png`.
- **E8 🟡 Pas de garde-fou « attaque perdue d'avance ».** Le tap-tap + aperçu
  suffit au quotidien, mais aucune alerte optionnelle quand la préviz annonce
  la perte quasi certaine de la pile (ou un combat à puissance écrasante à
  l'écran pré-combat, qui affiche déjà `armyStrength`).
- **E9 🟡 Bruit de toasts.** Revenus quotidiens multi-lignes non agrégés et
  combats IA-vs-neutres encore notifiés (différés U3,
  `ux-u3-feedback.md` §Reporté).
- **E10 🟡 Combat : pan non borné, re-fit au resize.** Parité carte/combat
  incomplète (différé U1, `ux-u1-combat-mobile.md` §Reporté).
- **E11 🟡 Grimoire plat.** Liste unique sans regroupement école/cercle ni état
  de maîtrise ; ciblage en liste texte (constat C2 de `gap-audit.md`, toujours
  vrai dans `SpellBook`).
- **E12 🟡 Poupée d'équipement en lecture seule.** Équiper/déséquiper depuis la
  poupée/l'inventaire différé (`ux-d5b-poupee-equipement.md`).
- **E13 🟡 Micro-polish menu/ville restants** (`ux-audit-accueil-ville.md`,
  hors V-1 déjà corrigé) : « Continuer » désactivé ambigu (M-1, visible sur
  `menu-desktop-font1.png`), séparateur orphelin ville mobile cran 3 (V-3),
  pastille « disponible » évoquant un spinner (V-4).
- **E14 🟡 Journal de combat sans filtres** ni copie/export
  (`ux-combatlog.md` §Différés).
- **E15 🟡 Découvrabilité des raccourcis sur desktop.** L'aide `?` n'est
  atteignable qu'au clavier ; Options ne fait qu'une astuce texte
  (`OptionsPanel.tsx:201`). Pas de bascule plein écran non plus.

## 3. Constats — immersion

- **I1 🔴 Le vide noir mange la scène.** Sur petites/moyennes cartes au zoom
  par défaut, le losange flotte dans un noir dominant ; les falaises du « bord
  de monde » ne garnissent qu'une frange. C'est le premier écran vu en partie
  réelle. Preuve : `adventure-real-desktop-font1.png`,
  `quests-mobile-font1.png` ; `render/worldBorder.ts`.
- **I2 🔴 Combat statique.** Sprites d'unités = une image fixe (pas d'idle,
  ni de frames d'attaque/mort — spritesheets bloquées par le tooling) ; mort =
  simple fondu alpha (`CombatScene.ts:1001`). Le plateau est vivant par les
  chiffres flottants, pas par les combattants.
- **I3 🔴 Aucun VFX de tir ni de sort.** Un tir = son + chiffre (aucun
  projectile ne traverse le plateau) ; un sort = ruée du héros + chiffre
  (`CombatScene.ts:800`). Ni particules ni impact.
- **I4 🟠 Fonds de combat manquants pour 9 terrains** (seuls
  grass/swamp/dirt/forest/sand peints ; snow/rough/water/mountain/rocks =
  aplat CSS) — AS-COMBATBG (`game-feature-gaps.md` §2.10, `main.ts:150-178`).
- **I5 🟠 Bandeau d'initiative sans portraits.** Chips textuelles ; le lot
  « bandeau illustré » (portraits dans l'ordre du round) est un différé acté
  d'UXD-4. Preuve : `combat-desktop-font1.png`.
- **I6 🟠 L'écran de ville n'est pas un lieu.** Bande horizontale de vignettes
  sur fond peint, libellés empilés sur l'art (3 lignes au cran 3 mobile) ;
  le panorama cliquable (UX-TOWNVIEW + AS-TOWNBG) reste le différé majeur.
  Preuve : `town-real-mobile-font3.png`, `TownScreen.tsx:324`.
- **I7 🟠 Placeholders visibles en partie réelle.** (a) vignette du héros =
  cercle gris dans le HeroStrip (`hero-real-mobile-font1.png`) ; (b) icônes
  hachurées orange côté « Vos forces » au pré-combat
  (`prebattle-desktop-font1.png`) ; (c) bâtiments événement / marqueurs de
  carte en glyphes gris encadrés jaune (`quests-mobile-font1.png`) ;
  (d) 2 vignettes de bâtiments core manquantes (AS-BUILDINGS) ; (e) faction
  Sylvan Court intégralement en repli procédural (AS-SYLVAN).
- **I8 🟠 Audio sans identité.** Une seule piste ville/combat toutes factions,
  aucune ambiance par biome, pas de mute rapide ; événements muets :
  construction, recrutement, montée de niveau (`app/audio.ts:138-186`).
- **I9 🟠 Le passage hot-seat est un écran nu.** Texte blanc sur noir, sans
  couleur ni blason du joueur entrant — le moment le plus « cérémoniel » du
  multi local. Preuve : `handoff-mobile-font1.png`, `HandoffOverlay.tsx`.
- **I10 🟠 Fin de partie sous-exploitée.** Petit panneau (le fond peint
  victoire/défaite n'est qu'une vignette), pas de pertes cumulées (différé
  UX-ENDSTATS — demande un suivi moteur générique, `ux-endstats.md`).
  Preuve : `outcome-desktop-font1.png`.
- **I11 🟡 Écran titre statique** (aucune vie : ni parallaxe, ni particules,
  ni variation) — `MenuScreen.tsx`.
- **I12 🟡 Monde figé.** Eau/rivières sans animation, pas d'oiseaux/brume,
  pas de jour/nuit (tuiles statiques, `render/tilemap.ts`).
- **I13 🟡 Siège rudimentaire.** Assaut de ville = combat standard + bonus de
  murs abstrait pour l'essentiel du ressenti (constat C4 historique) — un
  chantier design/moteur, pas un correctif client.
- **I14 🟡 Transitions sèches.** Crossfade menu⇄aventure différé (d7) ;
  chargement/cutscenes en CSS nu (AS-OVERLAYS).
- **I15 🟡 Pas d'haptique mobile** (`navigator.vibrate` absent) — micro-retour
  utile sur confirmations/coups critiques, à coupler à reduce-motion.

## 4. Rejets actés — à ne PAS re-proposer

- Rail droit desktop « ressources + villes » (rejeté 3×, décision 2026-07-09).
- Carte peinte continue à mouvement libre (décision A2, casse le moteur tuile).
- Temps réel / timers de construction / premium (doc 01 §3-4).
- Option « mode daltonisme » (remplacée par motifs non chromatiques permanents).
- Re-planifier l'audio de base (chantier d6 complet).

## 5. Plan d'amélioration — étape par étape

Priorités : **P0** = plus gros gain/effort sur le cœur de jeu ; **P1** =
confort et immersion à coût maîtrisé ; **P2** = habillage et contenu lourd ;
**P3** = à trancher avant d'engager. Sauf mention explicite, tous les lots
sont **client et/ou données uniquement — zéro diff moteur, pas de bump
`CURRENT_SAVE_VERSION`**. Chaque lot : plan dédié + captures avant/après
(`ux-audit`) + pipeline local vert (typecheck, lint, tests, golden, garde-fous,
budget < 800 Ko gzip, smoke) avant PR.

### Lot 0 (P0) — Micro-correctifs sans risque *(E13, E2 partiel — ½ journée)*

1. Libellé `Se rendre` sans montant quand le coût est 0 ; sinon « Se rendre
   (N or) ». → vérif : test unitaire du libellé + capture.
2. M-1 : « Continuer » désactivé → sous-libellé « Aucune sauvegarde » (i18n).
3. V-3/V-4 : séparateur orphelin ville cran 3 ; pastille « disponible »
   distincte du spinner (forme/pattern, pas seulement couleur).
4. Bouton « ? raccourcis » visible dans Options (desktop) au lieu de la seule
   astuce texte. → vérif : accessible sans clavier, capture.

### Lot 1 (P0) — Combat mobile : rendre le plateau au joueur *(E1, E3, E10 — 2-3 j)*

1. **Barre d'action compacte** : primaires toujours visibles (Attendre,
   Défendre, Attaque héros, Sort héros, Auto), secondaires (Prière, Sort
   d'unité, Fuir, Se rendre, Journal, vitesses) derrière un bouton « ⋯ » en
   tiroir bas ≤ 2 rangées. Cible : barre ≤ ~25 % du viewport 360×640.
   → vérif : mesure de hauteur en test smoke @mobile + capture avant/après.
2. **Bandeau d'aide repositionné** : ancré au-dessus de la barre d'action
   (jamais sur les jetons), une ligne, tronqué proprement.
   → vérif : capture ; aucun chevauchement jeton/texte au cran 3.
3. **Affordance de défilement de l'initiative** : dégradé de fondu au bord +
   défilement automatique vers l'unité active.
   → vérif : l'unité active est toujours visible (assertion smoke).
4. **Pan borné + re-fit conservateur** (E10) : clamp aux bornes du plateau
   (parité carte), le resize conserve le pan si l'unité active reste visible.
   → vérif : test d'intégration caméra (unitaire client) + hexes ≥ 44 px
   maintenus (min-scale inchangé).

### Lot 2 (P0) — Navigation au pouce sur la carte *(E4 — 1-2 j)*

1. Bouton HUD **« héros suivant avec PM »** (cycle, badge nombre restant),
   même logique que la touche `N` (`selectNextHeroWithMoves`).
2. **Tap sur le portrait du héros = centrer la caméra** ; second tap = ouvrir
   le tiroir (pattern tap-tap cohérent).
3. Accès **villes** : appui long sur le bouton « Ville » = liste des villes
   (centrer / ouvrir), utile dès 2 villes.
   → vérif : smoke @mobile « cycler 2 héros et centrer une ville sans clavier » ;
   cibles ≥ 44 px ; doc 08 §2.1 mis à jour.

### Lot 3 (P1) — Feedback : moins de bruit, plus de sens *(E9, E2, E14, E8 — 2 j)*

1. **Toast quotidien agrégé** : une ligne « Revenus du jour : +N or, +X bois… »
   (somme mines + villes + spécialités). → vérif : unitaire d'agrégation +
   1 seul toast par aube en smoke.
2. **Filtrer les combats IA-vs-neutres** des toasts (journal seulement).
3. **Raisons des boutons désactivés en combat** (E2) : sous-libellé court
   (« Pas de mana », « Déjà lancé ce round », « Round 1 ») + appui long =
   explication ; motif exposé par l'état, textes i18n.
   → vérif : unitaire des motifs ; capture.
4. **Option « confirmer les attaques perdues d'avance »** (défaut OFF) : si
   l'aperçu (sans RNG) prédit la destruction totale de la pile attaquante sans
   tuer la cible, 2ᵉ confirmation légère. → vérif : unitaire du prédicat +
   test UI ; jamais déclenché en auto-combat/IA.
5. **Journal de combat** : filtres par type + « copier ». → vérif : unitaire.

### Lot 4 (P1) — Confort de gestion *(E5, E6, E7, E11, E12 — 3-4 j, découpable)*

1. **Garnison** : boutons « Tout vers le héros » / « Tout vers la garnison »
   (fusion intelligente par unité, respect des 7 slots) + « Équilibrer »
   réutilisant la logique HeroSwap. → vérif : unitaires moteur existants
   inchangés (client compose des commandes existantes), test UI.
2. **Marché tactile** : steppers − / + / Max, taux et total mis à jour en
   continu, `input` conservé pour la saisie directe. → vérif : capture mobile,
   cibles ≥ 44 px.
3. **Tiroir héros repliable** : sections accordéon (état persisté localement),
   ordre : armée, équipement, compétences, grimoire, quêtes.
   → vérif : captures 3 crans ; pas de perte de contenu.
4. **Grimoire par école** : onglets/filtres école + cercle, coût en mana
   affiché en tuile, état « non lançable » motivé (mana/1 sort par round).
   → vérif : capture ; test UI de filtre.
5. **Équiper/déséquiper interactif** (E12) : tap inventaire → slots
   compatibles en surbrillance → tap slot (tap-tap, réversible).
   → vérif : préviz des deltas de stats avant confirmation ; unitaires des
   commandes moteur existantes.

### Lot 5 (P1) — Le combat prend vie, sans nouveaux assets *(I2, I3 — 2-3 j)*

Zéro asset, zéro moteur : uniquement `CombatScene` + `motion.ts`.

1. **Idle procédural** des jetons : oscillation subtile (±1-2 px, période
   désynchronisée par index), respiration de l'ellipse de sol ; coupé en
   reduce-motion. → vérif : anti-gel throttling ×4 inchangé (smoke @perf).
2. **Projectiles de tir** : trait/flèche `Graphics` interpolé attaquant→cible
   (~150 ms ÷ vitesse), impact = étoile brève ; le SFX `combat-shoot` reste
   synchronisé. → vérif : déterminisme intact (rendu pur), reduce-motion =
   affichage instantané.
3. **Impacts de sorts** : glyphe d'école + onde brève sur la cible (teinte par
   type dégât/soin/buff), réutilise les couleurs de tokens.
4. **Morts habillées** : bascule du sprite (rotation ~90°) + fondu, au lieu du
   seul alpha.
5. **Micro screen-shake** du conteneur plateau sur kill de pile entière
   (~4 px, 120 ms), sous reduce-motion.
   → vérif globale : captures vidéo manuelles, smoke combat inchangé,
   budget bundle stable.

### Lot 6 (P1) — Chasse aux placeholders *(I7, E2 pré-combat — 2 j + planches)*

1. **HeroStrip** : réutiliser l'avatar résolu du héros (même source que le
   tiroir) à la place du cercle gris. → vérif : capture parcours réel.
2. **Pré-combat** : remplacer les pavés hachurés par l'avatar du héros /
   sprite de l'unité de tête, et afficher la **composition des deux armées**
   (rangée de vignettes + effectifs approximatifs côté ennemi) — fidélité
   HoMM. → vérif : capture ; aucune fuite d'info non scoutée (arrondis
   existants `armyStrength`).
3. **Marqueurs de carte** : vignettes dédiées pour bâtiments événement
   (remplacer les glyphes gris encadrés jaune) — skill `asset-procedural` ou
   planche. → vérif : capture `quests`.
4. **AS-BUILDINGS** : générer les 2 vignettes core manquantes (skill
   `asset-sheet`).
5. **AS-COMBATBG** : 9 toiles de terrain manquantes (planche LLM, doc 12).
   → vérif : bascule par terrain en arène `/#arena`.
6. **AS-SYLVAN** : planche complète Sylvan Court (unités, avatars, ville,
   vignettes) — le plus gros ; découpable en sous-lots par planche.
   → vérif : garde-fou « zéro faction moteur » vert (données/assets purs).

### Lot 7 (P2) — Habiller les moments forts *(I9, I10, I14, E15 — 2-3 j)*

1. **Handoff aux couleurs du joueur** : voile teinté `store.playerColors`,
   blason de faction + nom du siège, motif non chromatique en second canal.
   → vérif : capture hot-seat 2 joueurs.
2. **Fin de partie plein écran** : `victory/defeat.jpg` en fond intégral,
   panneau chrome par-dessus, graphique conservé. → vérif : capture.
3. **Pertes cumulées** (UX-ENDSTATS) : ⚠️ **seul point moteur du plan** —
   extension générique d'agrégat par joueur (ex. compteur de pertes dans
   `PlayerState`, alimenté au `CombatEnded`), neutre faction, golden re-fixé
   une fois (forme seule), bump save à évaluer. À cadrer dans son plan dédié ;
   ne pas l'implémenter côté client seul (mécompte IA-vs-IA documenté dans
   `ux-endstats.md`).
4. **Crossfade menu⇄aventure** (différé d7) : racine de transition commune du
   HUD. → vérif : reduce-motion = coupe nette actuelle.
5. **Titre vivant** (optionnel) : parallaxe 2 plans + particules discrètes sur
   `title.jpg`, coupé reduce-motion et mobile éco.

### Lot 8 (P2) — Un monde qui respire *(I1, I12 — 2-3 j)*

1. **Bord de monde plein cadre** : au-delà des falaises, remplir le hors-carte
   (brume/nuages/dégradé thématique ou anneau de tuiles décoratives) pour que
   le losange ne flotte plus dans le noir ; vignettage léger au bord du
   viewport. → vérif : captures petite/moyenne carte au zoom par défaut,
   perf chunking inchangée (smoke @perf).
2. **Eau vivante à coût nul** : variation lente de teinte/luminosité des
   chunks d'eau (uniform temporel, pas de re-tesselation) ; coupé
   reduce-motion. → vérif : FPS stable sur carte 256 (test @perf existant).
3. **Props ambiants** (optionnel) : 2-3 oiseaux/brumes billboard épars,
   culés avec leur chunk.

### Lot 9 (P2) — Audio d'identité *(I8 — 1-2 j + pistes)*

1. **Mute rapide** : bouton haut-parleur (TurnBar + Options), coupe
   musique+SFX, persisté ; icône barrée + `aria-pressed`.
2. **Thèmes par faction** : `music/town-<faction>` et `music/combat-<faction>`
   avec **repli sur la piste générique** (même pattern que les assets peints —
   zéro churn si la piste manque). Données : rien ; client : résolution par
   `faction` de la ville / du défenseur.
3. **Ambiances par biome** (optionnel) : boucle discrète selon le biome
   dominant au viewport, mixée sous la musique.
4. **SFX manquants** : construction, recrutement, level-up, ouverture/fermeture
   de modale (réutiliser `ui-confirm`/`ui-tap` si planche audio indisponible).
   → vérif : chaque son double un feedback visuel existant (règle d6).

### Lot 10 (P3) — Gros chantiers à trancher avant d'engager

- **Siège jouable** (I13) : murs/porte/tours sur la grille — commence par une
  spec doc 02 §5 (design), puis point d'extension moteur générique. Ne pas
  démarrer côté client.
- **Spritesheets animées** (I2 complet) : débloquer le tooling `asset-sheet`
  (planches multi-frames + extraction) ; l'idle procédural du Lot 5 sert de
  palliatif d'ici là.
- **UX-TOWNVIEW panorama cliquable** (I6) : dépend d'AS-TOWNBG (slots par
  faction) ; d'ici là, Lot 6 réduit le bruit des libellés sur la bande peinte
  (libellés sous la vignette, pas sur l'art).
- **Flanc/dos MMHO** : piste de *design* combat (équilibrage), pas une dette
  UX — décision produit préalable.
- **Haptique mobile** (I15) : `navigator.vibrate` sur confirmations/kills,
  opt-in Options — micro-lot à glisser dans Lot 3 ou 5 si souhaité.

### Ordre recommandé et jalons

| Vague | Lots | Effet joueur |
|---|---|---|
| 1 | 0 → 1 → 2 | Le combat mobile redevient jouable confortablement ; la carte se pilote au pouce. |
| 2 | 3 → 4 | Le jeu « répond » : moins de bruit, raisons visibles, gestion fluide. |
| 3 | 5 → 6 | Le combat prend vie ; plus aucun placeholder en partie réelle (hors Sylvan planches longues). |
| 4 | 7 → 8 → 9 | Les moments forts (hot-seat, victoire) et le monde gagnent une âme. |
| 5 | 10 | Chantiers lourds arbitrés séparément. |

## 6. Suivi

- [x] Audit instrumenté exécuté (96 captures, 0 warning A1, exit 0)
- [x] Inventaires ergonomie / immersion / différés consolidés
- [x] Constats E1-E15, I1-I15 consignés avec preuves
- [x] Plan par lots avec étapes et critères de vérification
- [x] Arbitrage utilisateur : « reprends le plan » ⇒ implémentation dans l'ordre
      recommandé, en commençant par le Lot 0.
- [~] Ouverture des plans dédiés par lot au fil des implémentations
  - [x] **Lot 0 (P0)** — micro-correctifs (`ux-lot0-microfixes.md`) : E2 (« Se rendre »
        sans montant), M-1 (« Continuer » grisé → « Aucune sauvegarde »), V-3/V-4
        (pip disponible plein + séparateurs ville mobile), E15 (bouton « Voir les
        raccourcis » + fond opaque du panneau raccourcis). **Livré.**
  - [x] **Lot 1** — combat mobile. **1a** (`ux-lot1a-combat-mobile.md`) : E1 (barre
        compacte, secondaires derrière « ⋯ », 50 %→18 % du viewport) + E3 (fondu +
        auto-scroll de la file d'initiative). **1b** (`ux-lot1b-combat-camera.md`) :
        E10 (pan de combat borné + re-fit conservateur au resize) + **harnais de
        tests unitaires client** (vitest) monté au passage.
  - [x] **Lot 2** — navigation au pouce (`ux-lot2-thumb-nav.md`, E4) : bouton HUD
        « héros suivant avec PM » (badge), tap portrait = recentrage caméra, appui
        long ville = recentrage (tap = ouvrir). `useLongPress` extrait/partagé.
  - [~] **Lot 3** — feedback. **3a livré** (`ux-lot3a-toast-noise.md`, E9) : revenus
        du jour agrégés en UN toast/entrée (au lieu d'un par mine/ville) + combats de
        l'IA filtrés des toasts (bus `onBatch` + `meta.humanCombat`). Reste : E2
        (raisons des boutons de combat désactivés), E8 (confirmer attaque perdue),
        E14 (filtres de journal).
  - [ ] Lots 4→10 : à suivre.
