import type { HeroState } from '@heroes/engine';
import { useApp } from '../app/store';
import { dispatch } from '../app/dispatch';
import { t, resolveSpellName, commandErrorMessage } from '../app/i18n';
import { pushToast } from './toasts';

/**
 * Livre des sorts d'**aventure** (doc 02 §1.4, Alpha 4.16) dans le tiroir héros :
 * liste les sorts connus de kind `adventure` (ex. Ville-portail) avec leur coût
 * en mana et un bouton « lancer » qui dispatche `CastAdventureSpell` (téléporte
 * vers la ville la plus proche). Masqué si le héros n'en connaît aucun.
 */
export function AdventureSpellbook({ hero }: { hero: HeroState }) {
  useApp((s) => s.locale); // réactivité i18n
  const catalog = useApp((s) => s.game.spellCatalog);
  const spells = hero.spells
    .map((id) => catalog[id])
    .filter((spell): spell is NonNullable<typeof spell> => spell?.kind === 'adventure');
  if (spells.length === 0) return null;

  const cast = (spellId: string): void => {
    // Le héros du tiroir appartient au joueur actif (`humanId`), donc `hero.playerId`
    // est le joueur courant côté moteur.
    dispatch({ type: 'CastAdventureSpell', heroId: hero.id, spellId, playerId: hero.playerId }).catch(
      (err: unknown) => pushToast(commandErrorMessage(err)),
    );
  };

  return (
    <section class="adventure-spellbook" data-testid="adventure-spellbook">
      <h3>{t('spellbook.adventureTitle')}</h3>
      <ul class="adventure-spell-list">
        {spells.map((spell) => (
          <li key={spell.id}>
            <button
              class="adventure-spell-cast"
              data-testid={`adventure-spell-${spell.id}`}
              disabled={hero.mana < spell.manaCost}
              onClick={() => cast(spell.id)}
            >
              {resolveSpellName(spell.id)}
              <span class="adventure-spell-cost">{t('spellbook.manaCost', { cost: spell.manaCost })}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
