#!/usr/bin/env python3
"""Rochers d'obstacles de combat (backlog `siege-visual-overhaul` item 4a).

Les hexes-obstacles (doc 02 §5.1) étaient signalés par un rocher VECTORIEL plat
(`drawBoulder`, `render/hexgrid.ts`) — troisième langage graphique sur la scène
peinte. Ce générateur produit des **sprites de rocher peints procéduralement**
(`combat/obstacle-rock-<n>.png`), dans l'esprit painterly des tuiles
(`gen_tiles.py`) : silhouette anguleuse, dégradé de pierre, facettes éclairées/
ombrées, moucheture de granite, ombre de contact bakée au sol.

**Déterministe** (RNG seedé par variante, aucun `Math.random`) ⇒ reproductible.
Clés stables ⇒ un art Gemini supérieur se substitue par simple dépôt. Côté
client, repli gracieux sur `drawBoulder` si l'asset manque.

Usage : python3 tools/assets/gen_combat_obstacles.py [--variants 3]
"""

from __future__ import annotations

import argparse
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parents[2] / "assets" / "combat"
SEED = 0x0B57  # graine de base (obstacle)
SS = 4  # super-échantillonnage

# Palette pierre (cohérente avec ROCK_* de hexgrid.ts, en teintes peintes).
BODY = (124, 114, 102)
LIGHT = (176, 166, 148)
DARK = (66, 60, 52)
RIM = (44, 40, 34)


def _blob(rng: random.Random, cx: float, cy: float, rad: float, bumps: int) -> list[tuple[float, float]]:
    """Silhouette de pierre : cercle bruité (rayon modulé par variante)."""
    pts: list[tuple[float, float]] = []
    n = bumps
    offs = [rng.uniform(0.72, 1.06) for _ in range(n)]
    for i in range(n):
        a = 2 * math.pi * i / n
        # aplati vers le bas (posé au sol) : y-scale réduit sous l'équateur
        rr = rad * offs[i]
        x = cx + math.cos(a) * rr
        y = cy - math.sin(a) * rr * (0.86 if math.sin(a) > 0 else 0.62)
        pts.append((x, y))
    return pts


def _lerp(a: tuple, b: tuple, t: float) -> tuple:
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def build_rock(variant: int, size: int = 200) -> Image.Image:
    rng = random.Random(SEED + variant * 101)
    W = size * SS
    cx, cy = W * 0.5, W * 0.54
    rad = W * 0.36

    # 1) Ombre de contact au sol (galette floue sombre) — bakée sous le rocher.
    out = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    sh = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse(
        [cx - rad * 1.05, cy + rad * 0.42, cx + rad * 1.05, cy + rad * 0.86],
        fill=(0, 0, 0, 110),
    )
    out.alpha_composite(sh.filter(ImageFilter.GaussianBlur(W * 0.022)))

    # 2) MASQUE de silhouette (blob anguleux) : tout le rendu est clippé dedans.
    body = _blob(rng, cx, cy, rad, rng.choice([8, 9, 10]))
    mask = Image.new("L", (W, W), 0)
    ImageDraw.Draw(mask).polygon(body, fill=255)

    # 3) Corps ombré : dégradé vertical (haut éclairé → bas sombre) + éclairage
    #    directionnel doux (foyer haut-gauche) — modelé « pierre peinte ».
    ys = np.linspace(0.0, 1.0, W, dtype=np.float32)[:, None]
    grad = np.empty((W, W, 3), np.float32)
    top = np.array(_lerp(BODY, LIGHT, 0.55), np.float32)
    bot = np.array(_lerp(BODY, DARK, 0.55), np.float32)
    grad[:] = top[None, None, :] * (1 - ys[..., None]) + bot[None, None, :] * ys[..., None]
    yy, xx = np.mgrid[0:W, 0:W].astype(np.float32)
    dl = np.sqrt(((xx - (cx - rad * 0.35)) ** 2 + (yy - (cy - rad * 0.4)) ** 2))
    lit = np.clip(1.0 - dl / (rad * 1.9), 0, 1)[..., None]
    grad = np.clip(grad * (0.82 + 0.32 * lit), 0, 255)

    stone = Image.fromarray(grad.astype(np.uint8), "RGB").convert("RGBA")
    # Moucheture de granite ±8 %.
    arr = np.asarray(stone).astype(np.float32)
    noise = np.asarray(Image.effect_noise((W, W), 20), np.float32)[..., None]
    arr[..., :3] = np.clip(arr[..., :3] * (1.0 + (noise - 128.0) / 128.0 * 0.08), 0, 255)
    stone = Image.fromarray(arr.astype(np.uint8), "RGBA")
    stone.putalpha(mask)

    # 4) Contour sombre lisible sur n'importe quel terrain.
    body_img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(body_img).polygon(body, outline=RIM + (235,), width=int(W * 0.014))

    out.alpha_composite(stone)
    out.alpha_composite(body_img)
    return out.resize((size, size), Image.LANCZOS)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--variants", type=int, default=3)
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    for v in range(1, args.variants + 1):
        rock = build_rock(v)
        dst = OUT / f"obstacle-rock-{v}.png"
        rock.save(dst)
        print(f"{dst.name} {rock.size}")


if __name__ == "__main__":
    main()
