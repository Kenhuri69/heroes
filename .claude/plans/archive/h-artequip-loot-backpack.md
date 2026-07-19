# H-ARTEQUIP.2+ — Routage du butin (dépouille + quête) vers le sac

Backlog « H-ARTEQUIP.2+ reste » : la dépouille de combat (H-VS-H) et les
récompenses de quête débordaient au SOL / non attribuées quand les 10 slots
équipés sont pleins. Or le sac `hero.backpack` (save v29) existe et TOUT autre
ramassage (carte/gardien/visitable) y route déjà le surplus (jamais perdu).
Cohérence : router aussi ces deux sources vers le sac.

## Constat
- `combat/turns.ts:281-297` (dépouille H-VS-H) : surplus → objet `artifact` de
  carte au sol.
- `quest/evaluate.ts:61-67` (récompense artefact) : inventaire plein ⇒ récompense
  NON attribuée (perdue).
Pattern cible déjà en place ailleurs : `else (hero.backpack ??= []).push(id)`.

## Étapes
1. turns.ts: surplus de dépouille → `winnerHero.backpack` (retire le drop au sol).
2. evaluate.ts: récompense en surplus → `hero.backpack` (retire le non-attribué).
3. Tests: MAJ combat-hero-vs-hero (surplus → sac, plus au sol) ; +cas quest
   (récompense artefact inventaire plein → sac).
4. Docs (turns.ts commentaire + doc 02) ; backlog.

## Portée
`backpack` existe déjà (v29) ⇒ AUCUN champ neuf, pas de bump save. Golden :
quêtes null en golden (no-op evaluate) ; la dépouille H-VS-H overflow n’est pas
dans le replay ⇒ golden inchangé (à vérifier). Zéro faction.

## Statut
Étapes 1-4 implémentées. Non-smoke vert (typecheck·lint·engine 822 golden+save-shape inchangés·content·content:check·gardes 1/1·build·bundle 319Ko). Smoke en cours (non-régression).
