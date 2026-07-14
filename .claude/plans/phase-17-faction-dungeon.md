# Plan — Faction 5 : Dungeon / Donjon (elfes noirs de HoMM)

> **5ᵉ faction jouable**, continuation directe du pipeline data-driven prouvé 4×
> (test-faction, Necropolis, Arcane Hunters, Sylvan Court, Vox Arcana). Nom repris
> tel quel de HoMM (**Dungeon** / français **Donjon**). Signature **Magie
> Irrésistible** = **1** point d'extension moteur générique. Découpage calqué sur
> Arcane Hunters (4.x) et Sylvan (5.x) : cadrage → données → signature →
> équilibrage/finitions.
>
> Doc de design source : `docs/17-faction-dungeon.md`.

## Décisions de cadrage (arrêtées, réversibles tant qu'aucune donnée n'est écrite)
- **Faction** : *Dungeon* (`dungeon`) — les elfes noirs de HoMM, affichage FR
  « Donjon » / EN « Dungeon ». Pendant sombre de la Sylvan Court.
- **Signature `irresistibleMagic`** : les sorts de dégâts du héros de la faction
  ignorent (partiellement) la résistance magique + bonus de puissance plat borné.
  Générique, plafonné, zéro faction dans le moteur.
- **Économie** : ressources rares `sulfur` + `gems` (existantes ; le soufre est la
  rare historique du Donjon) ; **pas** de ressource de faction (variété de preuve
  vs Essence/Résonance).
- **7 tiers**, capacités **100 % catalogue existant** (aucune capacité de code).
- Héros canon Raelag (might) + Shadya (magic) ; école propre `ombre` **différée**.

## Lots

### Lot 17.1 — Cadrage (CE LOT, documentaire)
- [x] `docs/17-faction-dungeon.md` (gabarit + structure doc 05/16 remplis).
- [x] `CLAUDE.md` : ajout de `docs/17-*` à la liste de structure.
- [x] `docs/09-roadmap.md` : Beta « factions suivantes » — 5ᵉ faction (Dungeon,
      cadrage) marquée en cours.
- [x] Ce plan.
- **Vérif** : lot **purement documentaire** ⇒ smoke non requis (guideline §7) ;
  `content:check` reste vert (aucun contenu touché) ; garde-fou faction
  trivialement vert (rien dans `packages/`). Relecture cohérence design.

### Lot 17.2 — Données du paquet (aucun diff moteur) — ✅ LIVRÉ
- [x] Paquet écrit à la main sur le modèle Sylvan (pas de `faction:new` — outil
      non requis, structure connue).
- [x] Manifeste : `nativeTerrain: rough`, `keyResources: [sulfur, gems]`,
      `factionResources: []`, `spellSchool: null`, `tiers: 7`,
      `sharedGrowthGroups: {}`, `aiProfile` agressif+magique
      (`aggression 0.7`, `focusFire 0.7`, `preferredTargets: weakest`),
      `factionBonuses: []` (la signature arrive au lot 17.3), `town` (communs +
      7 dwellings + `dungeon-cursed-well`), `heroes: [raelag, shadya]`.
- [x] 7 unités de base + 7 variantes `-elite` (`units/t1..t7[-elite].json`),
      stats/coûts de la table doc 17 §3, capacités par ID du catalogue
      (toutes interprétées par le moteur — vérifié : shooter/poisonSting/
      noRetaliation/moraleImmune/doubleAttack/charge/spellcaster/curseOnHit/
      areaAttack/breathAttack/flying/fear/magicResistance/spellImmune).
- [x] `buildings.json` : 7 habitations `maxLevel: 2` (chaîne de prérequis modèle
      Sylvan) + `dungeon-cursed-well` (`growthBonus 25 %`).
- [x] `heroes/raelag.json` + `heroes/shadya.json` (identité canon + attributs +
      `specialtyEffect`/`startingSkills`/`startingSpells`).
- [x] `locales/fr.json` + `en.json` : nom de faction (clé unique
      `@loc:faction.dungeon.name` → « Donjon » / « Dungeon »), noms de chaque
      unité, bâtiment propre, spécialités de héros. **Parité FR/EN.** `loreKey`
      des unités **différé au lot 17.5** (optionnel, non requis par les tests).
- [x] `data/factions/index.json` : `"dungeon"` ajouté.
- [x] Test de recrutement `packages/content/test/dungeon-recruit.test.ts`
      (faction identifiée par propriété `nativeTerrain: rough` — jamais par id,
      garde-fou modularité) : charge/locales/capacités/recrutement des 7 tiers.
- [x] **Vérif** : `content:check` vert (7 paquets, dungeon 14 unités/locales OK) ;
      `pnpm test` vert (engine 735 + content 129, dont dungeon-recruit 3/3) ;
      typecheck + lint verts ; garde-fou faction vert (grep CI local, statut 1) ;
      smoke `@core` desktop 13/13 + mobile 6/6 (via `PW_CHROMIUM_PATH`) ; bundle
      305 Ko gzip < 800 Ko. Seul diff hors `data/factions/dungeon/` : `index.json`
      + test de recrutement + 1 ligne d'assertion smoke (liste des factions).
      NB : `faction:validate` signale des faux négatifs (héros startingSkills/
      Spells) — limite pré-existante de l'outil (mêmes faux négatifs sur Sylvan),
      pas un défaut de données ; `content:check` (garde-fou CI réel) est vert.

### Lot 17.3 — Signature `irresistibleMagic` (1 point d'extension générique) — ✅ LIVRÉ
- [x] `engine/faction/types.ts` : variant `IrresistibleMagicBonus`
      (`spellBonusPercent` int %, `resistancePierce` fraction 0..1) ajouté à
      l'union `FactionBonus` + schéma Zod `@heroes/content` (`factionBonusSchema`),
      formes synchrones.
- [x] Helper générique `factionSpellDamageMods(state, hero)`
      (`combat/state-helpers.ts`) — somme les `irresistibleMagic` de la faction du
      héros (`hero.factionId` → `factionCatalog`, **jamais** de nom de faction),
      retourne `{ bonusPct, resistancePierce }` borné, {0,0} sinon. Calqué sur le
      précédent `factionCurseDurationBonus`.
- [x] Interprétation dans le cœur partagé `applySpellToTargets` (nouveau param
      `damageMods` défaut {0,0}) : résistance graduée atténuée de `resistancePierce`
      puis dégâts × (1 + bonusPct). `castHeroSpell` passe les mods (sort de dégâts
      d'un héros doté) ; le sort d'unité `spellcaster` garde le défaut.
- [x] Prévisualisation (`estimateSpell`/`estimateSpellWithPower`) : mêmes maths,
      mods passés côté héros seulement (unité = défaut).
- [x] `spellImmune` (immunité TOTALE) reste un bloc de ciblage entier — non
      franchi ; seule la résistance graduée est percée (doc 17 §2 aligné).
- [x] Données : `factionBonus` `irresistibleMagic` (`spellBonusPercent: 30`,
      `resistancePierce: 0.5`) ajouté au manifeste `dungeon`.
- [x] Test unitaire moteur `combat-irresistible-magic.test.ts` : dégâts avec/sans
      le bonus vs cible résistante (nue 9 / dotée 23), préviz = résolution, héros
      d'une autre faction **non** affecté (généricité), immunité totale non franchie.
      Ids de faction synthétiques (garde-fou modularité).
- **Vérif** : garde-fou « zéro faction dans `packages/` » vert (diff moteur = 1
  point générique, aucun `if faction`) ; **golden replay inchangé** (aucun cas
  Dungeon inline ; ajout de variant d'union sans toucher les replays existants) ;
  typecheck/lint verts ; tests engine 739 (+4) + content 129 ; content:check vert
  (Dungeon « 1 effet de faction ») ; smoke `@core` 19/19. **Aucun bump
  `CURRENT_SAVE_VERSION`** : la signature est du contenu (manifeste/catalogue),
  pas de l'état sérialisé.

### Lot 17.4 — Équilibrage & finitions — ✅ LIVRÉ
- [x] `pnpm faction:sim` incluant le Donjon : **1ʳᵉ passe** = 1 blowout
      (Necropolis vs Donjon 80.8 % en faveur du Donjon) + Donjon trop fort vs
      Haven (75.4 %). **Nerf** des tiers porteurs (Furie T2 dmg 3–5→2–4 ;
      Chevaucheur T4 8–12→7–10 ; Hydre T6 hp 75→68, dmg 12–20→10–15, `areaAttack`
      0.5→0.35 ; Dragon T7 hp 180→160, dmg 40–55→32–42 ; élites idem). **2ᵉ passe
      = 0 blowout** : Donjon en bande vs Haven (52 %) / Arcane (49 %), ⚠ maîtrisé
      vs Necropolis (60 %) / Sylvan (57 %) / Vox (37 %) — même profil que le roster
      existant (9 paires ⚠ au total, inchangé ; le blowout a disparu).
- [x] Repli procédural d'assets + `FactionBadge` : **déterministes automatiques**
      depuis `hash(factionId)` (aucun câblage — le badge de `dungeon` a déjà son
      motif non chromatique ; repli procédural gracieux en place, doc 12 §10).
- [x] Audit i18n : parité FR/EN **vérifiée par `content:check`** (0 clé manquante,
      0 chaîne en dur ; paquet Donjon complet fr/en).
- [~] Smoke Playwright : **non ré-étendu** — le lot 17.4 est un ajustement de
      **stats data-only sur une faction non-défaut** ; le smoke exerce
      Haven/test-faction (chargement + combat génériques déjà couverts), le
      chargement Donjon en navigateur a été validé au lot 17.3, le recrutement par
      un test contenu et la signature par un test moteur. Ajouter un smoke dédié
      Donjon (~100× un unitaire) serait redondant (skill `test-authoring`).
- **Vérif** : `pnpm test` vert (engine 739 + content 129) ; `faction:sim` 0
  blowout ; content:check vert ; typecheck vert ; garde-fou faction vert ; budget
  bundle inchangé (aucun asset ajouté). **Aucun diff moteur** (données + docs).

### Lot 17.5 — Narratif (textes d'ambiance) — ✅ LIVRÉ
- [x] `loreKey` FR/EN sur les **14 unités** (base + élites) + le **Puits de
      Malédiction**, voix 1ʳᵉ personne du Donjon (froide, impérieuse). Héros : `bio`
      FR/EN déjà livrée (17.2).
- [x] **Vérif** : `content:check` vert (parité lore fr/en OK ; 72/90 unités avec
      ambiance, +14 Dungeon) ; tests content 129 ; garde-fou faction vert. **Zéro
      diff moteur** (données pures : `loreKey` + locales).
### Lot 17.6 — Campagne du Donjon — 🚧 EN COURS (ch1 livré)
- [x] **Chapitre 1 — *La Descente*** : `data/factions/dungeon/story/campaign.json`
      (`manifest.story` branché) + scénario `data/scenarios/dungeon-ch1.scenario.json`
      (index mis à jour). Le Donjon (humain) prend racine sur `proto-01` face à une
      IA **Sylvan Court** (parents reniés) ; dialogue d'ouverture Raelag/Shadya,
      1 quête primaire (bâtir le Fort → or + soufre), 3 barks de combat. Locales
      FR/EN (`campaign.dungeon.*`, `scenario.dungeon-ch1.name`, `dlg.*`, `quest.*`,
      `character.raelag/shadya.name`, `bark.dungeon.sylvan.*`) dans `data/core/locales/`.
- [ ] **Chapitre 2 — *La Couvée d'Ombre*** + **Chapitre 3 — *La Serrure*** : à écrire.
- **Vérif** : `content:check` vert (campagne `dungeon-campaign` 1 chapitre, scénario
  `dungeon-ch1` 2 joueurs, cross-refs + parité locales OK) ; tests engine 740 +
  content 129 ; typecheck vert ; garde-fou faction vert ; smoke `@core` 19/19.
  **Zéro diff moteur** (données + locales core).

## Différés (notés, hors périmètre initial — cf. autres factions)
- École de sorts propre `ombre` + sorts dédiés (motif `traque`/`scene` déjà livré).
- Compétence de faction graduant la signature (`scaleSkillId`/`percentByRank`).
- Spécialités de héros au-delà du point `conditional` existant.

## Journal
- **2026-07-14** — Cadrage livré (lot 17.1). Faction = les elfes noirs / Dungeon
  de HoMM. Signature **Magie Irrésistible** retenue (1 point d'extension générique
  `irresistibleMagic`), périmètre de livraison = cadrage + plan (réversible),
  défauts pris faute de confirmation interactive (dialogue coupé techniquement).
  **Renommage** `shadow-court` → `dungeon` (retour utilisateur : garder le nom de
  HoMM, « Donjon » en FR). Suite : 17.2 (données) sur décision utilisateur.
- **2026-07-14** — Lots 17.1 + 17.2 mergés (PR #349, squash). Lot **17.3**
  (signature `irresistibleMagic`) livré sur nouvelle branche repartie de `main`
  (PR #349 mergée ⇒ nouvelle PR, guideline §6) : 1 point d'extension moteur
  générique, golden inchangé, pas de bump save.
- **2026-07-14** — Lot 17.3 mergé (PR #350, squash). Lot **17.4** (équilibrage)
  livré sur branche de suivi repartie de `main` : `faction:sim` a révélé un
  blowout (Donjon sur-calibré) ⇒ nerf des tiers porteurs ⇒ 2ᵉ passe **0
  blowout**. Finitions (assets/badge/i18n) satisfaites par construction. **Aucun
  diff moteur** (données + docs). Reste **17.5 — narratif** (optionnel, sur
  décision utilisateur). La faction Donjon est jouable & équilibrée de bout en bout.
- **2026-07-14** — Lot 17.4 mergé (PR #351, squash). Lot **17.5 — textes
  d'ambiance** livré sur branche de suivi : `loreKey` FR/EN sur les 14 unités + le
  Puits de Malédiction (voix du Donjon). Données pures, zéro diff moteur. La
  **campagne 3 chapitres** reste un lot narratif distinct (cartes/scénarios/
  dialogues), à ouvrir sur décision. **Faction Donjon complète** (17.1→17.5) :
  cadrage, données, signature, équilibrage, ambiance.
