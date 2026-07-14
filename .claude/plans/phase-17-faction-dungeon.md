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

### Lot 17.4 — Équilibrage & finitions
- [ ] `pnpm faction:sim` incluant le Donjon : régler stats/coûts vers 45–55 %
      par appariement, **0 blowout** ; consigner le rapport avant/après.
- [ ] Repli procédural d'assets (placeholders gracieux jusqu'à la DA finale) ;
      `FactionBadge` : motif déterministe non chromatique (serpent lové).
- [ ] Smoke Playwright étendu : recruter + combattre avec le Donjon
      (et lancer un sort irrésistible en combat).
- [ ] Audit i18n : 0 chaîne en dur, parité FR/EN.
- **Vérif** : `pnpm test` + smoke desktop/mobile verts ; budget bundle < 800 Ko
  gzip tenu ; garde-fou faction vert.

### Lot 17.5 (optionnel, second temps) — Narratif
- [ ] `loreKey` FR/EN sur tout le contenu (unités/bâtiment/héros) du point de vue
      du Donjon (doc 13 §8 / doc 17 §8).
- [ ] Campagne 3 chapitres `data/factions/dungeon/story/` (*La Descente*,
      *La Couvée d'Ombre*, *La Serrure*). Mêmes garde-fous : zéro diff moteur.

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
  générique, golden inchangé, pas de bump save. Reste 17.4 (équilibrage
  `faction:sim`, assets) + 17.5 (narratif) — sur décision utilisateur.
