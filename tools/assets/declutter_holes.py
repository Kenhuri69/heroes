#!/usr/bin/env python3
"""Retire les résidus de fond enclavés d'un sprite déjà détouré (RGBA).

Le détourage par remplissage depuis les bords (`sheet_extract.py`) laisse les
poches de fond gris plat (`#c8c8c8`, doc 12 §4) ENTIÈREMENT entourées par le
sujet : triangle intérieur d'un arc, espace entre les jambes d'une monture,
entre les poutres d'une machine de guerre, halo enclos par un ruban de magie.
`rembg` n'aide pas (le fond global est déjà retiré) — ici on cible les trous.

Discriminateur sûr (préserve os de squelette / argent d'armure) : une région
n'est retirée que si elle est à la fois **neutre** (chroma faible), dans la
**bande de valeur** du gris de planche, **plate** (faible variance locale),
d'**aire** suffisante et **enclavée** (bordure entourée de sujet, ≠ silhouette).

Usage :
    # aperçu (n'écrit rien, produit un overlay QC magenta par fichier) :
    python3 tools/assets/declutter_holes.py --src 'assets/units/**/*.png' --dry-run
    # application en place :
    python3 tools/assets/declutter_holes.py --src 'assets/units/**/*.png' --apply
"""
import argparse
import glob
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import label, uniform_filter, binary_dilation


def hole_mask(im, chroma_max, vlo, vhi, flat_std, min_area, enclosure):
    """Masque booléen des poches de fond enclavées. im: HxWx4 uint8."""
    a = im[..., 3]
    rgb = im[..., :3].astype(np.float32)
    opaque = a > 32
    if not opaque.any():
        return np.zeros(a.shape, bool)
    chroma = rgb.max(2) - rgb.min(2)
    val = rgb.mean(2)
    mean = uniform_filter(val, 5)
    var = np.maximum(uniform_filter(val * val, 5) - mean * mean, 0)
    std = np.sqrt(var)
    cand = opaque & (chroma <= chroma_max) & (val >= vlo) & (val <= vhi) & (std <= flat_std)
    lbl, n = label(cand)
    keep = np.zeros(a.shape, bool)
    if n == 0:
        return keep
    transp_dil = binary_dilation(~opaque, iterations=1)
    for li in range(1, n + 1):
        comp = lbl == li
        if int(comp.sum()) < min_area:
            continue
        border = binary_dilation(comp, iterations=1) & ~comp
        btot = int(border.sum())
        if btot == 0:
            continue
        encl = 1.0 - int((border & transp_dil).sum()) / btot
        if encl >= enclosure:
            keep |= comp
    return keep


def _checker(shape, sq=12):
    H, W = shape
    chk = np.zeros((H, W, 3), np.uint8)
    yy, xx = np.mgrid[0:H, 0:W]
    even = ((xx // sq + yy // sq) % 2 == 0)
    chk[even] = (205, 205, 205)
    chk[~even] = (150, 150, 150)
    return chk


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--src", required=True, help="glob des PNG RGBA à traiter")
    ap.add_argument("--chroma-max", type=float, default=12.0)
    ap.add_argument("--vlo", type=float, default=172.0)
    ap.add_argument("--vhi", type=float, default=214.0)
    ap.add_argument("--flat-std", type=float, default=9.0)
    ap.add_argument("--min-area", type=int, default=180)
    ap.add_argument("--enclosure", type=float, default=0.90)
    ap.add_argument("--grow", type=int, default=1,
                    help="dilatation du masque pour absorber le liseré anti-aliasé")
    ap.add_argument("--apply", action="store_true", help="écrit les PNG en place")
    ap.add_argument("--dry-run", action="store_true", help="produit un overlay QC, n'écrit pas")
    ap.add_argument("--qc-dir", default="/tmp/declutter_qc", help="dossier des overlays QC")
    args = ap.parse_args()

    if not (args.apply or args.dry_run):
        ap.error("préciser --apply ou --dry-run")

    files = sorted(glob.glob(args.src, recursive=True))
    if not files:
        print(f"aucun fichier pour {args.src!r}", file=sys.stderr)
        return 1

    import os
    if args.dry_run:
        os.makedirs(args.qc_dir, exist_ok=True)

    touched = 0
    for f in files:
        im = np.asarray(Image.open(f).convert("RGBA")).copy()
        mask = hole_mask(im, args.chroma_max, args.vlo, args.vhi,
                         args.flat_std, args.min_area, args.enclosure)
        if not mask.any():
            continue
        grown = binary_dilation(mask, iterations=args.grow) if args.grow > 0 else mask
        # ne jamais toucher un pixel déjà transparent
        grown &= im[..., 3] > 32
        px = int(grown.sum())
        touched += 1
        if args.dry_run:
            ov = im.copy()
            ov[grown] = (255, 0, 255, 255)
            chk = _checker(im.shape[:2])
            bg = Image.fromarray(chk, "RGB").convert("RGBA")
            bg.alpha_composite(Image.fromarray(ov, "RGBA"))
            out = os.path.join(args.qc_dir, os.path.basename(f))
            bg.convert("RGB").save(out)
            print(f"DRY  {f}  -{px}px  qc={out}")
        else:
            im[..., 3] = np.where(grown, 0, im[..., 3])
            Image.fromarray(im, "RGBA").save(f)
            print(f"FIX  {f}  -{px}px")

    print(f"\n{touched}/{len(files)} fichier(s) avec résidu enclavé.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
