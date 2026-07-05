import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DATA_DIR } from './data-dir';

/**
 * `pnpm faction:new <id>` (doc 06 §5.2) : génère un squelette de paquet VALIDE
 * (manifest + 1 unité + locales fr/en) et l'inscrit dans factions/index.json.
 * Le paquet généré doit passer `faction:validate` sans retouche.
 */
const id = process.argv[2];
if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
  console.error('usage: pnpm faction:new <id-en-kebab-case>');
  process.exit(2);
}

const dir = join(DATA_DIR, 'factions', id);
// Id d'unité préfixé par la faction (remédiation R5 CO2) : un `t1-recruit` en
// dur entrait en collision avec l'unité du paquet de test ; les ids d'unités
// doivent être globalement uniques entre paquets.
const unitId = `t1-${id}-recruit`;

const manifest = {
  id,
  schemaVersion: 1,
  name: `@loc:faction.${id}.name`,
  nativeTerrain: 'plains',
  keyResources: ['crystal', 'gems'],
  factionResources: [],
  factionBonuses: [],
  spellSchool: null,
  heroSkills: [],
  tiers: 7,
  sharedGrowthGroups: {},
  units: [unitId],
  abilityModules: [],
  hooks: [],
  aiProfile: { aggression: 0.5, focusFire: 0.5, preferredTargets: 'nearest' },
};

const unit = {
  id: unitId,
  tier: 1,
  name: `@loc:unit.${unitId}.name`,
  stats: { hp: 6, attack: 3, defense: 2, damage: [1, 2], speed: 4 },
  growthPerWeek: 14,
  cost: { gold: 30 },
  abilities: [],
};

const locales = {
  fr: { [`faction.${id}.name`]: `Faction ${id}`, [`unit.${unitId}.name`]: 'Recrue' },
  en: { [`faction.${id}.name`]: `Faction ${id}`, [`unit.${unitId}.name`]: 'Recruit' },
};

await mkdir(join(dir, 'units'), { recursive: true });
await mkdir(join(dir, 'locales'), { recursive: true });
await writeJson(join(dir, 'manifest.json'), manifest);
await writeJson(join(dir, 'units', `${unitId}.json`), unit);
await writeJson(join(dir, 'locales', 'fr.json'), locales.fr);
await writeJson(join(dir, 'locales', 'en.json'), locales.en);

const indexPath = join(DATA_DIR, 'factions', 'index.json');
const index = JSON.parse(await readFile(indexPath, 'utf8')) as { factions: string[] };
if (!index.factions.includes(id)) {
  index.factions.push(id);
  await writeJson(indexPath, index);
}

console.log(`✓ squelette généré : data/factions/${id}/ (inscrit dans index.json)`);
console.log(`  suite : pnpm faction:validate ${id}`);

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
