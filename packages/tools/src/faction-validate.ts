import { abilityCatalogSchema, buildingCatalogSchema, loadFactionPack, PackError, skillCatalogSchema, spellCatalogSchema } from '@heroes/content';
import { readJsonFromDisk } from './data-dir';

const id = process.argv[2];
if (!id) {
  console.error('usage: pnpm faction:validate <id>');
  process.exit(2);
}

const catalog = abilityCatalogSchema.parse(await readJsonFromDisk('core/abilities.json'));
// Bâtiments communs (townHall/fort/guilde…) : requis pour résoudre
// `manifest.town.buildings` et détecter les collisions d'ids avec le core —
// sans eux, `faction:validate` échouait faussement (« bâtiment inconnu 'fort' »)
// pour toute faction dotée d'une ville (remédiation R5 CO1).
const coreBuildings = buildingCatalogSchema.parse(await readJsonFromDisk('core/buildings.json')).buildings;
// Sorts/compétences core (B16, revue 2026-07) : requis pour cross-valider
// `startingSkills`/`startingSpells` des héros nommés et `grantSpell` des
// bâtiments — sans eux, tout paquet doté de héros échouait faussement
// (« compétence de départ inconnue 'leadership' »…), comme R5 CO1.
const coreSpells = spellCatalogSchema.parse(await readJsonFromDisk('core/spells.json')).spells;
const coreSkills = skillCatalogSchema.parse(await readJsonFromDisk('core/skills.json')).skills;
try {
  const pack = await loadFactionPack(readJsonFromDisk, id, catalog, coreBuildings, coreSpells, coreSkills);
  console.log(`✓ ${id} — ${pack.units.length} unité(s), locales fr/en OK`);
} catch (e) {
  console.error(`✗ ${id}`);
  const errors = e instanceof PackError ? e.errors : [String(e)];
  for (const err of errors) console.error(`    ${err}`);
  process.exit(1);
}
