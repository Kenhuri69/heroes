"""Fonctions partagées du pipeline « kit de siège » (gabarit/extraction).

Importé par gen_siege_ensemble_template.py et extract_siege_ensemble.py
(exécutés depuis la racine : sys.path[0] = ce dossier ⇒ import direct).
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SHEET_V1 = ROOT / "assets" / "prompts" / "_incoming" / "siege-kit.png"

# Géométrie board-space (miroir de render/hexgrid.ts).
HEX = 36.0
SQUASH = 0.68
HEX_W = HEX * math.sqrt(3.0)
Y_STEP = HEX * 1.5 * SQUASH  # 36.72
ROWS = 10
WALL_COL = 11
WALL_X = HEX_W * (WALL_COL + 0.25)  # 701.48
GATE_ROWS = (4, 5)

KEY_TOLERANCE = 92


def keyed_cutout(cell: Image.Image) -> Image.Image:
    """Chroma-key fond uni (couleur des coins) + décontamination magenta
    (unpremultiply + suppression de dominante) + érosion 1 px, recadré."""
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
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def load_v1_cells() -> dict[str, Image.Image]:
    """Les 6 découpes de la planche v1 (validée) — servent de silhouettes."""
    sheet = Image.open(SHEET_V1).convert("RGB")
    cw, ch = sheet.width // 3, sheet.height // 2
    names = ["wall", "cracked", "razed", "gate", "tower", "arrow"]
    cells: dict[str, Image.Image] = {}
    for i, name in enumerate(names):
        cx0 = (i % 3) * cw
        cy0 = (i // 3) * ch
        inset = int(min(cw, ch) * 0.045)
        cells[name] = keyed_cutout(sheet.crop((cx0 + inset, cy0 + inset + 18, cx0 + cw - inset, cy0 + ch - inset)))
    return cells
