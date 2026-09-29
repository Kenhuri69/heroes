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

### 1.1 Décisions de design en suspens 🗳️ (soumises au binôme, §3)

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

*(à remplir)*

## 4. Lots proposés

*(à remplir)*

## 5. Journal

- **2026-09-29** — Plan ouvert par la passe de clôture ; registre §1 constitué et
  vérifié ; agents `game-designer` et `tactical-rpg-expert` créés.
