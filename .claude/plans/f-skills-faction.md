# Lot F-SKILLS — compétences de faction (Nécromancie graduée…)

Backlog `game-feature-gaps.md` §2.3 (F-SKILLS, Effort M). Les factions déclarent
`heroSkills` au manifeste mais **rien n'est câblé** : `buildSkillCatalog`
(content/loader) ne lit que `data/core/skills.json` ; la Nécromancie est **plate**
(`percentHpRaised: 15` en dur dans le manifeste Necropolis). Doc :
Nécromancie graduée 10/15/20 % (doc 04 §2), Prière de bataille (doc 03),
Chasse rituelle (doc 05 §7), Sylve (doc 14 §6).

## Décision de conception (à confirmer)

Deux surfaces à ouvrir :

1. **Pool de compétences gaté par faction** : une compétence de faction ne doit
   être proposée **qu'aux héros de sa faction**. Approche recommandée :
   `HeroSkillDef.factionId?: string` (opaque, '' = commune) ; le loader fusionne
   les `heroSkills` de chaque paquet dans le `skillCatalog` en les taguant du
   `manifest.id` ; `eligibleSkills` (`hero/level-up.ts`) filtre les compétences
   dont `factionId` ≠ `hero.factionId`. Générique, zéro nom de faction moteur.
2. **Effet gradué** : `raiseUndeadOnVictory` scale selon le rang du héros dans une
   compétence déclarée. Approche : champ optionnel `scaleSkillId` +
   `percentByRank: [10,15,20]` sur le bonus ; l'effet lit `hero.skills[scaleSkillId]`
   (1/2/3) et remplace `percentHpRaised` par le palier (repli sur `percentHpRaised`
   si le héros n'a pas la compétence).

**Pas de save bump** (compétences déjà dans `hero.skills` ; `factionId` de
compétence = donnée de catalogue). Golden inchangé (le héros golden ne monte pas
de niveau ⇒ aucun tirage de compétence ; aucune faction).

## Surfaces touchées (≈ 10 fichiers)

- `hero/types.ts` : `HeroSkillDef.factionId?`.
- `faction/types.ts` : `raiseUndeadOnVictory.scaleSkillId?` + `percentByRank?`.
- `content/schemas.ts` : `factionId` sur le schéma de compétence + champs de
  scaling sur `raiseUndeadOnVictory` ; `manifest.heroSkills` déjà présent (à
  vérifier), fusion dans `buildSkillCatalog` (loader).
- `hero/level-up.ts` : `eligibleSkills` filtre par faction.
- `faction/effects.ts` : `applyRaiseUndeadOnVictory` lit le rang.
- Données : manifeste Necropolis `heroSkills: [necromancy 10/15/20]` +
  `raiseUndeadOnVictory` gradué ; skill `necromancy`.
- Tests (offre gatée + scaling), docs 04/06.

## Étapes de vérif

`pnpm test`, typecheck, lint, `content:check`, garde-fou, build, smoke ; golden
**inchangé**, **pas de bump save**.

## Journal

- branche `claude/f-skills-faction` créée depuis `main` @ 57a694e.
- Plan rédigé ; **checkpoint utilisateur** avant exécution (lot M multi-surface +
  décision de gating ; AskUserQuestion indisponible en séance).
