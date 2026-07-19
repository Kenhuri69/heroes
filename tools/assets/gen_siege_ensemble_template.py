#!/usr/bin/env python3
"""
gen_siege_ensemble_template.py — GABARIT ENSEMBLISTE (itération 8, la bonne).

Exigence porteur : la méthode gabarit→LLM marche, mais le gabarit doit
représenter **l'ensemble** — mur + porte + tours + tour de tir AVEC les états
abîmé/détruit, assemblés avec leurs connexions, DANS le contexte réel (douve,
chaussée, esplanade). Le modèle peint alors les jonctions dans le tableau.

Sorties :
  assets/prompts/siege-ensemble-template.png — le tableau-gabarit : fond =
    VRAI décor du jeu (scène + eau + pavage) ; par-dessus, en silhouettes
    pâles, la fortification COMPLÈTE assemblée : tour nord, courtine (rangée 1
    fissurée, rangée 7 en brèche), porte + seuil vers la chaussée, tour sud,
    tour de tir dans la cour. Silhouettes = découpes de la planche v1 validée
    (proportions du porteur conservées).
  assets/prompts/siege-ensemble-mask.png — masque d'extraction (zones à
    découper dans la peinture, dilaté).
  assets/layouts/siege-ensemble-cuts.json — géométrie de découpe consommée
    par extract_siege_ensemble.py (aucune constante dupliquée).

Usage : python3 tools/assets/gen_siege_ensemble_template.py
"""

from __future__ import annotations

import json

from PIL import Image, ImageDraw, ImageFilter, ImageOps

from siege_kit_common import GATE_ROWS, HEX_W, ROOT, ROWS, WALL_X, Y_STEP, load_v1_cells

OUT_TPL = ROOT / "assets" / "prompts" / "siege-ensemble-template.png"
OUT_MASK = ROOT / "assets" / "prompts" / "siege-ensemble-mask.png"
OUT_CUTS = ROOT / "assets" / "layouts" / "siege-ensemble-cuts.json"

# Fenêtre du tableau (board-space) — aspect 9:16 pour le générateur.
WIN_H_BP = 600.0
CANVAS = (1152, 2048)
T = CANVAS[1] / WIN_H_BP  # 3.4133 px/bp
WIN_W_BP = CANVAS[0] / T
WIN_X0 = WALL_X - 170.5
WIN_Y0 = -130.0

# Région du RUN (extraction) et boîte de la tour de tir (board-space).
RUN_X0, RUN_X1 = WALL_X - 96.0, WALL_X + 74.0
RUN_Y0, RUN_Y1 = -122.0, 444.0
ARROW_BOX = (720.0, 28.0, 776.0, 162.0)

# États peints dans l'ensemble + rangée-étalon de chaque état.
PAINTED = {"1": "cracked", "7": "razed"}
EXEMPLAR = {"intact": 8, "cracked": 1, "razed": 7}

GUIDE_ALPHA = 170
SCENE_X0, SCENE_Y0 = -186.0, -202.0  # origine de siege-scene.jpg (2 px/bp)


def tpx(x_bp: float, y_bp: float) -> tuple[int, int]:
    return int(round((x_bp - WIN_X0) * T)), int(round((y_bp - WIN_Y0) * T))


def build_context() -> Image.Image:
    """Fond = le VRAI décor in-game (scène + bande d'eau + pavage hex)."""
    scene = Image.open(ROOT / "assets" / "combat" / "siege-scene.jpg").convert("RGB")
    layout = json.loads((ROOT / "assets" / "layouts" / "siege-scene.json").read_text())
    moat = Image.open(ROOT / "assets" / "combat" / "siege-moat.png").convert("RGBA")
    comp = scene.convert("RGBA")
    comp.alpha_composite(moat, (int((layout["moatStrip"]["x0"] - SCENE_X0) * 2), 0))
    # Pavage hexagonal de cour (cols 12..14), comme le client.
    tiles = {v: Image.open(ROOT / "assets" / "combat" / f"siege-tile-court-{v}.png").convert("RGBA") for v in (1, 2, 3)}
    tw, th = layout["courtTile"]["w"], layout["courtTile"]["h"]
    for col in (12, 13, 14):
        for row in range(-1, ROWS + 2):
            v = ((col * 31 + row * 17) % 3) + 1
            tile = tiles[v].resize((int(tw * 2), int(th * 2)), Image.LANCZOS)
            cx_bp = HEX_W * (col + (0.5 if row % 2 else 0.0))
            comp.alpha_composite(tile, (int((cx_bp - tw / 2 - SCENE_X0) * 2), int((row * Y_STEP - th / 2 - SCENE_Y0) * 2)))
    # Recadre la fenêtre du tableau puis monte à l'échelle du gabarit.
    x0 = int((WIN_X0 - SCENE_X0) * 2)
    y0 = int((WIN_Y0 - SCENE_Y0) * 2)
    crop = comp.crop((x0, y0, x0 + int(WIN_W_BP * 2), y0 + int(WIN_H_BP * 2)))
    return crop.resize(CANVAS, Image.LANCZOS).convert("RGB")


def ghost(piece: Image.Image, w_bp: float) -> Image.Image:
    scale = (w_bp * T) / piece.width
    g = piece.resize((max(1, int(piece.width * scale)), max(1, int(piece.height * scale))), Image.LANCZOS)
    grey = ImageOps.grayscale(g)
    pale = ImageOps.colorize(grey, black=(64, 56, 64), white=(232, 226, 232)).convert("RGBA")
    pale.putalpha(g.getchannel("A").point(lambda a: min(a, GUIDE_ALPHA)))
    return pale


def main() -> None:
    cells = load_v1_cells()
    tpl = build_context()
    mask = Image.new("L", CANVAS, 0)

    def place(piece: Image.Image, w_bp: float, cx_bp: float, bottom_bp: float) -> None:
        g = ghost(piece, w_bp)
        x, y = tpx(cx_bp, bottom_bp)
        pos = (x - g.width // 2, y - g.height)
        tpl.paste(g, pos, g)
        mask.paste(g.getchannel("A").point(lambda a: 255 if a > 30 else 0), pos, g.getchannel("A").point(lambda a: 255 if a > 30 else 0))

    # Tour NORD (cape l'extrémité du run), courtine rangée par rangée avec les
    # ÉTATS en situation, porte + seuil, tour SUD, tour de tir dans la cour.
    place(cells["tower"], 34.0, WALL_X + 2, -18.0)
    for row in range(ROWS):
        if row in GATE_ROWS:
            continue
        state = PAINTED.get(str(row), "intact")
        piece = {"intact": cells["wall"], "cracked": cells["cracked"], "razed": cells["razed"]}[state]
        place(piece, 66.0, WALL_X, (row + 0.7) * Y_STEP)
    # Seuil de porte : trapèze-guide qui rejoint la chaussée sur l'eau.
    d = ImageDraw.Draw(tpl, "RGBA")
    md = ImageDraw.Draw(mask)
    gate_y = (GATE_ROWS[0] + GATE_ROWS[1]) / 2 * Y_STEP
    apron = [
        tpx(WALL_X - 34, gate_y + 2),
        tpx(WALL_X - 96, gate_y + 8),
        tpx(WALL_X - 96, gate_y + 30),
        tpx(WALL_X - 34, gate_y + 26),
    ]
    d.polygon(apron, fill=(210, 205, 210, 150), outline=(90, 80, 90, 220))
    md.polygon(apron, fill=255)
    place(cells["gate"], 96.0, WALL_X + 2, (GATE_ROWS[1] + 0.68) * Y_STEP)
    place(cells["tower"], 34.0, WALL_X + 2, (ROWS - 1 + 1.9) * Y_STEP)
    place(cells["arrow"], 46.0, (ARROW_BOX[0] + ARROW_BOX[2]) / 2, ARROW_BOX[3] - 4)

    # Dilatation du masque (la peinture peut déborder légèrement des guides).
    mask = mask.filter(ImageFilter.MaxFilter(13))
    # Annotations DANS les marges (hors masque ⇒ jetées à l'extraction).
    d.text((10, 8), "REPEINDRE les silhouettes pales EN PLACE - le decor reste tel quel", fill=(255, 255, 255))
    d.text((10, 26), "rangee fissuree et breche EN SITUATION - porte + seuil relies a la chaussee", fill=(255, 255, 255))

    tpl.save(OUT_TPL)
    mask.save(OUT_MASK)
    cuts = {
        "canvas": list(CANVAS),
        "scalePxPerBp": round(T, 5),
        "window": {"x0": WIN_X0, "y0": WIN_Y0, "w": round(WIN_W_BP, 2), "h": WIN_H_BP},
        "run": {"x0": RUN_X0, "y0": RUN_Y0, "x1": RUN_X1, "y1": RUN_Y1},
        "arrow": list(ARROW_BOX),
        "wallX": round(WALL_X, 2),
        "period": round(Y_STEP, 2),
        "gateRows": list(GATE_ROWS),
        "painted": PAINTED,
        "exemplar": EXEMPLAR,
    }
    OUT_CUTS.write_text(json.dumps(cuts, indent=2) + "\n")
    print(f"{OUT_TPL.name} {CANVAS} · masque · cuts JSON")


if __name__ == "__main__":
    main()
