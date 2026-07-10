#!/usr/bin/env python3
"""
gen_faction_badge.py — Blasons de faction procéduraux (écus héraldiques).

Comble le trou d'identité relevé sur l'écran de ville : faute d'asset, le
`FactionBadge` client ne rendait qu'un **motif géométrique** (repli a11y non
chromatique) — d'où le « dé » générique. Ce script produit un vrai **écu** peint
procéduralement, déterministe (formes vectorielles fixes → re-run = octets
identiques), dans le style « laiton & parchemin » du doc 08 §5.

Le client consomme `assets/badges/<factionId>.png` via le registre auto-découvert
(doc 12 §10) ; l'absence d'asset retombe proprement sur le motif SVG (a11y §4).
Aucune faction n'est connue du moteur/client : la clé `<factionId>` est opaque.

Chaque faction est une **recette** (champ, bordure or/argent, charge héraldique)
dérivée de son identité (doc 03/04/05/14/16) :
  - haven          bleu roi / or        → soleil rayonnant (lumière, Griffon)
  - necropolis     noir·os / vert spectral → crâne (morts-vivants, Heresh)
  - arcane-hunters violet nuit / argent → flèche de traque + anneau runique
  - sylvan-court   verts·ambre / or     → feuille (motif de bannière, doc 14)
  - vox-arcana     noir·violet / or·néon → croissant (honmoon) + étoile (scène)
`test-faction` reste sur le motif procédural (placeholder assumé, doc 12 §2.3).

Sortie : assets/badges/<id>.png (256², RGBA transparent hors écu).
Usage  : python3 tools/assets/gen_faction_badge.py [--only haven,necropolis]
"""

from __future__ import annotations

import argparse
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from PIL import Image, ImageDraw, ImageFilter

REPO = Path(__file__).resolve().parent.parent.parent
OUT = REPO / "assets" / "badges"

SIZE = 256          # taille finale
SS = 4              # supersampling (bords lisses) → travail à 1024²

INK = (14, 16, 22, 255)

# Rampes de bordure (biseau) — laiton (or) et argent terni.
BRASS = {"dark": (110, 90, 42, 255), "mid": (168, 134, 60, 255),
         "lite": (216, 180, 90, 255), "hilite": (239, 216, 138, 255)}
SILVER = {"dark": (86, 92, 100, 255), "mid": (150, 158, 168, 255),
          "lite": (202, 210, 220, 255), "hilite": (236, 242, 248, 255)}


def _lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def _quad(p0, p1, p2, n):
    """Échantillonne une Bézier quadratique (p0→p2, contrôle p1) en n points."""
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0]
        y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]
        pts.append((x, y))
    return pts


def _shield_polygon(w, h):
    """Contour d'un écu « heater » (haut droit, flancs courbes → pointe basse)."""
    def P(nx, ny):
        return (nx * w, ny * h)

    tl, tr = P(0.09, 0.07), P(0.91, 0.07)
    rs, ls = P(0.91, 0.44), P(0.09, 0.44)
    tip = P(0.50, 0.95)
    right = _quad(rs, P(0.90, 0.80), tip, 40)      # flanc droit → pointe
    left = _quad(tip, P(0.10, 0.80), ls, 40)       # pointe → flanc gauche
    return [tl, tr, *right, *left]


# ————————————————————————— charges héraldiques —————————————————————————
# Signature commune : charge(img, d, cx, cy, r, ramp). `img` sert aux charges
# à masque (croissant) ; `ramp` fournit le métal (or/argent) de la faction.

def _sun(img, d, cx, cy, r, ramp):
    """Soleil rayonnant : rayons triangulaires alternés + disque biseauté."""
    for k in range(12):
        a = (k / 12) * 2 * math.pi
        rr = r * (2.05 if k % 2 == 0 else 1.7)
        tip = (cx + rr * math.cos(a), cy + rr * math.sin(a))
        b1 = (cx + r * 0.92 * math.cos(a - 0.24), cy + r * 0.92 * math.sin(a - 0.24))
        b2 = (cx + r * 0.92 * math.cos(a + 0.24), cy + r * 0.92 * math.sin(a + 0.24))
        d.polygon([b1, tip, b2], fill=ramp["lite"])
    d.ellipse([cx - r - 3, cy - r - 3, cx + r + 3, cy + r + 3], fill=INK)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ramp["mid"])
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=ramp["dark"], width=4)
    d.ellipse([cx - r * 0.62, cy - r * 0.66, cx + r * 0.5, cy + r * 0.42], fill=ramp["hilite"])


def _skull(img, d, cx, cy, r, ramp):
    """Crâne : crâne bombé + mâchoire, orbites d'encre, liseré vert spectral."""
    spectral = (120, 196, 128, 255)
    bone, bone_hi = (222, 224, 212, 255), (240, 242, 232, 255)
    cy -= r * 0.08
    # Lueur spectrale (halo vert diffus derrière le crâne).
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([cx - r * 1.3, cy - r * 1.4, cx + r * 1.3, cy + r * 1.5],
                                 fill=(*spectral[:3], 120))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(7 * SS)))
    # Crâne bombé + mâchoire (os).
    d.ellipse([cx - r * 0.98, cy - r * 1.08, cx + r * 0.98, cy + r * 0.62], fill=INK)
    d.ellipse([cx - r * 0.9, cy - r, cx + r * 0.9, cy + r * 0.55], fill=bone)
    d.polygon([(cx - r * 0.52, cy + r * 0.30), (cx + r * 0.52, cy + r * 0.30),
               (cx + r * 0.34, cy + r * 1.05), (cx - r * 0.34, cy + r * 1.05)], fill=bone)
    d.ellipse([cx - r * 0.5, cy - r * 0.62, cx + r * 0.5, cy - r * 0.02], fill=bone_hi)  # front
    # Orbites + nez (encre) + dents.
    d.ellipse([cx - r * 0.62, cy - r * 0.18, cx - r * 0.14, cy + r * 0.34], fill=INK)
    d.ellipse([cx + r * 0.14, cy - r * 0.18, cx + r * 0.62, cy + r * 0.34], fill=INK)
    d.polygon([(cx, cy + r * 0.18), (cx - r * 0.14, cy + r * 0.52), (cx + r * 0.14, cy + r * 0.52)], fill=INK)
    for tx in (-0.28, 0, 0.28):
        d.line([(cx + tx * r, cy + r * 0.58), (cx + tx * r, cy + r * 1.0)], fill=INK, width=3 * SS)
    # Liseré spectral (2ᵉ canal vert, renforce l'identité undead).
    d.arc([cx - r * 0.9, cy - r, cx + r * 0.9, cy + r * 0.55], 180, 360, fill=spectral, width=3 * SS)


def _hunt_arrow(img, d, cx, cy, r, ramp):
    """Flèche de traque (pointe bas) sur anneau runique cyan (Arcane Hunters)."""
    rune = (150, 214, 210, 255)
    ring = r * 1.5
    # Anneau + graduations runiques (marques de traque).
    d.ellipse([cx - ring, cy - ring, cx + ring, cy + ring], outline=rune, width=4 * SS)
    for k in range(12):
        a = (k / 12) * 2 * math.pi
        p1 = (cx + (ring - 5 * SS) * math.cos(a), cy + (ring - 5 * SS) * math.sin(a))
        p2 = (cx + (ring + 6 * SS) * math.cos(a), cy + (ring + 6 * SS) * math.sin(a))
        d.line([p1, p2], fill=rune, width=3 * SS)
    # Flèche : hampe + pointe bas + empennes (argent biseauté sur encre).
    d.line([(cx, cy - r * 1.05), (cx, cy + r * 0.55)], fill=INK, width=9 * SS)
    d.line([(cx, cy - r * 1.05), (cx, cy + r * 0.55)], fill=ramp["lite"], width=5 * SS)
    head = [(cx - r * 0.62, cy + r * 0.10), (cx + r * 0.62, cy + r * 0.10), (cx, cy + r * 1.15)]
    d.polygon(head, fill=ramp["mid"])
    d.line(head + [head[0]], fill=ramp["hilite"], width=2 * SS)
    for sgn in (-1, 1):
        d.line([(cx, cy - r * 1.05), (cx + sgn * r * 0.42, cy - r * 0.55)], fill=ramp["mid"], width=5 * SS)


def _leaf(img, d, cx, cy, r, ramp):
    """Feuille héraldique (motif de bannière Sylvan, doc 14) — ambre nervurée."""
    amber, amber_hi, vein = (206, 152, 62, 255), (232, 190, 96, 255), (92, 60, 24, 255)
    top, bot = (cx, cy - r * 1.15), (cx, cy + r * 1.05)
    right = _quad(top, (cx + r * 1.05, cy), bot, 28)
    left = _quad(bot, (cx - r * 1.05, cy), top, 28)
    poly = right + left
    d.polygon(poly, fill=amber)
    d.polygon(right + [top], fill=amber_hi)                      # moitié claire (rehaut)
    d.line(poly + [poly[0]], fill=INK, width=3 * SS, joint="curve")  # contour d'encre
    d.line([top, bot], fill=vein, width=4 * SS)                 # nervure centrale
    for t in (0.28, 0.5, 0.72):                                  # nervures latérales
        my = cy - r * 1.15 + t * (2.2 * r)
        d.line([(cx, my), (cx + r * 0.5 * (1 - t + 0.3), my - r * 0.28)], fill=vein, width=2 * SS)
        d.line([(cx, my), (cx - r * 0.5 * (1 - t + 0.3), my - r * 0.28)], fill=vein, width=2 * SS)
    d.line([bot, (cx, cy + r * 1.35)], fill=vein, width=4 * SS)  # pétiole


def _crescent_star(img, d, cx, cy, r, ramp):
    """Croissant (honmoon) + étoile (scène) — or à liseré néon (Vox Arcana)."""
    neon = (120, 226, 236, 255)
    # Croissant par masque : disque plein moins disque décalé.
    mask = Image.new("L", img.size, 0)
    md = ImageDraw.Draw(mask)
    md.ellipse([cx - r * 1.2, cy - r * 1.2, cx + r * 1.2, cy + r * 1.2], fill=255)
    md.ellipse([cx - r * 0.55, cy - r * 1.25, cx + r * 1.75, cy + r * 0.95], fill=0)
    gold = Image.new("RGBA", img.size, ramp["mid"])
    edge = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(edge).bitmap((0, 0), mask.filter(ImageFilter.MaxFilter(2 * SS + 1)), fill=INK)
    img.alpha_composite(edge)
    img.paste(gold, (0, 0), mask)
    # Étoile à 5 branches (scène/idole), nichée dans la concavité.
    sx, sy, sr = cx + r * 0.62, cy - r * 0.42, r * 0.62
    star = []
    for k in range(10):
        a = -math.pi / 2 + k * math.pi / 5
        rad = sr if k % 2 == 0 else sr * 0.42
        star.append((sx + rad * math.cos(a), sy + rad * math.sin(a)))
    d.polygon(star, fill=ramp["lite"])
    d.line(star + [star[0]], fill=neon, width=2 * SS)


@dataclass
class Recipe:
    field_top: tuple
    field_bot: tuple
    ramp: dict
    charge: Callable
    chef: tuple | None = None          # teinte de chef (bande haute), RGBA ou None
    charge_r: float = 0.16             # rayon de charge (fraction de largeur)
    charge_cy: float = 0.46            # centre vertical de la charge (fraction)


RECIPES: dict[str, Recipe] = {
    "haven": Recipe((58, 96, 196, 255), (24, 44, 120, 255), BRASS, _sun,
                    chef=(214, 224, 244, 46)),
    "necropolis": Recipe((52, 58, 60, 255), (16, 18, 22, 255), SILVER, _skull,
                         chef=(120, 196, 128, 30), charge_r=0.155, charge_cy=0.45),
    "arcane-hunters": Recipe((66, 44, 104, 255), (26, 18, 54, 255), SILVER, _hunt_arrow,
                             chef=(150, 214, 210, 34), charge_r=0.15, charge_cy=0.44),
    "sylvan-court": Recipe((40, 92, 56, 255), (14, 44, 28, 255), BRASS, _leaf,
                           chef=(210, 190, 96, 40), charge_r=0.155, charge_cy=0.45),
    "vox-arcana": Recipe((52, 34, 84, 255), (18, 12, 32, 255), BRASS, _crescent_star,
                         chef=(180, 130, 220, 40), charge_r=0.16, charge_cy=0.46),
}


def build_badge(rec: Recipe) -> Image.Image:
    w = h = SIZE * SS
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    poly = _shield_polygon(w, h)

    # Ombre portée douce (détache l'écu du fond de l'en-tête).
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).polygon([(x, y + 10 * SS) for x, y in poly], fill=(0, 0, 0, 150))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(9 * SS)))

    # Champ : dégradé vertical (clair en haut → profond en bas) masqué à l'écu.
    field_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    fd = ImageDraw.Draw(field_img)
    for y in range(h):
        fd.line([(0, y), (w, y)], fill=_lerp(rec.field_top, rec.field_bot, y / h))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)
    img.paste(field_img, (0, 0), mask)

    # Chef (bande haute) : rappel de la 2ᵉ couleur héraldique de la faction.
    if rec.chef:
        chef_px = [(nx * w, ny * h) for nx, ny in
                   ((0.09, 0.07), (0.91, 0.07), (0.91, 0.20), (0.09, 0.20))]
        chef_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(chef_img).polygon(chef_px, fill=rec.chef)
        img.alpha_composite(chef_img)

    # Charge héraldique (propre à la faction).
    rec.charge(img, d, w * 0.5, h * rec.charge_cy, w * rec.charge_r, rec.ramp)

    # Bordure : lit d'encre + double filet métal (biseau) le long du contour.
    d.line(poly + [poly[0]], fill=INK, width=14 * SS, joint="curve")
    d.line(poly + [poly[0]], fill=rec.ramp["mid"], width=9 * SS, joint="curve")
    d.line(poly + [poly[0]], fill=rec.ramp["lite"], width=3 * SS, joint="curve")

    return img.resize((SIZE, SIZE), Image.LANCZOS)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="liste d'ids séparés par des virgules")
    args = ap.parse_args()
    ids = args.only.split(",") if args.only else list(RECIPES)
    OUT.mkdir(parents=True, exist_ok=True)
    for fid in ids:
        rec = RECIPES.get(fid)
        if not rec:
            print(f"⚠ recette inconnue : {fid}")
            continue
        build_badge(rec).save(OUT / f"{fid}.png")
        print(f"écrit {OUT / (fid + '.png')}")


if __name__ == "__main__":
    main()
