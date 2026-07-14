# Plan — Faction 5 : Shadow Court (elfes noirs / Dungeon HoMM)

> **5ᵉ faction jouable**, continuation directe du pipeline data-driven prouvé 4×
> (test-faction, Necropolis, Arcane Hunters, Sylvan Court, Vox Arcana). Signature
> **Magie Irrésistible** = **1** point d'extension moteur générique. Découpage
> calqué sur Arcane Hunters (4.x) et Sylvan (5.x) : cadrage → données → signature
> → équilibrage/finitions.
>
> Doc de design source : `docs/17-faction-shadow-court.md`.

## Décisions de cadrage (arrêtées, réversibles tant qu'aucune donnée n'est écrite)
- **Faction** : *Shadow Court* (`shadow-court`) — pendant sombre de la Sylvan Court.
- **Signature `irresistibleMagic`** : les sorts de dégâts du héros de la faction
  ignorent (partiellement) la résistance magique + bonus de puissance plat borné.
  Générique, plafonné, zéro faction dans le moteur.
- **Économie** : ressources rares `sulfur` + `gems` (existantes) ; **pas** de
  ressource de faction (variété de preuve vs Essence/Résonance).
- **7 tiers**, capacités **100 % catalogue existant** (aucune capacité de code).
- Héros canon Raelag (might) + Shadya (magic) ; école propre `ombre` **différée**.

## Lots

### Lot 17.1 — Cadrage (CE LOT, documentaire)
- [x] `docs/17-faction-shadow-court.md` (gabarit + structure doc 05/16 remplis).
- [x] `CLAUDE.md` : ajout de `docs/17-*` à la liste de structure.
- [x] `docs/09-roadmap.md` : Beta « factions suivantes » — 5ᵉ faction (Shadow
      Court, cadrage) marquée en cours.
- [x] Ce plan.
- **Vérif** : lot **purement documentaire** ⇒ smoke non requis (guideline §7) ;
  `content:check` reste vert (aucun contenu touché) ; garde-fou faction
  trivialement vert (rien dans `packages/`). Relecture cohérence design.

### Lot 17.2 — Données du paquet (aucun diff moteur)
- [ ] `pnpm faction:new shadow-court` → squelette valide.
- [ ] Manifeste : `nativeTerrain: rough`, `keyResources: [sulfur, gems]`,
      `factionResources: []`, `spellSchool: null`, `tiers: 7`,
      `sharedGrowthGroups: {}`, `aiProfile` agressif+magique
      (`aggression ~0.7`, `focusFire ~0.7`, `preferredTargets: weakest`),
      `factionBonuses: []` (la signature arrive au lot 17.3), `town` (communs +
      7 dwellings + `shadow-court-cursed-well`), `heroes: [raelag, shadya]`.
- [ ] 7 unités de base + 7 variantes `-elite` (`units/t1..t7[-elite].json`),
      stats/coûts de la table doc 17 §3, capacités par ID du catalogue.
- [ ] `buildings.json` : 7 habitations `maxLevel: 2` (chaîne de prérequis modèle
      Sylvan) + `shadow-court-cursed-well` (`growthBonus 25 %`).
- [ ] `heroes/raelag.json` + `heroes/shadya.json` (identité + attributs +
      `specialtyEffect`/`startingSkills`/`startingSpells`).
- [ ] `locales/fr.json` + `en.json` : nom de faction (clé unique
      `@loc:faction.shadow-court.name`), noms + `loreKey` de chaque unité,
      bâtiment propre, spécialités de héros. **Parité FR/EN complète.**
- [ ] `data/factions/index.json` : ajouter `"shadow-court"`.
- [ ] Test de recrutement (contenu, `@heroes/content`) : le paquet charge,
      valide, on recrute chaque tier.
- **Vérif** : `pnpm faction:validate shadow-court` vert (schémas + règles
  croisées : prérequis atteignables, coûts définis, IDs de capacité existants,
  locales complètes) ; `pnpm test` (dont recrutement + `balance.test.ts`) ;
  garde-fou faction vert ; smoke inchangé (pas encore de signature). **Aucun diff
  hors `data/factions/shadow-court/` sauf `index.json`.**

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
- [ ] Données : ajouter le `factionBonus` au manifeste `shadow-court`.
- [ ] Tests **unitaires moteur** : sort de dégâts avec/sans le bonus vs cible
      résistante ; plafond sur immunité ; un héros d'une autre faction **non**
      affecté (preuve de généricité).
- **Vérif** : garde-fou « zéro faction dans le moteur » vert (le diff moteur =
  un point générique, pas d'`if faction`) ; golden replay — re-fixer **une** fois
  si la forme d'un cas inline change, sinon inchangé ; typecheck/lint/tests ;
  décider et documenter tout bump `CURRENT_SAVE_VERSION` (attendu : **aucun**, la
  signature est du contenu, pas de l'état). Suivre le skill `test-authoring`.

### Lot 17.4 — Équilibrage & finitions
- [ ] `pnpm faction:sim` incluant Shadow Court : régler stats/coûts vers 45–55 %
      par appariement, **0 blowout** ; consigner le rapport avant/après.
- [ ] Repli procédural d'assets (placeholders gracieux jusqu'à la DA finale) ;
      `FactionBadge` : motif déterministe non chromatique (serpent lové).
- [ ] Smoke Playwright étendu : recruter + combattre avec la Cour d'Ombre
      (et lancer un sort irrésistible en combat).
- [ ] Audit i18n : 0 chaîne en dur, parité FR/EN.
- **Vérif** : `pnpm test` + smoke desktop/mobile verts ; budget bundle < 800 Ko
  gzip tenu ; garde-fou faction vert.

### Lot 17.5 (optionnel, second temps) — Narratif
- [ ] `loreKey` FR/EN sur tout le contenu (unités/bâtiment/héros) du point de vue
      de la Cour (doc 13 §8 / doc 17 §8).
- [ ] Campagne 3 chapitres `data/factions/shadow-court/story/` (*La Descente*,
      *La Couvée d'Ombre*, *La Serrure*). Mêmes garde-fous : zéro diff moteur.

## Différés (notés, hors périmètre initial — cf. autres factions)
- École de sorts propre `ombre` + sorts dédiés (motif `traque`/`scene` déjà livré).
- Compétence de faction graduant la signature (`scaleSkillId`/`percentByRank`).
- Spécialités de héros au-delà du point `conditional` existant.

## Journal
- **2026-07-14** — Cadrage Shadow Court livré (lot 17.1). Faction = les elfes
  noirs / Dungeon de HoMM, pendant sombre de la Sylvan Court. Signature **Magie
  Irrésistible** retenue (1 point d'extension générique `irresistibleMagic`),
  périmètre de livraison = cadrage + plan (réversible), défauts pris faute de
  confirmation interactive (dialogue coupé techniquement) — signature/nom/terrain
  révisables avant le lot données. Suite : 17.2 (données) sur décision utilisateur.
