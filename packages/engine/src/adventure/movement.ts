import { beginGuardianCombat } from '../combat/setup';
import type { GameEvent } from '../core/events';
import type { GameState, HeroState, PlayerState, ResourceId } from '../core/state';
import { heroVisionBonus } from '../hero/skills';
import { revealAround } from './fog';
import { samePos, type GridPos } from './map';
import { stepCost } from './path';
import { fireVisitTrigger } from './triggers';
import { recruitDwelling, visitBonus } from './visitable';

export interface AdvanceOptions {
  /**
   * Appelé après `beginGuardianCombat` quand un gardien intercepte le héros.
   * Le handler humain (`MoveHero`) le laisse indéfini : le combat reste
   * interactif (l'état conserve `draft.combat`). L'IA d'aventure y résout le
   * combat immédiatement (`runAutoCombat`) — IA vs IA, déterministe.
   */
  onGuardianEngaged?: () => void;
  /**
   * Appelé quand un trésor vient d'être foulé (`pendingTreasure` posé). Le
   * handler humain le laisse indéfini : le choix or/XP reste interactif. L'IA
   * d'aventure y résout le choix immédiatement (déterministe).
   */
  onTreasureFound?: () => void;
}

/**
 * Avance `hero` le long de `path`, pas à pas — logique unique partagée par le
 * handler `MoveHero` (joueur humain) et l'IA d'aventure (`runAiTurn`) :
 * décompte des PM (arrêt quand les points du jour ne suffisent plus,
 * doc 02 §1.5), interception de gardien (le héros paie le pas d'engagement
 * mais n'entre pas sur la tuile, décision plan phase-2.4), ramassage de
 * ressource/artefact (le héros s'arrête sur la case ramassée — choix UX
 * doc 08 §2.1 ; les mines, elles, se capturent en passant), brouillard.
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
    // Lieu de bonus / habitation (doc 02 §2.2) : visite en passant, comme la mine.
    for (const obj of map.objects) {
      if (!samePos(obj.pos, hero.pos)) continue;
      if (obj.type === 'visitable') visitBonus(draft, hero, player, obj, events);
      else if (obj.type === 'dwelling') recruitDwelling(draft, hero, player, obj, events);
    }
    // Mine (doc 02 §2.2) : capture en passant — le héros ne s'arrête pas, et
    // une mine adverse est recapturée par le même geste.
    const mine = map.objects.find((o) => o.type === 'mine' && samePos(o.pos, hero.pos));
    if (mine && mine.type === 'mine' && mine.ownerId !== player.id) {
      mine.ownerId = player.id;
      events.push({
        type: 'MineCaptured',
        playerId: player.id,
        objectId: mine.id,
        resource: mine.resource,
        amount: mine.amount,
        pos: { ...hero.pos },
      });
    }
    const objIndex = map.objects.findIndex(
      (o) =>
        (o.type === 'resource' || o.type === 'treasure' || o.type === 'artifact') &&
        samePos(o.pos, hero.pos),
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
        break;
      }
      // Trésor (doc 02 §2.2) : arrêt et choix or/XP en attente — l'objet n'est
      // retiré qu'à la résolution (`ResolveTreasure`).
      if (obj && obj.type === 'treasure') {
        draft.pendingTreasure = {
          heroId: hero.id,
          playerId: player.id,
          objectId: obj.id,
          gold: obj.gold,
          xp: obj.xp,
        };
        events.push({
          type: 'TreasureFound',
          heroId: hero.id,
          playerId: player.id,
          objectId: obj.id,
          gold: obj.gold,
          xp: obj.xp,
          pos: { ...hero.pos },
        });
        options.onTreasureFound?.();
        break;
      }
      // Artefact au sol (doc 02 §2.2) : ramassé vers le 1er slot libre ; s'il
      // n'y en a aucun, il reste au sol et le héros poursuit.
      if (obj && obj.type === 'artifact') {
        const slot = hero.artifacts.indexOf(null);
        if (slot !== -1) {
          hero.artifacts[slot] = obj.artifactId;
          map.objects.splice(objIndex, 1);
          events.push({
            type: 'ArtifactPicked',
            heroId: hero.id,
            playerId: player.id,
            objectId: obj.id,
            artifactId: obj.artifactId,
            pos: { ...hero.pos },
          });
          break;
        }
      }
    }
  }
}
