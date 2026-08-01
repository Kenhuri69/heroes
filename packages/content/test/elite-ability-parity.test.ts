import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadContent, type ReadJson } from '../src/loader';

/**
 * CAP-DATAFIX.2 — invariant de PARITÉ des unités améliorées : une unité `*-elite`
 * (débloquée par le dwelling gradué niveau 2) doit posséder **au moins** toutes les
 * capacités de signature de sa version de base. Une amélioration n'est jamais
 * strictement inférieure (docs 03/04/05/16 §lineup). Ce test ancre l'invariant :
 * un lot CAP-* qui ajoute une capacité à une base sans la répercuter sur l'elite
 * le casse.
 *
 * Faction-agnostique : on itère les paquets réellement chargés, aucun id littéral
 * de faction (garde-fou de modularité, ci.yml).
 */
const DATA_DIR = resolve(fileURLToPath(import.meta.url), '../../../../data');

const readJsonFromDisk: ReadJson = async (path) => {
  const text = await readFile(join(DATA_DIR, path), 'utf8');
  return JSON.parse(text) as unknown;
};

describe('parité des capacités base → elite (CAP-DATAFIX.2)', () => {
  it('chaque unité améliorée possède au moins les capacités de sa base', async () => {
    const { content } = await loadContent(readJsonFromDisk);
    let pairs = 0;
    for (const pack of content.packs) {
      const byId = new Map(pack.units.map((u) => [u.id, u]));
      for (const elite of pack.units) {
        if (!elite.id.endsWith('-elite')) continue;
        const base = byId.get(elite.id.slice(0, -'-elite'.length));
        if (!base) continue;
        pairs++;
        const eliteIds = new Set(elite.abilities.map((a) => a.id));
        const missing = base.abilities.map((a) => a.id).filter((id) => !eliteIds.has(id));
        expect(missing, `${elite.id} devrait hériter des capacités de ${base.id}`).toEqual([]);
      }
    }
    // Garde-fou : au moins quelques paires existent (sinon le test ne prouve rien).
    expect(pairs).toBeGreaterThan(0);
  });

  /**
   * Corollaire chiffré de la même règle : une amélioration peut être re-profilée
   * (troquer de la robustesse contre une capacité — ex. une élite T1 qui devient
   * un tireur perd des PV/de la défense), mais **jamais** au point de passer
   * SOUS sa version de base. Et une capacité `shooter` sans munitions
   * utilisables serait une capacité morte (`shooterAmmo` → 0 ⇒ aucun tir).
   */
  it('une unité améliorée ne régresse sous sa base, et tout tireur a des munitions', async () => {
    const { content } = await loadContent(readJsonFromDisk);
    let shooters = 0;
    for (const pack of content.packs) {
      const byId = new Map(pack.units.map((u) => [u.id, u]));
      for (const unit of pack.units) {
        for (const shooter of unit.abilities.filter((a) => a.id === 'shooter')) {
          shooters++;
          const ammo = shooter.params?.['ammo'];
          expect(typeof ammo, `${unit.id} : shooter sans munitions déclarées`).toBe('number');
          expect(ammo as number, `${unit.id} : munitions non utilisables`).toBeGreaterThan(0);
        }
        if (!unit.id.endsWith('-elite')) continue;
        const base = byId.get(unit.id.slice(0, -'-elite'.length));
        if (!base) continue;
        for (const key of ['hp', 'attack', 'defense', 'speed'] as const) {
          expect(unit.stats[key], `${unit.id}.${key} sous ${base.id}`).toBeGreaterThanOrEqual(
            base.stats[key],
          );
        }
        for (const i of [0, 1] as const) {
          expect(
            unit.stats.damage[i],
            `${unit.id}.damage[${i}] sous ${base.id}`,
          ).toBeGreaterThanOrEqual(base.stats.damage[i]);
        }
      }
    }
    expect(shooters).toBeGreaterThan(0);
  });
});
