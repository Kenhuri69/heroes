# Plan — Refonte UX : style uniforme, iconographie, assets, ambiance & immersion

> Plan maître issu de la **revue complète UX design & ergonomie** du 2026-07-07
> (skill `ux-audit` sur le build de prod + lecture du code client). Il découpe
> le chantier en **9 lots thématiques** (UXD-0 → UXD-8), chacun livrable en une
> PR avec son propre plan `.claude/plans/ux-d<n>-<thème>.md`, ses critères de
> vérification et sa mise à jour des docs (`docs/08-ui-ux.md`,
> `docs/12-assets-style-guide.md`) dans le même commit — docs = source de
> vérité (guidelines §8.6).

---

## 1. État des lieux (audit du 2026-07-07)

Méthode : passe `ux-audit` outillée (30 captures = 5 écrans × 2 viewports × 3
crans de police, mesure des cibles DOM), inspection visuelle des captures,
inventaire du code (`packages/client/src/ui/*.css`, `render/*`, glyphes des
`.tsx`).

### 1.1 Ce qui tient déjà (à préserver, pas à refaire)

- **Fondamentaux ergonomiques verts** : cibles DOM ≥ 44 px (1 régression, cf.
  §1.6), tap-tap avant action irréversible, i18n FR/EN, 3 crans de police en
  `rem`, pile de modales ≤ 2, `FactionBadge` à motifs (jamais la couleur
  seule), combat mobile en caméra pan/pinch (U1).
- **Assets peints déjà branchés** : fonds menu/ville/combat/fin de partie,
  logo, 23 sprites d'unités (combat + gardiens de carte), avatars d'archétypes,
  vignettes de bâtiments, mines, tuiles procédurales, icônes ressources/stats
  mipmappées — avec repli procédural gracieux partout.
- **L'écran menu** est le plus abouti : fond peint + logo + voile de
  lisibilité. Il sert de référence de qualité pour les autres écrans.

### 1.2 Style — pas de système, une somme d'écrans

- **Zéro design token** : 0 variable CSS dans les 16 feuilles (1 739 lignes).
  ~30 couleurs hex distinctes recopiées à la main (`#3a3d47` ×37, `#e8e2d0`
  ×36, `#262a33` ×23…), 15 variantes de `rgba(16,18,24,…)` pour « le même »
  voile sombre, 17 déclinaisons de `font:` dupliquées.
- **Aucune identité typographique** : `system-ui` partout, aucun `@font-face`.
  Les titres, boutons et chiffres de combat ont la voix d'un panneau
  d'administration, pas d'un HoMM.
- **Écart DA** : le doc 08 §5 promet « gouache stylisée » ; l'UI DOM est un
  gris neutre générique posé sur des fonds peints — les deux mondes jurent
  (boutons rectangulaires plats sur le fond de titre peint, par ex.).
- Quasi aucune micro-interaction : 1 seule `transition` CSS (tiroir héros),
  pas d'états hover/active/focus-visible cohérents, pas de transitions
  d'écran.

### 1.3 Icônes — trois langages qui cohabitent

- **Emojis** (`⚙`, `🔔`) + **glyphes unicode** (`☰ ⚔ ⌂ ▣ ◆ ⚒ ⛺ ✚ ✦ ▲▼`) +
  **texte brut** se partagent le HUD, les onglets de ville, l'éditeur, le
  livre de sorts. Rendu dépendant de la fonte système (varie par OS), pas de
  style commun, contraste non maîtrisé.
- Alors que le pipeline procédural (`gen_ui_icons.py`, doc 12 règle P) produit
  déjà des icônes ressources/stats **cohérentes et lisibles à 16 px** — il
  n'est simplement pas étendu aux actions, écoles de magie, statuts, onglets.

### 1.4 Assets — le « mi-cuit » placeholder / peint

- Sur la carte d'aventure cohabitent des **sprites peints** (mines, gardiens)
  et des **formes plates procédurales** : héros = écusson épinglé
  (`heroSprite.ts` : « Placeholder héros »), villes = donjon `Graphics`
  (`townsLayer.ts`), coffre/tente/camp/habitation = polygones aplats
  (`mapObjects.ts`). Le contraste des deux styles est plus visible qu'un
  placeholder uniforme.
- Vignettes de bâtiments **trouées** : l'habitation du prologue affiche le
  repli carré marron dans l'écran de ville (asset absent pour les bâtiments de
  scénario).
- Pas de spritesheets animées (bloqué tooling, déjà noté au jalon Beta), pas
  d'avatars par héros nommé, pas de fonds de combat pour tous les terrains.

### 1.5 Ambiance & immersion — le grand absent

- **Aucun audio** : zéro occurrence de `Audio`/`.mp3`/`.ogg` dans le client.
  Pas de musique, pas un son d'interface, pas de jingle de victoire. C'est le
  plus gros écart d'immersion vs HoMM/HO ; le réglage « audio » promis par le
  doc 08 §2.5 (Options) n'existe pas.
- **Letterbox noir** : la carte 32×32 flotte dans du noir pur sur desktop
  (bandes vides au-dessus/dessous et sur les côtés) — pas de bord de monde,
  pas de vignette, pas de cadre.
- **Desktop sous-exploité** : la mise en page cible du doc 08 §2.1 (colonne
  droite ressources / portraits / villes / **mini-map**) n'est pas
  implémentée ; le desktop reçoit le layout mobile étiré. La mini-map
  n'existe pas du tout.
- **Combat** : les hexes quasi opaques masquent la toile peinte livrée en
  U5-E (on devine le décor entre les hexes seulement) ; le bandeau
  d'initiative du doc 08 §2.4 (ordre du round) n'est pas illustré ; pas de
  chiffres de dégâts flottants ni d'impact visuel au coup porté.
- Transitions d'écran sèches (swap instantané menu→carte→combat).

### 1.6 Régressions ergonomiques mesurées (passe outillée)

| # | Constat | Mesure / capture | Code concerné |
|---|---|---|---|
| R1 (A1) | Boutons du **livre de sorts d'aventure** sous 44 px | `adventure-spell-ville-portail` **134×21 px**, 12/30 captures (aussi visible sous la modale ville) | `ui/AdventureSpellbook.tsx` + CSS |
| R2 (A6) | **Barre de ressources mobile** déborde au cran 3 : or tronqué à gauche, mercure coupé à droite, le bouton tiroir recouvre l'or | `adventure-mobile-font3.png` | `.resource-bar` (`ui/styles.css:4`) |
| R3 | **Barre d'actions** (⚙/🔔/Sauvegarder/Charger/Ville/Fin de tour) passe à 2 rangées en mobile et **recouvre le bandeau d'armée** | `adventure-mobile-font3.png` | `.actions` / `.army-band` (`ui/styles.css:54,281`) |
| R4 | Combat mobile : la bannière d'armée gauche **chevauche « Round 1 »**, la droite sort de l'écran | `combat-mobile-font1.png` | `ui/combat.css` (bandeaux) |
| R5 | Combat mobile : **cadrage initial sans aucune unité visible** (caméra plancher 44 px non centrée sur l'unité active) + consigne de prévisualisation tronquée | `combat-mobile-font1.png` | `scenes/combat/CombatScene.ts` (caméra) |
| R6 | Outillage : `capture.mjs` cassé sur l'écran ville (testid `town-open` renommé `town-open-<id>` en U4) — **corrigé dans ce lot** ; écran héros promis par SKILL.md §2 mais absent du script | sortie de la passe | `.claude/skills/ux-audit/capture.mjs` |

---

## 2. Cibles & invariants

**Cible** : une UI qui parle la même langue que les fonds peints — « gouache
sombre, parchemin et laiton » — avec une iconographie unique, plus aucun
placeholder visible sur le chemin de jeu principal, une ambiance sonore, et
des écrans qui occupent leur viewport (desktop comme mobile).

**Invariants non négociables sur tous les lots** (guidelines §8) :

1. Moteur intact : tout est client + données ; zéro faction dans le moteur.
2. Touch-first : cibles ≥ 44 px, parité hover/appui long, tap-tap conservé.
3. Budget bundle **< 800 Ko gzip JS/CSS** : fontes en subset WOFF2 mesurées,
   PNG/audio **hors bundle** (`assetsInlineLimit: 0`, fetch lazy — doc 12 §10).
4. Anti-gel throttling ×4 (arène + carte) : tout effet visuel respecte le
   plancher du smoke ; `prefers-reduced-motion` désactive les animations.
5. i18n FR/EN complète, 0 chaîne en dur ; a11y : jamais la couleur seule,
   3 crans de police, `aria-label` sur tout bouton-icône.
6. Chaque décision de design met à jour `docs/08-ui-ux.md` / `docs/12` dans le
   même commit ; chaque lot a son plan vivant et sa re-passe `ux-audit`
   avant/après.

---

## 3. Lots

### UXD-0 — Correctifs ergonomiques immédiats + outillage d'audit

Le « stop the bleeding » : régressions mesurées §1.6, sans refonte.

- [x] `capture.mjs` : sélecteur ville par préfixe `town-open` (R6, fait dans
      ce lot de revue).
- [x] `capture.mjs` : ajouter l'écran **héros** (tiroir ouvert) — aligner le
      script sur SKILL.md §2.
- [x] R1 : cibles ≥ 44 px du livre de sorts d'aventure.
- [x] R2 : barre de ressources mobile compacte qui **ne déborde jamais**
      (retour à la ligne) et ne passe plus sous le bouton tiroir.
- [x] R3 : réserver l'espace de la barre d'actions (layout en colonne
      bas : armée au-dessus, actions en dessous — plus de recouvrement).
- [x] R4 : bandeaux d'armées de combat en mobile : empilés sous le titre de
      round, jamais en chevauchement ni hors écran.
- [x] R5 : caméra de combat initialement **centrée sur l'unité active** ;
      consigne de prévisualisation non tronquée.

**Vérif** : re-passe `ux-audit` = **0 WARN/FAIL sur 30 captures** ✅ ; smokes
verts (1 flaky pré-existant documenté au plan du lot). **Lot livré** — détail :
`.claude/plans/ux-d0-correctifs.md`.

### UXD-1 — Design system « gouache » (style uniforme)

Le socle : tout ce qui suit s'appuie dessus.

- [ ] `ui/tokens.css` : palette (encres `#101218→#3a3d47`, parchemin
      `#e8e2d0`, laiton/or, sang `#7a2d22`, sémantiques succès/danger/info),
      surfaces + voiles (les 15 `rgba` → 3 tokens), rayons, espacements,
      ombres, échelle de z-index, durées d'animation.
- [ ] **Typographie** : une display serif « chronique médiévale » pour titres/
      boutons/chiffres (WOFF2 **subset latin ~30-50 Ko, servie localement**,
      fallback `Georgia, serif`) ; corps de texte reste `system-ui`. Poids
      compté dans le budget CI.
- [ ] Composants de base : `.btn` (primary/secondary/danger/ghost, tailles),
      `.panel` (fond sombre + filet laiton discret), `.modal`, `.tabs`,
      `.badge`, `.field` — états hover/active/focus-visible/disabled définis
      une fois.
- [ ] Refactor des 16 feuilles vers les tokens ; suppression des ~30 hex ad
      hoc et des `font:` dupliqués.
- [ ] **Garde-fou CI** : aucun littéral `#hex`/`rgba(` dans `ui/*.css` hors
      `tokens.css` (grep en CI, même esprit que le garde-fou faction).

**Vérif** : garde-fou vert ; captures avant/après (layout inchangé, habillage
neuf) ; budget bundle ; 3 crans de police re-vérifiés.

### UXD-2 — Iconographie unifiée

- [ ] Inventaire des surfaces : actions HUD (fin de tour, ville, sauvegarder,
      charger, options, journal, sorts, tiroir héros), onglets ville
      (`⌂ ▣ ◆ ⚒` actuels), actions de combat (attendre/défendre/auto/
      vitesses), éditeur, écoles de magie, statuts de combat (buff/debuff/
      Marque/Entrave), jour/semaine.
- [ ] Étendre `gen_ui_icons.py` (règle P, déterministe) : recettes `act-*`,
      `tab-*`, `school-*`, `status-*` — même style silhouette + liseré,
      mipmaps 256→16, lisibles à 16 px, `_preview.png` contrôlée.
- [ ] Composant `UiIcon` (résolveur du registre d'assets, repli sur le glyphe
      actuel) ; règle : **icône + libellé** par défaut ; bouton compact =
      `aria-label` + fiche à l'appui long (A2).
- [ ] Purge des emojis/glyphes des `.tsx` (`⚙ 🔔 ☰ ⚔ ⌂ ▣ ◆ ⚒ ⛺ ✚ ✦`…).

**Vérif** : 0 emoji/glyphe décoratif restant dans `ui/` (grep) ; planche
`_preview` validée à l'œil ; a11y (aria-labels) ; captures.

### UXD-3 — Assets de la carte d'aventure (fin des placeholders)

- [ ] Sprite **héros monté** par faction (règle A, bannière aux couleurs du
      joueur en second canal) — remplace l'écusson.
- [ ] **Ville sur carte** par faction (château vignette, drapeau du
      propriétaire, liseré assiégeable conservé) — remplace le donjon
      `Graphics`.
- [ ] Objets restants (règle C) : coffre, camp de gardiens, tente/habitation
      hors ville, artefact au sol, curiosités de bonus.
- [ ] **Bord de monde** : cadre décoratif (falaises/brume) + vignette sombre à
      la place du letterbox noir ; clamp caméra assorti.
- [ ] Variantes/transitions de tuiles supplémentaires si besoin après pose
      (règle P).

**Vérif** : plus aucun `Graphics` placeholder visible sur proto-01 (parcours
smoke) ; repli procédural conservé ; anti-gel carte ≥ plancher ; budget (PNG
hors bundle).

### UXD-4 — Combat immersif

- [ ] Hexes **translucides** (remplissage ≤ 30 % + contour net, motifs pour
      atteignable/cible/obstacle — double canal A5) : la toile peinte U5-E
      devient réellement visible.
- [ ] Fonds de combat des terrains manquants (montagne, route… — règle D).
- [ ] **Bandeau d'initiative illustré** (doc 08 §2.4) : portraits d'unités
      dans l'ordre du round, actif surligné.
- [ ] Feedback de coup : flash bref sur la cible, **chiffres de dégâts
      flottants**, micro-secousse ≤ 150 ms — le tout coupé par
      `prefers-reduced-motion` et sous le plancher anti-gel ×4.

**Vérif** : smoke anti-gel arène ; captures avant/après desktop + mobile ;
A5 re-vérifié (états d'hex jamais couleur seule).

### UXD-5 — Écrans de gestion habillés

- [ ] Ville : slots de bâtiments **positionnés sur le décor peint** (état
      construit/disponible/verrouillé sur la vue, tap = onglet Construire) ;
      combler les vignettes manquantes (habitations de scénario → asset ou
      repli dessiné, plus de carré marron).
- [ ] Écran héros : **poupée d'équipement typée par slot** (10 slots nommés
      sur silhouette, doc 08 §2.3) ; avatars par héros nommé (règle B) quand
      les données existeront.
- [ ] Menu / Options / Journal / SpellBook / Skirmish réalignés sur UXD-1
      (suppression des styles locaux résiduels).

**Vérif** : captures 5 écrans × 2 viewports × 3 crans ; pile de modales ≤ 2 ;
i18n.

### UXD-6 — Ambiance sonore (nouveau chantier)

- [ ] Architecture : registre audio calqué sur `render/assets.ts`
      (`import.meta.glob ?url`, **hors bundle**, fetch lazy au 1er usage),
      lecteur Web Audio côté client uniquement (le moteur n'émet que ses
      événements existants). Déblocage à la 1ère interaction (politique
      autoplay).
- [ ] Contenu : musique par contexte (menu, aventure, combat, ville — par
      faction/biome si le sourcing le permet) ; SFX UI (tap, confirmer,
      erreur, toast), carte (pas, ramassage, fin de tour), combat (impact,
      tir, sort, mort), jingles victoire/défaite.
- [ ] Options : volumes musique/SFX (0-100, persistés `localStorage`),
      **coupé par défaut ou modéré** — décision à trancher au lancement du
      lot ; doc 08 §2.5 mis à jour.
- [ ] Doc 12 : nouvelle **règle F (audio)** — sourcing (génération / banques
      CC0 : à valider avec l'utilisateur), formats (`.ogg` + repli `.m4a`),
      budgets de poids par famille, staging `assets/audio/`.

**Vérif** : budget JS intact ; smoke « pas d'erreur autoplay » ; volumes
persistés ; jouable coupé sans perte d'information (le son ne porte jamais
seul une info — A5 étendu).

### UXD-7 — Micro-interactions & transitions

- [ ] Transitions d'écran (fondu 150-250 ms) : menu ⇄ aventure, entrée/sortie
      de combat, ouverture modales/tiroir — pilotées par le routeur existant.
- [ ] États interactifs des composants UXD-1 partout (hover souris, pressed
      tactile, focus-visible clavier).
- [ ] Toasts icônisés par type + accent ; journal groupé par jour.
- [ ] `prefers-reduced-motion` : tout ce qui bouge se coupe.

**Vérif** : smoke navigation clavier (focus visible) ; anti-gel ; captures.

### UXD-8 — Immersion continue & desktop

- [ ] **Layout desktop cible du doc 08 §2.1** : colonne droite ressources /
      portraits héros / villes / **mini-map** (nouveau composant, rendue
      depuis l'état exploré — cliquable pour recentrer).
- [ ] Écran de chargement/transition illustré + citation lore (ton doc 13).
- [ ] Ambiance temporelle discrète : teinte d'aube/veille de croissance
      (jour 7), purement client.
- [ ] Titre : brume/parallaxe légère sur le fond peint ; favicon + icônes PWA
      (déclinaisons procédurales du logo prévues doc 12 §6).

**Vérif** : smoke desktop (colonne + mini-map) ; anti-gel carte ; budget.

---

## 4. Séquencement & dépendances

```
UXD-0 (correctifs)  → immédiat, indépendant
UXD-1 (tokens)      → fonde UXD-2, 5, 7
UXD-2 (icônes)      → après UXD-1
UXD-3 (carte) ┐
UXD-4 (combat)┴─ parallèles, après UXD-2 (assets indépendants des tokens)
UXD-5 (gestion)     → après UXD-1/2 ; la poupée d'équipement peut suivre
UXD-6 (audio)       → indépendant (peut démarrer à tout moment)
UXD-7 (motion)      → après UXD-1
UXD-8 (desktop+)    → en dernier (s'appuie sur tout le reste)
```

Priorité recommandée : **0 → 1 → 2 → 4 → 3 → 6 → 5 → 7 → 8** (le combat est
l'écran au plus fort retour immersif par euro d'effort ; l'audio peut être
intercalé dès qu'un sourcing est validé).

## 5. Risques & garde-fous

| Risque | Garde-fou |
|---|---|
| Budget bundle crevé par la fonte | Subset WOFF2 mesuré en CI (le budget existant couvre JS/CSS ; ajouter la fonte à la mesure) |
| Anti-gel ×4 cassé par les effets (particules, secousse, parallaxe) | Chaque lot re-passe le smoke anti-gel ; effets plafonnés + `prefers-reduced-motion` |
| Dérive DA (chaque lot invente sa nuance) | Tokens UXD-1 seuls autorisés (garde-fou grep CI) ; doc 08 §5 enrichi à chaque décision |
| Le painterly LLM ne tient pas la cohérence inter-planches | Règles doc 12 (palettes §2.3, QC), re-run plutôt qu'intégration « à peu près » |
| Audio : droits/poids | Règle F doc 12 avant toute intégration ; sourcing validé par l'utilisateur ; hors bundle |
| Régressions ergonomiques silencieuses | Re-passe `ux-audit` systématique par lot (l'outillage est réparé en UXD-0) |

## 6. Suivi

- [x] Revue complète + captures de référence (ce lot) — constats §1.
- [x] Réparation minimale de l'outillage d'audit (`capture.mjs`, R6).
- [x] UXD-0 — correctifs ergonomiques immédiats (`ux-d0-correctifs.md`).
- [x] UXD-1 — design system « gouache » (`ux-d1-design-system.md`).
- [x] UXD-2 — iconographie unifiée (`ux-d2-iconographie.md`).
- [x] UXD-3 — carte peinte : bord de monde (#94) + assets peints héros/villes/objets (`ux-d3b-assets-carte.md`).
- [x] UXD-4 — combat immersif (`ux-d4-combat-immersif.md`).
- [ ] UXD-5 — écrans de gestion habillés.
- [ ] UXD-6 — ambiance sonore.
- [x] UXD-7 — micro-interactions & transitions (`ux-d7-micro-interactions.md`).
- [ ] UXD-8 — immersion continue & desktop.
