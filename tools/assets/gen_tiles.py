#!/usr/bin/env python3
"""
gen_tiles.py — Tuiles de terrain procédurales pour la carte d'aventure.

Règle P de docs/12-assets-style-guide.md :
  - 64×64 px (TILE_SIZE du client), opaques, TILEABLES (tout motif est
    dessiné avec wrap ±64 px pour qu'aucune couture n'apparaisse) ;
  - déterministes : random.Random(seed dérivé de l'id) — re-run = octets
    identiques ;
  - 3 variantes par terrain pour casser la répétition, + 1 texture de route.

Les terrains couverts sont ceux de data/core/config.json
(adventure.terrains : grass, swamp, water, mountain). Ajouter un terrain =
ajouter une recette dans TERRAIN_RECIPES.

Sortie : assets/tiles/<terrain>-<n>.png, road-dirt.png, _preview.png.
Aucune intégration client dans ce lot (voir docs/12 §10).

Usage : python3 tools/assets/gen_tiles.py
"""

from __future__ import annotations

import json
import random
from pathlib import Path

from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parent.parent.parent
OUT = REPO / "assets" / "tiles"
CONFIG = REPO / "data" / "core" / "config.json"

S = 64          # taille de tuile (= TILE_SIZE client)
VARIANTS = 3

# Offsets de wrap : dessiner chaque motif 9 fois garantit la tileabilité.
WRAP = [(dx, dy) for dx in (-S, 0, S) for dy in (-S, 0, S)]


def _clamp(v: float) -> int:
    return max(0, min(255, int(v)))


def _vary(c, rng, amp=6):
    return tuple(_clamp(c[i] + rng.randint(-amp, amp)) for i in range(3))


def _blend(c1, c2, t):
    return tuple(_clamp(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def _base_noise(img, rng, base, amp):
    """Fond bruité par pixel (tileable par construction : pas de structure)."""
    px = img.load()
    for y in range(S):
        for x in range(S):
            px[x, y] = _vary(base, rng, amp)


def _wrap_ellipse(d: ImageDraw.ImageDraw, x, y, rx, ry, color):
    for dx, dy in WRAP:
        d.ellipse([x + dx - rx, y + dy - ry, x + dx + rx, y + dy + ry], fill=color)


def _wrap_line(d: ImageDraw.ImageDraw, x0, y0, x1, y1, color, width=1):
    for dx, dy in WRAP:
        d.line([x0 + dx, y0 + dy, x1 + dx, y1 + dy], fill=color, width=width)


# ── recettes de terrain ────────────────────────────────────────────────────

def grass(img, rng):
    _base_noise(img, rng, (74, 110, 58), 7)
    d = ImageDraw.Draw(img)
    for _ in range(10):                                   # plaques d'herbe sombre
        x, y = rng.randrange(S), rng.randrange(S)
        _wrap_ellipse(d, x, y, rng.randint(4, 9), rng.randint(3, 6),
                      _vary((60, 94, 48), rng))
    for _ in range(26):                                   # brins clairs
        x, y = rng.randrange(S), rng.randrange(S)
        _wrap_line(d, x, y, x + rng.randint(-1, 1), y - rng.randint(2, 4),
                   _vary((104, 142, 74), rng))
    for _ in range(4):                                    # fleurettes rares
        x, y = rng.randrange(S), rng.randrange(S)
        _wrap_ellipse(d, x, y, 1, 1, (196, 188, 120))


def swamp(img, rng):
    _base_noise(img, rng, (70, 82, 52), 6)
    d = ImageDraw.Draw(img)
    for _ in range(7):                                    # vase sombre
        x, y = rng.randrange(S), rng.randrange(S)
        _wrap_ellipse(d, x, y, rng.randint(5, 11), rng.randint(3, 6),
                      _vary((52, 62, 42), rng))
    for _ in range(4):                                    # mares stagnantes
        x, y = rng.randrange(S), rng.randrange(S)
        rx, ry = rng.randint(5, 9), rng.randint(3, 5)
        _wrap_ellipse(d, x, y, rx, ry, _vary((44, 60, 58), rng))
        _wrap_ellipse(d, x - rx // 3, y - ry // 3, max(1, rx // 3),
                      max(1, ry // 3), (74, 96, 90))      # reflet
    for _ in range(12):                                   # roseaux
        x, y = rng.randrange(S), rng.randrange(S)
        _wrap_line(d, x, y, x + rng.randint(-1, 1), y - rng.randint(3, 6),
                   _vary((92, 100, 56), rng))


def water(img, rng):
    _base_noise(img, rng, (38, 72, 110), 5)
    d = ImageDraw.Draw(img)
    for _ in range(8):                                    # fonds plus sombres
        x, y = rng.randrange(S), rng.randrange(S)
        _wrap_ellipse(d, x, y, rng.randint(6, 12), rng.randint(3, 5),
                      _vary((30, 60, 96), rng))
    for _ in range(14):                                   # crêtes de vagues
        x, y = rng.randrange(S), rng.randrange(S)
        w = rng.randint(4, 10)
        _wrap_line(d, x, y, x + w, y, _vary((84, 126, 164), rng))
        _wrap_line(d, x + 1, y + 1, x + w - 1, y + 1, _vary((52, 90, 132), rng))
    for _ in range(5):                                    # étincelles
        x, y = rng.randrange(S), rng.randrange(S)
        _wrap_ellipse(d, x, y, 1, 0, (150, 186, 214))


def mountain(img, rng):
    _base_noise(img, rng, (88, 84, 78), 6)
    d = ImageDraw.Draw(img)
    for _ in range(8):                                    # blocs rocheux
        x, y = rng.randrange(S), rng.randrange(S)
        rx, ry = rng.randint(4, 9), rng.randint(3, 7)
        _wrap_ellipse(d, x, y, rx, ry, _vary((100, 96, 88), rng))
        _wrap_ellipse(d, x - rx // 3, y - ry // 3, max(1, rx // 2),
                      max(1, ry // 2), _vary((116, 112, 102), rng))
    for _ in range(9):                                    # fissures
        x, y = rng.randrange(S), rng.randrange(S)
        x2, y2 = x + rng.randint(-8, 8), y + rng.randint(2, 8)
        _wrap_line(d, x, y, x2, y2, _vary((54, 50, 46), rng))
        _wrap_line(d, x2, y2, x2 + rng.randint(-5, 5), y2 + rng.randint(2, 6),
                   _vary((60, 56, 50), rng))
    for _ in range(5):                                    # éclats clairs
        x, y = rng.randrange(S), rng.randrange(S)
        _wrap_ellipse(d, x, y, 1, 1, (140, 136, 126))


def road_dirt(img, rng):
    """Texture de terre battue (pleine tuile ; le client la masquera selon le
    tracé de la route au lot intégration)."""
    _base_noise(img, rng, (122, 96, 62), 7)
    d = ImageDraw.Draw(img)
    for _ in range(8):                                    # ornières sombres
        x, y = rng.randrange(S), rng.randrange(S)
        w = rng.randint(6, 14)
        _wrap_line(d, x, y, x + w, y + rng.randint(-1, 1),
                   _vary((98, 76, 48), rng), width=2)
    for _ in range(10):                                   # cailloux
        x, y = rng.randrange(S), rng.randrange(S)
        _wrap_ellipse(d, x, y, rng.randint(1, 2), 1, _vary((142, 122, 94), rng))


TERRAIN_RECIPES = {
    "grass": grass,
    "swamp": swamp,
    "water": water,
    "mountain": mountain,
}


def render(name: str, recipe, variant: int) -> Image.Image:
    rng = random.Random(f"heroes-tile-{name}-{variant}")
    img = Image.new("RGB", (S, S))
    recipe(img, rng)
    return img


def main() -> None:
    terrains = list(json.loads(CONFIG.read_text())["adventure"]["terrains"])
    missing = [t for t in terrains if t not in TERRAIN_RECIPES]
    if missing:
        raise SystemExit(f"terrain(s) sans recette : {missing} — ajouter dans TERRAIN_RECIPES")

    OUT.mkdir(parents=True, exist_ok=True)
    tiles: list[tuple[str, Image.Image]] = []
    for t in terrains:
        for v in range(1, VARIANTS + 1):
            img = render(t, TERRAIN_RECIPES[t], v)
            path = OUT / f"{t}-{v}.png"
            img.save(path, optimize=True)
            tiles.append((f"{t}-{v}", img))
            print(f"  {path.relative_to(REPO)}")
    road = render("road-dirt", road_dirt, 1)
    road.save(OUT / "road-dirt.png", optimize=True)
    tiles.append(("road-dirt", road))
    print(f"  {(OUT / 'road-dirt.png').relative_to(REPO)}")

    # planche de contrôle (tuiles ×2 + damier 2×2 pour vérifier la tileabilité)
    cols, cell, pad = VARIANTS + 1, S * 2 + 12, 20
    rows = (len(tiles) + cols - 1) // cols
    prev = Image.new("RGB", (cols * cell + pad, rows * (cell + 14) + pad), (24, 24, 28))
    d = ImageDraw.Draw(prev)
    for i, (name, img) in enumerate(tiles):
        x = (i % cols) * cell + pad // 2
        y = (i // cols) * (cell + 14) + pad // 2
        quad = Image.new("RGB", (S * 2, S * 2))
        for qx in (0, S):
            for qy in (0, S):
                quad.paste(img, (qx, qy))
        prev.paste(quad, (x, y))
        d.text((x, y + S * 2 + 2), name, fill=(200, 200, 200))
    prev.save(OUT / "_preview.png", optimize=True)
    print(f"\npreview → {(OUT / '_preview.png').relative_to(REPO)} "
          f"({len(tiles)} tuiles, damier 2×2 = contrôle de tileabilité)")


if __name__ == "__main__":
    main()
