#!/usr/bin/env python3
"""
gen_siege_kit_template.py — GABARIT de la planche Gemini « kit de siège »
(option A du plan `.claude/plans/siege-visual-overhaul.md`).

Produit `assets/prompts/siege-kit-template.png` : une grille 3×2 dont chaque
cellule contient, en SILHOUETTE PÂLE, le volume EXACT de la pièce du kit
procédural actuel (mêmes proportions, mêmes contours, même ancrage). Le
générateur d'images repeint ces volumes en pierre peinte — la géométrie étant
celle déjà câblée dans le client, l'extraction (`extract_siege_kit.py`)
retombe pixel-pour-pixel sur les canvas/ancres existants : zéro changement de
code au dépôt de l'art.

Cellules : A courtine intacte · B courtine fissurée · C courtine en brèche ·
D porte (2 hexes) · E tour d'angle · F tour de tir (baliste).

Usage : python3 tools/assets/gen_siege_kit_template.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[2]
COMBAT = ROOT / "assets" / "combat"
OUT = ROOT / "assets" / "prompts" / "siege-kit-template.png"

SHEET_W, SHEET_H = 2048, 1536
COLS, ROWS = 3, 2
MARGIN = 28  # marge interne de cellule (px)

CELLS: list[tuple[str, str, str]] = [
    ("A", "siege-piece-wall.png", "COURTINE — bloc intact"),
    ("B", "siege-piece-wall-cracked.png", "COURTINE — fissurée (mêmes contours que A)"),
    ("C", "siege-piece-wall-razed.png", "BRÈCHE — moignon + gravats (même emprise)"),
    ("D", "siege-piece-gate.png", "PORTE — arche + vantaux face gauche"),
    ("E", "siege-piece-tower.png", "TOUR D'ANGLE"),
    ("F", "siege-piece-arrow-tower.png", "TOUR DE TIR — baliste au sommet"),
]

BG = (255, 0, 255)  # fond magenta uni (détourage trivial à l'extraction)
GUIDE_ALPHA = 168  # silhouettes bien lisibles : le modèle repeint CES volumes


def main() -> None:
    sheet = Image.new("RGB", (SHEET_W, SHEET_H), BG)
    d = ImageDraw.Draw(sheet)
    cw, ch = SHEET_W // COLS, SHEET_H // ROWS

    for i, (label, asset, caption) in enumerate(CELLS):
        cx0 = (i % COLS) * cw
        cy0 = (i // COLS) * ch
        d.rectangle([cx0 + 2, cy0 + 2, cx0 + cw - 2, cy0 + ch - 2], outline=(90, 0, 90), width=3)

        piece = Image.open(COMBAT / asset).convert("RGBA")
        # Ajuste la silhouette dans la cellule (marges généreuses), SANS
        # déformer : le ratio du volume est le contrat de calage.
        box_w, box_h = cw - 2 * MARGIN, ch - 2 * MARGIN - 44
        scale = min(box_w / piece.width, box_h / piece.height)
        ghost = piece.resize((int(piece.width * scale), int(piece.height * scale)), Image.LANCZOS)
        # Silhouette : niveaux de gris éclaircis + alpha réduit (guide pâle).
        grey = ImageOps.grayscale(ghost)
        pale = ImageOps.colorize(grey, black=(74, 64, 74), white=(226, 220, 226)).convert("RGBA")
        alpha = ghost.getchannel("A").point(lambda a: min(a, GUIDE_ALPHA))
        pale.putalpha(alpha)
        px = cx0 + (cw - pale.width) // 2
        py = cy0 + 30 + (ch - 44 - pale.height) // 2
        sheet.paste(pale, (px, py), pale)

        d.text((cx0 + 14, cy0 + 10), f"{label} — {caption}", fill=(70, 0, 70))

    # Rappels transverses (lisibles par l'humain qui colle le prompt).
    d.text((14, SHEET_H - 26), "Lumiere haut-gauche · vue 3/4 plongeante (sol aplati x0.68) · fond magenta uni · ne pas deborder des cellules", fill=(70, 0, 70))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT)
    print(f"{OUT.relative_to(ROOT)} {sheet.size}")


if __name__ == "__main__":
    main()
