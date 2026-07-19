#!/usr/bin/env python3
"""
extract_siege_run.py — Découpe la planche « run de muraille » (gabarit v2,
`siege-run-template.png`, grille 2×2 : courtine / fissurée / brèche / porte).

Différence clé avec la v1 : les cellules sont des PIÈCES DE RACCORD (le mur
touche les bords haut/bas de sa cellule). L'extracteur :
  1. détoure chaque cellule (chroma-key + décontamination magenta) en gardant
     TOUTE la largeur de cellule (la bande est centrée par le gabarit ⇒
     l'ancre 0.5 du client tombe sur l'axe du mur sans mesure fragile) ;
  2. applique UNE échelle commune au kit (largeur de bande du gabarit → 66 bp) ;
  3. rend la courtine TUILABLE verticalement (roll + fondu) et découpe des
     pièces d'exactement UNE rangée (Y_STEP) ⇒ l'empilement en colonne droite
     est sans couture par construction ;
  4. cale la porte (fenêtre de 2,6 rangées centrée sur le gatehouse) ;
  5. met à jour `assets/layouts/siege-scene.json` (piece/gate) — le client lit
     le layout, aucun code à changer.

Les TOURS de la planche v1 (validées) ne sont pas touchées.

Usage :
  python3 tools/assets/extract_siege_run.py <chemin/planche.png> [--dry-run]
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
COMBAT = ROOT / "assets" / "combat"
LAYOUT = ROOT / "assets" / "layouts" / "siege-scene.json"

# Géométrie board-space (miroir de gen_siege_scene.py / hexgrid.ts).
HEX = 36.0
SQUASH = 0.68
Y_STEP = HEX * 1.5 * SQUASH  # 36.72
WALL_X = HEX * math.sqrt(3.0) * (11 + 0.25)  # 701.48
GATE_Y = Y_STEP * 4.5  # 165.24
S = 2  # px par board-px des assets

BAND_FRACTION = 0.42  # largeur de bande du gabarit (fraction de cellule)
BAND_TARGET_BP = 66.0  # largeur affichée de la courtine
GATE_WINDOW_ROWS = 2.6  # fenêtre de porte (rangées) centrée sur le gatehouse
GATE_CENTER_FRAC = 0.51  # centre vertical du gatehouse dans sa cellule (gabarit)
KEY_TOLERANCE = 92

CELLS = ["wall", "cracked", "razed", "gate"]


def keyed(cell: Image.Image) -> Image.Image:
    """Chroma-key + décontamination magenta + érosion 1 px (voir kit v1)."""
    arr = np.asarray(cell.convert("RGBA")).astype(np.int16)
    corners = np.concatenate(
        [arr[:8, :8, :3].reshape(-1, 3), arr[:8, -8:, :3].reshape(-1, 3), arr[-8:, :8, :3].reshape(-1, 3), arr[-8:, -8:, :3].reshape(-1, 3)]
    )
    bg = np.median(corners, axis=0)
    dist = np.sqrt(((arr[..., :3] - bg[None, None, :]) ** 2).sum(axis=-1))
    alpha = np.clip((dist - KEY_TOLERANCE * 0.55) / (KEY_TOLERANCE * 0.45), 0, 1)
    a3 = alpha[..., None]
    rgb = arr[..., :3].astype(np.float64)
    despilled = np.where(a3 > 0.02, np.clip((rgb - (1 - a3) * bg[None, None, :]) / np.maximum(a3, 0.02), 0, 255), rgb)
    r, g, b = despilled[..., 0], despilled[..., 1], despilled[..., 2]
    spill = np.clip(np.minimum(r, b) - g, 0, None)
    despilled[..., 0] = np.clip(r - spill * 0.72, 0, 255)
    despilled[..., 2] = np.clip(b - spill * 0.72, 0, 255)
    out = arr.copy()
    out[..., :3] = despilled.astype(np.int16)
    out[..., 3] = (alpha * 255).astype(np.int16)
    img = Image.fromarray(out.astype(np.uint8), "RGBA")
    img.putalpha(img.getchannel("A").filter(ImageFilter.MinFilter(3)))
    return img


def vtile(strip: Image.Image) -> Image.Image:
    """Rend la bande tuilable verticalement (roll demi-hauteur + fondu)."""
    w, h = strip.size
    rolled = Image.new("RGBA", (w, h))
    rolled.paste(strip.crop((0, h // 2, w, h)), (0, 0))
    rolled.paste(strip.crop((0, 0, w, h - h // 2)), (0, h // 2))
    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    edge = max(1, h // 5)
    for y in range(h):
        md.line([(0, y), (w, y)], fill=int(255 * min(1.0, min(y, h - 1 - y) / edge)))
    out = rolled.copy()
    out.paste(strip, (0, 0), mask)
    return out


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    sheet_path = Path(sys.argv[1])
    dry = "--dry-run" in sys.argv[2:]
    sheet = Image.open(sheet_path).convert("RGB")
    cell_px = sheet.width // 2
    scale = (BAND_TARGET_BP * S) / (BAND_FRACTION * cell_px)
    period = int(round(Y_STEP * S))

    outputs: dict[str, Image.Image] = {}
    for i, name in enumerate(CELLS):
        cx0 = (i % 2) * cell_px
        cy0 = (i // 2) * cell_px
        inset = int(cell_px * 0.02)
        cell = sheet.crop((cx0 + inset, cy0 + inset + 16, cx0 + cell_px - inset, cy0 + cell_px - inset))
        cut = keyed(cell)
        scaled = cut.resize((max(1, int(cut.width * scale)), max(1, int(cut.height * scale))), Image.LANCZOS)

        if name in ("wall", "cracked", "razed"):
            tiled = vtile(scaled)
            # UNE rangée exactement, fenêtre centrée (la brèche est au centre
            # de sa cellule par gabarit).
            y0 = max(0, tiled.height // 2 - period // 2)
            piece = tiled.crop((0, y0, tiled.width, y0 + period))
            key = {"wall": "siege-piece-wall.png", "cracked": "siege-piece-wall-cracked.png", "razed": "siege-piece-wall-razed.png"}[name]
            outputs[key] = piece
        else:  # gate
            win = int(GATE_WINDOW_ROWS * period)
            gy0 = int(scaled.height * GATE_CENTER_FRAC) - win // 2
            gy0 = max(0, min(gy0, scaled.height - win))
            outputs["siege-piece-gate.png"] = scaled.crop((0, gy0, scaled.width, gy0 + win))

    preview = Image.new("RGB", (sum(o.width for o in outputs.values()) + 20 * 5, max(o.height for o in outputs.values()) + 40), (96, 116, 74))
    x = 20
    for o in outputs.values():
        preview.paste(o, (x, 20), o)
        x += o.width + 20
    preview_path = sheet_path.with_name(sheet_path.stem + "-run-preview.png")
    preview.save(preview_path)
    for key, o in outputs.items():
        print(f"{key}: {o.size}")
    print(f"aperçu : {preview_path}")
    if dry:
        print("--dry-run : staging et layout non modifiés")
        return

    for key, o in outputs.items():
        o.save(COMBAT / key)
        print(f"écrit : assets/combat/{key}")
    (COMBAT / "siege-kit-source.json").write_text('{"source": "planche Gemini run v2 (combat-siege-kit.md)"}\n')

    layout = json.loads(LAYOUT.read_text())
    piece = outputs["siege-piece-wall.png"]
    gate = outputs["siege-piece-gate.png"]
    layout["piece"] = {"w": round(piece.width / S, 2), "hAbove": round(Y_STEP / 2, 2), "hBelow": round(Y_STEP / 2, 2)}
    layout["gate"] = {
        "x": round(WALL_X, 2),
        "yBottom": round(GATE_Y + (GATE_WINDOW_ROWS / 2) * Y_STEP, 2),
        "w": round(gate.width / S, 2),
        "h": round(gate.height / S, 2),
    }
    LAYOUT.write_text(json.dumps(layout, indent=2) + "\n")
    print("layout mis à jour : piece/gate (colonne DROITE, raccords 1 rangée)")


if __name__ == "__main__":
    main()
