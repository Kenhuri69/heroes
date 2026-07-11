# Lot M-TAVERN.2 — Taverne côté client + héros canon du jeu d'origine

Demande utilisateur : « met en place le système complet des héros avec la
taverne et rajoute en même temps des héros du jeu d'origine ».

État des lieux : le moteur est **déjà complet** (M-TAVERN.1 : effet `tavern`,
`GameState.heroRoster` persisté v25, commande `RecruitHero` ; H-NAMED.1 :
fiches gameplay `heroes/<id>.json` → `buildHeroRoster`) et la sélection
multi-héros client existe (lot U4 : `selectedHeroId`, bande `HeroStrip`,
touche N, jetons par héros). Les trous réels :

1. **Aucune UI de recrutement** — la Taverne se construit mais ne sert à rien
   dans le client (différé M-TAVERN.2 explicitement).
2. **Aucun héros du jeu d'origine** — le roster ne contient que 2 originaux
   Haven (Aldric/Séraphine) ; Necropolis (2ᵉ faction du jeu d'origine) n'a
   aucune fiche.
3. Trou latent : le tiroir héros affiche la spécialité via
   `t('hero.specialty.<id>.name')` (locales CORE uniquement) — les spécialités
   des héros nommés (paquets) n'ont pas ces clés ⇒ clé brute à l'écran dès
   qu'un héros nommé entre en jeu.

## Portée

### A. Client — onglet Taverne (M-TAVERN.2)

- `TownScreen.tsx` : `hasBuiltEffect` étendu à `'tavern'` ; onglet **Taverne**
  affiché seulement si le bâtiment est construit (même règle que
  Marché/Guilde) ; `selectBuilding` route la vignette Taverne vers l'onglet.
- `TavernTab` : liste les entrées de `game.heroRoster` dont
  `factionId === town.factionId` — avatar (`heroAvatarUrl` + archétype dérivé
  des attributs), nom (`resolveLoc(def.name)`), bio + texte de spécialité via
  les clés de paquet `hero.<id>.bio` / `hero.<id>.specialty` (repli : masqué),
  attributs, coût (`config.hero.recruitCost`), compteur `héros/max`.
  Bouton Recruter → `dispatch({type:'RecruitHero', …})` ; erreurs via
  `commandErrorMessage` (bandeau existant). États : déjà recruté (vivant),
  cap atteint, or insuffisant ⇒ bouton désactivé + libellé. Après succès :
  `selectedHeroId` = `newHeroId` de l'événement `HeroRecruited` (le nouveau
  héros devient le héros actif ; il apparaît de lui-même dans `HeroStrip`).
- Roster vide pour la faction ⇒ message `town.tavernEmpty` (cas
  arcane-hunters / sylvan-court / vox-arcana : fiches gameplay différées).
- **Moteur (export pur uniquement, zéro règle)** : `recruitedHeroId` exporté
  (déjà défini dans `hero/recruit.ts`) pour que le client teste « déjà
  recruté » sans dupliquer la convention d'id (leçon CL9/R7).

### B. Correctif tiroir héros — libellés de spécialité

- `i18n.ts` : `resolveSpecialtyName/Desc` (CORE → paquet, motif
  `resolveCoreOrPack`) ; `shell.tsx` (HeroDrawer) les utilise.
- Locales paquet : `hero.specialty.<sid>.name/.desc` pour les spécialités des
  héros nommés existants (meneur, liturgiste) + nouvelles.

### C. Données — héros canon du jeu d'origine (origin `canon`)

Le jeu d'origine (*Might & Magic: Heroes Online*) a 2 factions jouables :
Haven et Necropolis. Héros canon de l'univers Might & Magic (Ashan),
`source: "Might & Magic"`, avatars = clés existantes
`<faction>-<archetype>` (repli procédural sinon) :

- **Haven** : Anton (might, duc de Griffon — spécialité *Protecteur du Duché*
  `garrisonDefense: 2`), Freyda (might, chevalière — *Charge de cavalerie*
  `meleeDamagePct: 10`), Isabel (magic, reine — *Trésor impérial*
  `goldPerDay: 250`).
- **Necropolis** : Sandro (magic, liche — *Maître liche*
  `manaCostReductionPct: 15`), Markal (magic, conseiller — *Intrigant de cour*
  `goldPerDay: 200`), Ornella (might, chevalière noire — *Dame noire*
  `armorReductionPct: 10`).

Chaque fiche : attributs (somme 6, cohérente avec Aldric/Séraphine),
compétences de départ (rang 1, catalogue core + `heroSkills` de faction),
sorts de départ dans l'école de la faction (lumiere / prime), locales FR/EN
(name/bio/specialty + specialty.<sid>.name/desc), `manifest.heroes` mis à jour
(création de la clé pour necropolis).

- **test-faction** : 1 héros original minimal (`tavernier` d'essai) pour que
  la partie rapide proto-01 (ville test-faction) ait un recrutable ⇒ smoke.

Non inclus (différés, inchangés) : Vhalen/Mère Corbeau, Evadne/Alwin,
Faelar/Sylwen (spécialités **conditionnelles** hors vocabulaire générique —
nouveau point d'extension moteur requis), fiches gameplay Vox (doc 16),
combat héros-vs-héros, échanges inter-héros (UX-HEROSWAP), exclusivité de
pool inter-joueurs, IA qui recrute des héros, choix du héros de départ
(H-NAMED.2).

## Invariants

- **Zéro faction dans le moteur** (seul diff moteur : un `export` de helper
  pur) — garde-fou CI vert.
- **Pas de bump `CURRENT_SAVE_VERSION`** (aucune forme d'état ne change).
- **Golden inchangé** (contenu hors replay inline ; aucun changement de règle).
- i18n : parité FR/EN, zéro chaîne en dur ; cibles tactiles ≥ 44 px.

## Étapes

1. [x] Plan écrit (ce fichier).
2. [x] Moteur : export `recruitedHeroId` (+ index). → typecheck ✓.
3. [x] Données : 6 fiches canon + 1 test-faction + manifestes + locales FR/EN
   (fiches + spécialités meneur/liturgiste). → content:check ✓, tests contenu ✓
   (hero-identity, faction-locale parité).
4. [x] Client : onglet Taverne + TavernTab + sélection post-recrutement +
   resolveHeroName/resolveSpecialty*/resolveHeroBio + HeroDrawer + styles +
   locales core FR/EN. → typecheck + lint ✓.
   **Écart découvert** : `newGameCommand` (partie rapide) et
   `newGameStartCommand` (« Nouvelle partie » N joueurs) n'embarquaient PAS
   `heroRoster` à `StartGame` (seuls scénario/escarmouche le faisaient depuis
   M-TAVERN.1) ⇒ Taverne vide sur ces chemins. Corrigé : le roster est passé
   par les 4 chemins.
5. [x] Smoke : « taverne : construire ⇒ onglet ⇒ recruter » — desktop + mobile
   ✓ (onglet absent avant construction, bouton désactivé sous 2500 or,
   recrutement ⇒ 2 héros, or 0, carte « Recruté », portrait sélectionné,
   tiroir avec nom/spécialité résolus).
6. [x] Docs : doc 02 (M-TAVERN.2 livré + table bâtiments), doc 03 §5 / doc 04
   §5 (héros canon + différés conditionnels), doc 08 §2.1/§2.2 (onglet
   Taverne), CLAUDE.md (mémoire).
7. [x] Vérifs complètes : typecheck ✓ · lint ✓ · tests engine 546 ✓ + content ✓
   · golden inchangé ✓ · garde-fou faction ✓ · couleurs ✓ · budget 296 Ko
   < 800 Ko ✓ · smoke complet **150 passés / 2 skip / 0 échec** ✓.
8. [ ] Commit + push `claude/hero-system-tavern-eob1jr`, PR draft.

## Suite — M-TAVERN.3 : portraits dédiés (post-merge #262)

L'utilisateur a généré les 3 portraits Haven depuis les prompts fournis
(Règle B doc 12 §3/§7.3). Branche repartie de `main` (PR #262 mergée).

1. [x] Staging : `assets/heroes/haven-{anton,freyda,isabel}.png` — 256²,
   115/121/116 Ko < 150 Ko (redimensionnés depuis les uploads 1024²).
2. [x] Fiches : `avatar` bascule des clés génériques vers `haven-<id>`.
3. [x] Client : résolution d'avatar PAR HÉROS — `initHeroAvatars(report)`
   (réf de nom `@loc:hero.<id>.name` → clé `avatar` de fiche, même valeur que
   `HeroState.name`/`ResolvedHeroDef.name`) ; `heroAvatarUrl` gagne un
   3ᵉ paramètre `heroName?` (portrait dédié si présent, repli archétype).
   Branché : tiroir héros, onglet Taverne, écran pré-combat, médaillon de la
   scène de combat. Effet de bord voulu : les portraits Vox déjà stagés
   (anastasia/celeste/iris) s'affichent enfin.
4. [x] Necropolis : portraits reçus et stagés
   (`assets/heroes/necropolis-{sandro,ornella,markal}.png`, 122/125/123 Ko),
   fiches basculées. Doc 04 mis à jour.
5. [x] Smoke : nouveau test « le portrait DÉDIÉ d'un héros canon s'affiche »
   (escarmouche Haven ⇒ Taverne ⇒ `src` de la carte d'Anton contient
   `haven-anton`). Suite complète 152 passés / 2 skip / 0 échec + unitaires
   660 ✓ (avant staging Necropolis ; re-vérifiée ciblée après).
6. [ ] Commit + push + nouvelle PR.

## Journal

- Branche : `claude/hero-system-tavern-eob1jr` depuis main @ 5bdb5c9.
- Sources héros canon : univers Might & Magic (Ashan) — MMHO n'a pas de
  roster nommé documenté (héros-joueur créé), on puise dans les héros canon
  des factions du jeu d'origine (Anton, Freyda, Isabel / Sandro, Markal,
  Ornella).
