import { armyStrength } from '@heroes/engine';
import type { CombatStack } from '@heroes/engine';
import { appStore, useApp } from '../app/store';
import { dispatch } from '../app/dispatch';
import { recordCombatAuto } from '../app/telemetry';
import { heroArchetype } from '../app/game';
import { t, resolveUnitName, commandErrorMessage } from '../app/i18n';
import { heroAvatarUrl, unitSpriteUrl } from '../render/assets';
import { AssetImg } from './AssetImg';
import { FactionBadge } from './FactionBadge';
import { pushToast } from './toasts';
import './PreBattleScreen.css';

/**
 * Écran pré-combat (Lot 1, fidélité HoMM Online — capture 3) : intercalé au
 * démarrage de tout combat (`preBattlePending`). Compare la **puissance de
 * combat** des deux camps (`armyStrength`, même métrique que le graphe de fin de
 * partie) et propose « Combattre » (conduite manuelle) ou « Auto-Battle »
 * (résolution déterministe immédiate). Aucune logique moteur : le combat est
 * déjà mis en place par le moteur, cet écran ne fait que différer l'affichage de
 * `CombatUi` (le canvas hex est déjà rendu derrière).
 */
export function PreBattleScreen() {
  useApp((s) => s.locale); // réactivité i18n
  const combat = useApp((s) => s.game.combat);
  const game = useApp((s) => s.game);
  if (!combat) return null;

  const attackers = combat.stacks.filter((s) => s.side === 'attacker');
  const defenders = combat.stacks.filter((s) => s.side === 'defender');
  const attackerPower = armyStrength(attackers, game.unitCatalog);
  const defenderPower = armyStrength(defenders, game.unitCatalog);

  const hero = combat.attackerHeroId
    ? game.heroes.find((h) => h.id === combat.attackerHeroId)
    : undefined;
  const attackerFaction = hero?.factionId ?? factionOf(attackers, game.unitCatalog);
  const defTop = dominant(defenders);
  const defenderFaction = factionOf(defenders, game.unitCatalog);

  const fight = (): void => {
    appStore.setState({ preBattlePending: false });
  };
  const auto = (): void => {
    recordCombatAuto(); // délégation = « abandon » manuel (télémétrie opt-in)
    appStore.setState({ preBattlePending: false });
    dispatch({ type: 'AutoCombat' }).catch((err: unknown) => pushToast(commandErrorMessage(err), 'error'));
  };

  return (
    <div class="pre-battle-backdrop" data-testid="pre-battle">
      <div class="pre-battle" role="dialog" aria-modal="true" aria-label={t('preBattle.title')}>
        <h2 class="pre-battle-title">{t('preBattle.title')}</h2>
        <div class="pre-battle-sides">
          <div class="pre-battle-side">
            <div class="pre-battle-portrait">
              {hero ? (
                <AssetImg
                  src={heroAvatarUrl(hero.factionId, heroArchetype(hero.attributes))}
                  alt=""
                  class="pre-battle-avatar"
                  fallback={<FactionBadge factionId={hero.factionId} />}
                />
              ) : attackerFaction ? (
                <FactionBadge factionId={attackerFaction} />
              ) : null}
            </div>
            <span class="pre-battle-name">{t('preBattle.attacker')}</span>
            <span class="pre-battle-power" data-testid="pre-battle-power-attacker">
              {attackerPower}
            </span>
          </div>

          <div class="pre-battle-versus">
            <span class="pre-battle-versus-label">{t('preBattle.battlePower')}</span>
            <span class="pre-battle-versus-value">
              {attackerPower} · {defenderPower}
            </span>
          </div>

          <div class="pre-battle-side">
            <div class="pre-battle-portrait">
              {defTop ? (
                <AssetImg
                  src={unitSpriteUrl(defTop.unitId, defenderFaction)}
                  alt=""
                  class="pre-battle-avatar"
                  fallback={defenderFaction ? <FactionBadge factionId={defenderFaction} /> : undefined}
                />
              ) : null}
            </div>
            <span class="pre-battle-name">
              {defTop ? resolveUnitName(defTop.unitId) : t('preBattle.defender')}
            </span>
            <span class="pre-battle-power" data-testid="pre-battle-power-defender">
              {defenderPower}
            </span>
          </div>
        </div>

        <div class="pre-battle-actions">
          <button class="pre-battle-fight" data-testid="pre-battle-fight" onClick={fight}>
            {t('preBattle.fight')}
          </button>
          <button class="pre-battle-auto" data-testid="pre-battle-auto" onClick={auto}>
            {t('preBattle.auto')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Pile la plus nombreuse d'un camp (portrait représentatif) — undefined si vide. */
function dominant(stacks: CombatStack[]): CombatStack | undefined {
  return [...stacks].sort((a, b) => b.count - a.count)[0];
}

/** Faction (`groupId`) de la pile dominante d'un camp — undefined si inconnue. */
function factionOf(
  stacks: CombatStack[],
  catalog: Record<string, { groupId: string }>,
): string | undefined {
  const top = dominant(stacks);
  return top ? catalog[top.unitId]?.groupId : undefined;
}
