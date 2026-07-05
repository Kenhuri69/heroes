import { Assets, type Texture } from 'pixi.js';

/**
 * Registre d'assets — pont entre le staging `assets/` (racine du dépôt) et le
 * client, ouvert au lot d'intégration (doc 12 §10).
 *
 * **Auto-découverte** : tout PNG de `assets/` est enregistré à la compilation
 * par Vite. Ajouter un asset = déposer le fichier (nommé par convention), il est
 * repris sans câblage manuel — c'est ce qui rend l'enrichissement futur trivial.
 *
 * **Hors bundle JS** : `query:'?url'` fait émettre par Vite chaque PNG en fichier
 * séparé hashé (`dist/assets/*.png`) et nous donne son URL ; seules ~140 chaînes
 * d'URL entrent dans le JS. Le garde-fou budget CI ne mesure que `*.js`/`*.css`
 * de `dist/assets` → les PNG en sont exclus. Les octets sont **fetchés à la
 * demande** par `<img>` (DOM) ou `Assets.load` (PixiJS) — lazy, doc 07 §6.
 */
const modules = import.meta.glob(['../../../../assets/**/*.png', '!**/_preview.png'], {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/**
 * Index par chemin relatif à `assets/` sans extension :
 * `mines/mine-gold`, `buildings/<faction>/<buildingId>`, `ui/res-gold_32`,
 * `tiles/grass-1`, `artifacts/lame-aiguisee`.
 */
const registry = new Map<string, string>();
for (const [path, url] of Object.entries(modules)) {
  const m = path.match(/\/assets\/(.+)\.png$/);
  if (!m || !m[1]) continue;
  registry.set(m[1], url);
}

/** URL hashée d'un asset par sa clé (`famille/nom`), ou `undefined` si absent. */
export function assetUrl(key: string): string | undefined {
  return registry.get(key);
}

// --- Résolveurs par famille (faction-agnostiques, convention de nommage) ---

const TILE_VARIANTS = 3;

/** Variante déterministe 1..3 d'une tuile, dérivée de sa position (damier stable). */
export function tileVariant(x: number, y: number): number {
  return (Math.abs(x * 31 + y * 17) % TILE_VARIANTS) + 1;
}

export function tileUrl(terrain: string, variant: number): string | undefined {
  return registry.get(`tiles/${terrain}-${variant}`);
}

export function roadUrl(): string | undefined {
  return registry.get('tiles/road-dirt');
}

/** Objet de carte « tas de ressource » → visuel de mine par ressource. */
export function mineUrl(resource: string): string | undefined {
  return registry.get(`mines/mine-${resource}`);
}

export function artifactUrl(id: string): string | undefined {
  return registry.get(`artifacts/${id}`);
}

/**
 * Vignette de bâtiment : les fichiers sont nommés exactement par `buildingId`,
 * rangés sous `buildings/<factionId>/` (dwellings & Cercles) ou `buildings/core/`
 * (bâtiments communs). On tente d'abord la faction, puis les communs.
 */
export function buildingUrl(buildingId: string, factionId?: string): string | undefined {
  return (
    (factionId ? registry.get(`buildings/${factionId}/${buildingId}`) : undefined) ??
    registry.get(`buildings/core/${buildingId}`)
  );
}

const ICON_SIZES = [16, 24, 32, 48, 64] as const;

/** Plus petit mipmap ≥ à la taille d'affichage voulue (nets sans sur-poids). */
function pickIconSize(px: number): number {
  return ICON_SIZES.find((s) => s >= px) ?? 64;
}

export function resourceIconUrl(id: string, px = 24): string | undefined {
  return registry.get(`ui/res-${id}_${pickIconSize(px)}`);
}

export function statIconUrl(stat: string, px = 24): string | undefined {
  return registry.get(`ui/stat-${stat}_${pickIconSize(px)}`);
}

export function dayIconUrl(px = 24): string | undefined {
  return registry.get(`ui/ui-day_${pickIconSize(px)}`);
}

// --- Chemin PixiJS : préchargement + lecture synchrone du cache ---

/** URLs rendues dans PixiJS (tuiles + mines) — préchargées au bootstrap. */
function pixiUrls(): string[] {
  const urls: string[] = [];
  for (const [key, url] of registry) {
    if (key.startsWith('tiles/') || key.startsWith('mines/')) urls.push(url);
  }
  return urls;
}

/**
 * Réchauffe le cache de textures PixiJS une fois au démarrage. Best-effort et
 * tolérant : une texture qui échoue ne bloque pas les autres (repli procédural
 * au rendu, cf. `getTexture`). Idempotent.
 */
export async function preloadPixiTextures(): Promise<void> {
  await Promise.allSettled(pixiUrls().map((url) => Assets.load(url)));
}

/** Texture préchargée si disponible, sinon `undefined` (⇒ repli procédural). */
export function getTexture(url: string | undefined): Texture | undefined {
  if (!url) return undefined;
  return Assets.cache.has(url) ? (Assets.get(url) as Texture) : undefined;
}
