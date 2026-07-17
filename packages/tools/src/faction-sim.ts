import {
  simulateAutoCombat,
  simulateHeroCombat,
  type ArmyStack,
  type CombatUnitDef,
  type FactionBonus,
  type Resources,
} from '@heroes/engine';
import { buildFactionCatalog, loadContent, type FactionPack, type LoadReport } from '@heroes/content';
import { readJsonFromDisk } from './data-dir';

/**
 * Outil `faction:sim` (doc 09 ligne 48, Alpha 4.17) — équilibrage mesuré. Pour
 * chaque paire de factions, oppose des armées de **valeur d'or égale** (unité de
 * base par tier, effectif ∝ budget/coût) en auto-combat déterministe, des deux
 * côtés (l'avantage du premier joueur s'annule). Trois lectures complémentaires
 * (plan `faction-sim-fidelity`) :
 *
 *  1. **Duel valeur-égale** — winrate d'un combat unique. Canari de stats brutes
 *     (a trouvé l'outlier Dragon d'Ombre). Aveugle aux mécaniques inter-combat.
 *  2. **Matrice d'attrition** — chaque camp (armée budget + héros + effets de
 *     faction) enchaîne des vagues d'un adversaire FRAIS plein-budget, en
 *     reportant survivants + relève. Profondeur = vagues vaincues avant wipe.
 *     **Valorise la nécromancie & la dominance** qu'un duel unique ne voit pas.
 *  3. **Gauntlet de survie** — chaque faction affronte une rotation escaladante
 *     des autres factions ; score = vagues survécues. Même yardstick pour
 *     toutes ⇒ classement de robustesse (sustain) comparable.
 *
 * Générique et faction-agnostique : la liste des factions vient des données
 * chargées ; aucun id de faction n'est écrit dans l'outil.
 *
 * **Limitation assumée** : la résonance/essence (ressource de faction gagnée en
 * combat mais DÉPENSÉE hors combat, au recrutement gaté) reste hors périmètre —
 * un sim de combat pur n'a nulle part où la dépenser. Elle ne sous-estime que
 * Vox (déjà la faction la plus forte) ⇒ n'inverse aucun verdict.
 */

const TIER_BUDGET_GOLD = 4000; // budget d'or par tier → effectif de chaque pile
const MAX_TIER = 7; // T8 (formes spéciales) hors panel d'équilibrage
const SEEDS = 120; // combats par sens (×2 sens = total par paire)
const TERRAIN = 'grass';

// Attrition & gauntlet : report d'armée coûteux ⇒ moins de graines, vagues bornées.
// Les vagues démarrent à une FRACTION du budget puis grossissent (`WAVE_BASE` +
// `WAVE_STEP`×n) : un adversaire plein-budget à chaque vague écrase le vainqueur
// (armée valeur-égale ⇒ ~50/50, survivant réduit à un filet) ⇒ profondeur ~0-1
// sans pouvoir discriminant. Des vagues croissantes laissent le sustain (relève,
// soin, drain) compounder — c'est là que la nécromancie devient visible.
const ATTRITION_SEEDS = 5; // graines de départ moyennées par sens
const ATTRITION_MAX_WAVES = 15; // borne de sécurité (une faction dominante plafonne ici)
const GAUNTLET_SEEDS = 6;
const GAUNTLET_MAX_WAVES = 18;
const WAVE_BASE = 0.3; // effectif de la vague 0 = 30 % du budget adverse
const WAVE_STEP = 0.2; // +20 pts de budget par vague (vague n = 30 % + 20 %·n)
const WAVE_SEED_STRIDE = 1000; // décale la graine entre vagues d'un même run

/** Bandes de lecture : ✓ équilibré (45–55), ⚠ à surveiller, ✗ déséquilibre béant. */
const TARGET_LOW = 45;
const TARGET_HIGH = 55;
const BLOWOUT_LOW = 20;
const BLOWOUT_HIGH = 80;

type FactionArmy = { id: string; army: ArmyStack[] };

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

const copyArmy = (army: ArmyStack[]): ArmyStack[] => army.map((s) => ({ unitId: s.unitId, count: s.count }));

/** Vague = fraction croissante `WAVE_BASE + WAVE_STEP·wave` du budget adverse (min 1/pile). */
function scaledWave(army: ArmyStack[], wave: number): ArmyStack[] {
  const mult = WAVE_BASE + WAVE_STEP * wave;
  return army.map((s) => ({ unitId: s.unitId, count: Math.max(1, Math.round(s.count * mult)) }));
}

/**
 * Profondeur d'attrition : un challenger (armée budget + héros de faction
 * `challengerId`) enchaîne des vagues FRAÎCHES et CROISSANTES (`waveOpponent`),
 * en reportant son armée reconstruite d'une vague à l'autre. Retourne le nombre
 * de vagues vaincues avant d'être vidé. Le héros de faction fait bien s'appliquer
 * la nécromancie (report ⇒ compounding du sustain). `waveOpponent` fournit l'armée
 * ET la faction adverse par vague (une faction à `combatBonus` passif change le
 * combat ⇒ l'id de faction adverse doit être exact).
 */
function attritionDepth(
  catalog: Record<string, CombatUnitDef>,
  config: LoadReport['content']['config']['adventure'],
  factionCatalog: Record<string, { bonuses: FactionBonus[] }>,
  challengerId: string,
  challengerArmy: ArmyStack[],
  seed: number,
  maxWaves: number,
  waveOpponent: (wave: number) => { army: ArmyStack[]; factionId: string },
): number {
  let army = copyArmy(challengerArmy);
  let depth = 0;
  for (let wave = 0; wave < maxWaves; wave++) {
    const opp = waveOpponent(wave);
    const res = simulateHeroCombat(
      catalog,
      config,
      factionCatalog,
      { army, factionId: challengerId },
      { army: opp.army, factionId: opp.factionId },
      seed + wave * WAVE_SEED_STRIDE,
    );
    if (res.winner !== 'attacker' || res.challengerArmy.length === 0) break;
    depth += 1;
    army = res.challengerArmy;
  }
  return depth;
}

/** Moyenne d'une mesure d'attrition sur plusieurs graines de départ (1 décimale). */
function avgDepth(samples: number, run: (seed: number) => number): number {
  let sum = 0;
  for (let s = 1; s <= samples; s++) sum += run(s);
  return sum / samples;
}

const report = await loadContent(readJsonFromDisk);
const catalog = buildCatalog(report);
const config = report.content.config.adventure;
const factionCatalog = buildFactionCatalog(report);

const armies: FactionArmy[] = report.content.packs
  .map((pack) => ({ id: pack.manifest.id, army: valueArmy(pack, catalog) }))
  .filter((f): f is FactionArmy => f.army !== null);

// ── 1. Duel valeur-égale (canari de stats) ─────────────────────────────────
console.log(
  `faction:sim — budget ${TIER_BUDGET_GOLD} or/tier (T1–T${MAX_TIER}), terrain ${TERRAIN}\n`,
);
console.log(`# Duel valeur-égale — ${SEEDS}×2 combats/paire (winrate)\n`);

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

// ── 2. Matrice d'attrition (report d'armée + nécromancie) ───────────────────
console.log(
  `\n# Attrition — vagues fraîches CROISSANTES vaincues avant wipe ` +
    `(report d'armée, ${ATTRITION_SEEDS} graines, ${Math.round(WAVE_BASE * 100)} %+${Math.round(WAVE_STEP * 100)} %/vague, cap ${ATTRITION_MAX_WAVES})\n`,
);
for (let i = 0; i < armies.length; i++) {
  for (let j = i + 1; j < armies.length; j++) {
    const a = armies[i]!;
    const b = armies[j]!;
    const depthAB = avgDepth(ATTRITION_SEEDS, (seed) =>
      attritionDepth(catalog, config, factionCatalog, a.id, a.army, seed, ATTRITION_MAX_WAVES, (wave) => ({
        army: scaledWave(b.army, wave),
        factionId: b.id,
      })),
    );
    const depthBA = avgDepth(ATTRITION_SEEDS, (seed) =>
      attritionDepth(catalog, config, factionCatalog, b.id, b.army, seed, ATTRITION_MAX_WAVES, (wave) => ({
        army: scaledWave(a.army, wave),
        factionId: a.id,
      })),
    );
    // Repère lisible : ⚖ équilibré (écart < 1 vague), sinon ◀/▶ vers le plus profond.
    const gap = Math.abs(depthAB - depthBA);
    const mark = gap < 1 ? '⚖' : depthAB > depthBA ? '◀' : '▶';
    console.log(
      `${mark} ${a.id.padEnd(16)} vs ${b.id.padEnd(16)} — ${depthAB.toFixed(1).padStart(4)} / ${depthBA.toFixed(1).padStart(4)} vagues`,
    );
  }
}

// ── 3. Gauntlet de survie (rotation escaladante des autres factions) ────────
console.log(
  `\n# Gauntlet de survie — vagues survécues vs rotation escaladante des autres ` +
    `(${GAUNTLET_SEEDS} graines, ${Math.round(WAVE_BASE * 100)} %+${Math.round(WAVE_STEP * 100)} %/vague, cap ${GAUNTLET_MAX_WAVES})\n`,
);
const gauntlet = armies
  .map((f) => {
    const others = armies.filter((o) => o.id !== f.id);
    const depth = avgDepth(GAUNTLET_SEEDS, (seed) =>
      attritionDepth(catalog, config, factionCatalog, f.id, f.army, seed, GAUNTLET_MAX_WAVES, (wave) => {
        // Rotation des autres factions, effectif croissant vague après vague.
        const opp = others[wave % others.length]!;
        return { army: scaledWave(opp.army, wave), factionId: opp.id };
      }),
    );
    return { id: f.id, depth };
  })
  .sort((a, b) => b.depth - a.depth);
for (const g of gauntlet) {
  console.log(`  ${g.id.padEnd(16)} — ${g.depth.toFixed(1).padStart(4)} vagues`);
}

console.log(
  `\nfaction:sim — ${blowouts} déséquilibre(s) béant(s) au duel (hors ${BLOWOUT_LOW}–${BLOWOUT_HIGH} %), ` +
    `${watch} à surveiller (hors ${TARGET_LOW}–${TARGET_HIGH} %). ` +
    `Attrition & gauntlet = lectures qualitatives (sustain/nécromancie), pas de gate.`,
);
// Échec seulement sur un déséquilibre BÉANT au duel (garde-fou anti-régression) ;
// la cible fine 45–55 % et les lectures d'attrition/gauntlet sont des objectifs
// de réglage, pas des blocages CI.
if (blowouts > 0) process.exit(1);
