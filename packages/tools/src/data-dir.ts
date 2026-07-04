import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import type { ReadJson } from '@heroes/content';

/** Racine data/ du monorepo (les CLIs tournent depuis packages/tools). */
export const DATA_DIR = resolve(fileURLToPath(import.meta.url), '../../../../data');

export const readJsonFromDisk: ReadJson = async (path) => {
  const text = await readFile(join(DATA_DIR, path), 'utf8');
  return JSON.parse(text) as unknown;
};
