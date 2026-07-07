import { useApp } from '../app/store';
import { skipCutscene } from '../app/cutscene';
import { t } from '../app/i18n';
import './CutsceneOverlay.css';

/**
 * Habillage des cinématiques caméra (doc 13 §6.3, lot N3c.1) : deux bandes noires
 * (letterbox) façon cinéma pendant qu'une cinématique joue, plus un bouton
 * **Passer** persistant (≥ 44 px, touch-first) qui l'interrompt. Les barres
 * laissent passer les clics (la caméra/scène sous-jacente reste inerte pendant la
 * cinématique) ; seul le bouton capture le tap. Rien ne s'affiche hors cinématique.
 */
export function CutsceneOverlay() {
  const active = useApp((s) => s.cutsceneActive);
  if (!active) return null;
  return (
    <div class="cutscene-overlay" data-testid="cutscene-overlay" aria-hidden="true">
      <div class="cutscene-bar cutscene-bar-top" />
      <div class="cutscene-bar cutscene-bar-bottom" />
      <button class="cutscene-skip" data-testid="cutscene-skip" onClick={skipCutscene}>
        {t('cutscene.skip')}
      </button>
    </div>
  );
}
