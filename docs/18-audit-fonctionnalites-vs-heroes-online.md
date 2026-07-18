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
- **Manque** : **visuellement**, un gardien de 2 unités et une légion de 300 sont
  le même sprite unique (`render/mapObjects.ts → buildGuardian`). La lecture du
  danger au premier coup d'œil (sans survol) est perdue.
- **Nature** : client + assets — **zéro diff moteur** (le `count` exact est déjà
  dans l'état client, la bande est déjà calculée). Proposition détaillée au §3.
- **Priorité** : **P1** (lisibilité de la carte, item explicitement demandé).

**A2 — Croissance des gardiens dans le temps**
- **Réf.** : HoMM : les piles neutres croissent (~+10 %/semaine) ; MMHO :
  les gardes **réapparaissent** après un délai pour re-farmer les planques.
- **État** : `GuardianObjectDef.count` est figé à la pose ; seuls les gardiens
  errants (`roamRadius`) bougent. Aucune croissance, aucun respawn.
- **Manque** : (a) croissance hebdomadaire optionnelle ; (b) respawn optionnel
  façon MMHO (utile aux scénarios `survival` et aux quotidiennes).
- **Nature** : moteur **générique** — bloc de config optionnel
  `adventure.guardianGrowth` (facteur/semaine, plafond) appliqué au
  `WeekStarted`, et champ optionnel `respawnDays` sur le gardien. Config absente
  ⇒ comportement inchangé (fixtures/golden épargnés, pas de bump save : `count`
  existe déjà dans l'état).
- **Priorité** : **P1** pour la croissance (pression temporelle classique du
  core loop), P2 pour le respawn.

**A3 — Eau navigable & bateaux**
- **Réf.** : HoMM (chantier naval, embarquement, tourbillons) ; MMHO n'en avait
  pas (zones terrestres).
- **État** : l'eau est un terrain `moveCost: null` (infranchissable) ; le mapgen
  garantit la connexité terrestre par corridors.
- **Manque** : tout le sous-système naval. **Non-écart vs MMHO** ; écart vs HoMM.
- **Nature** : moteur (déplacement + objets `boat`/`shipyard`) + mapgen + client
  + assets — chantier **lourd**.
- **Priorité** : P3 — décision de cadrage requise avant tout travail.

**A4 — Effets de calendrier au mois**
- **État** : semaines à événements seedés livrées (M-CALENDAR : croissance,
  palier ciblé, ruée, savoir) ; le **mois** est calculé mais purement informatif.
- **Manque** : « mois des créatures » / « mois de la peste » persistants, semaine
  ciblant un `unitId` précis (différés notés doc 02 §2.3).
- **Nature** : moteur générique (extension de `CalendarEventDef`) + données.
- **Priorité** : P2.

**A5 — Triggers de carte limités**
- **État** : `MapTriggerDef` one-shot `visit`/`day`, 2 effets (`grantResource`,
  `message`).
- **Manque** : combat scripté sur tuile (embuscade), message à choix,
  don/retrait d'artefact ou d'armée, téléport scripté — la richesse
  « événement de carte » HoMM utile aux campagnes.
- **Nature** : moteur générique (variantes d'union `TriggerEffect`) + données.
- **Priorité** : P2 (les campagnes N3/N4 en profiteraient directement).

**A6 — Villes neutres hors `MapObjectDef`**
- **État** : le mapgen émet des villes neutres, mais elles sont instanciées au
  niveau contenu/client, pas comme objet de carte moteur.
- **Manque** : dette de forme (asymétrie avec les autres objets), sans impact
  joueur visible.
- **Nature** : moteur (refactor de forme). **Priorité** : P3.

### 2.B Combat

**B1 — Pénalité de portée de tir**
- **Réf.** : HoMM3 : ½ dégâts au-delà de 10 hexes ; MMHO avait des tireurs à
  portée bornée.
- **État** : portée de tir **illimitée sans falloff** (`combat/damage.ts` — seule
  la pénalité de mêlée ½ existe ; les murs de siège bloquent la LoS, doc 02
  §5.2/§5.4).
- **Manque** : pénalité de distance (½ dégâts au-delà d'un seuil de hexes,
  configurable `combat.rangePenalty`).
- **Nature** : moteur générique (data config, absente ⇒ inchangé) + prévisualisation
  client déjà branchée sur `estimateDamage`. **Priorité** : **P1** (équilibrage :
  les tireurs sont aujourd'hui structurellement surpuissants).

**B2 — Machines de guerre : tente de premiers soins & chariot de munitions**
- **Réf.** : suite HoMM ; MMHO avait des consommables de soin.
- **État** : 3 machines (`data/core/war-machines.json` : baliste, catapulte, tour
  de tir) ; les tireurs ont déjà des munitions finies (`ammo`).
- **Manque** : tente (soin périodique de la pile la plus blessée) et chariot
  (recharge `ammo`) — 2 nouvelles entrées de catalogue + 2 comportements
  génériques de machine (`warMachine` à effet déclaratif `healPerRound` /
  `replenishAmmo`).
- **Nature** : moteur générique (2 variantes d'effet) + données + assets (2
  sprites, repli procédural). **Priorité** : P2.

**B3 — Renforts en cours de combat (signature MMHO)**
- **Réf.** : MMHO permettait de **recruter des renforts pendant la bataille**
  (PvE uniquement), contre or — l'une de ses mécaniques distinctives.
- **État** : absent ; le sort `summon` (invocation) couvre un cas voisin côté
  magie ; la garnison + héros fusionnent déjà en défense de siège.
- **Manque** : action de combat « appeler des renforts » (gatée : PvE, ville liée
  ou stock d'habitation, coût, limite/round).
- **Nature** : moteur générique (commande + config opt-in) + client (UI d'appel).
- **Priorité** : P3 — mécanique clivante (casse la lecture « armée engagée =
  armée risquée ») ; à trancher : fidélité MMHO vs pureté HoMM. Décision de
  design **avant** implémentation (mettre à jour doc 02 si retenue).

**B4 — Mort subite / borne de fin en PvP (MMHO « Sudden Death »)**
- **Réf.** : MMHO : au-delà d'un délai, l'équipe avec le plus d'unités gagne.
- **État** : `runAutoCombat` sait borner les rounds ; aucun mécanisme de
  résolution forcée d'un combat interactif interminable (pertinent en PvP async
  où un match ne doit pas s'éterniser).
- **Manque** : règle déclarative `combat.suddenDeath { round, resolution }`
  (résolution : camp au plus fort `armyStrength` restant).
- **Nature** : moteur générique (config opt-in, activée par le mode en ligne).
- **Priorité** : P2 (préalable utile au classement PvP, cf. F2).

**B5 — Créatures 2-hex**
- **Réf.** : HoMM classique (dragons, cavalerie). **MMHO : toutes les créatures
  occupaient 1 hex** (préview Celestial Heavens) — le projet est donc **fidèle
  à MMHO**.
- **État** : structurellement mono-hex (`OffsetPos` unique).
- **Verdict** : **non-écart** vs la référence MMHO. À documenter comme choix (doc
  02 §5.1) ; ne rouvrir que si une future faction l'exige (chantier moteur lourd :
  position, pathing hex, souffle, sièges).
- **Priorité** : P3 (documentation immédiate, mécanique non planifiée).

**B6 — « Juice » de combat : projectiles & effets de sorts**
- **Réf.** : MMHO (Flash) animait tirs et sorts — lisibilité et plaisir de jeu.
- **État** : animations tween livrées (ruée, flash, secousse, fondu de mort,
  chiffres flottants, vitesse réglable, reduce-motion), mais **aucun projectile**
  (une flèche ne traverse pas le plateau) ni **effet visuel de sort** (pas
  d'impact/AoE dédié) ; sprites statiques (pas d'idle/walk).
- **Manque** : sprite de projectile interpolé tireur→cible (flèche/carreau/
  boulet), flash/onde d'impact de sort par `SpellKind`, éventuel idle 2 frames.
- **Nature** : client + assets (pipeline `tools/assets/` ; repli procédural :
  trait lumineux). Zéro moteur. **Priorité** : **P1** (rapport lisibilité/coût
  excellent ; le SFX `combat-shoot` existe déjà, il « tire dans le vide »).

### 2.C Héros

**C1 — Effets structurels de classe Might / Magic (signature MMHO)**
- **Réf.** : MMHO — classe **Might** : slot d'armée **supplémentaire** ; classe
  **Magic** : **2 actions de héros par round** en combat.
- **État** : l'archétype `might/magic` existe mais ne pondère que les gains
  d'attributs à la montée de niveau (`hero/level-up.ts`) ; 7 slots d'armée pour
  tous ; 1 action de héros/round pour tous (plan `hero-action-per-round`).
- **Manque** : perks structurels différenciant réellement les deux archétypes.
- **Nature** : moteur générique — 2 nouveaux effets déclaratifs dans le pot
  commun `SkillRankEffect`/spécialités (`armySlotsBonus`, `heroActionsPerRound`),
  portés par l'archétype via données ; **aucun `if (archetype)` en dur**.
  Attention équilibrage (`faction:sim`) et UI (8ᵉ slot mobile).
- **Priorité** : P2 — différenciation de build fidèle à MMHO.

**C2 — Panoplies d'artefacts supplémentaires**
- **État** : le système de sets est livré (`ArtifactDef.set`), mais **une seule
  panoplie** existe (`panoplie-gladiateur`, 2 pièces) sur 11 artefacts.
- **Manque** : contenu — 2-3 panoplies (dont une par « style » : might, magic,
  économie), artefacts de rareté graduée en profondeur de carte.
- **Nature** : **données pures** + assets (icônes). **Priorité** : P2.

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

**D1 — Vue de ville peinte**
- **État** : écran de ville en liste + onglets, ancres de layout par faction
  (`assets/layouts/`), fonds `town-<faction>` partiels.
- **Manque** : la vue peinte cliquable (« Beta » depuis doc 11) — item déjà
  tracé en roadmap, rappelé ici pour complétude. **Nature** : client + assets.
- **Priorité** : P2 (identité visuelle forte de la série).

**D2 — Commerce avancé**
- **État** : marché ressource↔or à taux dégressifs livré.
- **Manque** : échange ressource↔ressource direct, marchand d'artefacts
  (achat/vente), commerce inter-joueurs (MMHO n'en avait pas non plus —
  non-écart sur ce dernier point).
- **Nature** : moteur générique léger (le `TradeResources` se généralise) +
  données. **Priorité** : P3.

### 2.E Multijoueur & social (l'identité MMHO)

**E1 — Vue de royaume (kingdom overview)**
- **Réf.** : indispensable dès 2+ villes (MMHO avait la gestion mono-cité ; HoMM
  a l'écran de royaume).
- **État** : **absent** — gestion ville par ville via la modale `TownScreen` ;
  aucune vue agrégée (villes, garnisons, revenus/jour, héros, chantiers du jour).
- **Nature** : client pur (l'état expose déjà tout : `dailyIncome`,
  `TownState`, `HeroState`). **Priorité** : **P1** (confort majeur, coût faible).

**E2 — Classement / ligues saisonnières PvP (MMHO : arène + ligues)**
- **État** : PvP async fonctionnel (matches, re-simulation serveur, forfait,
  expiration) ; **aucun classement, aucune saison, aucun matchmaking** ;
  la roadmap Beta mentionne un « classement saisonnier expérimental ».
- **Manque** : table `ratings` (Elo simple) + endpoint classement + écran ;
  saisons = fenêtres de dates (réutiliser le pattern `availability` de N4d).
- **Nature** : backend (D1) + client. **Priorité** : P2 (post-stabilisation PvP).

**E3 — Guilde des voleurs / comparatif inter-joueurs**
- **Réf.** : HoMM (thieves guild) ; MMHO vendait l'espionnage (exclu, premium).
- **État** : seuls comparatifs : pré-combat (`armyStrength`) et fin de partie.
- **Manque** : panneau de classement **en partie** (nb de villes, force totale,
  revenus — précision graduée façon thieves guild, éventuellement gatée par le
  bâtiment taverne déjà existant).
- **Nature** : client (+ éventuel helper pur moteur de projection). **Priorité** : P2.

**E4 — Combats coopératifs (signature MMHO)**
- **Réf.** : MMHO permettait d'inviter un ami dans sa bataille (2 armées côte à
  côte contre les PvE).
- **État** : structurellement mono-héros par camp (`CombatSide` à un héros ;
  la garnison fusionne déjà en siège).
- **Manque** : multi-armées par camp. Chantier moteur **lourd** (setup, tours,
  moral par armée, XP partagée) qui n'a de sens qu'avec le PvP/coop en ligne
  temps quasi réel.
- **Priorité** : P3 — reporter à la phase Live ; décision de cadrage préalable.

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
**F4 — `assets/README.md` obsolète** : il affirme « aucune intégration client »
alors que `render/assets.ts` et `app/audio.ts` consomment `assets/` — correctif
documentaire une ligne, à glisser dans le premier lot assets venu. *(P3)*

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

### Étape 1 — Lisibilité de la carte & du combat (client/assets, zéro moteur)

| Lot | Contenu | Écart | Taille | Vérification |
|---|---|---|---|---|
| 1.1 | Gradation visuelle des gardiens (paliers 0+1 du §3) | A1 | M | smoke : jeton multi-instances + bannière ; budget intact |
| 1.2 | Projectiles de tir + FX d'impact de sort | B6 | M | smoke arène : projectile visible ; reduce-motion le coupe |
| 1.3 | Vue de royaume (villes/héros/revenus agrégés) | E1 | M | smoke : ouvrir la vue, y naviguer vers une ville |
| 1.4 | Correctif `assets/README.md` | F4 | S | relecture |

### Étape 2 — Profondeur de règles à faible risque (moteur générique opt-in)

| Lot | Contenu | Écart | Taille | Vérification |
|---|---|---|---|---|
| 2.1 | Pénalité de portée de tir (`combat.rangePenalty`, config data) | B1 | S | unitaires dégâts + préviz ; config absente ⇒ golden inchangé |
| 2.2 | Croissance hebdo des gardiens (`adventure.guardianGrowth`) | A2 | S | unitaires `WeekStarted` ; opt-in ⇒ golden inchangé |
| 2.3 | Tente de soins + chariot de munitions (2 effets `warMachine`) | B2 | M | unitaires combat ; données + 2 sprites (repli procédural) |
| 2.4 | Triggers enrichis (combat scripté, message à choix, don d'objet) | A5 | M | unitaires + 1 usage campagne |
| 2.5 | Événements de calendrier au mois + ciblage `unitId` | A4 | S | unitaires calendrier |

### Étape 3 — Différenciation & contenu (équilibrage requis)

| Lot | Contenu | Écart | Taille | Vérification |
|---|---|---|---|---|
| 3.1 | Perks de classe Might/Magic (`armySlotsBonus`, `heroActionsPerRound`) | C1 | M | unitaires + `faction:sim` (pas de blowout) + UI 8ᵉ slot |
| 3.2 | 2-3 panoplies d'artefacts + rareté graduée en profondeur | C2 | S | données + contenu ; icônes pipeline |
| 3.3 | Guilde des voleurs (comparatif en partie, précision graduée) | E3 | M | smoke : panneau ouvert, données cohérentes |
| 3.4 | Respawn de gardiens (`respawnDays`, scénarios survival/dailies) | A2b | S | unitaires ; opt-in |

### Étape 4 — En ligne (dépend du backend déployé)

| Lot | Contenu | Écart | Taille | Vérification |
|---|---|---|---|---|
| 4.1 | ✅ Mort subite PvP (`combat.suddenDeath`, activée en ligne) | B4 | S | unitaires ; replay stable |
| 4.2 | Classement Elo + saisons (D1 + écran) | E2 | L | tests worker + smoke panneau En ligne |
| 4.3 | ✅ E-mails magic-link réels (Resend, opt-in `RESEND_API_KEY`) | E6 | S | runbook doc 15 §10 pt 6 |

### Étape 5 — Décisions de cadrage (aucun code avant arbitrage utilisateur)

| Sujet | Écart | Options |
|---|---|---|
| Renforts en cours de combat | B3 | (a) fidélité MMHO opt-in PvE ; (b) écarter (pureté HoMM) — mettre à jour doc 02 dans les deux cas |
| Eau navigable & bateaux | A3 | (a) chantier L multi-lots ; (b) divergence assumée documentée |
| Combats coopératifs | E4 | phase Live uniquement ; cadrage dédié si retenu |
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
