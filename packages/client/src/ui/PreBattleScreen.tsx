import { armyStrength } from '@heroes/engine';
import type { CombatStack } from '@heroes/engine';
import { appStore, useApp } from '../app/store';
import { dispatch } from '../app/dispatch';
import { recordCombatAuto } from '../app/telemetry';
import { heroArchetype } from '../app/game';
import { t, resolveUnitName, resolveLoc, commandErrorMessage } from '../app/i18n';
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
  // Fidélité HoMM : on voit SON armée à l'effectif exact, l'ennemi en quantités
  // approximatives (aucune fuite au-delà de la puissance déjà arrondie).
  const attackerApprox = combat.playerSide !== 'attacker';
  const defenderApprox = combat.playerSide !== 'defender';

  const hero = combat.attackerHeroId
    ? game.heroes.find((h) => h.id === combat.attackerHeroId)
    : undefined;
  const attackerFaction = hero?.factionId ?? factionOf(attackers, game.unitCatalog);
  const defTop = dominant(defenders);
  // S7 (siège) : un combat de ville (`townId`) titre « Siège de … », arbore le
  // blason de la faction de la VILLE (pas seulement la pile dominante) et liste
  // ses défenses — toutes des données déjà présentes dans l'état.
  const town = combat.townId ? game.towns.find((tn) => tn.id === combat.townId) : undefined;
  const defenderFaction = town?.factionId ?? factionOf(defenders, game.unitCatalog);
  const siegeTitle = town
    ? t('preBattle.siegeTitle', { faction: resolveLoc(`faction.${town.factionId}.name`) })
    : null;
  const fortLevel = town?.buildings['fort'] ?? 0;
  const hasWalls = (combat.siegeWalls?.length ?? 0) > 0;
  const hasMoat = (combat.moat?.length ?? 0) > 0;
  const hasTower = combat.stacks.some((s) => s.id === 'defender-tower');

  const fight = (): void => {
    appStore.setState({ preBattlePending: false });
  };
  const auto = (): void => {
    recordCombatAuto(); // délégation = « abandon » manuel (télémétrie opt-in)
    appStore.setState({ preBattlePending: false });
    dispatch({ type: 'AutoCombat' }).catch((err: unknown) => pushToast(commandErrorMessage(err), 'error'));
  };
  // Abandon (retour de jeu 2026-07) : renoncer au combat une fois la puissance
  // connue, en conservant l'armée survivante, sans coût. Réservé aux combats de
  // héros (jamais l'arène, `heroId` null).
  const canAbandon = combat.heroId != null;
  const abandon = (): void => {
    appStore.setState({ preBattlePending: false });
    dispatch({ type: 'AbandonCombat' }).catch((err: unknown) => pushToast(commandErrorMessage(err), 'error'));
  };

  return (
    <div class="pre-battle-backdrop" data-testid="pre-battle">
      <div class="pre-battle chrome-framed" role="dialog" aria-modal="true" aria-label={siegeTitle ?? t('preBattle.title')}>
        <h2 class="pre-battle-title">{siegeTitle ?? t('preBattle.title')}</h2>
        {town && (
          <ul class="pre-battle-defenses" data-testid="pre-battle-defenses">
            <li class="pre-battle-defense">{t('preBattle.defenseFort', { level: fortLevel })}</li>
            {hasWalls && <li class="pre-battle-defense">{t('preBattle.defenseWall')}</li>}
            {hasMoat && <li class="pre-battle-defense">{t('preBattle.defenseMoat')}</li>}
            {hasTower && <li class="pre-battle-defense">{t('preBattle.defenseTower')}</li>}
          </ul>
        )}
        <div class="pre-battle-sides">
          <div class="pre-battle-side">
            <div class="pre-battle-portrait">
              {hero ? (
                <AssetImg
                  src={heroAvatarUrl(hero.factionId, heroArchetype(hero.attributes), hero.name)}
                  alt=""
                  class="pre-battle-avatar"
                  fallback={<FactionBadge factionId={hero.factionId} />}
                />
              ) : attackerFaction ? (
                <FactionBadge factionId={attackerFaction} />
              ) : null}
            </div>
            <span class="pre-battle-name">
              {attackerFaction && <FactionBadge factionId={attackerFaction} />}
              {t('preBattle.attacker')}
            </span>
            <span class="pre-battle-power" data-testid="pre-battle-power-attacker">
              {attackerPower}
            </span>
            <CompositionRow
              stacks={attackers}
              catalog={game.unitCatalog}
              approximate={attackerApprox}
              side="attacker"
            />
          </div>

          <div class="pre-battle-versus">
            {/* Libellé pivot : nomme les deux valeurs d'or par camp (lot X4 — la
                ligne « {att} · {def} » redondante avec `pre-battle-power` retirée). */}
            <span class="pre-battle-versus-label">{t('preBattle.battlePower')}</span>
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
              {defenderFaction && <FactionBadge factionId={defenderFaction} />}
              {defTop ? resolveUnitName(defTop.unitId) : t('preBattle.defender')}
            </span>
            <span class="pre-battle-power" data-testid="pre-battle-power-defender">
              {defenderPower}
            </span>
            <CompositionRow
              stacks={defenders}
              catalog={game.unitCatalog}
              approximate={defenderApprox}
              side="defender"
            />
          </div>
        </div>

        <div class="pre-battle-actions">
          <button class="pre-battle-fight" data-testid="pre-battle-fight" onClick={fight}>
            {t('preBattle.fight')}
          </button>
          <button class="pre-battle-auto" data-testid="pre-battle-auto" onClick={auto}>
            {t('preBattle.auto')}
          </button>
          {canAbandon && (
            <button class="pre-battle-abandon" data-testid="pre-battle-abandon" onClick={abandon}>
              {t('preBattle.abandon')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Rangée de composition d'une armée (Lot 6b, I7 — fidélité HoMM) : une vignette
 * par pile (sprite d'unité, repli gracieux) + effectif. Côté joueur : exact ;
 * côté ennemi (`approximate`) : quantité bucketisée (« Quelques », « Foule »…),
 * pas de fuite au-delà de la puissance déjà arrondie.
 */
function CompositionRow({
  stacks,
  catalog,
  approximate,
  side,
}: {
  stacks: CombatStack[];
  catalog: Record<string, { groupId: string }>;
  approximate: boolean;
  side: 'attacker' | 'defender';
}) {
  if (stacks.length === 0) return null;
  return (
    <ul class="pre-battle-comp" data-testid={`pre-battle-comp-${side}`}>
      {stacks.map((s) => {
        const name = resolveUnitName(s.unitId);
        return (
          <li key={s.id} class="pre-battle-comp-unit" title={name}>
            <AssetImg
              src={unitSpriteUrl(s.unitId, catalog[s.unitId]?.groupId)}
              alt={name}
              class="pre-battle-comp-icon"
              fallback={<span class="pre-battle-comp-fallback" aria-hidden="true" />}
            />
            <span class="pre-battle-comp-count">
              {approximate ? approxQuantity(s.count) : s.count}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Bucket de quantité façon HoMM (ennemi non scouté) — jamais l'effectif exact. */
function approxQuantity(n: number): string {
  const key =
    n < 5 ? 'few' : n < 10 ? 'several' : n < 20 ? 'pack' : n < 50 ? 'lots' : n < 100 ? 'horde' : 'throng';
  return t(`preBattle.qty.${key}`);
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
