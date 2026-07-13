# Lot F-SKILLS.2 — Prière de bataille (Haven), engine-first

> Câble la compétence de faction **Prière de bataille** (doc 03 §2/§5) : 1×/combat,
> un héros Haven **ressuscite** une pile alliée de X PV (X croît Novice/Expert/
> Maître). Nouveau **point d'extension moteur générique** (action de héros en
> combat gatée par une compétence) + données Haven. Backlog §2.3 F-SKILLS.
> **Engine-first** (IA + auto-combat), UI joueur différée (précédent `spellcaster` A2h).

## Mécanique (miroir de C1 `HeroAttack`)

- Champ de compétence générique `SkillRankEffect.battleResurrectHp` (PV soignés/
  ressuscités par rang). Un héros dont une compétence porte ce champ peut, **1×/
  combat**, soigner une pile alliée — résurrection intra-pile (réutilise le cœur
  heal : `maxCount = count + lostSoFar`).
- Suivi 1×/combat par camp : `CombatState.heroRallyUsed?: CombatSideId[]`
  (**optionnel** ⇒ pas de bump save, golden inchangé).
- Commande `HeroRally { targetStackId }` (joueur), cœur partagé `rallyWithHero`
  (joueur + IA). Gate : compétence présente (`battleResurrectHp > 0`), héros lié,
  pas déjà utilisée, cible alliée VIVANTE.
- IA : dans la boucle de tour du héros (`ai.ts`), si `battleResurrectHp > 0` et
  non utilisée et une pile alliée a perdu des créatures ⇒ ressuscite la plus
  entamée.
- Event `HeroRallied { side, targetId, healed, revived }`.

## Changements

- `hero/types.ts` : `battleResurrectHp?` sur `SkillRankEffect`.
- `combat/types.ts` : `heroRallyUsed?: CombatSideId[]`.
- `combat/spell-effect.ts` : extrait `resurrectStack(draft, combat, stack, hp)`
  (réutilisé par le heal ET la Prière) — même calcul, zéro changement de comportement.
- `combat/hero-rally.ts` (nouveau) : helper `heroBattlePrayerHp`, `validateHeroRally`,
  `rallyWithHero`.
- `core/commands.ts` : commande `HeroRally` + code d'erreur.
- `core/engine.ts` : enregistrement (liste, validate, handler).
- `combat/ai.ts` : usage IA.
- `core/events.ts` : `HeroRallied`.
- `data/core/skills.json` : compétence `battle-prayer` (ranks) ; locales FR/EN ;
  `data/factions/haven/manifest.json` heroSkills += `battle-prayer`.
- Doc 03 §2/§5 + backlog.

## Vérification

- test moteur : héros doté ⇒ ressuscite une pile alliée entamée (count remonte),
  1×/combat (2ᵉ refusée), non doté ⇒ refus ; property IA inchangée (se termine).
- typecheck 5/5 · lint · golden + save-shape **inchangés** · content + content:check ·
  garde-fous (ids opaques dans les tests !) · `faction:sim` (Haven faible ⇒ buff sain) ·
  build + bundle · smoke.

## Journal

- 2026-07-13 — Plan créé, branche `claude/f-skills-battle-prayer` depuis origin/main.
- 2026-07-13 — Implémenté : champ `battleResurrectHp` (engine+schema), extraction
  `resurrectStack` (heal refactoré à l'identique), module `hero-rally.ts`, commande
  `HeroRally` enregistrée (liste/validate/handler), event `HeroRallied`, usage IA
  (`maybeHeroAction`), données `battle-prayer` (30/60/100) + locales + heroSkills Haven.
- 2026-07-13 — Tests : `combat-hero-rally` (résurrection, 1×/combat, gate compétence,
  cible alliée, IA prie + combat se termine). Heal + spellcaster (Ange) inchangés
  après l'extraction ⇒ comportement préservé.
- 2026-07-13 — Vérif : typecheck 5/5 · lint · engine 692/692 (golden + save-shape
  **inchangés**) · content 125/125 · content:check · garde-fous faction/couleur (ids
  opaques dans le test) · build · bundle gzip 300 Ko < 800 Ko.
