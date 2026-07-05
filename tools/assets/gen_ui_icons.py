#!/usr/bin/env python3
"""
gen_ui_icons.py — Icônes globales d'UI procédurales (ressources, stats héros,
divers) pour Heroes.

Règle P de docs/12-assets-style-guide.md :
  - déterministe (aucun aléa : formes vectorielles fixes) ;
  - rendu à 256 px puis mipmaps LANCZOS 64/48/32/24/16 (pratique Hogwarth) ;
  - silhouette pleine + liseré sombre + rehaut simple, lisible à 16 px.

Ajouter une icône = ajouter une entrée dans ICONS (nom → fonction de dessin
sur canvas 256², coordonnées dans [0..256]).

Sortie : assets/ui/<id>_<64|48|32|24|16>.png + _preview.png.
Aucune intégration client dans ce lot (voir docs/12 §10).

Usage : python3 tools/assets/gen_ui_icons.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parent.parent.parent
OUT = REPO / "assets" / "ui"

R = 256                      # résolution de travail
MIPMAPS = (64, 48, 32, 24, 16)
OUTLINE = (32, 26, 22, 255)  # liseré sombre commun
HILITE = (255, 255, 255, 90)


def _canvas():
    img = Image.new("RGBA", (R, R), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


# ── ressources ─────────────────────────────────────────────────────────────

def gold(d):
    d.ellipse([40, 56, 216, 200], fill=OUTLINE)
    d.ellipse([52, 66, 204, 190], fill=(212, 168, 60, 255))
    d.ellipse([74, 84, 182, 172], outline=(160, 120, 34, 255), width=10)
    d.ellipse([70, 78, 130, 110], fill=HILITE)


def wood(d):
    for i, y in enumerate((70, 130)):
        d.rounded_rectangle([36, y, 220, y + 58], 29, fill=OUTLINE)
        d.rounded_rectangle([44, y + 6, 212, y + 52], 23, fill=(112, 78, 44, 255))
        d.line([60, y + 18, 196, y + 18], fill=(140, 102, 60, 255), width=8)
        cx = 200 if i == 0 else 56
        d.ellipse([cx - 26, y + 2, cx + 26, y + 56], fill=(178, 144, 96, 255),
                  outline=OUTLINE, width=8)
        d.ellipse([cx - 10, y + 18, cx + 10, y + 40], fill=(140, 102, 60, 255))


def ore(d):
    pts = [(52, 196), (34, 120), (92, 60), (170, 48), (222, 116), (198, 196)]
    d.polygon(pts, fill=OUTLINE)
    inner = [(62, 188), (48, 124), (98, 74), (164, 62), (208, 120), (188, 188)]
    d.polygon(inner, fill=(118, 114, 122, 255))
    d.line([98, 74, 128, 188], fill=(88, 84, 94, 255), width=8)
    d.line([164, 62, 128, 188], fill=(146, 142, 152, 255), width=8)
    d.polygon([(98, 74), (164, 62), (128, 110)], fill=(160, 156, 168, 255))


def crystal(d):
    d.polygon([(128, 28), (170, 96), (128, 224), (86, 96)], fill=OUTLINE)
    d.polygon([(128, 40), (160, 98), (128, 210), (96, 98)], fill=(84, 190, 196, 255))
    d.polygon([(128, 40), (160, 98), (128, 210)], fill=(58, 158, 168, 255))
    d.polygon([(84, 120), (110, 158), (92, 216), (66, 168)], fill=OUTLINE)
    d.polygon([(90, 130), (104, 158), (92, 204), (76, 168)], fill=(110, 208, 210, 255))
    d.line([128, 44, 128, 200], fill=(190, 240, 240, 160), width=6)


def gems(d):
    for cx, cy, s, col in ((84, 96, 52, (196, 60, 74)), (172, 96, 52, (60, 120, 200)),
                           (128, 176, 56, (88, 180, 92))):
        d.polygon([(cx, cy - s), (cx + s, cy), (cx, cy + s), (cx - s, cy)], fill=OUTLINE)
        k = s - 10
        d.polygon([(cx, cy - k), (cx + k, cy), (cx, cy + k), (cx - k, cy)],
                  fill=col + (255,))
        d.polygon([(cx, cy - k), (cx + k, cy), (cx, cy)], fill=HILITE)


def essence(d):
    d.ellipse([56, 56, 200, 200], fill=OUTLINE)
    d.ellipse([66, 66, 190, 190], fill=(122, 78, 190, 255))
    d.arc([84, 84, 172, 172], 300, 180, fill=(200, 170, 240, 255), width=14)
    d.arc([104, 104, 152, 152], 120, 360, fill=(226, 206, 250, 255), width=10)
    d.ellipse([88, 82, 122, 108], fill=HILITE)


def sulfur(d):
    # tas de cristaux de soufre : amas jaune-orangé anguleux, halo chaud
    base = [(40, 208), (72, 128), (128, 96), (188, 132), (216, 208)]
    d.polygon(base, fill=OUTLINE)
    d.polygon([(52, 200), (80, 138), (128, 112), (180, 140), (204, 200)],
              fill=(214, 176, 40, 255))
    # facette sombre droite + facette claire gauche pour le volume
    d.polygon([(128, 112), (180, 140), (204, 200), (128, 200)],
              fill=(184, 138, 26, 255))
    d.polygon([(128, 112), (80, 138), (52, 200), (128, 200)],
              fill=(238, 206, 78, 255))
    # cristal saillant central
    d.polygon([(112, 40), (146, 40), (156, 118), (102, 118)], fill=OUTLINE)
    d.polygon([(118, 52), (140, 52), (148, 114), (110, 114)],
              fill=(244, 214, 88, 255))
    d.polygon([(118, 52), (129, 52), (129, 114), (110, 114)], fill=HILITE)


def mercury(d):
    # vif-argent : fiole trapue au liquide métallique brillant
    d.rectangle([112, 30, 144, 58], fill=OUTLINE)              # bouchon
    d.rectangle([118, 34, 138, 56], fill=(150, 112, 44, 255))
    d.polygon([(96, 60), (160, 60), (196, 150), (196, 206),
               (60, 206), (60, 150)], fill=OUTLINE)            # corps verre
    d.polygon([(104, 70), (152, 70), (184, 152), (184, 198),
               (72, 198), (72, 152)], fill=(70, 82, 96, 255))  # verre teinté
    # liquide métallique (rempli aux 2/3)
    d.polygon([(80, 128), (176, 128), (184, 152), (184, 198),
               (72, 198), (72, 152)], fill=(176, 184, 196, 255))
    d.ellipse([80, 118, 176, 140], fill=(210, 218, 228, 255))  # ménisque
    d.ellipse([96, 158, 128, 186], fill=(232, 238, 246, 220))  # reflet
    d.line([112, 78, 100, 150], fill=HILITE, width=8)          # reflet verre


# ── stats héros / combat ───────────────────────────────────────────────────

def attack(d):
    d.polygon([(178, 30), (226, 78), (98, 206), (74, 226), (50, 202), (70, 178)],
              fill=OUTLINE)
    d.polygon([(180, 46), (210, 76), (94, 192), (64, 194), (66, 162)],
              fill=(196, 198, 208, 255))
    d.polygon([(180, 46), (210, 76), (150, 136)], fill=(226, 228, 236, 255))
    d.line([96, 132, 152, 188], fill=OUTLINE, width=22)          # garde
    d.line([100, 136, 148, 184], fill=(150, 112, 44, 255), width=12)
    d.ellipse([44, 196, 76, 228], fill=(150, 112, 44, 255), outline=OUTLINE, width=6)


def defense(d):
    d.polygon([(128, 26), (216, 60), (216, 130), (128, 230), (40, 130), (40, 60)],
              fill=OUTLINE)
    d.polygon([(128, 40), (202, 68), (202, 126), (128, 212), (54, 126), (54, 68)],
              fill=(80, 108, 158, 255))
    d.polygon([(128, 40), (202, 68), (202, 126), (128, 212)], fill=(64, 90, 138, 255))
    d.polygon([(128, 72), (168, 88), (168, 122), (128, 168), (88, 122), (88, 88)],
              fill=(212, 168, 60, 255))


def power(d):
    d.ellipse([70, 70, 186, 186], fill=OUTLINE)
    d.ellipse([80, 80, 176, 176], fill=(190, 88, 60, 255))
    d.ellipse([96, 92, 138, 128], fill=(238, 160, 96, 200))
    for a, b in (((128, 16), (128, 58)), ((128, 198), (128, 240)),
                 ((16, 128), (58, 128)), ((198, 128), (240, 128)),
                 ((49, 49), (79, 79)), ((177, 177), (207, 207)),
                 ((49, 207), (79, 177)), ((177, 79), (207, 49))):
        d.line([a, b], fill=(238, 160, 96, 255), width=14)


def knowledge(d):
    d.polygon([(24, 60), (120, 44), (128, 52), (136, 44), (232, 60), (232, 196),
               (136, 182), (128, 192), (120, 182), (24, 196)], fill=OUTLINE)
    d.polygon([(36, 70), (118, 56), (118, 176), (36, 184)], fill=(232, 222, 196, 255))
    d.polygon([(220, 70), (138, 56), (138, 176), (220, 184)], fill=(214, 200, 168, 255))
    for y in (92, 116, 140):
        d.line([50, y, 106, y - 4], fill=(150, 134, 104, 255), width=6)
        d.line([150, y - 4, 206, y], fill=(150, 134, 104, 255), width=6)


def mana(d):
    d.polygon([(128, 20), (196, 132), (128, 148), (60, 132)], fill=OUTLINE)
    d.ellipse([52, 96, 204, 236], fill=OUTLINE)
    d.polygon([(128, 36), (184, 130), (128, 142), (72, 130)], fill=(66, 122, 214, 255))
    d.ellipse([64, 106, 192, 226], fill=(66, 122, 214, 255))
    d.ellipse([88, 128, 130, 172], fill=(140, 186, 244, 200))


def movement(d):
    d.polygon([(70, 26), (118, 26), (122, 128), (168, 158), (216, 168), (222, 214),
               (60, 214), (58, 168), (66, 120)], fill=OUTLINE)
    d.polygon([(80, 40), (108, 40), (112, 134), (160, 168), (206, 178), (208, 202),
               (72, 202), (70, 168), (78, 122)], fill=(124, 82, 46, 255))
    d.polygon([(80, 40), (108, 40), (112, 134), (92, 150), (78, 122)],
              fill=(148, 102, 58, 255))
    d.line([72, 176, 206, 186], fill=(90, 58, 32, 255), width=10)


def xp(d):
    pts = []
    from math import cos, pi, sin
    for i in range(10):
        ang = -pi / 2 + i * pi / 5
        r = 108 if i % 2 == 0 else 44
        pts.append((128 + r * cos(ang), 132 + r * sin(ang)))
    d.polygon(pts, fill=OUTLINE)
    inner = [(128 + (r - 14 if r > 60 else r - 8) * cos(-pi / 2 + i * pi / 5),
              132 + (r - 14 if r > 60 else r - 8) * sin(-pi / 2 + i * pi / 5))
             for i, r in ((i, 108 if i % 2 == 0 else 44) for i in range(10))]
    d.polygon(inner, fill=(226, 186, 70, 255))
    d.polygon([p for i, p in enumerate(inner) if i in (0, 1, 9)] + [(128, 132)],
              fill=(246, 216, 120, 255))


def luck(d):
    for cx, cy in ((98, 92), (158, 92), (98, 152), (158, 152)):
        d.ellipse([cx - 44, cy - 44, cx + 44, cy + 44], fill=OUTLINE)
    for cx, cy in ((98, 92), (158, 92), (98, 152), (158, 152)):
        d.ellipse([cx - 36, cy - 36, cx + 36, cy + 36], fill=(76, 148, 74, 255))
        d.ellipse([cx - 30, cy - 30, cx - 4, cy - 6], fill=(108, 180, 100, 160))
    d.line([132, 150, 148, 226], fill=OUTLINE, width=18)
    d.line([134, 152, 148, 222], fill=(76, 148, 74, 255), width=10)


def morale(d):
    d.line([70, 24, 70, 232], fill=OUTLINE, width=20)
    d.line([70, 24, 70, 232], fill=(150, 112, 44, 255), width=10)
    d.polygon([(78, 36), (216, 36), (188, 82), (216, 128), (78, 128)], fill=OUTLINE)
    d.polygon([(84, 44), (202, 44), (178, 82), (202, 120), (84, 120)],
              fill=(180, 62, 62, 255))
    d.polygon([(84, 44), (202, 44), (178, 82), (84, 82)], fill=(202, 84, 78, 255))


def day(d):
    d.polygon([(64, 28), (192, 28), (192, 64), (140, 124), (140, 132), (192, 192),
               (192, 228), (64, 228), (64, 192), (116, 132), (116, 124), (64, 64)],
              fill=OUTLINE)
    d.polygon([(76, 40), (180, 40), (180, 58), (132, 116), (124, 116), (76, 58)],
              fill=(226, 234, 242, 180))
    d.polygon([(76, 216), (180, 216), (180, 198), (132, 140), (124, 140), (76, 198)],
              fill=(226, 234, 242, 180))
    d.polygon([(96, 52), (160, 52), (128, 92)], fill=(224, 178, 84, 255))
    d.polygon([(88, 208), (168, 208), (128, 156)], fill=(224, 178, 84, 255))


ICONS = {
    # ressources (data/core/config.json + manifestes de faction)
    "res-gold": gold,
    "res-wood": wood,
    "res-ore": ore,
    "res-crystal": crystal,
    "res-gems": gems,
    "res-sulfur": sulfur,
    "res-mercury": mercury,
    "res-essence": essence,
    # stats héros / combat (doc 02 §1)
    "stat-attack": attack,
    "stat-defense": defense,
    "stat-power": power,
    "stat-knowledge": knowledge,
    "stat-mana": mana,
    "stat-movement": movement,
    "stat-xp": xp,
    "stat-luck": luck,
    "stat-morale": morale,
    # divers
    "ui-day": day,
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    rendered = []
    for name, fn in ICONS.items():
        img, d = _canvas()
        fn(d)
        for size in MIPMAPS:
            img.resize((size, size), Image.LANCZOS).save(
                OUT / f"{name}_{size}.png", optimize=True)
        rendered.append((name, img))
        print(f"  {name} → {len(MIPMAPS)} mipmaps")

    # planche de contrôle : 64 px + 16 px côte à côte (lisibilité mini)
    cols, cell = 4, 120
    rows = (len(rendered) + cols - 1) // cols
    prev = Image.new("RGB", (cols * cell, rows * cell), (40, 40, 46))
    d = ImageDraw.Draw(prev)
    for i, (name, img) in enumerate(rendered):
        x, y = (i % cols) * cell, (i // cols) * cell
        prev.paste(img.resize((64, 64), Image.LANCZOS), (x + 12, y + 12),
                   img.resize((64, 64), Image.LANCZOS))
        prev.paste(img.resize((16, 16), Image.LANCZOS), (x + 86, y + 36),
                   img.resize((16, 16), Image.LANCZOS))
        d.text((x + 12, y + 82), name, fill=(200, 200, 200))
    prev.save(OUT / "_preview.png", optimize=True)
    print(f"\npreview → {(OUT / '_preview.png').relative_to(REPO)} "
          f"({len(rendered)} icônes, rendu 64 px + 16 px)")


if __name__ == "__main__":
    main()
