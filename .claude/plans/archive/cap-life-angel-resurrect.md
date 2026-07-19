# Lot CAP-LIFE.1 — résurrection de l'Ange (resurrectAlly)

> Câble la capacité spéciale **`resurrectAlly(1×/combat)`** de l'Ange Haven
> (doc 03 §3, lineup T7), jusqu'ici différée (« donnée non interprétée »).
> Backlog §2.2 CAP-LIFE. **Données pures** : le moteur est déjà prêt.

## Constat moteur (rien à écrire)

- Le `spellcaster` générique (unité lance un sort embarqué ×N charges) est livré
  et testé (Prêtresse `soin ×2`, plan CAP-CAST).
- Le `heal` **ressuscite déjà** intra-pile : `maxCount = count + lostSoFar`
  (`spell-effect.ts`, constat H-SPELLS.1), `lostSoFar` = pertes du ledger de combat.
- Le sort `resurrection` (water, cercle 4, heal, base 40 + 8/Pouvoir) existe déjà
  dans `data/core/spells.json` (H-SPELLS.2).

⇒ La résurrection de l'Ange = **`spellcaster(resurrection, charges:1, power:4)`**
en données, exactement comme la Prêtresse soigne. Zéro moteur, zéro save, golden
inchangé (Ange hors fixture golden).

## Changements

- `data/factions/haven/units/t7-ange.json` et `t7-ange-elite.json` : +ability
  `spellcaster(resurrection, charges:1, power:4)`.
- `docs/03-faction-haven.md` : lineup T7 (réalisation via `spellcaster`), notes de
  différé « État 3.3 » (resurrectAlly livré).
- Backlog : CAP-LIFE resurrectAlly (Ange) ✅.

## Vérification

- test moteur (mirroir `combat-spellcaster.test.ts`) : un Ange `spellcaster`
  RESSUSCITE une pile alliée qui a perdu des créatures (`recordLoss` → `lostSoFar`
  > 0 ⇒ `count` remonte), charge décrémentée, event `UnitSpellCast`.
- typecheck 5/5 · lint · golden + save-shape **inchangés** · content + content:check
  (cross-validation `spellId`) · `faction:sim` (pas de blowout Haven) · garde-fous ·
  build + bundle · smoke.

## Journal

- 2026-07-12 — Plan créé, branche `claude/cap-life-angel-resurrect` depuis origin/main.
- 2026-07-12 — Données : `spellcaster(resurrection, ×1)` sur l'Ange (power 4) et
  l'Ange élite (power 5). content:check OK (cross-validation `spellId`).
- 2026-07-12 — Test faction-recruit mis à jour (capacités attendues de l'Ange T7)
  + nouveau test moteur de résurrection (relève 3 grunts décimés).
- 2026-07-12 — `faction:sim` : **0 déséquilibre béant** ; Haven reste côté
  mi/faible ⇒ buff sain, aucun blowout.
- 2026-07-12 — Vérif verte : typecheck 5/5 · lint · engine 684/684 (golden +
  save-shape **inchangés**) · content 125/125 · content:check · garde-fous · build ·
  bundle gzip 300 Ko < 800 Ko.
