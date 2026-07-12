# Lot H-ARTEQUIP.1 — Équiper / déséquiper des artefacts (+ sac)

> Backlog §2.4 H-ARTEQUIP. Aujourd'hui : `hero.artifacts` = 10 slots plats (tous
> contribuent aux bonus), poupée UI en **lecture seule**, débordement de
> ramassage **perdu** (reste au sol). Ce lot ouvre le sac + équiper/déséquiper.

## Périmètre (H-ARTEQUIP.1)

- **Sac** : `HeroState.backpack: string[]` (artefacts NON équipés, aucun bonus).
  Save **v28→29**, save-shape (`HeroKey += backpack`), golden re-fixé (forme).
- **Commandes génériques** (joueur actif, hors combat) :
  - `UnequipArtifact { heroId, slot }` : `artifacts[slot]` (non-null) → sac.
  - `EquipArtifact { heroId, index }` : `backpack[index]` → 1er slot équipé libre
    (refus si les 10 slots sont pleins).
- **Débordement de ramassage carte → sac** (`adventure/movement.ts`) : un artefact
  foulé va au 1er slot libre, sinon au **sac** (plus jamais « reste au sol »). Le
  sac donne enfin un sens au >10 artefacts.
- **UI** (`HeroInventory`) : poupée typée (inchangée visuellement) dont chaque
  artefact équipé est **tap → déséquiper** ; nouvelle section **Sac** dont chaque
  artefact est **tap → équiper** (grisé si 10 slots pleins). Touch-first ≥ 44px.

## Différés (notés)

- Dépouille de combat (`combat/turns.ts`, surplus au sol) et récompense de quête
  (`quest/evaluate.ts`, non attribuée) : comportement de débordement INCHANGÉ ce
  lot (design/tests propres) — routage vers le sac = suivi.
- Slots typés contraignants, sets à seuils, effets spéciaux déclaratifs.

## Étapes / vérif

1. Moteur (state+commandes+movement) → tests `hero-equip.test.ts` + maj test
   overflow `map-objects`.
2. save-shape + golden re-fixés une fois (forme).
3. UI interactive + locales FR/EN + toasts.
4. Pipeline complet : typecheck 5/5, lint, engine+content tests, content:check,
   garde-fous faction/couleurs, build+bundle < 800 Ko, smoke (nouveau : déséquiper
   → sac → rééquiper dans le tiroir héros).

## Journal

- 2026-07-12 — Plan créé, branche `claude/h-artequip` depuis main (@5c48d6c).
- 2026-07-12 — **Implémenté**. Moteur : `HeroState.backpack?` (v28→**29**,
  optionnel façon `stealthed` pour ne pas casser 28 literals de test) ; `hero/equip.ts`
  (`EquipArtifact`/`UnequipArtifact`, joueur actif + hors combat, code `invalidEquip`) ;
  débordement de ramassage carte → sac (`movement.ts`) ; init `backpack: []` aux 2
  sites de création (engine/recruit) ; enregistrement engine.ts (liste + validate +
  apply). save-shape `HeroKey += backpack` + `CURRENT_SAVE_VERSION 29` ; golden
  re-fixé `af8a45c4` (forme). Test overflow `map-objects` mis à jour (sac).
  Client : `HeroInventory` interactive (tap déséquiper poupée/autres, tap équiper
  sac, grisé si plein), locales FR/EN + CSS (tokens). Doc backlog H-ARTEQUIP.1 ✅.
  **Vérifs** : typecheck 5/5 ✅, lint ✅, engine **654** (+5 `hero-equip`, golden+
  save-shape re-fixés) ✅, content 123 + content:check ✅, parité FR/EN ✅, garde-fous
  faction/couleurs ✅, build + bundle 306 Ko gzip ✅. Smoke (nouveau : déséquiper→
  sac→rééquiper) en cours.
