#!/usr/bin/env python3
"""
gen_siege_run_template.py — GABARIT v2 « run de muraille » (planche Gemini).

Leçon de la v1 : des cellules-objets aux quatre côtés fermés ne peuvent PAS se
connecter. Le v2 impose des PIÈCES DE RACCORD : dans chaque cellule, la
muraille TOUCHE les bords haut et bas (elle continue hors cellule) — le run
s'assemble alors sans couture, et la porte est dessinée DANS le run avec un
seuil vers l'eau. Les tours de la planche v1 (validées) sont conservées.

Grille 2×2 (1536×1536) :
  A courtine (segment continu, coupé haut/bas)
  B courtine fissurée (même cadrage que A)
  C brèche (le mur s'effondre au centre, extrémités coupées raccordables)
  D porte intégrée au run (mur continu + gatehouse + seuil de pierre à gauche)

Usage : python3 tools/assets/gen_siege_run_template.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets" / "prompts" / "siege-run-template.png"

SHEET = 1536
CELL = SHEET // 2
BG = (255, 0, 255)
GUIDE = (188, 178, 188)
GUIDE_D = (120, 108, 120)
INK = (70, 0, 70)

BAND_W = 0.42  # largeur de la bande de mur (fraction de cellule)


def band_x(cx0: int) -> tuple[int, int]:
    x0 = cx0 + int(CELL * (0.5 - BAND_W / 2))
    return x0, x0 + int(CELL * BAND_W)


def draw_band(d: ImageDraw.ImageDraw, cx0: int, cy0: int, gaps: list[tuple[float, float]] | None = None) -> None:
    """Bande de mur pleine hauteur (touche haut ET bas de la cellule), dents de
    créneaux sur le bord gauche. `gaps` : plages verticales (fractions) SANS mur
    (effondrement) — les coupes de raccord restent aux bords."""
    x0, x1 = band_x(cx0)
    spans = [(0.0, 1.0)] if not gaps else []
    if gaps:
        cur = 0.0
        for g0, g1 in gaps:
            spans.append((cur, g0))
            cur = g1
        spans.append((cur, 1.0))
    for s0, s1 in spans:
        y0 = cy0 + int(CELL * s0)
        y1 = cy0 + int(CELL * s1)
        d.rectangle([x0, y0, x1, y1], fill=GUIDE, outline=GUIDE_D, width=3)
        # Dents de créneaux côté gauche (assaillant), régulières.
        t = y0
        while t < y1 - 18:
            d.rectangle([x0 - 26, t + 6, x0 + 2, t + 30], fill=GUIDE, outline=GUIDE_D, width=2)
            t += 56
    if gaps:
        for g0, g1 in gaps:
            gy0 = cy0 + int(CELL * g0)
            gy1 = cy0 + int(CELL * g1)
            # Tas de gravats-guide dans la plage effondrée.
            d.ellipse([x0 - 30, (gy0 + gy1) // 2 - 40, x1 + 30, (gy0 + gy1) // 2 + 52], outline=GUIDE_D, width=3)


def main() -> None:
    sheet = Image.new("RGB", (SHEET, SHEET), BG)
    d = ImageDraw.Draw(sheet)
    for i in range(4):
        cx0 = (i % 2) * CELL
        cy0 = (i // 2) * CELL
        d.rectangle([cx0 + 2, cy0 + 2, cx0 + CELL - 2, cy0 + CELL - 2], outline=(90, 0, 90), width=3)

    # A — courtine continue.
    draw_band(d, 0, 0)
    d.text((14, 10), "A COURTINE - le mur TOUCHE les bords haut et bas (il continue)", fill=INK)
    # B — fissurée (même cadrage + fissures-guides).
    draw_band(d, CELL, 0)
    bx0, bx1 = band_x(CELL)
    for k, (dx, dy) in enumerate([(-60, -90), (70, -30), (-40, 80), (55, 110)]):
        cxm = (bx0 + bx1) // 2
        d.line([cxm, CELL // 2, cxm + dx, CELL // 2 + dy], fill=GUIDE_D, width=4)
    d.text((CELL + 14, 10), "B FISSUREE - meme cadrage que A, fissures profondes", fill=INK)
    # C — brèche : effondrement central, coupes raccordables aux bords.
    draw_band(d, 0, CELL, gaps=[(0.34, 0.66)])
    d.text((14, CELL + 10), "C BRECHE - effondrement central, extremites IDENTIQUES a A", fill=INK)
    # D — porte intégrée : mur continu + gatehouse central + seuil vers l'eau.
    draw_band(d, CELL, CELL)
    gx0, gx1 = band_x(CELL)
    gm = (gx0 + gx1) // 2
    # Gatehouse : léger élargissement central.
    d.rectangle([gx0 - 44, CELL + int(CELL * 0.30), gx1 + 24, CELL + int(CELL * 0.72)], fill=GUIDE, outline=GUIDE_D, width=3)
    # Arche + vantaux, face gauche (vers l'assaillant).
    d.rounded_rectangle([gx0 - 26, CELL + int(CELL * 0.42), gm - 6, CELL + int(CELL * 0.66)], radius=18, fill=GUIDE_D)
    # Seuil de pierre : descend vers la gauche (rejoint la chaussée sur l'eau).
    d.polygon(
        [
            (gx0 - 26, CELL + int(CELL * 0.60)),
            (gx0 - 120, CELL + int(CELL * 0.64)),
            (gx0 - 120, CELL + int(CELL * 0.72)),
            (gx0 - 26, CELL + int(CELL * 0.68)),
        ],
        fill=GUIDE,
        outline=GUIDE_D,
    )
    d.text((CELL + 14, CELL + 10), "D PORTE - le mur CONTINUE haut/bas, arche a gauche + seuil de pierre", fill=INK)

    d.text((14, SHEET - 26), "Fond magenta uni - lumiere haut-gauche - vue 3/4 plongeante - le mur SORT des cellules haut/bas", fill=INK)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT)
    print(f"{OUT.relative_to(ROOT)} {sheet.size}")


if __name__ == "__main__":
    main()
