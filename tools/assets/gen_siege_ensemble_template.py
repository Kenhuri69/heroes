#!/usr/bin/env python3
"""
gen_siege_ensemble_template.py — GABARIT v8 : PLAN VUE DE DESSUS de l'ensemble
de la muraille sur fond MAGENTA (itération 9, exigence porteur).

Leçons cumulées :
  - approche ENSEMBLE : tout assemblé, avec les connexions — jamais d'objet
    isolé (« la tour seule c'est de la merde ») ;
  - fond MAGENTA uni : extraction chroma-key (pipeline de la planche v1) ;
  - peinture v6 rejetée (« les murs ne se connectent pas ») : guides par
    rangée ⇒ blocs empilés ;
  - guides pseudo-3D v7 rejetés (« tout est dégueulasse ») : les volumes
    dessinés (cylindres, trapèzes) sont laids ET ambigus pour le modèle.

v8 : le gabarit est un PLAN — la VUE DE DESSUS des empreintes au sol,
géométrie pure sans aucun volume : bande de courtine continue, CERCLES de
tours qui CHEVAUCHENT la bande (fusion évidente en plan), porte en travers
de l'axe + pont-levis, brèche taillée dans la bande, tours de tir en retrait.
C'est le PROMPT qui demande la profondeur : peindre en vue de dessus avec
une PETITE INCLINAISON (léger basculement donnant hauteur et faces).

Sorties :
  assets/prompts/siege-ensemble-template.png — le plan-gabarit 1152×2048,
    ancré exactement sur la géométrie moteur (rangées, porte rangées 4-5,
    axe du mur).
  assets/layouts/siege-ensemble-cuts.json — géométrie de découpe consommée
    par extract_siege_ensemble.py (aucune constante dupliquée).

Usage : python3 tools/assets/gen_siege_ensemble_template.py
"""

from __future__ import annotations

import json
import math

from PIL import Image, ImageDraw

from siege_kit_common import GATE_ROWS, ROOT, WALL_X, Y_STEP

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
GUIDE_L = (214, 208, 214)
GUIDE_D = (110, 98, 110)
WOOD = (150, 120, 92)
WOOD_D = (84, 62, 44)
INK = (70, 0, 70)

# Région du RUN (extraction) et boîtes des tours de tir (board-space).
# Calées sur la peinture v8 mesurée : le run va de BORD À BORD (l'enceinte se
# referme hors champ), s'étend à l'ouest jusqu'aux gravats déversés de la
# brèche et s'arrête à l'est entre la porte (759.5) et la pointe de baliste
# (765.2). Les boîtes des tours de tir sont EXCLUES du run à l'extraction.
RUN_X0, RUN_X1 = WALL_X - 136.0, WALL_X + 61.0
RUN_Y0, RUN_Y1 = -130.0, 470.0
ARROW_BOX = (763.0, 118.0, 858.0, 224.0)  # tour de tir, en retrait derrière la porte
ARROW_RAZED_BOX = (752.0, 312.0, 858.0, 420.0)  # sa ruine, en retrait derrière la brèche

# États peints dans l'ensemble + rangée-étalon de chaque état. L'étalon
# INTACT est la rangée 3 : la seule hors de toute contamination (fissures
# jusqu'à ~90 bp, porte dès 130, gravats de brèche 214..312 bp).
PAINTED = {"1": "cracked", "7": "razed"}
EXEMPLAR = {"intact": 3, "cracked": 1, "razed": 7}
# Zones de dégât peintes EN SITUATION : le dégât du tableau déborde sur les
# rangées voisines de sa rangée-étalon (gravats, lèvres, cailloux épars) ⇒
# côté client la zone entière bascule d'un bloc (tableau si l'étalon a
# VRAIMENT cet état, bandes propres sinon). Bornes mesurées sur la peinture
# v8 ; r3 (étalon intact) peut appartenir à la zone fissurée : bande = elle-même.
ZONES = {"cracked": [1, 3], "razed": [6, 9]}

# Empreintes (board-space).
BAND_HALF_W = 30.0  # demi-largeur de la courtine en plan
TOWER_R = 42.0  # rayon des tours d'extrémité (chevauchent la bande)
ARROW_R = 26.0  # rayon des tours de tir


def tpx(x_bp: float, y_bp: float) -> tuple[int, int]:
    return int(round((x_bp - WIN_X0) * T)), int(round((y_bp - WIN_Y0) * T))


def main() -> None:
    tpl = Image.new("RGB", CANVAS, BG)
    d = ImageDraw.Draw(tpl)

    def circle(cx_bp: float, cy_bp: float, r_bp: float, fill: tuple[int, int, int], width: int = 4) -> None:
        x0, y0 = tpx(cx_bp - r_bp, cy_bp - r_bp)
        x1, y1 = tpx(cx_bp + r_bp, cy_bp + r_bp)
        d.ellipse([x0, y0, x1, y1], fill=fill, outline=GUIDE_D, width=width)

    # --- COURTINE : bande continue DE BORD À BORD de l'image (fidélité
    # HoMM3 : l'enceinte se referme HORS CHAMP — le mur entre par le haut,
    # sort par le bas, les tours sont des points de passage SUR le mur).
    # Brèche r7 taillée dedans.
    bx0 = tpx(WALL_X - BAND_HALF_W, 0)[0]
    bx1 = tpx(WALL_X + BAND_HALF_W, 0)[0]
    by0 = 0
    by1 = CANVAS[1]
    breach_y = 7 * Y_STEP
    gap_top = tpx(0, breach_y - 13.0)[1]
    gap_bot = tpx(0, breach_y + 15.0)[1]
    for y0, y1 in ((by0, gap_top), (gap_bot, by1)):
        d.rectangle([bx0, y0, bx1, y1], fill=GUIDE, outline=GUIDE_D, width=4)
    # Chemin de ronde (bande intérieure plus claire, file d'une traite).
    in0 = bx0 + (bx1 - bx0) // 4
    in1 = bx1 - (bx1 - bx0) // 4
    for y0, y1 in ((by0, gap_top - 2), (gap_bot + 2, by1)):
        d.rectangle([in0, y0, in1, y1], fill=GUIDE_L)
    # Merlons : dents régulières sur le bord OUEST (assaillant), en plan —
    # interrompues seulement par la brèche et sous les tours (couronnes).
    tower_pxs = [tpx(0, cy)[1] for cy in (-30.0, 396.0)]
    tower_r_px = int(TOWER_R * T)
    t = by0 + 6
    while t < by1 - 20:
        in_breach = gap_top - 24 <= t <= gap_bot + 2
        in_tower = any(cy - tower_r_px - 4 <= t <= cy + tower_r_px - 12 for cy in tower_pxs)
        if not in_breach and not in_tower:
            d.rectangle([bx0 - 16, t, bx0 + 3, t + 16], fill=GUIDE, outline=GUIDE_D, width=2)
        t += 34
    # Lèvres déchiquetées de la brèche + gravats (blobs) déversés vers l'ouest.
    bw = bx1 - bx0
    for edge_y, sign in ((gap_top, 1), (gap_bot, -1)):
        pts = [(bx0 - 2, edge_y)]
        for i, f in enumerate((0.26, 0.08, 0.34, 0.12, 0.28, 0.06)):
            pts.append((bx0 + int(bw * i / 5), edge_y - sign * int(bw * f * 0.6)))
        pts.append((bx1 + 2, edge_y))
        d.polygon(pts, fill=BG)
    for fx, fy, fw, fh in ((-0.62, -4, 0.5, 16), (0.10, 6, 0.55, 20), (-0.25, 22, 0.42, 13), (0.55, -14, 0.35, 12)):
        x0 = bx0 + int(bw * fx)
        cy = (gap_top + gap_bot) // 2 + fy
        d.ellipse([x0, cy - fh, x0 + int(bw * fw), cy + fh], fill=GUIDE, outline=GUIDE_D, width=3)
    # Fissures r1, EN SITUATION dans la bande.
    c_y = tpx(0, 1 * Y_STEP)[1]
    cxm = (bx0 + bx1) // 2
    for dx, dy in ((-34, -40), (38, -14), (-22, 36), (30, 48)):
        d.line([(cxm, c_y), (cxm + dx, c_y + dy)], fill=GUIDE_D, width=4)

    # --- PORTE : gatehouse en travers de l'axe + PONT-LEVIS vers l'ouest. ---
    gate_y = (GATE_ROWS[0] + GATE_ROWS[1]) / 2 * Y_STEP
    gx0, gy0 = tpx(WALL_X - 48.0, gate_y - 36.0)
    gx1, gy1 = tpx(WALL_X + 48.0, gate_y + 36.0)
    d.rectangle([gx0, gy0, gx1, gy1], fill=GUIDE, outline=GUIDE_D, width=4)
    d.rectangle([gx0 + 10, gy0 + 10, gx1 - 10, gy1 - 10], fill=GUIDE_L, outline=GUIDE_D, width=2)
    # Passage : couloir clair dans l'axe est-ouest (le tunnel de la porte).
    px0, py0 = tpx(WALL_X - 48.0, gate_y - 13.0)
    px1, py1 = tpx(WALL_X + 48.0, gate_y + 13.0)
    d.rectangle([px0, py0, px1, py1], fill=(232, 226, 232), outline=GUIDE_D, width=2)
    # Vantaux (double battant) sur la face ouest.
    d.line([tpx(WALL_X - 48.0, gate_y - 13.0), tpx(WALL_X - 40.0, gate_y)], fill=WOOD_D, width=6)
    d.line([tpx(WALL_X - 48.0, gate_y + 13.0), tpx(WALL_X - 40.0, gate_y)], fill=WOOD_D, width=6)
    # Pont-levis abaissé : tablier de bois attaché à la face ouest.
    dk0, dv0 = tpx(WALL_X - 106.0, gate_y - 14.0)
    dk1, dv1 = tpx(WALL_X - 48.0, gate_y + 14.0)
    d.rectangle([dk0, dv0, dk1, dv1], fill=WOOD, outline=WOOD_D, width=4)
    for f in (0.25, 0.5, 0.75):
        x = dk0 + int((dk1 - dk0) * f)
        d.line([(x, dv0), (x, dv1)], fill=WOOD_D, width=3)

    # --- TOURS D'EXTRÉMITÉ : cercles qui CHEVAUCHENT la bande (fusion). ---
    for cy_bp in (-30.0, 396.0):
        circle(WALL_X, cy_bp, TOWER_R, GUIDE)
        circle(WALL_X, cy_bp, TOWER_R * 0.62, GUIDE_L, width=3)
        # Merlons radiaux (couronne) : ticks autour du cercle.
        cx_px, cy_px = tpx(WALL_X, cy_bp)
        r_px = TOWER_R * T
        for k in range(12):
            a = k * math.pi / 6
            x0 = cx_px + int(math.cos(a) * r_px * 0.86)
            y0 = cy_px + int(math.sin(a) * r_px * 0.86)
            x1 = cx_px + int(math.cos(a) * r_px * 1.02)
            y1 = cy_px + int(math.sin(a) * r_px * 1.02)
            d.line([(x0, y0), (x1, y1)], fill=GUIDE_D, width=5)

    # --- TOURS DE TIR en retrait (cercles + baliste vue de dessus). ---
    ax = (ARROW_BOX[0] + ARROW_BOX[2]) / 2
    ay = (ARROW_BOX[1] + ARROW_BOX[3]) / 2 + 10
    circle(ax, ay, ARROW_R, GUIDE)
    circle(ax, ay, ARROW_R * 0.6, GUIDE_L, width=3)
    # Baliste : arc (corde vers l'est) + trait de flèche pointé vers l'OUEST.
    acx, acy = tpx(ax, ay)
    ar = ARROW_R * T
    d.arc([acx - int(ar * 0.66), acy - int(ar * 0.66), acx + int(ar * 0.66), acy + int(ar * 0.66)], 110, 250, fill=WOOD_D, width=6)
    d.line([(acx + int(ar * 0.2), acy - int(ar * 0.55)), (acx + int(ar * 0.2), acy + int(ar * 0.55))], fill=WOOD_D, width=4)
    d.line([(acx + int(ar * 0.2), acy), (acx - int(ar * 1.15), acy)], fill=WOOD_D, width=6)

    # Ruine de tour de tir : cercle brisé (arcs), gravats, épave de baliste.
    rx = (ARROW_RAZED_BOX[0] + ARROW_RAZED_BOX[2]) / 2
    ry = (ARROW_RAZED_BOX[1] + ARROW_RAZED_BOX[3]) / 2 + 6
    rcx, rcy = tpx(rx, ry)
    rr = ARROW_R * T
    d.pieslice([rcx - int(rr), rcy - int(rr), rcx + int(rr), rcy + int(rr)], 70, 320, fill=GUIDE, outline=GUIDE_D, width=4)
    for fx, fy, fw, fh in ((-1.3, 0.5, 0.8, 0.30), (0.45, 0.75, 0.7, 0.26), (-0.4, 1.05, 0.55, 0.22)):
        d.ellipse(
            [rcx + int(rr * fx), rcy + int(rr * fy) - int(rr * fh), rcx + int(rr * (fx + fw)), rcy + int(rr * fy) + int(rr * fh)],
            fill=GUIDE,
            outline=GUIDE_D,
            width=3,
        )
    d.line([(rcx - int(rr * 0.8), rcy - int(rr * 0.3)), (rcx + int(rr * 0.5), rcy + int(rr * 0.4))], fill=WOOD_D, width=5)
    d.line([(rcx - int(rr * 0.2), rcy + int(rr * 0.5)), (rcx + int(rr * 0.3), rcy - int(rr * 0.55))], fill=WOOD_D, width=5)

    # Annotations dans la marge OUEST (hors régions d'extraction — la bande
    # atteint désormais les bords haut/bas).
    for i, line in enumerate(
        (
            "PLAN VUE DE DESSUS (empreintes au sol) - fond magenta UNI",
            "peindre avec profondeur + LEGERE inclinaison",
            "le mur TRAVERSE les tours et continue jusqu'aux bords",
            "haut/bas (enceinte fermee hors champ)",
            "r1 fissuree - r7 CASSEE (breche) - porte + PONT-LEVIS bois",
            "tours de tir EN RETRAIT : intacte / RUINE",
        )
    ):
        d.text((10, 8 + i * 18), line, fill=INK)

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
        "zones": ZONES,
    }
    OUT_CUTS.write_text(json.dumps(cuts, indent=2) + "\n")
    print(f"{OUT_TPL.name} {CANVAS} · cuts JSON")


if __name__ == "__main__":
    main()
