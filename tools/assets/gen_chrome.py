#!/usr/bin/env python3
"""
gen_chrome.py — Chrome décoratif d'UI procédural (cadres & rubans) pour Heroes.

Comble le trou d'identité : l'UI interactive (panneaux, en-têtes) était plate/
tokenisée alors que l'art plein cadre porte la gouache. Ce script génère
l'habillage — un **cadre 9-slice** et un **ruban d'en-tête 3-slice** — dans le
style « laiton & parchemin » du doc 08 §5, à appliquer via CSS `border-image`.

Règle G de docs/12-assets-style-guide.md :
  - déterministe (aucun aléa : formes vectorielles fixes → re-run = octets
    identiques) ;
  - découpe **9-slice** : les bords (entre coins) ont une section CONSTANTE
    pour se répéter sans couture ; les coins portent l'ornement ;
  - rampe laiton propre au script (les .css restent aux tokens — le garde-fou
    couleurs ne vise que les feuilles de style).

Sortie : assets/ui/chrome/panel-frame.png (160², slice 40),
         assets/ui/chrome/ribbon.png (320×72, slice horiz. 72),
         assets/ui/chrome/_preview.png (rendu témoin sur fond sombre).

Usage : python3 tools/assets/gen_chrome.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parent.parent.parent
OUT = REPO / "assets" / "ui" / "chrome"

# — Rampe laiton (brass) + encre + parchemin (gouache sombre, doc 08 §5) —
INK = (16, 18, 24, 255)          # --ink-950
INK_SOFT = (28, 30, 37, 255)     # --ink-800 (lit de bande)
BRASS_DARK = (110, 90, 42, 255)
BRASS_MID = (168, 134, 60, 255)
BRASS_LITE = (216, 180, 90, 255)
BRASS_HILITE = (239, 216, 138, 255)
PARCHMENT = (232, 226, 208, 255)


def _canvas(w: int, h: int):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def _inset_rect(d: ImageDraw.ImageDraw, box, color, width):
    """Rectangle non rempli (profil constant → bords 9-slice répétables)."""
    x0, y0, x1, y1 = box
    d.rectangle([x0, y0, x1, y1], outline=color, width=width)


def _corner_stud(d: ImageDraw.ImageDraw, cx, cy, r):
    """Rivet ornemental de coin : disque laiton biseauté (encre + rehaut)."""
    d.ellipse([cx - r - 2, cy - r - 2, cx + r + 2, cy + r + 2], fill=INK)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BRASS_MID)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=BRASS_DARK, width=2)
    d.ellipse([cx - r + 3, cy - r + 3, cx + r - 6, cy + r - 6], fill=BRASS_HILITE)


def build_frame() -> Image.Image:
    """Cadre 9-slice 160², slice 40 : rails laiton continus + rivets de coin.

    Les 4 bords sont des rectangles à section constante (double rail laiton sur
    lit d'encre) → répétables. Les coins (40²) portent les rivets ; le centre
    reste transparent (le fond tokenisé du panneau transparaît)."""
    S = 160
    img, d = _canvas(S, S)
    # Lit d'encre externe (donne du corps au cadre, sépare du fond).
    _inset_rect(d, (2, 2, S - 3, S - 3), INK, 4)
    # Double rail laiton (clair dessus, sombre dessous = léger biseau).
    _inset_rect(d, (8, 8, S - 9, S - 9), BRASS_LITE, 3)
    _inset_rect(d, (13, 13, S - 14, S - 14), BRASS_DARK, 3)
    # Filet interne encre (ferme la bande vers le centre transparent).
    _inset_rect(d, (20, 20, S - 21, S - 21), INK_SOFT, 3)
    # Rivets de coin (dans les blocs 40² fixes du 9-slice).
    for cx, cy in ((20, 20), (S - 20, 20), (20, S - 20), (S - 20, S - 20)):
        _corner_stud(d, cx, cy, 8)
    return img


def build_ribbon() -> Image.Image:
    """Ruban d'en-tête 320×72, slice horizontal 72 (caps + milieu répétable).

    Milieu : barre laiton à face parchemin, rails haut/bas à profil vertical
    constant → répétable horizontalement. Caps : extrémités en pointe (fanion)."""
    W, H = 320, 72
    img, d = _canvas(W, H)
    top, bot = 12, H - 12
    # Barre centrale à face ENCRE (le texte clair de l'en-tête y reste lisible)
    # + rails laiton haut/bas — profil vertical constant → répétable horiz.
    d.rectangle([0, top, W, bot], fill=INK)
    d.rectangle([0, top + 3, W, bot - 3], fill=INK_SOFT)
    d.rectangle([0, top, W, top + 3], fill=BRASS_LITE)
    d.rectangle([0, bot - 3, W, bot], fill=BRASS_DARK)
    # Caps « fanion » (dans les blocs de 72 px fixes du 3-slice horizontal).
    for side in (0, 1):
        x = 0 if side == 0 else W
        sgn = 1 if side == 0 else -1
        # Triangle d'extrémité laiton + pointe encre.
        d.polygon([(x, 0), (x + sgn * 40, H // 2), (x, H)], fill=BRASS_MID)
        d.polygon([(x, 6), (x + sgn * 30, H // 2), (x, H - 6)], fill=BRASS_DARK)
        _corner_stud(d, x + sgn * 20, H // 2, 7)
    return img


def _mipless_save(img: Image.Image, name: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / name)


def build_preview(frame: Image.Image, ribbon: Image.Image) -> Image.Image:
    """Rendu témoin : le cadre étiré autour d'un panneau sombre + le ruban."""
    W, H = 420, 320
    img = Image.new("RGBA", (W, H), (20, 22, 28, 255))
    d = ImageDraw.Draw(img)
    # Panneau témoin (fond sombre tokenisé).
    px0, py0, px1, py1 = 30, 30, W - 30, H - 30
    d.rectangle([px0, py0, px1, py1], fill=(28, 30, 37, 255))
    # Cadre via un 9-slice « manuel » (coins fixes + bords étirés).
    s = 40
    fw, fh = frame.size
    # coins
    img.alpha_composite(frame.crop((0, 0, s, s)), (px0, py0))
    img.alpha_composite(frame.crop((fw - s, 0, fw, s)), (px1 - s, py0))
    img.alpha_composite(frame.crop((0, fh - s, s, fh)), (px0, py1 - s))
    img.alpha_composite(frame.crop((fw - s, fh - s, fw, fh)), (px1 - s, py1 - s))
    # bords étirés
    top = frame.crop((s, 0, fw - s, s)).resize((px1 - px0 - 2 * s, s))
    img.alpha_composite(top, (px0 + s, py0))
    bot = frame.crop((s, fh - s, fw - s, fh)).resize((px1 - px0 - 2 * s, s))
    img.alpha_composite(bot, (px0 + s, py1 - s))
    left = frame.crop((0, s, s, fh - s)).resize((s, py1 - py0 - 2 * s))
    img.alpha_composite(left, (px0, py0 + s))
    right = frame.crop((fw - s, s, fw, fh - s)).resize((s, py1 - py0 - 2 * s))
    img.alpha_composite(right, (px1 - s, py0 + s))
    # Ruban en haut du panneau.
    rib = ribbon.resize((220, 48))
    img.alpha_composite(rib, ((W - 220) // 2, 14))
    return img


def main() -> None:
    frame = build_frame()
    ribbon = build_ribbon()
    _mipless_save(frame, "panel-frame.png")
    _mipless_save(ribbon, "ribbon.png")
    _mipless_save(build_preview(frame, ribbon), "_preview.png")
    print(f"chrome → {OUT}")
    print("  panel-frame.png  160²  (border-image slice 40)")
    print("  ribbon.png       320×72 (border-image slice horiz. 72)")
    print("  _preview.png     rendu témoin")


if __name__ == "__main__":
    main()
