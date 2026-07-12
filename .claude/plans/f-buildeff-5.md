# Lot F-BUILDEFF.5 — Cercle Abîme : +dégâts T7/T8 en défense de siège

> Backlog `.claude/plans/game-feature-gaps.md` §2.3 F-BUILDEFF.5+.
> Doc source : `docs/05-faction-arcane-hunters.md` §3.2 (Cercle **Abîme** : « T7/T8
> +10 % dégâts »).

## But

Ouvrir un point d'extension moteur **générique** : une aura de bâtiment
town-scoped `eliteDamagePct` (+ seuil `eliteMinTier`) qui accorde un bonus de
dégâts en **combat de siège** aux piles du camp défenseur (garnison du
propriétaire) dont le tier ≥ seuil. Câble le **Cercle Abîme** AH (passif de
design, remplace son placeholder). Réutilise le patron `townBuildingAura`
(Vigile/Statue du Jugement). Zéro nom de faction dans le moteur.

## Décisions de conception

- **Infra manquante comblée** : `CombatUnitDef.tier?` (optionnel, estampillé par
  `buildUnitCatalog` depuis `unit.tier`) — sans lui le moteur ne peut cibler
  « T7/T8 ». Optionnel ⇒ **zéro churn** des littéraux de test, machines de guerre
  sans tier gracieuses.
- **Portée** : town-scoped, **défenseur en siège** uniquement (comme
  `combatMoraleBonus`/`garrisonDefense`) — `combat.townId` + `side === 'defender'`
  + ville du propriétaire. Le camp assiégeant n'en profite pas.
- **Générique** : aura `heroAura { eliteDamagePct, eliteMinTier=7 }` (data-driven,
  seuil réglable). Le moteur lit des nombres opaques.
- **Câblage** : fondu dans `computeMultiplier` (nouveau facteur `eliteDamagePct`),
  reflété en préviz (`estimateAttack`).
- **Pas de nouvel état persisté** (aura lue à la volée) ⇒ **pas de bump save,
  golden inchangé** (le golden n'est pas un siège Abîme).

## Étapes

1. Engine `combat/types.ts` : `CombatUnitDef.tier?`.
2. Client `app/game.ts buildUnitCatalog` : `tier: unit.tier`.
3. Engine `town/types.ts` : `heroAura += eliteDamagePct?/eliteMinTier?`.
4. Content `schemas.ts` : `heroAura += eliteDamagePct(default 0)/eliteMinTier(default 7)`.
5. Engine `town/economy.ts` : helper `townEliteDamageBonus(state, playerId, pos, tier)`.
6. Engine `combat/state-helpers.ts` : `siegeEliteDamage(state, combat, side, def)`.
7. Engine `combat/damage.ts` : `computeMultiplier` gagne `eliteDamagePct` ;
   `performStrike` + `estimateAttack` le calculent et le passent.
8. Données `data/factions/arcane-hunters/buildings.json` : Cercle Abîme →
   `heroAura { eliteDamagePct: 10, eliteMinTier: 7 }` (remplace `growthBonus 40`).
9. Doc 05 §3.2 : Cercle Abîme livré.
10. Tests : engine (T8 défenseur en siège Abîme +10 % ; T6 non ; attaquant non ;
    hors siège non) ; content (l'aura valide).
11. Pipeline complet.

## Journal

- Branche `claude/f-buildeff-5` créée depuis main (d7ed47b).
- **Livré.** Aura générique `heroAura { eliteDamagePct, eliteMinTier }` (schéma +
  type moteur). `CombatUnitDef.tier?` estampillé par `buildUnitCatalog`. Helpers
  `townEliteDamageBonus` (economy) + `siegeEliteDamage` (state-helpers, défenseur
  en siège uniquement). Fondu dans `computeMultiplier` (`performStrike` +
  `estimateDamage` préviz). Données : Cercle Abîme → `heroAura { eliteDamagePct:
  10, eliteMinTier: 7 }` (remplace le placeholder `growthBonus 40`). Doc 05 §3.2.
- Aucun état persisté nouveau (aura lue à la volée, `tier?` optionnel) ⇒ **pas de
  bump save, golden inchangé** (le golden n'est pas un siège Abîme), zéro churn
  des littéraux `CombatUnitDef` de test.
- Vérifs : typecheck 5/5, lint, engine 628 (+6 `building-elite-damage`), content
  119, content:check, garde-fous faction+couleurs verts, build, bundle ~294 Ko
  gzip < 800, smoke 169 passed (exit 0 ; 1 flake local retenté vert, hors périmètre siège Abîme).
