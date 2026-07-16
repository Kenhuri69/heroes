import { useMemo, useState } from 'preact/hooks';
import { mapFileSchema } from '@heroes/content';
import { navigate } from '../app/router';
import { t } from '../app/i18n';
import './MapEditor.css';

/** Terrains éditables (doc 02 §2.1) → caractère de légende fixe. */
const TERRAINS = [
  { id: 'grass', char: 'g' },
  { id: 'swamp', char: 's' },
  { id: 'water', char: 'w' },
  { id: 'mountain', char: 'm' },
] as const;
const CHAR_OF = Object.fromEntries(TERRAINS.map((tr) => [tr.id, tr.char]));

/**
 * Outils « objet » (doc 02 §2.2) : chacun pose son type avec des défauts
 * raisonnables à l'export (même approche que l'outil ressource historique qui
 * pose or/500) — l'édition fine des paramètres se fait dans le JSON exporté.
 */
const OBJECT_TOOLS = [
  'resource',
  'town',
  'mine',
  'treasure',
  'artifact',
  'guardian',
  'dwelling',
  'visitable',
  'monolith',
  'obelisk',
] as const;
type ObjectKind = (typeof OBJECT_TOOLS)[number];

/** Glyphe de la grille par type d'objet (le terrain colore, le glyphe identifie). */
const OBJECT_GLYPHS: Record<ObjectKind, string> = {
  resource: '◆',
  town: '⌂',
  mine: '⚒',
  treasure: '▣',
  artifact: '✦',
  guardian: '⚔',
  dwelling: '⛺',
  visitable: '✚',
  monolith: '⛩',
  obelisk: '🗿',
};

type Tool = (typeof TERRAINS)[number]['id'] | 'start' | ObjectKind | 'erase';
type MapObj = { kind: ObjectKind; x: number; y: number };

const clampSize = (n: number): number => Math.max(4, Math.min(32, Math.round(n) || 4));

/**
 * Éditeur de carte interne minimal (doc 08, Alpha 4.18) : grille DOM peinte au
 * clic, placement de positions de départ / ressources / villes, export d'un
 * `data/maps/<id>.map.json` **validé par `mapFileSchema`** (jamais d'export
 * invalide) et import d'une carte existante. Routes/gardiens/triggers = ultérieur.
 */
export function MapEditor() {
  const [id, setId] = useState('ma-carte');
  const [width, setWidth] = useState(12);
  const [height, setHeight] = useState(10);
  const [terrain, setTerrain] = useState<string[]>(() => Array(12 * 10).fill('grass'));
  const [starts, setStarts] = useState<{ x: number; y: number }[]>([]);
  const [objects, setObjects] = useState<MapObj[]>([]);
  const [tool, setTool] = useState<Tool>('grass');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const resize = (w: number, h: number): void => {
    const next = Array.from({ length: w * h }, (_, i) => {
      const x = i % w;
      const y = Math.floor(i / w);
      return x < width && y < height ? (terrain[y * width + x] ?? 'grass') : 'grass';
    });
    setTerrain(next);
    setStarts((s) => s.filter((p) => p.x < w && p.y < h));
    setObjects((o) => o.filter((p) => p.x < w && p.y < h));
    setWidth(w);
    setHeight(h);
  };

  const apply = (x: number, y: number): void => {
    setMessage(null);
    if (tool === 'start') {
      setStarts((s) =>
        s.some((p) => p.x === x && p.y === y) ? s.filter((p) => !(p.x === x && p.y === y)) : [...s, { x, y }],
      );
      return;
    }
    if ((OBJECT_TOOLS as readonly string[]).includes(tool)) {
      setObjects((o) => [
        ...o.filter((p) => !(p.x === x && p.y === y)),
        { kind: tool as ObjectKind, x, y },
      ]);
      return;
    }
    if (tool === 'erase') {
      setStarts((s) => s.filter((p) => !(p.x === x && p.y === y)));
      setObjects((o) => o.filter((p) => !(p.x === x && p.y === y)));
      return;
    }
    setTerrain((tr) => {
      const next = [...tr];
      next[y * width + x] = tool;
      return next;
    });
  };

  /** Construit le `MapFile` sérialisable depuis l'état de l'éditeur. */
  const buildMap = useMemo(
    () => (): unknown => {
      const tiles: string[] = [];
      const roads: string[] = [];
      for (let y = 0; y < height; y++) {
        let row = '';
        for (let x = 0; x < width; x++) row += CHAR_OF[terrain[y * width + x] ?? 'grass'];
        tiles.push(row);
        roads.push('0'.repeat(width));
      }
      // Défauts d'export par type (les ids d'unité/artefact suivent le contenu
      // du dépôt, comme la ressource « gold » historique).
      const objs = objects.map((o, i) => {
        const base = { id: `${o.kind}-${i + 1}`, type: o.kind, x: o.x, y: o.y };
        if (o.kind === 'resource') return { ...base, resource: 'gold', amount: 500 };
        if (o.kind === 'mine') return { ...base, resource: 'gold', amount: 1000 };
        if (o.kind === 'treasure') return { ...base, gold: 1000, xp: 800 };
        if (o.kind === 'artifact') return { ...base, artifactId: 'trefle-chance' };
        if (o.kind === 'guardian') return { ...base, unitId: 't1-recruit', count: 6 };
        if (o.kind === 'dwelling') return { ...base, unitId: 't1-recruit', stock: 8 };
        if (o.kind === 'visitable')
          return {
            ...base,
            effect: { kind: 'luck', amount: 1 },
            frequency: 'oncePerHeroPerWeek',
          };
        return base; // town
      });
      return {
        id,
        schemaVersion: 1,
        width,
        height,
        legend: { g: 'grass', s: 'swamp', w: 'water', m: 'mountain' },
        tiles,
        roads,
        objects: objs,
        startPositions: starts.map((p) => ({ x: p.x, y: p.y })),
      };
    },
    [id, width, height, terrain, objects, starts],
  );

  const exportMap = (): void => {
    const map = buildMap();
    const parsed = mapFileSchema.safeParse(map);
    if (!parsed.success) {
      setMessage({ ok: false, text: t('editor.invalid', { n: parsed.error.issues.length }) });
      return;
    }
    if (starts.length === 0) {
      setMessage({ ok: false, text: t('editor.needStart') });
      return;
    }
    const blob = new Blob([JSON.stringify(map, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${id}.map.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ ok: true, text: t('editor.exported') });
  };

  const importMap = (e: Event): void => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    void file.text().then((text) => {
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        setMessage({ ok: false, text: t('editor.importError') });
        return;
      }
      const parsed = mapFileSchema.safeParse(data);
      if (!parsed.success) {
        setMessage({ ok: false, text: t('editor.importError') });
        return;
      }
      const m = parsed.data;
      const inv = Object.fromEntries(Object.entries(m.legend).map(([c, terr]) => [c, terr]));
      const flat: string[] = [];
      for (const row of m.tiles) for (const c of row) flat.push(inv[c] ?? 'grass');
      setId(m.id);
      setWidth(m.width);
      setHeight(m.height);
      setTerrain(flat);
      setStarts(m.startPositions.map((p) => ({ x: p.x, y: p.y })));
      setObjects(m.objects.map((o): MapObj => ({ kind: o.type, x: o.x, y: o.y })));
      setMessage({ ok: true, text: t('editor.imported') });
    });
  };

  const startAt = (x: number, y: number): number =>
    starts.findIndex((p) => p.x === x && p.y === y);
  const objAt = (x: number, y: number): MapObj | undefined =>
    objects.find((p) => p.x === x && p.y === y);

  return (
    <div class="map-editor" data-testid="map-editor">
      <header class="map-editor-bar">
        <button data-testid="editor-back" onClick={() => navigate('menu')}>
          {t('editor.back')}
        </button>
        <label>
          {t('editor.name')}
          <input value={id} onInput={(e) => setId((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <label>
          {t('editor.width')}
          <input
            type="number"
            value={width}
            data-testid="editor-width"
            onChange={(e) => resize(clampSize(+(e.currentTarget as HTMLInputElement).value), height)}
          />
        </label>
        <label>
          {t('editor.height')}
          <input
            type="number"
            value={height}
            data-testid="editor-height"
            onChange={(e) => resize(width, clampSize(+(e.currentTarget as HTMLInputElement).value))}
          />
        </label>
      </header>

      <div class="map-editor-tools" role="group" aria-label={t('editor.tools')}>
        {TERRAINS.map((tr) => (
          <button
            key={tr.id}
            class={`tool terrain-${tr.id}${tool === tr.id ? ' active' : ''}`}
            data-testid={`editor-tool-${tr.id}`}
            onClick={() => setTool(tr.id)}
          >
            {t(`editor.terrain.${tr.id}`)}
          </button>
        ))}
        {(['start', ...OBJECT_TOOLS, 'erase'] as const).map((tl) => (
          <button
            key={tl}
            class={`tool${tool === tl ? ' active' : ''}`}
            data-testid={`editor-tool-${tl}`}
            onClick={() => setTool(tl)}
          >
            {t(`editor.tool.${tl}`)}
          </button>
        ))}
      </div>

      <div
        class="map-editor-grid"
        style={{ gridTemplateColumns: `repeat(${width}, 1fr)` }}
        data-testid="editor-grid"
      >
        {Array.from({ length: width * height }, (_, i) => {
          const x = i % width;
          const y = Math.floor(i / width);
          const s = startAt(x, y);
          const o = objAt(x, y);
          return (
            <button
              key={i}
              class={`cell terrain-${terrain[i] ?? 'grass'}`}
              data-testid={`editor-cell-${x}-${y}`}
              aria-label={`${x},${y} ${terrain[i] ?? 'grass'}`}
              onClick={() => apply(x, y)}
            >
              {s !== -1 ? <span class="mark start">{s + 1}</span> : null}
              {o ? <span class="mark obj">{OBJECT_GLYPHS[o.kind]}</span> : null}
            </button>
          );
        })}
      </div>

      <div class="map-editor-actions">
        <button class="menu-button" data-testid="editor-export" onClick={exportMap}>
          {t('editor.export')}
        </button>
        <label class="map-editor-import">
          {t('editor.import')}
          <input type="file" accept=".json,application/json" data-testid="editor-import" onChange={importMap} />
        </label>
        {message && (
          <span
            class={`map-editor-message${message.ok ? ' ok' : ' err'}`}
            data-testid={message.ok ? 'editor-valid' : 'editor-error'}
          >
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
