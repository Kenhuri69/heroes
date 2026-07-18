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
const modules = import.meta.glob(
  ['../../../../assets/**/*.png', '../../../../assets/**/*.jpg', '!**/_preview.png'],
  {
    eager: true,
    query: '?url',
    import: 'default',
  },
) as Record<string, string>;

/**
 * Index par chemin relatif à `assets/` sans extension :
 * `mines/mine-gold`, `buildings/<faction>/<buildingId>`, `ui/res-gold_32`,
 * `tiles/grass-1`, `artifacts/lame-aiguisee`.
 */
const registry = new Map<string, string>();
for (const [path, url] of Object.entries(modules)) {
  const m = path.match(/\/assets\/(.+)\.(?:png|jpe?g)$/);
  if (!m || !m[1]) continue;
  registry.set(m[1], url);
}

/** URL hashée d'un asset par sa clé (`famille/nom`), ou `undefined` si absent. */
export function assetUrl(key: string): string | undefined {
  return registry.get(key);
}

// --- Décors peints (staging `assets/backgrounds`, `assets/logo` — lot U5-B) ---
// Faction-agnostiques (convention de nommage) ; `undefined` ⇒ repli procédural.

/** Fond peint de l'écran de ville par faction (`backgrounds/town-<factionId>`). */
export function townBackgroundUrl(factionId: string): string | undefined {
  return registry.get(`backgrounds/town-${factionId}`);
}

/**
 * Layout des emplacements de la vue de ville par faction (UX-TOWNVIEW lot 2) :
 * ancres `{x,y}` en % calées sur le décor peint, chargées depuis
 * `assets/layouts/town-<factionId>.json`. Data-driven (hors `packages/`,
 * faction-agnostique — id opaque comme `townBackgroundUrl`) : déposer un JSON
 * ajoute/retouche un layout sans toucher au code. `undefined` ⇒ défaut « au sol »
 * de `townLayout`. Chargé EAGER (petits fichiers, hors bundle image).
 */
const townLayoutModules = import.meta.glob('../../../../assets/layouts/town-*.json', {
  eager: true,
  import: 'default',
}) as Record<string, { x: number; y: number }[]>;

const townLayoutRegistry = new Map<string, { x: number; y: number }[]>();
for (const [path, anchors] of Object.entries(townLayoutModules)) {
  const m = path.match(/\/town-(.+)\.json$/);
  if (m && m[1] && Array.isArray(anchors)) townLayoutRegistry.set(m[1], anchors);
}

export function townLayoutAnchors(factionId: string): { x: number; y: number }[] | undefined {
  return townLayoutRegistry.get(factionId);
}

/** Toile de combat par terrain (`backgrounds/combat-<terrain>`, doc 08 §2.4). */
export function combatBackgroundUrl(terrain: string): string | undefined {
  return registry.get(`backgrounds/combat-${terrain}`);
}

/**
 * S4 — toile de fond d'un SIÈGE de ville (doc 08 §2.4) : silhouette urbaine
 * derrière les murailles au lieu de la prairie du terrain. Chaîne de repli :
 * `backgrounds/siege-<factionId>` (ambiance de la faction assiégée) →
 * `backgrounds/siege` (générique) → `undefined` (l'appelant retombe sur le fond
 * de terrain). Id de faction opaque ; aucun asset ⇒ repli gracieux au terrain.
 */
export function siegeBackgroundUrl(factionId?: string): string | undefined {
  return (
    (factionId ? registry.get(`backgrounds/siege-${factionId}`) : undefined) ??
    registry.get('backgrounds/siege')
  );
}

/** Fond de fin de partie victoire/défaite (doc 08 §2.5). */
export function outcomeBackgroundUrl(status: 'won' | 'lost'): string | undefined {
  return registry.get(status === 'won' ? 'backgrounds/victory' : 'backgrounds/defeat');
}

/** Fond peint du menu principal (`backgrounds/title`, doc 08 §2.5). */
export function titleBackgroundUrl(): string | undefined {
  return registry.get('backgrounds/title');
}

/** Chrome décoratif d'UI (doc 12 Règle G) — cadre 9-slice `border-image`. */
export function chromeFrameUrl(): string | undefined {
  return registry.get('ui/chrome/panel-frame');
}

/** Chrome décoratif d'UI (doc 12 Règle G) — ruban d'en-tête 3-slice horizontal. */
export function chromeRibbonUrl(): string | undefined {
  return registry.get('ui/chrome/ribbon');
}

/** Logo du jeu (`logo/heroes-master`, doc 08 §2.5). */
export function logoUrl(): string | undefined {
  return registry.get('logo/heroes-master');
}

/**
 * Sprite d'unité de combat (`units/<factionId>/<unitId>`, doc 08 §5, lot U5-C).
 * Repli **unité améliorée → art de base** : une variante `<base>-elite` sans
 * sprite propre réutilise le sprite peint de son unité de base (`<base>`) plutôt
 * que le repli procédural — les armées améliorées restent peintes tant qu'un art
 * d'élite dédié n'est pas produit (doc 12 §10).
 *
 * Repli **core** : les pièces faction-agnostiques (machines de guerre — pas de
 * `groupId`, doc 02 §5) sont rangées sous `units/core/<unitId>` et résolues même
 * sans faction. Aucune faction en dur (clé opaque, guidelines §8.1).
 */
export function unitSpriteUrl(unitId: string, factionId?: string): string | undefined {
  const direct = factionId ? registry.get(`units/${factionId}/${unitId}`) : undefined;
  if (direct) return direct;
  const ELITE = '-elite';
  const elite =
    factionId && unitId.endsWith(ELITE)
      ? registry.get(`units/${factionId}/${unitId.slice(0, -ELITE.length)}`)
      : undefined;
  return elite ?? registry.get(`units/core/${unitId}`);
}

/**
 * Avatars dédiés des héros nommés (M-TAVERN.3) : réf de nom de la fiche
 * (`@loc:hero.<id>.name` — la même valeur que porte `HeroState.name` et
 * `ResolvedHeroDef.name`) → clé `avatar` de la fiche. Initialisé au démarrage
 * depuis le rapport de contenu (comme l'i18n) — vide tant que non appelé.
 */
let heroAvatarKeysByName: Record<string, string> = {};

export function initHeroAvatars(identities: readonly { name: string; avatar: string }[]): void {
  heroAvatarKeysByName = Object.fromEntries(identities.map((h) => [h.name, h.avatar]));
}

/**
 * Avatar de héros (doc 08 §5, lot U5-D) : portrait DÉDIÉ du héros nommé si sa
 * fiche en déclare un et que l'asset existe (`heroes/<avatar>`, M-TAVERN.3),
 * sinon archétype de faction (`heroes/<factionId>-<archetype>`).
 */
export function heroAvatarUrl(
  factionId: string,
  archetype: 'might' | 'magic',
  heroName?: string,
): string | undefined {
  if (heroName) {
    const key = heroAvatarKeysByName[heroName];
    const dedicated = key ? registry.get(`heroes/${key}`) : undefined;
    if (dedicated) return dedicated;
  }
  return factionId ? registry.get(`heroes/${factionId}-${archetype}`) : undefined;
}

/**
 * Blason de faction (`badges/<factionId>`, doc 12 famille « blasons ») — écu
 * héraldique peint/procédural. `undefined` ⇒ repli sur le motif SVG procédural
 * de `FactionBadge` (distinction non chromatique, a11y doc 08 §4). Clé opaque :
 * aucune faction en dur (comme `buildingUrl`/`townBackgroundUrl`).
 */
export function factionBadgeUrl(factionId: string): string | undefined {
  return factionId ? registry.get(`badges/${factionId}`) : undefined;
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

/** Tuile ISO (losange 64×32) par terrain/variante (`tiles/iso/<terrain>-<v>`, Lot A1). */
export function isoTileUrl(terrain: string, variant: number): string | undefined {
  return registry.get(`tiles/iso/${terrain}-${variant}`);
}

/** Route ISO (losange `tiles/iso/road-dirt`, Lot A1). */
export function isoRoadUrl(): string | undefined {
  return registry.get('tiles/iso/road-dirt');
}

const PROP_VARIANTS = 6;

/**
 * Variante déterministe 1..N d'un prop de relief. Hash **asymétrique en x/y**
 * (multiplicateurs distincts + avalanche) : contrairement à `x*13+y*7`, il ne se
 * reflète pas le long d'un axe → pas de motif en miroir sur les cartes symétriques.
 */
export function terrainPropVariant(x: number, y: number): number {
  let h = Math.imul((x | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((y | 0) ^ 0x7f4a7c15, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f);
  h ^= h >>> 16;
  return ((h >>> 0) % PROP_VARIANTS) + 1;
}

/**
 * Prop de RELIEF « billboard » (forêt/montagne) qui dépasse la tuile pour donner
 * de la hauteur à la carte (`tiles/props/<terrain>-<v>`, extension carte). Repli
 * procédural déterministe présent ; l'art Gemini varié se branche par simple dépôt
 * de PNG homonymes (doc 12 §7). `undefined` ⇒ pas de prop (terrain plat).
 */
export function terrainPropUrl(terrain: string, variant: number): string | undefined {
  return registry.get(`tiles/props/${terrain}-${variant}`);
}

/** Mine capturable → visuel de mine par ressource (EXCLUSIF aux mines). */
export function mineUrl(resource: string): string | undefined {
  return registry.get(`mines/mine-${resource}`);
}

/**
 * Tas de ressource RAMASSABLE (`resources/pile-<res>`) — famille distincte du
 * visuel de mine : une mine (bâtiment permanent à capturer) et un tas (objet
 * consommé au passage) ne doivent plus partager le même asset (plan
 * map-design-issues P3). `undefined` ⇒ repli procédural (losange teinté).
 */
export function resourcePileUrl(resource: string): string | undefined {
  return registry.get(`resources/pile-${resource}`);
}

export function artifactUrl(id: string): string | undefined {
  return registry.get(`artifacts/${id}`);
}

/** Jeton de héros sur la carte (`map/hero-<factionId>`, UXD-3B). */
export function heroMapUrl(factionId: string): string | undefined {
  return factionId ? registry.get(`map/hero-${factionId}`) : undefined;
}

/** Château de ville sur la carte (`map/town-<factionId>`, UXD-3B). */
export function townMapUrl(factionId: string): string | undefined {
  return factionId ? registry.get(`map/town-${factionId}`) : undefined;
}

/** Objet de carte peint (`map/<id>` : chest/camp/signpost/shrine, UXD-3B). */
export function mapPropUrl(id: string): string | undefined {
  return registry.get(`map/${id}`);
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

/** Icône d'action/onglet (UXD-2) : `ui/<id>_<mipmap>.png` (ex. `act-options`). */
export function uiIconUrl(id: string, px = 24): string | undefined {
  return registry.get(`ui/${id}_${pickIconSize(px)}`);
}

// --- Famille S : sorts, effets, murs, invocations (doc 12 Règle S, gen_spell_assets.py) ---

const SPELL_ICON_SIZES = [24, 32, 48, 64] as const;
const STATUS_ICON_SIZES = [16, 24, 32] as const;

function pickFromSizes(sizes: readonly number[], px: number): number {
  return sizes.find((s) => s >= px) ?? sizes[sizes.length - 1]!;
}

/**
 * Icône de sort du grimoire (`spells/<school>-<kind>`) — une par couple
 * (école, type). Clés opaques (aucune faction en dur). `undefined` ⇒ repli =
 * pas d'icône (liste texte seule, état d'avant l'intégration).
 */
export function spellIconUrl(school: string, kind: string, px = 40): string | undefined {
  return registry.get(`spells/${school}-${kind}_${pickFromSizes(SPELL_ICON_SIZES, px)}`);
}

/**
 * Badge d'effet posé sur un jeton de combat (`ui/status-<name>` :
 * buff/debuff/silence/poison/mark/immobilized/stealth). `undefined` ⇒ repli
 * disque coloré procédural (jamais d'image cassée).
 */
export function statusIconUrl(name: string, px = 20): string | undefined {
  return registry.get(`ui/status-${name}_${pickFromSizes(STATUS_ICON_SIZES, px)}`);
}

/**
 * Sprite du mur de siège (`combat/siege-wall`, C-SIEGE2) — rempart distinct des
 * obstacles de champ. `undefined` ⇒ repli rocher procédural (`drawBoulder`).
 */
export function siegeWallUrl(): string | undefined {
  return registry.get('combat/siege-wall');
}

/**
 * Overlay de rempart endommagé (`combat/siege-wall-cracked`, S2) posé sur un
 * segment dont les PV sont entamés (`siegeWallHp < SIEGE_WALL_HP`). `undefined`
 * ⇒ repli : assombrissement procédural du sprite de rempart (jamais d'image
 * cassée).
 */
export function siegeWallCrackedUrl(): string | undefined {
  return registry.get('combat/siege-wall-cracked');
}

// --- Chemin PixiJS : préchargement + lecture synchrone du cache ---

/** URLs rendues dans PixiJS (tuiles + mines + tas) — préchargées au bootstrap. */
function pixiUrls(): string[] {
  const urls: string[] = [];
  for (const [key, url] of registry) {
    if (key.startsWith('tiles/') || key.startsWith('mines/') || key.startsWith('resources/'))
      urls.push(url);
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
