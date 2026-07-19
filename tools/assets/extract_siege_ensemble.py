#!/usr/bin/env python3
"""
extract_siege_ensemble.py — Découpe de l'ENSEMBLE peint sur fond magenta
(gabarit v6, `siege-ensemble-template.png`).

Entrée : la peinture générée sur le gabarit (même cadrage). Le fond magenta
uni permet le chroma-key (le pipeline de la planche v1 réussie) : toutes les
jonctions — mur↔porte↔pont-levis, mur↔tours, états — sont dans l'art.
Sorties :

  assets/combat/siege-run.png            — le RUN complet (tours fusionnées +
                                           courtine + porte + pont-levis),
                                           2 px/bp, RGBA
  assets/combat/siege-run-band-<état>.png— bandes-étalons d'1 rangée (intact/
                                           cracked/razed) découpées aux rangées
                                           étalons du tableau
  assets/combat/siege-piece-arrow-tower.png       — tour de tir (en retrait)
  assets/combat/siege-piece-arrow-tower-razed.png — sa RUINE (tour de tir cassée)
  layout `siege-scene.json` : bloc "run" (le client passe en mode tranches)

Usage :
  python3 tools/assets/extract_siege_ensemble.py <peinture.png> [--dry-run]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

from siege_kit_common import ROOT, keyed_cutout

COMBAT = ROOT / "assets" / "combat"
LAYOUT = ROOT / "assets" / "layouts" / "siege-scene.json"
CUTS = ROOT / "assets" / "layouts" / "siege-ensemble-cuts.json"

OUT_SCALE = 2.0  # px/bp des assets du jeu


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    painted_path = Path(sys.argv[1])
    dry = "--dry-run" in sys.argv[2:]
    cuts = json.loads(CUTS.read_text())
    canvas = tuple(cuts["canvas"])
    t = cuts["scalePxPerBp"]
    win = cuts["window"]

    painted = Image.open(painted_path).convert("RGB")
    if painted.size != canvas:
        painted = painted.resize(canvas, Image.LANCZOS)
    # Chroma-key du fond magenta sur le canvas ENTIER (pas de recadrage : les
    # découpes qui suivent sont géométriques, dans le repère du gabarit).
    rgba = keyed_cutout(painted, crop=False)

    def crop_bp(box: tuple[float, float, float, float], tight: bool = False) -> Image.Image:
        x0 = int((box[0] - win["x0"]) * t)
        y0 = int((box[1] - win["y0"]) * t)
        x1 = int((box[2] - win["x0"]) * t)
        y1 = int((box[3] - win["y0"]) * t)
        part = rgba.crop((x0, y0, x1, y1))
        w_out = int(round((box[2] - box[0]) * OUT_SCALE))
        h_out = int(round((box[3] - box[1]) * OUT_SCALE))
        part = part.resize((w_out, h_out), Image.LANCZOS)
        if tight:  # objet fini : recadré au contenu (ancre + hauteur côté client)
            bbox = part.getbbox()
            if bbox:
                part = part.crop(bbox)
        return part

    run_box = (cuts["run"]["x0"], cuts["run"]["y0"], cuts["run"]["x1"], cuts["run"]["y1"])
    run = crop_bp(run_box)
    period = cuts["period"]

    bands: dict[str, Image.Image] = {}
    for state, row in cuts["exemplar"].items():
        y_r = row * period
        top_px = int(round((y_r - period / 2 - cuts["run"]["y0"]) * OUT_SCALE))
        bands[state] = run.crop((0, top_px, run.width, top_px + int(round(period * OUT_SCALE))))

    arrow = crop_bp(tuple(cuts["arrow"]), tight=True)
    arrow_razed = crop_bp(tuple(cuts["arrowRazed"]), tight=True)

    outputs: list[tuple[str, Image.Image]] = [("siege-run.png", run)]
    outputs += [(f"siege-run-band-{s}.png", b) for s, b in bands.items()]
    outputs.append(("siege-piece-arrow-tower.png", arrow))
    outputs.append(("siege-piece-arrow-tower-razed.png", arrow_razed))

    preview = Image.new(
        "RGB",
        (run.width + max(arrow.width, arrow_razed.width) + 3 * 20, max(run.height, arrow.height + arrow_razed.height + 20) + 40),
        (96, 116, 74),
    )
    preview.paste(run, (20, 20), run)
    preview.paste(arrow, (run.width + 40, 20), arrow)
    preview.paste(arrow_razed, (run.width + 40, arrow.height + 40), arrow_razed)
    ppath = painted_path.with_name(painted_path.stem + "-ensemble-preview.png")
    preview.save(ppath)
    for name, im in outputs:
        print(f"{name}: {im.size}")
    print(f"aperçu : {ppath}")
    if dry:
        print("--dry-run : rien d'écrit")
        return

    for name, im in outputs:
        im.save(COMBAT / name)
        print(f"écrit : assets/combat/{name}")
    (COMBAT / "siege-kit-source.json").write_text('{"source": "ensemble magenta Gemini (combat-siege-kit.md v6)"}\n')

    layout = json.loads(LAYOUT.read_text())
    layout["run"] = {
        "x": cuts["wallX"],
        "xWest": round(cuts["wallX"] - cuts["run"]["x0"], 2),
        "topBp": cuts["run"]["y0"],
        "w": round(cuts["run"]["x1"] - cuts["run"]["x0"], 2),
        "h": round(cuts["run"]["y1"] - cuts["run"]["y0"], 2),
        "period": period,
        "painted": cuts["painted"],
        "gateRows": cuts["gateRows"],
    }
    LAYOUT.write_text(json.dumps(layout, indent=2) + "\n")
    print("layout : bloc run écrit — le client passe en mode tranches")


if __name__ == "__main__":
    main()
