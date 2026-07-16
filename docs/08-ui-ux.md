# 08 — UI / UX

## 1. Principes

1. **Touch-first** : cibles ≥ 44 px, aucune information exclusive au hover (tout tooltip a un équivalent « appui long » ou « 1er tap = inspecter »), gestes standards (pinch-zoom, drag-pan).
2. **Deux couches** : le canvas (carte, combat) est plein écran ; l'UI de gestion est en DOM par-dessus (panneaux, modales) — cf. doc 07.
3. **Modèle d'interaction « tap-tap »** partout où une action est irréversible : 1er tap = sélection + prévisualisation (chemin, cible, coût), 2ᵉ tap = confirmation. À la souris : hover = prévisualisation, clic = action (parité avec HoMM).
4. **Lisibilité d'état** : tout ce qui influence une décision (portées, initiative, moral, coûts) est affichable sans quitter l'écran courant.

## 2. Écrans principaux

### 2.1 Carte d'aventure (écran pivot)

```
┌────────────────────────────────────────────────┬──────────┐
│                                                │ RESSOURCES│  desktop :
│                                                │ (colonne) │  barre à droite
│               CANVAS carte                     ├──────────┤
│         (pan/zoom, plein écran)                │ portraits │
│                                                │ héros (8) │
│                                                ├──────────┤
│   [héros sélectionné : armée en 7 slots]      │ villes    │
│                                                ├──────────┤
│ [Fin de tour]  [Ville]  [Sorts]  [Menu]        │ mini-map  │
└────────────────────────────────────────────────┴──────────┘
```

- **Mobile portrait** : ressources en bandeau haut compact (tap = détail), héros/villes dans un tiroir latéral gauche, gros bouton « Fin de tour » en bas à droite, armée du héros en bandeau bas repliable. Mini-map dans le tiroir.
- Sélection héros → tap destination : trace le chemin avec jours nécessaires ; 2ᵉ tap : exécute. Interception d'événements en chemin = arrêt standard HoMM.
- Appui long sur tout objet de carte = fiche (tooltip riche).

> 🚧 **État M6 (plan `ux-revue-mmho.md` C8/C9/C24)** : les grandeurs de décision
> deviennent lisibles. **Tap sur une ressource** ⇒ fiche `ResourceDetail`
> (overlay léger, backdrop/×/Échap) : stock + **revenu/jour** de chaque
> ressource commune, via le helper moteur **pur `dailyIncome`** (villes + mines
> possédées + compétence Économie — miroir sans mutation de l'application du
> revenu au `DayStarted`). La barre de statut affiche les **PM restants / PM max
> du jour** (`dailyMovementPoints`) doublés d'une **jauge** fine ; le tiroir
> héros affiche l'**XP vers le prochain niveau** (« XP {xp} / {seuil} » via
> `xpForLevel`, « niveau max » au cap) + jauge. Les jauges doublent toujours un
> chiffre (2ᵉ canal, jamais la couleur seule §4). Le « +X/j » inline en desktop
> sous chaque ressource reste un raffinement (la fiche au tap le porte déjà).

> 🚧 **État M5 (plan `ux-revue-mmho.md` C10/C11)** : le HUD portrait est
> **compacté**. La barre de ressources tient sur **une seule rangée** à
> défilement horizontal : les grands nombres sont **abrégés** (≥ 10 000 →
> « 12k », ≥ 10 M → « 12M » ; valeur exacte en `title`, fiche détaillée au tap =
> lot M6), padding et police réduits en portrait (hauteur ~32 px au lieu de 2
> lignes). **Revenu inline « +N » (UX-RAIL)** : sur desktop, le revenu quotidien
> projeté (`dailyIncome`, même helper que la fiche `ResourceDetail`) s'affiche à
> côté de chaque stock ; **masqué en portrait compact** (le détail reste au tap).
> Arbitrage UXD-8 tranché : pas de rail droit ressources séparé (le rail droit
> desktop porte héros/mini-carte — l'inline suffit). **Sauvegarder/Charger** quittent la barre de tour (l'autosave de fin
> de tour couvre le cas courant) pour la **section « Données » des Options**
> (à côté d'export/import `.heroes`) : la barre de tour ne garde que les actions
> de contexte (options, journal, ville(s)) et le geste majeur **Fin de tour**.
> La carte récupère la hauteur ainsi libérée. Layout desktop (colonne droite)
> inchangé.

> 🚧 **État M2 (plan `ux-revue-mmho.md` C5/C6/C7)** : la préviz de chemin porte,
> sur un trajet de plusieurs jours, une **étiquette numérique** (« J1 », « J2 »…)
> au dernier pas de chaque journée — la couleur par jour (lot C-3) n'est plus le
> seul canal (A5). Un bouton **« Annuler le déplacement »** apparaît dans le HUD
> pendant la préviz (doc §3 ; pas d'undo après exécution — une révélation a pu
> avoir lieu). L'**appui long** (geste `onLongPress`, ~450 ms, souris et tactile,
> annulé par pan/pinch) sur une tuile **explorée** portant un objet ouvre la
> **fiche d'objet** (`MapObjectCard`) : ressource/quantité, mine (revenu +
> propriétaire vous/adversaire/neutre), gardien (**fourchette** de force, jamais
> l'effectif exact — doc 02 §2.2 — + nom d'unité), trésor (or/XP au choix),
> artefact, habitation (stock), lieu de bonus (effet + fréquence). Le brouillard
> reste opaque : pas de fiche sous une tuile non explorée. Fiche des **villes**
> différée au lot M7 (en-tête de ville).

> 🚧 **État X2 (parité tactile — pilier §1.1, plan `ux-enrichissement-2026-07`)** :
> les **textes de lore tronqués** de l'écran de ville (bâtiments et unités,
> coupés à 2 lignes) sont désormais des **boutons expandables** — un tap/clic
> déplie le texte intégral (cible ≥ 44 px, `aria-expanded`). Le `title` de survol
> subsiste en **complément** desktop, il n'est plus l'unique accès au texte
> complet. Règle générale posée : *toute information tronquée ou masquée derrière
> un `title` doit avoir un accès tactile* (expansion sur place ou fiche au tap),
> comme les fiches d'objet de carte (M2) et d'unité de combat (`stack-sheet`, M1).
> Vérifié compliant sans changement : les **ressources communes** ouvrent déjà
> leur fiche exacte au tap (bouton → `ResourceDetail`, lot M6) ; les **ressources
> de faction** sont plafonnées (≤ 999) donc jamais abrégées (montant exact
> toujours visible) ; en combat, la présence du héros est déjà lisible (badge +
> nom + mana), le `title` redondant est passé en `aria-label`.

> 🚧 **État X3 (HUD aventure mobile, plan `ux-enrichissement-2026-07`)** : en
> portrait, la carte reprend la place que le HUD lui mangeait. (1) Le **bandeau
> d'armée bas est replié par défaut** au premier lancement (préférence persistée
> `heroes.armyBandCollapsed` en `localStorage`, hors sauvegarde) — la carte est
> visible à ~60 % au lieu de ~⅓. (2) Déplié, il n'affiche que les **piles
> réelles** (les cases vides sont masquées sous 900 px ; desktop et tiroir héros
> gardent les 7 slots pour le drag/échange de garnison). (3) L'indicateur
> **jour/PM** est compact : calendrier et jauge de points de mouvement tiennent
> chacun sur **une** ligne insécable (fini l'étalement sur 3-4 lignes), valeurs
> inchangées.

> 🚧 **État X6 (tiroir héros mobile, plan `ux-enrichissement-2026-07`)** : le
> tiroir défile (attributs → armée → compétences → équipement → sorts d'aventure
> → mini-carte) ; sous 900 px un **fondu bas** (masque alpha CSS) signale qu'il
> reste du contenu sous le pli — plus de section « perdue » (constat E5) — et une
> **marge basse** empêche le dernier bloc de coller au bord de l'écran. La zone
> fondue couvre la marge vide, donc le dernier contenu reste net une fois défilé
> à fond.

> 🚧 **État U4** : **multi-héros / multi-villes** implémentés (lot UX U4). Le
> tiroir héros ouvre un **bandeau de portraits** (un par héros du joueur ; tap =
> sélectionner) — le héros **sélectionné** (`selectedHeroId`, repli 1er héros)
> pilote le tiroir, le bandeau d'armée, les points de mouvement et
> l'interaction carte ; la carte rend **un sprite par héros** avec un anneau sur
> le sélectionné. La barre d'actions liste **toutes les villes possédées** (une
> entrée par ville, badge de faction) — la 2ᵉ ville capturée est donc
> accessible. Depuis **M-TAVERN.2**, le recrutement de héros à la **Taverne**
> alimente réellement ce multi-héros (le héros recruté devient le héros
> sélectionné et apparaît dans le bandeau). Le **transfert d'armée/artefacts**
> entre héros (doc §2.3) reste différé à U6.

> 🚧 **État (réorganisation d'armée — UX-REORDER, livré)** : les 7 slots ne sont
> plus en lecture seule. Un bouton **« Réorganiser »** (tiroir héros + bandeau
> bas) bascule un mode **tap-tap** (touch-first, pas de drag obligatoire) : 1er
> tap sélectionne une pile (liseré épais, 2ᵉ canal — jamais la couleur seule),
> 2ᵉ tap sur une autre pile la **déplace** là ; re-tap = désélectionner. L'ordre
> **pèse sur le placement de combat** ⇒ c'est une **commande moteur**
> déterministe `ReorderArmy { heroId, from, to }` (générique, zéro faction) et non
> de la présentation. **Pas de nouveau champ d'état** (`army` déjà sérialisé) ⇒
> pas de bump de sauvegarde ; commande absente du golden ⇒ golden inchangé.

> 🚧 **État (séparation d'armée — UX-SPLIT, livré)** : un second bouton
> **« Séparer »** (à côté de « Réorganiser ») bascule un mode **tap-tap** où taper
> une pile d'au moins 2 créatures ouvre un **curseur de répartition** (slider +
> boutons ± ≥ 44px, aperçu « effectif restant | effectif détaché ») ; confirmer
> crée une **nouvelle pile** du même type ajoutée en fin d'armée (compact ≤ 7).
> Le bouton n'apparaît que s'il reste un slot libre et une pile scindable. Le
> nombre/ordre de piles **pèse sur le placement de combat** ⇒ **commande moteur**
> déterministe `SplitStack { heroId, from, count }` (générique, zéro faction).
> **Pas de nouveau champ d'état** (`army` déjà sérialisé) ⇒ pas de bump de
> sauvegarde ; commande absente du golden ⇒ golden inchangé.

> ✅ **État UXD-8** : la **colonne droite desktop** de ce schéma est réalisée par
> le **tiroir héros persistant** (≥ 900 px : ancré à droite, 300 px, toujours
> ouvert ; portraits héros + mini-map + détails). Les ressources restent en
> **barre haut** (choix M5) et les villes en **barre d'actions** (choix U4),
> toutes deux confinées à gauche du rail — un déplacement dans le rail est
> volontairement non retenu (faible valeur, casse de surfaces testées). La
> **mini-map** est livrée desktop (widget du rail) et mobile (dans le tiroir).

### 2.2 Écran de ville

- Vue peinte interactive (les bâtiments construits apparaissent) + **onglet liste** : `Construire · Recruter · Garnison · Marché · Guilde · Taverne` (les trois derniers seulement si le bâtiment est construit). Sur mobile, la liste est l'entrée principale (la vue peinte reste, en scroll horizontal).
- Panneau construction : arbre visuel avec états (construit / disponible / verrouillé + prérequis manquants en rouge / plus tard : file du jour suivant). 1 bâtiment/jour → le bouton global affiche « Construction du jour utilisée ».
- Recrutement : slider quantité + boutons min/max, coût total live, « tout recruter » (achat max multi-tiers).

> 🚧 **État M7 (plan `ux-revue-mmho.md` C19/C20/C21)** : décision au premier
> écran de gestion. **En-tête de ville** enrichi (C21) : nom de faction + « Ville »,
> **revenu or/jour** (helper moteur pur `townIncome`) et **croissance dans N
> jours** (`weekOf(day)·7 + 1 − day`). L'onglet Recruter gagne un bouton **« Tout
> recruter »** (C19) : achat glouton du tier le plus haut au plus bas (proxy coût
> or décroissant), borné par stock ET ressources courantes (helper client pur
> `maxAffordable`), dispatch séquentiel de `RecruitUnits` re-validés par le
> moteur. La liste **Construire** est triée **par statut** (disponible →
> construit → verrouillé) puis id (C20) — cohérent avec la bande peinte ; l'ancien
> tri alphabétique plaçait les verrouillés en tête. Vignettes de bâtiments
> manquantes (Habitation : Recrue, Tableau des Contrats) = suivi asset (C22).

> 🚧 **État M-TAVERN.2** : l'onglet **Taverne** est fonctionnel — visible
> seulement si la Taverne est **construite** (même règle que Marché/Guilde ; tap
> sur la vignette de la Taverne dans la vue peinte ⇒ onglet). Liste le **roster
> de héros nommés de la faction de la ville** (`GameState.heroRoster`) : avatar
> (**portrait dédié** `heroes/<clé de fiche>` si stagé — M-TAVERN.3, sinon
> `heroes/<faction>-<archétype>`, repli procédural), nom, **bio** dépliable
> (parité tactile X2), spécialité (nom + effet), attributs, **coût en or** et
> compteur `héros possédés/cap`. Bouton **Recruter** ⇒ `RecruitHero` (re-validé
> moteur) ; états affichés : « Recruté » (carte atténuée + libellé, canal non
> chromatique doc §4), cap atteint, or insuffisant (bouton désactivé). Le héros
> recruté devient le héros **sélectionné**. Les libellés de spécialité des héros
> nommés sont résolus **core → paquet** (`hero.specialty.<id>.name/.desc`).
>
> 🚧 **État U6a** : l'onglet **Marché** est fonctionnel — échange ressource ↔ or
> au bâtiment marché, taux data-driven (`config.market` : `sellRate`/`buyRate`,
> spread réaliste), via la commande moteur générique `TradeResources` (point
> d'extension : un effet de bâtiment `{ type: 'market' }`, aucun id en dur). UI :
> direction Vendre/Acheter + ressource + quantité, **aperçu de la contrepartie**
> (`tradeQuote`, pas de réimplémentation du taux). La **Guilde** (apprentissage
> de sort) reste différée (pas de commande moteur au MVP).

> 🚧 **État U5 (tranche A)** : **vue de ville peinte** — les bâtiments construits
> apparaissent en vignettes sur un décor gouache (dégradé placeholder), en bande
> à défilement horizontal (touch-first), au-dessus des onglets ; tap sur un
> bâtiment ⇒ onglet Construire. Réutilise les vignettes existantes (repli
> procédural). Décors bespoke par faction + spritesheets d'unités = tranches
> ultérieures du jalon Beta.

> 🎨 **État UXD-5** : la vue de ville devient un **plan de construction** — plus
> seulement les bâtiments construits, mais **tout le catalogue**, chaque
> emplacement portant son statut (construit / disponible / verrouillé). Le
> statut n'est jamais porté par la seule couleur (a11y §4) : **pastille de forme
> distincte** (disque plein / anneau pointillé / carré) + opacité et
> désaturation de la vignette ; `aria-label` = « nom — statut ». Tri par statut
> puis id ; tap sur n'importe quel emplacement ⇒ onglet Construire (les prérequis
> d'un emplacement verrouillé y sont détaillés). **Poupée d'équipement typée par
> slot** (§2.3) et réalignement des écrans annexes = suivis notés
> (`.claude/plans/ux-d5-gestion.md`).

> 🎯 **État refonte UX (plan `.claude/plans/ux-town-screen-refonte.md`)** : allègement
> de l'écran, rapprochement du core loop HoMM (la panorama devient le point
> d'entrée), **zéro diff moteur** (client + CSS + doc). Cinq axes :
> **(A) cohérence des onglets** — **Marché** et **Guilde** ne s'affichent QUE si
> le bâtiment portant l'effet (`market` / `mageGuild`) est **construit** (miroir
> client de `townHasMarket` : le moteur refusait sinon l'action, l'onglet menait
> à un cul-de-sac) ; l'onglet actif retombe sur Construire s'il devient
> indisponible. **(B) vue peinte interactive** — un tap sur un emplacement route
> vers l'action pertinente (entrer le marché/la guilde, recruter dans une
> habitation construite, sinon Construire) au lieu de toujours ouvrir Construire.
> **(C) cartes compactes** — lore tronqué à 2 lignes (texte complet en `title`),
> le « Chantier : 1 j » redondant par carte est retiré. **(D) chantier du jour
> condensé** — l'ancien grand ruban ornemental devient un badge compact dans
> l'en-tête (revenu · croissance · chantier). **(E) mobile** — onglets **collants**
> (sticky) en haut du scroll de la modale, vue peinte un peu plus courte.

> 🎨 **État UX-TOWNVIEW (plan `.claude/plans/ux-townview.md`)** : la vue de ville
> passe de la **bande horizontale** de vignettes à une **scène composée** — chaque
> bâtiment est posé **en absolu à sa place** sur le décor peint, via un layout
> **déterministe côté client** (`render/townLayout.ts` : position x%/y% dérivée de
> l'**identité** du bâtiment, jamais de son statut ⇒ un bâtiment ne bouge pas
> quand on le construit, fidélité HoMM ; répartition en gradins de village +
> gigue bornée, positions responsives). **Zéro diff moteur, aucun schéma ni donnée
> de layout** (décision « A ») : les positions data-driven par faction arriveront
> avec l'art bespoke composable (AS-TOWNBG, jalon Beta). Statut inchangé (2ᵉ canal
> non chromatique § 4 : pastille de forme + opacité/désaturation ; **verrouillé =
> vignette grisée en « ombre » discrète**, restant tappable ⇒ prérequis dans
> Construire). Tap-routing (A/B refonte) et testids (`town-view-building` +
> `data-status`) conservés ; les positions sont exposées en `left`/`top` inline
> pour la testabilité DOM (le rendu peint n'étant pas assertable au pixel).
> Touch-first (cibles ≥ 44 px), 3 crans de police via `rem`.
>
> 🎨 **Lot 2 (bâtiments calés sur le décor peint, client + données)** : les
> emplacements ne sont plus dispersés plein cadre (ils flottaient sur le ciel /
> le donjon central des tableaux) mais posés dans la **bande d'avant-plan** du
> décor — les bâtiments **reposent sur le sol de la peinture**. Défaut « au sol »
> faction-agnostique (`townLayout`), plus un **override par faction data-driven** :
> `assets/layouts/town-<factionId>.json` (ancres `{x,y}` en % calées sur le décor,
> résolues par le registre d'assets comme les fonds — **hors `packages/`, id
> opaque** ; déposer/retoucher un JSON suffit, zéro code). Livrés bespoke : Haven
> & Necropolis (épousent terrasses/abords, évitent le donjon lumineux) ; les
> autres factions prennent le bon défaut « au sol » en attendant leur JSON.
> **Zéro diff moteur, pas de bump de sauvegarde.** (Les fonds peints eux-mêmes
> existent déjà — `assets/backgrounds/town-<faction>.jpg` pour les 6 factions.)
> Les **prompts de génération** de ces fonds (`tools/assets/gen_prompts.py` →
> `assets/prompts/backgrounds.md`, doc 12 §5) ont été **révisés pour l'objectif
> composable** : un unique donjon focal en haut, des terrasses / lots vides
> dégagés descendant vers un avant-plan non encombré (place pour les vignettes de
> bâtiments), au lieu d'une cité déjà saturée. Les **6 fonds ont été régénérés**
> sur ces prompts (chacun présente désormais des **lots de construction vides**
> au premier plan) et **les emplacements des 6 factions sont calés dessus**
> (`assets/layouts/town-<faction>.json`). Dans la foulée, les **libellés
> permanents** sous chaque vignette ont été **retirés** (ils encombraient le
> décor à 13-20 bâtiments) : l'identité passe par la vignette peinte + la **ligne
> d'inspection** (survol/focus/appui long, lot 3) + `title`/`aria-label` — look
> d'écran de ville HoMM, découvrabilité et accessibilité préservées.
>
> 🎨 **Lot 3 (polish interactions, client pur)** : (1) **indicateur d'upgrade** —
> un emplacement **construit** encore améliorable (upgrade de niveau bâtissable
> aujourd'hui) porte un **badge chevron ▲** (`data-upgradeable`), 2ᵉ canal non
> chromatique par **forme + position** (distinct des pastilles de statut) ;
> (2) **infobulle bâtiment** — nom · niveau X/Y · statut · coût du prochain
> niveau, sous la scène, alimentée par **survol, focus clavier ET appui long**
> (hook DOM `useLongPress`, 450 ms) : la parité tactile (§ 1.1) ne dépend plus du
> seul `title` natif ; le tap conserve la navigation. Une clé locale
> (`town.upgradeAvailable`). **Zéro diff moteur, pas de bump de sauvegarde.**
> (Lot 2 — layouts data-driven par faction + décors composables AS-TOWNBG —
> reste subordonné à la production d'art, jalon Beta.)

### 2.3 Écran héros

- Portrait, attributs, XP ; **poupée d'équipement** 10 slots + sac ; compétences (6 slots, rangs) ; grimoire **feuilletable par onglets d'école** (puis cercles), coût mana visible, sorts indisponibles grisés avec raison.
- Transfert d'armée/artefacts entre 2 héros : écran double-colonne, drag & drop (souris) / tap-tap (mobile), boutons « équilibrer » et « tout donner ».

> 🚧 **État 3.2** : l'« écran héros » est réconcilié avec le **tiroir héros** existant (`shell.tsx`) plutôt qu'un écran plein séparé — sections Compétences (`HeroSkills`) et Inventaire (`HeroInventory`) ajoutées, mana affichée. Le **grimoire** est le livre de sorts **en combat** (`SpellBook`, bouton `[Sort héros]`) : sélection sort → cible → prévisualisation obligatoire → `CastSpell`. La modale de **choix de compétence** à la montée de niveau (`SkillChoice`, non annulable comme HoMM) se monte sur `pendingSkillChoices`.
>
> ✅ **État C-SPELLUI.1** : le grimoire de combat est **feuilletable par onglets d'école** (`role="tab"`/`tablist`/`tabpanel`, onglets ≥ 44px) au lieu d'empiler toutes les écoles ; une seule école est visible à la fois, ses sorts restant groupés par cercle. Onglets dérivés du grimoire du héros (écoles universelles puis écoles de faction, même ordre que la liste plate), défaut = 1re école, repli déterministe si l'école active devient invalide. Présentation seule (zéro moteur, pas de bump save).
>
> ✅ **État C-SPELLUI.2** : sous la prévisualisation obligatoire, un sort de **zone** (`splash`/`all`/chaîne) **liste les piles touchées** (nom × effectif + compte) — source moteur pure `spellAffectedStacks` (la même que la résolution/préviz agrégée), aucune géométrie hex réimplémentée. Un sort mono-cible n'affiche rien. Le joueur voit ainsi l'étendue avant de confirmer. Helper moteur pur ⇒ golden inchangé, pas de bump save.
>
> ✅ **État C-SPELLUI.4** : chaque onglet d'école affiche la **maîtrise** du héros dans cette école (rang de sa compétence de magie — Feu/Eau/Terre/Air…, ou « de base » sans compétence), via le helper moteur pur `heroSchoolMastery`. C'est cette maîtrise qui pilote la réduction de coût de mana (A6) ; le cercle des sorts reste indiqué par les en-têtes « Cercle N ». Helper pur ⇒ golden inchangé, pas de bump save.
>
> ✅ **État C-SPELLUI.3** : la zone d'effet est aussi **surlignée sur la grille** pendant le ciblage. Sur l'écran de choix de cible, le grimoire se **dock en bas** (fond transparent) pour révéler le plateau ; les hexes touchés (cible + `splash`/`all`/chaîne) s'affichent dans une teinte violette distincte (des états atteignable/attaquable/douve) avec un **losange marqueur non chromatique** (A5). Surbrillance dérivée du même `spellAffectedStacks` (aucune géométrie hex côté client), pilotée par un champ store présentation `combatSpellZone` (non persisté, purgé aux transitions de combat et au démontage du livre). La cible se choisit toujours via les puces texte (≥ 44px). Un sort de téléportation garde son propre flux de ciblage d'hex (`combatSpellTarget`). Vue seule ⇒ zéro moteur, pas de bump save.
>
> ✅ **État UXD-5b** : la **poupée d'équipement typée par slot** est livrée. Les artefacts portent un champ de données `slot` (`head/neck/torso/weapon/shield/cloak/hands/feet/ring/misc`, doc 02 §1.1). `HeroInventory` affiche **10 emplacements nommés** dans l'ordre tête→pieds (chaque type = une position typée, libellé toujours visible → A5 jamais la couleur seule) + un **sac** de débordement. Le regroupement d'affichage est purement client : le moteur garde son tableau plat `hero.artifacts` (ramassage au 1er slot libre inchangé) et les bonus se somment quel que soit l'emplacement.
>
> ✅ **État H-ARTEQUIP typed slots** : l'**équipement respecte désormais le type de slot**. `EquipArtifact` refuse un 2ᵉ artefact d'un emplacement **exclusif** (type défini ≠ `misc`) déjà porté — on ne cumule pas 2 casques ni 2 armes ; `misc` (fourre-tout) et les artefacts sans `slot` restent multiples. Seul point où le moteur lit `slot` (contrainte générique `artifactSlotConflict`, aucun `if (slot === …)` de faction) ; le tableau `hero.artifacts` reste plat ⇒ **pas de bump save**. Le sac du `HeroInventory` **désactive** (préviz, pas de tap mort) la case d'un artefact dont le slot est occupé, avec la même règle pure partagée que la validation moteur. Placement passif inchangé : le **ramassage** de carte et le **transfert inter-héros** posent toujours au 1er slot libre (hors périmètre).
>
> ✅ **État H-ARTEQUIP panoplies (sets à seuils)** : un artefact peut appartenir à une **panoplie** (`ArtifactDef.set`, doc 02 §1.1) ; équiper assez de pièces accorde un bonus supplémentaire. Le tiroir héros (`HeroInventory`) affiche sous la poupée une section **Panoplies** listant, pour chaque ensemble porté, la progression `n/seuil` avec une marque **✓ complète** au seuil atteint (jamais la couleur seule → A5). Purement dérivé de l'équipement (pas de bump save).
>
> ✅ **État UX-HEROSWAP** : le **transfert d'armée/artefacts entre 2 héros** est livré. Un bouton « Échanger avec {nom} » apparaît dans le tiroir héros dès qu'un héros allié occupe une tuile **adjacente** ; il ouvre l'écran de rencontre `HeroSwap` **double-colonne** (un héros par colonne) où **taper** une pile ou un artefact la donne à l'autre héros (tap-tap, touch-first ; pas de drag), plus un bouton **« Tout donner »** par colonne. Moteur : commande générique `TransferBetweenHeroes`. Le **split d'une pile en deux** est désormais livré (**UX-SPLIT**, commande `SplitStack`) via le bouton « Séparer » du tiroir héros/bandeau (§2.1).

### 2.4 Écran de combat

```
┌────────────────────────────────────────────────────────────┐
│  [armée A: 7 vignettes]      round 3       [armée B: 7]    │  ← ordre du round
│                                                            │    (vitesse décroissante)
│                  CANVAS grille hex 15×10                   │
│        (surbrillance : hexes atteignables, cibles,         │
│         prévisualisation dégâts min–max & ripostes)        │
│                                                            │
│ [Attendre] [Défendre] [Capacité] [Sort héros]   [Auto ▶▶]  │
└────────────────────────────────────────────────────────────┘
```

- **Prévisualisation de dégâts obligatoire** avant confirmation : « 12–18 dégâts, ~3 morts · riposte estimée : 5–8 ».

> 🚧 **État (récapitulatif de fin — UX-ENDSTATS, livré)** : l'overlay de fin de
> partie (`OutcomeOverlay`, §2.5) affiche, au-dessus du graphique de puissance, un
> **récapitulatif** lu de l'état final : **durée** (`Jour N · Semaine W`), **villes
> possédées**, **héros** (nombre + niveau max), **unités en armée**. Client pur
> (aucun suivi moteur). *Différé : pertes cumulées (suivi moteur requis pour
> l'exactitude multi-joueurs/IA).*

> 🚧 **État (fiche de scénario — N-BRIEFING, livré)** : cliquer un **scénario** ou
> un **événement** du menu ouvre d'abord une **fiche** (`BriefingScreen`, modale
> simple de la pile) avant le lancement : **faction** jouée, **objectif de
> victoire** et **condition de défaite** (libellés génériques, `surviveDays`
> interpolé), **nombre d'adversaires** — lus du `Scenario` déjà en store. Boutons
> **Commencer** (dispatch `heroes:start-scenario`) / **Retour**. **Client pur**
> (zéro moteur/save/golden). *Les chapitres de campagne conservent leur intro
> narrative (`openingDialog`) et ne passent pas par la fiche.*

> 🚧 **État (journal de combat — UX-COMBATLOG, livré)** : un bouton **« Journal »**
> dans la barre d'actions bascule un **panneau déroulant** listant les actions du
> combat courant (round, attaque/riposte, esquive, mort, soin, poison, sort, moral,
> peur, immobilisation, fin). **Client pur** : un listener global alimente
> `store.combatLog` depuis les **événements moteur déjà émis** (aucun état ni règle
> ajoutés), remis à zéro à chaque combat, borné à 80 lignes ; les ids de pile sont
> résolus en noms d'unité localisés.

> 🚧 **État (Prière de bataille — F-SKILLS.2-UI, livré)** : un bouton **« Prière »**
> de la barre d'actions de combat expose la compétence de faction *Prière de
> bataille* (doc 03 §2/§5), jusqu'ici pilotée par la seule IA. Il n'est actif que
> si le héros du camp joueur porte la compétence (`battleResurrectHp`) et ne l'a
> pas encore invoquée ce combat (gate moteur pur `canHeroRally`). Il ouvre une
> **modale de ciblage d'une pile ALLIÉE vivante** (miroir de *Attaque du héros* et
> *Sort (unité)*), avec **prévisualisation par cible** des créatures ressuscitées
> et PV rendus (`estimateHeroRally`, sans RNG), puis dispatch `HeroRally`. **Client
> pur** : le moteur (commande, résurrection intra-pile, 1×/combat) était déjà
> livré — aucun état/save/golden ajouté.

> 🚧 **État M1 (lisibilité d'état — plan `ux-revue-mmho.md` C13/C14/C18)** : le
> bandeau du haut affiche désormais l'**ordre de passage réel du round** (helper
> moteur pur `roundActionOrder` : vague normale par vitesse décroissante puis
> attente croissante, mêmes départages que l'ordre de jeu — la 1ʳᵉ vignette est
> la pile active), suivi d'une projection **estompée du round suivant** ; une
> rangée à défilement horizontal en mobile. Chaque vignette porte un **marqueur
> de camp** forme + couleur (losange plein attaquant / anneau défenseur, jamais
> la couleur seule §4) et s'ouvre au **tap en fiche de pile** (`StackSheet`,
> cible ≥ 44 px) : PV de la tête de pile, attaque/défense, dégâts, vitesse
> effective, munitions, statuts de sorts et durées, postures (défense/attente/
> immobilisation/marques). La projection n'anticipe pas les aléas résolus au
> moment du tour (saut de moral négatif, immobilisation). Le tap sur le jeton
> du plateau (canvas) est différé au geste d'appui long générique (lot M2).
- Mobile : combat **jouable en portrait** de plein droit — le plateau est rendu à une **échelle plancher** garantissant des hexes ≥ 44 px (touch-first, §1), puis **déplaçable au pan et zoomable au pinch** (parité avec la carte d'aventure) quand il déborde de l'écran. Le paysage reste possible mais n'est plus imposé par un overlay de suggestion de rotation. Quand le plateau déborde, la vue s'ouvre **centrée sur la pile active** (pas sur le centre du plateau, qui n'affichait aucune unité) ; le pan/pinch du joueur reste ensuite maître (UXD-0). En viewport étroit, le bandeau du haut empile round puis une rangée par camp, et la prévisualisation de dégâts est groupée au-dessus de la barre d'actions (jamais recouverte).
- Vitesses d'animation ×1/×2/×4 + « combat auto » avec possibilité de reprendre la main à tout round (rejoue depuis l'état courant — gratuit grâce au déterminisme).

> 🚧 **État M4 (plan `ux-revue-mmho.md` C15)** : la promesse ci-dessus est
> tenue par **deux autos complémentaires** — l'« **Auto-Battle** » de l'écran
> pré-combat (Lot 1 fidélité HO) reste la **résolution instantanée** ; le
> bouton « **Auto ▶▶** » en combat devient une **bascule round par round**
> (commande moteur générique `AutoCombat{rounds}` : joue N round(s) auto puis
> rend la main sur une pile du joueur — rétro-compatible, `rounds` absent =
> résolution complète). Pendant l'auto, les actions sont désactivées et le
> bouton devient « **Reprendre la main** » ; la coupure prend effet au round
> courant, la pause entre rounds suit la vitesse ×1/×2/×4. Itérer l'auto par
> rounds produit exactement le même état final que la résolution complète
> (même IA, déterminisme testé).

> 🚧 **État X4 (finitions pré-combat mobile, plan `ux-enrichissement-2026-07`)** :
> l'écran pré-combat s'adapte au portrait. La puissance de chaque camp n'est
> affichée **qu'une fois** (grande valeur d'or sous chaque camp) — la ligne
> « {att} · {def} » redondante est retirée, le libellé « Puissance de combat »
> reste comme intitulé pivot. Sous 480 px, la grille passe à **libellé pivot en
> rangée haute + les deux camps côte à côte** (colonnes pleines ⇒ plus de
> troncature « Vos … / Rec… »), et les boutons **Combattre / Auto-Battle**
> s'empilent en **pleine largeur** (une ligne chacun, cible ≥ 44 px). Le
> portrait de l'attaquant reste l'avatar du héros quand il existe (parcours
> réel), repli sur le blason de faction sinon.

> 🚧 **État X5 (micro-i18n, plan `ux-enrichissement-2026-07`)** : deux valeurs
> **FR** anglophones corrigées (clés et EN inchangés). (1) Le bouton du
> pré-combat `preBattle.auto` : « Auto-Battle » → **« Combat auto »** (cohérent
> avec le bouton « Auto ▶▶ » du combat, où *auto* = automatique est un usage
> français admis). (2) L'en-tête de manche `combat.round` : « Round {round} » →
> **« Manche {round} »** — *manche* est le terme FR retenu pour un round de
> combat, distinct de « tour » (déjà pris par le tour d'aventure / « fin de
> tour »). « Options » et « Mana » restent des emprunts standard en français.

> ✅ **Retour de jeu 2026-07 (pré-combat & bilan)** : deux ajouts *client* (un
> point d'extension moteur générique). (1) **Abandon** — l'écran pré-combat
> gagne un 3ᵉ bouton **« Abandonner »**, après *Combattre* / *Combat auto*,
> pour renoncer une fois la puissance ennemie connue en **gardant l'armée
> survivante, sans coût** (commande moteur `AbandonCombat`, gate round 1). Le
> bouton n'apparaît **que** sur l'écran pré-combat (jamais en bataille — seules
> fuite/reddition y figurent) et seulement pour un combat de héros (pas l'arène).
> (2) **Bilan de fin de combat** (`CombatResultScreen`) — à l'issue d'un combat
> *fouillé*, une modale par-dessus la carte liste **morts/survivants par armée**
> (survivants verts, `−pertes` rouges signés — jamais la couleur seule) et les
> **gains** (XP + niveaux, or, ressources, artefact, mort-vivants) ; « Continuer »
> la ferme. Un départ délibéré (fuite/reddition/abandon) n'ouvre pas de bilan.
> L'événement moteur `CombatEnded` porte désormais `survivors` en plus de
> `casualties` (état haché inchangé ⇒ golden épargné).

### 2.5 Autres écrans

Menu principal (Continuer / Scénarios / Escarmouche / **Éditeur de carte** / Options), fiche de scénario (objectifs), fin de partie (stats, graphique de puissance), options (langue FR/EN, vitesse anims, taille UI, audio, réduction des animations, confirmation de fin de tour : cf. §4).

> 🚧 **État M8 (plan `ux-revue-mmho.md` C2/C3/C12/C25/C4)** : confort desktop &
> finitions. **Raccourcis clavier** desktop (jamais requis, ignorés en saisie/
> modale/combat) : `E` fin de tour, `H` tiroir héros, `T` ville ; en combat
> `Espace` = Attendre, `D` = Défendre ; Échap inchangé (documentés dans Options).
> **État X7 (plan `ux-enrichissement-2026-07`)** : ces raccourcis étaient
> indécouvrables. Ajouts : la touche **`?`** ouvre une **aide des raccourcis**
> (`ShortcutsOverlay`, modale dans la pile, fermée à Échap — doc 08 §3), listée
> aussi dans l'astuce d'Options ; la touche **`N`** sélectionne le **héros
> suivant ayant des points de mouvement** et recentre la caméra (cyclique,
> no-op à un seul héros — utile en multi-héros U4) ; les boutons « Fin de tour »
> et « Ville » portent un `title` d'appoint rappelant leur touche (« Fin de tour
> (E) »), info **complémentaire** jamais exclusive (A2).
> Option **« Réduire les animations »** (`app/motion.ts`) : s'**unit** au réglage
> système `prefers-reduced-motion` (l'un OU l'autre coupe le mouvement, DOM via
> `<html data-reduce-motion>` + rendu Pixi via `reduceMotion()`), persistée.
> **Garde-fou de fin de tour** (convention HoMM) : si un héros n'a pas bougé
> (PM au max du jour), la fin de tour demande confirmation (overlay tap-tap),
> désactivable via l'option « Confirmer la fin de tour ». **Tiroir héros
> réordonné** : identité (portrait, niveau, jauges XP/mana) en tête, mini-carte
> en fin (sections repliables = raffinement différé). **C4** : l'ancienne
> promesse d'une *option* « daltonisme » est retirée — les motifs non chromatiques
> (badges de faction, pastilles, contours, jamais la couleur seule) sont
> **toujours actifs** (§4), ce qui est plus sûr qu'un réglage optionnel.

> 🚧 **État U6b** : l'écran de **fin de partie** (`OutcomeOverlay`) affiche un
> **graphique de puissance par joueur** — barres horizontales SVG triées par
> puissance décroissante, une par joueur, calculées sur l'état final via le
> helper moteur pur `playerPower` (Σ force d'armée héros + garnisons). Palette
> catégorielle validée (skill `dataviz`, thème sombre) ; **double encodage**
> libellé + valeur (jamais la couleur seule, §4) ; le joueur humain est mis en
> évidence. Stats détaillées (durée, pertes cumulées…) = raffinement ultérieur.

> 🚧 **État (escarmouche vs IA, Alpha 4.14)** : le bouton **Escarmouche** du menu
> ouvre une modale `SkirmishScreen` (pile de modales §3) : choix de la faction du
> joueur, de la faction de l'IA (listes peuplées depuis les paquets chargés,
> aucun id en dur) et d'un cran de **difficulté** (Facile / Normale / Difficile,
> segmented control). « Lancer » émet `heroes:start-skirmish` (même découplage que
> « Nouvelle partie ») → une partie 1v1 est **générée à l'exécution**
> (`skirmishStartCommand`). La difficulté est un **levier de données** (l'armée /
> les ressources de l'IA sont mises à l'échelle) — aucun code de difficulté dans
> le moteur. i18n FR/EN, sélecteurs à cible tactile ≥ 44 px. Choix de la carte
> différé (une seule carte proto ; arrivera avec l'éditeur de carte).

> 🚧 **État (« Nouvelle partie » configurable, Live 6.3→6.5)** : le bouton
> **Nouvelle partie** ouvre `NewGameScreen` (mêmes conventions : pile de modales
> §3, segmented controls ≥ 44 px, i18n FR/EN). Réglages : joueurs (2–4, humain
> hot-seat / IA), faction / héros / couleur / équipe par siège, **taille de
> carte**, **Ressources** (bas/standard/riche = stock de départ + densité de
> base), **difficulté IA**, **graine**. Lot **6.5** ajoute quatre curseurs de
> **quantité par catégorie d'objets de carte** — **Gardiens**, **Mines**,
> **Bâtiments événement**, **Ressources & artefacts** — à 5 crans chacun
> (`Aucun` / `Rare` / `Standard` / `Abondant` / `Aléatoire`). Ces crans sont des
> **facteurs de densité superposés** au réglage global (défaut « Standard » ⇒
> carte inchangée) ; « Aucun gardien » produit une carte pacifique (ni gardiens
> ni sentinelles). Chaque paramètre peut rester sur **« Aléatoire »** (tiré
> déterministiquement depuis la graine, jamais `Math.random`). « Lancer » émet
> `heroes:start-newgame` avec la config brute ; `main.ts` résout les tirages,
> génère la carte (overlay de progression) et joue le `StartGame`. **Zéro diff
> moteur** (données + client).

> 🚧 **État (hot-seat, Alpha 4.15)** : l'écran d'escarmouche propose un
> **adversaire** « IA » ou « Joueur 2 » (hot-seat local ; la difficulté ne
> s'affiche qu'en mode IA). En multi-humain, tout le plateau (héros, villes,
> **brouillard**, sélection, toasts) se re-keye au joueur **actif** — `humanId`
> suit `currentPlayer` s'il est humain — et un **overlay « passez l'appareil »**
> (`HandoffOverlay`, overlay forcé hors pile de modales) sépare chaque tour pour
> masquer le plateau précédent, validé par « Continuer ». L'écran de fin de partie
> nomme alors le **vainqueur** (« Victoire du joueur N ») plutôt que Victoire/
> Défaite (centré sur soi). **Aucun code moteur** : la boucle de tours IA s'arrête
> déjà sur chaque joueur humain. > 2 joueurs / équipes = raffinement ultérieur.

> 🚧 **État (UX multi-joueurs — passage de tour & tours IA)** : trois correctifs
> client (zéro moteur, pas de bump save). (1) **Recentrage caméra** : au changement
> de joueur humain actif (hot-seat, ou retour à l'humain après un relais IA), la vue
> se recentre en douceur (`panCameraTo`) sur le héros du nouveau joueur — en hot-seat
> après validation du « passez l'appareil ». (2) **Tours IA non bloquants** : la
> boucle de pilotage IA (`runAiLoop`) cède la main au navigateur (`requestAnimationFrame`
> + court délai, coupé en *reduce-motion*) entre chaque tour au lieu de tourner en
> synchrone — plus de gel/écran figé pendant que les adversaires jouent ; la carte
> reste **navigable** (pan/zoom) pendant ce temps, les actions du héros humain étant
> ignorées (le moteur les rejetterait). (3) **Indicateur de tour** dans la barre :
> nomme le **joueur actif** (pastille de couleur + n°, dès qu'il y a ≥ 2 joueurs) et,
> pendant les tours IA, affiche une **barre de progression** `done/total` des
> adversaires — le joueur sait qui agit et voit l'avancée (choix « liberté de naviguer
> **et** taux de progression »).

> 🚧 **État (éditeur de carte, Alpha 4.18)** : écran `editor` (route de base, bouton
> menu ou `#editor`) — outil **interne minimal** pour accélérer la prod de contenu.
> Grille **DOM** peinte au clic (4 terrains grass/swamp/water/mountain, cibles
> ≥ 44 px, teinte + libellé/aria non chromatiques seuls), outils position de
> départ / ressource (or) / ville / gomme, champs id/largeur/hauteur (4–32).
> **Export** : construit un `MapFile`, le **valide par `mapFileSchema`**
> (@heroes/content) — jamais d'export invalide — puis télécharge `<id>.map.json` ;
> **import** d'une carte existante pour l'éditer. Gardiens, triggers, routes et
> rendu Pixi = raffinements ultérieurs. Client seul (moteur intact).

> 🚧 **État (télémétrie locale opt-in, Alpha 4.19)** : section « Télémétrie
> (locale) » des Options — **désactivée par défaut**, activable par le joueur
> (opt-in). Une fois activée, mesure la **durée des tours** (chrono du tour humain
> jusqu'à « Fin de tour » ; un combat ne le fractionne pas) et le **taux de combats
> auto-résolus** (bouton « Auto » = délégation/« abandon » de la conduite manuelle).
> **100 % local** : stocké dans le `localStorage`, jamais envoyé ; export JSON +
> réinitialisation. Aucun enregistrement sans accord préalable (privacy-first).

## 3. Navigation & flux

- **Routeur d'écrans** (source unique de navigation, lue par le DOM et les
  scènes Pixi) : une route de base `menu ⇄ adventure`. Le **combat n'est pas une
  route** : il est dérivé de l'état moteur (`game.combat ≠ null`) pour rester en
  phase avec l'auto-combat et le déterminisme (aucune désync route/état). Les
  overlays **forcés non annulables** (choix de compétence à la montée de niveau,
  fin de partie) sont dérivés de l'état moteur et vivent hors de la pile de
  modales (on ne peut pas les « fermer » par un retour arrière).
- Pile de modales max 2 niveaux ; bouton retour Android/geste (et Échap au
  clavier) = ferme la modale du dessus.
- Toutes les actions du tour sont annulables **tant qu'aucune information n'a été révélée** (déplacement sans découverte ni combat) — bouton « Annuler le déplacement » ; construction/recrutement non annulables (simplicité économique).
- Notifications de jeu : file de **toasts** éphémères (croissance hebdo, revenus, ramassage, construction/recrutement, niveau, fin de combat…) **filtrées au joueur humain** (les actions des IA ne notifient pas), doublées d'un **journal consultable** (bouton cloche du HUD avec badge de non-lus) — modale de la pile listant l'historique daté, la plus récente en tête. Le feedback positif inclut la **sauvegarde manuelle réussie**.

## 4. Accessibilité

- Daltonisme : **pas d'option** — l'accessibilité chromatique est **toujours active** (choix M8/C4, plus sûr qu'un réglage) : couleurs de joueur doublées de **motifs de bannière**, statuts de combat doublés d'icônes/formes, jamais la couleur seule.
- **Réduire les animations** : option en jeu (M8/C3) qui s'unit au réglage système `prefers-reduced-motion` — coupe transitions DOM et mouvement Pixi (le contour de focus reste).
- Texte UI en DOM → zoom navigateur et lecteurs d'écran fonctionnent sur toute la gestion ; taille de police réglable (3 crans).
- Toutes les infos « hover » accessibles à l'appui long ; aucune action à double-clic ou clic droit obligatoire.

## 5. Direction artistique (cadrage)

- « **Gouache stylisée** » : décors peints aux contours doux, unités en spritesheets 2D (idle/move/attack/hit/death, 8–12 frames), lisibles à 64 px de haut.
- Chaque faction a sa palette et son langage de formes (Haven : verticales dorées ; Necropolis : aiguilles et voiles ; Arcane Hunters : violet nuit, argent, lanternes) — définis dans le paquet de faction.
- Placeholders : au MVP, des sprites génériques teintés + icônes suffisent ; la DA finale arrive par faction en Alpha/Beta.

> 🚧 **État UXD-1 (design system « gouache »)** : l'UI DOM a une **source
> unique de style** — `ui/tokens.css` (palette encre/parchemin/laiton/sang
> reprise des valeurs existantes, voiles, rayons, durées, familles de police),
> consommée par toutes les feuilles via `var(--…)` ; **aucun littéral de
> couleur hors tokens** (garde-fou CI, même esprit que le garde-fou faction).
> **Voix display** : Cinzel (OFL, capitales trajanes, WOFF2 latin ~26 Ko servi
> localement, repli `Georgia, serif`) sur les titres d'écrans/modales, les
> boutons de menu, « Fin de tour » et le round de combat ; le corps de texte
> reste `system-ui` (lisibilité). Les teintes elles-mêmes seront raffinées par
> les lots visuels (UXD-4/5) sur cette base.

> 🚧 **État U5-B (décors peints branchés)** : les fonds peints du staging
> (`assets/backgrounds/*.jpg`, logo) sont câblés via le registre d'assets
> (résolveurs `townBackgroundUrl`/`combatBackgroundUrl`/`outcomeBackgroundUrl`/
> `titleBackgroundUrl`/`logoUrl`, faction-agnostiques, repli gracieux) : **menu**
> (logo + fond de titre), **vue de ville** (fond peint par faction, dégradé en
> repli), **fin de partie** (victoire/défaite, voile de lisibilité) — tous en
> **DOM** (composés une fois par le navigateur, coût de rendu par-frame nul). La
> **toile de combat** est d'abord restée **différée** (le sprite Pixi plein écran
> faisait passer l'arène sous le plancher anti-gel ×4, doc 01 §5) puis livrée en
> U5-E via la couche DOM (cf. ci-dessous). Restent (jalon Beta) : spritesheets
> d'unités animées, fonds bespoke des factions/terrains encore sans asset.

> 🚧 **État U5-C (sprites d'unités en combat)** : les piles de combat affichent
> le **sprite statique de leur unité** (`assets/units/<faction>/<unitId>`, chargé
> hors bundle) sur une **base de camp colorée** (second canal, avec la position
> plateau + les bandeaux d'armée), animé par les tweens existants
> (déplacement/attaque/mort) ; **repli procédural** (polygone) si le sprite est
> absent/en cours de chargement. L'**animation frame-par-frame** (idle/move/
> attack/hit/death) reste différée : le pipeline `asset-sheet` produit des sprites
> statiques, pas des planches d'animation.

> 🚧 **État UXD-8 (mini-map desktop)** : la **mini-carte** promise ci-dessus
> existe (elle « n'existait pas du tout » à l'audit) — `ui/MiniMap.tsx`, un
> `<canvas>` 1 px/tuile (CSS `pixelated`) rendant le terrain **exploré**
> (brouillard = sombre) et des pastilles héros/villes (couleur de joueur, la
> pastille elle-même est le 2ᵉ canal — A5). **Clic = recentrage** de la caméra
> d'aventure (`panCameraTo`). Redessin seulement au changement d'état (coût
> par-frame nul). **Desktop only** (ancrée en bas à droite) ; la version mobile
> dans le tiroir et le **layout complet en colonne droite** (ressources/
> portraits/villes empilés, doc §2.1) restent des raffinements notés.

> 🚧 **État UXD-6B (architecture audio)** : l'option **audio** promise ci-dessus
> existe — section Options avec deux volumes (musique / effets) persistés
> (`localStorage`, modérés par défaut). Côté moteur/client : `app/audio.ts` —
> registre **hors bundle** (`import.meta.glob ?url`, OGG prioritaire, repli
> M4A), lecteur `HTMLAudioElement` **débloqué à la 1ʳᵉ interaction** (politique
> autoplay), musique par contexte (menu/aventure/combat/ville) abonnée au store,
> SFX par événement moteur abonnés au bus (gardés au joueur humain hors combat).
> Le son **double** toujours un feedback visuel existant (jamais le seul canal,
> §4). **Jouable silencieux** tant qu'aucun fichier n'est présent sous
> `assets/audio/` (règle F doc 12) — l'intégration se fait en déposant les
> `.ogg` nommés par convention.

> 🚧 **État UXD-7 (micro-interactions & transitions)** : `ui/interactions.css`
> (chargé après les tokens, 100 % présentation) dote toute l'UI DOM d'états
> interactifs cohérents — `:hover` (éclaircissement), `:active` (enfoncement) et
> surtout **`:focus-visible` (contour doré, focus clavier enfin visible — a11y
> doc 08 §4)** — plus des animations d'apparition (modale scale+fade, écrans
> menu/combat en fondu, toast qui glisse). Tout le mouvement est coupé par
> `@media (prefers-reduced-motion: reduce)` (le contour de focus reste). Coût
> par-frame nul (transitions DOM composées). Toasts icônisés par type et
> crossfade complet menu⇄aventure = suivis (le premier touche la logique TSX,
> le second demande une racine unique au HUD d'aventure).

> 🚧 **État UXD-3B (assets peints de la carte)** : les placeholders procéduraux
> de la carte d'aventure sont remplacés par des sprites peints (règles A/C
> doc 12, hors bundle, chargés async) avec **repli procédural gracieux** partout :
> **héros monté** par faction (`map/hero-<faction>`, remplace l'écusson — le
> portrait reste dans le tiroir), **château de ville** par faction
> (`map/town-<faction>`, le liseré de siège doré reste posé par-dessus comme
> 2ᵉ canal A5), et **objets** communs (`map/{chest,camp,signpost,shrine}` pour
> coffre / habitation / lieu de bonus). Résolveurs faction-agnostiques
> (`heroMapUrl`/`townMapUrl`/`mapPropUrl`). Le sandbox proto-01 utilise la
> `test-faction` (sans asset) et garde donc le repli ; les scénarios et
> escarmouches à faction réelle sont peints.

> 🚧 **État UXD-3A (bord de monde)** : au-delà de la carte, le vide sombre
> (« letterbox ») est remplacé par une **mer profonde** posée en **fond DOM de
> `#canvas-root`** (coût de rendu par-frame nul, même approche que la toile de
> combat U5-E ; un aplat plein écran DANS le canvas casse l'anti-gel ×4 en rendu
> logiciel) ; seul le **rivage** (liseré de côte + frange de bas-fonds) est rendu
> en Pixi, borné au périmètre jouable. Une **vignette** DOM (radial-gradient,
> adventure-only) assombrit les bords pour la profondeur. Les remplacements
> d'assets **peints** de la carte (sprite héros monté, château de ville, objets)
> relèvent d'une passe de génération d'images (tranche B, différée).

> 🚧 **État UXD-4 (combat immersif)** : les hexes du plateau sont **translucides**
> (remplissage de base ~16 %, états ~34 %) — la toile de combat peinte (U5-E)
> transparaît réellement au lieu d'être masquée par un aplat opaque. Chaque état
> d'hex porte un **second canal non chromatique** (A5) : pip clair sur
> atteignable, **bord épais** sur cible attaquable (l'hex est occupé), hachures
> sur obstacle, contour doré sur la sélection. Au coup porté : **chiffres de
> dégâts flottants** (montent et s'effacent ~700 ms ; « coup de chance » et
> pertes stylés à part), flash sur la cible et **micro-secousse** ≤ 150 ms —
> tout mouvement est coupé par `prefers-reduced-motion` (le nombre reste, sans
> montée) et reste sous le plancher anti-gel ×4. Bandeau d'initiative illustré
> et fonds de terrain manquants = lots de suivi.

> 🚧 **État U5-E (toile de combat peinte, coût par-frame nul)** : le canvas Pixi
> passe en **transparent** (`backgroundAlpha: 0`) ; pendant un combat, le fond
> peint du terrain (`combatBackgroundUrl(terrain)`, repli gracieux) est posé en
> **`background-image` DOM de `#canvas-root`** — composé une fois par le
> navigateur, donc **coût de rendu par-frame nul**, contrairement au sprite plein
> écran retiré en U5-B qui cassait l'anti-gel ×4. Le champ de bataille peint
> apparaît autour du plateau (hexes semi-opaques) ; retiré à la sortie du combat
> et au retour menu. Anti-gel ×4 re-vérifié (arène ~23 fps, carte ~14 fps, rendu
> logiciel CI, plancher ≥ 5).

> 🚧 **État DA Beta (gardiens illustrés + nommage des sprites)** : sur la carte
> d'aventure, un **gardien** affiche désormais le **sprite de sa créature**
> (`unitSpriteUrl(unitId, catalog[unitId].groupId)`, chargé async, même chemin
> que le combat), avec **repli fanion** procédural si la faction/le sprite manque
> — comme HoMM montre l'unité qui garde une case. Corrige au passage le
> **nommage** de 5 sprites Arcane Hunters (suffixe de nom → `<id>.png`) qui les
> rendait irrésolvables : les 23 sprites d'unités résolvent maintenant tous. Le
> **générateur** (`gen_prompts`/extraction) devra émettre `units/<faction>/
> <id>.png` pour ne pas réintroduire de suffixe (follow-up noté au plan).
