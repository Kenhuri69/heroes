#!/usr/bin/env python3
"""
extract_siege_kit.py — Découpe la planche Gemini « kit de siège » vers les clés
d'assets existantes (option A du plan `.claude/plans/siege-visual-overhaul.md`).

Entrée : la planche générée sur le gabarit `siege-kit-template.png` (grille
3×2, fond magenta uni). Chaque cellule est détourée (chroma-key + bbox) puis
AJUSTÉE DANS LE CANVAS EXACT de la pièce du kit qu'elle remplace (mêmes
dimensions px, même ancrage) : le layout `assets/layouts/siege-scene.json` et
le client restent inchangés — déposer l'art suffit.

Usage :
  python3 tools/assets/extract_siege_kit.py <chemin/planche.png> [--dry-run]

`--dry-run` : écrit seulement `<planche>-preview.png` (contact-sheet des
découpes sur fond neutre) sans toucher au staging `assets/combat/`.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
COMBAT = ROOT / "assets" / "combat"

COLS, ROWS = 3, 2
# (cellule, clé de sortie) — l'ordre du gabarit gen_siege_kit_template.py.
CELLS: list[str] = [
    "siege-piece-wall.png",
    "siege-piece-wall-cracked.png",
    "siege-piece-wall-razed.png",
    "siege-piece-gate.png",
    "siege-piece-tower.png",
    "siege-piece-arrow-tower.png",
]
KEY_TOLERANCE = 92  # distance RGB au magenta du fond


def keyed_cutout(cell: Image.Image) -> Image.Image:
    """Détoure la cellule : chroma-key sur la couleur du coin (fond uni),
    nettoie l'alpha, recadre au contenu."""
    rgba = cell.convert("RGBA")
    arr = np.asarray(rgba).astype(np.int16)
    corners = np.concatenate(
        [arr[:8, :8, :3].reshape(-1, 3), arr[:8, -8:, :3].reshape(-1, 3), arr[-8:, :8, :3].reshape(-1, 3), arr[-8:, -8:, :3].reshape(-1, 3)]
    )
    bg = np.median(corners, axis=0)
    dist = np.sqrt(((arr[..., :3] - bg[None, None, :]) ** 2).sum(axis=-1))
    alpha = np.clip((dist - KEY_TOLERANCE * 0.55) / (KEY_TOLERANCE * 0.45), 0, 1)
    out = arr.copy()
    out[..., 3] = (alpha * 255).astype(np.int16)
    img = Image.fromarray(out.astype(np.uint8), "RGBA")
    bbox = img.getbbox()
    if bbox is None:
        raise SystemExit("cellule vide après détourage — planche invalide ?")
    return img.crop(bbox)


def fit_into(cutout: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Ajuste la découpe dans le canvas cible SANS déformer (le gabarit impose
    déjà le bon ratio ; on tolère ±qq %), centrée en X, calée au BAS (les
    pièces du kit sont ancrées par leur pied)."""
    scale = min(target_w / cutout.width, target_h / cutout.height)
    resized = cutout.resize((max(1, int(cutout.width * scale)), max(1, int(cutout.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    canvas.paste(resized, ((target_w - resized.width) // 2, target_h - resized.height), resized)
    return canvas


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    sheet_path = Path(sys.argv[1])
    dry = "--dry-run" in sys.argv[2:]
    sheet = Image.open(sheet_path).convert("RGB")
    cw, ch = sheet.width // COLS, sheet.height // ROWS

    results: list[tuple[str, Image.Image]] = []
    for i, key in enumerate(CELLS):
        cx0 = (i % COLS) * cw
        cy0 = (i // COLS) * ch
        # Marge interne : évite bordures/labels du gabarit recopiés par le modèle.
        inset = int(min(cw, ch) * 0.045)
        cell = sheet.crop((cx0 + inset, cy0 + inset + 18, cx0 + cw - inset, cy0 + ch - inset))
        cutout = keyed_cutout(cell)
        target = Image.open(COMBAT / key)
        fitted = fit_into(cutout, target.width, target.height)
        results.append((key, fitted))
        print(f"{key}: cellule {cutout.size} → canvas {fitted.size}")

    preview = Image.new("RGB", (sum(r.width for _, r in results) + 20 * (len(results) + 1), max(r.height for _, r in results) + 40), (96, 116, 74))
    x = 20
    for _, r in results:
        preview.paste(r, (x, 20), r)
        x += r.width + 20
    preview_path = sheet_path.with_name(sheet_path.stem + "-preview.png")
    preview.save(preview_path)
    print(f"aperçu : {preview_path}")

    if dry:
        print("--dry-run : staging non modifié")
        return
    for key, r in results:
        r.save(COMBAT / key)
        print(f"écrit : assets/combat/{key}")


if __name__ == "__main__":
    main()
