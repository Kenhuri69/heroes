# G2 + H2 — Guilde des mages (apprentissage de sorts) + compétence Sagesse

> Backlog `gap-audit.md` items **G2** (guilde inerte : aucun apprentissage de
> sorts) et **H2** (pas de Sagesse → cercles élevés morts). Décisions utilisateur
> (2026-07-08) : **pool aléatoire seedé par niveau de guilde** (HoMM classique) +
> **compétence Sagesse** conditionnant les hauts cercles (4-5).

## Design retenu

1. **Pool de guilde seedé, par niveau.** À la construction d'un niveau de
   `mageGuild` L, on tire au **RNG seedé** un sous-ensemble des sorts de cercle L
   (`spellCount` défini en données sur l'effet du bâtiment). Le pool est
   **accumulé** sur `town.spellPool` (persisté).
2. **Apprentissage à la visite.** Quand un héros du propriétaire est **sur la
   tuile** d'une de ses villes (`samePos`, comme le transfert de garnison), il
   apprend automatiquement tous les sorts du pool de cercle ≤ son cercle
   apprenable. Déterministe, aucun nouveau command.
3. **Sagesse (H2).** Cercle apprenable de base = **3** (les cercles 1-3 sont
   libres). La compétence `wisdom` débloque **4 puis 5** (`learnCircle` 4/5/5 par
   rang — champ déjà déclaré `SkillRankEffect.learnCircle`). Mécanisme réel et
   testé ; **inerte sur le contenu actuel** (aucun sort de cercle 4-5 encore —
   ils relèvent de H1) jusqu'à ce que H1 ajoute des sorts de haut cercle.

## Étapes & vérif

- [x] Données : `skills.json` +`wisdom` (3 rangs, `learnCircle`) + locales FR/EN ;
      `buildings.json` mageGuild → `spellCount` par niveau (4/3/2).
- [x] Types moteur : `BuildingEffect.mageGuild` +`spellCount` ; `TownState`
      +`spellPool: string[]` ; bump `CURRENT_SAVE_VERSION` 8→9 (doc 07 §4).
- [x] `hero/skills.ts` : `heroLearnableCircle(hero, catalog)` = max(3, learnCircle).
- [x] `town/mage-guild.ts` : `rollGuildSpells(draft, town, level, count)` (RNG
      seedé, thread `draft.rng`, dédup dans `town.spellPool`).
- [x] `hero/index.ts` : `learnGuildSpellsAtTown(draft, hero, town, events)` +
      événement `SpellsLearned`.
- [x] Hooks : `handleBuildStructure` (roll + apprend si héros présent),
      `advanceHeroAlongPath` (apprend en foulant sa ville), `StartGame`
      (roll des pools des niveaux prébâtis + apprentissage initial).
- [x] `core/events.ts` : `SpellsLearned { heroId, spellIds }`.
- [x] `TownScreen.tsx` : panneau Guilde des mages (pool, connu/apprenable/verrouillé).
- [x] Tests moteur (roll taille/cercle, apprentissage à la visite, gate Sagesse
      via sort de cercle 4 synthétique) ; golden re-fixé si besoin ; smoke.

## Invariants
- Moteur faction-agnostique : le pool tire dans le catalogue par cercle, aucun
  nom de faction. RNG seedé (jamais Math.random). Save version bumpée.

## Journal
- 2026-07-08 — Plan créé après cadrage utilisateur. Implémentation en cours.
