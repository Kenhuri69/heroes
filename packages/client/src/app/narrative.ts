import type { Scenario } from '@heroes/content';
import { eventBus } from './events';
import { t } from './i18n';
import { appStore, type NarrativeCatalog, type QuestJournalEntry } from './store';
import { pushToast } from '../ui/toasts';

/**
 * Couche de présentation narrative (doc 13 §6.2/§6.3, lot N2b) : abonnée aux
 * événements de quête du moteur (`QuestStarted`/`QuestAdvanced`/`QuestCompleted`),
 * elle alimente le journal de quêtes et déclenche les dialogues (ouverture +
 * `dialogBefore`). Le moteur ignore tout de cette couche (déterminisme intact).
 */

/** Charge le catalogue narratif d'un scénario et réinitialise l'état d'UI narratif. */
export function loadScenarioNarrative(scenario: Scenario): void {
  const catalog: NarrativeCatalog = {
    dialogs: Object.fromEntries((scenario.dialogs ?? []).map((d) => [d.id, d])),
    characters: Object.fromEntries((scenario.characters ?? []).map((c) => [c.id, c])),
    quests: Object.fromEntries(
      (scenario.quests ?? []).map((q) => [
        q.id,
        {
          titleKey: q.titleKey,
          ...(q.descriptionKey !== undefined ? { descriptionKey: q.descriptionKey } : {}),
          steps: q.steps.map((s) => ({
            id: s.id,
            ...(s.dialogBefore !== undefined ? { dialogBefore: s.dialogBefore } : {}),
          })),
        },
      ]),
    ),
  };
  appStore.setState({ narrative: catalog, dialogue: null, dialogueQueue: [], questJournal: [] });
  // Dialogue d'ouverture (doc 13 §6.3) : joué avant les `dialogBefore` d'étape 0.
  if (scenario.openingDialog) enqueueDialog(scenario.openingDialog);
}

/** Enfile un dialogue : joué immédiatement si aucun n'est actif, sinon en attente. */
export function enqueueDialog(dialogId: string): void {
  const { narrative, dialogue, dialogueQueue } = appStore.getState();
  const node = narrative?.dialogs[dialogId];
  if (!node) return;
  if (dialogue) appStore.setState({ dialogueQueue: [...dialogueQueue, dialogId] });
  else appStore.setState({ dialogue: { node, line: 0 } });
}

/** Passe à la ligne suivante ; à la fin du nœud, enchaîne le dialogue en attente. */
export function advanceDialogue(): void {
  const { dialogue } = appStore.getState();
  if (!dialogue) return;
  if (dialogue.line < dialogue.node.lines.length - 1) {
    appStore.setState({ dialogue: { node: dialogue.node, line: dialogue.line + 1 } });
  } else {
    nextDialogueNode();
  }
}

/** « Passer » (doc 13 §6.3) : saute le nœud entier → dialogue en attente ou rien. */
export function skipDialogue(): void {
  if (appStore.getState().dialogue) nextDialogueNode();
}

function nextDialogueNode(): void {
  const { narrative, dialogueQueue } = appStore.getState();
  const [nextId, ...rest] = dialogueQueue;
  const node = nextId ? narrative?.dialogs[nextId] : undefined;
  appStore.setState({ dialogue: node ? { node, line: 0 } : null, dialogueQueue: rest });
}

function upsertJournalEntry(entry: QuestJournalEntry): void {
  const journal = appStore.getState().questJournal;
  const idx = journal.findIndex((e) => e.id === entry.id);
  const next = idx >= 0 ? journal.map((e) => (e.id === entry.id ? entry : e)) : [...journal, entry];
  appStore.setState({ questJournal: next });
}

/**
 * Branche la couche narrative sur le bus d'événements moteur (une fois au boot,
 * comme l'autosave). Idempotent au sens : à n'appeler qu'une fois.
 */
export function initNarrative(): void {
  eventBus.on((event) => {
    const { narrative, questJournal } = appStore.getState();
    if (!narrative) return;
    if (event.type === 'QuestStarted') {
      const def = narrative.quests[event.questId];
      if (!def) return;
      upsertJournalEntry({
        id: event.questId,
        titleKey: def.titleKey,
        ...(def.descriptionKey !== undefined ? { descriptionKey: def.descriptionKey } : {}),
        stepIndex: 0,
        stepCount: def.steps.length,
        status: 'active',
      });
      // `dialogBefore` de l'étape 0 (entrée d'étape, doc 13 §6.1).
      const first = def.steps[0];
      if (first?.dialogBefore) enqueueDialog(first.dialogBefore);
    } else if (event.type === 'QuestAdvanced') {
      const entry = questJournal.find((e) => e.id === event.questId);
      const def = narrative.quests[event.questId];
      if (!entry || !def) return;
      const stepIndex = Math.min(entry.stepIndex + 1, def.steps.length);
      upsertJournalEntry({ ...entry, stepIndex });
      // Dialogue joué à l'entrée de la NOUVELLE étape courante, s'il y en a une.
      const entered = def.steps[stepIndex];
      if (entered?.dialogBefore) enqueueDialog(entered.dialogBefore);
    } else if (event.type === 'QuestCompleted') {
      const entry = questJournal.find((e) => e.id === event.questId);
      if (!entry) return;
      upsertJournalEntry({ ...entry, status: 'completed' });
      pushQuestToast(entry.titleKey);
    }
  });
}

function pushQuestToast(titleKey: string): void {
  const key = titleKey.startsWith('@loc:') ? titleKey.slice('@loc:'.length) : titleKey;
  pushToast(t('toast.questCompleted', { title: t(key) }));
}
