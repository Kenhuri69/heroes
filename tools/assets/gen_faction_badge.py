#!/usr/bin/env python3
"""
gen_faction_badge.py — Blasons de faction procéduraux (écus héraldiques).

Comble le trou d'identité relevé sur l'écran de ville : faute d'asset, le
`FactionBadge` client ne rendait qu'un **motif géométrique** (repli a11y non
chromatique) — d'où le « dé » générique pour Havre. Ce script produit un vrai
**écu** peint procéduralement, déterministe (formes vectorielles fixes → re-run
= octets identiques), dans le style « laiton & parchemin » du doc 08 §5.

Le client consomme `assets/badges/<factionId>.png` via le registre auto-découvert
(doc 12 §10) ; l'absence d'asset retombe proprement sur le motif SVG (a11y §4).
Aucune faction n'est connue du moteur/client : la clé `<factionId>` est opaque.

Familles de couleurs par faction (doc 03/04/05…) : ici **Havre** — bleu roi,
or, blanc ; thème lumière/ordre/foi (Saint-Empire du Griffon) → charge = soleil
héraldique rayonnant.

Sortie : assets/badges/haven.png (256², RGBA transparent hors écu).
Usage  : python3 tools/assets/gen_faction_badge.py
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

REPO = Path(__file__).resolve().parent.parent.parent
OUT = REPO / "assets" / "badges"

SIZE = 256          # taille finale
SS = 4              # supersampling (bords lisses) → travail à 1024²

# — Rampe laiton (identique à gen_chrome.py) + bleu roi Havre + parchemin —
INK = (14, 16, 22, 255)
BRASS_DARK = (110, 90, 42, 255)
BRASS_MID = (168, 134, 60, 255)
BRASS_LITE = (216, 180, 90, 255)
BRASS_HILITE = (239, 216, 138, 255)
PARCHMENT = (232, 226, 208, 255)


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


def _radiant_sun(d, cx, cy, r, rays=12):
    """Soleil héraldique : rayons triangulaires + disque, or biseauté."""
    # Rayons (pointes alternées longues/courtes pour le rythme héraldique).
    for k in range(rays):
        a = (k / rays) * 2 * math.pi
        rr = r * (2.05 if k % 2 == 0 else 1.7)
        wa = 0.24
        tip = (cx + rr * math.cos(a), cy + rr * math.sin(a))
        b1 = (cx + r * 0.92 * math.cos(a - wa), cy + r * 0.92 * math.sin(a - wa))
        b2 = (cx + r * 0.92 * math.cos(a + wa), cy + r * 0.92 * math.sin(a + wa))
        d.polygon([b1, tip, b2], fill=BRASS_LITE)
    # Disque central : encre (contour) → or → rehaut.
    d.ellipse([cx - r - 3, cy - r - 3, cx + r + 3, cy + r + 3], fill=INK)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BRASS_MID)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=BRASS_DARK, width=4)
    d.ellipse([cx - r * 0.62, cy - r * 0.66, cx + r * 0.5, cy + r * 0.42],
              fill=BRASS_HILITE)


def build_haven() -> Image.Image:
    w = h = SIZE * SS
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    poly = _shield_polygon(w, h)

    # Ombre portée douce (détache l'écu du fond de l'en-tête).
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).polygon([(x, y + 10 * SS) for x, y in poly],
                                   fill=(0, 0, 0, 150))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(9 * SS)))

    # Champ bleu roi : dégradé vertical (clair en haut → profond en bas) via un
    # masque en forme d'écu.
    field = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    fd = ImageDraw.Draw(field)
    top_blue, bot_blue = (58, 96, 196, 255), (24, 44, 120, 255)
    for y in range(h):
        fd.line([(0, y), (w, y)], fill=_lerp(top_blue, bot_blue, y / h))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)
    img.paste(field, (0, 0), mask)

    # Chef (bande haute) plus clair : évoque le blanc héraldique de Havre.
    chef = [(0.09, 0.07), (0.91, 0.07), (0.91, 0.20), (0.09, 0.20)]
    chef_px = [(nx * w, ny * h) for nx, ny in chef]
    chef_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(chef_img).polygon(chef_px, fill=(214, 224, 244, 46))
    img.alpha_composite(chef_img)

    # Bordure : lit d'encre + double filet laiton (biseau) le long du contour.
    d.line(poly + [poly[0]], fill=INK, width=14 * SS, joint="curve")
    d.line(poly + [poly[0]], fill=BRASS_MID, width=9 * SS, joint="curve")
    d.line(poly + [poly[0]], fill=BRASS_LITE, width=3 * SS, joint="curve")

    # Charge : soleil rayonnant, centré un peu haut sur le champ.
    _radiant_sun(d, w * 0.5, h * 0.46, r=w * 0.16)

    return img.resize((SIZE, SIZE), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    build_haven().save(OUT / "haven.png")
    print(f"écrit {OUT / 'haven.png'}")


if __name__ == "__main__":
    main()
