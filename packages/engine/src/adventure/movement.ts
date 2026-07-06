import { beginGuardianCombat } from '../combat/setup';
import type { GameEvent } from '../core/events';
import type { GameState, HeroState, PlayerState, ResourceId } from '../core/state';
import { heroVisionBonus } from '../hero/skills';
import { revealAround } from './fog';
import { samePos, type GridPos } from './map';
import { stepCost } from './path';
import { fireVisitTrigger } from './triggers';

export interface AdvanceOptions {
  /**
   * Appelé après `beginGuardianCombat` quand un gardien intercepte le héros.
   * Le handler humain (`MoveHero`) le laisse indéfini : le combat reste
   * interactif (l'état conserve `draft.combat`). L'IA d'aventure y résout le
   * combat immédiatement (`runAutoCombat`) — IA vs IA, déterministe.
   */
  onGuardianEngaged?: () => void;
}

/**
 * Avance `hero` le long de `path`, pas à pas — logique unique partagée par le
 * handler `MoveHero` (joueur humain) et l'IA d'aventure (`runAiTurn`) :
 * décompte des PM (arrêt quand les points du jour ne suffisent plus,
 * doc 02 §1.5), interception de gardien (le héros paie le pas d'engagement
 * mais n'entre pas sur la tuile, décision plan phase-2.4), ramassage de
 * ressource (arrêt sur la case, doc 02 §2.2), révélation du brouillard.
 *
 * Seule divergence humain/IA : la résolution du combat de gardien, injectée
 * via `options.onGuardianEngaged` (cf. `AdvanceOptions`).
 */
export function advanceHeroAlongPath(
  draft: GameState,
  hero: HeroState,
  player: PlayerState,
  path: readonly GridPos[],
  events: GameEvent[],
  options: AdvanceOptions = {},
): void {
  const map = draft.map;
  const config = draft.config;
  if (!map || !config) return;
  for (const step of path) {
    const cost = stepCost(config, map, hero.pos, step);
    if (cost > hero.movementPoints) break;
    const guardian = map.objects.find((o) => o.type === 'guardian' && samePos(o.pos, step));
    if (guardian) {
      hero.movementPoints -= cost;
      beginGuardianCombat(draft, hero.id, guardian.id, events);
      options.onGuardianEngaged?.();
      return;
    }
    const from = { ...hero.pos };
    hero.movementPoints -= cost;
    hero.pos = { ...step };
    revealAround(
      player.explored,
      map,
      hero.pos,
      config.visionRadius + heroVisionBonus(hero, draft.skillCatalog),
    );
    events.push({
      type: 'MoveStepped',
      heroId: hero.id,
      from,
      to: { ...step },
      movementPointsLeft: hero.movementPoints,
    });
    // Trigger de visite (doc 02 §2.1) — la tuile foulée peut porter un effet.
    fireVisitTrigger(draft, player, hero.pos, events);
    const objIndex = map.objects.findIndex(
      (o) => o.type === 'resource' && samePos(o.pos, hero.pos),
    );
    if (objIndex !== -1) {
      const obj = map.objects[objIndex];
      if (obj && obj.type === 'resource') {
        player.resources[obj.resource as ResourceId] += obj.amount;
        map.objects.splice(objIndex, 1);
        events.push({
          type: 'ResourcePicked',
          heroId: hero.id,
          playerId: player.id,
          objectId: obj.id,
          resource: obj.resource,
          amount: obj.amount,
          pos: { ...hero.pos },
        });
      }
      break;
    }
  }
}
