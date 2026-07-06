import {
  simulateAutoCombat,
  type ArmyStack,
  type CombatUnitDef,
  type Resources,
} from '@heroes/engine';
import { loadContent, type FactionPack, type LoadReport } from '@heroes/content';
import { readJsonFromDisk } from './data-dir';

/**
 * Outil `faction:sim` (doc 09 ligne 48, Alpha 4.17) — première passe
 * d'équilibrage. Pour chaque paire de factions, oppose des armées de **valeur
 * d'or égale** (unité de base par tier, effectif ∝ budget/coût) en auto-combat
 * déterministe sur un grand nombre de graines, des deux côtés (l'avantage du
 * premier joueur s'annule), et rapporte les taux de victoire. Cible : 45–55 %.
 *
 * Générique et faction-agnostique : la liste des factions vient des données
 * chargées ; aucun id de faction n'est écrit dans l'outil.
 */

const TIER_BUDGET_GOLD = 4000; // budget d'or par tier → effectif de chaque pile
const MAX_TIER = 7; // T8 (formes spéciales) hors panel d'équilibrage
const SEEDS = 120; // combats par sens (×2 sens = total par paire)
const TERRAIN = 'grass';

/** Bandes de lecture : ✓ équilibré (45–55), ⚠ à surveiller, ✗ déséquilibre béant. */
const TARGET_LOW = 45;
const TARGET_HIGH = 55;
const BLOWOUT_LOW = 20;
const BLOWOUT_HIGH = 80;

/** Catalogue `CombatUnitDef` depuis les paquets (miroir de `buildUnitCatalog` client). */
function buildCatalog(report: LoadReport): Record<string, CombatUnitDef> {
  const catalog: Record<string, CombatUnitDef> = {};
  for (const pack of report.content.packs) {
    for (const unit of pack.units) {
      catalog[unit.id] = {
        id: unit.id,
        groupId: pack.manifest.id,
        nativeTerrain: pack.manifest.nativeTerrain,
        stats: unit.stats,
        abilities: unit.abilities,
        recruitCost: unit.cost as Partial<Resources>,
        growthPerWeek: unit.growthPerWeek,
      };
    }
  }
  return catalog;
}

/**
 * Armée de valeur d'or égale : l'unité **de base** de chaque tier (mappée par
 * `manifest.town.dwellings`), en `budget / coût_or` exemplaires (min 1). Seules
 * les factions au **lineup complet** (tiers 1…MAX_TIER tous présents) entrent
 * dans le panel — une faction de test/stub incomplète fausserait la mesure.
 * Générique : le filtre est structurel (nombre de tiers), pas un nom de faction.
 */
function valueArmy(pack: FactionPack, catalog: Record<string, CombatUnitDef>): ArmyStack[] | null {
  const dwellings = pack.manifest.town?.dwellings;
  if (!dwellings) return null;
  const army: ArmyStack[] = [];
  for (let tier = 1; tier <= MAX_TIER; tier++) {
    const d = dwellings.find((e) => e.tier === tier);
    if (!d) return null; // lineup incomplet ⇒ hors panel d'équilibrage
    const gold = catalog[d.unitId]?.recruitCost?.gold ?? 0;
    const count = gold > 0 ? Math.max(1, Math.floor(TIER_BUDGET_GOLD / gold)) : 1;
    army.push({ unitId: d.unitId, count });
  }
  return army;
}

/** Taux de victoire de A contre B (%) sur `SEEDS` graines × 2 sens (A attaque / B attaque). */
function winrate(
  catalog: Record<string, CombatUnitDef>,
  config: LoadReport['content']['config']['adventure'],
  armyA: ArmyStack[],
  armyB: ArmyStack[],
): number {
  let winsA = 0;
  let total = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    if (simulateAutoCombat(catalog, config, armyA, armyB, TERRAIN, seed) === 'attacker') winsA++;
    total++;
    // Sens inverse : B attaque, A défend — A gagne si le défenseur tient.
    if (simulateAutoCombat(catalog, config, armyB, armyA, TERRAIN, seed) === 'defender') winsA++;
    total++;
  }
  return (winsA / total) * 100;
}

const report = await loadContent(readJsonFromDisk);
const catalog = buildCatalog(report);
const config = report.content.config.adventure;

const armies = report.content.packs
  .map((pack) => ({ id: pack.manifest.id, army: valueArmy(pack, catalog) }))
  .filter((f): f is { id: string; army: ArmyStack[] } => f.army !== null);

console.log(
  `faction:sim — budget ${TIER_BUDGET_GOLD} or/tier (T1–T${MAX_TIER}), ${SEEDS}×2 combats/paire, terrain ${TERRAIN}\n`,
);

let blowouts = 0;
let watch = 0;
for (let i = 0; i < armies.length; i++) {
  for (let j = i + 1; j < armies.length; j++) {
    const a = armies[i]!;
    const b = armies[j]!;
    const rate = winrate(catalog, config, a.army, b.army);
    const inBand = rate >= TARGET_LOW && rate <= TARGET_HIGH;
    const blowout = rate < BLOWOUT_LOW || rate > BLOWOUT_HIGH;
    const mark = blowout ? '✗' : inBand ? '✓' : '⚠';
    if (blowout) blowouts++;
    else if (!inBand) watch++;
    console.log(
      `${mark} ${a.id.padEnd(16)} vs ${b.id.padEnd(16)} — ${rate.toFixed(1).padStart(5)} % / ${(100 - rate).toFixed(1).padStart(5)} %`,
    );
  }
}

console.log(
  `\nfaction:sim — ${blowouts} déséquilibre(s) béant(s) (hors ${BLOWOUT_LOW}–${BLOWOUT_HIGH} %), ` +
    `${watch} à surveiller (hors ${TARGET_LOW}–${TARGET_HIGH} %).`,
);
// Échec seulement sur un déséquilibre BÉANT (garde-fou anti-régression) ; la
// cible fine 45–55 % est un objectif de réglage, pas un blocage CI.
if (blowouts > 0) process.exit(1);
