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

### Lot 17.3 — Signature `irresistibleMagic` (1 point d'extension générique)
- [ ] `engine/faction/types.ts` : ajouter le variant `irresistibleMagic`
      (`spellBonusPercent`, `resistancePierce`) à l'union `FactionBonus` + schéma
      Zod `@heroes/content` (`schemas.ts`).
- [ ] Interprétation dans la résolution de sort de combat (`CastSpell` /
      `castHeroSpell`) : si le héros lanceur porte le bonus (résolu via
      `hero.factionId` → `factionCatalog`, **jamais** de nom de faction en dur),
      majorer les dégâts et atténuer la réduction de résistance. Effet **borné**,
      `spellImmune` réduit non annulé.
- [ ] Prévisualisation de dégâts (sans RNG) cohérente avec la nouvelle formule.
- [ ] Données : ajouter le `factionBonus` au manifeste `dungeon`.
- [ ] Tests **unitaires moteur** : sort de dégâts avec/sans le bonus vs cible
      résistante ; plafond sur immunité ; un héros d'une autre faction **non**
      affecté (preuve de généricité).
- **Vérif** : garde-fou « zéro faction dans le moteur » vert (le diff moteur =
  un point générique, pas d'`if faction`) ; golden replay — re-fixer **une** fois
  si la forme d'un cas inline change, sinon inchangé ; typecheck/lint/tests ;
  décider et documenter tout bump `CURRENT_SAVE_VERSION` (attendu : **aucun**, la
  signature est du contenu, pas de l'état). Suivre le skill `test-authoring`.

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
