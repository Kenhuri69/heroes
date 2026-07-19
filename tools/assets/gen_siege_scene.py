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
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

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

# Pièce de rempart (board-space) : bande STRICTEMENT PÉRIODIQUE (période =
# Y_STEP, hauteur du canvas = 1 période, ancrée au centre de rangée) — les
# raccords entre rangées sont invisibles PAR CONSTRUCTION (itération 5 : fini
# l'effet « tourelles empilées » des segments à chapiteau crénelé).
# Lecture oblique cohérente avec le plateau : face OUEST éclairée (côté
# assaillant), ligne de créneaux continue, chemin de ronde, parapet est +
# ombre portée sur la cour.
PIECE_W = 56.0  # largeur du canvas
PIECE_H_ABOVE = Y_STEP / 2
PIECE_H_BELOW = Y_STEP / 2
# Bande du rempart (dans le canvas, centrée) : x relatifs au bord ouest.
BAND_W = 46.0
BAND_FACE_W = 12.0  # face ouest (maçonnerie éclairée)
BAND_TEETH_W = 8.0  # ligne de créneaux (dents périodiques)
BAND_WALK_W = 20.0  # chemin de ronde (dalles)
BAND_LIP_W = 3.0  # parapet intérieur (est)
TEETH_PER_PERIOD = 3


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


# --- Pièces de rempart (sprites par rangée, période Y_STEP) ---


def gate_art() -> Image.Image:
    return Image.open(OUT_COMBAT / "siege-gate.png").convert("RGBA")


def make_vtile(im: Image.Image) -> Image.Image:
    """Rend une texture TUILABLE verticalement (roll + fondu des bords) — les
    pièces de rempart empilées se raccordent alors sans couture."""
    w, h = im.size
    rolled = Image.new("RGB", (w, h))
    rolled.paste(im.crop((0, h // 2, w, h)), (0, 0))
    rolled.paste(im.crop((0, 0, w, h // 2)), (0, h - h // 2))
    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    edge = max(1, h // 4)
    for y in range(h):
        dist = min(y, h - 1 - y)
        md.line([(0, y), (w, y)], fill=int(255 * min(1.0, dist / edge)))
    out = rolled.copy()
    out.paste(im, (0, 0), mask)
    return out


def face_strip(face_src: Image.Image, face_w: int, height: int) -> Image.Image:
    """Empile la texture de face avec chevauchements fondus (pas de couture)."""
    tile = face_src.convert("RGB").resize((face_w, img_px(22)), Image.LANCZOS)
    flip = tile.transpose(Image.FLIP_LEFT_RIGHT)
    fade = Image.new("L", tile.size, 255)
    fd = ImageDraw.Draw(fade)
    ov = tile.height // 3
    for i in range(ov):
        fd.line([(0, i), (tile.width, i)], fill=int(255 * i / ov))
    strip = Image.new("RGB", (face_w, height))
    step = tile.height - ov
    for k, ty in enumerate(range(0, height + step, step)):
        t = tile if k % 2 == 0 else flip
        strip.paste(t, (0, ty), fade if ty > 0 else None)
    return strip


def build_band_period(rng: random.Random) -> Image.Image:
    """UNE période (Y_STEP) de la bande de rempart, périodique en Y — toute
    pièce est une fenêtre de ce motif ⇒ l'empilement par rangée est sans
    couture quel que soit l'état des voisins (itération 5 : fini l'effet
    « tourelles empilées »). Lecture : **façade continue pleine masse**
    (maçonnerie peinte raccordée verticalement) avec **crête crénelée courant
    le long du bord ouest** (la ligne de bataille du rempart, côté assaillant)
    et ombre portée sur la cour à l'est."""
    gate = gate_art()
    gw, gh = gate.size
    face_src = gate.crop((int(gw * 0.05), int(gh * 0.56), int(gw * 0.245), int(gh * 0.75))).convert("RGB")

    w_img, p_img = img_px(PIECE_W), img_px(Y_STEP)
    band = Image.new("RGBA", (w_img, p_img), (0, 0, 0, 0))
    d = ImageDraw.Draw(band)
    bx0 = img_px((PIECE_W - BAND_W) / 2)
    band_w = img_px(BAND_W)

    # 1. FAÇADE continue : maçonnerie peinte tuilable (aucune couture entre
    #    rangées), pleine masse. Modelé : éclairée côté ouest, s'assombrit en
    #    s'enroulant vers la cour.
    face = make_vtile(face_src.resize((band_w, p_img), Image.LANCZOS))
    band.paste(face, (bx0, 0))
    shade = Image.new("L", (band_w, 1))
    for i in range(band_w):
        t = i / band_w
        shade.putpixel((i, 0), int(18 + 92 * max(0.0, t - 0.35) / 0.65))
    shade = shade.resize((band_w, p_img))
    dark_col = Image.new("RGBA", (band_w, p_img), (22, 20, 17, 255))
    dark_col.putalpha(shade)
    band.paste(Image.alpha_composite(band.crop((bx0, 0, bx0 + band_w, p_img)), dark_col), (bx0, 0))
    # Arête ouest éclairée (contact avec la lumière du champ).
    d.rectangle([bx0, 0, bx0 + 2 * S, p_img], fill=(206, 200, 186, 120))

    # 2. CRÊTE CRÉNELÉE le long du bord ouest : merlons périodiques en léger
    #    surplomb (la ligne de bataille du rempart), embrasures sombres entre
    #    les dents laissant voir la façade.
    tooth_h = p_img / TEETH_PER_PERIOD
    tw_ = img_px(9.0)  # profondeur de la crête
    tx0 = bx0 - img_px(3.0)  # léger débord côté champ
    for k in range(TEETH_PER_PERIOD):
        ty = int(k * tooth_h + tooth_h * 0.10)
        tb = int(k * tooth_h + tooth_h * 0.68)
        # Merlon : bloc clair, chant supérieur éclairé, chant droit en ombre.
        d.rounded_rectangle([tx0, ty, tx0 + tw_, tb], radius=S, fill=(170, 165, 152, 255))
        d.rectangle([tx0, ty, tx0 + tw_, ty + max(1, int((tb - ty) * 0.28))], fill=(204, 199, 186, 255))
        d.rectangle([tx0 + tw_ - 2 * S, ty + S, tx0 + tw_, tb], fill=(104, 99, 90, 255))
        d.rectangle([tx0, tb - S, tx0 + tw_, tb], fill=(84, 79, 70, 255))
        # Ombre du merlon sur la façade (accroche la crête au mur).
        d.rectangle([tx0 + tw_, ty + 2 * S, tx0 + tw_ + 2 * S, tb + 2 * S], fill=(30, 27, 23, 90))
    # Fine lisse d'appui continue reliant les merlons (parapet).
    d.rectangle([tx0 + int(tw_ * 0.25), 0, tx0 + int(tw_ * 0.55), p_img], fill=(148, 143, 132, 255))
    d.rectangle([tx0 + int(tw_ * 0.25), 0, tx0 + int(tw_ * 0.33), p_img], fill=(184, 179, 166, 255))

    # 3. Ombre portée du rempart sur la cour (est) — assoit la masse.
    sh_w = img_px(7.0)
    for i in range(sh_w):
        a = int(96 * (1 - i / sh_w))
        d.rectangle([bx0 + band_w + i, 0, bx0 + band_w + i + 1, p_img], fill=(10, 10, 8, a))

    return band


def build_wall_piece(rng: random.Random, state: str, variant: int = 1) -> Image.Image:
    """Pièce de rempart d'UNE rangée = une fenêtre (1 période) de la bande
    périodique ; `state` : intact | cracked | razed. `variant` conservé pour
    compat d'appel (la bande périodique n'a plus besoin de variantes)."""
    del variant
    piece = build_band_period(rng)
    w_img, h_img = piece.size

    if state == "cracked":
        cd = ImageDraw.Draw(piece)
        cx0, cy0 = int(w_img * 0.52), int(h_img * 0.5)
        for k in range(5):
            ang = (k * 73 + 20) % 360 * math.pi / 180
            ln = w_img * (0.22 + (k * 17 % 5) / 14)
            px, py = cx0, cy0
            for s_ in range(1, 4):
                jit = ((k + s_) * 41 % 10 - 5) * 0.9 * S
                nx = cx0 + math.cos(ang) * ln * s_ / 3 + jit
                ny = cy0 + math.sin(ang) * ln * s_ / 3
                cd.line([px, py, nx, ny], fill=(26, 22, 18, 220), width=max(1, S))
                px, py = nx, ny
        dark = Image.new("RGBA", (w_img, h_img), (0, 0, 0, 0))
        dd = ImageDraw.Draw(dark)
        dd.ellipse([cx0 - 15 * S, cy0 - 10 * S, cx0 + 15 * S, cy0 + 10 * S], fill=(30, 24, 18, 80))
        piece = Image.alpha_composite(piece, dark.filter(ImageFilter.GaussianBlur(3 * S)))

    if state == "razed":
        # Brèche : la bande est PERCÉE (trou d'alpha déchiqueté sur ~70 % de la
        # période), arases brisées claires sur les lèvres, gravats en tas qui
        # débordent côté assaillant.
        bx0 = img_px((PIECE_W - BAND_W) / 2)
        band_w = img_px(BAND_W)
        hole = Image.new("L", (w_img, h_img), 0)
        hd = ImageDraw.Draw(hole)
        y0, y1 = int(h_img * 0.14), int(h_img * 0.86)
        pts: list[tuple[int, int]] = []
        for x in range(bx0 - 2 * S, bx0 + band_w + 2 * S, 3 * S):
            pts.append((x, y0 + rng.randint(-int(h_img * 0.08), int(h_img * 0.08))))
        for x in range(bx0 + band_w + 2 * S, bx0 - 2 * S, -3 * S):
            pts.append((x, y1 + rng.randint(-int(h_img * 0.08), int(h_img * 0.08))))
        hd.polygon(pts, fill=255)
        alpha = piece.split()[3]
        alpha = Image.composite(Image.new("L", alpha.size, 0), alpha, hole)
        piece.putalpha(alpha)
        jag = ImageDraw.Draw(piece)
        # Lèvres de pierre brisée le long du trou (haut et bas).
        for edge_y, sign in ((y0, -1), (y1, 1)):
            px = bx0
            while px < bx0 + band_w:
                step_w = rng.randint(3 * S, 7 * S)
                hgt = rng.randint(S, 5 * S)
                ey = edge_y + sign * rng.randint(-int(h_img * 0.06), int(h_img * 0.06))
                jag.rectangle([px, ey - hgt, px + step_w, ey + hgt], fill=(146, 140, 128, 255))
                jag.rectangle([px, ey - hgt, px + max(1, step_w // 3), ey], fill=(182, 176, 162, 255))
                px += step_w
        # Gravats : tas dense au centre, débord côté ouest (assaillant).
        for k in range(52):
            spread = rng.random()
            gx = bx0 + int(band_w * (0.15 + 0.7 * rng.random())) - (img_px(8) if spread < 0.3 else 0)
            gy = int(h_img * 0.25) + int(rng.random() * h_img * 0.5)
            sz = rng.randint(3 * S, 8 * S) if spread > 0.3 else rng.randint(5 * S, 10 * S)
            tone = rng.choice([(150, 144, 130), (128, 120, 104), (168, 160, 140), (108, 102, 92)])
            jag.rounded_rectangle([gx, gy, gx + sz, gy + int(sz * 0.75)], radius=S, fill=(*tone, 255), outline=(66, 60, 52, 220), width=1)
            jag.rectangle([gx, gy, gx + max(1, sz // 3), gy + max(1, int(sz * 0.3))], fill=(196, 190, 174, 255))

    return piece




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


def recolor_scene_tower() -> Image.Image:
    """Tour d'extrémité recolorée dans la pierre GRISE du gatehouse (l'art
    `siege-tower.png` est crème — il jurait avec les pièces de mur). Le modelé
    peint est conservé (désaturation + refroidissement), l'alpha intact."""
    src = Image.open(OUT_COMBAT / "siege-tower.png").convert("RGBA")
    alpha = src.split()[3]
    rgb = src.convert("RGB")
    rgb = ImageEnhance.Color(rgb).enhance(0.3)
    rgb = ImageEnhance.Brightness(rgb).enhance(0.88)
    arr = np.asarray(rgb, dtype=np.float32)
    arr[..., 0] *= 0.94  # refroidit : moins de rouge, un peu plus de bleu
    arr[..., 1] *= 0.97
    arr[..., 2] *= 1.04
    out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
    out.putalpha(alpha)
    return out


def build_arrow_tower() -> Image.Image:
    """TOUR DE TIR dédiée (itération 5) : tour de pierre grise + BALISTE peinte
    montée sur la plateforme, pointée vers l'assaillant — on voit l'arme qui
    tire, ce n'est plus une tour d'extrémité copiée-collée. La couronne de
    créneaux est re-composée DEVANT la baliste (l'engin est posé dans la
    plateforme, pas dessus)."""
    tower = recolor_scene_tower()
    tw, th = tower.size
    ball = Image.open(ASSETS / "units" / "core" / "ballista.png").convert("RGBA")
    bw = int(tw * 0.92)
    bh = int(bw * ball.height / ball.width)
    ball = ball.resize((bw, bh), Image.LANCZOS)
    # Légère mise à l'ombre : l'engin est en retrait derrière les merlons.
    arr = np.asarray(ball.convert("RGB"), dtype=np.float32) * 0.94
    shaded = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
    shaded.putalpha(ball.split()[3])

    head = int(bh * 0.62)  # dépassement de la baliste au-dessus de la couronne
    canvas = Image.new("RGBA", (tw, th + head), (0, 0, 0, 0))
    canvas.paste(tower, (0, head), tower)
    # Baliste : assise sur la plateforme (sous la ligne de couronne).
    platform_y = head + int(th * 0.115)
    canvas.paste(shaded, ((tw - bw) // 2, platform_y - bh, ), shaded)
    # Couronne re-superposée : les merlons passent DEVANT le châssis.
    crown = tower.crop((0, 0, tw, int(th * 0.16)))
    canvas.paste(crown, (0, head), crown)
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

# Porte (retour porteur itération 3 : « pas calée dans le bon sens ») : le
# gatehouse frontal étalé EN TRAVERS du mur jurait — l'enceinte court
# verticalement, la porte doit s'insérer DANS son axe. La porte devient une
# **pièce de courtine verticale double hauteur** (rangées 4–5) : même
# appareil/merlons que les pièces de mur, ARCHE + vantaux de l'art peint
# incrustés dans la face, à peine plus large que la courtine.
GATE_PIECE_W = 72.0
GATE_PIECE_FACE_W = 56.0
# Hauteur PROPRE (billboard) : le gatehouse s'élève au-dessus de la bande de
# rempart basse — ne dérive plus des demi-hauteurs de pièce.
GATE_PIECE_H = 100.0
GATE_X = WALL_X
GATE_Y_BOTTOM = cy(GATE_ROWS[1]) + PIECE_H_BELOW


def build_gate_piece(rng: random.Random) -> Image.Image:
    """Segment de porte VERTICAL : courtine double hauteur percée de l'arche
    peinte (vantaux + herse du gatehouse), empilable entre les pièces des
    rangées 3 et 6 — la porte suit enfin l'axe du mur."""
    gate = gate_art()
    gw, gh = gate.size
    crenel_src = gate.crop((int(gw * 0.055), int(gh * 0.02), int(gw * 0.27), int(gh * 0.145)))
    face_src = gate.crop((int(gw * 0.05), int(gh * 0.56), int(gw * 0.245), int(gh * 0.75)))
    arch_src = gate.crop((int(gw * 0.335), int(gh * 0.285), int(gw * 0.665), int(gh * 0.965)))

    w_img, h_img = img_px(GATE_PIECE_W), img_px(GATE_PIECE_H)
    piece = Image.new("RGBA", (w_img, h_img), (0, 0, 0, 0))
    face_w = img_px(GATE_PIECE_FACE_W)
    fx0 = (w_img - face_w) // 2

    crenel_h = img_px(12)
    strip = face_strip(face_src, face_w, h_img - crenel_h)
    piece.paste(strip, (fx0, crenel_h))
    crenel = crenel_src.resize((face_w + 6 * S, crenel_h + 2 * S), Image.LANCZOS)
    piece.paste(crenel, (fx0 - 3 * S, 0), crenel)

    # Arche + vantaux incrustés dans la face (bas de la pièce = seuil).
    arch_w = img_px(46.0)
    arch_h = int(arch_w * arch_src.height / arch_src.width)
    arch = arch_src.resize((arch_w, arch_h), Image.LANCZOS)
    ax = (w_img - arch_w) // 2
    ay = h_img - arch_h - img_px(3)
    piece.paste(arch, (ax, ay), arch)

    # Volume : arête éclairée / ombre latérale / AO au seuil (comme les pièces).
    overlay = Image.new("RGBA", (w_img, h_img), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rectangle([fx0, crenel_h, fx0 + int(face_w * 0.1), h_img], fill=(255, 250, 230, 34))
    od.rectangle([fx0 + int(face_w * 0.84), crenel_h, fx0 + face_w, h_img], fill=(24, 22, 18, 68))
    for i in range(img_px(5)):
        a = int(80 * (1 - i / img_px(5)))
        od.line([(fx0, h_img - 1 - i), (fx0 + face_w, h_img - 1 - i)], fill=(20, 18, 14, a))
    return Image.alpha_composite(piece, overlay)


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

    for state in ("intact", "cracked", "razed"):
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
    tower = recolor_scene_tower()
    tower.save(OUT_COMBAT / "siege-piece-tower.png")
    print(f"siege-piece-tower.png {tower.size}")
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
        "piece": {"w": PIECE_W, "hAbove": PIECE_H_ABOVE, "hBelow": PIECE_H_BELOW},
        "moatStrip": {"x0": round(MOAT_STRIP_X0, 2), "y0": SCENE_Y0},
        "courtTile": {"w": round(COURT_TILE_W, 2), "h": round(COURT_TILE_H, 2)},
        "gate": {
            "x": round(GATE_X, 2),
            "yBottom": round(GATE_Y_BOTTOM, 2),
            "w": GATE_PIECE_W,
            "h": round(GATE_PIECE_H, 2),
        },
        "towers": [
            {"x": round(WALL_X + 2, 2), "y": round(cy(-0.8), 2), "h": 76.0},
            {"x": round(WALL_X + 2, 2), "y": round(cy(ROWS - 1 + 0.8), 2), "h": 76.0},
        ],
    }
    (OUT_LAYOUT / "siege-scene.json").write_text(json.dumps(layout, indent=2) + "\n")
    print("layouts/siege-scene.json")


if __name__ == "__main__":
    main()
