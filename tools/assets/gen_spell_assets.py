#!/usr/bin/env python3
"""
gen_spell_assets.py — Assets procéduraux « sorts, effets, murs, invocations ».

Nouvelle famille S de docs/12-assets-style-guide.md (phase 1, procédural). Produit,
déterministe (aucun aléa) façon gen_ui_icons.py (rendu 256/512 puis mipmaps LANCZOS,
silhouette pleine + liseré sombre + rehaut simple) :

1. Icônes de sorts du grimoire   → assets/spells/<school>-<kind>_<64|48|32|24>.png
   (un couple (école, type) par icône ; couples lus dans data/core/spells.json).
2. Badges d'effet sur les jetons  → assets/ui/status-<name>_<32|24|16>.png
   (buff/debuff/silence/poison/mark/immobilized/stealth ; lisibles ≥16px).
3. Mur de siège (combat)          → assets/combat/siege-wall.png (512²).
4. Unité invoquée (élémentaire)   → assets/units/core/elementaire-de-terre.png (512²).

Repli procédural côté client : tout PNG absent retombe sur l'affichage procédural
existant (jamais d'image cassée). Câblage : voir docs/12 §10 et
.claude/plans/asset-spell-effects-related.md.

Usage : python3 tools/assets/gen_spell_assets.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parent.parent.parent
SPELLS_JSON = REPO / "data" / "core" / "spells.json"
OUT_SPELLS = REPO / "assets" / "spells"
OUT_UI = REPO / "assets" / "ui"
OUT_COMBAT = REPO / "assets" / "combat"
OUT_UNITS_CORE = REPO / "assets" / "units" / "core"

R = 256                          # résolution de travail (icônes)
SPELL_MIPS = (64, 48, 32, 24)
STATUS_MIPS = (32, 24, 16)
OUTLINE = (30, 24, 20, 255)      # liseré sombre commun
HILITE = (255, 255, 255, 90)


def _canvas(size: int = R):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


# ── palettes d'école (fond, accent clair du glyphe) ─────────────────────────
# Couleur = identité d'école (doc 02 §1.4) ; le glyphe reste clair pour le contraste.
SCHOOL_COLORS: dict[str, tuple[tuple[int, int, int], tuple[int, int, int]]] = {
    "fire": ((176, 54, 34), (255, 214, 150)),
    "water": ((44, 104, 176), (198, 232, 255)),
    "earth": ((120, 92, 48), (226, 206, 160)),
    "air": ((88, 132, 168), (232, 244, 255)),
    "neutral": ((96, 92, 108), (226, 224, 234)),
    "traque": ((70, 112, 70), (206, 232, 190)),
    "scene": ((150, 70, 140), (244, 210, 240)),
    "lumiere": ((196, 168, 70), (255, 244, 200)),
    "prime": ((78, 62, 96), (214, 200, 232)),
}
DEFAULT_SCHOOL = ((96, 92, 108), (226, 224, 234))


# ── glyphes par type de sort (dessinés en coordonnées [0..256]) ─────────────
# Chaque glyphe est tracé au centre, clair (`c` = accent d'école), lisible à 24px.

def _arrow(d, c, up: bool):
    cx = 128
    tip, base = (72, 184) if up else (184, 72)
    d.polygon([(cx, tip), (cx - 44, (tip + base) // 2), (cx - 18, (tip + base) // 2),
               (cx - 18, base), (cx + 18, base), (cx + 18, (tip + base) // 2),
               (cx + 44, (tip + base) // 2)], fill=c, outline=OUTLINE)


def g_damage(d, c):          # éclat / étoile de choc
    cx = cy = 128
    pts = []
    for i in range(12):
        a = math.pi * i / 6
        rr = 88 if i % 2 == 0 else 38
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d.polygon(pts, fill=c, outline=OUTLINE)


def g_heal(d, c):            # croix de soin
    d.rounded_rectangle([104, 56, 152, 200], 12, fill=c, outline=OUTLINE)
    d.rounded_rectangle([56, 104, 200, 152], 12, fill=c, outline=OUTLINE)


def g_buff(d, c):
    _arrow(d, c, up=True)


def g_debuff(d, c):
    _arrow(d, c, up=False)


def g_dispel(d, c):          # spirale de dissipation
    for k in range(3):
        r0 = 34 + k * 24
        d.arc([128 - r0, 128 - r0, 128 + r0, 128 + r0], 20 + k * 40, 320 + k * 40,
              fill=c, width=12)


def g_cure(d, c):            # goutte + croix (purification)
    d.polygon([(128, 52), (176, 150), (128, 196), (80, 150)], fill=c, outline=OUTLINE)
    d.line([128, 96, 128, 168], fill=OUTLINE, width=12)
    d.line([98, 132, 158, 132], fill=OUTLINE, width=12)


def g_applyMarks(d, c):      # réticule de marque
    d.ellipse([64, 64, 192, 192], outline=c, width=14)
    d.line([128, 40, 128, 88], fill=c, width=12)
    d.line([128, 168, 128, 216], fill=c, width=12)
    d.line([40, 128, 88, 128], fill=c, width=12)
    d.line([168, 128, 216, 128], fill=c, width=12)
    d.ellipse([116, 116, 140, 140], fill=c)


def g_silence(d, c):         # cercle barré
    d.ellipse([60, 60, 196, 196], outline=c, width=16)
    d.line([84, 84, 172, 172], fill=c, width=16)


def g_banish(d, c):          # vortex décroissant
    for k in range(4):
        r0 = 90 - k * 20
        d.arc([128 - r0, 128 - r0, 128 + r0, 128 + r0], -30 + k * 90, 150 + k * 90,
              fill=c, width=11)


def g_rally(d, c):           # fanion de ralliement
    d.line([96, 48, 96, 208], fill=c, width=14)
    d.polygon([(96, 56), (192, 84), (96, 120)], fill=c, outline=OUTLINE)


def g_stealth(d, c):         # œil barré (furtivité)
    d.polygon([(48, 128), (128, 84), (208, 128), (128, 172)], outline=c, width=12)
    d.ellipse([112, 112, 144, 144], fill=c)
    d.line([64, 176, 192, 80], fill=OUTLINE, width=14)


def g_teleport(d, c):        # portail concentrique
    d.ellipse([56, 40, 200, 216], outline=c, width=16)
    d.ellipse([92, 84, 164, 172], outline=c, width=12)
    d.ellipse([116, 116, 140, 140], fill=c)


def g_summon(d, c):          # cercle d'invocation + étoile
    d.ellipse([52, 52, 204, 204], outline=c, width=12)
    g = ImageDraw.Draw  # noqa
    pts = []
    for i in range(10):
        a = -math.pi / 2 + math.pi * i / 5
        rr = 60 if i % 2 == 0 else 26
        pts.append((128 + rr * math.cos(a), 128 + rr * math.sin(a)))
    d.polygon(pts, fill=c, outline=OUTLINE)


def g_resurrect(d, c):       # ankh (résurrection totale)
    d.ellipse([98, 44, 158, 116], outline=c, width=16)
    d.line([128, 108, 128, 208], fill=c, width=16)
    d.line([84, 138, 172, 138], fill=c, width=16)


def g_adventure(d, c):       # rose des vents (sorts de carte)
    d.polygon([(128, 44), (146, 128), (128, 128)], fill=c, outline=OUTLINE)
    d.polygon([(128, 212), (110, 128), (128, 128)], fill=c, outline=OUTLINE)
    d.polygon([(44, 128), (128, 110), (128, 128)], fill=c, outline=OUTLINE)
    d.polygon([(212, 128), (128, 146), (128, 128)], fill=c, outline=OUTLINE)
    d.ellipse([116, 116, 140, 140], fill=c, outline=OUTLINE)


KIND_GLYPHS = {
    "damage": g_damage, "heal": g_heal, "buff": g_buff, "debuff": g_debuff,
    "dispel": g_dispel, "cure": g_cure, "applyMarks": g_applyMarks,
    "silence": g_silence, "banish": g_banish, "rally": g_rally,
    "stealth": g_stealth, "teleport": g_teleport, "summon": g_summon,
    "resurrectFull": g_resurrect, "adventure": g_adventure,
}


def draw_spell_icon(school: str, kind: str) -> Image.Image:
    """Badge-gemme : fond d'école (biseau) + glyphe de type clair."""
    img, d = _canvas()
    base, accent = SCHOOL_COLORS.get(school, DEFAULT_SCHOOL)
    dark = tuple(int(v * 0.55) for v in base) + (255,)
    # gemme arrondie biseautée
    d.rounded_rectangle([24, 24, 232, 232], 44, fill=OUTLINE)
    d.rounded_rectangle([32, 32, 224, 224], 38, fill=base + (255,))
    d.rounded_rectangle([32, 128, 224, 224], 38, fill=dark)     # moitié basse ombrée
    d.rounded_rectangle([32, 32, 224, 224], 38, outline=(255, 255, 255, 60), width=6)
    d.ellipse([56, 48, 150, 104], fill=HILITE)                  # rehaut de verre
    KIND_GLYPHS.get(kind, g_damage)(d, accent + (255,))
    return img


# ── badges d'effet (petits, lisibles ≥16px) ─────────────────────────────────
STATUS_COLORS = {
    "buff": (86, 176, 96), "debuff": (150, 80, 176), "silence": (120, 120, 130),
    "poison": (110, 160, 60), "mark": (196, 70, 60), "immobilized": (150, 120, 60),
    "stealth": (80, 110, 150),
}


def _status_bg(d, color):
    d.ellipse([16, 16, 240, 240], fill=OUTLINE)
    d.ellipse([26, 26, 230, 230], fill=color + (255,))
    d.ellipse([26, 26, 230, 230], outline=(255, 255, 255, 70), width=8)
    d.ellipse([60, 48, 150, 108], fill=HILITE)


def draw_status(name: str) -> Image.Image:
    img, d = _canvas()
    _status_bg(d, STATUS_COLORS[name])
    w = (245, 245, 240, 255)
    if name == "buff":
        _arrow(d, w, up=True)
    elif name == "debuff":
        _arrow(d, w, up=False)
    elif name == "silence":
        d.ellipse([76, 76, 180, 180], outline=w, width=16)
        d.line([96, 96, 160, 160], fill=w, width=16)
    elif name == "poison":                                   # goutte
        d.polygon([(128, 60), (176, 156), (128, 200), (80, 156)], fill=w, outline=OUTLINE)
        d.ellipse([110, 150, 130, 170], fill=STATUS_COLORS[name] + (255,))
    elif name == "mark":                                     # réticule
        d.ellipse([78, 78, 178, 178], outline=w, width=14)
        d.line([128, 56, 128, 96], fill=w, width=12)
        d.line([128, 160, 128, 200], fill=w, width=12)
        d.line([56, 128, 96, 128], fill=w, width=12)
        d.line([160, 128, 200, 128], fill=w, width=12)
    elif name == "immobilized":                              # maillons de chaîne
        for cx in (96, 160):
            d.ellipse([cx - 30, 100, cx + 30, 168], outline=w, width=16)
    elif name == "stealth":                                  # œil
        d.polygon([(64, 128), (128, 92), (192, 128), (128, 164)], outline=w, width=12)
        d.ellipse([112, 112, 144, 144], fill=w)
    return img


# ── mur de siège (512²) ─────────────────────────────────────────────────────
def draw_siege_wall() -> Image.Image:
    S = 512
    img, d = _canvas(S)
    stone = (150, 142, 128, 255)
    dark = (96, 90, 80, 255)
    mortar = (70, 66, 58, 255)
    # corps du rempart
    d.rectangle([96, 150, 416, 470], fill=mortar)
    # créneaux (merlons)
    for i, x in enumerate((104, 200, 296, 392)):
        d.rectangle([x, 96, x + 64, 170], fill=stone, outline=OUTLINE, width=4)
        d.rectangle([x + 8, 104, x + 56, 150], fill=dark)
    # assises de pierre en quinconce
    for r, y in enumerate(range(170, 470, 60)):
        off = 0 if r % 2 == 0 else 52
        for x in range(96 - off, 416, 104):
            x0, x1 = max(96, x), min(416, x + 100)
            if x1 - x0 < 20:
                continue
            d.rectangle([x0, y, x1, y + 56], fill=stone, outline=OUTLINE, width=4)
            d.line([x0 + 6, y + 8, x1 - 6, y + 8], fill=HILITE, width=4)
    d.rectangle([96, 150, 416, 470], outline=OUTLINE, width=6)
    return img


# ── élémentaire de terre invoqué (512²) ─────────────────────────────────────
def draw_earth_elemental() -> Image.Image:
    S = 512
    img, d = _canvas(S)
    rock = (128, 104, 70, 255)
    rock_d = (92, 72, 46, 255)
    rock_l = (170, 146, 104, 255)
    core = (232, 168, 70, 255)          # cœur incandescent
    # ombre au sol
    d.ellipse([120, 452, 392, 500], fill=(0, 0, 0, 70))
    # jambes trapues
    d.rounded_rectangle([176, 356, 240, 470], 24, fill=rock_d, outline=OUTLINE, width=5)
    d.rounded_rectangle([272, 356, 336, 470], 24, fill=rock_d, outline=OUTLINE, width=5)
    # torse massif de blocs
    d.polygon([(150, 210), (362, 210), (392, 380), (120, 380)], fill=rock, outline=OUTLINE)
    # bras-rochers
    d.ellipse([88, 232, 176, 360], fill=rock, outline=OUTLINE, width=5)
    d.ellipse([336, 232, 424, 360], fill=rock, outline=OUTLINE, width=5)
    # tête bloc
    d.rounded_rectangle([196, 120, 316, 240], 20, fill=rock_l, outline=OUTLINE, width=5)
    # yeux incandescents + fissure de cœur
    d.ellipse([220, 156, 248, 184], fill=core)
    d.ellipse([264, 156, 292, 184], fill=core)
    d.line([256, 250, 240, 320, 268, 340, 252, 380], fill=core, width=8)
    # facettes de blocs (rehauts)
    for (x0, y0, x1, y1) in [(160, 224, 220, 268), (300, 300, 356, 348),
                             (150, 320, 210, 366), (270, 224, 330, 264)]:
        d.polygon([(x0, y0), (x1, y0 + 8), (x1 - 10, y1), (x0 + 6, y1 - 6)],
                  fill=rock_l, outline=OUTLINE, width=3)
    return img


# ── pipeline ────────────────────────────────────────────────────────────────
def _save_mips(img: Image.Image, out_dir: Path, name: str, mips) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for size in mips:
        img.resize((size, size), Image.LANCZOS).save(
            out_dir / f"{name}_{size}.png", optimize=True)


def _spell_combos() -> list[tuple[str, str]]:
    data = json.loads(SPELLS_JSON.read_text(encoding="utf-8"))
    return sorted({(s["school"], s["kind"]) for s in data["spells"]})


def main() -> None:
    combos = _spell_combos()
    spell_imgs = []
    for school, kind in combos:
        img = draw_spell_icon(school, kind)
        _save_mips(img, OUT_SPELLS, f"{school}-{kind}", SPELL_MIPS)
        spell_imgs.append((f"{school}-{kind}", img))
    print(f"  sorts → {len(combos)} icônes × {len(SPELL_MIPS)} mipmaps")

    status_imgs = []
    for name in STATUS_COLORS:
        img = draw_status(name)
        _save_mips(img, OUT_UI, f"status-{name}", STATUS_MIPS)
        status_imgs.append((f"status-{name}", img))
    print(f"  effets → {len(STATUS_COLORS)} badges × {len(STATUS_MIPS)} mipmaps")

    OUT_COMBAT.mkdir(parents=True, exist_ok=True)
    wall = draw_siege_wall()
    wall.save(OUT_COMBAT / "siege-wall.png", optimize=True)
    print("  mur de siège → assets/combat/siege-wall.png")

    OUT_UNITS_CORE.mkdir(parents=True, exist_ok=True)
    elem = draw_earth_elemental()
    elem.save(OUT_UNITS_CORE / "elementaire-de-terre.png", optimize=True)
    print("  invocation → assets/units/core/elementaire-de-terre.png")

    # planche de contrôle
    tiles = spell_imgs + status_imgs
    cols, cell = 6, 96
    rows = (len(tiles) + cols - 1) // cols + 1
    prev = Image.new("RGB", (cols * cell, rows * cell), (40, 40, 46))
    dd = ImageDraw.Draw(prev)
    for i, (name, img) in enumerate(tiles):
        x, y = (i % cols) * cell, (i // cols) * cell
        thumb = img.resize((64, 64), Image.LANCZOS)
        prev.paste(thumb, (x + 8, y + 8), thumb)
        dd.text((x + 6, y + 76), name, fill=(200, 200, 200))
    # aperçu mur + élémentaire en bas
    prev.paste(wall.resize((80, 80), Image.LANCZOS), (8, (rows - 1) * cell + 4),
               wall.resize((80, 80), Image.LANCZOS))
    prev.paste(elem.resize((80, 80), Image.LANCZOS), (104, (rows - 1) * cell + 4),
               elem.resize((80, 80), Image.LANCZOS))
    prev.save(OUT_SPELLS / "_preview.png", optimize=True)
    print(f"\npreview → {(OUT_SPELLS / '_preview.png').relative_to(REPO)}")


if __name__ == "__main__":
    main()
