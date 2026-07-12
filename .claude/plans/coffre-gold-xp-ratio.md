# Plan — Ratio or/XP des coffres + butin des gardiens

Demande utilisateur :
1. **Coffre** : corriger le ratio proposé — **1 or pour 0,8 XP** (« principe du
   random parfait » : l'or est la magnitude aléatoire, l'XP en dérive par 0,8).
2. **Gardiens** : vaincre un gardien peut **offrir des ressources**, voire un
   **artefact au niveau élevé** (gardien fort).

## Constat (état actuel)

- `mapgen.ts` roule `gold` et `xp` **indépendamment** (gold ~[500,1500]×prof,
  xp ~[200,600]×prof) ⇒ ratio incohérent (un coffre peut offrir 1500 or **ou**
  200 XP). Bug.
- `data/maps/proto-01` : coffres 1000/800 et 1500/1200 → déjà 0,8 ✓.
- `data/maps/proto-02` : coffre 1000/**400** → 0,4 ✗ (à corriger en 800).
- `MapEditor` défaut : 1000/800 → 0,8 ✓.
- Gardien vaincu : **aucun butin** aujourd'hui (l'objet est juste retiré ;
  seul l'objet gardé, M-GUARDLINK, se libère).

## Partie 1 — Ratio coffre (données uniquement, zéro diff moteur)

Le moteur présente fidèlement ce que la donnée déclare ; le « bug » est une
donnée incohérente. On lie l'XP à l'or à la **génération** + on corrige les
cartes livrées + on documente le ratio.

1. `packages/content/src/mapgen.ts` : `gold` aléatoire inchangé,
   `xp = Math.round(gold * 0.8)`. → verif : `pnpm --filter @heroes/content test`.
2. `data/maps/proto-02.map.json` : coffre `xp` 400 → 800. → verif : content:check.
3. `docs/02-mechanics.md` §2.2 : documenter le ratio **1 or : 0,8 XP**.

Pas de bump save, golden inchangé (aucun coffre dans le golden).

## Partie 2 — Butin de gardien (point d'extension moteur GÉNÉRIQUE)

Récompense **data-driven, déterministe (RNG seedé), faction-agnostique** —
piloté par un bloc de config optionnel, jamais un nom de faction.

4. Config `config.adventure.guardianReward` (optionnel) + schéma + interface :
   ```
   goldPerHp, variancePercent,
   resources: string[] (ids opaques),
   resourceThresholdHp, resourceAmount:{min,max},
   artifactThresholdHp, artifactChancePercent
   ```
   Absent ⇒ aucun butin (fixtures/golden épargnés).
5. `packages/engine/src/adventure/guardian-reward.ts` :
   `rewardGuardianDefeat(draft, hero, guardianObjectId, events)` — force =
   `hp × count` du gardien ; or (variance seedée) ; ressource au-delà d'un
   seuil ; chance d'artefact au-delà d'un seuil plus haut. Tous les tirages via
   `draft.rng` (ordre fixe). Générique : ids de ressource/artefact opaques.
6. `combat/turns.ts` : appel dans le bloc victoire-gardien (avant le retrait de
   l'objet), à côté de `rewardHuntContract`.
7. Event `GuardianVanquished` (or/ressource/artefact) + toast client i18n
   (FR/EN) + `default` déjà présent (pas d'exhaustivité cassée).
8. Config `data/core/config.json` : bloc `guardianReward` réel (jeux réels ON).

### Vérifications
- `pnpm --filter @heroes/engine test` (nouveau test unitaire déterministe du
  butin : or crédité, ressource au seuil, artefact au seuil haut ; RNG stable).
- Golden : config golden **sans** `guardianReward` ⇒ no-op ⇒ hash **inchangé**.
- `pnpm -w typecheck && pnpm -w lint`.
- Smoke Playwright (build prod) : non-régression carte/combat.
- Budget bundle < 800 Ko gzip.

## Suivi
- [x] P1.1 mapgen ratio (`xp = round(gold × 0,8)`)
- [x] P1.2 proto-02 (xp 400 → 800 ; proto-01 & MapEditor déjà à 0,8)
- [x] P1.3 doc 02 §2.2 (ratio 1 or : 0,8 XP documenté)
- [x] P2.4 config schema (`guardianReward`) + interface `GuardianRewardConfig`
- [x] P2.5 module `guardian-reward.ts` + test unitaire déterministe (5 cas)
- [x] P2.6 branchement `combat/turns.ts` (bloc victoire-gardien)
- [x] P2.7 event `GuardianVanquished` + toast composé + locales FR/EN
- [x] P2.8 `data/core/config.json` (bloc `guardianReward` réel)
- [x] Vérifs : typecheck ✓, lint ✓, engine 660 ✓ (golden **inchangé**), content
      123 ✓, content:check ✓, garde-fou faction ✓, build < budget ✓, smoke 104 ✓

## Notes de décision
- **Ratio coffre = données pures** (mapgen + carte livrée + doc), zéro diff
  moteur, pas de bump save : le moteur présente fidèlement la donnée, on la rend
  cohérente à la source. proto-01 (1000/800, 1500/1200) prouvait déjà l'intention
  0,8.
- **Butin gardien = point d'extension moteur générique** piloté par config
  optionnelle (absente ⇒ no-op ⇒ golden/fixtures épargnés, pas de bump save).
  Ids de ressource/artefact opaques ⇒ garde-fou « zéro faction » maintenu.
  Force = PV totaux (`hp × count`) ; or toujours, ressource au seuil, artefact au
  seuil haut (« niveau élevé »). Tirages via `draft.rng` (ordre fixe).
