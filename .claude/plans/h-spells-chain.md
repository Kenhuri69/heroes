# Lot H-SPELLS.4 — Chaîne d'éclairs (chain damage)

> Deuxième tranche de H-SPELLS.4 (backlog §2.4, doc 02 §1.4) : la **chaîne**.
> Un sort de dégâts qui frappe la cible puis **rebondit** sur les ennemis les
> plus proches, avec des dégâts **décroissants** par saut. Modificateur
> déclaratif générique sur un sort `damage` (patron `marksDamagePct`/`area`) ⇒
> l'IA, le ciblage et la validation existants marchent sans changement.
> **Aucun champ d'état neuf ⇒ pas de bump save, golden inchangé.**

## Mécanique (générique, zéro faction)

- Nouveau champ optionnel `SpellDef.chain?: { jumps: number; falloffPct: number }`
  sur un sort `kind: 'damage'`. Absent = sort de dégâts normal.
- Résolution : la cible d'abord (dégâts pleins), puis on saute vers l'ennemi
  vivant le plus proche NON encore touché, jusqu'à `jumps` sauts ; chaque saut
  multiplie les dégâts par `(1 − falloffPct/100)`. Déterministe (nearest par
  `hexDistance`, départage stable). Réutilise `damageOneStack` + le jet de chance
  unique du sort de dégâts (inchangé).
- Helper pur partagé `chainTargets(combat, center, jumps)` (dans `spell-effect.ts`)
  — consommé par la résolution ET la préviz (`estimateSpellWithPower`), zéro RNG.
- Préviz : agrège dégâts/kills sur les cibles de la chaîne (lucky=false).
- `kind` reste `damage` ⇒ `spellTargetsEnemy` inchangé, IA (`chooseHeroSpell`/
  `chooseSpellcast`) le lance déjà, contrainte de camp inchangée.

## Changements

- `packages/engine/src/hero/types.ts` : champ `chain?` sur `SpellDef`.
- `packages/engine/src/combat/spell-effect.ts` : `chainTargets` + branche chaîne
  dans le `kind === 'damage'` d'`applySpellToTargets`.
- `packages/engine/src/hero/index.ts` : `estimateSpellWithPower` agrège la chaîne.
- `packages/content/src/schemas.ts` : champ `chain` (jumps ≥ 1, falloffPct 0-100).
- `data/core/spells.json` : sort **chaine-d-eclairs** (Air, cercle 4) +
  locales FR/EN (nom + lore).
- doc 02 §1.4 (note État Chaîne) ; backlog `game-feature-gaps.md` H-SPELLS.4+.

## Vérification

- test moteur `combat-chain.test.ts` (ids OPAQUES) : la cible + les 2 ennemis
  les plus proches subissent des dégâts décroissants ; un seul ennemi ⇒ pas de
  saut (dégâts normaux) ; préviz agrège la chaîne.
- typecheck 5/5 · lint · engine (golden + save-shape **inchangés**) · content ·
  content:check · garde-fous faction/couleur · build + bundle < 800 Ko · smoke.
- `faction:sim` non requis (sort de héros ; armées de sim sans héros).

## Journal

- 2026-07-13 — Plan créé, branche `claude/h-spells-chain` depuis origin/main
  (après merge #330 dispel).
- 2026-07-13 — Implémenté : champ `chain?` (`SpellDef`), helper pur `chainTargets`
  + branche chaîne dans `applySpellToTargets`, préviz agrégée
  (`estimateSpellWithPower`), schéma content (+ refine « chain réservé aux dégâts »),
  sort `chaine-d-eclairs` (Air c4, 2 sauts −40 %) + locales FR/EN, doc 02 §1.4 + backlog.
- 2026-07-13 — Vérif : typecheck 5/5 · lint · engine 708/708 (dont `combat-chain`
  +3 ; golden + save-shape **inchangés**) · content 126/126 · content:check ·
  garde-fous faction/couleur · build · bundle gzip 311 Ko < 800 Ko. Smoke en cours.
