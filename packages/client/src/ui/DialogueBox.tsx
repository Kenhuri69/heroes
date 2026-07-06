import { useApp } from '../app/store';
import { advanceDialogue, skipDialogue } from '../app/narrative';
import { t, resolveLoc } from '../app/i18n';
import './DialogueBox.css';

/**
 * Boîte de dialogue narrative (doc 13 §6.3, lot N2b) : bandeau plein-largeur en
 * bas d'écran — portrait/nom du locuteur + réplique, « toucher pour continuer »,
 * bouton **Passer** persistant (≥ 44 px). Touch-first : un tap n'importe où sur
 * la boîte avance ; le bouton Passer saute le nœud entier. `rem` → 3 crans de
 * police. Rien ne s'affiche hors dialogue.
 */
export function DialogueBox() {
  const dialogue = useApp((s) => s.dialogue);
  // Sélectionner une référence STABLE (`narrative`), pas un objet dérivé frais :
  // `?? {}` dans un sélecteur `useSyncExternalStore` casse l'égalité de snapshot
  // et provoque une boucle de rendu infinie (page qui ne charge jamais).
  const narrative = useApp((s) => s.narrative);
  if (!dialogue) return null;
  const characters = narrative?.characters ?? {};

  const line = dialogue.node.lines[dialogue.line];
  if (!line) return null;
  const speaker = characters[line.speaker];
  const speakerName = speaker ? resolveScenarioLoc(speaker.nameKey) : line.speaker;
  const last = dialogue.line >= dialogue.node.lines.length - 1;

  return (
    <div class="dialogue-box" data-testid="dialogue-box" onClick={advanceDialogue}>
      <div class="dialogue-portrait" data-portrait={line.portrait ?? 'neutre'} aria-hidden="true">
        {speakerName.slice(0, 1)}
      </div>
      <div class="dialogue-body">
        <p class="dialogue-speaker">{speakerName}</p>
        <p class="dialogue-text" data-testid="dialogue-text">
          {resolveScenarioLoc(line.textKey)}
        </p>
        <p class="dialogue-hint">{t('dialogue.tapContinue')}</p>
      </div>
      <button
        class="dialogue-skip"
        data-testid="dialogue-skip"
        onClick={(e) => {
          e.stopPropagation();
          skipDialogue();
        }}
      >
        {last ? t('dialogue.tapContinue') : t('dialogue.skip')}
      </button>
    </div>
  );
}

/**
 * Résout une clé narrative (`@loc:` vers les locales CORE — les scénarios y
 * logent leurs textes, comme `scenario.<id>.name`). Repli sur la clé brute.
 */
function resolveScenarioLoc(ref: string): string {
  const key = ref.startsWith('@loc:') ? ref.slice('@loc:'.length) : ref;
  const value = t(key);
  return value === key ? resolveLoc(ref) : value;
}
