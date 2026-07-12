# Spécification des manques — jeu livré vs concept d'origine

> **Travail documentaire uniquement** (demande utilisateur du 2026-07-10) : rien
> n'est implémenté dans ce lot. Ce document est l'inventaire **complet** des
> fonctions absentes ou partielles par rapport aux docs de conception
> (`docs/01` → `docs/16`, source de vérité), avec pour chaque manque une
> mini-spécification, les pointeurs vers les docs d'origine où sourcer le
> développement, et un **ordre d'exécution** proposé en lots.
>
> **Méthode** : 5 audits parallèles (2026-07-10) croisant chaque doc avec le
> code réel — mécaniques (doc 02), factions (docs 03/04/05/14/16), GDD/roadmap/
> narratif (docs 01/09/13), backend/architecture (docs 07/15), UI/UX/assets
> (docs 08/12). Chaque constat cite `fichier:ligne`.
>
> **Relation avec `.claude/plans/gap-audit.md`** (audit du 2026-07-08) : ce
> document le **remplace** comme backlog de référence. Les items ✅ de
> gap-audit sont confirmés corrigés dans le code courant (G1, G2, G3, F1, F2,
> C1, C3, C7, H2) ; ses items ⬜ restants sont repris ici sous de nouveaux ID,
> re-vérifiés et re-spécifiés.

## Légende

- **Type** : 🕳️ absent · 🧩 partiel · 🎨 façade (structure là, effet/UX manquant) · 🐞 bug de règle · 📄 divergence documentaire
- **Effort** : S ≈ ½ j · M ≈ 1–3 j · L ≈ 1 sem+
- **État** : ⬜ à faire · ✅ fait — à tenir à jour au fil des lots

---

## 1. Synthèse exécutive

Les cinq plus gros écarts entre le concept et le jeu livré :

1. **~20 capacités d'unités spécifiées mais inertes** (docs 03/04/05/16 §lineup) :
   le moteur n'interprète que 9 capacités ; `taunt`, `lifeDrain`, `spellcaster`,
   `aura`, peur, renaissance… n'existent ni au catalogue ni au moteur. C'est le
   plus gros gisement de « façade données » du combat (§2.2).
2. **Le pilier « en ligne » n'est pas jouable** (docs 01 §3, 09 Phase 3, 15) :
   backend déployé + SDK complet, mais côté client seule l'auth existe. Pas
   d'UI PvP, pas de cloud saves câblées, pas d'endpoint de détail de match
   (bloquant), pas de classement (§2.7).
3. **Aucun système de héros nommés/spécialités** (docs 03→16 §héros) : les 10
   héros nommés des 5 factions (Aldric, Vhalen, Evadne, Faelar, Hermione…)
   n'ont aucune identité en jeu ; point d'extension jamais ouvert (§2.4).
4. **Systèmes de faction incomplets** : bonus passifs de faction, compétences
   de faction (Nécromancie graduée…), bâtiments spéciaux, écoles de sorts
   propres à 2/8 ou 0 sort, effets de Maison Vox divergents du doc (§2.3).
5. **Interactions d'armée/objets côté joueur** : pas de multi-héros ni
   recrutement en taverne, pas de split/réorganisation de piles, poupée
   d'équipement en lecture seule, pas de transfert héros↔héros (§2.5, §2.9).

---

## 2. Inventaire des manques

### 2.1 Combat hexagonal (C-*)

Source design : **doc 02 §5** (déroulé, dégâts, moral/chance, capacités, siège),
doc 08 §2.4 (écran de combat).

- **C-LOS — Ligne de vue des tireurs** 🐞 S ✅ (A1)
  Doc : doc 02 §5.2/§5.4 (obstacles bloquants). Code : `canShoot` ne teste que
  l'adjacence d'un ennemi et les munitions (`packages/engine/src/combat/actions.ts:73-83`) ;
  les obstacles bloquent le déplacement (`actions.ts:34-35`) mais jamais le tir.
  Spec : tracé d'hex-line entre tireur et cible ; obstacle (ou pile ?) sur le
  segment ⇒ tir interdit ou malus (décision design : HoMM classique = pas de
  LoS stricte ; HO = LoS). Pas de malus de distance (doc §5.4 : portée illimitée).
  Vérif : tests moteur LoS + golden re-fixé.

- **C-BADLUCK — Malchance & bornes de chance** 🐞 S ✅ (A1)
  Doc : doc 02 §5.3 (chance ±, demi-dégâts). Code : chance = ×2 seulement,
  bornée [0,3] (`packages/engine/src/combat/damage.ts:170-178,288-292`).
  Spec : borne symétrique [-3,3], jet de malchance ⇒ ×0,5 ; prévisualisation
  mise à jour. Vérif : tests dégâts min/max, golden re-fixé.

- **C-SIEGE2 — Siège v2 : murs jouables** 🕳️ L ⬜
  Doc : doc 02 §4.1/§5 (murs, porte, douves, tours de tir, catapulte).
  Code : « murs » = bonus plat `wallDefenseBonus` +3/niveau de Fort
  (`packages/engine/src/town/capture.ts` → `combat/damage.ts:249-256`) ; grille
  de siège inexistante. Spec (v2, incrémentale) : (a) murs/porte comme
  obstacles destructibles sur la colonne de grille, (b) catapulte auto (comme
  machine de guerre, réutilise la Forge 4.12), (c) tour de tir = pile
  défenderesse fixe, (d) douves = zone de ralentissement. Chaque incrément
  data-driven (niveau de Fort ⇒ éléments présents). Vérif : tests moteur par
  élément + smoke siège.

- **C-SPELLUI — Grimoire & ciblage de sorts** 🎨 M ⬜
  Doc : doc 08 §2.3 (grimoire feuilletable par école), doc 02 §1.4.
  Code : liste plate groupée école/cercle (`packages/client/src/ui/SpellBook.tsx:170-213`),
  ciblage = liste texte de piles (`TargetList`), la zone (`splash`) réutilise la
  sélection de pile centrale. Spec : onglets/feuilletage par école, ciblage
  d'hex sur la grille (surbrillance de la zone), indication de maîtrise/cercle,
  séparation sorts combat/aventure. Dépend de H-SPELLS pour masse/chaîne.
  Vérif : smoke ciblage zone + a11y cibles ≥ 44px.

- **C-TACTICS — Compétence Tactique & phase de placement** 🕳️ M ✅ (livré)
  Doc : doc 02 §5.1 (« placement initial automatique + phase de placement
  tactique si compétence Tactique ») + §1.3 (pool de compétences).
  Code : aucune compétence `tactics` dans `data/core/skills.json` ;
  `combat/setup.ts` ne fait que du placement par slot (`placeSide`, l.19-49).
  Spec : compétence data-driven `tactics` (rangs = profondeur de re-placement) ;
  phase pré-combat optionnelle (commande `PlaceStack` bornée) ; UI de placement
  tap-tap. Vérif : test moteur placement borné + smoke.

- **C-AIPARITY — Parité IA : sorts & attaque héroïque** 🧩 M ✅ (livré)
  Doc : doc 02 §5.5. Livré : `maybeHeroAction` (combat/ai) — le héros du camp
  IA lance un sort/round (priorité dégâts > soin si blessé > debuff/marques >
  buff, à mana suffisante) et frappe 1×/combat (cible maximisant pertes ×
  valeur), via les cœurs partagés `castHeroSpell`/`strikeWithHero` (les
  commandes joueur restent joueur-only). `heroCastThisRound` devient par-camp
  (save v22→23), l'auto-combat joue le héros des DEUX camps. Golden re-fixé
  (forme). `faction:sim` inchangé (armées sans héros).

- **C-HEROSPRITE — Présence visuelle du héros en combat** 🎨 S ✅ (livré)
  Doc : doc 08 §2.4. Livré : jeton de héros au flanc de la grille par camp
  (avatar `heroes/<faction>-<archétype>` en médaillon, repli disque au liseré
  du camp), ruée sur `SpellCast`/`HeroStruck` + retour visuel sur la cible
  (chiffres dégâts/soin réutilisés — le sort du héros n'avait aucun feedback
  canvas). Client pur (CombatScene), reduce-motion respecté.

### 2.2 Capacités d'unités spécifiées mais inertes (CAP-*)

Source design : **docs 03 §3, 04 §3, 05 §4, 16 §4** (tables de lineup) +
doc 02 §5.4 (catalogue). Constat transverse : le catalogue
`data/core/abilities.json` n'a que 9 capacités interprétées (`flying`,
`shooter[+noMeleePenalty]`, `noRetaliation`, `doubleAttack`, `undead`, `mark`,
`consumeMarks[+params]`, `demonform[+magicResistance]`, `symbiosis`). Le loader
refusant toute capacité hors catalogue, les lineups ont été **appauvris en
données** : les capacités doc ne sont même pas déclarées. Chaque item ci-dessous
= ouvrir UNE capacité **générique** au moteur + la déclarer dans les données des
unités concernées (zéro nom de faction dans le moteur, guidelines §8).

Familles, par mécanique moteur commune :

- **CAP-DEF — Défense/riposte** ✅ (A2a : `shieldWall`, `unlimitedRetaliation`,
  `magicResistance` autonome **livrés** ; A2b : `incorporeal` **livré** ;
  A2e : `taunt` **livré** — dernière capacité défensive) :
  `taunt` (Conscrit Haven, doc 03 §3) ✅,
  `shieldWall` (Frère-Lame, doc 03 §3), `unlimitedRetaliation` (Griffon,
  doc 03 §3), `incorporeal` 20 % esquive (Spectre, doc 04 §3),
  `magicResistance` autonome (Bibliothécaire AH 30 %, doc 05 §4 — n'existe
  qu'imbriqué dans `demonform`). Effort : M.
- **CAP-ATK — Attaque** ✅ (A2a : `charge`, `lifeDrain` **livrés** ; A2b :
  `strikeAndReturn` **livré** ; A2c : `curseOnHit` **livré** ; A3c : `areaAttack`
  **livré** ; A3d : `breathAttack` **livré** ; A2f : `poisonSting` **livré** ;
  A2g : `firstStrike` **livré** — priorité d'initiative à vitesse égale,
  interprétation cadrée) : `charge`/`firstStrike` (Chevalier du Griffon,
  doc 03 §3 ; Cavalier funeste +4 %/hex, doc 04 §3), `lifeDrain` 50 %
  (Vampire, doc 04 §3), `curseOnHit` (Zombie 20 %/Cavalier funeste 100 %,
  doc 04 §3), `poisonSting` (Manticore, doc 05 §4), `strikeAndReturn` (Lame du
  Serment, doc 05 §4), `areaAttack` (Liche nuage, doc 04 §3 ; cône Pénitent,
  doc 05 §4 ; réutilise `splash` de C7), `breathAttack` (Dragon d'os,
  doc 04 §3). Effort : L (découpable).
- **CAP-MORAL — Moral & auras** ✅ (A3a : `moraleImmune` (Ange), `aura`
  (Dragon d'os −1) **livrés** ; `fear` (Sombral Vox) **livré** — dernière pièce) :
  immunité au moral négatif (Ange, doc 03 §3), `aura` −1 moral aux vivants
  adverses (Dragon d'os, doc 04 §2/§3), **peur** (Sombral Vox, doc 16 §4).
  `fear` : frappe qui touche ⇒ chance de faire sauter le prochain tour de la
  cible (réutilise `immobilizedRounds`, événement `StackFeared`, pas de bump
  save, golden inchangé). Données : `t5-sombral` `fear(chance 0.2, rounds 1)`.
- **CAP-CAST — Lanceurs** 🧩 (A2h : `spellcaster` **livré engine-first**) :
  `spellcaster` générique (sorts embarqués ×N charges) — Prêtresse soin ×2 (doc
  03 §3) **livrée** ; Bibliothécaire Entrave/Silence ×2 (doc 05 §4), Maître de
  Sortilèges (doc 16 §4), Avatar barrière (doc 16 §4) = données à ajouter (moteur
  prêt). Réutilise le pipeline `CastSpell` via `applySpellToTargets` partagé.
  **Reste (suivi UI)** : bouton de lancer en combat pour une pile jouée à la main
  (A2h ne pilote que l'IA/auto-combat). Effort : M.
- **CAP-LIFE — Cycle de vie** 🧩 (A3b : `swarm` **livré** ; A2d : `devourMarks`
  **livré** ; `resurrectAlly`, renaissance → A3) : `resurrectAlly` 1× (Ange, doc 03 §3),
  renaissance (Phénix, doc 16 §4/§7), `swarm` (+dégâts ∝ effectif — Élève AH
  doc 05 §4, Chœur Vox doc 16 §4), `devourMarks` (Pénitent, doc 05 §4).
  Effort : M.
- **CAP-DATAFIX — Corrections de données pures** 🐞 S 🧩 (A1 : noMeleePenalty Chasseresse+Idole faits ; le reste — écarts Vit/stats — traité en DOC-STATS) (aucun moteur) :
  `noMeleePenalty` manquant sur Chasseresse AH (`data/factions/arcane-hunters/units/t6-chasseresse.json`,
  doc 05 §4) et sur l'Idole Vox (doc 16 §4) alors que le moteur le supporte
  (`state-helpers.ts:32`) ; capacités non prévues au doc sur l'Avatar Vox
  (`flying`+`noRetaliation` à réconcilier, doc 16 §4) ; écart Vit. 9/10 du
  Cavalier funeste (doc 04 §3 vs données) ; stats placeholder Vox divergentes
  (T2/T3/T4/T5/T7, doc 16 §4) — réconcilier données ↔ doc (ou doc ↔ `faction:sim`).

### 2.3 Systèmes de faction (F-*)

Source design : docs 03 §2/§4/§5, 04 §2/§4, 05 §3/§5/§6/§7, 14 §5/§6, 16 §3/§5.

- **F-BONUS — Bonus passifs de faction** 🧩 M (variante `combatBonus` **livrée**)
  Doc : Ferveur +1 moral / Formation +5 % déf (doc 03 §2), Fléau persistant
  +1 round de malédiction (doc 04 §2). **Livré** : variante générique
  `combatBonus` de `FactionBonus` (points plats `attack`/`defense`/`morale`),
  interprétée en combat par les helpers par-camp (`heroMoraleForSide`,
  `heroAttackOf`, `heroDefenseOf` via `factionCombatBonus`) — **pas de save bump**
  (le `factionCatalog` est déjà sérialisé). Haven doté (Ferveur `morale:1` +
  Formation `defense:2` ≈ +5 %). **Reste** : Fléau persistant Nécropolis
  (+1 round de malédiction — modificateur de statut, variante ultérieure) et le
  câblage des autres factions (données).

- **F-SKILLS — Compétences de faction** 🧩 M (mécanisme + Nécromancie **livrés**)
  Doc : Prière de bataille (doc 03 §2/§5), Nécromancie graduée Novice/Expert/
  Maître 10/15/20 % (doc 04 §2), Chasse rituelle (doc 05 §7), compétence Sylve
  (doc 14 §6). **Livré** : (1) pool gaté par faction — le loader estampille les
  `manifest.heroSkills` d'un `HeroSkillDef.factionId`, `eligibleSkills` ne les
  propose qu'aux héros de la faction ; (2) compétences **marqueur** (`external`)
  à payoff externe ; (3) **Nécromancie graduée** — `raiseUndeadOnVictory` gagne
  `scaleSkillId`/`percentByRank`, l'effet lit le rang (10/15/20 %). **Pas de save
  bump** (compétences dans `hero.skills`, `factionId` = catalogue). **Reste
  (données)** : Prière de bataille (`resurrectAlly`), Chasse rituelle, Sylve —
  moteur prêt, à câbler par faction ; Amplificateur (F-BUILDEFF).

- **F-BUILDEFF — Effets de bâtiment spéciaux** 🕳️ L 🚧 (**découpé en sous-lots**, décision utilisateur)
  Doc : Statue du Jugement/Cloître/Écuries (doc 03 §4), Amplificateur
  nécromantique/Croisée des âmes/Puits d'ombre (doc 04 §4), Grand Amphithéâtre/
  Salle des Reliques + passifs de Cercles (doc 05 §3.2/§5), La Scène/Sanctuaire
  du Honmoon (doc 16 §5), bâtiments de bonus au héros (doc 02 §4.1).
  - **F-BUILDEFF.1** ✅ (plan `f-buildeff-aura.md`) : effet générique `heroAura`
    (aura de présence au héros du propriétaire sur la ville, option B) + champ
    `movementBonusFlat` câblé dans `heroDailyMovement` ; **Écuries** Haven livré
    (doc 03 §4). Helper `townBuildingAura`, zéro faction, aucun bump de save,
    golden inchangé.
  - **F-BUILDEFF.2** ✅ (plan `f-buildeff-morale.md`) : champ d'aura
    `combatMoraleBonus` câblé dans `moraleOf` (camp défenseur d'un combat de
    ville, réutilise `townBuildingAura`) ; **Statue du Jugement** Haven livrée
    (+1 moral garnison en siège). Volet « héros visiteur défenseur » différé avec
    le modèle de héros défenseur en siège. Zéro faction, aucun bump, golden inchangé.
  - **F-BUILDEFF.3** ✅ (plan `f-buildeff-cloister.md`) : effet générique
    `grantSpell` (ajoute un sort au `spellPool` de la ville à la construction,
    réutilise l'apprentissage à la visite) + cross-validation du `spellId` au
    chargement ; **Cloître** Haven livré (enseigne Bénédiction). Volet « +2 mana/j »
    réconcilié (la mana se restaure entièrement chaque jour — no-op). Zéro faction,
    aucun bump, golden inchangé.
  - **F-BUILDEFF.4** ✅ (plan `f-buildeff-vigile.md`) : champ d'aura
    `garrisonDefense` câblé dans `wallDefenseBonus` (siège, via `townBuildingAura`,
    réutilise l'acquis F-HOUSES) ; **Cercle Vigile** AH livré (passif « +déf
    garnison », flat +3, remplace le placeholder or/j). Volet « +vision recrue »
    différé (M-TAVERN). Zéro faction, aucun bump, golden inchangé.
  - **F-BUILDEFF.5+** ⬜ : Cercles Traque (+vitesse recrue) / Sceau (−mana d'école)
    / Abîme (+dégâts T7-T8), modif ressource de faction, +XP/+rang, Grand
    Amphithéâtre/Salle des Reliques, La Scène/Sanctuaire Vox.

- **F-HOUSES — Effets de Maison Vox conformes** ✅ (plan `f-houses-vox.md`, doc 16 §État 16.7)
  `houseAllegiance` étendu de 2 champs **town-scoped** génériques
  (`garrisonGrowthPct`/`garrisonDefense`) interprétés par `townHouseField`
  (**option B** — la Maison du héros présent sur la tuile de la ville s'applique
  à cette ville) : `garrisonGrowthPct` dans `applyWeeklyGrowth`, `garrisonDefense`
  dans le mur de siège (`handleCaptureTown`). Données : `house-badger` conforme au
  doc (`{garrisonGrowthPct:20, garrisonDefense:2}`). **Toujours différés** (sans
  surface moteur, notés dans le doc) : +2 Att plate (Lion), accès malédictions
  (Serpent), +25 % mana max (Aigle), +50 % Résonance / Scène +1 Pouvoir (Venari).
  Zéro faction (garde-fou vert), aucun bump de sauvegarde, golden inchangé.

- **F-RESON — Résonance intra-combat & cap** 🧩 M 🚧 (**découpé en sous-lots**)
  Doc : doc 16 §3.2/§4 (performeurs génèrent en combat ; cap 999).
  - **F-RESON.1** ✅ (plan `f-reson-cap.md`) : **cap appliqué au gain** — le cap
    déclaré (`factionResources[].cap`) est estampillé par `buildFactionCatalog`
    sur le bonus `gainFactionResourceOnVictory` et plafonne le crédit post-victoire
    (`faction/effects.ts`, `max(current, min(next, cap))`). Cap optionnel ⇒ saves
    gracieuses ; zéro faction, golden inchangé, aucun bump de save.
  - **F-RESON.2** ⬜ : génération intra-combat par « performeur » (capacité
    générique de gain de ressource en combat) — nouvelle surface de combat.

- **F-SCHOOLS — Écoles de sorts propres incomplètes** 🧩 M 🚧 (**découpé en sous-lots**)
  Doc : Lumière (doc 03 §1/§3), Nécromancie/Prime (doc 04 §1), Traque 8 sorts
  (doc 05 §6), Scène (doc 16 §3.3).
  - **F-SCHOOLS.1** ✅ (plan `f-schools-lumiere.md`) : **École de la Lumière**
    (Haven) livrée en **pur contenu** (patron Scène/16.5) — `spellSchool:"lumiere"`
    + 4 sorts (damage/heal/buff) + `SPELL_SCHOOLS += lumiere` + locales. Zéro diff
    moteur, golden inchangé.
  - **F-SCHOOLS.2** ✅ (plan `f-schools-prime.md`) : **École Prime** (Necropolis)
    livrée en pur contenu (patron .1) — `spellSchool:"prime"` + 4 sorts
    (debuff/damage/buff) + `SPELL_SCHOOLS += prime` + locales. Zéro diff moteur,
    golden inchangé.
  - **F-SCHOOLS.3+** ⬜ : complétion Traque 8 sorts (doc 05 §6 — 6 sorts exigent
    de **nouvelles** mécaniques de combat : téléport, silence, bannissement,
    furtivité, noRetaliation conditionnel) ; effets Scène enrichis (peur/+moral,
    partagés CAP-MORAL).

- **F-ELITEVOX — Élites Vox Arcana** ✅ (plan `f-elitevox.md`, doc 16 §4)
  Pur contenu : 8 unités élites (`t*-*-elite`, stats ~1,25-1,3× base), 8 dwellings
  gradués `maxLevel:2` (niveau 2 = dwelling élite ⇒ upgrade base→élite générique
  4.11), manifest `units[]` + locales FR/EN. Zéro diff moteur, golden inchangé,
  aucun bump. (Drive-by : corrige l'erreur de typecheck latente de #248 —
  `stampedGain.cap` dans le test Résonance, cap loader-managed hors schéma.)

- **F-SYMBAI — La Symbiose pèse en simulation** 🧩 S ✅ (livré)
  Doc : doc 14 §9. Livré : une pile `symbiosis` sous son plafond qui n'a RIEN à
  frapper s'enracine (Défend) quand le combat vient à elle, même en étant la plus
  rapide de son camp (bornée par le plafond — pas de blocage mutuel). Variante
  agressive « défendre au lieu de bouger-frapper » testée en sim et REJETÉE
  (Sylvan agile-verre s'effondre à 1–10 % — donner la première frappe est
  suicidaire ; consigné dans `ai.ts` et `.claude/plans/f-symbai.md`).
  ⚠ Constat sim au passage (indépendant de ce lot) : 2 blowouts hors 20–80
  après la vague de capacités du jour — haven/necro 18,8 %, necro/vox 90 % —
  ✅ résorbés par la re-passe A10 (coûts de recrutement, plan
  `a10-rebalance-post-capacites.md` : 0 blowout, moyennes 46–55 %).

### 2.4 Héros (H-*)

Source design : doc 02 §1 (héros), docs de faction §5/§6/§7 (héros nommés).

- **H-NAMED — Système de héros nommés / identités / spécialités** 🧩 (tranches livrées ; reste M)
  > **H-NAMED.1 ✅** (plan `h-named-roster.md`) : **héros nommés jouables** — les
  > fiches d'identité `heroes/<id>.json` (couche 16.9, avatar/bio/origine) sont
  > **étendues** de champs gameplay OPTIONNELS (`attributes`/`specialtyEffect`/
  > `startingSkills`/`startingSpells`) ; `buildHeroRoster` ne retient que celles
  > portant `attributes` ; moteur `PlayerSetup.startingHeroId` + `StartGame.heroRoster`
  > (`ResolvedHeroDef`) résout nom/attributs/spécialité/départ à la création (patron
  > `houseCatalog`, champs de scénario prioritaires). Données : Haven Aldric + Séraphine
  > **jouables** (Vox reste identity-only). **Rework** de #253 (approche parallèle
  > `heroes.json` en collision avec 16.9). Zéro faction moteur, golden inchangé, aucun
  > bump save. **H-NAMED.2 ✅** (plan `h-named-2.md`) : **choix du héros de départ**
  > à « Nouvelle partie »/« Escarmouche » — `<select>` par siège humain (roster de
  > la faction) ⇒ `PlayerSetup.startingHeroId` ; défaut aléatoire **seedé**, unicité
  > de pool ; **zéro diff moteur** (pas de bump save). **Différés (H-NAMED.3+)** :
  > profil de gain par classe, spécialités conditionnelles (H-COND).
  > **Point d'extension ouvert (bornée)** : `HeroState.name` + `specialtyId` +
  > `specialtyEffects` (save v15) ; `PlayerSetup.startingName`/`startingSpecialtyId`
  > + `StartGame.specialtyCatalog` (miroir de `houseCatalog`). La **spécialité est
  > un profil déclaratif générique** (même vocabulaire que Maisons/compétences),
  > résolue à la création et agrégée dans `hero/skills.ts` (`sumHouseField`) — zéro
  > héros/faction en dur. Données : `config.newGame.startingHeroName` +
  > `startingHeroSpecialty` (héros de départ « Aldric l'Érudit », spécialité
  > *Arcaniste* = −20 % coût mana) ; UI : nom + spécialité dans le tiroir héros. **Différés**
  > (le vrai L) : roster de héros nommés par faction (`heroes.json`), pool/taverne
  > (M-TAVERN), spécialités conditionnelles (ex. « +vitesse aux Griffons »), bio.
  Doc : doc 02 §1.1/§1.2 ; Aldric/Séraphine (doc 03 §5), Vhalen/Mère Corbeau
  (doc 04 §5), Evadne/Alwin (doc 05 §7), Faelar/Sylwen (doc 14 §5),
  Hermione/Rumi (doc 16 §6). Code : zéro occurrence (`HeroState` sans
  name/specialty/bio, `packages/engine/src/core/state.ts:65-95`) ; profil
  d'attributs global unique (`data/core/config.json:28`). Spec : schéma
  `heroes.json` par faction (id, classe might/magic, profil d'attributs,
  spécialité déclarative, compétences/sorts de départ, bio `@loc:`), pool de
  héros au `StartGame`/taverne, spécialités = effets déclaratifs génériques
  (réutilise F-SKILLS/CAP). Point d'extension attendu par les 5 docs ; débloque
  M-TAVERN et N-ARCS.

- **H-SPELLS — Contenu de sorts : aventure, cercles 4-5, iconiques** 🧩 M ⬜
  Doc : doc 02 §1.4/§1.5. Code : un seul sort d'aventure (`AdventureEffect` =
  union à 1 variante `townPortal`, `packages/engine/src/hero/types.ts:25`) ;
  aucun sort de cercle 4-5 (⇒ Sagesse livrée mais inerte) ; le soin ne
  ressuscite pas ; pas d'invocation, de masse/chaîne, de dissipation réelle.
  Spec : nouveaux `AdventureEffect` (vision, rappel…), sorts c4-5, effets
  combat additionnels (résurrection de pile, invocation, masse = tous alliés/
  ennemis, chaîne ; étend `splash` livré). Débloque la valeur de C-SPELLUI.

- **H-ARTEQUIP — Artefacts équipables + effets spéciaux + sets** 🧩/🎨 M ⬜
  Doc : doc 02 §1.1 (10 slots), doc 08 §2.3 (poupée interactive). Code :
  `heroArtifactBonus` somme 7 stats (`packages/engine/src/hero/artifacts.ts:21-47`) ;
  aucune commande Equip/Unequip (`core/commands.ts`) ; poupée UI en lecture
  seule (`packages/client/src/ui/HeroInventory.tsx:41-99`). Spec : commandes
  `EquipArtifact`/`UnequipArtifact` (validation slot), slots typés, effets
  spéciaux déclaratifs (immunités, +sorts…), sets à seuils ; UI tap-tap
  (touch-first, pas de drag obligatoire). Save bump probable.

- **H-LEVELCHOICE — Choix d'attribut à la montée de niveau** 🎨 S ✅
  > **Livré** : le joueur **humain** choisit +1 attribut parmi 2 propositions à
  > chaque montée (`HeroState.pendingAttributeChoices` = **file**, pas écrasement ;
  > save v17), via la commande `ChooseAttribute` + modale `AttributeChoice`
  > (miroir de `SkillChoice`). L'**IA** garde le tirage auto pondéré (zéro
  > régression de puissance). `HeroLevelUp.attribute` devient optionnel (présent
  > côté IA) ; nouvel événement `HeroAttributeChosen`. Couvert en unitaire
  > (`hero-level-up.test.ts` : file humaine, auto IA, ChooseAttribute + rejets) ;
  > golden re-fixé (879c3291, forme seule). Flux modal non déclenchable en smoke
  > (XP de niveau trop élevée) — gating d'absence vérifié.
  Doc : doc 02 §1.2. Code (avant) : `rollAttribute` auto au RNG pondéré.

### 2.5 Carte d'aventure (M-*)

Source design : doc 02 §2 (carte), §1.5 (multi-héros).

- **M-TAVERN — Multi-héros & recrutement en taverne** 🕳️ L 🚧 (**découpé en sous-lots**)
  Doc : doc 02 §1.5 (jusqu'à 8 héros, échanges, héros vaincu re-recrutable), §4.1 (Taverne).
  - **M-TAVERN.1** ✅ (plan `m-tavern-recruit.md`) : **recrutement moteur** — effet
    de bâtiment `tavern` (Taverne core) ; `GameState.heroRoster` persisté (save
    **23→24**) ; commande `RecruitHero` (joueur actif, ville possédée + Taverne, or
    ≥ `config.hero.recruitCost` 2500, cap `maxPerPlayer` 8, héros du roster de la
    faction de la ville, pas déjà recruté) crée le héros nommé (identité H-NAMED,
    armée vide) à la ville ; client embarque le roster à `StartGame`. Zéro faction
    moteur, golden re-fixé (forme). **Livrés depuis** : câblage client
    (M-TAVERN.2), échanges d'armée/artefacts (UX-HEROSWAP ✅), **combat
    héros-vs-héros** (H-VS-H ✅ — `beginHeroCombat`, `defenderHeroId` non-null, le
    perdant meurt + dépouille d'artefacts au vainqueur, plan `h-vs-h.md`).
  - **M-TAVERN.4** ✅ (plan `m-tavern-4.md`) : **pool exclusif inter-joueurs**
    (`HeroState.rosterId`, save **25→26** ; `validateRecruitHero` refuse un héros
    déjà vivant ; un héros mort le libère) + **IA recruteuse** (`town-ai.ts` :
    riche + sous le cap ⇒ recrute à la Taverne) ; client « Indisponible ».
    Golden re-fixé (forme). **Différé** : choix du héros de départ (H-NAMED.2).

- **M-GUARDLINK — Gardiens attachés aux trésors** 🕳️ 🧩 (tranche livrée)
  > **Livré** : champ **optionnel** `guardedBy` (id de gardien) sur les objets
  > `resource`/`treasure`/`artifact` (`map.ts`) ; le ramassage est **inerte tant
  > que la sentinelle liée existe** sur la carte (`movement.ts`), impossible de la
  > contourner ; sentinelle vaincue ⇒ objet libéré. Schéma + résolution
  > (`schemas.ts`/`loader.ts`) + **validation croisée** (`guardedBy` doit désigner
  > un gardien de la carte). Données : proto-01 `gold-2` gardé par `guard-gold`
  > (adjacents). Champ optionnel ⇒ **pas de bump save, golden inchangé**. Couvert
  > en unitaire (`map-objects.test.ts` : gardé ⇒ non ramassé ; sentinelle absente
  > ⇒ ramassé). **Différé** : liaison automatique sentinelle↔trésor dans
  > `generateMap` (cartes procédurales) — actuellement data-driven sur cartes
  > éditées.

- **M-NAV — Navigation & topologie : bateaux, téléporteurs, souterrain** 🕳️ L 🧩 (a livré)
  > **(a) monolithes appariés — LIVRÉ** : objet `monolith` + `pairId` (union
  > `MapObjectDef`) ; fouler l'un téléporte vers son jumeau et interrompt le
  > déplacement (pas de boucle) ; validation « exactement 2 par pairId » ; rendu
  > (portail de pierres) + fiche + toast ; data proto-01 (`monolith-a/b`).
  > Additif ⇒ **pas de bump save, golden inchangé**. Couvert en unitaire
  > (`map-objects.test.ts` : téléport + pas de boucle).
  Doc : doc 02 §2.1/§2.2. **Différés** : (b) bateaux + chantier naval + combat
  d'abordage (L), (c) souterrain = 2ᵉ niveau + escaliers (L, save bump).

- **M-VISIT — Objets visitables riches** 🧩 (tranche livrée)
  > **Livré** : nouveau `VisitableEffect` **générique** `permanentStat`
  > (`{attribute, amount}`) — **arène/statue** accordant un bonus d'**attribut
  > primaire DÉFINITIF** au héros visiteur (`visitable.ts`), borné par le registre
  > de visites existant (`oncePerHero` = à vie). Schéma + loader + client
  > (`MapObjectCard`, toast) + locales FR/EN + data proto-01 `arene-1` (attack+1).
  > Variant optionnel ⇒ **pas de bump save, golden inchangé**. Couvert en unitaire
  > (`map-visitables.test.ts` : gain permanent + unicité par héros). **Différé** :
  > sanctuaire de **sort** (apprend un sort) et cabane de **compétence** —
  > nécessitent d'ouvrir l'octroi de sort/compétence hors montée (croise H-SPELLS).
  Doc : doc 02 §2.2. Code (avant) : 5 kinds seulement.

- **M-DWELLOWN — Habitations de carte capturables** 🕳️ S ✅
  > **Livré** : `DwellingObjectDef.ownerId` (save v18). La fouler la **capture**
  > (drapeau du joueur + `revealStructure` comme une mine, `movement.ts`) ; le
  > **réassort hebdo est réservé au propriétaire** (`applyWeeklyGrowth` gardé sur
  > `ownerId`) — une habitation neutre garde son stock initial. Client : fanion
  > propriétaire sur le camp (`ownerFlag` partagé mine/habitation, signature de
  > recapture). Golden re-fixé 6fa5044c (forme). Tests moteur (capture, croissance
  > neutre vs possédée) + smoke (drapeau du joueur après visite).
  Doc : doc 02 §2.2.

- **M-CALENDAR — Mois & événements de calendrier** 🧩 S ✅ (livré)
  Spec : mois = 4 semaines, événements type « semaine de la peste » déclaratifs.
  Livré : `config.calendar.events` (table pondérée déclarative), tirage RNG seedé
  hebdo `rollWeekEvent`, `growthFactor` module `applyWeeklyGrowth`,
  `Calendar.weekEventId` (save v20), `monthOf`, event `CalendarEventStarted`,
  toast client des semaines spéciales. Différés : mois persistants, semaine
  ciblant une créature, calendrier persistant à l'écran.

### 2.6 Villes & économie (T-*)

Source design : doc 02 §3/§4.

- **T-CARAVAN — Caravanes / transfert inter-villes** 🧩 M ✅ (livré)
  Doc : doc 02 §4.1. Code : `GarrisonTransfer` exige héros et ville sur la même
  tuile (`packages/engine/src/town/transfer.ts:21`). Spec : commande
  `SendCaravan` (unités, trajet en jours via A* existant, arrivée en garnison).
  Livré : `SendCaravan { fromTownId, toTownId, slot }`, `GameState.caravans`
  (save v21), `tickCaravans` au `DayStarted`, events `CaravanSent`/`Arrived`/
  `Lost`, UI onglet Garnison (bouton + destination + bandeau en route), locales.
  **Décision design : non interceptable** (convention HoMM3). Différés :
  interception, caravanes de héros (multi-héros non livré), annulation en route.

- **T-GRAIL — Graal & obélisques** 🕳️ L ⬜ (post-MVP assumé doc 02 §2.2/§4.1)
  Code : zéro occurrence. Spec : obélisques (visitables révélant une carte au
  trésor), fouille, bâtiment Graal à effet majeur par faction (données).

- **T-GROWTHUI — Affichage croissance base/accumulée** 🎨 S ✅ (livré)
  Doc : doc 02 §4.1. Livré : helper pur `weeklyGrowthOf` (moteur, partagé avec
  `applyWeeklyGrowth` — bonus Fort + facteur calendrier + plafond 2×) ; l'onglet
  Recruter affiche « +X/sem · max Y » par habitation (`town-growth-<unitId>`).

- **T-MARKETRATE — Taux de marché dégressif + troc** 🧩 S ✅ (livré)
  Code : taux plats (`data/core/config.json`), troc ressource↔ressource rejeté.
  Spec : taux fonction du nombre de marchés possédés ; troc direct. Livré :
  `effectiveMarketRates`/`ownedMarketCount` (moteur), `tradeQuote` gère le troc
  (équivalence or, facteur²) + taux dégressif `factor = min(maxMarketFactor, 1 +
  perMarketBonus × (nbMarchés − 1))` ; config `perMarketBonus`/`maxMarketFactor`
  **optionnels** (absents ⇒ plat) ; UI 3ᵉ mode Troc + « Marchés possédés : N ».
  Pas de bump save, golden inchangé. Différés : courbe HoMM3 exacte, troc pénalisé.

### 2.7 En ligne / backend (NET-*)

Source design : **doc 15** (architecture réelle), doc 07 §5 (partiellement
périmé — voir DOC-07), doc 01 §2-3 & doc 09 Phase 3 (promesse produit).
Constat global : Worker déployé, 8 endpoints, re-simulation anti-triche
testée ; **le client n'appelle que l'auth** (`packages/client/src/ui/OnlinePanel.tsx`,
SDK `packages/client/src/app/net.ts` sans autre appelant).

- **NET-MATCHDETAIL — Endpoint détail de partie** 🕳️ S ⬜ **bloquant PvP**
  Doc : doc 15 §5.3 (le client rejoue `base + batch`). Code : pas de
  `GET /matches/:id` (`server/src/worker.ts`) ni de `getMatch` SDK ⇒ impossible
  de récupérer seed/setup/sièges pour reconstruire l'état. Spec : endpoint +
  SDK renvoyant `{ seed, setup, players, status, seq }`.

- **NET-PVPUI — Écrans PvP asynchrones jouables** 🕳️ L ⬜
  Doc : doc 01 §3 (PvP async = Beta), doc 09 Phase 3 (jalon « PvP asynchrone
  stable »), doc 15 §5.3/§9, doc 08 §2.5. Code : `createMatch`/`joinMatch`/
  `listMatches`/`getMoves`/`postMove` = code mort côté UI. Spec : lobby
  (créer/lister/rejoindre), boucle de tour (rejouer le journal via
  `engine/net`, jouer son tour hors-ligne, `postMove`), polling « c'est ton
  tour » (doc 15 §5.3.4), reprise/refresh. Dépend de NET-MATCHDETAIL.

- **NET-CLOUDSAVES — Cloud saves câblées** 🕳️ M ⬜
  Doc : doc 15 §5.2, doc 09 Phase 3. Code : `putSave`/`getSave` SDK sans
  appelant ; aucune UI. Spec : section « En ligne » des sauvegardes (liste de
  slots, upload/download, horodatage), garde de version client déjà en place.

- **NET-SRVGUARD — Garde de version & conflits côté serveur** 🧩 S ⬜
  Doc : doc 15 §5.2 (« save d'une autre version rejeté »), doc 07 §4 (« le plus
  récent gagne + copie de sécurité »). Code : `PUT /saves` accepte tout
  `save_version` (`worker.ts:127-136`), upsert sans copie. Spec : rejet si
  version ≠ `CURRENT_SAVE_VERSION` attendue, colonne/slot d'historique N-1.

- **NET-SEC — Durcissement : rate limit, quotas, validation, revoke** 🧩 M ⬜
  Doc : doc 15 §2/§8, doc 07 §5 (anti-triche). Code : `/auth/request` sans
  throttling (`worker.ts:82-93`), collision de `handle` non gérée (l.108-109 ⇒
  500 sur contrainte UNIQUE), aucun bornage de taille de body ni quota de
  slots, `logout()` purement local (`net.ts:32-38`, pas de `DELETE /session`),
  CORS `*` si `APP_ORIGIN` absent (l.35). Spec : rate limit par e-mail/IP,
  désambiguïsation de handle, limites taille/quantité, endpoint de révocation +
  purge des sessions expirées.

- **NET-FOG — Information cachée : `stateView(playerId)`** 🕳️ L ⬜
  Doc : doc 07 §5 (« brouillard calculé serveur, seule la vue du joueur est
  envoyée »). Code : `GET …/moves` renvoie le journal complet à tout
  participant (`worker.ts:191-197`) ⇒ un joueur peut re-simuler et voir tout.
  Spec : décision design — accepter (async entre amis) ou implémenter une vue
  filtrée par re-simulation serveur. Coûteux ; à cadrer avant Beta compétitive.

- **NET-LIFECYCLE — Forfait / timeout de tour** 🕳️ S ⬜
  Doc : implicite au jalon « PvP stable » (doc 09 Phase 3). Code : statuts
  open/active/finished seulement (`worker.ts:218-220`). Spec : abandon
  volontaire, expiration d'inactivité, statut `abandoned`.

- **NET-RANKED — Classements / saisons** 🕳️ L ⬜
  Doc : doc 01 §2 (core loop « classements », macro-loop « saisons PvP »),
  doc 09 Phase 3 (« classement saisonnier expérimental »). Code : aucune table
  ni endpoint (`server/schema.sql`). Spec : rating simple (Elo/Glicko light),
  table `ratings`, saison = fenêtre datée, écran classement. Après NET-PVPUI.

- **NET-EMAIL — Envoi réel des magic-links (Resend)** 🧩 S ⬜ (différé assumé doc 15 §10.6)
  Code : `verifyLink` renvoyé en clair (`worker.ts:89-92`).

- **NET-MATCHMAKING — Appariement automatique** 🕳️ M ⬜ (promesse faible ;
  après NET-RANKED). Code : listing + join manuel seulement (`worker.ts:147-184`).

### 2.8 Narratif & scénarios (N-*)

Source design : **doc 13** (N1→N4 livrés), docs de faction §lore.

- **N-ARCS — 5 arcs personnels de héros sur 6** 🧩 M ⬜
  Doc : doc 13 §5.4 (6 arcs, 2/faction, 3 étapes : Aldric ✅, Séraphine,
  Vhalen, Mère Corbeau, Evadne, Marchmont). Code : une seule quête
  `kind:"personal"` (`data/scenarios/haven-ch2.scenario.json:110`). Spec :
  données pures (quêtes + dialogues), zéro moteur. Synergie avec H-NAMED
  (les arcs prennent du sens quand les héros ont une identité).

- **N-DAILYREFRESH — Rafraîchissement quotidien des journalières** 🧩 S ⬜
  Doc : doc 13 §4.2/§5.2 (esprit « contrats » rejouables) ; limitation notée
  doc 09 (« nécessiterait une commande `AddQuests` »). Code : gabarits
  instanciés une fois au `StartGame` (`packages/client/src/app/daily.ts`).
  Spec : commande générique `AddQuests` au `DayStarted`.

- **N-CAMPAIGNS2 — Campagnes Sylvan Court & Vox Arcana** 🕳️ L ⬜ (conforme au
  design : doc 13 §8.1 autorise une sortie sans campagne)
  Code : pas de dossier `story/` dans `data/factions/{sylvan-court,vox-arcana}/`.
  Spec : données pures via le pipeline N3a (4ᵉ/5ᵉ test de modularité narratif).

- **N-BRIEFING — Fiche de scénario avant lancement** 🕳️ S ✅ (livré)
  Doc : doc 08 §2.5 (« fiche de scénario (objectifs) »). Livré : modale
  `BriefingScreen` (kind `briefing` de la pile, doc 08 §3) interposée entre le
  clic sur un scénario/événement du menu et `heroes:start-scenario` — affiche
  **faction** jouée, **objectif de victoire** + **condition de défaite**
  (libellés génériques, `surviveDays` interpolé), **nombre d'adversaires**, lus
  du `Scenario` en store (zéro faction/scénario en dur). Boutons Commencer /
  Retour. **Client pur** (zéro moteur/save/golden). Locales FR/EN `briefing.*`,
  CSS `briefing.css` (tokens). Les chapitres de campagne (intro `openingDialog`)
  ne passent pas par la fiche. Plan `.claude/plans/n-briefing.md`.

### 2.9 UI/UX client (UX-*)

Source design : **doc 08**. (Livrés vérifiés : mini-carte, file d'initiative,
préviz dégâts, raccourcis, a11y 3 crans, audio complet, chrome UI, options.)

- **UX-HEROSWAP — Écran de transfert héros↔héros** 🕳️ M ✅
  > **Livré** (plan `ux-heroswap.md`) : commande moteur GÉNÉRIQUE
  > `TransferBetweenHeroes` (`kind: 'army' | 'artifact'`, une entité par
  > commande, adjacence 8 dir, joueur actif ; fusion des piles de même unité,
  > cap 7, artefact vers 1er slot libre) — purement déterministe, **aucun champ
  > d'état nouveau ⇒ pas de bump save, golden inchangé**. Client : bouton
  > « Échanger avec {nom} » dans le tiroir héros dès qu'un allié est adjacent →
  > écran `HeroSwap` double-colonne tap-tap + « Tout donner ». Locales FR/EN,
  > smoke étendu (recrutement d'un 2ᵉ héros à la Taverne du start-town ⇒
  > transfert). **Différé** : « Équilibrer » (split de pile) = UX-SPLIT.
  Doc : doc 08 §2.3 (double-colonne, tap-tap, « équilibrer »/« tout donner »).

- **UX-SPLIT — Split de piles** 🕳️ M ⬜
  Doc : doc 08 §2.1/§2.3 (armée 7 slots gérable). Code : `ArmySlots` lecture
  seule (`packages/client/src/shell.tsx:344-360`) ; garnison ne déplace que des
  piles entières (`TownScreen.tsx:682-731`). Spec : commande moteur
  `SplitStack` + UI curseur de répartition (touch-first).

- **UX-REORDER — Réorganisation des 7 slots** 🕳️ S ✅ (livré)
  Doc : doc 08 §2.1/§2.3. Livré : commande moteur générique `ReorderArmy
  { heroId, from, to }` (déplace une pile dans `hero.army` ; validée : héros du
  joueur actif, indices bornés, hors combat/partie finie) + UI **tap-tap**
  (bouton « Réorganiser » tiroir héros + bandeau ; 1er tap sélectionne, 2ᵉ
  déplace ; liseré 2ᵉ canal). L'ordre pèse sur le placement de combat. **Pas de
  bump save** (`army` déjà sérialisé), **golden inchangé** (commande absente du
  replay). Zéro faction. Tests moteur `army-reorder.test.ts` + smoke. Plan
  `.claude/plans/ux-reorder.md`.

- **UX-COMBATLOG — Journal de combat** 🎨 S ✅ (livré)
  Doc : doc 08 §2.4 (lisibilité d'état). Spec : log déroulant des actions/dégâts
  du combat courant (consomme les événements moteur déjà émis). Livré :
  `app/combat-log.ts` (listener global → `store.combatLog`, résout id de pile →
  nom d'unité, remis à zéro à `CombatStarted`, borne 80 lignes) + composant
  `CombatLog` (panneau déroulant basculé par le bouton « Journal » en combat).
  **Client pur** (zéro moteur/save/golden). Traduit round/attaque/riposte/
  esquive/mort/soin/poison/sort/moral/peur/immobilisation/fin.

- **UX-ENDSTATS — Stats détaillées de fin de partie** 🧩 S ✅ (livré)
  Note U6b doc 08 §2.5. Code : graphique de puissance livré (`OutcomeOverlay.tsx`).
  Livré : récapitulatif `StatsSummary` (durée `Jour N · Semaine W`, villes possédées,
  héros + niveau max, unités en armée) lu directement de l'état final. **Client pur**
  (aucun suivi moteur). **Pertes cumulées différées** : nécessitent un suivi côté
  moteur pour être exactes en multi-joueurs/IA (les événements `CombatEnded` ne
  portent pas le joueur).

- **UX-RAIL — Rail droit desktop complet & « +X/j » inline** 🧩 S ✅ (livré, arbitré)
  Doc : doc 08 §2.1 (note M6). Livré : revenu quotidien projeté « +N » inline à
  côté de chaque stock dans `ResourceBar` (helper moteur `dailyIncome`, partagé
  avec `ResourceDetail`), visible desktop, masqué en portrait compact (le détail
  reste au tap). Arbitrage UXD-8 tranché : PAS de rail droit ressources séparé —
  le rail droit desktop porte déjà héros/mini-carte, y dédoubler les ressources
  serait redondant ; l'inline suffit. Villes : restent dans `TurnBar` (inchangé).

- **UX-TOWNVIEW — Vraie vue de ville peinte** 🧩 L ⬜
  Doc : doc 08 §2.2/§5 + CLAUDE.md (« vue de ville peinte + assets finaux =
  Beta »). Code : bande horizontale de vignettes sur fond peint
  (`TownScreen.tsx:247-294`), pas de scène composée où les bâtiments
  construits apparaissent à leur emplacement. Dépend d'assets (AS-TOWNBG).

### 2.10 Assets (AS-*)

Source design : **doc 12** (règles A-D, §10 intégration). Pipeline
d'intégration livré (registre auto-découvert + repli procédural) — les manques
sont du **contenu**.

- **AS-SYLVAN — Jeu d'assets Sylvan Court complet** 🕳️ M ⬜ **le plus visible**
  Doc : doc 12 §2-§5, doc 14. Code/staging : seuls `assets/map/hero-sylvan-court.png`
  et `town-sylvan-court.png` existent ; 0 sprite d'unité (`assets/units/`),
  0 avatar, 0 fond de ville, 0 vignette de bâtiment ⇒ tout en repli procédural.
  Production via skills `asset-sheet` (planches unités/avatars/bâtiments).

- **AS-COMBATBG — Toiles de combat par terrain (9 manquantes/11)** 🧩 S ⬜
  Doc : doc 12 §5 règle D. Code : résolveur câblé, seuls `combat-grass.jpg` et
  `combat-swamp.jpg` existent (`assets/backgrounds/`). Manquent : dirt, sand,
  forest, rough, snow, river, water, mountain, rocks.

- **AS-BUILDINGS — Vignettes core manquantes** 🧩 S ⬜
  Doc : doc 12 règle C (+ suivi C22). Code : 6 vignettes core seulement ;
  manquent « Habitation : Recrue », « Tableau des Contrats », et tout
  sylvan-court (cf. AS-SYLVAN).

- **AS-TOWNBG — Décors de ville composables** 🕳️ M ⬜ (pré-requis UX-TOWNVIEW)
  Spec : fonds + slots d'emplacements par faction (doc 08 §2.2, doc 12 §5).

- **AS-OVERLAYS — Habillage chargement/cutscenes** 🕳️ S ⬜ (hors promesse
  doc 12 — optionnel). Code : `LoadingOverlay.tsx`/`CutsceneOverlay.tsx` en CSS pur.

### 2.11 Hygiène documentaire (DOC-*)

- **DOC-07 — doc 07 §5 périmé** 📄 S ✅ (A1) : décrit Node/Fastify/WebSocket/
  PostgreSQL/Redis/OAuth ; la réalité est Workers+D1+polling (doc 15). Ajouter
  la note « superseded by doc 15 » et réaligner §4 (« copie de sécurité »).
- **DOC-SKILLS — doc 02 §1.3 note R5** 📄 S ✅ (A1) : annonce un pool de 12 sans
  Sagesse ; `data/core/skills.json` en a 13 dont `wisdom` (livrée depuis).
- **DOC-AUDIO — doc 12 §6bis/§6ter** 📄 S ✅ (A1) : situe le registre audio en
  `render/audio.ts` ; le code réel est `app/audio.ts`.
- **DOC-STATS — tables de stats divergentes** 📄 S ✅ (A1) : Cavalier funeste
  Vit. 9 (doc 04 §3) vs 10 (données) ; stats placeholder Vox (doc 16 §4) vs
  données équilibrées — répercuter les choix `faction:sim` dans les docs
  (croise CAP-DATAFIX : trancher qui, du doc ou des données, fait foi par cas).

---

## 3. Hors périmètre — à NE PAS traiter comme manque

Confirmé par les docs eux-mêmes :

- **MMO temps réel, PvP à timer temps réel** — doc 01 §3 « Post-Beta », CLAUDE.md.
- **Monétisation / premium / pay-to-win** — interdits doc 01 §4.
- **Cinématiques vidéo** — refusées doc 13 §2/§6.3 (cutscenes caméra livrées).
- **Replays joueur, mode spectateur, achievements, onboarding first-run** —
  jamais promis par les docs 01/09/13 (le levier déterministe rendrait les
  replays peu coûteux ; à proposer comme évolution de design, pas comme dette).
- **Audio/musique** — LIVRÉ complet (`packages/client/src/app/audio.ts`,
  plans ux-d6*) ; ne pas re-planifier.
- **Éditeur de carte** — livré volontairement minimal (doc 09 Alpha) ;
  gardiens/triggers/routes/rendu Pixi = « raffinement ultérieur » assumé
  (repris en E9 comme option).

---

## 4. Plan d'exécution ordonné

Principes d'ordonnancement : (1) bugs de règles d'abord ; (2) ensuite les
**points d'extension moteur génériques** qui débloquent le plus de contenu en
données pures (capacités, effets de bâtiment/faction) — c'est la logique de
modularité doc 06 ; (3) les gros systèmes joueur (héros nommés, multi-héros) ;
(4) le pilier en ligne (jalon Beta) en piste **parallèle** car il ne touche
presque pas le moteur ; (5) contenu narratif et assets en continu (pistes
indépendantes). Chaque lot = plan vivant `.claude/plans/` + PR atomique +
vérifs guidelines (§4/§5/§7 : typecheck, lint, tests, golden re-fixé si
moteur, garde-fou « zéro faction », budget bundle, smoke).

### Piste A — Moteur & données (séquentielle)

| # | Lot | Contenu | Effort | Débloque |
|---|-----|---------|--------|----------|
| A1 | **Correctifs de règles & données** | C-LOS, C-BADLUCK, CAP-DATAFIX, DOC-* (les 4) | ~1 sem | fiabilité combat ; docs saines |
| A2 | **Capacités génériques — vague 1** | CAP-DEF + CAP-ATK (mêlée : charge/firstStrike/lifeDrain/curseOnHit/strikeAndReturn/poisonSting) | ~1,5 sem | fidélité lineups 03/04/05 |
| A3 | **Capacités génériques — vague 2** | CAP-ATK (zone : areaAttack/breathAttack), CAP-MORAL, CAP-CAST, CAP-LIFE | ~2 sem | Ange/Phénix/peur ; F-SCHOOLS (effets peur/moral) |
| A4 | **Systèmes de faction** | F-BONUS, F-SKILLS (dont Nécromancie graduée), F-BUILDEFF, puis données : bâtiments spéciaux 4 factions, F-HOUSES, F-RESON, F-SCHOOLS (contenu), F-ELITEVOX | ~2,5 sem | docs 03→16 §2/§4/§5 tenus |
| A5 | **Héros nommés & spécialités** | H-NAMED (+ profils de classe par faction) | ~1,5 sem | M-TAVERN, N-ARCS, docs §5/§6/§7 |
| A6 | **Multi-héros & taverne** | M-TAVERN (RecruitHero, héros-vs-héros), UX-HEROSWAP | ~2 sem | doc 02 §1.5 complet |
| A7 | **Sorts & artefacts** | H-SPELLS (aventure, c4-5, résurrection, masse), H-ARTEQUIP, H-LEVELCHOICE, C-SPELLUI | ~2 sem | Sagesse utile, grimoire doc 08 §2.3 |
| A8 | **Carte d'aventure riche** | M-GUARDLINK, M-VISIT, M-DWELLOWN, M-CALENDAR, puis M-NAV (monolithes → bateaux → souterrain) | ~3 sem | doc 02 §2 complet |
| A9 | **Villes & économie** | C-SIEGE2, T-CARAVAN, T-MARKETRATE, T-GROWTHUI, T-GRAIL | ~3 sem | doc 02 §3/§4 complet |
| A10 | **IA & équilibrage** | ~~C-AIPARITY~~ ✅, ~~F-SYMBAI~~ ✅, ~~C-TACTICS~~ ✅, ~~re-passe `faction:sim` post-capacités~~ ✅ (coûts, plan `a10-rebalance-post-capacites.md`) | ~1,5 sem | signatures « pèsent » en sim |

Ordre A2→A4 justifié : chaque capacité/effet ouvert est immédiatement exercé
par les données des 5 factions (test de modularité continu), et A4 dépend de
briques d'A3 (peur/moral pour écoles et Maisons). A5 avant A6 (la taverne
recrute dans le pool de héros nommés). A10 après A2-A4 (l'IA doit connaître
les nouvelles capacités pour être re-équilibrée).

### Piste B — En ligne (parallèle à A ; quasi zéro moteur)

| # | Lot | Contenu | Effort |
|---|-----|---------|--------|
| B1 | **Fondations serveur** | NET-MATCHDETAIL (bloquant), NET-SRVGUARD, NET-SEC | ~1 sem |
| B2 | **Cloud saves jouables** | NET-CLOUDSAVES (+ NET-EMAIL si secret Resend fourni) | ~0,5 sem |
| B3 | **PvP async jouable** | NET-PVPUI (lobby, boucle de tour, polling), NET-LIFECYCLE | ~2 sem |
| B4 | **Compétitif** | NET-RANKED, puis NET-MATCHMAKING ; cadrage NET-FOG (décision design avant toute beta compétitive) | ~2 sem |

B1 avant tout (sans détail de match, aucun client PvP possible). NET-FOG est
le seul item nécessitant un vrai cadrage design/coût — à trancher avant B4.

### Piste C — Contenu narratif & UX (parallèle, données/client purs)

| # | Lot | Contenu | Effort |
|---|-----|---------|--------|
| C1 | **Confort d'armée** | UX-SPLIT, UX-REORDER, UX-COMBATLOG, N-BRIEFING | ~1 sem |
| C2 | **Arcs & journalières** | N-ARCS (5 arcs — idéalement après A5 pour l'identité), N-DAILYREFRESH | ~1 sem |
| C3 | **Finitions UX** | UX-ENDSTATS, UX-RAIL (ou amendement doc), C-HEROSPRITE, H-LEVELCHOICE si pas fait en A7 | ~1 sem |
| C4 | **Campagnes Sylvan & Vox** | N-CAMPAIGNS2 (optionnel — conforme au design de sortir sans) | ~2 sem |

### Piste D — Assets (continu, via skills asset-*)

| # | Lot | Contenu |
|---|-----|---------|
| D1 | AS-SYLVAN (unités, avatars, ville, bâtiments — le trou le plus visible) |
| D2 | AS-COMBATBG (9 toiles), AS-BUILDINGS (vignettes core) |
| D3 | AS-TOWNBG puis UX-TOWNVIEW (la « vue de ville peinte » du jalon Beta) |
| D4 | AS-OVERLAYS (optionnel) |

### Décisions design à trancher AVANT leur lot (cadrage utilisateur)

1. **C-LOS** : LoS stricte (HO) vs pas de LoS (HoMM3) — avant A1.
2. **H-LEVELCHOICE** : choix joueur vs tirage — avant A7.
3. **F-HOUSES** : ✅ tranché — **étendre le moteur** (effets town-scoped, option B = « le héros apporte sa Maison à la ville où il se tient »), livré (plan `f-houses-vox.md`).
4. **DOC-STATS / CAP-DATAFIX** : qui fait foi, docs ou données `faction:sim`, par cas — avant A1.
5. **NET-FOG** : accepter l'info ouverte en async vs `stateView` serveur — avant B4.
6. **T-CARAVAN** : caravanes interceptables ou non — avant A9.
7. **M-NAV** : périmètre naval (combat d'abordage ?) — avant A8.

---

## 5. Critères de vérification transverses (rappel guidelines)

Chaque PR de chaque lot : typecheck 5/5, lint, tests moteur/contenu (+ cas du
lot dans le même commit), golden replay re-fixé **uniquement** si la forme
change (et une seule fois par lot), garde-fou « zéro faction dans le moteur »,
`content:check`, budget bundle < 800 Ko gzip, smoke Playwright (+ nouveau smoke
si nouvel écran), bump `CURRENT_SAVE_VERSION` si la forme de sauvegarde change
(A5, A6, H-ARTEQUIP, M-NAV souterrain — à regrouper par lot pour limiter les bumps).

---

## 6. Journal

- **2026-07-10** — Document créé (travail documentaire seul, rien d'implémenté).
  5 audits parallèles docs 01→16 vs code. Confirmé : G1/G2/G3/F1/F2/C1/C3/C7/H2
  de `gap-audit.md` corrigés ; plans phase-4.13→4.18, p2-c1/c3/c7 livrés ;
  audio complet livré (ne pas re-planifier). Inventaire : 55 manques répartis
  en 11 domaines, 4 pistes d'exécution (A moteur/données, B en ligne,
  C narratif/UX, D assets), 7 décisions design à cadrer.
- **2026-07-10 — Lot A1** (`.claude/plans/a1-rules-data-fixes.md`, branche
  `claude/a1-rules-data-fixes`) : **livré**. C-LOS (ligne de vue tireurs :
  `hexLine`/`hasLineOfSight`/`canShootTarget`, obstacles seuls bloquants, tir
  interdit si bloqué ⇒ mêlée forcée ; branché validation/résolution/préviz/IA/
  client) ; C-BADLUCK (chance bornée [-3,3], coup de malchance ×0,5, event
  `unlucky` + marqueur client) ; CAP-DATAFIX (`noMeleePenalty` Chasseresse AH +
  Idole Vox — docs font foi) ; DOC-STATS (doc 04 Cavalier funeste Vit.→10 ;
  tables Vox doc 16 §4 réalignées sur données `faction:sim` ; Avatar
  flying+noRetaliation tranché côté données) ; DOC-07 (§5 superseded par doc 15 +
  §4 backup/version 14) ; DOC-SKILLS (pool 13, Sagesse) ; DOC-AUDIO (app/audio.ts).
  Écarts : golden **inchangé** (LoS n'altère pas le combat gardien golden) ⇒
  aucun re-fix ; pas de bump save version. Vérifs : typecheck 5/5, lint, 420
  tests moteur (+19 : `combat-los`, `combat-luck`), content:check, garde-fou
  « zéro faction » vert, bundle < 800 Ko gzip. **PR draft #191**.
- **2026-07-10 — Lot A2a** (`.claude/plans/a2a-combat-capabilities.md`, branche
  `claude/a2a-combat-capabilities` empilée sur A1) : **livré**. 5 capacités de
  combat génériques ouvertes (catalogue 9 → 14) : `shieldWall` (Frère-Lame),
  `unlimitedRetaliation` (Griffon), `charge` (Chevalier du Griffon +5 %/hex,
  Cavalier funeste +4 %/hex), `magicResistance` autonome (Bibliothécaire 30 %),
  `lifeDrain` (Vampire 50 %, event `StackHealed` + chiffre de soin client).
  Garde-fou zéro faction vert. Vérifs : typecheck 5/5, lint, 428 tests (+8
  `combat-capabilities`), content:check, golden **inchangé** (pas de re-fix),
  bundle < 800 Ko gzip, pas de bump save version. Restent en A2b (statuts/RNG/
  ordre/ciblage) : `taunt`, `incorporeal`, `firstStrike`, `curseOnHit`,
  `poisonSting`, `strikeAndReturn`. **PR draft #194**.
- **2026-07-10 — Lot A2b** (`.claude/plans/a2b-combat-capabilities.md`, branche
  `claude/a2b-combat-capabilities` empilée sur A2a) : **livré**. 2 capacités
  génériques (catalogue 14 → 16) : `incorporeal(dodge)` (Spectre 20 % d'esquive,
  jet seedé, event `dodged` + « esquive » client) et `strikeAndReturn` (Lame du
  Serment : frappe volontaire puis retour à l'origine, cible sans riposte —
  sémantique « harpie » documentée doc 02/05). Correctif CI A2a inclus en amont
  (assertion Griffon). Garde-fou zéro faction vert. Vérifs : `pnpm test` complet
  (431 engine +3 `combat-capabilities-b`, 101 content), typecheck 5/5, lint,
  content:check, golden **inchangé**, bundle < 800 Ko gzip, pas de bump save
  version. Restent en A2c/A3 : `taunt`, `firstStrike`, `curseOnHit`,
  `poisonSting`, `areaAttack`, `breathAttack`. **PR #195 (mergée)**.
- **2026-07-10 — Merge stack A1/A2a/A2b** : PR #191, #194, #195 mergées dans
  `main` (dans l'ordre) sur demande utilisateur. Suivi PR arrêté.
- **2026-07-10 — Lot A2c** (`.claude/plans/a2c-combat-debuffs.md`, branche
  `claude/a2c-combat-debuffs` depuis main) : **livré**. Capacité `curseOnHit`
  (catalogue 16 → 17) : malédiction au contact (chance %, statut temporaire) —
  Zombie « Affaiblissement » (−Défense 20 %), Cavalier funeste « Faux funeste »
  (−20 % dégâts infligés, 100 %). Nouveau champ `SpellStatus.damageDealtMod`
  (multiplicatif) ⇒ **bump `CURRENT_SAVE_VERSION` 14 → 15**, golden re-fixé une
  fois (forme seule). Event `StackCursed` + label client. Garde-fou zéro faction
  vert. Vérifs : `pnpm test` complet (435 engine +4 `combat-curse`, 101 content),
  typecheck 5/5, lint, content:check, bundle < 800 Ko gzip. Restent en A2d/A3 :
  `firstStrike`, `poisonSting`, `taunt`, `areaAttack`, `breathAttack`, moral/
  auras, `spellcaster`, cycle de vie. **PR draft #196** (sur main).
- **2026-07-10 — Lot A3a** (`.claude/plans/a3a-morale-auras.md`, branche
  `claude/a3a-morale-auras` empilée sur A2c) : **livré**. 2 capacités de moral
  (catalogue 17 → 19) : `aura(moraleMod)` (Dragon d'os −1 moral aux vivants
  adverses) et `moraleImmune` (Ange, plancher moral 0) — interprétées dans
  `moraleOf`. **Pas de bump save** (moral live-calculé). Garde-fou zéro faction
  vert. Vérifs : `pnpm test` complet (439 engine +4 `combat-morale`, 101 content),
  typecheck 5/5, lint, content:check, golden **inchangé**, bundle < 800 Ko gzip.
  Restent en A3 : peur (Sombral), `spellcaster`, `areaAttack`/`breathAttack`,
  cycle de vie (`resurrectAlly`/renaissance/`swarm`). **PR #197 (mergée)**.
- **2026-07-10 — Merge A2c + A3a** : PR #196 (A2c) et #197 (A3a) mergées dans
  `main` (dans l'ordre) sur demande utilisateur. Suivi PR arrêté.
- **2026-07-10 — Lot A3b** (`.claude/plans/a3b-swarm.md`, branche
  `claude/a3b-swarm` depuis main) : **livré**. Capacité `swarm(bonus, minAllies)`
  (catalogue 19 → 20) : +bonus de dégâts/créature quand ≥ minAllies autres alliés
  cernent la cible (Élève AH, Chœur Vox). **Pas de bump save** (bonus live).
  Garde-fou zéro faction vert. Vérifs : `pnpm test` complet (443 engine +4
  `combat-swarm`, 101 content), typecheck 5/5, lint, content:check, golden
  **inchangé**, bundle < 800 Ko gzip. Restent en A2d/A3 : `firstStrike`,
  `poisonSting`, `taunt`, `areaAttack`/`breathAttack`, peur, `spellcaster`,
  `resurrectAlly`/renaissance/`devourMarks`. **PR #198 (mergée)**.
- **2026-07-10 — Lot A3c** (`.claude/plans/a3c-area-attack.md`, branche
  `claude/a3c-area-attack` depuis main) : **livré**. Capacité `areaAttack(pct,
  sparesUndead?)` (catalogue 20 → 21) : une frappe éclabousse les ennemis
  adjacents à la cible d'une fraction des dégâts, sans riposte, épargnant les
  morts-vivants (Liche nuage 1 hex, ½ dégâts). **Pas de bump save** (sans RNG,
  sans champ d'état). Garde-fou zéro faction vert. Vérifs : `pnpm test` complet
  (446 engine +3 `combat-area`, 101 content), typecheck 5/5, lint, content:check,
  golden **inchangé**, bundle < 800 Ko gzip. Restent : `firstStrike`,
  `poisonSting`, `taunt`, `breathAttack` (souffle/cône), `spellcaster`, peur,
  `resurrectAlly`/renaissance/`devourMarks`. **PR #199 (mergée)** ; `breathAttack`
  → A3d.
- **2026-07-10 — Lot A2d** (`.claude/plans/a2d-devour-marks.md`, branche
  `claude/a2d-devour-marks` depuis main, qui porte aussi le travail parallèle :
  héros nommés/spécialités save v16, cloud saves, blasons) : **livré**. Capacité
  `devourMarks(perMark, healPerMark)` (catalogue 21 → 22) : le Pénitent dévore
  toutes les Marques du champ (+2 %/charge de dégâts, se soigne 2 PV/charge).
  **Pas de bump save** (réutilise Marques + soin). Garde-fou zéro faction vert.
  Vérifs : `pnpm test` complet (448 engine +2 `combat-devour`, 101 content),
  typecheck 5/5, lint, content:check, golden **inchangé**, bundle < 800 Ko gzip.
  Restent (capacités) : `firstStrike`, `poisonSting`, `taunt`, `breathAttack`,
  `spellcaster`, peur, `resurrectAlly`/renaissance. **PR #202 (mergée)**.
- **2026-07-10 — Lot A3d** (`.claude/plans/a3d-breath-attack.md`, branche
  `claude/a3d-breath-attack` depuis main) : **livré**. Capacité `breathAttack(pct)`
  (catalogue 22 → 23) : le Dragon d'os frappe aussi la pile derrière la cible
  (souffle en ligne, 60 % des dégâts) — réutilise le « splash » de A3c (helper
  `applySplashDamage` extrait, `hexBehind` ajouté). **Pas de bump save**. Garde-fou
  zéro faction vert. **Toutes les capacités de lineup Necropolis sont désormais
  actives.** Vérifs : `pnpm test` complet (452 engine +5, 101 content), typecheck
  5/5, lint, content:check, golden **inchangé**, bundle < 800 Ko gzip. Restent
  (capacités) : `firstStrike`, `poisonSting`, `taunt`, `spellcaster`, peur,
  `resurrectAlly`/renaissance. PR draft : (à créer, sur main).
