# Lot CAP-LIFE.2 — Renaissance du Phénix (rebirth)

> Nouveau **point d'extension moteur générique** : la capacité `rebirth` — une pile
> qui meurt **renaît UNE fois** à `pct`% de son effectif d'origine, au lieu d'être
> retirée. Signature du Phénix (Vox Arcana, doc 16 §4/§7), jusqu'ici différée.
> Backlog §2.2 CAP-LIFE (renaissance). **Zéro nom de faction dans le moteur.**

## Mécanique

- Capacité `rebirth` (catalogue) avec param `pct` (% de l'effectif d'origine relevé,
  défaut 50). 1×/combat par pile.
- Suivi 1×/combat : `CombatState.rebornStackIds?: string[]` — **optionnel** ⇒ pas de
  bump save, garde-fou save-shape épargné (il ne couvre que HeroState/CombatStack ;
  un champ optionnel sur CombatState ne le déclenche pas), golden inchangé (aucune
  unité `rebirth` dans la fixture golden ⇒ champ jamais peuplé).
- Centralisation de la mort de pile : `combat/death.ts`
  - `tryRebirth(combat, stack, def, events): boolean` — tente la renaissance
    (effectif d'origine = `collectCasualties` comme la résurrection ; relève
    `max(1, floor(pct/100 × perdus))`, `firstHp = hp`, event `StackReborn`, marque
    l'id). `false` si pas `rebirth` / déjà renée.
  - `handleStackDeath(combat, stack, def, events)` — `if (tryRebirth) return; sinon
    push StackDied + splice` (comportement **identique** aux sites actuels pour une
    pile sans `rebirth` ⇒ golden inchangé).
- Sites de mort routés vers `handleStackDeath` : `damage.ts` (frappe principale +
  `applyDamageToStack` splash), `spell-effect.ts` (`damageOneStack`), `hero-attack.ts`
  (corrige au passage l'absence de splice — pile morte enfin retirée). Poison
  (`turns.ts`) utilise `tryRebirth` directement (conserve son splice batché).
  Le **bannissement** (`banish`, retrait volontaire d'une invocation) reste
  intentionnellement hors renaissance.

## Changements

- `data/core/abilities.json` : +`rebirth`.
- `packages/engine/src/combat/types.ts` : `CombatState.rebornStackIds?`.
- `packages/engine/src/combat/death.ts` (nouveau) : `rebirthPlan`, `tryRebirth`, `handleStackDeath`.
- `packages/engine/src/combat/{damage,spell-effect,hero-attack,turns}.ts` : routage.
- `packages/engine/src/core/events.ts` : `StackReborn { stackId, count }`.
- `data/factions/vox-arcana/units/t7-phenix{,-elite}.json` : +`rebirth(pct)`.
- `packages/client/src/app/combat-log.ts` + locales FR/EN : `combatLog.reborn`.
- `docs/16-faction-vox-arcana.md` §4/§7 : renaissance livrée ; backlog CAP-LIFE ✅.

## Vérification

- test moteur `combat-rebirth` (ids OPAQUES) : une pile `rebirth(50)` tuée renaît à
  ~50 % de l'effectif d'origine (event `StackReborn`, reste sur le plateau) ; 2ᵉ mort
  ⇒ retrait définitif ; une pile sans `rebirth` meurt normalement (non-régression).
- typecheck 5/5 · lint · engine (golden + save-shape **INCHANGÉS**) · content +
  content:check · garde-fous faction/couleur · build + bundle gzip < 800 Ko ·
  `faction:sim` (Vox déjà côté fort ⇒ surveiller, pas de blowout) · smoke.

## Journal

- 2026-07-13 — Plan créé, branche `claude/cap-life-rebirth` depuis origin/main.
- 2026-07-13 — Implémenté : capacité `rebirth` (catalogue), `combat/death.ts`
  (`rebirthPlan`/`tryRebirth`/`handleStackDeath`), `CombatState.rebornStackIds?`,
  event `StackReborn`, routage des 5 chemins de mort (damage×2, spell-effect,
  hero-attack, poison), données Phénix. Test `combat-rebirth` (ids opaques).
- 2026-07-13 — `faction:sim` : rebirth(50/60) sur stats de base ⇒ **1 déséquilibre
  béant** (arcane vs vox 14/86) + swing énorme necropolis (26→62). Compensation :
  rebirth 30/35 % + baisse hp/dégâts du Phénix ⇒ **0 déséquilibre béant**
  (arcane vs vox 22,5/77,5 ; necropolis vs vox 48,8/51,3 ; haven vs vox 54/46).
- 2026-07-13 — Vérif : typecheck 5/5 · lint · engine 701/701 (golden + save-shape
  **inchangés** — centralisation iso-comportement) · content 125/125 · content:check ·
  garde-fous · build · bundle gzip 300 Ko < 800 Ko.
