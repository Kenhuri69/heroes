# Revue complète du jeu & plan de remédiation (2026-07-28)

> **Session documentaire** : ce document est le livrable. Aucun code de jeu n'est
> modifié dans ce lot. Chaque lot du §6 ouvrira, à son implémentation, son propre
> plan `.claude/plans/<lot>.md` (guidelines §5) et mettra à jour le `docs/0X-*.md`
> concerné dans le même commit (docs = source de vérité).
>
> **Demande** : « revue complète du jeu, plan complet pour tout bug, défaut d'UX,
> défaut d'ergonomie, lourdeur d'interface ».

## 0. Méthode & état de référence

1. **Pipeline complet rejoué** sur le HEAD de `main` (d376a52) :
   `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ (**935 tests moteur,
   137 fichiers**) · `pnpm build` ✅ (bundle **363 Ko gzip** — 186 index + 165 pixi
   + 12 css, soit 45 % du budget de 800 Ko).
2. **Audit instrumenté** (skill `ux-audit`) sur le build de prod : **96 captures**
   (16 écrans × desktop 1280×800 / mobile 360×640 × 3 crans de police).
   Résultat A1 : **0 cible < 44 px, 0 étape en échec** (exit 0).
3. **Mesures ciblées** ajoutées à la main (Playwright, arène mobile 360×640) sur
   les hauteurs réelles des surcouches DOM du combat — voir B2.
4. **Inspection visuelle** des captures des parcours réels (partie Haven, ville
   réelle, scénario, hot-seat, pré-combat, combat) aux crans 1 et 3.
5. **Lecture de code** : client (21 k lignes), points d'entrée moteur (dispatch,
   boucle IA, fin de tour), registre d'assets, service worker, parité i18n.
6. **Bilan des revues antérieures** (`game-ergonomics-immersion-review.md` §6,
   `game-feature-gaps.md`, 378 plans archivés) pour ne **pas re-proposer du
   livré** ni rouvrir un rejet acté.

### Ce qui est sain — à ne pas rouvrir

| Axe | État vérifié |
|---|---|
| Qualité statique | typecheck, lint, 935 tests, garde-fous CI : **verts** |
| A1 cibles ≥ 44 px | **0 warning** sur 96 captures (mesure DOM automatique) |
| A4 pile de modales | plafond structurel `MAX_MODAL_DEPTH = 2` (`app/router.ts:33`) |
| A8 i18n | **parité FR/EN exacte** : 1187 clés des deux côtés, 0 manquante |
| Budget bundle | 363 Ko gzip / 800 Ko — large marge |
| Écran de fin, hot-seat, journal, grimoire, marché tactile, garnison en un geste | livrés (lots 0→9 de la revue précédente), non re-listés ici |

**Lecture d'ensemble** : les fondations normées tiennent. Les défauts restants
sont (a) **quatre bugs réels** dont deux graves — un gel silencieux et une
occlusion du plateau de combat — invisibles des tests parce qu'aucun ne se
manifeste par une exception remontée ni par une cible trop petite ; (b) une
**densité d'interface** qui a dérivé écran par écran, chaque ajout étant
raisonnable seul mais l'empilement ne l'étant plus ; (c) une **lisibilité de la
carte** dégradée par l'échelle des jetons.

Sévérité : 🔴 bloquant / gêne majeure · 🟠 friction notable · 🟡 polish.

---

## 1. Bugs

### B1 🔴 Gel silencieux de la partie si un tour IA échoue

**Preuve** : `app/dispatch.ts:215` · `app/end-turn.ts:14-18`.

`runAiLoop` appelle `apply(...)` **directement**, hors du `try/catch` de l'appelant :

```ts
const result = apply(appStore.getState().game, { type: 'AiTurn', playerId: current.id });
```

Toute exception (erreur moteur sur un tour IA, ou le garde-fou
`MAX_AI_TURNS_PER_DISPATCH` ligne 209 qui `throw`) remonte à travers
`dispatch` (qui l'`await` ligne 115) jusqu'à `endHumanTurn` — dont le `catch` est
**vide** :

```ts
void dispatch({ type: 'EndTurn', playerId })
  .then(() => refreshDailiesForCurrentDay())
  .catch(() => { /* … non bloquant (comportement historique) */ });
```

Conséquence en chaîne : le `finally` remet `aiTurn: null` (l'indicateur de
progression disparaît), mais `currentPlayer` **reste sur l'IA**. Or toutes les
entrées humaines sont gardées sur ce test :
`AdventureScene.ts:469` (`handleTap` sort si le joueur courant n'est pas humain)
et `end-turn.ts:39` (`requestEndTurn` sort de même). La partie est **définitivement
figée, sans un seul message**, et la seule issue est de recharger la page — en
perdant le tour en cours si l'autosave n'a pas eu lieu.

Le même `catch` vide avale aussi un rejet de `EndTurn` lui-même ⇒ **B3**.

### B2 🔴 Le plateau de combat est caché sous la barre d'actions (mobile)

**Preuve** : `scenes/combat/CombatScene.ts:115-120` + `:288-292` ; captures
`combat-mobile-font1.png` (la pile ennemie « 12 » disparaît derrière le bandeau
d'aide) et `combat-mobile-font3.png` (elle est totalement invisible).

L'aire de jeu réservée à la caméra est calculée avec des **constantes figées** :

```ts
const MARGIN_TOP = 96;    // bandeau armées + round
const MARGIN_BOTTOM = 120; // barre d'actions
```

Or les surcouches DOM sont **fluides** (la barre passe de 2 à 4 rangées selon le
cran de police et le nombre d'actions disponibles). Mesure Playwright, arène
360×640 :

| Cran | En-tête réel | `MARGIN_TOP` | Bas réel (préviz + barre) | `MARGIN_BOTTOM` | **Plateau masqué** |
|---|---|---|---|---|---|
| 1 | 86 px | 96 | **157 px** (25 % du viewport) | 120 | **37 px** |
| 3 | 91 px | 96 | **217 px** (34 % du viewport) | 120 | **97 px** |

`layout()` centre donc le plateau dans une aire qu'il croit plus haute qu'elle ne
l'est, et le DOM recouvre le bas. À l'échelle plancher (hex ≥ 44 px), 97 px ≈ deux
rangées d'hexes perdues — dont, dans la partie de référence, **l'unique pile
ennemie**. Le joueur ne peut ni la voir ni la cibler sans paner à l'aveugle.

Note : la barre d'actions **seule** fait 121 px (19 %) au cran 1 — l'objectif du
lot 1a (« ≤ 18 % ») est donc quasi tenu pour elle ; c'est le **bloc bas complet**
(préviz + avertissement + barre) et surtout la **désynchronisation avec la
caméra** qui posent problème.

### B3 🟠 « Fin de tour » peut ne rien faire, sans explication

**Preuve** : `app/end-turn.ts:14-18` (même `catch` vide que B1).

Si `validate`/`apply` rejette la commande `EndTurn`, le bouton le plus utilisé du
jeu est un no-op muet. Le patron `pushToast(commandErrorMessage(err), 'error')`
est appliqué partout ailleurs (`AdventureScene.ts:538`, `combat.tsx:247`) — cette
voie-ci a été laissée en arrière (« comportement historique » assumé en
commentaire), ce qui contredit la remédiation CL3/R2 « plus d'erreur avalée en
silence ».

### B4 🟠 Le héros n'a pas de nom en combat

**Preuve** : `ui/combat.tsx:272`.

```tsx
<span class="combat-hero-name">{t('hero.genericName')}</span>
```

Le bandeau de combat affiche **toujours** « Le héros », alors que le sélecteur de
héros agissant, 90 lignes plus bas (`combat.tsx:360`), résout correctement
`resolveHeroName(h.name)`. Depuis M-TAVERN.2 et les héros canon (Isabel, Sandro,
Anton, Raelag…), le joueur mène des héros nommés : les voir réduits à « Le héros »
au moment le plus incarné du jeu casse l'identification. Même défaut sur le toast
de sort : `app/notifications.ts:227` interpole `t('hero.genericName')`.

### B5 🟠 Destination inatteignable : aucun retour

**Preuve** : `scenes/adventure/AdventureScene.ts:576-579`.

```ts
if (!path) { this.clearPreview(); return; }
```

Taper une tuile sans chemin (bloquée, hors domaine terre/mer, isolée) efface la
prévisualisation en cours et **ne dit rien**. Le joueur ne distingue pas
« inatteignable » de « mon tap n'a pas été pris en compte » — et il vient en plus
de perdre la préviz qu'il avait posée. Deux autres sorties silencieuses de
`handleTap` s'ajoutent : tour IA (`:469`) et animation en cours (`:462`).

### B6 🟡 « Réorganiser » / « Séparer » échouent en silence

**Preuve** : `ui/shell.tsx:573` et `:652` — `.catch(() => { /* … ignorée */ })`.

Le commentaire ne prévoit que le cas « hors tour », mais le `catch` avale
**tous** les rejets de `ReorderArmy` / `SplitStack`.

### B7 🟡 Identité du joueur humain en dur dans les contrats journaliers

**Preuve** : `app/daily.ts:27` (`const HUMAN_PLAYER_ID = 'player-1'`) et `:86`.

Résidu de la remédiation R3 (« plus de `'player-1'` en dur ») : les quêtes
journalières sont attribuées à `player-1` quel que soit le siège humain. **Pas de
bug observable aujourd'hui** — le seul appelant est le mode escarmouche, où
l'humain est `player-1` par construction (`skirmishStartCommand`). C'est une
bombe à retardement si les contrats sont un jour proposés en hot-seat ou en
« Nouvelle partie » (où le siège 1 peut être une IA). À corriger par principe,
pas par urgence.

---

## 2. Lourdeur d'interface

### H1 🔴 L'écran de ville : le décor chasse la fonction

**Preuve** : `ui/TownScreen.tsx:203-345` ; captures `market-mobile-font1.png`,
`town-real-mobile-font1.png`, `town-real-desktop-font1.png`.

Avant d'atteindre **la moindre action**, l'écran empile : bandeau de ressources,
cadre ornemental, titre + blason, ligne revenu, ligne croissance, ligne chantier,
panorama peint (~270 px), puis la rangée d'onglets (2 rangées sur mobile dès 4
onglets). Résultat mesuré sur les captures :

- **mobile** : le panneau Marché commence **sous le pli** — on ne lit que
  « Vend… / Achet… / T… » tronqués tout en bas ; il faut défiler pour voir le
  premier contrôle utile ;
- **desktop 1280×800** : le panorama consomme 270 px des ~700 px de la modale, il
  ne reste de la place que pour **1,5 fiche de bâtiment**.

Le panorama n'apporte par ailleurs **aucune information que la liste ne donne
déjà** (cf. H2) : c'est du coût vertical net.

### H2 🔴 Les emplacements de ville sont des pastilles anonymes

**Preuve** : `ui/TownScreen.tsx:426-498` (`TownSlotButton`) ; captures
`town-real-mobile-font1.png` (18 marqueurs) et `market-mobile-font1.png`.

Les emplacements sont rendus en **cercles blancs, carrés gris et triangles
beiges** posés sur l'illustration, **sans icône, sans nom, sans infobulle
visible**. On ne peut identifier aucun bâtiment sans taper dessus un par un. Sur
une faction sans décor peint, c'est pire : les marqueurs flottent dans un dégradé
vide, **désalignés des bâtiments dessinés**. La vue peinte livrée (UX-TOWNVIEW)
est donc décorative mais son **calque interactif est illisible** — c'est le
constat I6 de la revue précédente, non pas résolu mais déplacé.

### H3 🟠 Le HUD d'aventure mobile est éparpillé sur la carte

**Preuve** : `ui/shell.tsx:1302-1378` ; captures `adventure-real-mobile-font1.png`,
`quests-mobile-font1.png`.

Sept contrôles (mute, options, royaume, héros suivant, journal, Ville, Fin de
tour) flottent **sans panneau de fond** sur le terrain, en grille irrégulière à
deux colonnes, sur ~40 % de la hauteur. Les icônes sombres se posent sur du
feuillage et des objets de carte (le tas de bois, les bottes du scénario passent
sous les boutons). En face, le bandeau « Armée ▲ » **replié** occupe à lui seul
une bande noire pleine largeur. La barre du bas mélange trois niveaux
hiérarchiques (statut, navigation, action principale) sans les distinguer.

### H4 🟠 « Nouvelle partie » : ~28 réglages, aucun préréglage

**Preuve** : `ui/NewGameScreen.tsx:64-140` ; capture `newgame-mobile-font1.png`.

Le formulaire expose : nombre de joueurs, puis **par siège** contrôleur + faction
+ couleur + équipe + héros (5 × jusqu'à 4 sièges = 20 contrôles), puis taille de
carte, niveau de ressources, **4 curseurs de densité de contenu**, difficulté et
graine. Sur mobile, deux sièges remplissent déjà plus de deux écrans ; à quatre
sièges le bouton « Lancer » est à ~8 écrans de défilement. Il n'existe **ni
préréglage « démarrage rapide », ni section « Avancé » repliable** : un joueur qui
veut juste jouer doit traverser tout le paramétrage d'un éditeur de partie.

### H5 🟠 La barre d'actions de combat regrossit avec la police

Mesure : bloc bas = **25 % du viewport au cran 1, 34 % au cran 3** (360×640). Le
repli des secondaires derrière « ⋯ » (lot 1a) a bien réduit le cas nominal, mais
rien ne compense le passage aux crans 2/3 : les libellés à deux lignes
(« Attaque du héros » + sa raison de désactivation) refont grossir la barre.
S'y ajoute le **bandeau d'aide** posé **par-dessus le plateau**, dont le texte est
tronqué (« … prévisualis… ») dans les deux crans mesurés.

### H6 🟡 La barre de ressources est tronquée sur mobile

Capture `adventure-real-mobile-font1.png` : sur 360 px, les 7 ressources ne
tiennent pas — la dernière est coupée au bord droit **sans affordance de
défilement**. Le format compact (`formatResourceShort`, `shell.tsx:319`) traite
les grands nombres mais pas le nombre d'entrées.

### H7 🟡 Un bouton de ville par ville, sans plafond

`ui/shell.tsx:1355` : `towns.map((town) => <TownButton …/>)` rend **un bouton par
ville possédée** dans la barre de tour. En milieu/fin de partie (5-10 villes) la
rangée déborde ou écrase le bouton « Fin de tour ». L'écran Royaume existe déjà
et couvre ce besoin.

---

## 3. Ergonomie & lisibilité

### U1 🟠 Le choix de couleur de joueur repose sur la couleur seule

**Preuve** : `ui/NewGameScreen.tsx` (rangée `PLAYER_COLORS`) ; capture
`newgame-mobile-font1.png`.

Les pastilles ne portent **ni nom, ni motif, ni libellé** — seule la sélection est
marquée par un anneau. C'est une violation directe du pilier A5 du doc 08
(« jamais la couleur seule »), d'autant plus visible que le projet l'applique
partout ailleurs (`FactionBadge` à motifs, formes de camp, glyphes). La rangée
**déborde horizontalement** et la 7ᵉ pastille est coupée, là encore sans
affordance.

### U2 🟠 Le tiroir héros est translucide

**Preuve** : capture `hero-real-mobile-font3.png`.

La carte, les boutons du HUD (⚙, cloche et ses badges « 1 ») et « Fin de tour »
restent **lisibles à travers** le panneau. Au cran 3, le texte des attributs se
superpose au terrain. Le panneau ne couvre en outre pas toute la largeur : le HUD
sous-jacent déborde sur la droite.

### U3 🟠 Les jetons de carte font deux tuiles de haut

**Preuve** : `render/mapObjects.ts:41` · `render/projection.ts:14-23` ; captures
`adventure-real-mobile-font1.png`, `quests-mobile-font1.png`.

```ts
sprite.scale.set((TILE_SIZE * scale) / Math.max(texture.width, texture.height));
```

Les sprites sont mis à l'échelle sur une boîte **carrée de 64 px**, alors qu'un
losange iso mesure **64 × 32** (`ISO_TILE_W/H`). Un sprite carré occupe donc
visuellement **deux rangées de tuiles**. Effets constatés en partie réelle :

- le jeton du héros **recouvre entièrement la ville** sur laquelle il se trouve ;
- un groupe de gardiens chevauche trois tuiles et masque le terrain derrière ;
- sur la carte de scénario, coffre + héros + étable + marqueur de ville se
  superposent en un amas illisible.

Le rapprochement du zoom par défaut (commit `fe5aaf4`, passe de playtest) amplifie
le problème sur mobile, où la carte visible se réduit à ~5 × 5 tuiles largement
occupées par les jetons.

### U4 🟡 Marqueurs de carte en glyphe gris encadré jaune

Capture `quests-mobile-font1.png` : au milieu d'assets peints (coffre, étable,
obélisque, fontaine), les villes s'affichent en **glyphe de créneaux gris dans un
carré jaune**. C'est le reliquat I7(c) de la revue précédente, toujours ouvert et
d'autant plus voyant que le voisinage est maintenant peint.

### U5 🟡 Bandeau d'aide de combat tronqué et posé sur les jetons

Le bandeau « Sélectionnez une cible pour prévisualiser les dégâts » est **coupé
par ellipse** aux deux crans mesurés et recouvre la pile ennemie en bas de
plateau (voir B2).

### U6 🟡 File d'initiative coupée au bord droit (desktop)

Capture `combat-desktop-font1.png` : la dernière vignette est tranchée au pixel
1280. Le fondu de bord et l'auto-scroll livrés au lot 1a visaient le mobile ;
desktop non couvert.

### U7 🟡 Boutons d'action sans libellé sur desktop

`shell.tsx:1302-1351` : mute, options, royaume, héros suivant et journal sont
**icône seule**, y compris sur desktop où la place ne manque pas — alors que
« Ville » et « Fin de tour » sont textuels. Hiérarchie visuelle incohérente et
découvrabilité faible (l'information n'existe qu'en `title`/`aria-label`).

### U8 🟡 « Occupé — prochain chantier demain » se lit comme une erreur

`TownScreen.tsx:235-241` : l'état du créneau de chantier s'affiche **en rouge**
(classe `is-used`) et **dans tous les onglets**, y compris Marché, Garnison,
Guilde et Taverne où il n'a aucune incidence.

---

## 4. Hygiène de build & charge

### P1 🟠 2,8 Mo de planches de génération sont embarquées dans le build

**Preuve** : `render/assets.ts:19-26` ; `dist/assets/`.

```ts
import.meta.glob(['../../../../assets/**/*.png', '…/*.jpg', '!**/_preview.png'], …)
```

Le glob ratisse **tout** `assets/`, y compris le répertoire de **travail de
génération** `assets/prompts/` :

| Fichier embarqué | Poids | Nature |
|---|---|---|
| `prompts/_incoming/siege-ensemble.png` | 1,21 Mo | planche brute non découpée |
| `prompts/_incoming/siege-kit.png` | 1,12 Mo | planche brute non découpée |
| `prompts/siege-kit-template.png` | 452 Ko | gabarit de prompt |
| `prompts/siege-ensemble-template.png` + `siege-run-template.png` | 67 Ko | gabarits |

Total ≈ **2,85 Mo** jamais lus par le jeu, déployés sur Pages et éligibles au
cache du service worker. Seul `_preview.png` est exclu — l'exclusion n'a pas suivi
l'apparition de `prompts/`.

`dist/assets/` pèse au total **85 Mo** (748 PNG, 25 JPG), ce qui est cohérent avec
un jeu à 7 factions et un chargement paresseux, mais mérite un garde-fou (cf. P3).

### P2 🟡 Le logo du menu pèse 821 Ko

`assets/logo/heroes-master.png` (`render/assets.ts:127`) est chargé sur **le
premier écran**, avant toute interaction. C'est le plus gros fichier du chemin
critique.

### P3 🟡 Le cache du service worker est borné en nombre, pas en octets

`data/sw.js:18` : `ASSETS_MAX = 300` entrées. Avec des fonds de siège à ~620 Ko et
des toiles de combat à ~400 Ko, 300 entrées peuvent représenter **plusieurs
dizaines de Mo** — au-delà des quotas d'origine usuels sur mobile, où l'éviction
navigateur devient imprévisible. Aucun budget en octets n'est appliqué.

---

## 5. Rejets actés — à ne PAS re-proposer

Repris de la revue précédente §4, toujours valables :

- rail droit desktop « ressources + villes » (rejeté 3×) ;
- carte peinte continue à mouvement libre (casse le moteur tuile) ;
- temps réel / timers de construction / premium (doc 01 §3-4) ;
- option « mode daltonisme » (remplacée par des motifs permanents) ;
- re-planification de l'audio de base.

S'y ajoute, issu de cette revue : **ne pas supprimer le panorama de ville** (H1) —
le problème est sa priorité verticale et son calque interactif, pas son existence.

---

## 6. Plan de remédiation

Priorités : **P0** = correction de bugs et de blocages de jeu · **P1** = allègement
des écrans les plus fréquentés · **P2** = lisibilité et polish · **P3** = hygiène
et chantiers à cadrer.

Sauf mention contraire, tous les lots sont **client et/ou données uniquement —
zéro diff moteur, pas de bump `CURRENT_SAVE_VERSION`**. Chaque lot : plan dédié,
captures avant/après (`ux-audit`), et pipeline local vert (typecheck, lint, tests,
golden, garde-fous faction/couleurs, budget bundle, smoke) **avant** PR.

### Lot R0 (P0) — Ne plus jamais échouer en silence *(B1, B3, B5, B6 — ½ à 1 j)*

1. **`endHumanTurn` remonte l'erreur** (`app/end-turn.ts:14-18`) : remplacer le
   `catch` vide par `pushToast(commandErrorMessage(err), 'error')`, patron déjà
   standard ailleurs.
   → *vérif* : test unitaire client — un `dispatch` qui rejette produit un toast
   d'erreur ; le tour n'est pas consommé.
2. **Isoler l'échec d'un tour IA** (`app/dispatch.ts:203-219`) : entourer le
   `apply(… AiTurn …)` d'un `try/catch` **dans la boucle**. En cas d'échec :
   arrêter la boucle, émettre un toast d'erreur explicite, et **remettre la main
   au joueur** plutôt que de laisser `currentPlayer` sur l'IA (au minimum :
   signaler l'état bloqué et proposer le rechargement de la dernière sauvegarde).
   Idem pour le dépassement de `MAX_AI_TURNS_PER_DISPATCH`.
   → *vérif* : test unitaire — un `AiTurn` qui lève laisse un état où le joueur
   humain peut encore agir **et** un toast est émis ; plus aucun chemin ne mène à
   « aiTurn null + currentPlayer IA + zéro message ».
3. **Destination inatteignable** (`AdventureScene.ts:576`) : toast/indication
   « Destination inaccessible » quand `findPath` renvoie `null` **et** que la
   tuile visée n'est ni le héros ni hors carte ; conserver la préviz existante au
   lieu de l'effacer.
   → *vérif* : smoke `@core` — tap sur une tuile bloquée ⇒ toast présent, préviz
   inchangée.
4. **Réorganiser / Séparer** (`shell.tsx:573,652`) : ne plus avaler ; toast
   d'erreur (le cas « hors tour » reste silencieux si on le teste explicitement,
   au lieu de tout ignorer).
   → *vérif* : test unitaire du chemin d'erreur.

### Lot R1 (P0) — Rendre le plateau de combat visible *(B2, H5, U5 — 1 à 2 j)*

1. **Marges de caméra mesurées, plus figées** (`CombatScene.ts:115-120`,
   `:288-292`) : remplacer `MARGIN_TOP`/`MARGIN_BOTTOM` par les hauteurs réelles
   des surcouches DOM — `ResizeObserver` sur `.combat-armies` et `.combat-bottom`,
   ou variables CSS publiées par la couche DOM et lues par la scène. Re-`layout()`
   à chaque changement de hauteur (cran de police, apparition de l'avertissement,
   ouverture du « ⋯ »).
   → *vérif* : test smoke `@mobile` qui **mesure** — pour les crans 1 et 3, l'hex
   de chaque pile vivante est dans l'aire non recouverte ; assertion chiffrée
   « bas réel ≤ marge réservée » (aujourd'hui 157 > 120 et 217 > 120).
2. **Bandeau d'aide hors du plateau** : le déplacer dans le bloc bas (il y est
   déjà structurellement — c'est son positionnement flottant qui le pose sur les
   jetons) et **ne plus tronquer** le texte (retour à la ligne autorisé, la marge
   étant désormais mesurée).
   → *vérif* : capture cran 3 sans ellipse ni recouvrement de jeton.
3. **Compaction au cran 3** : les sous-libellés de raison (E2) passent en
   `title`/`aria` seuls au-delà du cran 1, ou la barre bascule en 2 rangées
   maximum avec débordement dans le tiroir « ⋯ ».
   → *vérif* : bloc bas ≤ 25 % du viewport **aux trois crans** (mesure smoke).

### Lot R2 (P1) — L'écran de ville redevient un outil *(H1, H2, U8 — 2 à 3 j)*

1. **Emplacements identifiables** (`TownScreen.tsx:426-498`) : chaque marqueur
   porte l'**icône du bâtiment** (celles de `buildings/` existent déjà et sont
   utilisées dans la liste) et son **nom** au survol/appui long, avec un état
   lisible sans couleur seule (construit / disponible / verrouillé par forme +
   glyphe, comme aujourd'hui, mais nommé).
   → *vérif* : capture — aucun marqueur anonyme ; test A5 (2ᵉ canal présent).
2. **Panorama repliable et mémorisé** : bascule « Vue / Liste » (état persisté en
   `localStorage`, comme `ARMY_BAND_KEY`), **replié par défaut en portrait**.
   → *vérif* : sur mobile, le premier contrôle du panneau actif est **au-dessus du
   pli** dès l'ouverture (mesure smoke `@mobile`).
3. **En-tête condensé** : revenu / croissance / chantier sur **une ligne** en
   portrait, et **état du chantier affiché uniquement dans l'onglet Construire** ;
   « Occupé » perd le rouge d'erreur au profit d'un ton neutre + glyphe.
   → *vérif* : capture des 6 onglets aux 3 crans.

### Lot R3 (P1) — Le HUD d'aventure se range *(H3, H6, H7, U7 — 1 à 2 j)*

1. **Un vrai panneau de barre d'actions** : fond opaque (encre du design system),
   rangée unique en portrait, ordre stable, séparation visuelle entre statut,
   navigation et action principale.
   → *vérif* : capture mobile — plus aucun bouton posé sur du terrain nu.
2. **Barre de ressources défilante** ou repliée : défilement horizontal avec
   fondu de bord (patron déjà livré pour la file d'initiative), ou masquage des
   ressources à 0 en portrait avec accès par la fiche détaillée existante.
   → *vérif* : aucune ressource coupée à 360 px, aux 3 crans.
3. **Plafonner les boutons de ville** (`shell.tsx:1355`) : au-delà de 2 villes,
   un bouton unique « Villes (N) » ouvrant l'écran Royaume déjà livré.
   → *vérif* : test client avec 5 villes — la rangée ne déborde pas.
4. **Libellés desktop** : afficher le libellé à côté de l'icône ≥ 900 px pour les
   5 boutons icône-seule.
   → *vérif* : capture desktop.

### Lot R4 (P1) — « Nouvelle partie » : jouer en trois taps *(H4, U1 — 1 à 2 j)*

1. **Bouton « Démarrage rapide »** en tête de la modale : 2 joueurs, factions
   aléatoires, carte moyenne, réglages standard, graine fraîche — lance
   directement.
   → *vérif* : smoke — depuis le menu, une partie démarre en ≤ 3 interactions.
2. **Progressive disclosure** : « Carte & contenu » (taille, ressources, 4
   densités) et « Adversaires » (au-delà du siège 1) deviennent des sections
   repliables, **fermées par défaut** ; seuls faction + nombre de joueurs +
   difficulté restent visibles.
   → *vérif* : capture mobile cran 1 — le bouton « Lancer » est atteignable en
   ≤ 1 écran de défilement à la configuration par défaut.
3. **Couleurs nommées** (U1) : chaque pastille porte son **nom localisé**
   (libellé ou infobulle avec équivalent tactile) et un **motif** distinctif ;
   la rangée devient défilante avec fondu de bord.
   → *vérif* : contrôle A5 — l'information de couleur a un 2ᵉ canal ; aucune
   pastille coupée.

### Lot R5 (P2) — La carte redevient lisible *(U2, U3, U4 — 2 à 3 j)*

1. **Échelle des jetons calée sur le losange** (`mapObjects.ts:41`) : borner la
   hauteur de sprite à ~1,5 × `ISO_TILE_H` (ou normaliser sur la hauteur du
   losange plutôt que sur `max(w,h)`), avec ancrage au pied. Objectif : un jeton
   **ne masque plus la tuile qu'il occupe ni ses voisines directes**.
   → *vérif* : captures avant/après aux zooms min/défaut/max ; la ville sous le
   héros reste identifiable.
2. **Zoom par défaut** : revoir le rapprochement du commit `fe5aaf4` à la lumière
   de (1) — au minimum, garantir un champ de vision utile en portrait.
   → *vérif* : nombre de tuiles visibles en portrait, mesuré avant/après.
3. **Tiroir héros opaque** : fond opaque plein (pas de translucidité) et largeur
   pleine en portrait.
   → *vérif* : capture cran 3 — aucun élément sous-jacent lisible à travers.
4. **Marqueurs de ville peints** (U4) : remplacer le glyphe gris/jaune par la
   vignette de ville par faction (dossier `buildings/` ou `badges/`), repli
   procédural conservé.
   → *vérif* : capture d'une carte de scénario.

### Lot R6 (P2) — Détails d'incarnation et de finition *(B4, U6 — ½ j)*

1. **Nom du héros en combat** (`combat.tsx:272`) et **dans les toasts**
   (`notifications.ts:227`) : `resolveHeroName(hero.name)` avec repli sur
   `hero.genericName` — exactement le patron déjà utilisé ligne 360.
   → *vérif* : test unitaire du libellé + capture d'un combat mené par Isabel.
2. **File d'initiative desktop** : appliquer le fondu de bord et l'auto-scroll
   déjà livrés en mobile.
   → *vérif* : capture desktop — plus de vignette tranchée.

### Lot R7 (P3) — Hygiène de build et de charge *(P1, P2, P3, B7 — ½ à 1 j)*

1. **Exclure le répertoire de génération du glob** (`render/assets.ts:19`) :
   ajouter `'!**/assets/prompts/**'` (et tout futur répertoire de travail) aux
   motifs de `import.meta.glob`. Gain immédiat : **−2,85 Mo** dans `dist/`.
   → *vérif* : garde-fou CI — aucun fichier de `assets/prompts/` dans
   `dist/assets/` après build (grep sur la liste des émis).
2. **Budget d'images en CI** : borne sur le **poids total** de `dist/assets` et
   sur le **poids du plus gros fichier du chemin critique** (logo, fonds de menu).
   Recompresser `logo/heroes-master.png` (821 Ko) à la taille réellement affichée.
   → *vérif* : nouvelle étape CI chiffrée, sur le modèle du budget bundle existant.
3. **Cache SW borné en octets** (`data/sw.js:18`) : ajouter un budget en méga-
   octets en plus du plafond d'entrées, éviction par ordre d'insertion inchangée.
   → *vérif* : test unitaire de la fonction d'élagage.
4. **B7** : `buildDailyQuests` reçoit l'id du joueur en paramètre au lieu de la
   constante `HUMAN_PLAYER_ID`.
   → *vérif* : test unitaire — les contrats visent le joueur passé, pas
   `player-1`.

### Ordre recommandé

| Vague | Lots | Effet joueur |
|---|---|---|
| 1 | R0 → R1 | Plus aucun blocage muet ; le combat mobile est enfin entièrement visible. |
| 2 | R2 → R3 | Les deux écrans les plus fréquentés (ville, carte) cessent de coûter du défilement. |
| 3 | R4 → R5 | On entre en partie en trois taps ; la carte se lit. |
| 4 | R6 → R7 | Incarnation, finition, et poids de livraison sous garde-fou. |

R0 et R1 sont **indépendants** et peuvent être menés en parallèle. R7 peut se
glisser à tout moment (aucune dépendance).

---

## 7. Suivi

- [x] Pipeline complet rejoué (typecheck, lint, 935 tests, build, budget bundle)
- [x] Audit instrumenté `ux-audit` : 96 captures, 0 warning A1, exit 0
- [x] Mesures Playwright ciblées sur l'occlusion du plateau de combat (B2)
- [x] Parité i18n vérifiée (1187 clés FR = EN, 0 manquante)
- [x] Constats B1-B7 / H1-H7 / U1-U8 / P1-P3 consignés avec preuve
      (`fichier:ligne` et/ou capture)
- [x] Plan par lots avec étapes et critères de vérification chiffrés
- [ ] Arbitrage utilisateur sur l'ordre des vagues
- [ ] Ouverture des plans dédiés par lot au fil des implémentations
  - [ ] R0 — ne plus échouer en silence
  - [x] R1 — plateau de combat visible (`.claude/plans/r1-plateau-combat-visible.md`)
  - [ ] R2 — écran de ville
  - [ ] R3 — HUD d'aventure
  - [x] R4 — nouvelle partie (`.claude/plans/r4-nouvelle-partie-trois-taps.md`)
  - [ ] R5 — lisibilité de la carte
  - [ ] R6 — incarnation & finition
  - [x] R7 — hygiène de build *(livré : `.claude/plans/r7-hygiene-build-charge.md`)*
