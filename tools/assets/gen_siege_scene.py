#!/usr/bin/env python3
"""
gen_siege_scene.py — Scène de siège PEINTE composée depuis la matière peinte
existante (refonte visuelle du siège, plan `.claude/plans/siege-visual-overhaul.md`).

Principe (racine R1 de l'audit) : la SCÈNE possède l'image, la grille s'y pose.
Le script compose hors-ligne, à partir des assets peints du staging (tuiles
gouache, `combat-water.jpg`, `siege-curtain/gate/tower.png`, `town-<id>.jpg`) :

1. `assets/combat/siege-scene[-<factionId>].jpg` — le SOL complet du champ de
   bataille en un seul tableau cohérent : prairie piétinée, boue d'approche,
   douve creusée (colonne moteur 10), cour intérieure, ville de la faction
   assiégée estompée à droite. AUCUN mur dedans (le rempart est dynamique).
2. `assets/combat/siege-piece-wall[-cracked|-razed].png` — la pièce de rempart
   d'UNE rangée (période verticale = pas de rangée ⇒ empilement sans couture),
   en 3 états mappés sur `siegeWallHp`. Composée depuis `siege-curtain.png`.
3. `assets/layouts/siege-scene.json` — géométrie de calage consommée par le
   client (origine de la scène, ancres des pièces/porte/tours, en "board px").

Géométrie board-space = celle du client (`render/hexgrid.ts`) : HEX_SIZE=36,
ISO_SQUASH=0.68, offset odd-r ⇒ x=62.354·(col+0.5·(row%2)), y=36.72·row.
Constantes moteur (`engine/combat/setup.ts`) : mur col 11, douve col 10,
porte rangées 4–5, plateau 15×10. Déterministe : random.Random(SEED) — re-run
⇒ octets identiques. Rendu interne à 2× puis JPEG/PNG.

Usage : python3 tools/assets/gen_siege_scene.py
"""

from __future__ import annotations

import json
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "assets"
OUT_COMBAT = ASSETS / "combat"
OUT_LAYOUT = ASSETS / "layouts"

SEED = 42

# --- Géométrie board-space (miroir de render/hexgrid.ts + engine/combat) ---
HEX = 36.0
SQUASH = 0.68
HEX_W = HEX * math.sqrt(3.0)  # 62.3538
Y_STEP = HEX * 1.5 * SQUASH  # 36.72
COLS, ROWS = 15, 10
WALL_COL, MOAT_COL = 11, 10
GATE_ROWS = (4, 5)

S = 2  # résolution de rendu (px / board px)


def cx(col: float, row: float) -> float:
    """Centre x board-space (odd-r) ; row fractionnaire ⇒ offset moyen 0.25."""
    if row == int(row):
        off = 0.5 if int(row) % 2 else 0.0
    else:
        off = 0.25
    return HEX_W * (col + off)


def cy(row: float) -> float:
    return Y_STEP * row


WALL_X = cx(WALL_COL, 0.5)  # x lissé de la colonne de murs (701.5)
MOAT_X = cx(MOAT_COL, 0.5)  # x lissé de la douve (639.1)
GATE_Y = (cy(GATE_ROWS[0]) + cy(GATE_ROWS[1])) / 2  # 165.2

# Rect de la scène (board-space) : plateau + marges de décor.
SCENE_X0, SCENE_X1 = -186.0, 1180.0
SCENE_Y0, SCENE_Y1 = -202.0, 486.0
SCENE_W, SCENE_H = SCENE_X1 - SCENE_X0, SCENE_Y1 - SCENE_Y0  # 1366 × 688

# Bandes de composition (board-space).
COURT_X0 = WALL_X + 16  # cour intérieure à l'est du mur
CITY_X0 = 962.0  # la ville commence après la colonne défenseur (col 14 ≈ 935)
MOAT_HALF = 27.0  # demi-largeur du chenal de douve
MUD_X0, MUD_X1 = 500.0, WALL_X - 26  # bande d'approche piétinée

# Pièces de rempart : voir le KIT DE FORTIFICATION PROCÉDURAL plus bas
# (WALL_H, GATE_WALL_H, TOWER_H_BP… — un seul langage pour tout le vertical).


def img_px(v: float) -> int:
    return int(round(v * S))


def to_img(x: float, y: float) -> tuple[int, int]:
    return img_px(x - SCENE_X0), img_px(y - SCENE_Y0)


# --- Bruit lisse déterministe (grands aplats de lumière peints) ---


def smooth_noise(rng: random.Random, w: int, h: int, cells: int, blur: float) -> np.ndarray:
    grid = np.array([[rng.random() for _ in range(cells)] for _ in range(cells)], dtype=np.float32)
    im = Image.fromarray((grid * 255).astype(np.uint8), "L").resize((w, h), Image.BICUBIC)
    im = im.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(im, dtype=np.float32) / 255.0


# --- Sol : toiles de combat PEINTES réutilisées (cohérence garantie) ---


def cover_resize(im: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Redimensionne en « cover » (remplit `size`, recadre le débord, centré)."""
    w, h = size
    scale = max(w / im.width, h / im.height)
    r = im.resize((int(im.width * scale + 0.5), int(im.height * scale + 0.5)), Image.LANCZOS)
    x0 = (r.width - w) // 2
    y0 = (r.height - h) // 2
    return r.crop((x0, y0, x0 + w, y0 + h))


def luminance_paint(rng: random.Random, im: Image.Image, lo: float, hi: float) -> Image.Image:
    """Nappe de lumière lisse multiplicative (nuages/usure) — casse la répétition."""
    n = smooth_noise(rng, im.width, im.height, 14, blur=40 * S)
    arr = np.asarray(im, dtype=np.float32)
    mult = (lo + (hi - lo) * n)[..., None]
    return Image.fromarray(np.clip(arr * mult, 0, 255).astype(np.uint8), "RGB")


def blend_mask(base: Image.Image, top: Image.Image, mask: np.ndarray) -> Image.Image:
    m = Image.fromarray(np.clip(mask * 255, 0, 255).astype(np.uint8), "L")
    out = base.copy()
    out.paste(top, (0, 0), m)
    return out


def band_mask(w: int, h: int, x0: float, x1: float, feather: float) -> np.ndarray:
    """Masque vertical [x0,x1] board-space, bords adoucis."""
    xs = np.arange(w, dtype=np.float32) / S + SCENE_X0
    m = np.clip((xs - x0) / feather, 0, 1) * np.clip((x1 - xs) / feather, 0, 1)
    return np.tile(m, (h, 1))


def build_ground(rng: random.Random) -> Image.Image:
    size = (img_px(SCENE_W), img_px(SCENE_H))
    w, h = size

    # 1. Prairie : la toile de combat PEINTE existante (même gouache que les
    #    combats de plaine ⇒ cohérence garantie), en « cover » sur la scène.
    grass = cover_resize(Image.open(ASSETS / "backgrounds" / "combat-grass.jpg").convert("RGB"), size)
    grass = luminance_paint(rng, grass, 0.88, 1.06)

    # 2. Cour intérieure : la toile de terre battue peinte (partie basse — le
    #    haut de la toile porte un muret en ruine qui jurerait), refroidie/
    #    assombrie, de l'est du mur jusqu'à la ville. Raccord SOUS le rempart.
    dirt_src = Image.open(ASSETS / "backgrounds" / "combat-dirt.jpg").convert("RGB")
    dirt_src = dirt_src.crop((0, int(dirt_src.height * 0.28), dirt_src.width, dirt_src.height))
    court = cover_resize(dirt_src, size)
    court = ImageEnhance.Brightness(ImageEnhance.Color(court).enhance(0.7)).enhance(0.82)
    # Frontière herbe→cour entièrement SOUS la face du rempart (44 bp centrés
    # sur WALL_X) : aucun liseré d'herbe visible au pied du mur.
    court_m = band_mask(w, h, WALL_X - 14, SCENE_X1 + 50, feather=12.0)
    ground = blend_mask(grass, court, court_m * 0.96)

    # Esplanade PAVÉE bakée sur toute la bande de ville (du mur jusqu'à la
    # cité) : le sol côté ville est continu — les tuiles hex par case posées
    # par le client s'y fondent au lieu de flotter sur la terre nue.
    cobbles = paint_cobbles(rng, w, h)
    esplanade_m = band_mask(w, h, WALL_X + 6, SCENE_X1 + 50, feather=14.0)
    ground = blend_mask(ground, cobbles, esplanade_m * 0.8)

    # 3. Boue d'approche : lavis brun translucide (le grain peint de la prairie
    #    transparaît = herbe piétinée), renforcé de flaques organiques + chemin
    #    de terre incurvé vers la porte.
    noise = smooth_noise(rng, w, h, 18, blur=18 * S)
    approach = band_mask(w, h, MUD_X0, MUD_X1, feather=80.0) * (0.30 + 0.70 * noise)
    ys = (np.arange(h, dtype=np.float32) / S + SCENE_Y0)[:, None]
    xs = (np.arange(w, dtype=np.float32) / S + SCENE_X0)[None, :]
    road_y = GATE_Y + 14.0 + 26.0 * np.sin((xs - SCENE_X0) / 260.0 + 0.6)
    road = np.clip(1 - np.abs(ys - road_y) / 26.0, 0, 1) ** 1.3 * np.clip((MUD_X1 + 16 - xs) / 60.0, 0, 1)
    road *= 0.45 + 0.55 * noise  # chemin marbré, pas une bande dure
    mud_mask = np.clip(approach * 0.55 + road * 0.7, 0, 1)
    mud_tone = Image.new("RGB", size, (104, 88, 62))
    mud_tone = luminance_paint(rng, mud_tone, 0.8, 1.15)
    ground = blend_mask(ground, mud_tone, mud_mask * 0.62)

    # 4. Ornières de charroi le long du chemin (traits sombres incurvés).
    ruts = Image.new("L", size, 0)
    rd = ImageDraw.Draw(ruts)
    for k, dy in enumerate((-5.0, 5.0)):
        pts = []
        for t in range(0, 41):
            xt = SCENE_X0 + (MUD_X1 + 12 - SCENE_X0) * (t / 40)
            yt = GATE_Y + 14.0 + 26.0 * math.sin((xt - SCENE_X0) / 260.0 + 0.6)
            pts.append(to_img(xt, yt + dy + math.sin(t / 4.0 + k) * 1.5))
        rd.line(pts, fill=120, width=max(1, img_px(1.4)))
    ruts = ruts.filter(ImageFilter.GaussianBlur(1.0 * S))
    dark = ImageEnhance.Brightness(ground).enhance(0.7)
    ground.paste(dark, (0, 0), ruts)

    return ground


# --- Douve : chenal creusé continu (eau peinte de combat-water.jpg) ---


def moat_center(y: float) -> float:
    return MOAT_X + 7.0 * math.sin(y / 105.0 + 0.8)


# Bande d'eau de douve : X de découpe (board-space) — assez large pour le
# méandre (centre ±7) + la respiration de largeur (±4) + le liseré.
MOAT_STRIP_X0 = MOAT_X - MOAT_HALF - 13.0
MOAT_STRIP_X1 = MOAT_X + MOAT_HALF + 13.0


def carve_moat(rng: random.Random, ground: Image.Image) -> tuple[Image.Image, Image.Image]:
    """Fossé PEINT procéduralement, en DEUX sorties : le sol reçoit les berges
    et le fond de fossé SEC (bakés dans la scène) ; l'eau part dans une bande
    RGBA séparée (`siege-moat.png`) que le client ne pose QUE si le siège a une
    douve moteur (Fort ≥ 2) — un Fort 1 garde le fossé sec, pas d'eau menteuse.

    Aucune toile d'eau réutilisable (combat-water.jpg est un pont de navire) ⇒
    eau peinte : dégradé profond, stries lisses, ombre de berge ouest, liseré
    de rive, reflets. Déterministe.
    """
    w, h = ground.size
    ys = (np.arange(h, dtype=np.float32) / S + SCENE_Y0)[:, None]
    xs = (np.arange(w, dtype=np.float32) / S + SCENE_X0)[None, :]
    center = MOAT_X + 7.0 * np.sin(ys / 105.0 + 0.8)
    # Largeur légèrement irrégulière (rives naturelles, pas un ruban).
    half = MOAT_HALF + 4.0 * np.sin(ys / 61.0 + 2.1) * np.cos(ys / 143.0)
    d = np.abs(xs - center)

    # Berges : sol boueux assombri sur le pourtour (terre remuée du fossé).
    bank = np.clip(1 - np.abs(d - half - 3.0) / 9.0, 0, 1)
    banked = ImageEnhance.Brightness(ImageEnhance.Color(ground).enhance(0.62)).enhance(0.66)
    out = blend_mask(ground, banked, bank * 0.85)

    # Fond de fossé SEC (bake scène) : terre sombre creusée, ombre côté ouest.
    chan = np.clip((half - d) / 2.5, 0, 1)
    dry = ImageEnhance.Brightness(ImageEnhance.Color(ground).enhance(0.5)).enhance(0.52)
    out = blend_mask(out, dry, chan * 0.92)
    west_shade = np.clip((center - xs + half) / (half * 1.5), 0, 1)
    ditch_shade = ImageEnhance.Brightness(out).enhance(0.62)
    out = blend_mask(out, ditch_shade, (chan * west_shade * 0.55).astype(np.float32))

    # — Bande d'eau (RGBA séparée) —
    deep = np.array([31, 54, 62], dtype=np.float32)
    shallow = np.array([74, 112, 118], dtype=np.float32)
    n_soft = smooth_noise(rng, w, h, 10, blur=26 * S)
    streaks = smooth_noise(rng, w // 6, h, 8, blur=10 * S)
    streaks = np.asarray(
        Image.fromarray((streaks * 255).astype(np.uint8), "L").resize((w, h), Image.BILINEAR),
        dtype=np.float32,
    ) / 255.0
    mix = np.clip(0.3 * n_soft + 0.55 * streaks + 0.18, 0, 1)[..., None]
    water_arr = deep[None, None, :] * (1 - mix) + shallow[None, None, :] * mix
    water_arr *= (0.66 + 0.34 * west_shade[..., None]).astype(np.float32)
    alpha = np.clip((half - d) / 2.0, 0, 1) * 0.96
    # Liseré de rive (waterline sombre) intégré à la bande.
    edge = np.clip(1 - np.abs(d - half) / 1.6, 0, 1)
    water_arr *= (1 - 0.55 * edge)[..., None]
    alpha = np.maximum(alpha, edge * 0.6)
    rgba = np.dstack([np.clip(water_arr, 0, 255), np.clip(alpha * 255, 0, 255)]).astype(np.uint8)
    water = Image.fromarray(rgba, "RGBA")

    # Reflets clairs discrets (vaguelettes peintes, déterministes).
    draw = ImageDraw.Draw(water)
    for k in range(30):
        yb = SCENE_Y0 + 16 + k * (SCENE_H - 32) / 30 + rng.uniform(-5, 5)
        xb = moat_center(yb) + rng.uniform(-MOAT_HALF * 0.55, MOAT_HALF * 0.45)
        ww = rng.uniform(5, 12)
        x0, y0 = to_img(xb - ww / 2, yb)
        x1, y1 = to_img(xb + ww / 2, yb)
        draw.arc([x0, y0 - 2 * S, x1, y1 + 2 * S], 195, 345, fill=(196, 214, 218, 168), width=S)

    strip = water.crop((img_px(MOAT_STRIP_X0 - SCENE_X0), 0, img_px(MOAT_STRIP_X1 - SCENE_X0), h))
    return out, strip


# --- Ville de la faction assiégée (bande estompée à l'est) ---


def paste_city(rng: random.Random, ground: Image.Image, faction: str | None) -> Image.Image:
    w, h = ground.size
    out = ground.copy()
    band_x0 = img_px(CITY_X0 - SCENE_X0)
    band_w = w - band_x0

    if faction:
        src = Image.open(ASSETS / "backgrounds" / f"town-{faction}.jpg").convert("RGB")
        # Cœur bâti de la vue de ville (évite le premier plan : routes/esplanades).
        crop = src.crop(
            (
                int(src.width * 0.06),
                int(src.height * 0.05),
                int(src.width * 0.96),
                int(src.height * 0.58),
            )
        )
        scale = h / crop.height
        city = crop.resize((int(crop.width * scale), h), Image.LANCZOS)
        city = city.filter(ImageFilter.GaussianBlur(0.8 * S))
        city = ImageEnhance.Brightness(ImageEnhance.Color(city).enhance(0.85)).enhance(0.85)
        cw = min(city.width, band_w + 40 * S)
        city = city.crop((max(0, (city.width - cw) // 2), 0, max(0, (city.width - cw) // 2) + cw, h))
    else:
        # Générique : silhouettes de tours dans la brume de fumée.
        city = Image.new("RGB", (band_w + 40 * S, h), (58, 62, 58))
        tower = Image.open(OUT_COMBAT / "siege-tower.png").convert("RGBA")
        cd = ImageDraw.Draw(city)
        cd.rectangle([0, 0, city.width, h], fill=(60, 66, 61))
        for k in range(6):
            th = int(h * rng.uniform(0.35, 0.62))
            tw = int(th * tower.width / tower.height)
            sil = tower.resize((tw, th), Image.LANCZOS)
            solid = Image.new("RGBA", sil.size, (40, 45, 42, 235))
            solid.putalpha(sil.split()[3])
            city.paste(solid, (int(k * city.width / 6 + rng.uniform(0, 20 * S)), int(h * rng.uniform(0.05, 0.35))), solid)
        city = city.filter(ImageFilter.GaussianBlur(2.0 * S))

    # Fondu atmosphérique : la ville émerge de la brume vers le bord droit.
    mask = Image.new("L", (city.width, h), 0)
    md = ImageDraw.Draw(mask)
    fade_w = 55 * S
    for i in range(city.width):
        a = int(232 * min(1.0, max(0.0, (i / fade_w))))
        md.line([(i, 0), (i, h)], fill=a)
    out.paste(city, (band_x0, 0), mask)

    # Brume légère au raccord (profondeur atmosphérique, sans noyer la ville).
    haze = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    hd = ImageDraw.Draw(haze)
    for i in range(band_x0 - 30 * S, band_x0 + 60 * S):
        t = 1 - abs(i - band_x0 - 10 * S) / max(1, 45 * S)
        if t > 0:
            hd.line([(i, 0), (i, h)], fill=(196, 200, 186, int(46 * t)))
    out = Image.alpha_composite(out.convert("RGBA"), haze).convert("RGB")
    return out


def add_wall_ao(ground: Image.Image) -> Image.Image:
    """Assombrissement au pied du rempart (la pièce dynamique se pose dessus)."""
    w, h = ground.size
    ao = band_mask(w, h, WALL_X - 26, WALL_X + 30, feather=16.0) * 0.3
    darker = ImageEnhance.Brightness(ground).enhance(0.62)
    return blend_mask(ground, darker, ao)


def vignette(im: Image.Image) -> Image.Image:
    """Vignettage DOUX (cadre cinématique) — assez léger pour ne pas manger le
    sol côté ville (retour porteur itération 2)."""
    w, h = im.size
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    steps = 42
    for i in range(steps):
        a = int(44 * (i / steps) ** 2)
        d.rectangle([i * 3 * S, i * 2 * S, w - i * 3 * S, h - i * 2 * S], outline=a, width=3 * S)
    m = m.filter(ImageFilter.GaussianBlur(8 * S))
    dark = ImageEnhance.Brightness(im).enhance(0.74)
    out = im.copy()
    out.paste(dark, (0, 0), m)
    return out


# --- KIT DE FORTIFICATION PROCÉDURAL (itération 6 — retour porteur) ---
#
# TOUT le vertical (courtine, porte, tours d'angle, tour de tir) est dessiné
# dans UN SEUL langage : celui du sol validé (pavés de cour) — blocs épais à
# contour sombre, palette pierre unifiée, lumière haut-gauche, formes franches.
# Plus AUCUN sprite peint plaqué (le mélange procédural/peint/collage était la
# racine du rejet). Le mur est « une image par hexagone qui s'emboîte », comme
# le sol : chaque pièce est un BLOC-PRISME au footprint de son hex (zigzag du
# nid d'abeille assumé, fidèle à Heroes Online), état intact/fissuré/rasé.

WALL_H = 30.0  # élévation de la courtine (bp)
GATE_WALL_H = 38.0  # la porte est plus haute que la courtine
TOWER_H_BP = 88.0  # tour d'angle
ARROW_TOWER_H_BP = 100.0  # tour de tir (domine tout)

# Palette pierre UNIFIÉE (même famille que paint_cobbles / tuiles de cour).
K_STONE = (134, 129, 119)
K_STONE_L = (174, 168, 156)
K_STONE_XL = (204, 198, 186)
K_STONE_D = (98, 93, 85)
K_STONE_XD = (66, 62, 55)
K_OUT = (52, 48, 43)
K_WOOD = (102, 78, 54)
K_WOOD_D = (64, 50, 36)
K_IRON = (60, 58, 55)


def hex_pts_img(cxp_bp: float, cyp_bp: float, r_bp: float) -> list[tuple[float, float]]:
    """Sommets IMG d'un hex pointy-top APLATI (ordre N, NE, SE, S, SW, NW)."""
    pts = []
    for deg in (-90, -30, 30, 90, 150, 210):
        a = math.radians(deg)
        pts.append((img_px(cxp_bp + r_bp * math.cos(a)), img_px(cyp_bp + r_bp * math.sin(a) * SQUASH)))
    return pts


def stone_panel(rng: random.Random, w: int, h: int, base: tuple[int, int, int], course_bp: float = 7.5) -> Image.Image:
    """Appareil de pierre de taille (assises décalées, ton jitteré, arête
    éclairée, joint sombre) — même écriture que les pavés de cour."""
    im = Image.new("RGB", (w, h), base)
    d = ImageDraw.Draw(im)
    ch = img_px(course_bp)
    bw = img_px(course_bp * 1.9)
    for j, y in enumerate(range(-ch, h + ch, ch)):
        off = (j % 2) * bw // 2
        for x in range(-bw + off, w + bw, bw):
            t = rng.randint(-11, 11)
            tone = (base[0] + t, base[1] + t, base[2] + t)
            d.rectangle([x, y, x + bw - S, y + ch - S], fill=tone, outline=K_OUT, width=1)
            d.line([(x + S, y + S), (x + bw - 2 * S, y + S)], fill=(min(255, base[0] + 34 + t), min(255, base[1] + 34 + t), min(255, base[2] + 30 + t)), width=1)
    return im


def shade_lr_masked(im: Image.Image, mask: Image.Image, box: tuple[int, int, int, int], light_w: float, dark_w: float) -> None:
    """Modelé gauche-clair / droite-sombre CLIPPÉ au masque (lumière haut-gauche)
    — jamais de halo sur l'alpha hors de la forme."""
    x0, y0, x1, y1 = box
    w = max(1, x1 - x0)
    overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    lw = int(w * light_w)
    dw = int(w * dark_w)
    for i in range(lw):
        od.line([(x0 + i, y0), (x0 + i, y1)], fill=(255, 250, 236, int(46 * (1 - i / max(1, lw)))))
    for i in range(dw):
        od.line([(x1 - 1 - i, y0), (x1 - 1 - i, y1)], fill=(20, 18, 15, int(70 * (1 - i / max(1, dw)))))
    overlay.putalpha(ImageChops.multiply(overlay.getchannel("A"), mask))
    im.alpha_composite(overlay)


def draw_merlon(d: ImageDraw.ImageDraw, cx_i: int, cy_i: int, w_bp: float = 7.0, h_bp: float = 6.5) -> None:
    """Merlon-bloc (dent de créneau) posé debout, base en (cx, cy) IMG."""
    hw = img_px(w_bp / 2)
    hh = img_px(h_bp)
    d.rounded_rectangle([cx_i - hw, cy_i - hh, cx_i + hw, cy_i], radius=S, fill=K_STONE_L, outline=K_OUT, width=1)
    d.rectangle([cx_i - hw + S, cy_i - hh + S, cx_i + hw - S, cy_i - hh + 2 * S], fill=K_STONE_XL)
    d.rectangle([cx_i + hw - 2 * S, cy_i - hh + S, cx_i + hw - S, cy_i - S], fill=K_STONE_D)


def prism(canvas: Image.Image, top_c: tuple[float, float], r_bp: float, h_bp: float, rng: random.Random) -> list[tuple[float, float]]:
    """Bloc-prisme hexagonal : jupe extrudée (appareil clippé + modelé) puis
    face supérieure (dalles + contour). Rend les sommets IMG du toit."""
    top = hex_pts_img(top_c[0], top_c[1], r_bp)
    n_, ne, se, s_, sw, nw = top
    dh = img_px(h_bp)
    skirt = [nw, sw, s_, se, ne, (ne[0], ne[1] + dh), (se[0], se[1] + dh), (s_[0], s_[1] + dh), (sw[0], sw[1] + dh), (nw[0], nw[1] + dh)]
    xs = [p[0] for p in skirt]
    ys = [p[1] for p in skirt]
    box = (min(xs), min(ys), max(xs), max(ys))
    mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(mask).polygon(skirt, fill=255)
    panel = stone_panel(rng, canvas.width, canvas.height, K_STONE).convert("RGBA")
    canvas.paste(panel, (0, 0), mask)
    shade_lr_masked(canvas, mask, box, 0.22, 0.3)
    d = ImageDraw.Draw(canvas)
    d.line([sw, (sw[0], sw[1] + dh)], fill=K_OUT, width=1)
    d.line([se, (se[0], se[1] + dh)], fill=K_OUT, width=1)
    d.line([(nw[0], nw[1] + dh), (sw[0], sw[1] + dh), (s_[0], s_[1] + dh), (se[0], se[1] + dh), (ne[0], ne[1] + dh)], fill=K_OUT, width=2)
    d.line([(nw[0] + S, nw[1] + dh - S), (sw[0] + S, sw[1] + dh - S), (s_[0], s_[1] + dh - S)], fill=K_STONE_XD, width=S)
    # Face supérieure : dalles claires (chemin de ronde) + contour.
    top_mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(top_mask).polygon(top, fill=255)
    slabs = stone_panel(rng, canvas.width, canvas.height, (156, 151, 139), course_bp=12.0).convert("RGBA")
    canvas.paste(slabs, (0, 0), top_mask)
    d.polygon(top, outline=K_OUT)
    d.line([nw, n_, ne], fill=K_STONE_XL, width=S)
    return top


def build_wall_piece(rng: random.Random, state: str, variant: int = 1) -> Image.Image:
    """Bloc de courtine d'UN hex (s'emboîte comme les tuiles de sol, zigzag du
    nid d'abeille assumé) ; `state` : intact | cracked | razed."""
    del variant
    rng = random.Random(SEED + 41)  # blocs identiques ⇒ mur régulier
    w_bp, h_bp = COURT_TILE_W, WALL_H + COURT_TILE_H
    canvas = Image.new("RGBA", (img_px(w_bp), img_px(h_bp)), (0, 0, 0, 0))
    top_c = (w_bp / 2, COURT_TILE_H / 2)
    r_bp = HEX + COURT_TILE_BLEED

    if state == "razed":
        # Moignon rasé : socle bas déchiqueté + cratère de gravats.
        rr = random.Random(SEED + 43)
        stub_h = WALL_H * 0.22
        foot_c = (top_c[0], top_c[1] + WALL_H - stub_h)
        prism(canvas, foot_c, r_bp * 0.98, stub_h, rr)
        d = ImageDraw.Draw(canvas)
        # Arase brisée : dents claires le long du toit du moignon.
        top_pts = hex_pts_img(foot_c[0], foot_c[1], r_bp * 0.98)
        for k in range(9):
            t = k / 8
            xa = top_pts[5][0] + (top_pts[1][0] - top_pts[5][0]) * t
            ya = top_pts[5][1] + (top_pts[1][1] - top_pts[5][1]) * t + rr.randint(-3 * S, 3 * S)
            sz = rr.randint(2 * S, 5 * S)
            d.rectangle([xa, ya - sz, xa + sz, ya], fill=K_STONE_L, outline=K_OUT, width=1)
        # Cratère + éboulis (pierres façon pavés, gros au centre).
        crater = hex_pts_img(foot_c[0], foot_c[1] - stub_h, r_bp * 0.8)
        d.polygon(crater, fill=(74, 68, 58, 200))
        for k in range(34):
            ang = rr.random() * math.tau
            dist = rr.random() ** 0.6 * r_bp * 0.85
            gx = img_px(foot_c[0] + math.cos(ang) * dist)
            gy = img_px(foot_c[1] - stub_h + math.sin(ang) * dist * SQUASH)
            sz = rr.randint(3 * S, 8 * S)
            tone = rr.choice([K_STONE, K_STONE_L, K_STONE_D, (118, 112, 102)])
            d.rounded_rectangle([gx, gy, gx + sz, gy + int(sz * 0.75)], radius=S, fill=tone, outline=K_OUT, width=1)
            d.rectangle([gx + S, gy + S, gx + max(2 * S, sz // 2), gy + 2 * S], fill=K_STONE_XL)
        return canvas

    top = prism(canvas, top_c, r_bp, WALL_H, rng)
    n_, ne, se, s_, sw, nw = top
    d = ImageDraw.Draw(canvas)
    # Créneaux face à l'assaillant : merlons le long du flanc OUEST (NW→SW)
    # + un au sommet nord — la ligne continue de bloc en bloc.
    for t in (0.14, 0.5, 0.86):
        mx = int(nw[0] + (sw[0] - nw[0]) * t)
        my = int(nw[1] + (sw[1] - nw[1]) * t) + img_px(1.4)
        draw_merlon(d, mx, my, 8.4, 8.0)
    draw_merlon(d, int((nw[0] + n_[0]) / 2), int((nw[1] + n_[1]) / 2) + img_px(1.2), 7.2, 7.0)

    if state == "cracked":
        cd = ImageDraw.Draw(canvas)
        cx0, cy0 = img_px(top_c[0]), img_px(top_c[1] + WALL_H * 0.45)
        for k in range(5):
            ang = math.radians((k * 71 + 15) % 360)
            ln = img_px(16 + (k * 17 % 5) * 2)
            px, py = cx0, cy0
            for s_i in range(1, 4):
                jit = ((k + s_i) * 41 % 10 - 5) * S
                nx2 = cx0 + math.cos(ang) * ln * s_i / 3 + jit
                ny2 = cy0 + math.sin(ang) * ln * s_i / 3 * SQUASH
                cd.line([px, py, nx2, ny2], fill=(30, 26, 21, 230), width=max(1, S))
                px, py = nx2, ny2
        blot = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        ImageDraw.Draw(blot).ellipse([cx0 - 13 * S, cy0 - 9 * S, cx0 + 13 * S, cy0 + 9 * S], fill=(34, 29, 23, 84))
        canvas = Image.alpha_composite(canvas, blot.filter(ImageFilter.GaussianBlur(3 * S)))

    return canvas






# --- Sol hexagonal de cour (« effet ville » : pavés PAR HEX dans l'enceinte) ---

# Dimensions d'un hex de plateau (pointy-top APLATI iso, cf. hexgrid.ts) + un
# léger débord pour absorber les jointures entre tuiles voisines.
COURT_TILE_BLEED = 1.2
COURT_TILE_W = HEX_W + 2 * COURT_TILE_BLEED
COURT_TILE_H = 2 * HEX * SQUASH + 2 * COURT_TILE_BLEED


def hex_mask(w: int, h: int, feather_px: int) -> Image.Image:
    """Masque alpha d'un hex pointy-top aplati (bords adoucis)."""
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    cx0, cy0 = w / 2, h / 2
    pts = []
    for k in range(6):
        a = math.radians(-90 + k * 60)
        pts.append((cx0 + (HEX + COURT_TILE_BLEED) * math.cos(a) * S, cy0 + (HEX + COURT_TILE_BLEED) * math.sin(a) * SQUASH * S))
    d.polygon(pts, fill=255)
    return m.filter(ImageFilter.GaussianBlur(feather_px))


def paint_cobbles(rng: random.Random, w: int, h: int, base_tone: tuple[int, int, int] = (124, 120, 112)) -> Image.Image:
    """Nappe de PAVÉS peints (quinconce, joints sombres, éclat haut-gauche,
    usure par plaques) — partagée par la tuile hex de cour, l'esplanade bakée
    de la scène et la chaussée de la porte. Déterministe."""
    base = Image.new("RGB", (w, h), base_tone)
    d = ImageDraw.Draw(base)
    cob_w = img_px(11.0)
    cob_h = img_px(7.2)
    for j, y in enumerate(range(-cob_h, h + cob_h, int(cob_h * 0.92))):
        off = (j % 2) * cob_w // 2
        for x in range(-cob_w + off, w + cob_w, int(cob_w * 1.02)):
            t = rng.randint(-16, 16)
            jx = rng.randint(-2 * S, 2 * S)
            jy = rng.randint(-S, S)
            tone = (132 + t, 128 + t, 120 + t)
            box = [x + jx, y + jy, x + jx + cob_w - 2 * S, y + jy + cob_h - S]
            d.ellipse(box, fill=tone, outline=(78, 74, 66), width=S)
            # Éclat haut-gauche (volume, lumière cohérente avec la scène).
            d.arc([box[0] + S, box[1] + S, box[2] - S, box[3] - S], 150, 300, fill=(178 + t // 2, 174 + t // 2, 164 + t // 2), width=S)
    n = smooth_noise(rng, w, h, 5, blur=8 * S)
    dark = ImageEnhance.Brightness(base).enhance(0.8)
    return blend_mask(base, dark, n * 0.5)


def build_court_tile(variant: int) -> Image.Image:
    """Tuile de sol PAVÉ d'une case de cour (pierre grise du gatehouse) — pose
    l'« effet ville » hex par hex à l'intérieur de l'enceinte."""
    rng = random.Random(SEED * 100 + variant)
    w, h = img_px(COURT_TILE_W), img_px(COURT_TILE_H)
    base = paint_cobbles(rng, w, h)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(base, (0, 0), hex_mask(w, h, feather_px=int(1.2 * S)))
    return out


# Chaussée de la porte : tablier de pierre qui FRANCHIT la douve devant
# l'ouverture (rangées 4–5) — légitime le gatehouse qui mord sur le fossé et
# prolonge le chemin d'approche. Bakée dans la scène (fossé sec) ET dans la
# bande d'eau (elle passe PAR-DESSUS l'eau).
CAUSEWAY_X0 = MOAT_X - 46.0
CAUSEWAY_X1 = WALL_X + 6.0
CAUSEWAY_Y0 = cy(GATE_ROWS[0]) - 17.0
CAUSEWAY_Y1 = cy(GATE_ROWS[1]) + 17.0


def build_causeway(rng: random.Random) -> Image.Image:
    w = img_px(CAUSEWAY_X1 - CAUSEWAY_X0)
    h = img_px(CAUSEWAY_Y1 - CAUSEWAY_Y0)
    cobb = paint_cobbles(rng, w, h, base_tone=(118, 112, 102))
    out = cobb.convert("RGBA")
    d = ImageDraw.Draw(out)
    # Margelles : rangs de pierre plus sombres le long des bords.
    edge_h = img_px(3.2)
    d.rectangle([0, 0, w, edge_h], fill=(88, 84, 76, 255))
    d.rectangle([0, h - edge_h, w, h], fill=(70, 66, 58, 255))
    d.rectangle([0, edge_h, w, edge_h + S], fill=(160, 154, 140, 255))
    # Fondu du raccord OUEST (la chaussée naît du chemin de terre).
    mask = Image.new("L", (w, h), 255)
    md = ImageDraw.Draw(mask)
    fade = img_px(14)
    for i in range(fade):
        md.line([(i, 0), (i, h)], fill=int(255 * i / fade))
    out.putalpha(mask)
    return out


def paste_causeway(target: Image.Image, causeway: Image.Image, origin_x_bp: float) -> None:
    """Pose le tablier dans `target` dont l'origine board-space X est donnée
    (scène : SCENE_X0 ; bande d'eau : MOAT_STRIP_X0), avec ombre portée sur
    l'eau/le fossé le long des bords nord et sud."""
    x = img_px(CAUSEWAY_X0 - origin_x_bp)
    y = img_px(CAUSEWAY_Y0 - SCENE_Y0)
    shadow = Image.new("RGBA", (causeway.width, causeway.height + img_px(8)), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rectangle([0, causeway.height - img_px(1), causeway.width, causeway.height + img_px(6)], fill=(12, 16, 18, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(2 * S))
    target.paste(shadow, (x, y + img_px(2)), shadow)
    target.paste(causeway, (x, y), causeway)
def build_round_tower(h_bp: float, r_bp: float, seed: int) -> Image.Image:
    """Tour ronde PROCÉDURALE (même langage que la courtine : appareil de
    pierre, contour sombre, lumière haut-gauche, couronne de merlons)."""
    rng = random.Random(seed)
    w_bp = r_bp * 2 + 10
    canvas = Image.new("RGBA", (img_px(w_bp), img_px(h_bp + 8)), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    cx_i = img_px(w_bp / 2)
    top_y = img_px(7.0)
    base_y = img_px(h_bp + 3)
    rx = img_px(r_bp)
    ry = img_px(r_bp * 0.42)

    # Ombre de contact au sol.
    d.ellipse([cx_i - int(rx * 1.15), base_y - int(ry * 1.1), cx_i + int(rx * 1.15), base_y + int(ry * 1.3)], fill=(16, 16, 12, 96))
    # Fût : appareil clippé au profil (rectangle + base élargie arrondie).
    mask = Image.new("L", canvas.size, 0)
    md = ImageDraw.Draw(mask)
    md.rectangle([cx_i - rx, top_y, cx_i + rx, base_y - ry], fill=255)
    md.ellipse([cx_i - rx, base_y - 2 * ry, cx_i + rx, base_y], fill=255)
    panel = stone_panel(rng, canvas.width, canvas.height, K_STONE, course_bp=8.0).convert("RGBA")
    canvas.paste(panel, (0, 0), mask)
    shade_lr_masked(canvas, mask, (cx_i - rx, top_y, cx_i + rx, base_y), 0.3, 0.38)
    d.arc([cx_i - rx, base_y - 2 * ry, cx_i + rx, base_y], 0, 180, fill=K_OUT, width=2)
    d.line([(cx_i - rx, top_y), (cx_i - rx, base_y - ry)], fill=K_OUT, width=2)
    d.line([(cx_i + rx, top_y), (cx_i + rx, base_y - ry)], fill=K_OUT, width=2)

    # Couronne : plateau elliptique (dalles) + anneau de merlons.
    d.ellipse([cx_i - rx - 2 * S, top_y - ry, cx_i + rx + 2 * S, top_y + ry], fill=(146, 141, 130, 255), outline=K_OUT, width=2)
    d.arc([cx_i - rx - 2 * S, top_y - ry, cx_i + rx + 2 * S, top_y + ry], 180, 360, fill=K_STONE_XL, width=S)
    for k in range(8):
        ang = math.pi * (0.08 + 0.84 * k / 7)
        mx = cx_i - int(math.cos(ang) * (rx + S))
        my = top_y + int(math.sin(ang) * ry * (1 if k % 2 == 0 else 1.0))
        draw_merlon(d, mx, my + img_px(1.2), 5.6, 5.2)
    # Meurtrières (2) sur le fût.
    for fy in (0.42, 0.66):
        sy = int(top_y + (base_y - top_y) * fy)
        d.rounded_rectangle([cx_i - 2 * S, sy, cx_i + 2 * S, sy + img_px(6)], radius=S, fill=(38, 34, 29, 255))
        d.rectangle([cx_i - 2 * S, sy + img_px(6) - S, cx_i + 2 * S, sy + img_px(6)], fill=K_STONE_XL)
    return canvas


def build_corner_tower() -> Image.Image:
    """Tour d'angle du rempart (extrémités de la courtine)."""
    return build_round_tower(TOWER_H_BP, 15.0, SEED + 47)


def build_arrow_tower() -> Image.Image:
    """TOUR DE TIR : tour du kit, plus haute, avec BALISTE PROCÉDURALE montée
    sur la plateforme, pointée vers l'assaillant (ouest) — l'arme se voit, dans
    le même langage que tout le reste (bois/fer stylisés, contour sombre)."""
    tower = build_round_tower(ARROW_TOWER_H_BP, 16.0, SEED + 53)
    w, h = tower.size
    head = img_px(16.0)
    canvas = Image.new("RGBA", (w + img_px(10), h + head), (0, 0, 0, 0))
    canvas.paste(tower, (img_px(10), head), tower)
    d = ImageDraw.Draw(canvas)
    cx_i = img_px(10) + w // 2
    deck_y = head + img_px(7.0)  # plateau de la couronne

    # — Baliste (profil, pointée à gauche/ouest) —
    beam_y = deck_y - img_px(4.0)
    x_tail = cx_i + img_px(12)
    x_head = cx_i - img_px(20)
    # Chevalet (A-frame) planté dans le plateau.
    d.line([(cx_i - img_px(3), deck_y + img_px(2)), (cx_i + img_px(2), beam_y)], fill=K_WOOD_D, width=3 * S)
    d.line([(cx_i + img_px(7), deck_y + img_px(2)), (cx_i + img_px(2), beam_y)], fill=K_WOOD_D, width=3 * S)
    # Poutre-affût inclinée vers le haut-ouest.
    tip_y = beam_y - img_px(6.0)
    d.line([(x_tail, beam_y + img_px(1.5)), (x_head, tip_y)], fill=K_WOOD, width=4 * S)
    d.line([(x_tail, beam_y + img_px(1.5)), (x_head, tip_y)], fill=K_WOOD_D, width=S)
    # Arcs (bras) à la tête, corde tendue vers le treuil.
    d.arc([x_head - img_px(4), tip_y - img_px(9), x_head + img_px(8), tip_y + img_px(2)], 200, 340, fill=K_WOOD_D, width=2 * S)
    d.arc([x_head - img_px(4), tip_y - img_px(2), x_head + img_px(8), tip_y + img_px(9)], 20, 160, fill=K_WOOD_D, width=2 * S)
    d.line([(x_head + img_px(6), tip_y - img_px(7)), (x_tail - img_px(2), beam_y), (x_head + img_px(6), tip_y + img_px(7))], fill=(224, 216, 198, 255), width=1)
    # Carreau + pointe de fer.
    d.line([(x_head + img_px(2), tip_y - img_px(0.6)), (x_tail - img_px(4), beam_y - img_px(0.5))], fill=(224, 216, 198, 255), width=S)
    d.polygon([(x_head - img_px(3), tip_y), (x_head + img_px(2), tip_y - img_px(2)), (x_head + img_px(2), tip_y + img_px(2))], fill=K_IRON, outline=K_OUT)
    # Treuil (tambour) à l'arrière.
    d.ellipse([x_tail - img_px(2), beam_y - img_px(2), x_tail + img_px(3), beam_y + img_px(3)], fill=K_WOOD, outline=K_OUT, width=1)
    d.line([(x_tail - img_px(3.4), beam_y - img_px(3.4)), (x_tail + img_px(4.4), beam_y + img_px(4.4))], fill=K_IRON, width=S)

    # Merlons AVANT re-superposés : l'engin est posé DANS la plateforme.
    rx = img_px(16.0)
    ry = img_px(16.0 * 0.42)
    for k in range(4):
        ang = math.pi * (0.16 + 0.68 * k / 3)
        mx = cx_i - int(math.cos(ang) * (rx + S))
        my = head + img_px(7.0) + int(math.sin(ang) * ry * 0.5)
        draw_merlon(d, mx, my + img_px(1.4), 5.6, 5.2)
    return canvas


def build_gate_piece(rng: random.Random) -> Image.Image:
    """PORTE du kit : grand bloc-prisme couvrant les DEUX hexes d'ouverture
    (footprint allongé nid-d'abeille), plus haut que la courtine, percé d'une
    arche à vantaux de bois — même appareil, mêmes merlons, même lumière."""
    del rng
    rr = random.Random(SEED + 59)
    w_bp = COURT_TILE_W + HEX_W / 2
    h_bp = GATE_WALL_H + COURT_TILE_H + Y_STEP
    canvas = Image.new("RGBA", (img_px(w_bp), img_px(h_bp)), (0, 0, 0, 0))
    r_bp = HEX + COURT_TILE_BLEED
    # Hex A (rangée haute, à l'ouest) et hex B (rangée basse, décalée est).
    a_c = (COURT_TILE_W / 2, COURT_TILE_H / 2)
    b_c = (a_c[0] + HEX_W / 2, a_c[1] + Y_STEP)

    # Footprint fusionné : contour capsule des deux hexes.
    pa = hex_pts_img(a_c[0], a_c[1], r_bp)
    pb = hex_pts_img(b_c[0], b_c[1], r_bp)
    top_outline = [pa[5], pa[0], pa[1], pb[1], pb[2], pb[3], pb[4], pa[4]]  # NW,N,NE(A), NE,SE,S,SW(B), SW(A)
    dh = img_px(GATE_WALL_H)
    lower = [pb[1], pb[2], pb[3], pb[4], pa[4], pa[5]]
    skirt = lower + [(p[0], p[1] + dh) for p in reversed(lower)]
    mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(mask).polygon(skirt, fill=255)
    panel = stone_panel(rr, canvas.width, canvas.height, K_STONE).convert("RGBA")
    canvas.paste(panel, (0, 0), mask)
    xs = [p[0] for p in skirt]
    ys = [p[1] for p in skirt]
    shade_lr_masked(canvas, mask, (min(xs), min(ys), max(xs), max(ys)), 0.2, 0.28)
    d = ImageDraw.Draw(canvas)
    d.line([(pa[4][0], pa[4][1] + dh), (pb[4][0], pb[4][1] + dh), (pb[3][0], pb[3][1] + dh), (pb[2][0], pb[2][1] + dh)], fill=K_OUT, width=2)

    # Face supérieure fusionnée (dalles) + contour.
    top_mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(top_mask).polygon(top_outline, fill=255)
    slabs = stone_panel(rr, canvas.width, canvas.height, (156, 151, 139), course_bp=12.0).convert("RGBA")
    canvas.paste(slabs, (0, 0), top_mask)
    d.polygon(top_outline, outline=K_OUT)
    d.line([pa[5], pa[0], pa[1]], fill=K_STONE_XL, width=S)

    # ARCHE + vantaux : percée dans la jupe, centrée sur la couture des 2 hexes.
    gx = img_px((a_c[0] + b_c[0]) / 2)
    gfoot = img_px((a_c[1] + b_c[1]) / 2 + GATE_WALL_H + HEX * SQUASH * 0.45)
    aw = img_px(13.0)  # demi-largeur de l'arche
    ah = img_px(32.0)  # hauteur de l'arche
    d.rounded_rectangle([gx - aw - 3 * S, gfoot - ah - 4 * S, gx + aw + 3 * S, gfoot], radius=4 * S, fill=K_STONE_D, outline=K_OUT, width=2)
    d.rounded_rectangle([gx - aw, gfoot - ah, gx + aw, gfoot], radius=3 * S, fill=(26, 23, 19, 255))
    # Vantaux de bois (planches + bandes de fer), légèrement en retrait.
    px0, px1 = gx - aw + 2 * S, gx + aw - 2 * S
    py0 = gfoot - ah + 3 * S
    d.rounded_rectangle([px0, py0, px1, gfoot], radius=2 * S, fill=K_WOOD)
    for i in range(1, 4):
        vx = px0 + (px1 - px0) * i // 4
        d.line([(vx, py0), (vx, gfoot)], fill=K_WOOD_D, width=1)
    for fy in (0.3, 0.62):
        by = int(py0 + (gfoot - py0) * fy)
        d.rectangle([px0, by, px1, by + 2 * S], fill=K_IRON)
    d.line([(gx, py0), (gx, gfoot)], fill=(40, 32, 24, 255), width=S)
    # Claveaux clairs autour de l'arche.
    for k in range(5):
        t = k / 4
        vx = int(gx - aw - 2 * S + (2 * aw + 4 * S) * t)
        vy = gfoot - ah - 2 * S + int(abs(t - 0.5) * 5 * S)
        d.rectangle([vx - 2 * S, vy - 2 * S, vx + 2 * S, vy + S], fill=K_STONE_L, outline=K_OUT, width=1)

    # Merlons : flanc ouest des deux hexes + sommet.
    for hexpts in (pa, pb):
        for t in (0.2, 0.65):
            mx = int(hexpts[5][0] + (hexpts[4][0] - hexpts[5][0]) * t)
            my = int(hexpts[5][1] + (hexpts[4][1] - hexpts[5][1]) * t) + img_px(1.2)
            draw_merlon(d, mx, my)
    draw_merlon(d, int((pa[5][0] + pa[0][0]) / 2), int((pa[5][1] + pa[0][1]) / 2) + img_px(1.0), 6.0, 5.5)
    return canvas




# --- Assemblage & sorties ---


def gate_contact_shadow(ground: Image.Image) -> Image.Image:
    """Ombre de contact au pied du gatehouse — la porte est PLANTÉE dans la
    scène au lieu d'y être collée (retour porteur itération 2)."""
    w, h = ground.size
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(shadow)
    cx0, cy0 = to_img(WALL_X, GATE_Y_BOTTOM - 2)
    rx, ry = img_px(38.0), img_px(9.0)
    d.ellipse([cx0 - rx, cy0 - ry, cx0 + rx, cy0 + ry], fill=(14, 14, 12, 96))
    shadow = shadow.filter(ImageFilter.GaussianBlur(4 * S))
    return Image.alpha_composite(ground.convert("RGBA"), shadow).convert("RGB")


def build_scene(faction: str | None) -> tuple[Image.Image, Image.Image]:
    rng = random.Random(SEED if faction is None else SEED + sum(ord(c) for c in faction))
    ground = build_ground(rng)
    ground, water = carve_moat(rng, ground)
    causeway = build_causeway(random.Random(SEED + 31))
    paste_causeway(ground, causeway, SCENE_X0)  # fossé sec : tablier baké
    paste_causeway(water, causeway, MOAT_STRIP_X0)  # douve en eau : PAR-DESSUS
    ground = paste_city(rng, ground, faction)
    ground = add_wall_ao(ground)
    ground = gate_contact_shadow(ground)
    ground = vignette(ground)
    return ground, water


FACTIONS = ["haven", "necropolis", "arcane-hunters", "sylvan-court", "vox-arcana", "dungeon"]
# Porte du kit : constantes de calage (le bloc couvre les 2 rangées 4–5).
GATE_X = WALL_X
GATE_Y_BOTTOM = cy(GATE_ROWS[1]) + (HEX + COURT_TILE_BLEED) * SQUASH





def main() -> None:
    OUT_COMBAT.mkdir(parents=True, exist_ok=True)
    OUT_LAYOUT.mkdir(parents=True, exist_ok=True)

    scene, water = build_scene(None)
    scene.save(OUT_COMBAT / "siege-scene.jpg", quality=84)
    water.save(OUT_COMBAT / "siege-moat.png")
    print(f"siege-scene.jpg {scene.size} · siege-moat.png {water.size}")
    for f in FACTIONS:
        s, _ = build_scene(f)
        s.save(OUT_COMBAT / f"siege-scene-{f}.jpg", quality=84)
        print(f"siege-scene-{f}.jpg {s.size}")

    if (OUT_COMBAT / "siege-kit-source.json").exists():
        print("pièces PEINTES présentes (siege-kit-source.json) — kit procédural non ré-émis")
        emit_pieces = False
    else:
        emit_pieces = True
    for state in ("intact", "cracked", "razed") if emit_pieces else ():
        rng = random.Random(SEED + 7)
        piece = build_wall_piece(rng, state)
        suffix = "" if state == "intact" else f"-{state}"
        piece.save(OUT_COMBAT / f"siege-piece-wall{suffix}.png")
        print(f"siege-piece-wall{suffix}.png {piece.size}")
    # (Itération 5 : plus de variante de pièce — la bande périodique doit être
    # IDENTIQUE d'une rangée à l'autre pour se raccorder sans couture. Le
    # fichier -2 n'est plus émis ; le résolveur client retombe sur la pièce 1.)

    # Sol hexagonal de cour (« effet ville ») + tour d'extrémité recolorée.
    for v in (1, 2, 3):
        tile = build_court_tile(v)
        tile.save(OUT_COMBAT / f"siege-tile-court-{v}.png")
        print(f"siege-tile-court-{v}.png {tile.size}")
    if not emit_pieces:
        pass
    tower = None if not emit_pieces else build_corner_tower()
    if tower is not None:
        tower.save(OUT_COMBAT / "siege-piece-tower.png")
        print(f"siege-piece-tower.png {tower.size}")
    if emit_pieces:
        gate_piece = build_gate_piece(random.Random(SEED + 17))
        gate_piece.save(OUT_COMBAT / "siege-piece-gate.png")
        print(f"siege-piece-gate.png {gate_piece.size}")
        arrow_tower = build_arrow_tower()
        arrow_tower.save(OUT_COMBAT / "siege-piece-arrow-tower.png")
        print(f"siege-piece-arrow-tower.png {arrow_tower.size}")

    layout = {
        "scale": S,
        "scene": {"x0": SCENE_X0, "y0": SCENE_Y0, "w": SCENE_W, "h": SCENE_H},
        "wallX": round(WALL_X, 2),
        "piece": {
            "w": round(COURT_TILE_W, 2),
            "hAbove": round(WALL_H + COURT_TILE_H / 2, 2),
            "hBelow": round(COURT_TILE_H / 2, 2),
        },
        "moatStrip": {"x0": round(MOAT_STRIP_X0, 2), "y0": SCENE_Y0},
        "courtTile": {"w": round(COURT_TILE_W, 2), "h": round(COURT_TILE_H, 2)},
        "gate": {
            "x": round(GATE_X, 2),
            "yBottom": round(GATE_Y_BOTTOM, 2),
            "w": round(COURT_TILE_W + HEX_W / 2, 2),
            "h": round(GATE_WALL_H + COURT_TILE_H + Y_STEP, 2),
        },
        "towers": [
            {"x": round(cx(WALL_COL, 1), 2), "y": round(cy(-0.9), 2), "h": 92.0},
            {"x": round(cx(WALL_COL, 0), 2), "y": round(cy(ROWS - 1 + 0.9), 2), "h": 92.0},
        ],
    }
    # Kit PEINT présent : les dimensions piece/gate appartiennent à
    # l'extracteur (elles suivent l'art déposé) — on les préserve.
    layout_path = OUT_LAYOUT / "siege-scene.json"
    if not emit_pieces and layout_path.exists():
        prev = json.loads(layout_path.read_text())
        for k in ("piece", "gate", "towers"):
            if k in prev:
                layout[k] = prev[k]
    layout_path.write_text(json.dumps(layout, indent=2) + "\n")
    print("layouts/siege-scene.json")


if __name__ == "__main__":
    main()
