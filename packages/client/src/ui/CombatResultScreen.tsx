import { RESOURCE_IDS } from '@heroes/engine';
import { appStore, useApp, type CombatResultUnit } from '../app/store';
import { t, resolveUnitName, resolveArtifactName, resolveFactionResourceName } from '../app/i18n';
import { unitSpriteUrl, resourceIconUrl } from '../render/assets';
import { AssetImg } from './AssetImg';
import './CombatResultScreen.css';

/**
 * Écran de bilan de fin de combat (retour de jeu 2026-07) : affiché par-dessus la
 * carte quand un combat FOUILLÉ se termine (`store.combatResult`, posé par
 * `dispatch`). Liste morts/survivants par armée + gains (XP, niveaux, or,
 * ressources, artefact, mort-vivants). Aucune logique moteur : dérive du bilan
 * déjà agrégé depuis les événements. « Continuer » ferme l'écran.
 */
const CORE_RESOURCE_IDS: ReadonlySet<string> = new Set<string>(RESOURCE_IDS);

function resourceLabel(id: string): string {
  return CORE_RESOURCE_IDS.has(id) ? t(`resource.${id}`) : resolveFactionResourceName(id);
}

export function CombatResultScreen() {
  useApp((s) => s.locale); // réactivité i18n
  const result = useApp((s) => s.combatResult);
  const catalog = useApp((s) => s.game.unitCatalog);
  if (!result) return null;

  const dismiss = (): void => {
    appStore.setState({ combatResult: null });
  };

  const factionOf = (unitId: string): string | undefined => catalog[unitId]?.groupId;

  const title = result.victory ? t('combatResult.victory') : t('combatResult.defeat');
  const hasGains =
    result.xp > 0 ||
    result.gold > 0 ||
    result.resources.length > 0 ||
    result.artifactId != null ||
    result.undead != null;

  return (
    <div class="modal-backdrop">
      <div
        class={`modal combat-result${result.victory ? ' is-victory' : ' is-defeat'}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="combat-result"
      >
        <h2 class="combat-result-title" data-testid="combat-result-title">
          {title}
        </h2>

        <div class="combat-result-armies">
          <ArmyColumn
            heading={t('combatResult.yourArmy')}
            units={result.player}
            factionOf={factionOf}
            testid="combat-result-player"
          />
          <ArmyColumn
            heading={t('combatResult.enemyArmy')}
            units={result.enemy}
            factionOf={factionOf}
            testid="combat-result-enemy"
          />
        </div>

        {hasGains && (
          <div class="combat-result-gains" data-testid="combat-result-gains">
            <h3 class="combat-result-gains-title">{t('combatResult.gains')}</h3>
            <ul class="combat-result-gains-list">
              {result.xp > 0 && (
                <li>
                  {t('combatResult.xp', { amount: result.xp })}
                  {result.levelUps > 0 && ` — ${t('combatResult.levelUps', { n: result.levelUps })}`}
                </li>
              )}
              {result.gold > 0 && (
                <li>
                  <GainIcon src={resourceIconUrl('gold')} />
                  {t('combatResult.gold', { amount: result.gold })}
                </li>
              )}
              {result.resources.map((r) => (
                <li key={r.resource}>
                  <GainIcon src={resourceIconUrl(r.resource)} />
                  {r.amount} {resourceLabel(r.resource)}
                </li>
              ))}
              {result.artifactId && (
                <li>{t('combatResult.artifact', { name: resolveArtifactName(result.artifactId) })}</li>
              )}
              {result.undead && (
                <li>
                  {t('combatResult.undead', {
                    count: result.undead.count,
                    name: resolveUnitName(result.undead.unitId),
                  })}
                </li>
              )}
            </ul>
          </div>
        )}

        <button class="menu-button" data-testid="combat-result-continue" onClick={dismiss}>
          {t('combatResult.continue')}
        </button>
      </div>
    </div>
  );
}

function GainIcon({ src }: { src: string | undefined }) {
  return <AssetImg src={src} alt="" class="combat-result-gain-icon" />;
}

function ArmyColumn({
  heading,
  units,
  factionOf,
  testid,
}: {
  heading: string;
  units: CombatResultUnit[];
  factionOf: (unitId: string) => string | undefined;
  testid: string;
}) {
  return (
    <div class="combat-result-army" data-testid={testid}>
      <h3 class="combat-result-army-heading">{heading}</h3>
      {units.length === 0 ? (
        <p class="combat-result-empty">{t('combatResult.none')}</p>
      ) : (
        <ul class="combat-result-unit-list">
          {units.map((u) => {
            const dead = u.survived === 0;
            return (
              <li key={u.unitId} class={`combat-result-unit${dead ? ' is-dead' : ''}`}>
                <AssetImg
                  src={unitSpriteUrl(u.unitId, factionOf(u.unitId))}
                  alt=""
                  class="combat-result-unit-sprite"
                />
                <span class="combat-result-unit-name">{resolveUnitName(u.unitId)}</span>
                <span class="combat-result-unit-counts">
                  <span class="combat-result-survived">{u.survived}</span>
                  {u.lost > 0 && <span class="combat-result-lost"> −{u.lost}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
