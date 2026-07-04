import { loadContent, type LoadReport, type ReadJson } from '@heroes/content';

/** Lecteur navigateur : data/ est copié à la racine du site par Vite (publicDir). */
const readJsonFromSite: ReadJson = async (path) => {
  const res = await fetch(`${import.meta.env.BASE_URL}${path}`);
  if (!res.ok) throw new Error(`fichier introuvable: ${path} (HTTP ${res.status})`);
  return (await res.json()) as unknown;
};

/**
 * Charge tout le contenu au démarrage. Un paquet invalide est rejeté avec un
 * rapport en console.error (jamais de crash — doc 06 §1) ; le smoke test
 * échoue donc si les paquets du dépôt cassent.
 */
export async function loadGameContent(): Promise<LoadReport> {
  const report = await loadContent(readJsonFromSite);
  for (const rejected of report.rejected) {
    console.error(`paquet de faction rejeté : ${rejected.id}\n${rejected.errors.join('\n')}`);
  }
  return report;
}
