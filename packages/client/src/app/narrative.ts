import type { DialogNode, Scenario } from '@heroes/content';
import { eventBus } from './events';
import type { DailyQuestMeta } from './daily';
import { setCampaignFlag } from './campaign';
import { t } from './i18n';
import { appStore, type NarrativeCatalog, type QuestJournalEntry } from './store';
import { pushToast } from '../ui/toasts';

/** Un choix de dialogue (doc 13 §6.3, N3c.2) — forme du schéma de contenu. */
type DialogChoice = NonNullable<DialogNode['choices']>[number];

/**
 * Couche de présentation narrative (doc 13 §6.2/§6.3, lot N2b) : abonnée aux
 * événements de quête du moteur (`QuestStarted`/`QuestAdvanced`/`QuestCompleted`),
 * elle alimente le journal de quêtes et déclenche les dialogues (ouverture +
 * `dialogBefore`). Le moteur ignore tout de cette couche (déterminisme intact).
 */

/**
 * Purge l'état narratif et les journaux de la partie précédente (revue 2026-07,
 * B35) : narration (catalogue/dialogues/barks), journal de quêtes, journal
 * d'événements et journal de combat reviennent à leur valeur initiale
 * (`store.ts`). Point de purge COMMUN : appelé par les chemins de démarrage/
 * chargement qui ne chargent PAS de narration (« Nouvelle partie », partie
 * rapide `?seed=`, Continuer/import/cloud) — sans quoi les barks et quêtes de
 * l'ancienne campagne rejouaient dans la nouvelle partie. Les chemins
 * scénario/campagne passent par `loadScenarioNarrative`/`loadFreeModeNarrative`
 * (qui purgent PUIS posent le nouveau catalogue) — ne jamais purger APRÈS eux.
 */
export function resetNarrativeState(): void {
  appStore.setState({
    narrative: null,
    dialogue: null,
    dialogueQueue: [],
    questJournal: [],
    combatBark: null,
    journal: [],
    combatLog: [],
    journalUnread: 0,
  });
}

/** Charge le catalogue narratif d'un scénario et réinitialise l'état d'UI narratif. */
export function loadScenarioNarrative(scenario: Scenario): void {
  resetNarrativeState(); // purge aussi journal/combatLog de la partie précédente (B35)
  const catalog: NarrativeCatalog = {
    dialogs: Object.fromEntries((scenario.dialogs ?? []).map((d) => [d.id, d])),
    characters: Object.fromEntries((scenario.characters ?? []).map((c) => [c.id, c])),
    quests: Object.fromEntries(
      (scenario.quests ?? []).map((q) => [
        q.id,
        {
          titleKey: q.titleKey,
          ...(q.descriptionKey !== undefined ? { descriptionKey: q.descriptionKey } : {}),
          kind: q.kind,
          steps: q.steps.map((s) => ({
            id: s.id,
            ...(s.dialogBefore !== undefined ? { dialogBefore: s.dialogBefore } : {}),
          })),
        },
      ]),
    ),
    combatBarks: [...(scenario.combatBarks ?? [])],
  };
  appStore.setState({ narrative: catalog });
  // Dialogue d'ouverture (doc 13 §6.3) : joué avant les `dialogBefore` d'étape 0.
  if (scenario.openingDialog) enqueueDialog(scenario.openingDialog);
}

/**
 * Narration du mode libre (doc 13 §4.2, N4c) : catalogue minimal (quêtes seules,
 * sans dialogue ni bark) pour que les `QuestStarted` des quêtes journalières
 * peuplent le journal avec leur `kind: daily`. Appelé avant le `StartGame`
 * d'escarmouche, comme `loadScenarioNarrative` pour un scénario.
 */
export function loadFreeModeNarrative(metas: DailyQuestMeta[]): void {
  resetNarrativeState(); // purge aussi journal/combatLog de la partie précédente (B35)
  const catalog: NarrativeCatalog = {
    dialogs: {},
    characters: {},
    quests: Object.fromEntries(
      metas.map((m) => [
        m.id,
        {
          titleKey: m.titleKey,
          ...(m.descriptionKey !== undefined ? { descriptionKey: m.descriptionKey } : {}),
          kind: m.kind,
          steps: m.steps.map((s) => ({ id: s.id })),
        },
      ]),
    ),
    combatBarks: [],
  };
  appStore.setState({ narrative: catalog });
}

/**
 * Rafraîchissement journalier (N-DAILYREFRESH, doc 13 §4.2) : AJOUTE des métas de
 * contrats au catalogue narratif existant (sans clobber, contrairement à
 * `loadFreeModeNarrative`) pour que les nouveaux `daily-*` apparaissent au
 * journal. No-op hors mode libre (aucun catalogue narratif chargé).
 */
export function appendFreeModeQuests(metas: DailyQuestMeta[]): void {
  const { narrative } = appStore.getState();
  if (!narrative) return;
  const quests = { ...narrative.quests };
  for (const m of metas) {
    quests[m.id] = {
      titleKey: m.titleKey,
      ...(m.descriptionKey !== undefined ? { descriptionKey: m.descriptionKey } : {}),
      kind: m.kind,
      steps: m.steps.map((s) => ({ id: s.id })),
    };
  }
  appStore.setState({ narrative: { ...narrative, quests } });
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

/**
 * Résout un choix de dialogue (doc 13 §6.3, N3c.2) : pose le drapeau éventuel
 * (`setFlag`), puis saute au nœud `next` s'il existe, sinon enchaîne la file.
 */
export function chooseDialogueOption(choice: DialogChoice): void {
  if (choice.setFlag) setCampaignFlag(choice.setFlag);
  const { narrative } = appStore.getState();
  const nextNode = choice.next ? narrative?.dialogs[choice.next] : undefined;
  if (nextNode) appStore.setState({ dialogue: { node: nextNode, line: 0 } });
  else nextDialogueNode();
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
        kind: def.kind,
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
  pushToast(t('toast.questCompleted', { title: t(key) }), 'success');
}

/**
 * Barks de combat (doc 13 §6.3, N4b) : au DÉBUT d'un combat (transition
 * `combat` null→set), tire UNE réplique du pool du scénario au hasard **côté
 * client** (`Math.random` — hors moteur déterministe) et l'affiche ; la retire à
 * la fin du combat. Idempotent — à appeler une fois au boot (comme `initNarrative`).
 */
export function initCombatBarks(): void {
  let prevInCombat = false;
  appStore.subscribe(() => {
    const { game, narrative } = appStore.getState();
    const inCombat = game.combat !== null;
    // Pas de transition : rien à faire. Ce garde stoppe aussi la ré-entrance —
    // `setState` ci-dessous re-notifie ce même abonné en synchrone.
    if (inCombat === prevInCombat) return;
    prevInCombat = inCombat; // AVANT le setState (garde de ré-entrance)
    if (inCombat) {
      const pool = narrative?.combatBarks ?? [];
      if (pool.length > 0) {
        const bark = pool[Math.floor(Math.random() * pool.length)] ?? null;
        appStore.setState({ combatBark: bark });
      }
    } else {
      appStore.setState({ combatBark: null });
    }
  });
}
