import type { Cutscene, Scenario } from '@heroes/content';
import { appStore } from './store';
import { panCameraTo, DEFAULT_PAN_MS } from './camera-control';
import { enqueueDialog } from './narrative';

/**
 * Cinématiques scriptées par la caméra (doc 13 §6.3, lot N3c.1) — PAS de vidéo.
 * Joue une séquence déclarative d'étapes (déplacer la caméra sur une tuile,
 * attendre, jouer un dialogue) sur la scène d'aventure. Skippable au tap via le
 * bouton **Passer** de `CutsceneOverlay`. Pure présentation : zéro diff moteur.
 *
 * Un jeton d'exécution identifie la cinématique courante ; « Passer » l'invalide,
 * ce qui fait résoudre tôt toutes les attentes en cours et interrompt la boucle.
 */
let activeToken: object | null = null;

/** Attente `ms` ms, résolue tôt si la cinématique a été passée. */
function wait(ms: number, token: object): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = (now: number): void => {
      if (activeToken !== token || now - start >= ms) return resolve();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** Enfile un dialogue puis attend que le joueur le ferme (ou que la cinématique soit passée). */
function playDialogStep(dialogId: string, token: object): Promise<void> {
  enqueueDialog(dialogId);
  return new Promise((resolve) => {
    const check = (): void => {
      if (activeToken !== token || appStore.getState().dialogue === null) {
        unsub();
        resolve();
      }
    };
    const unsub = appStore.subscribe(check);
    check(); // dialogue inconnu / déjà fermé : résout immédiatement
  });
}

/** Joue une cinématique du début à la fin (ou jusqu'au « Passer »). */
export async function playCutscene(cutscene: Cutscene): Promise<void> {
  const token = {};
  activeToken = token;
  appStore.setState({ cutsceneActive: true });
  for (const step of cutscene.steps) {
    if (activeToken !== token) break; // passée
    if (step.type === 'panTo') await panCameraTo(step.x, step.y, step.ms ?? DEFAULT_PAN_MS);
    else if (step.type === 'wait') await wait(step.ms, token);
    else await playDialogStep(step.dialog, token);
  }
  if (activeToken === token) activeToken = null;
  appStore.setState({ cutsceneActive: false, dialogue: null, dialogueQueue: [] });
}

/** « Passer » (doc 13 §6.3) : interrompt la cinématique et referme tout dialogue. */
export function skipCutscene(): void {
  activeToken = null;
  appStore.setState({ cutsceneActive: false, dialogue: null, dialogueQueue: [] });
}

/** Joue la cinématique d'ouverture d'un scénario, si définie (à appeler après `navigate`). */
export async function playOpeningCutscene(scenario: Scenario): Promise<void> {
  const id = scenario.openingCutscene;
  if (!id) return;
  const cut = scenario.cutscenes?.find((c) => c.id === id);
  if (cut) await playCutscene(cut);
}
