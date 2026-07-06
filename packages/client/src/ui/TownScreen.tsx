import { useState } from 'preact/hooks';
import {
  RESOURCE_IDS,
  buildStatus,
  builtDwellings,
  missingRequirements,
  scaleCost,
  tradeQuote,
  upgradedUnitFor,
  upgradeCost,
} from '@heroes/engine';
import type { BuildingDef, CombatUnitDef, ResourceId, TownState } from '@heroes/engine';
import { useApp } from '../app/store';
import { dispatch } from '../app/dispatch';
import { humanId } from '../app/game';
import { t, resolveUnitName, commandErrorMessage, resolveBuildingName, resolveFactionResourceName } from '../app/i18n';
import { buildingUrl, townBackgroundUrl } from '../render/assets';
import { AssetImg } from './AssetImg';
import { FactionBadge } from './FactionBadge';
import './town.css';

/**
 * Champs d'économie de ville lus sur le catalogue d'unités mais ABSENTS de
 * `CombatUnitDef` (surface figée du combat, phase 2.4) — même contournement
 * que `engine/src/town/unit-economy.ts` côté moteur : lu de façon optionnelle,
 * absent ⇒ pas de coût affiché (no-op, jamais d'erreur).
 */
interface UnitEconomyFields {
  /** Clés communes (7 ressources) ou de faction (ex. `essence`). */
  recruitCost?: Record<string, number>;
}

const CORE_RESOURCE_IDS: ReadonlySet<string> = new Set<string>(RESOURCE_IDS);

/** Nom localisé d'une ressource de coût — commune (`resource.<id>`) ou de faction (paquet, CO7). */
function resourceLabel(id: string): string {
  return CORE_RESOURCE_IDS.has(id) ? t(`resource.${id}`) : resolveFactionResourceName(id);
}

/** Format compact d'un coût (`{gold:120}` → « 120 Or ») — vide si gratuit. */
function formatCost(cost: Record<string, number>): string {
  return Object.entries(cost)
    .map(([id, amount]) => `${amount} ${resourceLabel(id)}`)
    .join(', ');
}

const GARRISON_SLOTS = 7;

/** Nom localisé d'un bâtiment — core (`townHall`…) ou dwelling de paquet (CO6), repli id. */
function buildingName(id: string): string {
  return resolveBuildingName(id);
}

function CostList({ cost }: { cost: Record<string, number> }) {
  const entries = Object.entries(cost);
  if (entries.length === 0) return null;
  return (
    <span class="town-cost">
      {entries.map(([id, amount]) => (
        <span key={id} class="town-cost-entry">
          {amount} {resourceLabel(id)}
        </span>
      ))}
    </span>
  );
}

/**
 * Écran de ville (doc 08 §2.2) — modale plein écran, onglets
 * Construire/Recruter/Garnison. Lit `game.towns`/`game.buildingCatalog`
 * (peuvent être vides tant que l'intégration ne les remplit pas — affiche
 * « aucune ville » proprement plutôt que de crasher).
 */
export function TownScreen({ townId, onClose }: { townId: string; onClose: () => void }) {
  useApp((s) => s.locale); // réactivité i18n
  const game = useApp((s) => s.game);
  const [tab, setTab] = useState<'build' | 'recruit' | 'garrison' | 'market'>('build');
  const [error, setError] = useState<string | null>(null);

  const close = onClose;

  const town = game.towns.find((tw) => tw.id === townId);

  return (
    <div class="modal-backdrop" onClick={close}>
      <div
        class="modal town-screen"
        role="dialog"
        aria-modal="true"
        aria-label={t('town.title')}
        onClick={(e) => e.stopPropagation()}
      >
        <header class="modal-header">
          <h2 class="town-title">
            {town && <FactionBadge factionId={town.factionId} />}
            {t('town.title')}
          </h2>
          <button class="modal-close" data-testid="town-close" aria-label={t('town.close')} onClick={close}>
            ×
          </button>
        </header>

        {!town ? (
          <p class="town-empty" data-testid="town-empty">
            {t('town.noTown')}
          </p>
        ) : (
          <>
            <TownView town={town} catalog={game.buildingCatalog} onSelect={() => setTab('build')} />
            <nav class="town-tabs" role="tablist">
              <button
                class={tab === 'build' ? 'active' : ''}
                data-testid="town-tab-build"
                onClick={() => setTab('build')}
              >
                {t('town.build')}
              </button>
              <button
                class={tab === 'recruit' ? 'active' : ''}
                data-testid="town-tab-recruit"
                onClick={() => setTab('recruit')}
              >
                {t('town.recruit')}
              </button>
              <button
                class={tab === 'garrison' ? 'active' : ''}
                data-testid="town-tab-garrison"
                onClick={() => setTab('garrison')}
              >
                {t('town.garrison')}
              </button>
              <button
                class={tab === 'market' ? 'active' : ''}
                data-testid="town-tab-market"
                onClick={() => setTab('market')}
              >
                {t('town.market')}
              </button>
            </nav>

            {error && (
              <p class="town-error" data-testid="town-error">
                {error}
              </p>
            )}

            {tab === 'build' && (
              <BuildTab town={town} catalog={game.buildingCatalog} onError={setError} />
            )}
            {tab === 'recruit' && (
              <RecruitTab town={town} catalog={game.buildingCatalog} unitCatalog={game.unitCatalog} onError={setError} />
            )}
            {tab === 'garrison' && <GarrisonTab town={town} onError={setError} />}
            {tab === 'market' && <MarketTab town={town} onError={setError} />}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Vue de ville « peinte » (doc 08 §2.2/§5, lot UX U5) : les bâtiments CONSTRUITS
 * apparaissent en vignettes sur un décor peint (fond bespoke par faction,
 * lot U5-B — repli sur le dégradé gouache CSS si l'asset est absent), en bande
 * à défilement horizontal (touch-first, mobile). Tap sur un bâtiment = bascule
 * vers l'onglet Construire. Réutilise les vignettes existantes (`buildingUrl`).
 */
function TownView({
  town,
  catalog,
  onSelect,
}: {
  town: TownState;
  catalog: Record<string, BuildingDef>;
  onSelect: () => void;
}) {
  const built = Object.keys(town.buildings)
    .filter((id) => (town.buildings[id] ?? 0) >= 1 && catalog[id])
    .sort();
  const bg = townBackgroundUrl(town.factionId);
  return (
    <div class="town-view" data-testid="town-view">
      <div class="town-view-scene" style={bg ? { backgroundImage: `url(${bg})` } : undefined}>
        {built.length === 0 ? (
          <p class="town-view-empty" data-testid="town-view-empty">
            {t('town.viewEmpty')}
          </p>
        ) : (
          built.map((id) => (
            <button
              key={id}
              class="town-view-building"
              data-testid="town-view-building"
              onClick={onSelect}
              title={buildingName(id)}
            >
              <AssetImg
                src={buildingUrl(id, town.factionId)}
                alt={buildingName(id)}
                class="town-view-vignette"
                fallback={<i class="town-view-vignette-fallback" aria-hidden="true" />}
              />
              <span class="town-view-label">{buildingName(id)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function BuildTab({
  town,
  catalog,
  onError,
}: {
  town: TownState;
  catalog: Record<string, BuildingDef>;
  onError: (msg: string | null) => void;
}) {
  const buildingIds = Object.keys(catalog).sort();

  const build = (buildingId: string): void => {
    onError(null);
    dispatch({ type: 'BuildStructure', townId: town.id, buildingId }).catch((err: unknown) => {
      onError(commandErrorMessage(err)); // remédiation CL6 : message localisé, plus « code: message » brut
    });
  };

  return (
    <div class="town-tab-panel" data-testid="town-panel-build">
      {town.builtToday && (
        <p class="town-built-today" data-testid="town-built-today">
          {t('town.builtToday')}
        </p>
      )}
      <ul class="town-building-list">
        {buildingIds.map((buildingId) => {
          const def = catalog[buildingId];
          if (!def) return null;
          const currentLevel = town.buildings[buildingId] ?? 0;
          const status = buildStatus(town, catalog, buildingId);
          const nextLevel = def.levels[currentLevel];
          return (
            <li key={buildingId} class={`town-building town-building-${status}`}>
              <div class="town-building-header">
                <AssetImg
                  src={buildingUrl(buildingId, town.factionId)}
                  alt=""
                  class="town-building-vignette"
                />
                <span class="town-building-name">{buildingName(buildingId)}</span>
                <span class="town-building-level">
                  {t('town.level', { level: currentLevel, max: def.maxLevel })}
                </span>
                <span class={`town-building-status town-building-status-${status}`}>{t(`town.${status}`)}</span>
              </div>
              {status === 'locked' && nextLevel && (
                <ul class="town-requirements">
                  {missingRequirements(town, catalog, buildingId).map((req) => (
                    <li key={req.building} class="town-requirement-missing">
                      {t('town.requirementMissing', { building: buildingName(req.building), level: req.level })}
                    </li>
                  ))}
                </ul>
              )}
              {status === 'available' && nextLevel && (
                <div class="town-building-action">
                  <CostList cost={nextLevel.cost} />
                  <button
                    data-testid={`town-build-${buildingId}`}
                    disabled={town.builtToday}
                    onClick={() => build(buildingId)}
                  >
                    {t('town.build')}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RecruitTab({
  town,
  catalog,
  unitCatalog,
  onError,
}: {
  town: TownState;
  catalog: Record<string, BuildingDef>;
  unitCatalog: Record<string, CombatUnitDef>;
  onError: (msg: string | null) => void;
}) {
  const unitIds = builtDwellings(town, catalog);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const qtyFor = (unitId: string, stock: number): number => {
    const raw = quantities[unitId] ?? 1;
    return Math.max(1, Math.min(raw, Math.max(stock, 1)));
  };

  const setQty = (unitId: string, value: number): void => {
    setQuantities((prev) => ({ ...prev, [unitId]: value }));
  };

  const recruit = (unitId: string, count: number): void => {
    onError(null);
    dispatch({ type: 'RecruitUnits', townId: town.id, unitId, count }).catch((err: unknown) => {
      onError(commandErrorMessage(err)); // remédiation CL6 : message localisé, plus « code: message » brut
    });
  };

  return (
    <div class="town-tab-panel" data-testid="town-panel-recruit">
      <ul class="town-dwelling-list">
        {unitIds.map((unitId) => {
          const stock = town.stock[unitId] ?? 0;
          const qty = qtyFor(unitId, stock);
          const economy = unitCatalog[unitId] as (CombatUnitDef & UnitEconomyFields) | undefined;
          const totalCost = economy?.recruitCost ? scaleCost(economy.recruitCost, qty) : null;
          return (
            <li key={unitId} class="town-dwelling">
              <div class="town-dwelling-header">
                <span class="town-dwelling-name">{resolveUnitName(unitId)}</span>
                <span class="town-dwelling-stock" data-testid={`town-stock-${unitId}`}>
                  {t('town.stock', { count: stock })}
                </span>
              </div>
              <div class="town-dwelling-controls">
                <button disabled={stock === 0} onClick={() => setQty(unitId, 1)}>
                  {t('town.min')}
                </button>
                <input
                  type="range"
                  min={1}
                  max={Math.max(stock, 1)}
                  value={qty}
                  disabled={stock === 0}
                  onInput={(e) => setQty(unitId, Number((e.currentTarget as HTMLInputElement).value))}
                />
                <button disabled={stock === 0} onClick={() => setQty(unitId, stock)}>
                  {t('town.max')}
                </button>
                <span class="town-dwelling-qty" data-testid={`town-qty-${unitId}`}>
                  {stock === 0 ? 0 : qty}
                </span>
              </div>
              {totalCost && <CostList cost={totalCost} />}
              <button
                data-testid={`town-recruit-${unitId}`}
                disabled={stock === 0}
                onClick={() => recruit(unitId, qty)}
              >
                {t('town.recruit')}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function GarrisonTab({ town, onError }: { town: TownState; onError: (msg: string | null) => void }) {
  // Sélecteur stable (réf `s.game`), dérivations dans le corps (leçon U4 : ne pas
  // renvoyer un objet/tableau frais du sélecteur → boucle de rendu).
  const game = useApp((s) => s.game);
  const hero = game.heroes.find(
    (h) => h.playerId === humanId(game) && h.pos.x === town.pos.x && h.pos.y === town.pos.y,
  );

  const transfer = (from: 'town' | 'hero', slot: number): void => {
    if (!hero) return;
    onError(null);
    dispatch({ type: 'GarrisonTransfer', townId: town.id, heroId: hero.id, from, slot }).catch((err: unknown) => {
      onError(commandErrorMessage(err)); // remédiation CL6 : message localisé, plus « code: message » brut
    });
  };

  const upgrade = (unitId: string): void => {
    onError(null);
    dispatch({ type: 'UpgradeUnits', townId: town.id, unitId }).catch((err: unknown) => {
      onError(commandErrorMessage(err));
    });
  };

  return (
    <div class="town-tab-panel" data-testid="town-panel-garrison">
      {!hero && (
        <p class="town-no-hero" data-testid="town-no-hero">
          {t('town.noHero')}
        </p>
      )}
      <div class="town-garrison-columns">
        <div class="town-garrison-column">
          <h3>{t('town.garrison')}</h3>
          <ol class="town-garrison-slots">
            {Array.from({ length: GARRISON_SLOTS }, (_, i) => town.garrison[i]).map((stack, i) => (
              <li key={i} class={stack ? 'town-garrison-slot filled' : 'town-garrison-slot empty'}>
                {stack && (
                  <>
                    <span>{resolveUnitName(stack.unitId)}</span>
                    <span>×{stack.count}</span>
                    {hero && (
                      <button data-testid={`town-garrison-to-hero-${i}`} onClick={() => transfer('town', i)}>
                        {t('town.toHero')}
                      </button>
                    )}
                    {upgradedUnitFor(town, game.buildingCatalog, stack.unitId) && (
                      <button
                        data-testid={`town-garrison-upgrade-${i}`}
                        onClick={() => upgrade(stack.unitId)}
                      >
                        {t('town.upgrade')}
                        {(() => {
                          const up = upgradedUnitFor(town, game.buildingCatalog, stack.unitId)!;
                          const c = formatCost(upgradeCost(game, stack.unitId, up, stack.count));
                          return c ? ` (${c})` : '';
                        })()}
                      </button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ol>
        </div>
        <div class="town-garrison-column">
          <h3>{t('army.title')}</h3>
          <ol class="town-garrison-slots">
            {Array.from({ length: GARRISON_SLOTS }, (_, i) => hero?.army[i]).map((stack, i) => (
              <li key={i} class={stack ? 'town-garrison-slot filled' : 'town-garrison-slot empty'}>
                {stack && (
                  <>
                    <span>{resolveUnitName(stack.unitId)}</span>
                    <span>×{stack.count}</span>
                    {hero && (
                      <button data-testid={`town-garrison-to-town-${i}`} onClick={() => transfer('hero', i)}>
                        {t('town.toTown')}
                      </button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

const TRADABLE_RESOURCE_IDS = RESOURCE_IDS.filter((r): r is Exclude<ResourceId, 'gold'> => r !== 'gold');

/**
 * Onglet Marché (lot UX U6a) : échange ressource ↔ or via `TradeResources`.
 * L'aperçu réutilise `tradeQuote` (helper pur du moteur) — pas de
 * réimplémentation du taux côté client (leçon CL9).
 */
function MarketTab({ town, onError }: { town: TownState; onError: (msg: string | null) => void }) {
  const game = useApp((s) => s.game);
  const [mode, setMode] = useState<'sell' | 'buy'>('sell');
  const [resource, setResource] = useState<Exclude<ResourceId, 'gold'>>('wood');
  const [amount, setAmount] = useState(1);

  const give: ResourceId = mode === 'sell' ? resource : 'gold';
  const receive: ResourceId = mode === 'sell' ? 'gold' : resource;
  const market = game.config?.market;
  const received = market ? tradeQuote(market, give, receive, amount) : 0;

  const trade = (): void => {
    onError(null);
    dispatch({ type: 'TradeResources', townId: town.id, give, receive, giveAmount: amount }).catch(
      (err: unknown) => {
        onError(commandErrorMessage(err)); // même gestion d'erreur que build/recruit/garrison (CL6)
      },
    );
  };

  return (
    <div class="town-tab-panel" data-testid="town-panel-market">
      <div class="town-market-mode">
        <button
          class={mode === 'sell' ? 'active' : ''}
          data-testid="market-mode-sell"
          onClick={() => setMode('sell')}
        >
          {t('town.marketSell')}
        </button>
        <button class={mode === 'buy' ? 'active' : ''} data-testid="market-mode-buy" onClick={() => setMode('buy')}>
          {t('town.marketBuy')}
        </button>
      </div>
      <label class="town-market-field">
        {t('town.marketResource')}
        <select
          data-testid="market-resource"
          value={resource}
          onChange={(e) => setResource((e.currentTarget as HTMLSelectElement).value as Exclude<ResourceId, 'gold'>)}
        >
          {TRADABLE_RESOURCE_IDS.map((id) => (
            <option key={id} value={id}>
              {t(`resource.${id}`)}
            </option>
          ))}
        </select>
      </label>
      <label class="town-market-field">
        {t('town.marketAmount')}
        <input
          type="number"
          min={1}
          data-testid="market-amount"
          value={amount}
          onInput={(e) => setAmount(Math.max(1, Number((e.currentTarget as HTMLInputElement).value) || 1))}
        />
      </label>
      <p class="town-market-preview" data-testid="market-received">
        {t('town.marketReceive', { amount: received })}
      </p>
      <button data-testid="market-trade" onClick={trade}>
        {t('town.marketConfirm')}
      </button>
    </div>
  );
}
