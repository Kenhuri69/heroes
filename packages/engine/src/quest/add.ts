import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';

type AddQuestsCmd = Extract<Command, { type: 'AddQuests' }>;

/**
 * N-DAILYREFRESH (doc 13 §4.2) — ajoute des quêtes en cours de partie (le mode
 * libre rafraîchit ses contrats journaliers au passage de jour). Générique :
 * les défs sont opaques (titres/dialogues côté client). `evaluateQuests` (appelé
 * après chaque commande dans `apply`) fera avancer les nouvelles quêtes.
 */
export function validateAddQuests(state: GameState): CommandError | null {
  if (!state.started) return { code: 'gameNotStarted', message: 'la partie n’est pas démarrée' };
  return null;
}

export function handleAddQuests(draft: GameState, cmd: AddQuestsCmd, events: GameEvent[]): void {
  if (!draft.quests) draft.quests = { quests: [] };
  for (const def of cmd.quests) {
    // Idempotent : ne pas ré-ajouter une quête déjà présente (dédup par id).
    if (draft.quests.quests.some((q) => q.def.id === def.id)) continue;
    draft.quests.quests.push({ def, stepIndex: 0, status: 'active' });
    events.push({ type: 'QuestStarted', questId: def.id });
  }
}
