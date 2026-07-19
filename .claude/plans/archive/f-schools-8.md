# Lot F-SCHOOLS.8 — Pas de Brume (téléport allié) + ciblage d'hex de combat

> Backlog `.claude/plans/game-feature-gaps.md` §2.3 F-SCHOOLS.8 (dernier des 8
> sorts de l'École de la Traque, doc 05 §6). **Nouvelle surface client** :
> `CastSpell.targetHex` + ciblage d'un hex sur la grille de combat. Zéro faction
> moteur (mécanique générique `teleport`).

## Spec (doc 05 §6)

**Pas de Brume** (cercle 1, Traque) : « Téléporte une pile alliée de 3 hexes ».
Le héros vise une pile ALLIÉE puis une case de destination libre à ≤ portée (3).

## Décisions design

- Nouvelle `SpellKind 'teleport'` **générique** (aucun nom de faction/sort au
  moteur). Portée = `spell.base + spell.perPower × Pouvoir` (convention `banish`/
  `rally` qui réutilisent `base`). `base: 3, perPower: 0` ⇒ 3 hexes plats.
- `CastSpell` gagne `targetHex?: OffsetPos` (champ de COMMANDE, pas d'état) ⇒
  **pas de bump save, golden inchangé** (le replay golden n'a pas de teleport).
- Destination valide = dans le plateau, hors obstacle, libre (aucune pile),
  distance hex ≤ portée depuis la pile ciblée. La téléportation IGNORE les
  obstacles/piles entre les deux (c'est un téléport) : seule la case d'arrivée
  compte. Helper moteur pur `teleportDestinations` (partagé validation + client
  highlight, patron `reachableHexes`).
- Résolu dans `castHeroSpell` (chemin héros ; l'IA ne lance pas teleport — pas
  dans ses priorités dégâts/soin/debuff/buff). `applySpellToTargets` : no-op
  défensif pour `teleport` (le chemin unité `spellcaster` ne le porte pas).
- Client : après le choix de la pile alliée dans le grimoire, on ENTRE en mode
  ciblage d'hex (`store.combatSpellTarget`, client-only) ; `CombatScene`
  surligne les destinations et le tap dispatche `CastSpell{…, targetHex}`. Un
  bandeau DOM « Choisir la destination · Annuler » pilote l'annulation.

## Étapes

1. **Moteur** → verif : tests `combat-teleport.test.ts`
   - `hero/types.ts` : `SpellKind += 'teleport'`.
   - `core/commands.ts` : `CastSpell.targetHex?: OffsetPos`.
   - `hero/index.ts` : `teleportDestinations`, validation teleport, `castHeroSpell`
     accepte `targetHex`, `handleCastSpell` le passe. Export index.
   - `combat/spell-effect.ts` : no-op `teleport` dans `applySpellToTargets`.
2. **Contenu** → verif : `content:check`, test cohérence
   - schema `kind += 'teleport'`, refine `base > 0` (portée).
   - `data/core/spells.json` : `pas-de-brume` (traque, cercle 1, kind teleport,
     base 3). Locales FR/EN (nom + lore).
3. **Client** → verif : typecheck, smoke non régressé
   - `store.ts` : `combatSpellTarget` + défaut null ; `dispatch.ts` reset aux
     transitions de combat.
   - `SpellBook.tsx` : bouton « Choisir la destination » pour teleport (entre en
     mode ciblage), preview dédiée.
   - `CombatScene.ts` : highlight `teleportDestinations`, tap → `CastSpell`.
   - `combat.tsx` : bandeau d'annulation.
   - locales UI FR/EN.
4. **Docs & backlog** : doc 05 §État F-SCHOOLS.8 (8/8), case backlog.

## Vérification

- [ ] `pnpm typecheck` 5/5 · `pnpm lint`
- [ ] engine tests (+ `combat-teleport`) · content tests · `content:check`
- [ ] garde-fou faction + couleurs · `pnpm build` + bundle < 800 Ko gzip
- [ ] golden inchangé, pas de bump save · `pnpm smoke`

## Journal

- 2026-07-12 — Plan créé, branche `claude/f-schools-8` depuis main (@852c99a).
- 2026-07-12 — **Implémenté**. Moteur : `SpellKind 'teleport'`,
  `CastSpell.targetHex?`, `teleportDestinations` (export index), validation +
  résolution dans `castHeroSpell` (StackMoved + rupture Symbiose), no-op défensif
  `applySpellToTargets`. Contenu : schema `kind += teleport` + refine base>0,
  `pas-de-brume` (cercle 1, base 3) + locales FR/EN (nom + lore). Client : store
  `combatSpellTarget` + reset dispatch, grimoire → mode ciblage, `CombatScene`
  highlight + `handleTeleportTap`, bandeau d'annulation `combat.tsx` + CSS
  (tokens), locales `spellbook.pickHex`/`chooseDestination`. Doc 05 §F-SCHOOLS.8
  (8/8), backlog coché.
  **Vérifs** : typecheck 5/5 ✅, lint ✅, engine 646 tests (+4 `combat-teleport`) ✅,
  content 120 tests (+1 teleport, assertion base>0 mise à jour) ✅, content:check
  ✅, parité FR/EN ✅, garde-fou faction ✅ + couleurs ✅, build + bundle 304 Ko
  gzip ✅, golden inchangé + pas de bump save (save-shape vert) ✅. Smoke en cours.
