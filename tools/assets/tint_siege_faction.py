#!/usr/bin/env python3
"""Coloration de la muraille de siège PAR FACTION assiégée (backlog
`siege-visual-overhaul` item 1).

Donne une identité de maison au rempart peint SANS repeindre la pierre : un
**split-tone pondéré par la luminance**. La pierre du run (`siege-run.png` et
consorts) est grise pure — les seuls « accents » sont les hautes lumières
(crêtes de merlons, liserés de blocs, arêtes éclairées). On y injecte la teinte
de faction (les ombres/mi-tons restent neutres) ⇒ « toits/bannières/liserés »
prennent la couleur, la masse de pierre reste crédible.

Recoloration **déterministe** (aucun RNG, arithmétique pure) façon la tour
recolorée `siege-piece-tower` du plan : désaturation légère + LUT de teinte par
faction appliquée en fonction de la luminance. Les fichiers de sortie
`<name>-<factionId>.png` sont auto-découverts par le registre client (hors
bundle JS) ; la chaîne de repli côté client retombe sur l'asset générique quand
aucune variante teintée n'existe.

Ids de faction : ce module vit dans `tools/` (hors `packages/`) ⇒ les IDs
opaques y sont autorisés (le garde-fou CI ne scanne que `packages/`). Teintes
dérivées de la palette des écus (`gen_faction_badge.py`) ; `test-faction`
exclue (placeholder, comme les scènes `siege-scene-*`).

Usage : python3 tools/assets/tint_siege_faction.py [--only haven,necropolis]
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

OUT_COMBAT = Path(__file__).resolve().parents[2] / "assets" / "combat"

# Teinte d'accent par faction (RGB) — hautes lumières du rempart assiégé.
# 6 teintes nettement séparées en TEINTE pour rester lisibles côte à côte ;
# alignées sur l'identité des écus (doc `gen_faction_badge.py`), en privilégiant
# la couleur de LORE quand le champ de l'écu est neutre (necropolis = vert
# spectral, pas le gris de son champ).
ACCENTS: dict[str, tuple[int, int, int]] = {
    "haven": (70, 120, 210),          # bleu roi (soleil/Griffon)
    "necropolis": (96, 156, 116),     # vert spectral (mort-vivant)
    "arcane-hunters": (108, 92, 194),  # indigo violet (traque)
    "sylvan-court": (196, 158, 84),   # ambre or (feuille/bois)
    "vox-arcana": (72, 170, 176),     # turquoise néon (scène/honmoon)
    "dungeon": (196, 76, 160),        # magenta (culte du serpent)
}

# Assets peints à teinter : chemin RUN live (run + bandes-étalons + tour de tir
# + ruine) ET pièces de repli (mur/tour/porte) — l'identité tient dans les deux
# modes de rendu.
SOURCES = [
    "siege-run",
    "siege-run-band-intact",
    "siege-run-band-cracked",
    "siege-run-band-razed",
    "siege-piece-arrow-tower",
    "siege-piece-arrow-tower-razed",
    "siege-piece-wall",
    "siege-piece-wall-cracked",
    "siege-piece-wall-razed",
    "siege-piece-tower",
    "siege-piece-gate",
]

# Réglages du split-tone (partagés) — calibrés au QC visuel.
DESAT = 0.78        # désaturation globale (unifie bois/mousse sous la teinte)
TINT_LO = 0.12      # teinte plancher (whisper sur toute la pierre)
TINT_HI = 0.50      # teinte plafond (hautes lumières = liserés/merlons)
RAMP_LO = 0.42      # luminance normalisée où la montée commence
RAMP_HI = 0.95      # …et sature
# Amplification de chroma autour du gris : sans elle, les teintes FROIDES
# (bleu/vert/turquoise, proches de la pierre) s'effacent quand les CHAUDES
# (magenta/ambre) ressortent — le boost égalise la lisibilité inter-faction.
CHROMA = 1.35


def _smoothstep(lo: float, hi: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - lo) / (hi - lo), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def tint(img: Image.Image, accent: tuple[int, int, int]) -> Image.Image:
    """Applique le split-tone de faction, alpha préservé, déterministe."""
    arr = np.asarray(img.convert("RGBA"), dtype=np.float32)
    rgb = arr[..., :3]
    alpha = arr[..., 3:4]

    # Luminance perçue (Rec. 601), 0..255 puis normalisée.
    lum = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    lum = lum[..., None]
    ln = lum / 255.0

    # Désaturation légère : rapproche chaque pixel de son gris.
    desat = rgb * DESAT + lum * (1.0 - DESAT)

    # Gris coloré à la teinte de faction, luminance PRÉSERVÉE : accent normalisé
    # par sa propre luminance ⇒ multiplier par `lum` conserve la brillance. Le
    # boost de chroma écarte davantage du gris (parité teintes froides/chaudes).
    acc = np.array(accent, dtype=np.float32)
    acc_lum = float(acc @ np.array([0.299, 0.587, 0.114], dtype=np.float32))
    base = (acc / max(acc_lum, 1.0)) * lum
    colorized = np.clip(lum + CHROMA * (base - lum), 0.0, 255.0)

    # Force de teinte : plancher partout, montée vers les hautes lumières.
    strength = TINT_LO + (TINT_HI - TINT_LO) * _smoothstep(RAMP_LO, RAMP_HI, ln[..., 0])
    strength = strength[..., None]

    out = desat * (1.0 - strength) + colorized * strength
    out = np.clip(out, 0.0, 255.0)
    result = np.concatenate([out, alpha], axis=-1).astype(np.uint8)
    return Image.fromarray(result, "RGBA")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--only", help="liste de factions (csv) à (re)générer")
    args = ap.parse_args()
    factions = (
        [f.strip() for f in args.only.split(",") if f.strip()]
        if args.only
        else list(ACCENTS)
    )

    for fid in factions:
        accent = ACCENTS.get(fid)
        if accent is None:
            print(f"⚠ faction inconnue (pas de teinte) : {fid} — ignorée")
            continue
        for name in SOURCES:
            src = OUT_COMBAT / f"{name}.png"
            if not src.exists():
                print(f"⚠ source absente : {src.name} — ignorée")
                continue
            tinted = tint(Image.open(src), accent)
            dst = OUT_COMBAT / f"{name}-{fid}.png"
            tinted.save(dst)
            print(f"{dst.name} {tinted.size}")


if __name__ == "__main__":
    main()
