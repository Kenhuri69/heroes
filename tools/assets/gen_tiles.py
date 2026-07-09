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
(adventure.terrains : grass, dirt, sand, forest, rough, snow, swamp, river,
water, mountain, rocks). Ajouter un terrain = ajouter une recette dans
TERRAIN_RECIPES.

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

S = 64          # taille de tuile carrée (= boîte de contenu client)
VARIANTS = 3

# Projection isométrique (Lot A1) : losange 2:1 dérivé de la tuile carrée par
# rotation 45° + compression verticale (= foreshortening iso). Doit matcher
# `packages/client/src/render/projection.ts` (ISO_TILE_W / ISO_TILE_H).
ISO_W = 64
ISO_H = 32
ISO_SS = 4      # suréchantillonnage pour des arêtes de losange nettes

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


def dirt(img, rng):
    _base_noise(img, rng, (112, 86, 58), 7)
    d = ImageDraw.Draw(img)
    for _ in range(9):                                    # mottes de terre sombre
        x, y = rng.randrange(S), rng.randrange(S)
        _wrap_ellipse(d, x, y, rng.randint(4, 9), rng.randint(3, 6),
                      _vary((92, 68, 44), rng))
    for _ in range(14):                                   # petits cailloux
        x, y = rng.randrange(S), rng.randrange(S)
        _wrap_ellipse(d, x, y, rng.randint(1, 2), 1, _vary((136, 116, 88), rng))
    for _ in range(6):                                    # sillons clairs
        x, y = rng.randrange(S), rng.randrange(S)
        _wrap_line(d, x, y, x + rng.randint(5, 11), y + rng.randint(-1, 1),
                   _vary((128, 100, 68), rng))


def sand(img, rng):
    _base_noise(img, rng, (204, 182, 128), 6)
    d = ImageDraw.Draw(img)
    for _ in range(10):                                   # ondulations dorées
        x, y = rng.randrange(S), rng.randrange(S)
        w = rng.randint(8, 16)
        _wrap_line(d, x, y, x + w, y + rng.randint(-2, 2),
                   _vary((188, 164, 110), rng), width=2)
    for _ in range(8):                                    # crêtes claires
        x, y = rng.randrange(S), rng.randrange(S)
        w = rng.randint(6, 12)
        _wrap_line(d, x, y, x + w, y, _vary((222, 202, 150), rng))
    for _ in range(6):                                    # grains sombres épars
        x, y = rng.randrange(S), rng.randrange(S)
        _wrap_ellipse(d, x, y, 1, 1, _vary((160, 138, 92), rng))


def forest(img, rng):
    """Sol de sous-bois : herbe sombre + houppiers ronds (les pics de canopée en
    relief sont posés en PROP overlay par le client ; la tuile reste le sol)."""
    _base_noise(img, rng, (46, 74, 42), 6)
    d = ImageDraw.Draw(img)
    for _ in range(10):                                   # houppiers sombres
        x, y = rng.randrange(S), rng.randrange(S)
        r = rng.randint(5, 10)
        _wrap_ellipse(d, x, y, r, r, _vary((36, 60, 34), rng))
        _wrap_ellipse(d, x - r // 3, y - r // 3, max(1, r // 2), max(1, r // 2),
                      _vary((58, 90, 50), rng))            # lumière au sommet
    for _ in range(16):                                   # feuillage clair
        x, y = rng.randrange(S), rng.randrange(S)
        _wrap_ellipse(d, x, y, 1, 1, _vary((78, 116, 60), rng))


def rough(img, rng):
    _base_noise(img, rng, (118, 108, 76), 7)
    d = ImageDraw.Draw(img)
    for _ in range(8):                                    # plaques érodées
        x, y = rng.randrange(S), rng.randrange(S)
        _wrap_ellipse(d, x, y, rng.randint(5, 10), rng.randint(3, 6),
                      _vary((98, 90, 62), rng))
    for _ in range(10):                                   # rochers épars
        x, y = rng.randrange(S), rng.randrange(S)
        r = rng.randint(2, 4)
        _wrap_ellipse(d, x, y, r, r, _vary((132, 124, 96), rng))
        _wrap_ellipse(d, x, y + 1, r, max(1, r // 2), _vary((84, 78, 54), rng))
    for _ in range(8):                                    # touffes sèches
        x, y = rng.randrange(S), rng.randrange(S)
        _wrap_line(d, x, y, x + rng.randint(-1, 1), y - rng.randint(2, 4),
                   _vary((150, 140, 92), rng))


def snow(img, rng):
    _base_noise(img, rng, (224, 230, 238), 4)
    d = ImageDraw.Draw(img)
    for _ in range(8):                                    # creux bleutés (ombre)
        x, y = rng.randrange(S), rng.randrange(S)
        _wrap_ellipse(d, x, y, rng.randint(5, 11), rng.randint(3, 6),
                      _vary((200, 212, 228), rng))
    for _ in range(10):                                   # congères claires
        x, y = rng.randrange(S), rng.randrange(S)
        w = rng.randint(6, 12)
        _wrap_line(d, x, y, x + w, y + rng.randint(-1, 1),
                   _vary((240, 244, 250), rng), width=2)
    for _ in range(5):                                    # cristaux scintillants
        x, y = rng.randrange(S), rng.randrange(S)
        _wrap_ellipse(d, x, y, 1, 1, (250, 252, 255))


def river(img, rng):
    """Eau vive peu profonde (franchissable) : plus claire que la mer, courant
    marqué (le sens du cours n'est pas modélisé — texture générique)."""
    _base_noise(img, rng, (58, 108, 148), 5)
    d = ImageDraw.Draw(img)
    for _ in range(6):                                    # fonds plus sombres
        x, y = rng.randrange(S), rng.randrange(S)
        _wrap_ellipse(d, x, y, rng.randint(6, 12), rng.randint(3, 5),
                      _vary((44, 88, 124), rng))
    for _ in range(16):                                   # lignes de courant
        x, y = rng.randrange(S), rng.randrange(S)
        w = rng.randint(6, 14)
        _wrap_line(d, x, y, x + w, y, _vary((110, 158, 192), rng))
    for _ in range(6):                                    # écume claire
        x, y = rng.randrange(S), rng.randrange(S)
        _wrap_ellipse(d, x, y, 1, 0, (186, 214, 232))


def rocks(img, rng):
    """Éboulis infranchissable posé sur terrain plat : blocs gris plus froids que
    la montagne (les pics en relief restent réservés à la montagne)."""
    _base_noise(img, rng, (118, 114, 108), 6)
    d = ImageDraw.Draw(img)
    for _ in range(10):                                   # blocs empilés
        x, y = rng.randrange(S), rng.randrange(S)
        rx, ry = rng.randint(4, 8), rng.randint(3, 6)
        _wrap_ellipse(d, x, y, rx, ry, _vary((100, 98, 94), rng))
        _wrap_ellipse(d, x - rx // 3, y - ry // 3, max(1, rx // 2),
                      max(1, ry // 2), _vary((140, 138, 132), rng))
    for _ in range(8):                                    # ombres entre blocs
        x, y = rng.randrange(S), rng.randrange(S)
        _wrap_line(d, x, y, x + rng.randint(-6, 6), y + rng.randint(2, 6),
                   _vary((66, 64, 60), rng))


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
    "dirt": dirt,
    "sand": sand,
    "forest": forest,
    "rough": rough,
    "snow": snow,
    "swamp": swamp,
    "river": river,
    "water": water,
    "mountain": mountain,
    "rocks": rocks,
}


# ── props de RELIEF (forêt / montagne) ───────────────────────────────────────
# Sprites « billboard » TRANSPARENTS qui DÉPASSENT la tuile (donnent de la hauteur
# à la carte, doc 12). Repli procédural : l'art Gemini varié se branche par simple
# dépôt de PNG homonymes sous assets/tiles/props/ (voir docs/12 §7). Le client les
# pose debout, base au sol, au-dessus du losange texturé (`tilemap.ts`).

PROP_W, PROP_H = 64, 96      # boîte du billboard procédural (transparente)
PROP_VARIANTS = 5
PROP_GROUND = PROP_H - 6     # ligne de sol (base des troncs / de la montagne)


def _tree(d: ImageDraw.ImageDraw, cx: int, base: int, h: int, rng) -> None:
    """Un conifère : tronc + 3 étages de feuillage, ombre à droite, lumière à gauche."""
    trunk = _vary((92, 66, 42), rng)
    d.rectangle([cx - 2, base - h // 4, cx + 2, base], fill=trunk)
    top = base - h
    dark = _vary((34, 74, 40), rng)
    lit = _vary((70, 116, 60), rng)
    for i in range(3):                                    # étages du plus large (bas)
        ty = top + int(h * 0.30 * i)
        half = int((h * 0.42) * (1 - i * 0.22))
        low = ty + int(h * 0.34)
        d.polygon([(cx, ty), (cx - half, low), (cx + half, low)], fill=dark)
        d.polygon([(cx, ty), (cx - half, low), (cx, low)], fill=lit)  # face éclairée


def forest_prop(img, rng) -> None:
    d = ImageDraw.Draw(img)
    # 2–3 arbres décalés en profondeur (le plus grand au centre-avant).
    spots = [(PROP_W // 2, PROP_GROUND, rng.randint(58, 74))]
    if rng.random() < 0.9:
        spots.append((PROP_W // 2 - rng.randint(14, 20), PROP_GROUND - rng.randint(2, 8),
                      rng.randint(40, 54)))
    if rng.random() < 0.7:
        spots.append((PROP_W // 2 + rng.randint(14, 20), PROP_GROUND - rng.randint(2, 8),
                      rng.randint(40, 54)))
    for cx, base, h in sorted(spots, key=lambda s: s[1]):  # arrière → avant
        _tree(d, cx, base, h, rng)


def mountain_prop(img, rng) -> None:
    d = ImageDraw.Draw(img)
    cx = PROP_W // 2
    base = PROP_GROUND
    h = rng.randint(66, 84)
    peak = base - h
    half = rng.randint(24, 30)
    apex_dx = rng.randint(-6, 6)                           # sommet légèrement décalé
    rock = _vary((110, 106, 100), rng)
    shade = _vary((72, 70, 66), rng)
    light = _vary((150, 148, 142), rng)
    # Masse : face gauche éclairée, face droite dans l'ombre.
    d.polygon([(cx + apex_dx, peak), (cx - half, base), (cx + half, base)], fill=rock)
    d.polygon([(cx + apex_dx, peak), (cx - half, base), (cx - 2, base)], fill=light)
    d.polygon([(cx + apex_dx, peak), (cx + 2, base), (cx + half, base)], fill=shade)
    # Calotte neigeuse + une arête.
    snow_y = peak + int(h * 0.28)
    d.polygon([(cx + apex_dx, peak), (cx + apex_dx - 10, snow_y), (cx + apex_dx + 10, snow_y)],
              fill=(238, 242, 248))
    d.line([(cx + apex_dx, peak), (cx - half // 3, base)], fill=shade, width=2)


PROP_RECIPES = {
    "forest": forest_prop,
    "mountain": mountain_prop,
}


def render(name: str, recipe, variant: int) -> Image.Image:
    rng = random.Random(f"heroes-tile-{name}-{variant}")
    img = Image.new("RGB", (S, S))
    recipe(img, rng)
    return img


def render_prop(name: str, recipe, variant: int) -> Image.Image:
    rng = random.Random(f"heroes-prop-{name}-{variant}")
    img = Image.new("RGBA", (PROP_W, PROP_H), (0, 0, 0, 0))
    recipe(img, rng)
    return img


def to_iso(img: Image.Image) -> Image.Image:
    """Losange iso 2:1 (64×32, coins transparents) dérivé d'une tuile carrée.

    Rotation 45° (⇒ la tuile devient un losange) puis compression verticale ×0,5
    (⇒ foreshortening iso). Suréchantillonnage ×4 pour des arêtes propres. Pur
    transform déterministe (PIL) — re-run = octets identiques."""
    big = img.convert("RGBA").resize((S * ISO_SS, S * ISO_SS), Image.NEAREST)
    dia = big.rotate(45, expand=True, resample=Image.BICUBIC, fillcolor=(0, 0, 0, 0))
    return dia.resize((ISO_W, ISO_H), Image.BICUBIC)


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

    # ── tuiles ISO (Lot A1 : rendu isométrique de la carte) ──────────────────
    # Losanges 64×32 dérivés des tuiles carrées, sous assets/tiles/iso/. Le
    # client (`tilemap.ts`) les pose au centre du losange (`isoTileCenter`) sur
    # le repli gouache. Déterministe (transform PIL pur).
    iso_out = OUT / "iso"
    iso_out.mkdir(parents=True, exist_ok=True)
    iso_tiles: list[tuple[str, Image.Image]] = []
    for name, img in tiles:
        iso = to_iso(img)
        iso.save(iso_out / f"{name}.png", optimize=True)
        iso_tiles.append((name, iso))
        print(f"  {(iso_out / f'{name}.png').relative_to(REPO)}")

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

    # planche de contrôle ISO : chaque terrain posé en petit losange 4×4 pour
    # vérifier la tessellation (aucun trou entre losanges adjacents).
    iso_prev = Image.new("RGBA", (len(iso_tiles) * (ISO_W + 8) + 8, ISO_H * 5 + 24), (24, 24, 28, 255))
    di = ImageDraw.Draw(iso_prev)
    for i, (name, iso) in enumerate(iso_tiles):
        ox = i * (ISO_W + 8) + 8
        oy = 12
        for gy in range(4):
            for gx in range(4):
                cx = ox + (gx - gy) * (ISO_W // 2)
                cy = oy + (gx + gy) * (ISO_H // 2)
                iso_prev.alpha_composite(iso, (cx, cy))
        di.text((ox, ISO_H * 5 + 8), name, fill=(200, 200, 200, 255))
    iso_prev.save(iso_out / "_preview.png")
    print(f"iso    → {(iso_out / '_preview.png').relative_to(REPO)} "
          f"({len(iso_tiles)} losanges, grille 4×4 = contrôle de tessellation)")

    # ── props de relief (forêt / montagne) : billboards transparents ─────────
    prop_out = OUT / "props"
    prop_out.mkdir(parents=True, exist_ok=True)
    # Art DÉPOSÉ (Gemini) prioritaire : un PNG homonyme déjà présent est CONSERVÉ
    # (jamais écrasé par le repli procédural), et repris tel quel pour la planche.
    # Sinon on génère le billboard procédural. Re-run = fichiers identiques.
    props: list[tuple[str, Image.Image]] = []
    for name, recipe in PROP_RECIPES.items():
        for v in range(1, PROP_VARIANTS + 1):
            path = prop_out / f"{name}-{v}.png"
            if path.exists():
                img = Image.open(path).convert("RGBA")
                print(f"  {path.relative_to(REPO)} (art déposé, conservé)")
            else:
                img = render_prop(name, recipe, v)
                img.save(path, optimize=True)
                print(f"  {path.relative_to(REPO)}")
            props.append((f"{name}-{v}", img))
    # planche de contrôle : props sur damier gris (contrôle de la découpe alpha).
    prop_prev = Image.new("RGBA", (len(props) * (PROP_W + 8) + 8, PROP_H + 24), (40, 44, 40, 255))
    dp = ImageDraw.Draw(prop_prev)
    for i, (name, img) in enumerate(props):
        ox = i * (PROP_W + 8) + 8
        prop_prev.alpha_composite(img, (ox, 4))
        dp.text((ox, PROP_H + 8), name, fill=(210, 210, 210, 255))
    prop_prev.save(prop_out / "_preview.png")
    print(f"props  → {(prop_out / '_preview.png').relative_to(REPO)} "
          f"({len(props)} billboards de relief forêt/montagne)")


if __name__ == "__main__":
    main()
