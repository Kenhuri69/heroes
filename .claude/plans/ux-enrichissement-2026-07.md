# Plan — Enrichissement ergonomie (audit relancé du 2026-07-10)

> Relance complète du travail d'analyse ergonomique (skill `ux-audit` sur le
> build de prod) + plan d'enrichissement en lots atomiques. Ce document est le
> **plan vivant** (guidelines §5) : l'audit ci-dessous est fait ; les lots X1→X8
> sont à livrer chacun en PR dédiée, avec critères de vérification.

---

## 1. Méthode de l'audit (2026-07-10)

- `pnpm build` + `vite preview` (même artefact que la CI), puis
  `capture.mjs` du skill : **30 captures** planifiées (5 écrans × 2 viewports
  1280×800 / 360×640 × 3 crans de police) + mesure automatique des cibles
  DOM < 44 px (A1).
- Le script du skill ayant dérivé (voir constat **E1**), une passe de captures
  complémentaire a couvert l'écran **pré-combat** et le **combat** (desktop +
  mobile) en franchissant `PreBattleScreen`, et a diagnostiqué le faux échec
  « hero-desktop ».
- Inspection du code client : `title=` sans pendant tactile (A2), raccourcis
  clavier (`shell.tsx:78`, `combat.tsx:71`), fiches d'appui long
  (`input/pointer.ts`, `MapObjectCard`, `stack-sheet`), locales FR/EN,
  overflow de la barre de ressources (`styles.css:505`).
- Croisement avec les plans UX livrés (U1→U6, M1→M8, UXD-0→UXD-8) pour ne
  **pas re-proposer du déjà-livré**.

## 2. Verdicts de la checklist doc 08 (A1–A8)

| # | Exigence | Verdict | Détail |
|---|---|---|---|
| A1 | Cibles ≥ 44 px | ✅ (1 faux positif) | Aucune vraie cible sous 44 px sur les 26 captures réussies. L'unique `WARN` (`span[town-build-queue-state]`, 241×19) est un **texte non interactif** attrapé par le sélecteur `[data-testid^="town-build-"]` du script — à corriger dans l'outillage (lot X1). |
| A2 | Parité hover / appui long | ⚠️ **4 écarts** | Infos accessibles **uniquement** via `title=` (donc invisibles au doigt) : lore de bâtiment tronqué (`TownScreen.tsx:468`), lore d'unité (`TownScreen.tsx:642`), montant exact des ressources abrégées « 12k » (`shell.tsx:219` et `:227`), présence du héros en combat (`combat.tsx:139`). L'appui long existe déjà sur la carte (fiche `MapObjectCard`, lot M2) et en combat (`stack-sheet`, lot M1) — ces 4 cas n'ont pas eu le même traitement. Lot X2. |
| A3 | Tap-tap avant action irréversible | ✅ | Déplacement (1er tap = chemin + jours), fuite/reddition confirmées (`combat-leave-confirm`), fin de tour confirmée si un héros n'a pas bougé (`app/end-turn.ts`, option `confirmEndTurn`). |
| A4 | Pile de modales ≤ 2 | ✅ | Pile `modals` + `back()` (Échap/retour Android ferme le dessus, `shell.tsx:78`). |
| A5 | Jamais la couleur seule | ✅ | `FactionBadge` à motifs partout (y compris pré-combat) ; camp/statut doublés par libellés. |
| A6 | 3 crans de police | ✅ | `rem` propagé : les 3 crans grandissent sans troncature nouvelle ni chevauchement sur les captures. |
| A7 | Zoom/pan tactiles | ✅ | Carte et combat en caméra pan/pinch (lot U1 — CL7 clos ; `render/camera.ts`). |
| A8 | i18n complète | ⚠️ **1 écart + zone grise** | Parité de clés FR/EN OK, mais la **valeur** FR `preBattle.auto` = « Auto-Battle » (anglais affiché en jeu, capture pré-combat). « Round {round} » en FR est discutable (terme toléré en jargon jeu). Lot X5. |

## 3. Constats détaillés (E1→E8)

Chaque constat : preuve (capture/mesure/fichier:ligne) → conséquence joueur.

- **E1 — L'outillage d'audit a dérivé et sous-couvre le jeu réel.**
  - `capture.mjs` échoue sur 9 captures / 30 : les 6 « combat » (l'arène
    `/#arena` affiche désormais `PreBattleScreen`, le script attend
    `combat-round` qui ne vient jamais) et les 3 « hero-desktop » (le
    `hero-drawer-toggle` est `display:none` ≥ 900 px depuis que la colonne
    héros est permanente — `styles.css:482` — le clic échoue à tort).
  - Le sélecteur A1 attrape des `span` non interactifs (faux positif
    `town-build-queue-state`).
  - Écrans récents **jamais capturés** : pré-combat, « Nouvelle partie »
    (`NewGameScreen`), Options, Escarmouche, éditeur de carte, marché/guilde
    (ville équipée), journal de quêtes, dialogues/cutscenes, passage d'appareil
    hot-seat (`HandoffOverlay`), panneau En ligne, overlay victoire/défaite.
  - Le parcours capturé (`?seed=42`) démarre sur **test-faction** : ville
    nommée « Ville de Faction test-faction », avatar héros absent (cercle
    gris), vignette d'habitation en placeholder — ce n'est **pas** le parcours
    joueur réel (menu → Nouvelle partie → faction réelle), donc l'audit juge
    en partie un chemin de dev.
  - Conséquence : l'audit « répétable » ne l'est plus ; les régressions des
    écrans récents sont invisibles.
- **E2 — Écran pré-combat mal fini en mobile 360 px** (capture
  `prebattle-mobile`) :
  - libellés tronqués « Vos … » / « Rec… » (les clés `preBattle.attacker`
    / `preBattle.defender` ne tiennent pas dans les colonnes) ;
  - information dupliquée : « Puissance de combat 340 · 340 » **et** deux
    « 340 » par camp ;
  - asymétrie visuelle : portrait peint côté défenseur, simple badge de
    faction côté attaquant (le héros attaquant a pourtant un avatar dans le
    parcours réel — lot u5d) ;
  - bouton « Auto-Battle » qui casse sur 2 lignes (et en anglais, cf. A8).
- **E3 — Le bandeau armée mobile occulte la carte par défaut** (captures
  `adventure-mobile-font*`) : au premier écran, le panneau « Armée ▼ » est
  **déployé** et couvre ~40 % de la hauteur, avec 7 slots dont 5 vides ;
  le nom d'unité y est tronqué (« Élève de Sombreve… ») sans fiche au tap
  (rejoint A2). La carte utile se réduit à ~1/3 de l'écran.
- **E4 — L'indicateur de mouvement s'étale sur 3 lignes en mobile** :
  « Jour 1 · Semaine 1 » + « PM 1700 / 1700 » wrap dans le coin bas-gauche
  et mange la carte ; le même contenu tiendrait en 1 ligne compacte + barre.
- **E5 — Tiroir héros mobile sans affordance de défilement** (capture
  `hero-mobile`) : la section Équipement passe sous le bord/HUD sans ombre ni
  fondu indiquant qu'on peut défiler ; risque de contenu « perdu » pour le
  joueur.
- **E6 — Lore tronqué inaccessible au doigt** (capture `town-mobile-font1`) :
  la carte de bâtiment coupe la description à « … » ; le texte complet n'existe
  qu'en `title=` (hover). Même motif pour le lore d'unité à l'onglet Recruter.
  (C'est l'écart A2 vu côté joueur.)
- **E7 — Micro-i18n** : `preBattle.auto` FR = « Auto-Battle » ; à trancher
  aussi « Round » vs « Manche » en FR (décision à consigner doc 08/locales).
- **E8 — Hygiène des plans vivants** : le plan maître
  `ux-design-overhaul.md` garde **33 cases non cochées** alors que ses lots
  ont été livrés par les sous-plans `ux-d0…d8` (tous verts) ; idem
  `ux-town-screen-refonte.md` (4 cases de vérification non reportées alors que
  les lots A/B sont ✅). Un lecteur du plan maître conclut à tort que le
  chantier est aux 2/3 en attente.

## 4. Plan d'enrichissement — lots X1→X8

Règles communes à tous les lots : **zéro diff moteur** (client/outillage/data/
docs uniquement — guidelines §8.1), pas de bump `CURRENT_SAVE_VERSION`, budget
bundle < 800 Ko gzip tenu, smoke Playwright vert, toute décision d'interaction
reportée dans `docs/08-ui-ux.md` **dans le même commit** (§8.6). Un lot = une
PR = son plan coché ici.

### Lot X1 — Remise à niveau de l'outillage d'audit *(prérequis, sans risque)*

Objectif : rendre l'audit de nouveau répétable et représentatif du parcours
joueur. Périmètre : `.claude/skills/ux-audit/capture.mjs` + `SKILL.md`.

1. **Franchir le pré-combat** : l'écran `combat` attend `pre-battle`, capture
   `prebattle-*` (nouvel écran à part entière), clique `pre-battle-fight`,
   puis capture `combat-*`.
   → *Vérif : 0 `FAIL` sur combat desktop+mobile ×3 crans.*
2. **Hero desktop** : ≥ 900 px la colonne est permanente — ne pas cliquer le
   toggle (capturer directement), le cliquer seulement < 900 px.
   → *Vérif : 0 `FAIL` sur hero-desktop.*
3. **Sélecteur A1** : restreindre aux éléments réellement interactifs
   (`button, a, [role="button"], input, select` + boutons `town-build-` ;
   exclure les `span` non cliquables).
   → *Vérif : plus de faux positif `town-build-queue-state` ; une vraie
   régression < 44 px reste détectée (test manuel en rapetissant un bouton).*
4. **Étendre la couverture** : ajouter les écrans `newgame` (menu → Nouvelle
   partie), `options`, `market`/`mageGuild` (ville équipée — construire via
   commandes ou scénario dédié), `quests` (journal), `outcome`
   (victoire), `handoff` (hot-seat) — chacun × 2 viewports × 3 crans, dans la
   même grille de sortie.
   → *Vérif : les nouveaux PNG existent et le README du skill liste la
   nouvelle grille.*
5. **Parcours joueur réel** : un mode de capture passe par `NewGameScreen`
   (faction réelle, ex. Haven) au lieu de `?seed=42`, pour que ville/avatars/
   vignettes soient jugés sur le vrai contenu.
   → *Vérif : capture `town` affichant un nom de ville localisé (pas
   « test-faction ») et un avatar de héros non vide.*

### Lot X2 — Parité tactile de l'information (clôt A2)

Objectif : plus aucune info exclusive au `:hover`. Réutiliser les motifs déjà
livrés (fiche `MapObjectCard`, `stack-sheet`) — pas de nouveau composant lourd.

1. **Fiche bâtiment au tap** : dans l'écran ville, taper la carte (ou un bouton
   « ⓘ » ≥ 44 px) ouvre une fiche avec nom, lore **complet**, coût, prérequis —
   remplace le `title=` de `TownScreen.tsx:468`.
   → *Vérif : mobile sans souris, le lore complet de la Forge est lisible ;
   le `title` redondant est retiré ou conservé en simple complément desktop.*
2. **Fiche unité au tap** (onglet Recruter + slots d'armée du bandeau et du
   tiroir héros) : nom complet non tronqué, stats, lore — remplace
   `TownScreen.tsx:642` et corrige les « Élève de Sombreve… » (E3).
   → *Vérif : tap sur un slot d'armée ⇒ fiche avec nom complet ; smoke ajouté.*
3. **Montant exact des ressources** : tap sur une ressource abrégée « 12k »
   ouvre une mini-fiche (montant exact + revenu/jour, réutilise l'économie
   visible du lot M6) — remplace `shell.tsx:219/227`.
   → *Vérif : tap sur l'or ⇒ montant exact affiché.*
4. **Indicateur héros en combat** : le `title` de `combat.tsx:139` double
   d'un libellé visible (ou entre dans la fiche du bandeau héros).
   → *Vérif : l'info « héros présent » est perceptible sans hover.*
5. Mise à jour doc 08 §1.1 (parité hover/tap : motif « fiche au tap » érigé en
   règle) dans le même commit.

### Lot X3 — HUD aventure mobile : rendre la carte au joueur

Objectif : maximiser la surface de carte utile en 360×640 (constats E3/E4).

1. **Bandeau armée replié par défaut** au premier lancement ; l'état
   déplié/replié persiste (localStorage, comme les autres préférences UI).
   → *Vérif : premier lancement mobile ⇒ carte visible à ~60 % de la hauteur ;
   le choix survit à un rechargement.*
2. **Slots vides masqués** en mode déplié mobile (ils restent visibles en
   desktop et en gestion de garnison où le drag/échange a besoin des cases).
   → *Vérif : armée de 2 piles ⇒ 2 slots affichés, pas 7.*
3. **Indicateur compact jour/PM** : une ligne « J1 · S1 » + barre de PM avec
   valeur abrégée (la valeur exacte reste au tap — cohérent avec X2.3).
   → *Vérif : coin bas-gauche ≤ 2 lignes aux 3 crans de police.*
4. Doc 08 §2.1 (HUD mobile) mis à jour.

### Lot X4 — Finitions écran pré-combat (E2)

1. Layout mobile : libellés `preBattle.attacker/defender` sur leur propre
   ligne, largeur pleine colonne — plus de troncature « Vos … / Rec… » aux
   3 crans.
2. Supprimer la ligne redondante « 340 · 340 » (garder le libellé « Puissance
   de combat » + les deux valeurs par camp).
3. **Portrait de l'attaquant** : avatar du héros attaquant quand il existe
   (parcours réel), repli badge de faction sinon (comportement actuel).
4. Boutons : « Combattre » / « Combat auto » sur une ligne chacun, ≥ 44 px.
   → *Vérif : captures pré-combat desktop+mobile ×3 crans sans troncature ;
   smoke pré-combat existant vert ; libellé FR sans anglicisme (avec X5).*

### Lot X5 — Micro-i18n (E7)

1. `preBattle.auto` FR : « Auto-Battle » → **« Combat auto »** (cohérent avec
   le bouton « Auto ▶▶ » en combat, clé à harmoniser).
2. Trancher « Round {round} » : proposer **« Manche {round} »** en FR ;
   décision consignée dans les locales + doc 08 §2.4 (si refus, consigner le
   choix « Round = terme de jargon assumé »).
3. Passe de recherche d'autres valeurs FR anglophones dans
   `data/core/locales/fr.json` + locales de paquets (`grep` ciblé, revue à la
   main — pas de nouvel outil).
   → *Vérif : audit i18n existant vert (parité de clés), diff de locales revu.*

### Lot X6 — Affordance de défilement du tiroir héros mobile (E5)

1. Ombre/fondu en bas du tiroir tant que du contenu reste sous le pli
   (`mask-image` ou pseudo-élément, CSS pur).
2. S'assurer que le dernier bloc (Équipement) ne passe pas **sous** le HUD
   bas : padding-bottom = hauteur du HUD.
   → *Vérif : capture hero-mobile ×3 crans — la poupée d'équipement est
   atteignable au scroll et rien n'est masqué par le HUD.*

### Lot X7 — Confort desktop : aide raccourcis + héros suivant

Les raccourcis existent (E fin de tour, H tiroir, T ville — `shell.tsx:92` ;
Espace/D en combat — `combat.tsx:71`) mais sont **indécouvrables**.

1. Overlay « ? » (touche `?` ou bouton Options) listant les raccourcis actifs
   par écran ; jamais requis, fermable Échap (respecte A4).
2. Raccourci **N = héros suivant avec PM restants** (rejoint le multi-héros
   U4 ; ignoré s'il n'y a qu'un héros).
3. `title=` d'appoint sur les boutons du HUD desktop mentionnant leur touche
   (« Fin de tour (E) ») — info **complémentaire**, jamais exclusive (A2).
   → *Vérif : overlay listant ≥ 5 raccourcis ; N cycle entre 2 héros dans une
   partie de test ; doc 08 §2.1 mis à jour.*

### Lot X8 — Hygiène des plans vivants (E8, pure doc)

1. Reporter les livraisons `ux-d0…d8` dans les cases du plan maître
   `ux-design-overhaul.md` (cocher + note « livré via ux-dN »), sans réécrire
   l'historique des décisions.
2. Clore `ux-town-screen-refonte.md` (cocher les 4 vérifications si elles
   passent aujourd'hui, sinon consigner l'écart).
   → *Vérif : plus aucun plan « livré mais non coché » dans
   `.claude/plans/` (le comptage de la §3/E8 tombe à zéro).*

## 5. Ordre conseillé & dépendances

1. **X1** (outillage) — prérequis : les vérifs des autres lots s'appuient sur
   ses captures.
2. **X2** (parité tactile) — seul écart réel aux principes doc 08 : priorité.
3. **X3 → X4 → X6** (mobile) — gains joueur directs, indépendants entre eux.
4. **X5** (i18n) — peut se greffer à X4 (même écran) ou vivre seul.
5. **X7** (desktop) — indépendant.
6. **X8** (doc) — à tout moment, idéalement tôt (lisibilité du backlog).

## 6. Suivi

- [x] Audit relancé (build + 26/30 captures + passe complémentaire pré-combat/
      combat/hero-desktop + inspection code) — 2026-07-10.
- [x] Constats E1→E8 consignés avec preuves (captures, fichier:ligne).
- [x] Plan X1→X8 rédigé avec critères de vérification par étape.
- [ ] Lot X1 — outillage d'audit.
- [ ] Lot X2 — parité tactile (A2).
- [ ] Lot X3 — HUD aventure mobile.
- [ ] Lot X4 — pré-combat.
- [ ] Lot X5 — micro-i18n.
- [ ] Lot X6 — tiroir héros mobile.
- [ ] Lot X7 — confort desktop.
- [ ] Lot X8 — hygiène des plans.

> Note de périmètre : cette PR est **documentaire** (ce plan uniquement) ; le
> smoke navigateur (guidelines §7) est omis au titre de l'exception « changement
> purement documentaire ». Aucun code, asset ou donnée n'est modifié.
