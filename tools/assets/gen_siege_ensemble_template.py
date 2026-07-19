#!/usr/bin/env python3
"""
gen_siege_ensemble_template.py — GABARIT v7 : l'ENSEMBLE de la muraille sur
fond MAGENTA, courtine d'UN SEUL TENANT (itération 9, exigence porteur).

Leçon de la peinture v6 (rejetée : « les murs ne se connectent pas ») : les
silhouettes-guides par rangée (pièces v1 empilées) montraient une plateforme
crénelée PAR RANGÉE ⇒ le modèle a peint des blocs empilés. Le guide de
courtine est désormais UNE BANDE CONTINUE (créneaux uniquement sur le bord
assaillant, aucune couronne entre les rangées) — le modèle ne peut plus
peindre autre chose qu'un mur d'un seul tenant.

Exigences croisées des retours porteur :
  - approche ENSEMBLE (itération 8) : tout dessiner assemblé, avec les
    connexions — jamais d'objet isolé (« la tour seule c'est de la merde ») ;
  - fond UNI magenta (itération 9) : pas de décor à préserver — le tableau
    sur décor réel ne marche pas ; l'extraction redevient un chroma-key
    (le pipeline qui a donné la planche v1 réussie).

Le gabarit présente TOUS les cas possibles de la muraille, CONNECTÉS :
  - tours d'extrémité FUSIONNÉES au mur (le mur entre dans la tour) ;
  - courtine continue avec les états EN SITUATION — rangée 1 fissurée,
    rangée 7 CASSÉE (brèche effondrée) ;
  - porte (gatehouse dans l'axe du mur) + PONT-LEVIS abaissé vers
    l'assaillant (tablier de bois + chaînes) ;
  - tour de tir EN RETRAIT dans la cour (derrière la porte), et sa RUINE
    en retrait derrière la brèche (tour de tir cassée).

Sorties :
  assets/prompts/siege-ensemble-template.png — le gabarit 1152×2048 : fond
    magenta, silhouettes-guides opaques de l'ensemble, ancrées exactement sur
    la géométrie moteur (rangées, porte rangées 4-5, axe du mur).
  assets/layouts/siege-ensemble-cuts.json — géométrie de découpe consommée
    par extract_siege_ensemble.py (aucune constante dupliquée).

Usage : python3 tools/assets/gen_siege_ensemble_template.py
"""

from __future__ import annotations

import json

from PIL import Image, ImageChops, ImageDraw, ImageOps

from siege_kit_common import GATE_ROWS, ROOT, ROWS, WALL_X, Y_STEP, load_v1_cells

OUT_TPL = ROOT / "assets" / "prompts" / "siege-ensemble-template.png"
OUT_CUTS = ROOT / "assets" / "layouts" / "siege-ensemble-cuts.json"

# Fenêtre du tableau (board-space) — aspect 9:16 pour le générateur.
WIN_H_BP = 600.0
CANVAS = (1152, 2048)
T = CANVAS[1] / WIN_H_BP  # 3.4133 px/bp
WIN_W_BP = CANVAS[0] / T
WIN_X0 = WALL_X - 170.5
WIN_Y0 = -130.0

BG = (255, 0, 255)
GUIDE = (188, 178, 188)
GUIDE_D = (120, 108, 120)
INK = (70, 0, 70)

# Région du RUN (extraction) et boîtes des tours de tir (board-space).
# Le pont-levis reste DANS la région du run ; les tours de tir en retrait
# restent À L'EST de la région (jamais bakées dans les tranches du run).
RUN_X0, RUN_X1 = WALL_X - 96.0, WALL_X + 74.0
RUN_Y0, RUN_Y1 = -122.0, 444.0
ARROW_BOX = (778.0, 96.0, 838.0, 232.0)  # tour de tir, en retrait derrière la porte
ARROW_RAZED_BOX = (778.0, 292.0, 838.0, 400.0)  # sa ruine, en retrait derrière la brèche

# États peints dans l'ensemble + rangée-étalon de chaque état.
PAINTED = {"1": "cracked", "7": "razed"}
EXEMPLAR = {"intact": 8, "cracked": 1, "razed": 7}


def tpx(x_bp: float, y_bp: float) -> tuple[int, int]:
    return int(round((x_bp - WIN_X0) * T)), int(round((y_bp - WIN_Y0) * T))


def ghost(piece: Image.Image, w_bp: float) -> Image.Image:
    """Silhouette-guide OPAQUE (fond magenta ⇒ rien à préserver dessous)."""
    scale = (w_bp * T) / piece.width
    g = piece.resize((max(1, int(piece.width * scale)), max(1, int(piece.height * scale))), Image.LANCZOS)
    grey = ImageOps.grayscale(g)
    pale = ImageOps.colorize(grey, black=(64, 56, 64), white=(232, 226, 232)).convert("RGBA")
    pale.putalpha(g.getchannel("A"))
    return pale


def broken(piece: Image.Image, keep: float) -> Image.Image:
    """Silhouette-RUINE d'une pièce v1 : tronc bas (fraction `keep`), arête
    supérieure déchiquetée (dents déterministes) + gravats débordant au pied."""
    w, h = piece.size
    stump = piece.crop((0, int(h * (1 - keep)), w, h))
    sw, sh = stump.size
    out = Image.new("RGBA", (int(sw * 1.45), sh + max(8, sh // 8)), (0, 0, 0, 0))
    ox = (out.width - sw) // 2
    out.alpha_composite(stump, (ox, 0))
    jag = Image.new("L", out.size, 255)
    jd = ImageDraw.Draw(jag)
    teeth = [0.30, 0.10, 0.42, 0.16, 0.34, 0.08, 0.38]
    pts: list[tuple[int, int]] = [(ox - 2, 0)]
    for i, t in enumerate(teeth):
        pts.append((ox + int(sw * i / (len(teeth) - 1)), int(sh * t)))
    pts.append((ox + sw + 2, 0))
    jd.polygon(pts, fill=0)
    out.putalpha(ImageChops.multiply(out.getchannel("A"), jag))
    d = ImageDraw.Draw(out)
    base = out.height - 4
    for fx, fw, fh in ((0.04, 0.32, 0.15), (0.56, 0.38, 0.19), (0.28, 0.28, 0.11)):
        x0 = int(out.width * fx)
        d.ellipse(
            [x0, base - int(sh * fh), x0 + int(out.width * fw), base],
            fill=(168, 160, 168, 235),
            outline=(96, 86, 96, 255),
            width=3,
        )
    return out


def main() -> None:
    cells = load_v1_cells()
    tpl = Image.new("RGB", CANVAS, BG)
    d = ImageDraw.Draw(tpl)

    def place(piece: Image.Image, w_bp: float, cx_bp: float, bottom_bp: float) -> None:
        g = ghost(piece, w_bp)
        x, y = tpx(cx_bp, bottom_bp)
        tpl.paste(g, (x - g.width // 2, y - g.height), g)

    # COURTINE = UNE BANDE CONTINUE (leçon v6 : des pièces par rangée font
    # peindre des blocs empilés). Créneaux en ligne ininterrompue sur le bord
    # gauche (assaillant), fissures r1 et brèche r7 taillées DANS la bande.
    bx0 = tpx(WALL_X - 33.0, 0)[0]
    bx1 = tpx(WALL_X + 33.0, 0)[0]
    by0 = tpx(0, -26.0)[1]
    by1 = tpx(0, 382.0)[1]
    breach_y = 7 * Y_STEP
    gap_top = tpx(0, breach_y - 14.0)[1]
    gap_bot = tpx(0, breach_y + 16.0)[1]
    for y0, y1 in ((by0, gap_top), (gap_bot, by1)):
        d.rectangle([bx0, y0, bx1, y1], fill=GUIDE, outline=GUIDE_D, width=3)
    # Ligne de parapet continue (chemin de ronde), interrompue à la brèche.
    px = bx0 + (bx1 - bx0) // 3
    for y0, y1 in ((by0 + 6, gap_top - 4), (gap_bot + 4, by1 - 6)):
        d.line([(px, y0), (px, y1)], fill=GUIDE_D, width=3)
    # Dents de créneaux ininterrompues, bord gauche, hors brèche.
    t = by0 + 10
    while t < by1 - 26:
        if not (gap_top - 28 <= t <= gap_bot + 4):
            d.rectangle([bx0 - 24, t, bx0 + 2, t + 22], fill=GUIDE, outline=GUIDE_D, width=2)
        t += 48
    # Lèvres DÉCHIQUETÉES de la brèche (dents magenta taillées dans la bande)
    # + gravats qui se déversent vers le champ (ouest).
    bw = bx1 - bx0
    for edge_y, sign in ((gap_top, 1), (gap_bot, -1)):
        pts = [(bx0 - 2, edge_y)]
        for i, f in enumerate((0.28, 0.10, 0.36, 0.14, 0.30, 0.08)):
            pts.append((bx0 + int(bw * i / 5), edge_y - sign * int(bw * f * 0.5)))
        pts.append((bx1 + 2, edge_y))
        d.polygon(pts, fill=BG)
    for fx, fw, fh in ((-0.55, 0.5, 22), (0.15, 0.55, 28), (-0.2, 0.45, 16)):
        x0 = bx0 + int(bw * fx)
        d.ellipse(
            [x0, (gap_top + gap_bot) // 2 - fh, x0 + int(bw * fw), (gap_top + gap_bot) // 2 + fh],
            fill=GUIDE,
            outline=GUIDE_D,
            width=3,
        )
    # Fissures-guides EN SITUATION sur la rangée 1 (dans la bande).
    c_y = tpx(0, 1 * Y_STEP)[1]
    cxm = (bx0 + bx1) // 2
    for dx, dy in ((-40, -46), (44, -18), (-26, 42), (36, 56)):
        d.line([(cxm, c_y), (cxm + dx, c_y + dy)], fill=GUIDE_D, width=4)

    # PONT-LEVIS abaissé : tablier de bois qui descend de la porte vers
    # l'assaillant (bas-gauche) + chaînes vers le haut du gatehouse.
    gate_y = (GATE_ROWS[0] + GATE_ROWS[1]) / 2 * Y_STEP
    deck = [
        tpx(WALL_X - 34, gate_y - 8),
        tpx(WALL_X - 92, gate_y + 2),
        tpx(WALL_X - 92, gate_y + 26),
        tpx(WALL_X - 34, gate_y + 16),
    ]
    d.polygon(deck, fill=(150, 120, 92), outline=(84, 62, 44), width=4)
    for f in (0.25, 0.5, 0.75):  # planches du tablier
        x0, y0 = deck[0]
        x1, y1 = deck[1]
        x3, y3 = deck[3]
        x2, y2 = deck[2]
        d.line(
            [
                (int(x0 + (x1 - x0) * f), int(y0 + (y1 - y0) * f)),
                (int(x3 + (x2 - x3) * f), int(y3 + (y2 - y3) * f)),
            ],
            fill=(84, 62, 44),
            width=3,
        )
    for corner in (deck[1], deck[2]):  # chaînes vers le gatehouse
        d.line([corner, tpx(WALL_X - 26, gate_y - 34)], fill=GUIDE_D, width=4)

    place(cells["gate"], 96.0, WALL_X + 2, (GATE_ROWS[1] + 0.68) * Y_STEP)

    # Tours d'extrémité FUSIONNÉES, dessinées (leçon v7 : la tour-objet de la
    # planche v1, plus étroite que la bande et sans raccord, n'offrait aucune
    # notion de connexion). Ici : fût PLUS LARGE que la bande, posé sur son
    # axe — le mur disparaît DEDANS — et couronne crénelée qui prolonge la
    # ligne de créneaux du parapet.
    def fused_tower(bottom_bp: float) -> None:
        w_bp, h_bp = 84.0, 82.0
        x0 = tpx(WALL_X - w_bp / 2, 0)[0]
        x1 = tpx(WALL_X + w_bp / 2, 0)[0]
        y1 = tpx(0, bottom_bp)[1]
        y0 = tpx(0, bottom_bp - h_bp)[1]
        cx = (x0 + x1) // 2
        # Socle évasé, puis fût (léger fuselage), puis couronne débordante.
        d.ellipse([x0 - 12, y1 - 20, x1 + 12, y1 + 14], fill=GUIDE, outline=GUIDE_D, width=3)
        shaft_w = x1 - x0
        d.polygon(
            [(x0, y1), (cx - int(shaft_w * 0.42), y0 + 30), (cx + int(shaft_w * 0.42), y0 + 30), (x1, y1)],
            fill=GUIDE,
            outline=GUIDE_D,
        )
        cw = int(shaft_w * 1.05)
        cx0 = cx - cw // 2
        d.rectangle([cx0, y0 + 6, cx0 + cw, y0 + 34], fill=GUIDE, outline=GUIDE_D, width=3)
        m = cw // 7
        for i in range(4):
            mx = cx0 + int((0.4 + i * 1.8) * m)
            d.rectangle([mx, y0 - 14, mx + m, y0 + 8], fill=GUIDE, outline=GUIDE_D, width=2)
        # Meurtrière (repère d'orientation : face à l'assaillant, comme le mur).
        d.rectangle([cx - 6, y0 + 52, cx + 6, y0 + 92], fill=GUIDE_D)

    fused_tower(-8.0)
    fused_tower(406.0)
    # Tour de tir EN RETRAIT (cour, derrière la porte) + sa RUINE (derrière la
    # brèche) — à l'est de la région du run, jamais dans ses tranches.
    place(cells["arrow"], 50.0, (ARROW_BOX[0] + ARROW_BOX[2]) / 2, ARROW_BOX[3] - 4)
    place(broken(cells["arrow"], 0.55), 52.0, (ARROW_RAZED_BOX[0] + ARROW_RAZED_BOX[2]) / 2, ARROW_RAZED_BOX[3] - 4)

    # Annotations dans la marge BASSE (hors régions d'extraction).
    d.text((10, CANVAS[1] - 62), "PEINDRE l'ENSEMBLE en place - fond magenta UNI partout ailleurs", fill=INK)
    d.text((10, CANVAS[1] - 44), "tours FUSIONNEES au mur - r1 fissuree, r7 CASSEE (breche) - porte + PONT-LEVIS + chaines", fill=INK)
    d.text((10, CANVAS[1] - 26), "tours de tir EN RETRAIT (baliste au sommet) : intacte derriere la porte, RUINE derriere la breche", fill=INK)

    tpl.save(OUT_TPL)
    cuts = {
        "canvas": list(CANVAS),
        "scalePxPerBp": round(T, 5),
        "window": {"x0": WIN_X0, "y0": WIN_Y0, "w": round(WIN_W_BP, 2), "h": WIN_H_BP},
        "run": {"x0": RUN_X0, "y0": RUN_Y0, "x1": RUN_X1, "y1": RUN_Y1},
        "arrow": list(ARROW_BOX),
        "arrowRazed": list(ARROW_RAZED_BOX),
        "wallX": round(WALL_X, 2),
        "period": round(Y_STEP, 2),
        "gateRows": list(GATE_ROWS),
        "painted": PAINTED,
        "exemplar": EXEMPLAR,
    }
    OUT_CUTS.write_text(json.dumps(cuts, indent=2) + "\n")
    print(f"{OUT_TPL.name} {CANVAS} · cuts JSON")


if __name__ == "__main__":
    main()
