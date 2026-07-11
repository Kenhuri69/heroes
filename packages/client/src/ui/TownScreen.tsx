import { useState } from 'preact/hooks';
import {
  RESOURCE_IDS,
  buildStatus,
  builtDwellings,
  heroLearnableCircle,
  missingRequirements,
  scaleCost,
  townIncome,
  tradeQuote,
  ownedMarketCount,
  upgradedUnitFor,
  upgradeCost,
  weekOf,
  weeklyGrowthOf,
} from '@heroes/engine';
import { recruitedHeroId } from '@heroes/engine';
import type { BuildingDef, CombatUnitDef, GameEvent, ResourceId, TownState } from '@heroes/engine';
import { useApp, appStore } from '../app/store';
import { dispatch } from '../app/dispatch';
import { heroArchetype, humanId } from '../app/game';
import {
  t,
  resolveLoc,
  resolveUnitName,
  resolveUnitLore,
  resolveSpellName,
  commandErrorMessage,
  resolveBuildingName,
  resolveBuildingLore,
  resolveFactionResourceName,
  resolveHeroBio,
  resolveSpecialtyName,
  resolveSpecialtyDesc,
} from '../app/i18n';
import { buildingUrl, heroAvatarUrl, townBackgroundUrl } from '../render/assets';
import { AssetImg } from './AssetImg';
import { FactionBadge } from './FactionBadge';
import { UiIcon } from './UiIcon';
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

/**
 * La ville a-t-elle un bâtiment CONSTRUIT (niveau ≥ 1) portant l'effet demandé ?
 * Miroir client de `townHasMarket` (engine/town/market.ts) : sert à n'exposer
 * l'onglet Marché/Guilde/Taverne que lorsque le bâtiment existe — le moteur
 * refuse sinon l'action. Aucun id de bâtiment en dur (data-driven).
 */
function hasBuiltEffect(
  town: TownState,
  catalog: Record<string, BuildingDef>,
  effectType: 'market' | 'mageGuild' | 'tavern',
): boolean {
  for (const [id, level] of Object.entries(town.buildings)) {
    if (level < 1) continue;
    if (catalog[id]?.levels[level - 1]?.effect?.type === effectType) return true;
  }
  return false;
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
  const [tab, setTab] = useState<'build' | 'recruit' | 'garrison' | 'market' | 'guild' | 'tavern'>('build');
  const [error, setError] = useState<string | null>(null);

  const close = onClose;

  const town = game.towns.find((tw) => tw.id === townId);

  // Lot A (refonte UX) : les onglets Marché/Guilde ne s'affichent que si le
  // bâtiment correspondant est CONSTRUIT — sinon le moteur refuse l'action
  // (`invalidTrade`), l'onglet menait à un cul-de-sac. Comme HoMM : ce sont des
  // bâtiments qu'on entre, pas des modes permanents.
  const hasMarket = town ? hasBuiltEffect(town, game.buildingCatalog, 'market') : false;
  const hasGuild = town ? hasBuiltEffect(town, game.buildingCatalog, 'mageGuild') : false;
  const hasTavern = town ? hasBuiltEffect(town, game.buildingCatalog, 'tavern') : false;
  // Onglet effectif : si l'onglet mémorisé n'est plus disponible (bâtiment non
  // construit), repli sur Construire — jamais un panneau vide/inaccessible.
  const activeTab =
    (tab === 'market' && !hasMarket) || (tab === 'guild' && !hasGuild) || (tab === 'tavern' && !hasTavern)
      ? 'build'
      : tab;

  // Lot B (refonte UX) : la vue peinte devient le point d'entrée — un tap sur un
  // emplacement route vers l'action pertinente (entrer le marché/la guilde,
  // recruter dans une habitation, sinon construire), au lieu de toujours ouvrir
  // Construire.
  const selectBuilding = (id: string): void => {
    if (!town) return;
    const effect = game.buildingCatalog[id]?.levels[(town.buildings[id] ?? 0) - 1]?.effect;
    if ((town.buildings[id] ?? 0) >= 1) {
      if (effect?.type === 'market') return setTab('market');
      if (effect?.type === 'mageGuild') return setTab('guild');
      if (effect?.type === 'tavern') return setTab('tavern');
      if (builtDwellings(town, game.buildingCatalog).includes(id)) return setTab('recruit');
    }
    setTab('build');
  };

  return (
    <div class="modal-backdrop" onClick={close}>
      <div
        class="modal town-screen chrome-framed"
        role="dialog"
        aria-modal="true"
        aria-label={t('town.title')}
        onClick={(e) => e.stopPropagation()}
      >
        <header class="modal-header">
          <h2 class="town-title">
            {town && <FactionBadge factionId={town.factionId} />}
            {town ? t('town.titleNamed', { faction: resolveLoc(`faction.${town.factionId}.name`) }) : t('town.title')}
          </h2>
          <button class="modal-close" data-testid="town-close" aria-label={t('town.close')} onClick={close}>
            ×
          </button>
        </header>

        {/* En-tête de décision (lot M7 C21) : revenu or/jour + prochaine croissance
            + créneau de chantier du jour (lot D refonte UX : le grand ruban est
            condensé ici en badge compact — testid conservé). */}
        {town && town.ownerPlayerId && (
          <p class="town-subheader" data-testid="town-subheader">
            <span data-testid="town-income">
              {t('town.incomeGold', { amount: townIncome(town, game.buildingCatalog).gold ?? 0 })}
            </span>
            <span class="town-subheader-sep" aria-hidden="true">·</span>
            <span data-testid="town-growth">
              {t('town.growthIn', { days: weekOf(game.calendar.day) * 7 + 1 - game.calendar.day })}
            </span>
            <span class="town-subheader-sep" aria-hidden="true">·</span>
            <span
              class={`town-build-queue-state ${town.builtToday ? 'is-used' : 'is-free'}`}
              data-testid="town-build-queue-state"
              title={t('town.buildQueueTitle')}
            >
              {t(town.builtToday ? 'town.buildQueueUsed' : 'town.buildQueueFree')}
            </span>
          </p>
        )}

        {!town ? (
          <p class="town-empty" data-testid="town-empty">
            {t('town.noTown')}
          </p>
        ) : (
          <>
            <TownView town={town} catalog={game.buildingCatalog} onSelect={selectBuilding} />
            <nav class="town-tabs" role="tablist">
              <button
                class={activeTab === 'build' ? 'active' : ''}
                data-testid="town-tab-build"
                onClick={() => setTab('build')}
              >
                <UiIcon id="tab-build" fallback="" /> {t('town.build')}
              </button>
              <button
                class={activeTab === 'recruit' ? 'active' : ''}
                data-testid="town-tab-recruit"
                onClick={() => setTab('recruit')}
              >
                <UiIcon id="tab-recruit" fallback="" /> {t('town.recruit')}
              </button>
              <button
                class={activeTab === 'garrison' ? 'active' : ''}
                data-testid="town-tab-garrison"
                onClick={() => setTab('garrison')}
              >
                <UiIcon id="tab-garrison" fallback="" /> {t('town.garrison')}
              </button>
              {hasMarket && (
                <button
                  class={activeTab === 'market' ? 'active' : ''}
                  data-testid="town-tab-market"
                  onClick={() => setTab('market')}
                >
                  <UiIcon id="tab-market" fallback="" /> {t('town.market')}
                </button>
              )}
              {hasGuild && (
                <button
                  class={activeTab === 'guild' ? 'active' : ''}
                  data-testid="town-tab-guild"
                  onClick={() => setTab('guild')}
                >
                  <UiIcon id="tab-build" fallback="" /> {t('town.guild')}
                </button>
              )}
              {hasTavern && (
                <button
                  class={activeTab === 'tavern' ? 'active' : ''}
                  data-testid="town-tab-tavern"
                  onClick={() => setTab('tavern')}
                >
                  <UiIcon id="tab-recruit" fallback="" /> {t('town.tavern')}
                </button>
              )}
            </nav>

            {error && (
              <p class="town-error" data-testid="town-error">
                {error}
              </p>
            )}

            {activeTab === 'build' && (
              <BuildTab town={town} catalog={game.buildingCatalog} onError={setError} />
            )}
            {activeTab === 'recruit' && (
              <RecruitTab town={town} catalog={game.buildingCatalog} unitCatalog={game.unitCatalog} onError={setError} />
            )}
            {activeTab === 'garrison' && <GarrisonTab town={town} onError={setError} />}
            {activeTab === 'market' && <MarketTab town={town} onError={setError} />}
            {activeTab === 'guild' && <GuildTab town={town} />}
            {activeTab === 'tavern' && <TavernTab town={town} onError={setError} />}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Statut d'affichage d'un bâtiment sur le décor (UXD-5) : `constructed`
 * (niveau ≥ 1, physiquement bâti), `available` (constructible aujourd'hui),
 * `locked` (prérequis manquant ou rival exclusif déjà bâti). Distinct de
 * `buildStatus` moteur, qui renvoie `built` pour « rien de plus à bâtir » (max)
 * — ici on veut « posé sur la carte ou non ».
 */
type TownViewStatus = 'constructed' | 'available' | 'locked';

const VIEW_STATUS_ORDER: Record<TownViewStatus, number> = {
  constructed: 0,
  available: 1,
  locked: 2,
};

/** Clé locale du statut d'affichage (réutilise les libellés existants). */
const VIEW_STATUS_LABEL: Record<TownViewStatus, string> = {
  constructed: 'town.built',
  available: 'town.available',
  locked: 'town.locked',
};

/**
 * Bâtiments constructibles dans cette ville : les communs (core, sans
 * `factionId`) + ceux de la faction de la ville. Miroir de la règle moteur
 * (`validateBuildStructure`) : on n'affiche jamais les habitations d'autres
 * factions, qui encombraient la liste sans jamais être constructibles.
 */
function townBuildingIds(town: TownState, catalog: Record<string, BuildingDef>): string[] {
  return Object.keys(catalog).filter((id) => {
    const factionId = catalog[id]?.factionId;
    return factionId === undefined || factionId === town.factionId;
  });
}

function townViewStatus(town: TownState, catalog: Record<string, BuildingDef>, id: string): TownViewStatus {
  if ((town.buildings[id] ?? 0) >= 1) return 'constructed';
  return buildStatus(town, catalog, id) === 'available' ? 'available' : 'locked';
}

/**
 * Vue de ville « peinte » (doc 08 §2.2/§5, lots UX U5 + UXD-5) : **plan de
 * construction** sur un décor peint (fond bespoke par faction, lot U5-B — repli
 * sur le dégradé gouache CSS si l'asset est absent). Chaque bâtiment du catalogue
 * est un emplacement portant son statut — construit / disponible / verrouillé —
 * marqué par une pastille de forme distincte + opacité/désaturation (2ᵉ canal
 * non chromatique, a11y doc 08 §4). Bande à défilement horizontal (touch-first,
 * mobile). Tap sur un emplacement = bascule vers l'onglet Construire. Réutilise
 * les vignettes existantes (`buildingUrl`, repli dessiné si l'asset manque).
 */
function TownView({
  town,
  catalog,
  onSelect,
}: {
  town: TownState;
  catalog: Record<string, BuildingDef>;
  onSelect: (id: string) => void;
}) {
  const slots = townBuildingIds(town, catalog)
    .map((id) => ({ id, status: townViewStatus(town, catalog, id) }))
    .sort((a, b) => VIEW_STATUS_ORDER[a.status] - VIEW_STATUS_ORDER[b.status] || a.id.localeCompare(b.id));
  const bg = townBackgroundUrl(town.factionId);
  return (
    <div class="town-view" data-testid="town-view">
      <div class="town-view-scene" style={bg ? { backgroundImage: `url(${bg})` } : undefined}>
        {slots.length === 0 ? (
          <p class="town-view-empty" data-testid="town-view-empty">
            {t('town.viewEmpty')}
          </p>
        ) : (
          slots.map(({ id, status }) => (
            <button
              key={id}
              class={`town-view-building is-${status}`}
              data-testid="town-view-building"
              data-status={status}
              onClick={() => onSelect(id)}
              title={buildingName(id)}
              aria-label={`${buildingName(id)} — ${t(VIEW_STATUS_LABEL[status])}`}
            >
              <span class="town-view-figure">
                <AssetImg
                  src={buildingUrl(id, town.factionId)}
                  alt=""
                  class="town-view-vignette"
                  fallback={<i class="town-view-vignette-fallback" aria-hidden="true" />}
                />
                <span class={`town-view-pip town-view-pip-${status}`} aria-hidden="true" />
              </span>
              <span class="town-view-label">{buildingName(id)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Onglet Guilde des mages (doc 02 §4.1, G2) — INFORMATIF : les sorts s'apprennent
 * automatiquement quand un héros visite sa ville. Liste le pool de la guilde et,
 * pour le héros du joueur présent (ou à défaut le 1ᵉʳ), marque chaque sort
 * connu / apprenable / verrouillé (cercle > Sagesse). Groupé par cercle.
 */
function GuildTab({ town }: { town: TownState }) {
  const game = useApp((s) => s.game);
  const heroes = game.heroes.filter((h) => h.playerId === humanId(game));
  const hero = heroes.find((h) => h.pos.x === town.pos.x && h.pos.y === town.pos.y) ?? heroes[0];
  const pool = town.spellPool ?? [];

  if (pool.length === 0) {
    return (
      <div class="town-tab-panel" data-testid="town-panel-guild">
        <p class="town-guild-empty" data-testid="town-guild-empty">{t('town.guildEmpty')}</p>
      </div>
    );
  }

  const limit = hero ? heroLearnableCircle(hero, game.skillCatalog) : 0;
  const circles = Array.from(
    new Set(pool.map((id) => game.spellCatalog[id]?.circle ?? 0)),
  ).sort((a, b) => a - b);

  return (
    <div class="town-tab-panel" data-testid="town-panel-guild">
      <p class="town-guild-hint">{t('town.guildHint')}</p>
      {circles.map((circle) => (
        <div key={circle} class="town-guild-circle">
          <h4>{t('spellbook.circle', { circle })}</h4>
          <ul class="town-guild-list">
            {pool
              .filter((id) => (game.spellCatalog[id]?.circle ?? 0) === circle)
              .map((id) => {
                const known = hero?.spells.includes(id) ?? false;
                const learnable = circle <= limit;
                const status = known ? 'known' : learnable ? 'learnable' : 'locked';
                return (
                  <li key={id} class={`town-guild-spell is-${status}`} data-testid={`guild-spell-${id}`} data-status={status}>
                    <span class="town-guild-spell-name">{resolveSpellName(id)}</span>
                    <span class="town-guild-spell-status">
                      {known
                        ? t('town.spellKnown')
                        : learnable
                          ? t('town.spellLearnable')
                          : t('town.spellLockedWisdom')}
                    </span>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Onglet Taverne (doc 02 §1.5/§4.1, M-TAVERN.2) : recrutement de héros nommés.
 * Liste le roster embarqué (`game.heroRoster`) de la faction de la ville —
 * avatar, nom, bio, spécialité, attributs — et dispatch `RecruitHero` contre
 * or (`config.hero.recruitCost`). Le moteur re-valide tout (Taverne bâtie,
 * cap, or, déjà recruté) ; l'UI ne fait que refléter ces états. Après succès,
 * le héros recruté devient le héros SÉLECTIONNÉ (il apparaît de lui-même dans
 * la bande `HeroStrip` et sur la carte).
 */
function TavernTab({ town, onError }: { town: TownState; onError: (msg: string | null) => void }) {
  const game = useApp((s) => s.game);
  const playerId = humanId(game);
  const player = game.players.find((p) => p.id === playerId);
  const cost = game.config?.hero?.recruitCost ?? 2500;
  const max = game.config?.hero?.maxPerPlayer ?? 8;
  const owned = game.heroes.filter((h) => h.playerId === playerId).length;
  const capReached = owned >= max;
  const affordable = (player?.resources.gold ?? 0) >= cost;
  // La Taverne d'une ville n'offre que les héros de SA faction (règle moteur,
  // ids opaques — zéro nom de faction en dur). Tri par id pour un ordre stable.
  const roster = Object.entries(game.heroRoster)
    .filter(([, def]) => def.factionId === town.factionId)
    .sort(([a], [b]) => a.localeCompare(b));

  const recruit = (heroId: string): void => {
    onError(null);
    dispatch({ type: 'RecruitHero', playerId, townId: town.id, heroId })
      .then((result) => {
        const recruited = result.events.find(
          (e): e is Extract<GameEvent, { type: 'HeroRecruited' }> => e.type === 'HeroRecruited',
        );
        if (recruited) appStore.setState({ selectedHeroId: recruited.newHeroId });
      })
      .catch((err: unknown) => {
        onError(commandErrorMessage(err));
      });
  };

  return (
    <div class="town-tab-panel" data-testid="town-panel-tavern">
      <p class="town-tavern-status" data-testid="town-tavern-status">
        <span>{t('town.tavernHeroes', { count: owned, max })}</span>
        {capReached && <span class="town-tavern-cap">{t('town.tavernCapReached')}</span>}
      </p>
      {roster.length === 0 ? (
        <p class="town-tavern-empty" data-testid="town-tavern-empty">
          {t('town.tavernEmpty')}
        </p>
      ) : (
        <ul class="town-tavern-list">
          {roster.map(([heroId, def]) => {
            const already = game.heroes.some((h) => h.id === recruitedHeroId(playerId, heroId));
            const bio = resolveHeroBio(heroId);
            const specDesc = def.specialtyId ? resolveSpecialtyDesc(def.specialtyId) : null;
            return (
              <li key={heroId} class={`town-tavern-hero${already ? ' is-recruited' : ''}`}>
                <div class="town-tavern-header">
                  <AssetImg
                    src={heroAvatarUrl(def.factionId, heroArchetype(def.attributes), def.name)}
                    alt=""
                    class="town-tavern-avatar"
                    fallback={<i class="town-tavern-avatar-fallback" aria-hidden="true" />}
                  />
                  <span class="town-tavern-name">{resolveLoc(def.name)}</span>
                  <span class="town-tavern-attrs" data-testid={`town-tavern-attrs-${heroId}`}>
                    {`${t('attribute.attack')} ${def.attributes.attack} · ${t('attribute.defense')} ${def.attributes.defense} · ${t('attribute.power')} ${def.attributes.power} · ${t('attribute.knowledge')} ${def.attributes.knowledge}`}
                  </span>
                </div>
                {def.specialtyId && (
                  <p class="town-tavern-specialty">
                    <span class="town-tavern-specialty-name">{resolveSpecialtyName(def.specialtyId)}</span>
                    {specDesc && <span class="town-tavern-specialty-desc"> — {specDesc}</span>}
                  </p>
                )}
                {bio && <LoreText text={bio} variant="town-tavern-bio" testid={`town-tavern-bio-${heroId}`} />}
                <div class="town-tavern-action">
                  {already ? (
                    <span class="town-tavern-recruited" data-testid={`town-tavern-recruited-${heroId}`}>
                      {t('town.tavernRecruited')}
                    </span>
                  ) : (
                    <>
                      <CostList cost={{ gold: cost }} />
                      <button
                        data-testid={`town-tavern-recruit-${heroId}`}
                        disabled={capReached || !affordable}
                        onClick={() => recruit(heroId)}
                      >
                        {t('town.recruit')}
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
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
  // C20 : tri par statut (disponible → construit → verrouillé) puis id — même
  // logique que la bande peinte ; l'alphabétique mettait les verrouillés en tête.
  const buildStatusOrder: Record<ReturnType<typeof buildStatus>, number> = {
    available: 0,
    built: 1,
    locked: 2,
  };
  const buildingIds = townBuildingIds(town, catalog).sort(
    (a, b) =>
      buildStatusOrder[buildStatus(town, catalog, a)] - buildStatusOrder[buildStatus(town, catalog, b)] ||
      a.localeCompare(b),
  );

  const build = (buildingId: string): void => {
    onError(null);
    dispatch({ type: 'BuildStructure', townId: town.id, buildingId }).catch((err: unknown) => {
      onError(commandErrorMessage(err)); // remédiation CL6 : message localisé, plus « code: message » brut
    });
  };

  return (
    <div class="town-tab-panel" data-testid="town-panel-build">
      {/* Lot D (refonte UX) : le créneau « 1 construction/jour » (doc 02 §4.1) est
          désormais un badge compact dans l'en-tête de ville, plus un grand ruban
          ornemental qui poussait le contenu hors écran sur mobile. */}
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
              {resolveBuildingLore(buildingId) && (
                <LoreText text={resolveBuildingLore(buildingId)!} variant="town-building-lore" />
              )}
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

/**
 * Lore d'ambiance expandable (lot X2, parité tactile A2 — doc 08 §1.1) : tronqué
 * à 2 lignes par défaut, un tap/clic déplie le texte complet. Le `title` natif
 * (survol souris) n'est ainsi plus le SEUL accès au texte intégral. Bouton pour
 * l'accessibilité clavier/tactile ; apparence réinitialisée via `.lore-toggle`.
 */
function LoreText({ text, variant, testid }: { text: string; variant: string; testid?: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <button
      type="button"
      class={`content-lore lore-toggle ${variant}${expanded ? ' expanded' : ''}`}
      data-testid={testid}
      aria-expanded={expanded}
      title={text}
      onClick={() => setExpanded((prev) => !prev)}
    >
      {text}
    </button>
  );
}

/** Effectif maximum abordable pour un coût unitaire donné (lot M7 C19), pur. */
function maxAffordable(
  cost: Partial<Record<ResourceId, number>> | undefined,
  resources: Record<ResourceId, number>,
): number {
  if (!cost) return Infinity;
  let max = Infinity;
  for (const [res, per] of Object.entries(cost) as [ResourceId, number][]) {
    if (per > 0) max = Math.min(max, Math.floor((resources[res] ?? 0) / per));
  }
  return max;
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
  const game = useApp((s) => s.game);
  const player = game.players.find((p) => p.id === humanId(game));
  const unitIds = builtDwellings(town, catalog);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Croissance partagée (doc 05 §3.1/§8) : un groupe dont ≥ 2 membres ont un
  // dwelling bâti se partage une seule croissance hebdo — le joueur choisit le
  // destinataire. Rien à afficher tant qu'un seul membre (ou aucun) est bâti.
  const apexGroups = Object.entries(game.growthGroups)
    .map(([groupId, members]) => ({ groupId, present: members.filter((m) => unitIds.includes(m)) }))
    .filter((g) => g.present.length >= 2);

  const chooseGrowth = (groupId: string, unitId: string): void => {
    onError(null);
    dispatch({ type: 'ChooseSharedGrowth', townId: town.id, groupId, unitId }).catch((err: unknown) => {
      onError(commandErrorMessage(err));
    });
  };

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

  // C19 « Tout recruter » : achat glouton du tier le plus haut au plus bas
  // (proxy : coût unitaire en or décroissant), borné par stock ET ressources
  // courantes. Le plan est calculé contre un snapshot décrémenté puis dispatché
  // séquentiellement (le moteur re-valide chaque `RecruitUnits`).
  const recruitAllPlan = (): { unitId: string; count: number }[] => {
    if (!player) return [];
    const remaining = { ...player.resources };
    const goldCost = (id: string): number =>
      (unitCatalog[id] as (CombatUnitDef & UnitEconomyFields) | undefined)?.recruitCost?.gold ?? 0;
    const ordered = [...unitIds].sort((a, b) => goldCost(b) - goldCost(a));
    const plan: { unitId: string; count: number }[] = [];
    for (const unitId of ordered) {
      const stock = town.stock[unitId] ?? 0;
      if (stock === 0) continue;
      const cost = (unitCatalog[unitId] as (CombatUnitDef & UnitEconomyFields) | undefined)?.recruitCost;
      const count = Math.min(stock, maxAffordable(cost, remaining));
      if (!Number.isFinite(count) || count <= 0) continue;
      plan.push({ unitId, count });
      for (const [res, per] of Object.entries(cost ?? {}) as [ResourceId, number][]) {
        remaining[res] = (remaining[res] ?? 0) - per * count;
      }
    }
    return plan;
  };

  const plan = recruitAllPlan();
  const recruitAll = (): void => {
    onError(null);
    for (const { unitId, count } of plan) recruit(unitId, count);
  };

  return (
    <div class="town-tab-panel" data-testid="town-panel-recruit">
      {apexGroups.map(({ groupId, present }) => {
        const chosen = town.sharedGrowthChoice[groupId] ?? present[0];
        return (
          <div class="town-shared-growth" data-testid={`town-shared-growth-${groupId}`} key={groupId}>
            <span class="town-shared-growth-label">{t('town.sharedGrowth')}</span>
            <div class="town-shared-growth-choices">
              {present.map((unitId) => (
                <button
                  key={unitId}
                  class={unitId === chosen ? 'active' : ''}
                  aria-pressed={unitId === chosen}
                  data-testid={`town-shared-growth-${groupId}-${unitId}`}
                  onClick={() => chooseGrowth(groupId, unitId)}
                >
                  {resolveUnitName(unitId)}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {unitIds.length > 0 && (
        <button
          class="town-recruit-all"
          data-testid="town-recruit-all"
          disabled={plan.length === 0}
          onClick={recruitAll}
        >
          {t('town.recruitAll')}
        </button>
      )}
      <ul class="town-dwelling-list">
        {unitIds.map((unitId) => {
          const stock = town.stock[unitId] ?? 0;
          const qty = qtyFor(unitId, stock);
          const growth = weeklyGrowthOf(game, town, unitId);
          const economy = unitCatalog[unitId] as (CombatUnitDef & UnitEconomyFields) | undefined;
          const totalCost = economy?.recruitCost ? scaleCost(economy.recruitCost, qty) : null;
          return (
            <li key={unitId} class="town-dwelling">
              <div class="town-dwelling-header">
                <span class="town-dwelling-name">{resolveUnitName(unitId)}</span>
                <span class="town-dwelling-stock" data-testid={`town-stock-${unitId}`}>
                  {t('town.stock', { count: stock })}
                  {growth && (
                    // T-GROWTHUI (doc 02 §4.1) : rythme hebdo + plafond d'accumulation.
                    <span class="town-dwelling-growth" data-testid={`town-growth-${unitId}`}>
                      {' · '}
                      {t('town.growthPerWeek', { count: growth.added })}
                      {' · '}
                      {t('town.growthCap', { count: growth.cap })}
                    </span>
                  )}
                </span>
              </div>
              {resolveUnitLore(unitId) && (
                <LoreText
                  text={resolveUnitLore(unitId)!}
                  variant="town-dwelling-lore"
                  testid={`town-unit-lore-${unitId}`}
                />
              )}
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
  const humanPlayerId = humanId(game);
  const hero = game.heroes.find(
    (h) => h.playerId === humanPlayerId && h.pos.x === town.pos.x && h.pos.y === town.pos.y,
  );

  // Caravanes inter-villes (T-CARAVAN, doc 02 §4.1) : destinations = autres villes
  // possédées ; caravanes en route = celles du joueur humain.
  const otherTowns = game.towns.filter(
    (tw) => tw.ownerPlayerId === humanPlayerId && tw.id !== town.id,
  );
  const [caravanDest, setCaravanDest] = useState<string>('');
  const destId = caravanDest || otherTowns[0]?.id || '';
  const myCaravans = game.caravans.filter((c) => c.playerId === humanPlayerId);

  const transfer = (from: 'town' | 'hero', slot: number): void => {
    if (!hero) return;
    onError(null);
    dispatch({ type: 'GarrisonTransfer', townId: town.id, heroId: hero.id, from, slot }).catch((err: unknown) => {
      onError(commandErrorMessage(err)); // remédiation CL6 : message localisé, plus « code: message » brut
    });
  };

  const sendCaravan = (slot: number): void => {
    if (!destId) return;
    onError(null);
    dispatch({ type: 'SendCaravan', fromTownId: town.id, toTownId: destId, slot }).catch((err: unknown) => {
      onError(commandErrorMessage(err));
    });
  };

  const upgrade = (unitId: string): void => {
    onError(null);
    dispatch({ type: 'UpgradeUnits', townId: town.id, unitId }).catch((err: unknown) => {
      onError(commandErrorMessage(err));
    });
  };

  const buyWarMachine = (unitId: string): void => {
    onError(null);
    dispatch({ type: 'BuyWarMachine', townId: town.id, unitId }).catch((err: unknown) => {
      onError(commandErrorMessage(err));
    });
  };

  // Machines de guerre vendues par un bâtiment `warMachineVendor` construit
  // (la Forge, doc 02 §5) — achetables par le héros présent.
  const vendorUnits: string[] = [];
  for (const [bId, lvl] of Object.entries(town.buildings)) {
    const eff = game.buildingCatalog[bId]?.levels[lvl - 1]?.effect;
    if (eff?.type === 'warMachineVendor') for (const u of eff.units) if (!vendorUnits.includes(u)) vendorUnits.push(u);
  }

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
                    {otherTowns.length > 0 && (
                      <button
                        data-testid={`town-caravan-send-${i}`}
                        onClick={() => sendCaravan(i)}
                      >
                        {t('town.sendCaravan')}
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
      {otherTowns.length > 0 && (
        <div class="town-caravans" data-testid="town-caravans">
          <label class="town-caravan-dest-label">
            {t('town.caravanTo')}{' '}
            <select
              data-testid="town-caravan-dest"
              value={destId}
              onChange={(e) => setCaravanDest((e.target as HTMLSelectElement).value)}
            >
              {otherTowns.map((tw) => (
                <option key={tw.id} value={tw.id}>
                  {t('town.at', { x: tw.pos.x, y: tw.pos.y })}
                </option>
              ))}
            </select>
          </label>
          {myCaravans.length > 0 && (
            <ul class="town-caravans-transit" data-testid="town-caravans-transit">
              {myCaravans.map((c) => {
                const dest = game.towns.find((tw) => tw.id === c.toTownId);
                return (
                  <li key={c.id}>
                    {t('town.caravanLine', {
                      count: c.army.reduce((s, st) => s + st.count, 0),
                      town: dest ? t('town.at', { x: dest.pos.x, y: dest.pos.y }) : c.toTownId,
                      days: c.daysLeft,
                    })}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {hero && vendorUnits.length > 0 && (
        <div class="town-war-machines" data-testid="town-war-machines">
          <h3>{t('town.warMachines')}</h3>
          <ol class="town-garrison-slots">
            {vendorUnits.map((unitId) => (
              <li key={unitId} class="town-garrison-slot filled">
                <span>{resolveUnitName(unitId)}</span>
                {hero.warMachines.includes(unitId) ? (
                  <span>{t('town.owned')}</span>
                ) : (
                  <button data-testid={`town-buy-machine-${unitId}`} onClick={() => buyWarMachine(unitId)}>
                    {t('town.buy')}
                    {(() => {
                      const cost = (game.unitCatalog[unitId] as UnitEconomyFields | undefined)?.recruitCost;
                      const c = formatCost(cost ?? {});
                      return c ? ` (${c})` : '';
                    })()}
                  </button>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
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
  const [mode, setMode] = useState<'sell' | 'buy' | 'barter'>('sell');
  const [resource, setResource] = useState<Exclude<ResourceId, 'gold'>>('wood');
  // Ressource reçue en mode troc (T-MARKETRATE) — distincte de `resource` (donnée).
  const [barterReceive, setBarterReceive] = useState<Exclude<ResourceId, 'gold'>>('ore');
  const [amount, setAmount] = useState(1);

  // Cible du troc : jamais la même ressource que celle donnée (repli sur la 1ère
  // autre ressource si l'état a dérivé vers l'égalité).
  const barterTarget: Exclude<ResourceId, 'gold'> =
    barterReceive !== resource ? barterReceive : (TRADABLE_RESOURCE_IDS.find((r) => r !== resource) ?? barterReceive);
  const give: ResourceId = mode === 'buy' ? 'gold' : resource;
  const receive: ResourceId = mode === 'sell' ? 'gold' : mode === 'buy' ? resource : barterTarget;
  const market = game.config?.market;
  // Taux dégressif (T-MARKETRATE) : fonction du nombre de marchés possédés par le
  // propriétaire de la ville — helper moteur (pas de réimplémentation, leçon CL9).
  const marketCount = ownedMarketCount(game, town.ownerPlayerId ?? '');
  const received = market ? tradeQuote(market, give, receive, amount, marketCount) : 0;

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
        <button
          class={mode === 'barter' ? 'active' : ''}
          data-testid="market-mode-barter"
          onClick={() => setMode('barter')}
        >
          {t('town.marketBarter')}
        </button>
      </div>
      <label class="town-market-field">
        {mode === 'barter' ? t('town.marketGive') : t('town.marketResource')}
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
      {mode === 'barter' && (
        <label class="town-market-field">
          {t('town.marketReceiveResource')}
          <select
            data-testid="market-barter-receive"
            value={barterTarget}
            onChange={(e) => setBarterReceive((e.currentTarget as HTMLSelectElement).value as Exclude<ResourceId, 'gold'>)}
          >
            {TRADABLE_RESOURCE_IDS.filter((id) => id !== resource).map((id) => (
              <option key={id} value={id}>
                {t(`resource.${id}`)}
              </option>
            ))}
          </select>
        </label>
      )}
      <p class="town-market-count" data-testid="market-count">
        {t('town.marketOwned', { count: marketCount })}
      </p>
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
