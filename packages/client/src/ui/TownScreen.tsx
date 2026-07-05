import { useEffect, useState } from 'preact/hooks';
import { RESOURCE_IDS } from '@heroes/engine';
import type { BuildingDef, CombatUnitDef, TownState } from '@heroes/engine';
import { useApp, appStore } from '../app/store';
import { dispatch } from '../app/dispatch';
import { PLAYER_ID } from '../app/game';
import { t, resolveUnitName } from '../app/i18n';
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

/** Nom localisé d'une ressource de coût — commune (`resource.<id>`) ou de faction. */
function resourceLabel(id: string): string {
  return CORE_RESOURCE_IDS.has(id) ? t(`resource.${id}`) : t(`factionResource.${id}`);
}

type BuildStatus = 'built' | 'available' | 'locked';

const GARRISON_SLOTS = 7;

/** Multiplie un coût par un effectif (mêmes règles que `town/resources.ts` côté moteur). */
function scaleCost(cost: Record<string, number>, factor: number): Record<string, number> {
  const scaled: Record<string, number> = {};
  for (const [id, amount] of Object.entries(cost)) {
    scaled[id] = amount * factor;
  }
  return scaled;
}

/** Nom localisé d'un bâtiment via `building.<id>` (clés core communes) ; repli sur l'id brut
 * (bâtiments spécifiques de faction, non nommés au niveau core). */
function buildingName(id: string): string {
  const key = `building.${id}`;
  const translated = t(key);
  return translated === key ? id : translated;
}

function nextBuildStatus(
  town: TownState,
  def: BuildingDef,
  buildingId: string,
  catalog: Record<string, BuildingDef>,
): BuildStatus {
  const currentLevel = town.buildings[buildingId] ?? 0;
  if (currentLevel >= def.maxLevel) return 'built';
  const nextLevel = def.levels[currentLevel];
  if (!nextLevel) return 'built';
  // Choix exclusif (doc 05 §3.2) : verrouillé si un frère du groupe est déjà bâti.
  if (def.exclusiveGroup) {
    const rivalBuilt = Object.keys(town.buildings).some(
      (id) =>
        id !== buildingId &&
        (town.buildings[id] ?? 0) >= 1 &&
        catalog[id]?.exclusiveGroup === def.exclusiveGroup,
    );
    if (rivalBuilt) return 'locked';
  }
  const met = nextLevel.requires.every((req) => (town.buildings[req.building] ?? 0) >= req.level);
  return met ? 'available' : 'locked';
}

/** Dwellings construits dans la ville : unitId débloqué par un bâtiment déjà bâti. */
function builtDwellings(town: TownState, catalog: Record<string, BuildingDef>): string[] {
  const unitIds: string[] = [];
  for (const [buildingId, level] of Object.entries(town.buildings)) {
    const def = catalog[buildingId];
    if (!def) continue;
    for (let i = 0; i < level; i++) {
      const effect = def.levels[i]?.effect;
      if (effect?.type === 'dwelling' && !unitIds.includes(effect.unitId)) unitIds.push(effect.unitId);
    }
  }
  return unitIds;
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
export function TownScreen() {
  useApp((s) => s.locale); // réactivité i18n
  const townId = useApp((s) => s.townScreenOpen);
  const game = useApp((s) => s.game);
  const [tab, setTab] = useState<'build' | 'recruit' | 'garrison'>('build');
  const [error, setError] = useState<string | null>(null);

  const close = (): void => appStore.setState({ townScreenOpen: null });

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
          </>
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
      onError(err instanceof Error ? err.message : String(err));
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
          const status = nextBuildStatus(town, def, buildingId, catalog);
          const nextLevel = def.levels[currentLevel];
          return (
            <li key={buildingId} class={`town-building town-building-${status}`}>
              <div class="town-building-header">
                <span class="town-building-name">{buildingName(buildingId)}</span>
                <span class="town-building-level">
                  {t('town.level', { level: currentLevel, max: def.maxLevel })}
                </span>
                <span class={`town-building-status town-building-status-${status}`}>{t(`town.${status}`)}</span>
              </div>
              {status === 'locked' && nextLevel && (
                <ul class="town-requirements">
                  {nextLevel.requires
                    .filter((req) => (town.buildings[req.building] ?? 0) < req.level)
                    .map((req) => (
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
      onError(err instanceof Error ? err.message : String(err));
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
  const hero = useApp((s) =>
    s.game.heroes.find((h) => h.playerId === PLAYER_ID && h.pos.x === town.pos.x && h.pos.y === town.pos.y),
  );

  const transfer = (from: 'town' | 'hero', slot: number): void => {
    if (!hero) return;
    onError(null);
    dispatch({ type: 'GarrisonTransfer', townId: town.id, heroId: hero.id, from, slot }).catch((err: unknown) => {
      onError(err instanceof Error ? err.message : String(err));
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
