import { loadContent } from '@heroes/content';
import { readJsonFromDisk } from './data-dir';

const report = await loadContent(readJsonFromDisk);

for (const pack of report.content.packs) {
  console.log(`✓ ${pack.manifest.id} — ${pack.units.length} unité(s), locales fr/en OK`);
}
for (const rejected of report.rejected) {
  console.error(`✗ ${rejected.id}`);
  for (const err of rejected.errors) console.error(`    ${err}`);
}

if (report.rejected.length > 0) {
  console.error(`\ncontent:check — ${report.rejected.length} paquet(s) invalide(s).`);
  process.exit(1);
}
console.log(`\ncontent:check — ${report.content.packs.length} paquet(s) valides.`);
