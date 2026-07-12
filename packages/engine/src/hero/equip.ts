import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState, HeroState } from '../core/state';

type EquipCmd = Extract<Command, { type: 'EquipArtifact' }>;
type UnequipCmd = Extract<Command, { type: 'UnequipArtifact' }>;

const SLOTS = 10;

/**
 * Équiper / déséquiper un artefact (H-ARTEQUIP, doc 08 §2.3) — le héros
 * appartient au **joueur actif**, jamais en combat. `artifacts` (10 slots)
 * contribue aux bonus, `backpack` non : équiper remonte du sac vers un slot
 * libre, déséquiper redescend un slot vers le sac. Purement déterministe (aucun
 * RNG). Aucun événement dédié (surface `events.ts` figée, comme `SplitStack`) :
 * le rendu observe la mutation de `hero.artifacts`/`hero.backpack`.
 */
function ownedActiveHero(state: GameState, heroId: string): HeroState | CommandError {
  if (state.combat) return { code: 'combatActive', message: 'un combat est en cours' };
  const hero = state.heroes.find((h) => h.id === heroId);
  if (!hero) return { code: 'unknownHero', message: `héros inconnu '${heroId}'` };
  const current = state.players[state.currentPlayer];
  if (!current || hero.playerId !== current.id)
    return { code: 'notYourHero', message: `'${heroId}' n’appartient pas au joueur actif` };
  return hero;
}

export function validateUnequipArtifact(state: GameState, cmd: UnequipCmd): CommandError | null {
  const hero = ownedActiveHero(state, cmd.heroId);
  if ('code' in hero) return hero;
  if (!Number.isInteger(cmd.slot) || cmd.slot < 0 || cmd.slot >= SLOTS)
    return { code: 'invalidEquip', message: `slot d'artefact invalide (${cmd.slot})` };
  if (!hero.artifacts[cmd.slot])
    return { code: 'invalidEquip', message: `aucun artefact au slot ${cmd.slot}` };
  return null;
}

export function handleUnequipArtifact(draft: GameState, cmd: UnequipCmd): void {
  const hero = draft.heroes.find((h) => h.id === cmd.heroId);
  const artifactId = hero?.artifacts[cmd.slot];
  if (!hero || !artifactId) return; // exclu par validate
  hero.artifacts[cmd.slot] = null;
  (hero.backpack ??= []).push(artifactId);
}

export function validateEquipArtifact(state: GameState, cmd: EquipCmd): CommandError | null {
  const hero = ownedActiveHero(state, cmd.heroId);
  if ('code' in hero) return hero;
  const backpack = hero.backpack ?? [];
  if (!Number.isInteger(cmd.index) || cmd.index < 0 || cmd.index >= backpack.length)
    return { code: 'invalidEquip', message: `case de sac invalide (${cmd.index})` };
  if (!hero.artifacts.includes(null))
    return { code: 'invalidEquip', message: 'aucun emplacement d’artefact libre (10 max)' };
  return null;
}

export function handleEquipArtifact(draft: GameState, cmd: EquipCmd): void {
  const hero = draft.heroes.find((h) => h.id === cmd.heroId);
  if (!hero || !hero.backpack) return; // exclu par validate
  const artifactId = hero.backpack[cmd.index];
  const freeSlot = hero.artifacts.indexOf(null);
  if (artifactId === undefined || freeSlot === -1) return; // exclu par validate
  hero.artifacts[freeSlot] = artifactId;
  hero.backpack.splice(cmd.index, 1);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- pas d'événement dédié (surface figée events.ts)
export function applyEquipArtifact(draft: GameState, cmd: EquipCmd, events: GameEvent[]): void {
  handleEquipArtifact(draft, cmd);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- pas d'événement dédié (surface figée events.ts)
export function applyUnequipArtifact(draft: GameState, cmd: UnequipCmd, events: GameEvent[]): void {
  handleUnequipArtifact(draft, cmd);
}
