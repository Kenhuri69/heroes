import { abilityCatalogSchema, loadFactionPack, PackError } from '@heroes/content';
import { readJsonFromDisk } from './data-dir';

const id = process.argv[2];
if (!id) {
  console.error('usage: pnpm faction:validate <id>');
  process.exit(2);
}

const catalog = abilityCatalogSchema.parse(await readJsonFromDisk('core/abilities.json'));
try {
  const pack = await loadFactionPack(readJsonFromDisk, id, catalog);
  console.log(`✓ ${id} — ${pack.units.length} unité(s), locales fr/en OK`);
} catch (e) {
  console.error(`✗ ${id}`);
  const errors = e instanceof PackError ? e.errors : [String(e)];
  for (const err of errors) console.error(`    ${err}`);
  process.exit(1);
}
