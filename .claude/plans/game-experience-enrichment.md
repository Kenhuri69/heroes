# Enrichissement & approfondissement de l'expérience de jeu

> **Demande utilisateur (2026-09-29)** : « ouvre un plan d'enrichissement et
> d'approfondissement de l'expérience du jeu », dessiné par un **agent game
> designer** travaillant avec un **agent spécialisé RPG tactique à la HoMM**.
>
> Plan **vivant** (guidelines §5) et **registre unique des reliquats** (§1) depuis
> la clôture `close-open-plans-2026-09.md`. Ce document **propose** ; rien n'est
> implémenté tant qu'un lot n'est pas validé par l'utilisateur. Chaque lot validé
> ouvre son propre plan `.claude/plans/<lot>.md` + une PR atomique.

## 0. Méthode — le binôme de design

Deux agents définis dans `.claude/agents/` :

| Agent | Rôle | Écrit ? |
|---|---|---|
| `game-designer` | dessine les bases d'amélioration : intention joueur → constat prouvé → mécanique chiffrée → pilier → point d'extension → coût → critère vérifiable | oui, dans ce plan (jamais le code) |
| `tactical-rpg-expert` | relit chaque proposition : filiation (canon/adaptation/innovation, opus HoMM cité), solidité tactique (vrais choix, contre-jeu, abus, IA), lisibilité, rythme, verdict Retenir/Amender/Écarter | non (verdict seul) |

Boucle (orchestrée par la session principale — un sous-agent n'en lance pas un
autre) : **designer propose → expert relit → designer amende → l'utilisateur
tranche** les décisions marquées 🗳️ → lot ouvert. Les divergences HoMM déjà
tranchées (doc 01 §3-4, doc 18 §4 étape 5) ne se rouvrent pas.

Invariants rappelés pour chaque lot : zéro faction dans `packages/` · RNG seedé ·
un point d'extension générique opt-in par lot · pas de bump
`CURRENT_SAVE_VERSION` ni de golden re-fixé sans nécessité justifiée · doc
`docs/0X-*.md` amendé dans le même commit · vérifs §4/§7 (typecheck, lint,
tests, `content:check`, garde-fous, build + budget, smoke `@core`).

## 1. Registre des reliquats (repris des plans clôturés)

Vérifiés dans le dépôt le 2026-09-29. Source = plan archivé dans `archive/`.

### 1.1 Décisions de design (instruites par le binôme §3, ✅ tranchées §5)

| ID | Reliquat | Source |
|---|---|---|
| M10 | Défendre inutile à Défense 1–3 (`floor(def×1,3)`) | `game-review-2026-09b` |
| M11 | Mana remplie à chaque combat (Puits de magie, réserve IA sans objet ; doc 02 se contredit) | idem + `code-review-2026-09` hors périmètre |
| M12 | Deux montées de niveau d'affilée écrasent le choix de compétence (file de choix ⇒ bump save) | `game-review-2026-09b` |
| M13 | Soin (cercle 1) ressuscite ⇒ Résurrection redondante | idem |
| M14 | Quête `visitTile` validée à la vue ; `defeatGuardian` par n'importe qui | idem |
| M19 | Récompense de quête au 1ᵉʳ héros, unités perdues si armée pleine | idem |
| D-POISON | Poison persistant vs bouclier | `code-review-2026-08` lot 5, `code-review-2026-09` |
| D-REINF | `CallReinforcements` hors budget « 1 action de héros par round » | `code-review-2026-09` |
| D-SIEGEAI | L'IA n'assiège pas les villes à garnison | idem |
| D-SIEGEHERO | Siège avec héros visiteur défenseur (garnison + armée du héros) | idem + `game-feature-gaps` F-BUILDEFF |

### 1.2 Contenu & données (moteur prêt, câblage à équilibrer)

- **CAP** : Maître de Sortilèges / Avatar Vox (câblage à équilibrer, factions fortes au sim).
- **combatBonus** des autres factions ; **F-SKILLS** : Chasse rituelle, Sylve.
- **École de la Scène** : effets peur / +moral (partagés avec le moral).
- **F-BUILDEFF.7+** : Cercles Traque (+vitesse recrue — bloqué : stats par instance),
  Sceau (−mana d'école — bloqué : portée mana combat↔ville), +XP/+rang, bonus
  additionnels du Sanctuaire du Honmoon.
- **H-NAMED** : signatures restantes (Nécromancie par niveau, Symbiose de départ,
  familier gratuit).
- **M-VISIT** : gating par Savoir des sanctuaires ; **mois** persistants et ciblage
  par `unitId` exact ; **Graal** : effets spécifiques par faction (données).
- **Marché** : courbe HoMM3 exacte, troc pénalisé ; **caravanes** : interception,
  annulation en route.
- **Slot d'artefact *trophée*** (+1 slot ⇒ bump save, avec un lot H-ARTEQUIP) — `l8-content-finitions`.

### 1.3 Ergonomie (client) — `game-review-2026-09b` §3.2

Pan clavier / zoom +/− / Entrée confirme / `Ctrl+S` · fiche d'info à l'appui long
là où ne reste qu'un `title=` · stats **effectives** dans la fiche de pile · fin de
tour renseignée (héros avec PM, villes sans construction) · aperçu « Tout
recruter » + annuler le dernier transfert · nombres localisés (`Intl.NumberFormat`,
absent du client) · piège de focus des modales (absent) · toasts sous l'en-tête
des modales · tiroir « ⋯ » de la carte mobile · cadrage des deux camps à
l'ouverture du combat mobile.

### 1.4 Infra, outillage, hygiène

- **Snapshot par match** (migration D1 en prod, à faire avec l'opérateur) — `post-review-followups`.
- **Icône PWA *maskable*** (absente de `data/manifest.webmanifest`) — idem.
- **`map:gen` CLI** n'envoie pas les mêmes options que le client (carte différente à graine égale) — idem.
- **Suppression des 209 branches fusionnées** : commande prête dans
  `archive/merged-branches-cleanup.md` §5, refusée à la session ⇒ à lancer par l'utilisateur.
- **Dépendances majeures** à mettre à jour (lot dédié) — `code-review-2026-09`.
- **Souterrain > 2 niveaux** (transversal + bump save) — `l10-underground`.
- **NET-FOG** : information ouverte entre participants, statu quo assumé — à
  rouvrir seulement pour une beta compétitive — `l11-online-competitive`.
- **AS-OVERLAYS** (habillage chargement/cutscenes, optionnel) — `game-feature-gaps`.

### 1.5 Écartés par arbitrage (conservés pour mémoire)

Filtre par catégorie du journal de combat · « Équilibrer » la garnison
(`reliquats-differes` §4). Ne se rouvrent que sur demande.

## 2. Bases d'amélioration — proposition du game designer

> Rendu par l'agent `game-designer` le 2026-09-29 (lecture du code, preuves
> `fichier:ligne` relevées sur `main` à `b8494ba`). Format en 8 points (cf.
> `.claude/agents/game-designer.md`) condensé ; le point 8 (verdict) est en §3.

### 2.1 Diagnostic : une partie type aujourd'hui

- **Ouverture (j1-7)** — fonctionne. 2000 or / 10 bois / 10 minerai ; seul vrai
  choix de ville « revenu ou habitation » (arbre T1→T7 linéaire, une habitation
  bâtie en semaine ne produit rien avant lundi : `town/build.ts` ne pose aucun
  stock). 2-3 gardiens faibles garantis autour du départ (`content/src/mapgen.ts:662-684`).
  Dilemmes réels : coffre or/XP (`adventure/treasure.ts:12`) et choix de compétence.
- **Mi-partie (sem. 2-4) — l'intérêt retombe.**
  - *La carte ne résiste pas* : gardiens placés au hasard (`mapgen.ts:687-700`),
    interception seulement **sur** la tuile (`adventure/movement.ts:53`) ⇒ on contourne.
  - *L'IA ne presse pas* : elle ne vise une ville qu'adjacente et sans garnison
    (`ai/adventure.ts:445-461`), la marche multi-jours n'est qu'un dernier repli
    après exploration complète (`:726-739`) ; marge d'engagement ×1,5 (`:79,85`),
    lieux de bonus ignorés (`:108-110`), une seule pile recrutée par ville et par
    jour (`ai/town-ai.ts:89`), villes jouées **après** les héros (`ai/adventure.ts:58-73`).
  - *La mana n'est pas une ressource* : remplie à l'aube (`core/engine.ts:1093`)
    **et** à l'ouverture du combat (`combat/setup.ts:208-216`) — M11.
  - *Artefacts plats* : 16 au catalogue, 14 sont +1/+2 à une stat (`data/core/artifacts.json`).
  - *Combat* : Défendre nul à Déf 1-3 (`combat/damage.ts:307`, M10) ; Soin c1
    ressuscite (`combat/spell-effect.ts:293-297`, M13).
- **Fin de partie — nettoyage sans tension.** L'IA ne fuit jamais (`combat/ai.ts`),
  perd héros + artefacts ; pas de retour possible pour le perdant (hors 7 jours de
  grâce, `scenario/outcome.ts:73`) ; deux niveaux d'affilée écrasent le choix de
  compétence (`adventure/experience.ts:129`, M12).

**Diagnostic** : creux de mi-partie (ni obstacle, ni rival, ni réserve à gérer),
puis fin de partie en ratissage.

### 2.2 Propositions par axe

Coût : effort · moteur · bump save · golden. « opt-in » = bloc de config / champ
optionnel absent ⇒ comportement actuel.

**Axe A — La carte qui résiste (exploration)**

| ID | Proposition | Mécanique | Point d'extension | Coût | Critère |
|---|---|---|---|---|---|
| A1 | Zone de contrôle des gardiens | `adventure.guardianZoneOfControl` : entrer sur l'une des 8 voisines d'un gardien arrête le héros et ouvre le combat (HoMM3) ; A\* humain/IA : tuile de zone = coût ∞ si le gardien n'est pas la cible ; préviz marque la tuile d'arrêt | 1 flag lu par `advanceHeroAlongPath` | M · oui · non · non (opt-in) | test « passer à côté ⇒ combat » ; property « IA vs IA se termine » ; smoke préviz |
| A2 | Gardiens aux goulots | `generateMap` : tuiles d'articulation du graphe franchissable (BFS déterministe) ⇒ 60 % des gardiens de champ y sont posés, gradués par profondeur | aucun (générateur) | M · non · non · non — carte différente à graine égale (option ?) | test contenu : ≥ 50 % sur articulation, 20 graines |
| A3 | Banques de créatures | sentinelle forte (T3-5 ×1,5-2) + groupe de butins `guardedBy` (or, artefact, ressource rare), paliers petite/moyenne/grande par profondeur, force lisible (`strengthBands`) | réutilise M-GUARDLINK + `guardian-reward` | S-M · non · non · non | test contenu banque ⇒ sentinelle + butin verrouillé |
| A4 | Neutres qui fuient / rejoignent | force ≥ 3× ⇒ la pile **fuit** (sans XP, butin conservé) ; Diplomatie (effet `neutralJoin`, 25/50/75 % du coût) + force ≥ 1,5× ⇒ offre « rejoindre contre or » (choix en attente, patron `pendingTreasure`) ; zone grise tirée au RNG seedé ; IA déterministe | 1 effet de compétence + `pendingNeutralOffer` optionnel | M · oui · non · non | tests fuite/rejoindre/refus ; smoke du choix |
| A5 | Quêtes validées par un héros (M14) | `visitTile` exige un héros du joueur sur la tuile (`by: 'sight'` garde l'ancien sens) ; `defeatGuardian` exige un vainqueur du joueur (`defeatedBy` optionnel) | champs optionnels | S · oui · non · non | 2 tests négatifs + relecture `data/scenarios` |

**Axe B — Un adversaire IA qui joue pour gagner**

| ID | Proposition | Mécanique | Coût | Critère |
|---|---|---|---|---|
| B1 | Objectifs multi-jours généralisés | repli « meilleur objectif à ≤ 3 jours » **avant** l'exploration : score = valeur / (jours + 1) (ville prenable 10, mine ennemie 4, banque dominée 3, Graal 8), chemin tronqué aux PM, recalculé chaque jour (patron M6) | M · IA · non · non | baseline headless (carte Moyenne, 2 IA, 10 graines) : jour médian de 1ʳᵉ attaque de ville, cible ≤ j21 |
| B2 | Économie IA fidèle | recruter en boucle jusqu'à épuisement or/stock (réserve pour le prochain bâtiment prioritaire) ; villes jouées **avant** les héros qui y stationnent | S · IA · non · non | `armyStrength` IA au j28 vs baseline |
| B3 | L'IA visite et fuit | `visitable` utile collectable ; héros IA à < 0,25× de force ⇒ fuite plutôt que perte des artefacts | S (après E1) · IA | test « IA dominée ⇒ fuite » |

**Axe C — La progression du héros compte**

| ID | Proposition | Mécanique | Coût | Critère |
|---|---|---|---|---|
| C1 | File de choix de compétence (M12) | `pendingSkillChoices: string[][]` (une paire par niveau), `ChooseSkill` consomme la tête ; le client enchaîne les modales ; migration de l'ancienne forme | S-M · oui · **bump** · a priori non | test « +2 niveaux ⇒ 2 choix » + migration ; doc 02 §1.2 |
| C2 | Mana comme ressource (M11) | bloc `mana` opt-in : plus de remplissage à l'ouverture du combat, régénération `max(2, 10 % × manaMax)`/jour, plein en fin de tour dans une ville à Guilde ou au Puits, effet `manaRegen` (patron `heroAura`) | S · oui · non · non (opt-in) — **équilibrage majeur** | tests ; `faction:sim` avant/après ; doc 02 §1.4 réconcilié |
| C3 | Artefacts qui font rêver | catalogue ~40, rareté 4 « relique », effets moteur existants réutilisés en données ; **sets** (`setId` + bonus à N pièces) ; rareté tirée par profondeur (`guardian-reward`, banques) | M · 1 point (sets) · non · non | `content:check` ; test d'agrégation de set |
| C4 | Récompense de quête sans perte (M19) | destinataire = héros qui a validé (A5), sinon le 1ᵉʳ ; armée pleine ⇒ garnison la plus proche, sinon capitale | S · oui · non · non | test armée pleine |

**Axe D — La profondeur tactique du combat**

| ID | Proposition | Mécanique | Coût | Critère |
|---|---|---|---|---|
| D1 | Défendre utile (M10) | bonus = `max(1, floor(def × 0,3))` (plancher +1), préviz comprise | S · oui · non · **probable** | test « Déf 2 ⇒ 3 » ; `faction:sim` sans nouvelle béance ; doc 02 §5.2 |
| D2 | Soin ≠ Résurrection (M13) | `revive?: boolean` au schéma de sort (défaut `false` ⇒ plafonné aux PV de la 1ʳᵉ créature) ; `true` sur Résurrection / de masse | S · oui · non · à vérifier | test « Soin ne ressuscite pas » ; relecture Prière / sustains du gauntlet |
| D3 | Siège avec héros visiteur | défenseur = garnison + armée du héros présent (fusion ≤ 7 piles, surplus en garnison), murs compris, conséquences H-VS-H | L · oui · ? · non | tests fusion/conséquences ; smoke siège |

**Axe E — Rythme de ville et fin de partie**

| ID | Proposition | Mécanique | Coût | Critère |
|---|---|---|---|---|
| E1 | Fuite HoMM | le héros en fuite quitte la carte (niveau, artefacts, sorts, compétences gardés) et revient au pool de Taverne de **son** joueur, prioritaire (`rosterId`), avec ≤ 1 pile de survivants (réglage) | M · 1 point (« héros en réserve ») · **bump probable** · non | test fuite ⇒ recrutable ⇒ recruté avec artefacts ; smoke Taverne |
| E2 | Semaine offerte à la construction | `town.dwellingInitialStock` : l'habitation bâtie reçoit sa croissance de base (`weeklyGrowthOf`), HoMM3 | S · oui · non · non (opt-in) | test unitaire |
| E3 | Dilemmes de construction exclusifs | généraliser `exclusiveGroup` en données : un choix par faction au niveau 2 d'une habitation (ex. T4 rapide ou blindé) | M données · non | `content:check` ; `faction:sim` par variante |

### 2.3 Classement valeur / effort (designer)

★★★ : B1, B2, A1, A2 · ★★ : D1, D2, C1, A5+C4, A3, C2, C3, E1, A4, D3 · ★ : E2, B3, E3.
Dépendances : B3 ⇐ E1 · A1 ⇐ A2 (une ZdC sur des gardiens au hasard frustre) ·
C2 avant toute relecture d'équilibrage des mages · C1 et E1 peuvent partager un
seul bump de sauvegarde.

## 3. Relecture de l'expert RPG tactique HoMM

> Rendue par l'agent `tactical-rpg-expert` le 2026-09-29. Il a revérifié les
> affirmations du designer dans le code (toutes confirmées) et n'a **pas** lancé
> `faction:sim` : tout effet d'équilibrage est « à mesurer ». Les chiffres canon
> incertains sont marqués comme tels.

**Constats nouveaux de l'expert**
- La file de choix existe déjà pour les **attributs** (`pendingAttributeChoices`,
  `adventure/experience.ts:117`) ⇒ C1 peut passer par un champ **optionnel**, sans bump.
- **Divergence doc ↔ code sur la fuite** : doc 02 dit « re-recrutable en taverne »,
  `combat/leave.ts:97` laisse le héros **sur la carte, armée vide** (exploit de
  l'éclaireur à armée vide).
- Un gardien = **une seule pile** (`combat/setup.ts:414`) ; **16** compétences
  seulement (`data/core/skills.json`), aucune ne pilote les machines de guerre ; les
  compétences d'école ne font que baisser le coût en mana.

### 3.1 Verdicts

| # | Filiation | Verdict | Amendement retenu |
|---|---|---|---|
| A1 ZdC gardiens | Canon II/III | **Amender** | livrer **avec A2 et B1** (sinon l'IA reste bloquée derrière un goulot) ; plusieurs gardiens au bord ⇒ un seul combat (1ᵉʳ par id) ; `mapgen` interdit les chevauchements de zones ; préviz qui s'arrête sur la case d'engagement |
| A2 Gardiens aux goulots | Adaptation (templates HoMM3) | **Amender** | repli par régions autour des départs (Voronoï, portes gardées) si trop peu d'articulations ; `generatorVersion` plutôt que casser les graines partagées ; carte différente documentée |
| A3 Banques | Canon III/V | **Retenir** | usage unique, paliers verrouillés par profondeur, force en fourchette, sentinelle `neverFlee` |
| A4 Neutres fuient/rallient | Canon III (seuils incertains) | **Amender** | la fuite est une **proposition** « Laisser partir / Poursuivre » ; `disposition` optionnelle en données ; `neverFlee` sur sentinelles/quêtes/banques ; ralliement payant et plafonné par les emplacements libres ; Diplomatie = compétence en données |
| A5 Quêtes au héros (M14) | Canon III | **Retenir** | garder `by:'sight'` pour l'existant |
| B1 IA multi-jours | Adaptation III/V | **Amender** | évaluation de **menace** (garder un défenseur), score pondéré par la probabilité de victoire, inclure villes à garnison (D-SIEGEAI) et gardiens de goulot |
| B2 Économie IA | Canon | **Retenir** | réserve pour le bâtiment prioritaire ; villes avant héros **seulement** pour un héros qui démarre en ville |
| B3 IA visite/fuit | Canon III | **Retenir** (après E1) | seuil à mesurer ; jamais fuir le siège de sa dernière ville |
| C1 File de compétences (M12) | Canon III | **Amender** | patron `pendingAttributeChoices`, champ optionnel ⇒ **pas de bump** |
| C2 Mana ressource (M11) | Canon III/V (régén. incertaine) | **Amender** | supprimer **aussi** la recharge de l'aube ; régénération portée par une compétence **Mysticisme** ; IA économe quand elle domine ; lecture « gauntlet à mana persistante » ajoutée au sim **avant** réglage |
| C3 Artefacts | Canon III (combinaisons) / V (sets) | **Amender** | étape 1 = rareté + artefacts qui **changent une règle** (effets déjà au catalogue) ; sets en étape 2 ; reliques réservées aux grandes banques |
| C4 Récompense sans perte (M19) | Canon III | **Retenir** | fusion si même unité, sinon garnison la plus proche **annoncée par un toast** |
| D1 Défendre utile (M10) | Canon III (valeur exacte incertaine) | **Retenir** | plancher +1, préviz comprise, sim avant/après |
| D2 Soin ≠ Résurrection (M13) | Canon III | **Retenir** | `revive:false` par défaut (`soin`, `grande-guerison`, `soin-de-lumiere`) ; Prière et drain de vie restent ressusciteurs explicites |
| D3 Siège avec héros visiteur | Canon III/V | **Retenir** (lot L) | piles du héros d'abord (≤ 7), surplus en garnison qui tombe avec la ville |
| E1 Fuite HoMM | Canon III | **Retenir** | **0 survivant** (canon ; la reddition couvre le reste) ; taverne de **son** joueur uniquement |
| E2 Stock initial d'habitation | Canon III | **Retenir** | — |
| E3 Upgrades exclusifs | Canon V/VII | **Reporter** | pilote 1 maison × 1 tier après C3, une fois le sim capable de lire les élites |

### 3.2 Reliquats de décision sans proposition

- **D-POISON** → le poison **traverse** le bouclier (statu quo, zéro code) : un
  bouclier absorbe des coups, pas un statut ; contre-jeu = Purification/Dissipation
  (`combat/spell-effect.ts:321-339`). À écrire dans docs 02 et 16.
- **D-REINF** → `CallReinforcements` **consomme l'action de héros du round**
  (exclusif de frappe et sort, doc 02 §1), via la même garde que `heroAttackUsed`.
- **D-SIEGEAI** → lever la garde « pas de garnison » (`ai/adventure.ts:452`) et
  engager si `armyStrength(héros) ≥ 1,5 × (garnison × bonus de mur + tour)`. Intégré
  à B1 — sans lui B1 n'atteint pas son critère.

### 3.3 Propositions ajoutées par l'expert

| ID | Filiation | Mécanique | Pourquoi |
|---|---|---|---|
| F1 Division des piles neutres | Canon III | `beginGuardianCombat` scinde le gardien en k piles selon l'effectif (RNG seedé), zéro save | une pile unique se fait démonter par les tireurs ; la tactique s'appauvrit |
| F2 Maîtrise d'école qui change l'effet | Canon III (versions « de masse » à Expert) | effet par rang en données (zone de ciblage, puissance) | vrai choix de build du héros mage |
| F3 Pool de compétences élargi | Canon III | Mysticisme, Intelligence, Sorcellerie, Résistance, Orientation, Diplomatie, Artillerie, Premiers soins, Balistique — données + effets existants | pilote enfin les machines de guerre livrées ; sert C2 et A4 |
| ~~F4 Créatures à 2 cases~~ | Canon III/V | — | **Ne se rouvre pas** : divergence déjà tranchée « non, fidèle MMHO » (doc 18 §4 B5, étape 5) |

## 4. Lots proposés (synthèse du binôme)

Chaque lot = un plan `.claude/plans/<lot>.md` + une PR atomique, **après** validation
des décisions 🗳️ qui le concernent. Mesurer une **baseline headless commune**
(carte Moyenne, 2 IA, 10 graines : jour de 1ʳᵉ attaque de ville, `armyStrength` au
j28, taux de victoire humain en normal) avant LE1 et la rejouer à chaque lot IA.

| Lot | Contenu | Pourquoi d'abord | Moteur | Save | Golden |
|---|---|---|---|---|---|
| **LE1 — Un adversaire qui presse** ✅ (`le1-ai-pressure.md`) | B2 → B1 (menace + proba de victoire) + D-SIEGEAI | levier n°1, visible à chaque partie | IA seule | non | non |
| **LE2 — Règles en suspens** ✅ (`le2-rules-pending.md`) | D1 (M10), D2 (M13), A5 + C4 (M14/M19), C1 (M12, champ optionnel), D-REINF ; D-POISON documenté | petits correctifs, golden re-fixé **une** fois | oui | non | oui (D1/D2) |
| **LE3 — La carte qui résiste** ✅ (`le3-map-resists.md`) | A2 (+ `generatorVersion`, repli régions) → A3 → A1 (opt-in, activé après LE1) | creux de mi-partie | 1 flag | non | non |
| **LE4 — Magie & build du héros** | F3 (compétences) → F2 (maîtrises) → C2 (mana persistante, après la lecture sim dédiée) | Savoir/Puits/Mysticisme enfin utiles | oui | non | à vérifier |
| **LE5 — Neutres vivants** | F1 (division des piles) → A4 (fuite proposée, ralliement, Diplomatie) | fin du ratissage | 1 point | non | non |
| **LE6 — Revenir dans la partie** | E1 (fuite HoMM, corrige la divergence doc/code) → B3 → E2 | comeback, supprime l'éclaireur vide | 1 point | **probable** | non |
| **LE7 — Butin & siège** ✅ (`le7-loot-and-siege.md`) | C3 étape 1 → sets ; D3 siège avec héros visiteur | profondeur de fin de partie | 1 point (sets) | ? | non |
| **LE-UX** ✅ (`le-ux-ergonomics.md`) | ergonomie §1.3 | client seul, indépendant | non | non | non |
| **E3** ✅ (`e3-prereq-elite-sim.md`, `e3-elite-balance-pass-3.md`, `e3-pilot-level-alternatives.md`) | prérequis sim élites → passe 3 (élites au juste prix) → pilote Haven T3 (`alternatives`) | contenu ×2 | 1 point | non | non |
| **LE8 — finitions** ✅ (`le8-finitions.md`) | IA qui choisit l'option d'un niveau à alternatives ; `map:gen` = client ; icône PWA maskable (§1.4) | reliquats sans décision | IA seule | non | non |

## 5. Décisions — ✅ tranchées par l'utilisateur le 2026-09-29

> « Soin ne ressuscite plus ok. Ok pour le mana. Ok pour tous les points » ⇒ les
> **14 recommandations du binôme sont adoptées** telles qu'écrites ci-dessous
> (réponse entre parenthèses = décision).

1. **A1** : la zone de contrôle n'est-elle livrée qu'avec A2 et B1 ? *(oui)*
2. **A2** : une carte générée peut-elle différer à graine égale, avec `generatorVersion` ? *(oui)*
3. **A4** : la fuite d'un neutre est-elle une proposition que le joueur peut refuser ? *(oui)*
4. **A4/F3** : ajoute-t-on la compétence Diplomatie (ralliement contre or) ? *(oui, plafonnée)*
5. **C2 (M11)** : la mana persistante supprime-t-elle aussi la recharge à l'aube ? *(oui, avec Mysticisme et lecture sim préalable)*
6. **C1 (M12)** : file de compétences par champ optionnel, sans bump ? *(oui)*
7. **E1** : le héros en fuite n'est-il recrutable que dans la taverne de son joueur, sans survivant ? *(oui)*
8. **D1 (M10)** : Défendre donne-t-il un plancher de +1, quitte à re-fixer le golden ? *(oui)*
9. **D2 (M13)** : Soin cesse-t-il de ressusciter (`revive`) ? *(oui)*
10. **D-POISON** : le poison traverse-t-il le bouclier ? *(oui, statu quo documenté)*
11. **D-REINF** : les renforts consomment-ils l'action de héros du round ? *(oui)*
12. **D-SIEGEAI** : l'IA assiège-t-elle une ville à garnison au-delà de 1,5× sa force ? *(oui)*
13. **F1/F2** : ouvre-t-on division des piles neutres et maîtrises d'école comme lots, avant les sets ? *(oui)*
14. **Ordre** : LE1 → LE2 → LE3 → LE4 → LE5 → LE6 → LE7, LE-UX en parallèle ? *(oui)*

## 5bis. Reliquats §1.2 — proposition du game designer

> Rendu par l'agent `game-designer` le 2026-10-08 sur `main` à `e3cee15e`.
> Chaque item du §1.2 vérifié dans le code et les données ; `faction:sim` lancé
> (référence + 4 variantes **jetables** dans une copie hors dépôt — aucune
> modification du dépôt). **Verdict du binôme : en attente** — à soumettre au
> `tactical-rpg-expert` par la session principale. Les décisions 🗳️ reviennent
> à l'utilisateur.

### 5bis.1 Instruction item par item

| Item §1.2 | État réel (preuve) | Suite proposée |
|---|---|---|
| **CAP Maître de Sortilèges** (Vox T6) | `abilities: []` (`data/factions/vox-arcana/units/t6-maitre*.json`) ; moteur prêt (`spellcaster`, `combat/spell-effect.ts:25`) ; **mais `faction:sim` ne voit aucun lanceur d'unité** : `simulateAutoCombat` ne pose jamais `spellCatalog` (`combat/simulate.ts:22-39`, vide par défaut `core/state.ts:519`) ⇒ `chooseSpellcast` sort sur `if (!spell) return null` (`combat/ai.ts:217`). Mesuré : câbler le Maître ne change **aucun** chiffre du sim actuel. | **Lot R1** |
| **CAP Avatar Vox** | barrière livrée (projection au setup, doc 16 CAP-BARRIER) ; ne reste que le **lancer actif** mi-combat | **écarter** : nouveau point (action d'unité ciblée) pour un T8 déjà au budget ; la projection suffit au ressenti |
| **« factions fortes au sim »** | **périmé** : au duel de base, Vox est désormais **la plus faible** (moy. 43,9 %) | — |
| **combatBonus des autres factions** | chaque maison a déjà sa signature (`factionBonuses` : Nécromancie, Essence, Résonance, Magie irrésistible ; Sylvan = capacité `symbiosis`) | **écarter** : Ferveur/Formation est l'identité de Haven (doc 03 §2) ; la répandre aplatit l'asymétrie |
| **F-SKILLS Sylve** | Sylvan n'a ni `factionBonuses` ni `heroSkills` (`sylvan-court/manifest.json`) ; `startingSymbiosisStacks` existe mais n'est lu que sur Maison/spécialité/archétype (`combat/setup.ts:752` → `hero/skills.ts:61-68`), pas sur les rangs de compétence | **Lot R4** |
| **F-SKILLS Chasse rituelle** (AH) | spec doc 05 §7 ; aucun champ « % de gain de ressource de faction » (`faction/effects.ts:81-98` crédite `amount` plat) ; même manque pour **Rumi** (doc 16 §6 : « +25 % de gain de Résonance », données : `rangedDamagePct 10`, `heroes/rumi.json`) | **Lot R4** |
| **École de la Scène peur / +moral** | **livré** (16.12) : `moraleMod` sur Chant (+1) et Dissonance (−1) ; un moral négatif fait sauter le tour (`combat/turns.ts:271-279`) = la « peur » | **clore**. Reste « Dissonance renforcée vs `demon` » : écarter (le moteur n'a pas de type « démon » ; seule la forme `demonform` de l'AH T8 s'en approche) |
| **F-BUILDEFF.7+ Traque** (+1 vitesse recrue) | piles = `{unitId, count}`, pas de stats par instance ; placeholder `growthBonus 20` (`arcane-hunters/buildings.json`) | **garder différé** : stats par instance = bump save + refonte de l'armée pour +1 vitesse dans une ville d'une faction |
| **F-BUILDEFF.7+ Sceau** (−15 % mana d'école) | une aura de ville ne suit pas le héros en combat (`heroAura` town-scoped, `town/types.ts:68-88`) | **garder différé** : valeur faible ; à rouvrir seulement si un « bienfait jusqu'au prochain combat » de bâtiment apparaît |
| **Cloître Haven +2 mana/j** (réconcilié no-op) | depuis LE4 la mana persiste, **mais** une ville à Guilde recharge à 100 % et le Cloître exige `mageGuild@1` ⇒ toujours un no-op | **clore** (le noter doc 03 §4) |
| **+XP / +rang**, **Sanctuaire du Honmoon (bonus additionnels)** | aucune spec chiffrée dans aucun doc ; le Sanctuaire est l'habitation T8 livrée | **écarter** faute de spec (pas de système spéculatif) |
| **H-NAMED** (Nécromancie/niveau, Symbiose de départ, familier gratuit) | **livré** (H-COND-EXACT) : `raiseUndeadPctPerLevel` (`mere-corbeau.json`), `startingSymbiosisStacks` (`faelar.json`), `startingArmyBonus` (`alwin.json`) | **clore** (registre périmé) |
| **M-VISIT gating des sanctuaires** | `learnSpell` enseigne sans regarder le cercle apprenable (`adventure/visitable.ts:71-77`) ; et **`generateMap` ne pose ni sanctuaire de sort, ni cabane de la sorcière, ni fabrique** (`content/src/mapgen.ts:642-700` : fontaine, écurie, tour, `levelXp`, moulin, mana, entraînement) — ils n'existent que sur `proto-01` ; l'IA **ignore** tous les lieux de bonus sauf la fontaine de mana (`ai/adventure.ts:132-150`) | **Lot R3** |
| **M-VISIT mois persistants** | **livré** (`calendar.monthEvents`, `Calendar.monthEventId`, doc 02 §2.3) | **clore** |
| **M-VISIT ciblage par `unitId` exact** | `growthUnit` tire l'unité au RNG, exprès : la config core ne nomme jamais une unité de paquet | **écarter** (violerait la modularité core → paquet) |
| **Graal par faction** | **livré** (`requiresGrail` dans les 7 `buildings.json`, table doc 02 §2.2) | **clore** |
| **Marché : courbe HoMM3, troc pénalisé** | taux uniques pour **toutes** les ressources : vente 25 / achat 50 (`data/core/config.json:137-144`, `town/market.ts:44-62`) ⇒ **une gemme coûte 50 or**. L'arbre complet core + Haven demande 157 500 or et 341 ressources non-or, soit 17 050 or au marché (**11 %**) : une mine de gemmes (1/j) vaut 50 or/j face à 1000 pour une mine d'or. La « compétition territoriale » des rares (doc 02 §3) n'existe pas | **Lot R2**. Le troc passe déjà par l'écart vente/achat : un « troc pénalisé » à part serait redondant (écarter) |
| **Caravanes : interception, annulation** | non interceptables par choix (`town/caravan.ts:10-14`) ; l'IA n'en envoie jamais (aucun `SendCaravan` dans `engine/src/ai`) | **écarter** : seul l'humain en profiterait, contre une IA qui n'intercepte pas ; l'annulation est un confort mineur |
| **Slot d'artefact trophée** | `hero.artifacts` = 10 slots sérialisés ⇒ bump save + poupée | **écarter** : un effet de ville (Salle des Reliques AH) qui modifie durablement le héros pour un gain mince ; LE7 a déjà enrichi le butin et le sac |

**Mesure de référence `faction:sim` (main, 2026-10-08)** : 1 béance au duel de
base (AH vs Vox 19,2 %, connue depuis LE2) ; moyennes au duel de base : Haven
53,4 · AH 51,5 · Necro 50,4 · Sylvan 53,9 · **Vox 43,9** · Dungeon 46,9.

### 5bis.2 Lots proposés (ordre valeur / effort)

#### R1 — Le sim voit la magie des unités, puis le Maître de Sortilèges (S)

1. **Intention joueur** — les lanceurs de sorts (Prêtresse, Ange, Bibliothécaire,
   Sorcière, bientôt Maître) pèsent dans l'équilibrage en proportion de ce qu'ils
   font en partie.
2. **Constat** — voir 5bis.1 (`simulate.ts:22-39`, `ai.ts:217`). Mesure jetable
   « sim + sorts » (seul changement : `spellCatalog` posé) : le duel de base
   **bascule** — Haven 53,4 → **42,0**, AH 51,5 → **60,8**, Necro 44,7, Sylvan
   57,7, Vox 46,2, Dungeon 48,8 ; la béance AH-Vox disparaît (33,8 %), une autre
   apparaît (**Haven vs Sylvan 13,3 %**) ; le facteur d'égalité des élites sort de
   ±5 % pour Dungeon (×0,937). **Toute la passe 2 et la passe 3 ont été calées
   sans les lanceurs.**
3. **Mécanique** — (a) outillage : `simulateAutoCombat`/`simulateHeroCombat`
   reçoivent le catalogue de sorts (paramètre optionnel ; aucune règle neuve) ;
   (b) données : Maître de Sortilèges `spellcaster { dissonance, charges 2,
   power 3 }` (élite : charges 3), conforme au doc 16 §4 (« Dissonance :
   −Attaque / peur »). Mesuré avec le sim corrigé : **Dissonance** coûte 1,8 pt
   à Vox (46,2 → 44,4) ; **Chant de courage** en coûte 7 (→ 39,1) — la pile qui
   lance ne frappe pas ce tour-là. Variante testée et non retenue : ne soigner
   que si une demi-créature manque (heuristique IA) — effet mitigé (Haven vs AH
   +11 pts, Haven vs Dungeon −5, béance Haven-Sylvan inchangée).
4. **Pilier** — rejouabilité / asymétrie des factions.
5. **Point d'extension** — aucun nouveau : un paramètre optionnel d'outil + une
   capacité déjà au catalogue.
6. **Coût** — S · moteur : signature de `simulate.ts` seulement · save non ·
   golden non.
7. **Critère** — test unitaire : une pile `spellcaster` lance son sort dans
   `simulateAutoCombat` (événement de lancer) ; `faction:sim` avant/après
   consigné ; `elite-ability-parity` vert.
8. **Verdict** — en attente.

🗳️ **D-R1a** : après correction du sim, ouvre-t-on une **passe 4 d'équilibrage**
(cible : béance Haven vs Sylvan 13 %, Haven retombé à 42 %, élites Dungeon
×0,94), ou garde-t-on les nouveaux chiffres en lecture ? *(designer : passe 4,
données seules, après R1 — sinon chaque futur câblage se mesure contre un
étalon faux)*
🗳️ **D-R1b** : le Maître lance **Dissonance** (recommandé, −1,8 pt à Vox) ou
**Chant de courage** (−7 pts, demanderait une compensation de stats) ?

#### R2 — Les ressources rares ont un prix (M)

1. **Intention joueur** — une mine de gemmes se dispute ; le marché dépanne
   sans dispenser de tenir le terrain.
2. **Constat** — voir 5bis.1 (une gemme = 50 or, 11 % du coût d'un arbre complet).
3. **Mécanique** — `config.market` gagne deux champs optionnels :
   `resourceValue` (multiplicateur par ressource sur `sellRate`/`buyRate` :
   commune ×1, rare ×2) et `curve` (table `{ sellRate, buyRate }` indexée par le
   nombre de marchés, dernière ligne répétée ; remplace le facteur linéaire
   quand présente). Proposition (ressource commune ; rare ×2) :

   | Marchés | 1 | 2 | 3 | 4 | 5+ |
   |---|---|---|---|---|---|
   | Vente | 25 | 35 | 45 | 55 | 60 |
   | Achat | 125 | 100 | 85 | 75 | 70 |

   Une gemme passe de 50 à **250 or** à un marché (140 à 5+). Invariant gardé et
   étendu au schéma : à chaque ligne, vente ≤ achat ⇒ aucun aller-retour rentable ;
   le troc reste « vendre puis acheter ». *Chiffres HoMM3 exacts incertains — à
   confirmer par l'expert ; l'esprit canon est un marché unique ruineux et des
   marchés multiples qui le rendent viable.*
4. **Pilier** — gestion de ville (et exploration : les mines rares deviennent des
   objectifs).
5. **Point d'extension** — un seul : le modèle de taux du marché (`effectiveMarketRates`/
   `tradeQuote`, déjà partagés client + IA ⇒ l'aperçu et l'IA suivent sans code
   à part).
6. **Coût** — M · moteur oui (market + schéma) · save non · golden non (aucun
   échange dans le replay).
7. **Critère** — tests `tradeQuote` (rare ×2, courbe, invariant) ; bench headless
   jetable du LE1 (2 IA, 64², 20 graines, 60 jours) avant/après : jour médian du
   Capitole et de la 1ʳᵉ habitation T7 de l'IA **sans recul de plus de 7 jours**,
   captures de ville ≥ baseline ; doc 02 §3 amendé.
8. **Verdict** — en attente.

🗳️ **D-R2** : ampleur — (a) **poids seuls** (rare ×2, taux linéaire actuel :
gemme à 100 or) ou (b) **poids + courbe** ci-dessus (gemme à 250 or à un
marché) ? *(designer : (b), repli sur (a) si le bench montre une IA qui cale)*

#### R3 — Des lieux d'apprentissage sur toutes les cartes (M)

1. **Intention joueur** — chaque carte générée offre des détours qui forgent le
   héros (un sort, une compétence), et l'IA s'en sert aussi.
2. **Constat** — voir 5bis.1 (`mapgen.ts:642-700`, `visitable.ts:71-77`,
   `ai/adventure.ts:132-150`).
3. **Mécanique** —
   - **Gate** (canon III, Sanctuaire de la Pensée) : `learnSpell` n'enseigne un
     sort que si son cercle ≤ `heroLearnableCircle` ; sinon la visite **n'est
     pas consommée** (le héros reviendra avec Sagesse) et un toast l'explique.
   - **Génération v3** (`generatorVersion: 3`, v1/v2 reproductibles à l'octet) :
     sanctuaires de sort cercle 1 / 2 / 3 (sort tiré au RNG seedé parmi les écoles
     **communes** — jamais une école de faction), cabanes de la sorcière (compétence
     commune tirée au RNG, jamais une `heroSkills` de faction), fabrique de
     machines ; comptés sur `eventBuildingDensity` (2-4 par carte Moyenne), les
     cercles 3 placés en profondeur comme les reliques.
   - **IA** : `levelXp`, `permanentStat`, `learnSpell` (si apprenable et inconnu),
     `grantSkill` (si non connue) deviennent collectables, avec le même filtre
     de distance que les autres cibles.
4. **Pilier** — exploration (+ armée & héros).
5. **Point d'extension** — `generatorVersion` (existant) ; la gate est une règle
   de fidélité sur un effet existant.
6. **Coût** — M · moteur oui (visitable + IA) · save non · golden non.
7. **Critère** — test moteur « cercle 3 sans Sagesse ⇒ refusé, visite
   disponible ; avec Sagesse ⇒ appris » ; test contenu v3 (≥ 1 sanctuaire et
   1 cabane sur 20 graines, v2 identique à l'octet) ; bench IA : niveau moyen du
   héros IA au j28 ≥ baseline ; doc 02 §2.2 amendé.
8. **Verdict** — en attente.

🗳️ **D-R3** : une cabane de la sorcière peut-elle enseigner **Sagesse** et les
écoles de magie (HoMM3 oui), ou les réserve-t-on à la montée de niveau ?

#### R4 — Deux compétences de faction (S-M)

1. **Intention joueur** — un héros Sylvan ou Arcane Hunters a, lui aussi, une
   compétence qui n'appartient qu'à sa maison (comme Nécromancie et Prière).
2. **Constat** — voir 5bis.1 (Sylvan sans `heroSkills` ; AH sans Chasse
   rituelle ; Rumi en écart doc ↔ données).
3. **Mécanique** —
   - **Sylve** (Sylvan, N/E/M) : `startingSymbiosisStacks` 1 / 2 / 3 (borné au
     `maxStacks` 4 des unités) ; le champ, aujourd'hui lu sur Maison/spécialité,
     est aussi sommé sur les **rangs de compétence**. La Symbiose retombant à 0
     à la première action, l'avance ne profite qu'aux piles qui tiennent leur
     poste : l'identité « immobilité » est préservée. Cumul avec Faelar plafonné
     par `maxStacks`.
   - **Chasse rituelle** (AH, N/E/M) : nouveau champ d'effet
     `factionResourceGainPct` 10 / 20 / 30, appliqué au gain post-victoire
     (`applyGainFactionResourceOnVictory`). La clause « à Maître, la 1ʳᵉ
     consommation de Marques est gratuite » est **écartée** (second point
     d'extension). Le même champ rend la spécialité de **Rumi** conforme au doc
     16 §6 (+25 % de Résonance).
4. **Pilier** — rejouabilité / asymétrie des factions.
5. **Point d'extension** — un seul neuf : `factionResourceGainPct` (Sylve ne fait
   qu'élargir la lecture d'un champ existant aux compétences).
6. **Coût** — S-M · moteur oui · save non · golden non.
7. **Critère** — tests moteur : Sylve rang 2 ⇒ piles `symbiosis` à 2 paliers à
   l'ouverture, borné à 4 avec Faelar ; Chasse rituelle rang 3 ⇒ Essence 10 → 13 ;
   `content:check` (compétence gatée par `manifest.heroSkills`) ; docs 05 §7,
   14 §6, 16 §6 amendés. Effet inter-combat ou de héros ⇒ invisible au duel ; la
   lecture d'attrition reste qualitative.
8. **Verdict** — en attente.

🗳️ **D-R4a** : Sylve = **paliers de départ** (moteur prêt, recommandé) ou
« +1 palier maximum » comme l'ébauche du doc 14 §6 (nouveau champ, effet quasi
nul en auto-combat puisque la Symbiose monte rarement) ?
🗳️ **D-R4b** : Chasse rituelle sur **toute victoire** (recommandé, sans
nouveau contexte) ou **contre les neutres seulement** (doc 05 ; demande de
transmettre la nature de l'adversaire au gain) ?
🗳️ **D-R4c** : Rumi passe-t-il à « +25 % de Résonance » (doc) au lieu de +10 %
de dégâts à distance (données actuelles) ?

### 5bis.3 Ordre recommandé et clôtures

**R1 → R2 → R3 → R4.** R1 d'abord : sans lui toute mesure d'équilibrage (dont
la passe 4 éventuelle et R4) se fait contre un étalon aveugle aux lanceurs.
R2 ensuite : c'est le seul lot qui change **chaque partie** (économie). R3 et R4
sont indépendants entre eux.

🗳️ **D-R0** : valide-t-on la **clôture** au registre §1.2 des items livrés
(H-NAMED, Scène peur/+moral, mois persistants, Graal par faction, Cloître) et
l'**abandon** des items écartés (Avatar actif, combatBonus généralisé,
+XP/+rang, Sanctuaire du Honmoon, `unitId` exact, interception et annulation de
caravane, troc pénalisé à part, slot trophée), Traque et Sceau restant
**différés** avec leur blocage écrit ?

## 6. Journal

- **2026-09-29** — Plan ouvert par la passe de clôture ; registre §1 constitué et
  vérifié ; agents `game-designer` et `tactical-rpg-expert` créés.
- **2026-09-29** — §2 rendu par `game-designer` (17 propositions, 5 axes) ; §3
  relecture de `tactical-rpg-expert` (affirmations revérifiées dans le code,
  3 propositions ajoutées, 2-hex non rouvert : divergence tranchée doc 18) ; §4
  lots LE1→LE7 + LE-UX ; §5 14 décisions soumises à l'utilisateur. **Aucun code.**
- **2026-09-29** — 14 décisions du §5 **adoptées** par l'utilisateur (Soin ne
  ressuscite plus, mana persistante, et tous les autres points). Ouverture de LE1.
- **2026-09-29** — **LE1 livré** (`le1-ai-pressure.md`) : combats entre joueurs
  9/20 → 17/20, captures de ville 0 → 4/20, parties conclues 5/20 → 12/20. Relevé
  pour LE3 : garnisons démesurées des villes neutres générées.
- **2026-09-30** — **LE2 livré** (`le2-rules-pending.md`) : Défendre ≥ +1, Soin ≠
  Résurrection (`revive`), file de compétences, quêtes validées par un héros,
  récompenses jamais perdues, renforts = action du héros. `faction:sim` : 1 béance
  (AH vs Vox 19,2 %, due à D1) signalée, non re-tunée.
- **2026-09-30** — **LE3 livré** (`le3-map-resists.md`) : générateur v2
  (`generatorVersion`, la v1 reste reproductible), gardiens aux goulots et aux
  portes entre régions (~60 %), banques de créatures, villes neutres de
  mi-partie (garnison ÷ 9), zone de contrôle activée. Bench IA : captures 3 → 5/20,
  rencontres 17 → 12/20 (voulu : la carte résiste). Relevé pour LE5/LE6 : l'IA
  perd parfois son héros de départ contre un gardien de haut tier
  (`armyStrength` sous-estime les hauts tiers).
- **2026-09-30** — **LE7 livré** (`le7-loot-and-siege.md`) : reliques (grande
  banque seule), artefacts qui changent une règle (`effects`), catalogue à 41 ;
  siège avec héros visiteur. Les lots LE1→LE7 sont tous livrés ; reste LE-UX et
  le report E3.
- **2026-09-30** — **LE-UX livré** (`le-ux-ergonomics.md`) : les dix points
  d'ergonomie du §1.3. Reste le report E3.
- **2026-10-01** — **E3 livré** : `faction:sim` lit les élites (et un auto-combat
  sans fin corrigé), passe 3 (élites au juste prix, facteur d'égalité ×1,00 ± 5 %),
  pilote Haven T3 Templier/Vindicateur via `alternatives` de niveau.
- **2026-10-07** — **LE8 — finitions** (`le8-finitions.md`) : choix d'option de
  l'IA, `map:gen` aligné sur le client, icône PWA maskable.
- **2026-10-08** — §5bis rendu par `game-designer` : registre §1.2 instruit item
  par item (5 items déjà livrés, 9 écartés ou différés), 4 lots R1→R4 proposés,
  7 décisions 🗳️. Constat principal : `faction:sim` ignore les lanceurs de sorts
  d'unité (catalogue de sorts vide). Verdict de l'expert en attente. **Aucun code.**
