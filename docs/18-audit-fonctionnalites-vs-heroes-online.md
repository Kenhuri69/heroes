# 18 — Audit de fonctionnalités : Heroes vs *Might & Magic: Heroes Online*

> **Statut** : audit livré (session documentaire, 2026-07). Aucun code modifié.
> Ce document est la **source de vérité** du plan de comblement des écarts ; chaque
> lot lancé devra ouvrir son plan vivant `.claude/plans/<feature>.md` (guidelines §5)
> et respecter les invariants non négociables (guidelines §8 : zéro faction dans le
> moteur, déterminisme seedé, moteur sans rendu, touch-first, fidélité core loop).

## 0. Méthode & périmètre

- **Référence** : *Might & Magic: Heroes Online* (MMHO, Ubisoft Blue Byte,
  navigateur, 24 sept. 2014 → fermeture 30 déc. 2020). Sources publiques :
  Wikipedia, wikis Fandom (mightandmagic / heroes-online), review mmos.com,
  preview Celestial Heavens, fiches Kongregate/MMORPG.com.
- Là où MMHO était lui-même une simplification de la série, la comparaison est
  complétée par la **profondeur HoMM classique** (HoMM3/5), le projet revendiquant
  la « fidélité au core loop HoMM avant toute innovation » (guidelines §8.5).
- **Divergences délibérées confirmées hors périmètre** (doc 01 §3-4, plan
  `homm-online-divergence-remediation`) : MMO temps réel à monde partagé
  persistant, monétisation premium / pay-to-win (Hero Seals : résurrection
  d'unités payante, espionnage payant, boosts). Ces items ne sont **pas** des
  écarts à combler et ne figurent au §2 que pour mémoire.
- **Inventaire de l'existant** : relevé exhaustif moteur (`packages/engine`),
  client (`packages/client`), données (`data/`), assets (`assets/`) réalisé pour
  cet audit — synthèse au §1, détails cités par fichier dans les fiches d'écart.

## 1. Synthèse de l'existant (état 2026-07)

Le projet couvre déjà l'essentiel du gameplay MMHO et va **au-delà** sur
plusieurs axes (le modèle de ville complet façon HoMM, 7 ressources + ressources
de faction, 7 factions data-driven, campagnes scénarisées, hot-seat, PvP
asynchrone re-simulé côté serveur, PWA hors-ligne). Systèmes livrés :

| Domaine | Livré (fichiers pivots) |
|---|---|
| Carte d'aventure | A* 8 dir., brouillard 2 états, ~14 types d'objets (mines, coffres, artefacts, 13 effets de lieux de bonus, habitations, monolithes/téléporteurs, obélisques + Graal, triggers), gardiens (errants, sentinelles `guardedBy`, butin gradué), calendrier semaine/mois à événements seedés (`engine/adventure/*`) |
| Villes | Arbre de bâtiments gradués + prérequis, 1 construction/jour, recrutement/upgrades, croissance hebdo, garnison, capture, **sièges** (murs + porte + douves + tour + catapulte), marché, guilde de mages, taverne (roster exclusif), caravanes, contrats de chasse, croissance partagée (`engine/town/*`) |
| Combat hex | 15×10, vagues d'initiative + attente, riposte, moral/chance, ~40 capacités génériques, 56 sorts / 9 écoles / 5 cercles, machines de guerre (baliste/catapulte/tour), obstacles (tir par-dessus), phase tactique, retraite/reddition/abandon, IA déterministe + auto-combat (`engine/combat/*`) |
| Héros | 4 attributs, 16 compétences × 3 rangs, artefacts 10 slots + sac + 1 panoplie, spécialités (dont conditionnelles), archétypes might/magic (pondération d'attributs), sorts d'aventure, 8 héros/joueur, transfert, héros-vs-héros (`engine/hero/*`) |
| Méta | Sauvegarde versionnée (v32), replays par journal de commandes, golden hash, hot-seat, alliances, 4 conditions de victoire, quêtes (8 types de conditions) + campagnes/dialogues/cutscenes côté client, quotidiennes (N4c), événements temporaires (N4d), backend Workers+D1 (auth magic-link, cloud saves, PvP async), PWA |
| Client | ~30 écrans/overlays (dont minimap, journal de quêtes, pré-combat avec Auto-Battle/Abandon), rendu iso chunké/culé, animations tween combat + carte, audio complet (12 musiques, 20 SFX), repli procédural systématique |

## 2. Écarts identifiés

Chaque fiche : **Réf.** (ce que faisait MMHO et/ou HoMM) · **État** (ce qui existe)
· **Manque** · **Nature** (moteur générique / données / client / assets / backend)
· **Priorité** (P1 fort impact gameplay ou fidélité, P2 profondeur appréciable,
P3 opportuniste ou dépendant d'une décision).

### 2.A Carte d'aventure

**A1 — Représentation visuelle de la taille des gardiens** *(l'exemple fondateur
de cet audit)*
- **Réf.** : HoMM affiche une gradation perceptible du danger ; MMHO
  différenciait visuellement les gardes de planques mineures et majeures.
- **État** : la fourchette **textuelle** est livrée et conforme à la spec (doc 02
  §2.2) — 7 bandes `few/several/pack/lots/horde/throng/legion` (seuils
  4/9/19/49/99/249/∞ dans `data/core/config.json → display.strengthBands`),
  affichées au survol (`shell.tsx → guardianBand`) et sur la fiche d'appui long
  (`MapObjectCard.tsx`). L'effectif exact n'est jamais révélé (choix assumé),
  compensé par l'abandon gratuit au pré-combat.
- **Livré** (sprint 2) : **gradation visuelle** du jeton — `render/strengthBand.ts`
  réduit les 7 bandes à **3 crans** (`lone`/`group`/`horde`, `bandTier`) pilotant
  le rendu du gardien sans jamais révéler l'effectif exact (paliers 0+1 du §3).
  Client pur, **zéro diff moteur**. *Reste (P3)* : art dédié par cran (repli
  procédural en place).

**A2 — Croissance des gardiens dans le temps** ✅ *(croissance + respawn livrés)*
- **Réf.** : HoMM : les piles neutres croissent (~+10 %/semaine) ; MMHO :
  les gardes **réapparaissent** après un délai pour re-farmer les planques.
- **Livré** : (a) **croissance hebdomadaire** opt-in — `config.guardianGrowth
  { weeklyFactor, maxCount }` appliqué au `WeekStarted` (`engine.ts`) ; (b)
  **respawn** opt-in façon MMHO — `respawn.ts`/`queueGuardianRespawn` remet en
  file un gardien vaincu (utile aux scénarios `survival`/quotidiennes). Config
  absente ⇒ inchangé (golden épargné, pas de bump save : `count` déjà dans l'état).

**A3 — Eau navigable & bateaux**
- **Réf.** : HoMM (chantier naval, embarquement, tourbillons) ; MMHO n'en avait
  pas (zones terrestres).
- **État** : l'eau est un terrain `moveCost: null` (infranchissable) ; le mapgen
  garantit la connexité terrestre par corridors.
- **Manque** : tout le sous-système naval. **Non-écart vs MMHO** ; écart vs HoMM.
- **Nature** : moteur (déplacement + objets `boat`/`shipyard`) + mapgen + client
  + assets — chantier **lourd**.
- **Priorité** : P3 — décision de cadrage requise avant tout travail.

**A4 — Effets de calendrier au mois** ✅ *(événements mensuels livrés)*
- **Livré** : `calendar.monthEvents` (`CalendarMonthEventDef`) — un événement de
  **mois** persistant tiré au seed et stocké dans `calendar.monthEventId`
  (`calendar.ts`), à côté des semaines seedées (M-CALENDAR). No-op sans
  `monthEvents` configuré (parties/golden inchangés). *Reste (P3, données)* :
  contenu supplémentaire de mois thématiques.

**A5 — Triggers de carte limités** ✅ *(livré — effets riches de trigger)*
- **Livré** : `TriggerEffect` enrichi (`map.ts`/`triggers.ts`) — au-delà de
  `grantResource`/`message` : **combat scripté** sur tuile (`ambush`), **don
  d'artefact** (`grantArtifact`), **don d'armée** (`grantArmy`), **téléport
  scripté** (`teleport` : déplace le héros visiteur, révèle la vision, interrompt
  le chemin sans combat ; garde-fou hors-carte) et **message à choix** (`choice` :
  `pendingTriggerChoice` — état d'attente jumeau du trésor, modale forcée
  `TriggerChoice`, `ResolveTriggerChoice` / IA option 0 ; l'effet-feuille de
  l'option choisie s'applique à la résolution).
- **Complété (A5c)** : effets de **retrait** miroirs des octrois — `removeArtifact`
  (ôte l'artefact d'un slot équipé, sinon du sac ; absent ⇒ no-op) et `removeArmy`
  (réduit la pile `unitId` de `count`, slot supprimé à 0) — deux variantes
  `SimpleTriggerEffect` (donc utilisables aussi comme branche d'un `choice`),
  péage/tribut/malédiction scriptés. Opt-in par données ⇒ golden inchangé, pas de
  bump save.
- **Complété (A5d)** : `flagCaptured` — nouvelle **condition** de trigger
  (`on: { kind: 'flagCaptured'; objectId }`) déclenchée quand une mine/habitation/
  ville change de main (hooks aux 4 sites de capture : `movement.ts` mine +
  habitation, `town/capture.ts` ville non défendue, `combat/turns.ts` ville prise
  au siège). Effet **restreint aux `SimpleTriggerEffect`** (appliqué sans
  interruption ; garde-fou schéma superRefine rejetant ambush/teleport/choice).
  One-shot ; ignoré par `fireVisitTrigger`/`fireDayTriggers`. Opt-in par données
  ⇒ golden inchangé, pas de bump save. **La famille de triggers A5 est close.**

**A6 — Villes neutres hors `MapObjectDef`** ⛔ *(non retenu — frontière de design)*
- **État** : le mapgen émet des villes neutres comme objets `type: 'town'`
  (schéma + `assets/layouts/`), que le **client** convertit en `TownState`
  (owner `null`) à `StartGame` et **filtre** hors des objets passés au moteur
  (`game.ts`). Le moteur modélise les villes en `TownState`, pas en `MapObjectDef`.
- **Verdict** (revue 2026-07) : **non retenu**. « Instancier comme objet de carte
  moteur » = déplacer cette création dans le handler `StartGame` (cœur) + variante
  `MapObjectDef.town` + loader — un **refactor du cœur à risque de régression pour
  zéro impact joueur** (l'audit le note lui-même). La frontière contenu↔moteur
  actuelle n'est pas cassée ; la refactoriser viole les guidelines §2/§3. **Clos
  comme choix de design assumé.**

### 2.B Combat

**B1 — Pénalité de portée de tir** ✅ *(sprint 1 — moteur + config + préviz livrés)*
- **Réf.** : HoMM3 : ½ dégâts au-delà de 10 hexes ; MMHO avait des tireurs à
  portée bornée.
- **Livré** (commit « sprint 1 ») : règle générique `combat.rangePenalty
  { hexes, factor }` — un **tir** au-delà de `hexes` cases inflige `×factor`,
  jamais cumulé avec la pénalité de mêlée ; branchée dans `computeMultiplier`/
  `performStrike`/`estimateDamage` (`combat/damage.ts`, préviz = résolution),
  validée par schéma (`content/schemas.ts`). **Activée en données** à
  `{ hexes: 10, factor: 0.5 }` (fidélité HoMM3, ½ dégâts au-delà de 10 hexes),
  doc 02 §5.3. **Opt-in** : bloc absent ⇒ portée illimitée sans falloff (golden
  inchangé). Répond au déséquilibre « tireurs structurellement surpuissants ».

**B2 — Machines de guerre : tente de premiers soins & chariot de munitions** ✅ *(2 machines livrées)*
- **Réf.** : suite HoMM ; MMHO avait des consommables de soin.
- **Livré** : deux comportements génériques de machine appliqués en début de
  round (`turns.ts`) — `healPerRound` (soigne la pile alliée la plus blessée) et
  `replenishAmmo` (recharge les tireurs entamés) — portés par deux nouvelles
  entrées `first-aid-tent` / `ammo-cart` (`data/core/war-machines.json`, piles
  immobiles). Repli procédural pour les sprites. **Priorité** : P2 → clôturé.

**B3 — Renforts en cours de combat (signature MMHO)** ✅ *(retenue — moteur + client livrés)*
- **Réf.** : MMHO permettait de **recruter des renforts pendant la bataille**
  (PvE uniquement), contre or — l'une de ses mécaniques distinctives.
- **Décision** (arbitrage utilisateur 2026-07) : **retenue** en fidélité MMHO,
  **strictement opt-in par config et PvE only** (mécanique clivante ⇒ activée par
  scénario/mode, jamais globalement par défaut).
- **Livré (moteur)** : commande `CallReinforcements { unitId, count }` +
  `config.combat.reinforcements` opt-in (cf. doc 02 §5) — ajoute une pile fraîche
  d'une unité commandée, contre or (`recruitCost × count × costMultiplier`),
  plafonnée (`maxCallsPerCombat`/`maxUnitsPerCall`), n'agit qu'au round suivant ;
  gate PvE (`defenderHeroId` null + héros lié). Champ lazy `reinforcementsUsed` ⇒
  pas de bump save, golden inchangé. **Client livré** : bouton « Renforts » + modale
  sélection unité/effectif (coût prévisualisé) ; feature **activée globalement** en
  PvE via `config.json` (2 appels max, ×2 le coût), le PvP restant intact (gate).

**B4 — Mort subite / borne de fin en PvP (MMHO « Sudden Death »)** ✅ *(règle opt-in livrée)*
- **Réf.** : MMHO : au-delà d'un délai, l'équipe avec le plus d'unités gagne.
- **Livré** : règle déclarative `combat.suddenDeath { round, resolution }`
  (`turns.ts`) — au-delà de `round`, le combat est tranché en faveur du camp au
  plus fort `armyStrength` restant. **Opt-in par config** (absente ⇒ combat non
  borné, comportement historique/golden inchangé), destinée au mode en ligne.

**B5 — Créatures 2-hex**
- **Réf.** : HoMM classique (dragons, cavalerie). **MMHO : toutes les créatures
  occupaient 1 hex** (préview Celestial Heavens) — le projet est donc **fidèle
  à MMHO**.
- **État** : structurellement mono-hex (`OffsetPos` unique).
- **Verdict** : **non-écart** vs la référence MMHO. À documenter comme choix (doc
  02 §5.1) ; ne rouvrir que si une future faction l'exige (chantier moteur lourd :
  position, pathing hex, souffle, sièges).
- **Priorité** : P3 (documentation immédiate, mécanique non planifiée).

**B6 — « Juice » de combat : projectiles & effets de sorts** ✅ *(sprint 1 — projectiles + FX de sorts livrés)*
- **Réf.** : MMHO (Flash) animait tirs et sorts — lisibilité et plaisir de jeu.
- **Livré** (commit « sprint 1 ») : module `render/combatFx.ts` (client pur, zéro
  moteur) — **projectile interpolé** tireur→cible sur un tir (le SFX
  `combat-shoot` ne « tire » plus dans le vide) et **effet visuel de sort**
  (flash/onde d'impact), branchés dans `CombatScene`. Repli procédural (trait
  lumineux) ⇒ aucune dépendance d'assets bloquante.
- **Reste (P3, non bloquant)** : sprites idle/walk animés (le statique demeure).

### 2.C Héros

**C1 — Effets structurels de classe Might / Magic (signature MMHO)** ✅ *(perks d'archétype livrés)*
- **Réf.** : MMHO — classe **Might** : slot d'armée **supplémentaire** ; classe
  **Magic** : **2 actions de héros par round** en combat.
- **Livré** (lot 3.1, doc 02 §1) : `config.hero.archetypeEffects` (clés opaques)
  pose à la création d'un héros nommé des effets déclaratifs du pot commun
  (`HeroState.archetypeEffects?`, optionnel paresseux ⇒ pas de bump save) :
  **might** = `armySlotsBonus: 1` (8ᵉ slot, cap via `heroArmyCap`) ; **magic** =
  `heroActionsPerRound: 1` (2 actions/round). **Zéro `if (archetype)` en dur**
  (agrégés comme compétences/Maison/spécialité). Héros génériques inchangés.

**C2 — Panoplies d'artefacts supplémentaires** ✅ *(3 panoplies livrées)*
- **Livré** : trois panoplies en données (`artifacts.json`) — `panoplie-gladiateur`
  (might), `regalia-archimage` (magic, 3 pièces), `attirail-voyageur`
  (économie/mobilité) — le tiroir héros affiche la progression `n/seuil` (doc 02
  §1.1). **Données pures**, zéro moteur.
- **Complété (lot 3.2)** : la **rareté graduée en profondeur** est **livrée** —
  champ `rarity` (1–3) sur `artifactSchema`, porté par 16 artefacts de
  `core/artifacts.json` ; `mapgen.ts` place les artefacts au sol via
  `artifactIdForDepth` (tri par rareté croissante, index ∝ profondeur `depthAt` =
  distance au départ le plus proche, jitter seedé) ⇒ commun près du départ, rare
  au fond ; le client lit `artifact.rarity` du catalogue (`content.ts`,
  `artifactRarity`). Tests `artifact-sets.test.ts`/`mapgen.test.ts`. *Reste (P3)* :
  **icônes finales** (chantier assets doc 12, repli procédural en place).

**C3 — Arbre d'aptitudes à points (modèle MMHO)**
- **Réf.** : MMHO : ~20 points d'aptitude répartis dans 6 arbres par faction,
  avec respec.
- **État** : modèle HoMM (16 compétences × 3 rangs, choix aléatoire seedé de 2
  propositions à la montée).
- **Verdict** : **divergence assumée recommandée** — le modèle HoMM est au cœur
  du core loop revendiqué ; l'arbre MMHO était lié à sa structure MMO. À acter
  en décision de design (doc 02 §1.3) plutôt qu'à combler. **Priorité** : P3
  (décision documentaire seulement).

### 2.D Villes & économie

**D1 — Vue de ville peinte** ✅ *(lots UX U5 + UXD-5 + UX-TOWNVIEW — livré)*
- **Livré** : `TownScreen` ouvre une **vue peinte** (`TownView`) — décor de fond
  par faction (`townBackgroundUrl`, repli gouache CSS si l'asset manque) sur lequel
  chaque bâtiment est **posé en absolu à sa place** (`townLayout` + ancres bespoke
  `assets/layouts/town-<faction>.json`), **cliquable** (tap ⇒ construire/action),
  statut construit/disponible/verrouillé marqué par pastille non chromatique +
  opacité (a11y doc 08 §4), inspection au survol/appui long. Repli dessiné si une
  vignette manque. L'onglet **liste** reste (entrée mobile). Doc 08 §2.2/§5.
- *Reste (chantier assets continu, doc 12)* : fonds/vignettes peints finaux par
  faction (repli procédural en place partout).

**D2 — Commerce avancé** ✅ *(troc + marchand d'artefacts achat/vente livrés)*
- **Livré** : `TradeResources` accepte **toute paire** `give`/`receive` de
  ressources (or↔ressource **et** ressource↔ressource direct, taux `config.market`
  dégressif par nombre de marchés, refus du troc identité) — `town/market.ts`.
  **Marchand d'artefacts** (`town/artifact-merchant.ts`, section « Marchand » de
  l'onglet Marché) : **VENTE** (`SellArtifact`) d'un artefact d'un héros présent
  contre or (prix dérivé des bonus, `artifactSellFactor`) ; **ACHAT** (`BuyArtifact`)
  depuis un **stock dérivé déterministe** par `townId` (`merchantBuyStock`,
  `artifactStockSize`, RNG local hors `draft.rng`) au prix plein, l'acheté quittant
  le stock (`TownState.artifactsBought`). Prix data-driven, override `ArtifactDef.value`.
- Commerce inter-joueurs = non-écart vs MMHO (exclu). **D2 clôturé.**

### 2.E Multijoueur & social (l'identité MMHO)

**E1 — Vue de royaume (kingdom overview)** ✅ *(sprint 3 — vue agrégée livrée)*
- **Réf.** : indispensable dès 2+ villes (MMHO avait la gestion mono-cité ; HoMM
  a l'écran de royaume).
- **Livré** (sprint 3) : modale `KingdomOverview` (`ui/KingdomOverview.tsx`,
  toggle dans la barre, `router` modal `kingdom`) — vue agrégée du royaume du
  **joueur humain** : villes (chantier du jour, garnison résumée, revenu or/jour),
  héros (PM restants/max), totaux. **Client pur** (lit `dailyIncome`/`TownState`/
  `HeroState`), zéro moteur. *Voir E3* pour le comparatif inter-joueurs (distinct).

**E2 — Classement / ligues saisonnières PvP (MMHO : arène + ligues)** ✅ *(lot 4.2)*
- **État initial** : PvP async fonctionnel ; aucun classement/saison/matchmaking.
- **Livré** : table `ratings` (Elo par profil ET par saison mensuelle 'YYYY-MM'),
  math Elo pure `engine/net/elo.ts` (départ 1200, K=32, unitaire), mise à jour
  pairwise à la résolution d'un match `finished`, endpoint `GET /leaderboard`,
  section « Classement » du panneau En ligne. **Reste** : matchmaking (P3 Live).

**E3 — Guilde des voleurs / comparatif inter-joueurs** ✅ *(lot 3.3 — livré)*
- **Réf.** : HoMM (thieves guild) ; MMHO vendait l'espionnage (exclu, premium).
- **Livré** (lot 3.3) : comparatif **en partie** à l'onglet Taverne de
  `TownScreen` — table par joueur (siège+couleur, villes, héros, **force
  d'armée**, or/jour, rang) avec **précision graduée** par niveau du bâtiment
  (garnisons secrètes). Projections **pures** `thievesGuildRows`/`thievesGuildRank`
  (`app/game.ts`, réutilisent `armyStrength`/`dailyIncome`), zéro diff moteur.

**E4 — Combats coopératifs (signature MMHO)** 🚧 *(E4.1 cadrage + E4.2 gardien + E4.2b siège + E4.3 butin + E4.5 client livrés — coop PvE JOUABLE, butin partagé)*
- **Réf.** : MMHO permettait d'inviter un ami dans sa bataille (2 armées côte à
  côte contre les PvE).
- **État** : structurellement mono-héros par camp (`CombatSide` à un héros ;
  la garnison fusionne déjà en siège).
- **Cadrage retenu** (arbitrage utilisateur, cf. doc 02 §6 + plan
  `phase-E4-coop-combat.md`) : coop **local offline-signifiant** — l'armée d'un
  **héros allié adjacent** rejoint un **combat PvE** ; point d'extension générique
  = **attribution de pile par héros propriétaire** (`CombatStack.ownerHeroId`,
  bump save au lot moteur). Le cadre « online temps réel » de l'audit est écarté.
- **Décomposition** : E4.1 cadrage (fait) → **E4.2 moteur gardien (fait)** :
  `CombatStack.ownerHeroId?` (save v35), invite d'un allié adjacent en combat de
  gardien, survivants routés par owner, XP partagée à égalité → **E4.5 client
  (fait)** : overlay d'invite (câble `MoveHero.allyHeroId`) + liseré propriétaire
  des piles ⇒ **coop gardien jouable** → **E4.2b moteur siège (fait)** :
  `beginTownCombat(..., allyHeroId?)` + `CaptureTown.allyHeroId?` (même mécanique
  factorisée que le gardien : `combineCoopArmy`/`tagCoopOwners`/`engageCoopAlly`),
  capture + survivants + XP partagés par owner ⇒ **coop PvE (gardien & siège)
  jouable** → **E4.3 butin partagé (fait)** : or/ressource d'un gardien répartis
  également entre les joueurs co-participants (reste au lead), artefact
  indivisible au lead (`rewardGuardianDefeat(…, coopHeroIds?)`, zéro tirage RNG
  ajouté) → **E4.4a moteur + IA (fait)** : suivi des actions de héros **par-héros**
  (`heroCastThisRound`/`heroAttackUsed` = ids de héros ; `heroesOnSide`,
  `heroActionLeftFor`), `castHeroSpell`/`strikeWithHero` par héros agissant,
  `CastSpell`/`HeroAttack.heroId?` (défaut lead) ; l'IA d'auto-combat fait jouer
  **chaque héros allié** d'un camp. Mono-héros bit-identique (golden inchangé) →
  **E4.4b client (fait)** : **sélecteur de héros** dans la barre d'action du
  combat manuel (chips visibles seulement en coop — plusieurs héros du joueur sur
  son camp) ; le héros choisi (`store.combatActingHeroId`) est threadé en `heroId`
  dans `CastSpell`/`HeroAttack` (SpellBook, ciblage `CombatScene`, `HeroAttackModal`),
  préviz par-héros (`heroAttackDamageFor`). **E4 clôturé.** **Priorité** P3.
- **4 questions ouvertes** (consentement, cap de plateau, partage XP…) à trancher
  avant E4.2 (cf. plan §« Questions ouvertes »).

**E5 — Guildes / clans & chat**
- **Réf.** : MMHO (guildes, social hub). **État** : rien (le modèle async s'y
  prête mal ; e-mail magic-link livré). **Priorité** : P3 Live — hors périmètre
  Beta ; le poser en décision explicite plutôt qu'en oubli.

**E6 — Finitions backend déjà tracées** *(rappel, pas de nouveau chantier)*
- E-mails magic-link réels (Resend — suivi doc 15 §10) ; brouillard PvP serveur
  (décision NET-FOG « info ouverte » à réévaluer avec le classement E2) ;
  PvP temps réel à timer (roadmap Live).

### 2.F Assets & présentation

**F1 — Couverture des planches** : unités/bâtiments/héros/fonds encore partiels
(staging LLM en cours, repli procédural systématique) — chantier continu doc 12.
**F2 — Variantes visuelles de gardiens** : cf. §3 (proposition dédiée).
**F3 — Projectiles & FX de sorts** : cf. B6.
**F4 — `assets/README.md`** ✅ *(corrigé)* : le README reflète désormais que
`render/assets.ts` (visuels) et `app/audio.ts` (sons) consomment `assets/`
(il affirmait auparavant « aucune intégration client »). *(P3 clôturé)*

### 2.G Non-écarts (pour clore les questions récurrentes)

| Sujet | Verdict |
|---|---|
| MMO temps réel, monde partagé, provinces persistantes | Exclu par design (doc 01 §3-4) |
| Monétisation (Hero Seals, résurrection payante, espionnage payant, potions premium) | Exclu par design |
| Créatures 1 hex | Fidèle à MMHO (cf. B5) |
| 4 ressources MMHO (or/bois/métal/cristal) | Le projet fait **plus** (7 + ressources de faction) |
| 2 factions MMHO | Le projet en a **7** |
| Quêtes quotidiennes, événements temporaires | **Livrés** (N4c, N4d) |
| Journal de quêtes, minimap, garnison, taverne | **Livrés** |
| Force des gardiens en fourchette (« quelques » → « légion ») | **Livré côté texte** (doc 02 §2.2) — reste le visuel (A1/§3) |

## 3. Proposition détaillée — gradation visuelle des gardiens (A1)

### 3.1 Principe

Mapper les **7 bandes existantes** (`display.strengthBands`) sur **3 crans
visuels** de composition du jeton, sans jamais révéler l'effectif exact
(le choix de design actuel est conservé) :

| Cran visuel | Bandes | Composition du jeton |
|---|---|---|
| **Solitaire** | `few`, `several` | 1 sprite d'unité (rendu actuel) |
| **Groupe** | `pack`, `lots` | 2–3 instances du **même** sprite, décalées en profondeur iso (offsets déterministes hashés sur la position), ombre portée commune |
| **Horde** | `horde`, `throng`, `legion` | 3–4 instances resserrées + **étendard/bannière** plantée derrière (marqueur univoque, jamais la couleur seule — règle accessibilité doc 08) |

Complément d'accessibilité : le **libellé de bande localisé** (déjà existant)
reste la source exacte au survol/appui long ; en option, un petit cartouche
sous le jeton au cran de police maximal.

### 3.2 Côté assets — coût minimal d'abord, art dédié ensuite

1. **Palier 0 (zéro asset nouveau)** : composition **à la volée** dans
   `render/mapObjects.ts → buildGuardian` — N instances du sprite d'unité déjà
   résolu par `unitSpriteUrl` (avec son repli silhouette procédurale existant),
   offsets/échelles déterministes. Fonctionne pour les 7 factions et toute
   faction future **sans aucun PNG supplémentaire** (le pipeline de faction
   reste inchangé, doc 06).
2. **Palier 1 (1 asset générique)** : `assets/map/guardian-banner.png` —
   étendard neutre du cran « Horde », généré par le pipeline procédural
   (`tools/assets/`, même famille que `gen_faction_badge.py`), repli dessin
   PixiJS. Auto-découvert par `render/assets.ts` (convention `import.meta.glob`),
   hors bundle JS (budget < 800 Ko gzip intact).
3. **Palier 2 (optionnel, art dirigé)** : variantes par bande
   `assets/map/guardian-band-<band>.png` (overlays crânes/trophées pour
   `throng`/`legion`), prompts ajoutés à doc 12 — uniquement si le palier 0+1
   ne suffit pas visuellement après playtest.

### 3.3 Garde-fous

Zéro diff moteur (le client possède déjà `count` et la bande) ; pas de bump
`CURRENT_SAVE_VERSION` ; golden inchangé ; déterminisme : offsets hashés sur
`(x, y, unitId)`, jamais `Math.random` ; perf : instances ajoutées à la couche
d'entités existante, culées avec leur chunk ; smoke étendu (un gardien « horde »
sur la carte de test affiche > 1 instance — hook de test à la `tileToScreen`).

## 4. Plan de comblement par étapes

Ordonné par rapport impact/coût et par dépendances. Chaque lot = un plan vivant
`.claude/plans/<feature>.md`, une PR atomique, vérifs standard (typecheck, lint,
tests, golden, garde-fou « zéro faction », budget, smoke). Taille : S < 1 j,
M ≈ 2-3 j, L = semaine(s).

> **État de comblement (mise à jour 2026-07)** : les Étapes 1–3 sont **livrées**
> (A1, B6, E1, F4, B1, A2/A2b, B2, A4, C1, C2, **E3** ✅) ; l'Étape 4 en ligne est
> livrée (B4, E2, E6 ✅). Les décisions de cadrage (Étape 5) sont tranchées :
> B3, A3, E4 **retenus et livrés** (E4 clôturé : E4.4a moteur+IA + E4.4b client).
> **Sweep terminé** : **D1** (vue de ville peinte) était **déjà livré** (lots UX
> U5/UXD-5/UX-TOWNVIEW — `TownView`) ; **A6** (ville neutre en `MapObjectDef`) est
> **clos comme choix de design assumé** (refactor de cœur à risque pour zéro
> impact joueur — guidelines §2/§3). **Plus aucun écart P1/P2 ouvert.** La famille
> de triggers **A5** est **close** (A5c retraits `removeArtifact`/`removeArmy` +
> A5d condition `flagCaptured`). Vérification 2026-07 : **C2** (rareté d'artefacts
> graduée en profondeur) était **déjà livré** (lot 3.2 — `artifactIdForDepth` +
> champ `rarity`), fiche re-marquée ✅.
>
> **Le backlog de code de l'audit est épuisé.** Tout ce qui reste est : chantiers
> **assets** (icônes/sprites/art dédié — doc 12, repli procédural en place),
> **contenu de flair** optionnel (mois thématiques A4), **décisions déjà tranchées
> à documenter** (B5 mono-hex, C3 arbre HoMM) et des items **Live/hors périmètre**
> (A3 naval, E2 matchmaking, E5 clans). Aucun n'est un écart de fonctionnalité
> jouable ouvert. Les fiches §2 portent le détail par item.

### Étape 1 — Lisibilité de la carte & du combat (client/assets, zéro moteur)

| Lot | Contenu | Écart | Taille | Vérification |
|---|---|---|---|---|
| 1.1 | ✅ Gradation visuelle des gardiens (3 crans, sprint 2) | A1 | M | smoke : jeton multi-instances + bannière ; budget intact |
| 1.2 | ✅ Projectiles de tir + FX d'impact de sort (sprint 1) | B6 | M | smoke arène : projectile visible ; reduce-motion le coupe |
| 1.3 | ✅ Vue de royaume (villes/héros/revenus agrégés, sprint 3) | E1 | M | smoke : ouvrir la vue, y naviguer vers une ville |
| 1.4 | ✅ Correctif `assets/README.md` | F4 | S | relecture |

### Étape 2 — Profondeur de règles à faible risque (moteur générique opt-in)

| Lot | Contenu | Écart | Taille | Vérification |
|---|---|---|---|---|
| 2.1 | ✅ Pénalité de portée de tir (`combat.rangePenalty`, sprint 1) | B1 | S | unitaires dégâts + préviz ; config absente ⇒ golden inchangé |
| 2.2 | ✅ Croissance hebdo des gardiens (`adventure.guardianGrowth`) | A2 | S | unitaires `WeekStarted` ; opt-in ⇒ golden inchangé |
| 2.3 | ✅ Tente de soins + chariot de munitions (2 effets `warMachine`) | B2 | M | unitaires combat ; données + 2 sprites (repli procédural) |
| 2.4 | ✅ Triggers enrichis (ambush, grants, téléport, message à choix) | A5 | M | unitaires + 1 usage campagne |
| 2.5 | ✅ Événements de calendrier au mois (`calendar.monthEvents`) | A4 | S | unitaires calendrier |

### Étape 3 — Différenciation & contenu (équilibrage requis)

| Lot | Contenu | Écart | Taille | Vérification |
|---|---|---|---|---|
| 3.1 | ✅ Perks de classe Might/Magic (`armySlotsBonus`, `heroActionsPerRound`) | C1 | M | unitaires + `faction:sim` (pas de blowout) + UI 8ᵉ slot |
| 3.2 | ✅ Panoplies d'artefacts (3 sets livrés) | C2 | S | données + contenu ; icônes pipeline |
| 3.3 | ✅ Guilde des voleurs (comparatif en partie, précision graduée) | E3 | M | smoke : panneau ouvert, données cohérentes |
| 3.4 | ✅ Respawn de gardiens (`queueGuardianRespawn`, survival/dailies) | A2b | S | unitaires ; opt-in |

### Étape 4 — En ligne (dépend du backend déployé)

| Lot | Contenu | Écart | Taille | Vérification |
|---|---|---|---|---|
| 4.1 | ✅ Mort subite PvP (`combat.suddenDeath`, activée en ligne) | B4 | S | unitaires ; replay stable |
| 4.2 | ✅ Classement Elo + saisons (D1 `ratings` + endpoint + écran) | E2 | L | Elo pur unitaire ; screen non smoke-couvert (backend-gated) |
| 4.3 | ✅ E-mails magic-link réels (Resend, opt-in `RESEND_API_KEY`) | E6 | S | runbook doc 15 §10 pt 6 |

### Étape 5 — Décisions de cadrage (aucun code avant arbitrage utilisateur)

| Sujet | Écart | Options / décision |
|---|---|---|
| Renforts en cours de combat | B3 | ✅ **retenu** — fidélité MMHO opt-in PvE (moteur + client livrés) |
| Eau navigable & bateaux | A3 | ✅ **retenu** — chantier multi-lots livré (déplacement naval, `boat`/`shipyard`, mapgen, client) |
| Combats coopératifs | E4 | ✅ **retenu (local) — clôturé** : cadrage + gardien/siège/butin/client + E4.4a (par-héros moteur+IA) + E4.4b (sélecteur de héros du combat manuel) |
| Guildes/clans & chat | E5 | phase Live uniquement |
| Arbre d'aptitudes MMHO vs compétences HoMM | C3 | recommandation : divergence assumée (acter en doc 02 §1.3) |
| Créatures 2-hex | B5 | recommandation : non (fidèle MMHO) — acter en doc 02 §5.1 |

### Règles transverses (rappel)

- Invariants guidelines §8 à chaque lot : zéro faction dans le moteur, RNG seedé,
  moteur sans rendu, touch-first, docs mises à jour dans le même commit.
- Toute extension moteur = **une** variante d'union générique opt-in (champ/config
  optionnels ⇒ pas de bump `CURRENT_SAVE_VERSION` ni de golden re-fixé quand la
  config est absente).
- Les lots d'assets suivent doc 12 (staging `assets/`, auto-découverte, repli
  procédural, hors budget bundle JS).

## 5. Références

- Wikipedia — *Might and Magic: Heroes Online* (dates, MMO, hex, ressources H6).
- Might and Magic Wiki (Fandom) — fiche MMHO (respawn des gardes, planques).
- mmos.com — review MMHO (renforts en combat, sudden death, 6 slots ×150,
  Core/Elite/Champion, mairie/habitations/garnison/halls, quêtes histoire +
  quotidiennes, arène/ligues/matchmaking, Hero Seals).
- Celestial Heavens — preview MMHO (créatures 1 hex, ~20 points d'aptitude,
  6 arbres par faction).
- Kongregate / MMORPG.com — fiches produit (coop, guildes).
