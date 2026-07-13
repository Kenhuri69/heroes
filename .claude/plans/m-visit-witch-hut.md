# Lot M-VISIT — Cabane de la sorcière (grantSkill)

> Comble le dernier différé de M-VISIT (backlog §2.5) : la **cabane de
> compétence** (« Witch Hut ») — un lieu visitable qui enseigne une COMPÉTENCE
> au héros HORS montée de niveau. Nouveau variant `VisitableEffect` générique
> `grantSkill { skillId }`, patron exact du sanctuaire de sort `learnSpell`.
> **`hero.skills` déjà sérialisé ⇒ pas de bump save ; golden inchangé** (le
> golden-replay n'a pas de visitable). Doc 02 §2.2.

## Mécanique (générique, zéro faction)

- `VisitableEffect += { kind: 'grantSkill', skillId }` — à la visite, si le héros
  ne possède pas déjà la compétence, `hero.skills[skillId] = 1` (rang Novice),
  `amount = 1`. Idempotent : déjà connue ⇒ visite consommée, `amount = 0`.
- `skillId` = id opaque (aucune faction). Re-visite bornée par le registre
  existant (`oncePerHero` = à vie).
- Réutilise le pipeline `visitBonus`/`BonusVisited` (toast + fiche + silhouette).

## Changements

- `packages/engine/src/adventure/map.ts` : variant `grantSkill` de `VisitableEffect`.
- `packages/engine/src/adventure/visitable.ts` : branche `grantSkill` (idempotent).
- `packages/content/src/schemas.ts` : variant Zod ; `loader.ts` : union `ResolvedMapObject`.
- `packages/client/src/ui/MapObjectCard.tsx` : ligne `effectGrantSkill` (resolveSkillName).
- `packages/client/src/app/notifications.ts` : toast `bonusSkill` (amount 0 ⇒ pas de toast).
- `packages/client/src/render/mapObjects.ts` : teinte + silhouette « hutte » distincte.
- `data/core/locales/{fr,en}.json` : `mapCard.effectGrantSkill`, `toast.bonusSkill`.
- `data/maps/proto-01.map.json` : `cabane-1` (8,7) enseigne `scouting`.
- doc 02 §2.2 (note État Cabane) ; backlog `game-feature-gaps.md` M-VISIT.

## Vérification

- test moteur `map-visitables.test.ts` : la cabane enseigne la compétence
  (rang 1) ; idempotent (2ᵉ cabane ⇒ amount 0, rang inchangé) ; visite consommée
  à vie. (skillId OPAQUE.)
- typecheck 5/5 · lint · engine (golden + save-shape **inchangés**) · content ·
  content:check · garde-fous faction/couleur · build + bundle < 800 Ko · smoke.

## Journal

- 2026-07-13 — Plan créé, branche `claude/m-visit-witch-hut` depuis origin/main
  (après merges #330 dispel, #331 chaîne).
- 2026-07-13 — Implémenté : variant `grantSkill` (map + visitable handler + schéma +
  loader union), client (fiche `effectGrantSkill`, toast `bonusSkill`, teinte +
  silhouette « hutte »), locales FR/EN, proto-01 `cabane-1` (scouting), doc 02 §2.2
  + backlog.
- 2026-07-13 — Vérif : typecheck 5/5 · lint · engine 709/709 (dont witch-hut +1 ;
  golden + save-shape **inchangés**) · content 126/126 · content:check (proto-01
  valide) · garde-fous faction/couleur · build · bundle gzip 311 Ko < 800 Ko. Smoke en cours.
