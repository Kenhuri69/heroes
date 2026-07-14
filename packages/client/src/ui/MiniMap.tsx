import { useEffect, useRef } from 'preact/hooks';
import { useApp } from '../app/store';
import { humanId, humanHeroes, isHeroVisibleOnMap, visionSightings } from '../app/game';
import { t } from '../app/i18n';
import { playerColor } from '../render/playerColors';
import { panCameraTo } from '../app/camera-control';

/**
 * Mini-carte (doc 08 §2.1, UXD-8) — le grand absent de l'audit §1.5. Rendue en
 * DOM (`<canvas>` 1 px/tuile, mis à l'échelle CSS `pixelated`), **desktop only**
 * (colonne droite du layout cible ; sur mobile elle vivra dans le tiroir, suivi
 * noté). Montre le terrain **exploré** (brouillard = sombre), les héros et les
 * villes en pastilles colorées ; un **clic recentre la caméra** d'aventure sur
 * la tuile visée (`panCameraTo`). Coût nul par-frame : ne se redessine qu'au
 * changement d'état (abonnement store), la carte proto est ~1 k tuiles.
 *
 * `variant` : `'fixed'` = widget ancré en bas à droite (desktop only) ;
 * `'drawer'` = version statique montée dans le tiroir héros (mobile). Classe
 * distincte par variante pour que les règles `fixed`/media du widget desktop ne
 * fuient pas sur la version tiroir (l'exclusivité par viewport est en CSS).
 */

const C_UNEXPLORED = '#0b0e14';
const TERRAIN: Record<string, string> = {
  grass: '#3a5a34',
  dirt: '#8a6a44',
  sand: '#ccb680',
  forest: '#274a24',
  rough: '#8a7f58',
  snow: '#dfe6ee',
  swamp: '#4a5a2c',
  river: '#3f7aa6',
  water: '#24406a',
  mountain: '#6a5f56',
  rocks: '#7a766f',
};
const C_DEFAULT = '#3a3d47';

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

export function MiniMap({ variant = 'fixed' }: { variant?: 'fixed' | 'drawer' } = {}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useApp((s) => s.locale); // réactivité i18n (aria-label)
  // Réf `game` stable (cf. HeroStrip) puis dérivation dans l'effet — évite les
  // nouveaux tableaux à chaque sélecteur.
  const game = useApp((s) => s.game);
  const map = game.map;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !map) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = map;
    canvas.width = width;
    canvas.height = height;

    const human = humanId(game);
    const explored = game.players.find((p) => p.id === human)?.explored ?? [];
    const img = ctx.createImageData(width, height);
    for (let i = 0; i < width * height; i++) {
      const color = explored[i] ? (TERRAIN[map.terrain[i] ?? ''] ?? C_DEFAULT) : C_UNEXPLORED;
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      img.data.set([r, g, b, 255], i * 4);
    }
    ctx.putImageData(img, 0, 0);

    // Marqueurs (2×2 px) — villes puis héros au-dessus. Second canal : la
    // pastille EXISTE (présence), la couleur n'est qu'un plus (A5).
    const dot = (x: number, y: number, color: string): void => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.max(0, x - 1), Math.max(0, y - 1), 2, 2);
    };
    // B11 (revue 2026-07) : mêmes règles de visibilité que la carte principale —
    // villes en zone EXPLORÉE seulement, héros à soi ou EN VISION (helper partagé
    // `isHeroVisibleOnMap`). Sans ces filtres, la mini-carte révélait la position
    // temps réel des héros/villes ennemis sous le brouillard (grave en hot-seat).
    const sightings = visionSightings(game);
    for (const town of game.towns) {
      if (!explored[town.pos.y * width + town.pos.x]) continue;
      dot(town.pos.x, town.pos.y, hex(playerColor(game.players, town.ownerPlayerId)));
    }
    for (const hero of game.heroes) {
      if (!isHeroVisibleOnMap(hero, human, sightings)) continue;
      dot(hero.pos.x, hero.pos.y, hex(playerColor(game.players, hero.playerId)));
    }
  }, [game, map]);

  if (!map) return null;

  const onClick = (e: MouseEvent): void => {
    const canvas = ref.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const tx = Math.floor(((e.clientX - rect.left) / rect.width) * map.width);
    const ty = Math.floor(((e.clientY - rect.top) / rect.height) * map.height);
    void panCameraTo(tx, ty, 300);
  };

  // `humanHeroes` dérivé pour le titre a11y (nombre de héros) — pas de rendu.
  const heroCount = humanHeroes(game).length;

  return (
    <canvas
      ref={ref}
      class={variant === 'drawer' ? 'mini-map-drawer' : 'mini-map'}
      data-testid={variant === 'drawer' ? 'mini-map-drawer' : 'mini-map'}
      role="img"
      aria-label={t('hero.minimapAria', { count: heroCount })}
      onClick={onClick}
    />
  );
}
