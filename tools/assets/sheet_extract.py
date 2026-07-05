#!/usr/bin/env python3
"""sheet_extract.py — découpe FIABLE d'une planche d'assets (grille N×M générée
par LLM image : Gemini / Copilot / Nano Banana) en PNG transparents, centrés,
prêts pour le staging `assets/` (règles A/C de docs/12-assets-style-guide.md).

Porté du projet Hogwarth (kenhuri69/hogwarth, tools/sheet_extract.py), qui a
validé cette passe en production. Corrige les deux défauts d'un découpage naïf :
  1. BAVE DE VOISIN : une cellule rigide capture un bout du sujet d'à côté.
     → on SUPPRIME tout composant connexe qui touche le bord de la cellule
       (un sujet bien cadré ne touche pas le bord ; une bave de couture, si).
  2. DÉCENTRAGE : centrer sur la bbox de TOUS les pixels opaques inclut la
     bave. → on centre sur la bbox du SUJET nettoyé uniquement.

Détourage du fond :
  - `--method floodfill` (défaut) : fond plat (gris clair #c8c8c8 exigé par le
    guide), retiré par remplissage depuis les bords. Déterministe, bords nets.
  - `--method rembg` : segmentation U²-Net (modèle ~176 Mo téléchargé au
    1er run) pour une source à fond chargé. Plus lent, bords plus mous.

Portes de QUALITÉ (un livrable défaillant N'EST PAS écrit) :
  - sujet non vide ;
  - marge réelle ≥ --margin (le sujet ne touche pas le bord du canvas) ;
  - couverture opaque ∈ [3 %, 85 %] (ni vide, ni débordant) ;
  - bave détectée (composant touchant le bord, retiré) → signalé ;
  - rapport texte + planche QC (fond damier) écrits dans --qc.
  Code de sortie 1 si au moins un id échoue — ne JAMAIS committer un FAIL.

Exemple :
  python3 tools/assets/sheet_extract.py planche.png --cols 4 --rows 2 \
    --ids t1-conscrit,t2-archer,... --out assets/raster_src --qc /tmp/qc.png
"""
import argparse, os, sys
import numpy as np
from PIL import Image
from scipy.ndimage import label, binary_erosion

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", ".."))


def _autocrop_alpha(rgba, thr=32):
    """bbox des pixels opaques ; None si vide."""
    a = rgba[..., 3]
    ys, xs = np.where(a > thr)
    if len(xs) == 0:
        return None
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def _floodfill_alpha(cell, tol):
    """Alpha par remplissage depuis les bords (fond plat). cell: HxWx3 uint8."""
    a = cell.astype(np.int16)
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    ref = np.median(border.reshape(-1, 3), axis=0)
    dist = np.sqrt(((a - ref) ** 2).sum(2))
    bg = dist < tol
    lbl, _ = label(bg)
    keep = set(lbl[0]).union(lbl[-1]).union(lbl[:, 0]).union(lbl[:, -1])
    keep.discard(0)
    fg = ~np.isin(lbl, list(keep))
    return (fg * 255).astype(np.uint8), tuple(int(x) for x in ref)


def _rembg_alpha(cell, _session):
    out = np.asarray(_remove(Image.fromarray(cell, "RGB"), session=_session))
    return out[..., 3].copy(), None


_remove = None
def _get_rembg_session(model):
    global _remove
    from rembg import remove, new_session
    _remove = remove
    return new_session(model)


def _clean_subject(alpha, min_area_frac, erode):
    """Retire (a) les composants touchant le bord = bave de voisin, (b) les
    micro-composants < min_area_frac. Retourne (mask uint8, infos QC)."""
    H, W = alpha.shape
    fg = alpha > 32
    if erode > 0:
        fg = binary_erosion(fg, iterations=erode)
    lbl, n = label(fg)
    info = {"components_raw": int(n), "bleed_removed": 0, "specks_removed": 0}
    if n == 0:
        return np.zeros_like(alpha), info
    border_labels = set(lbl[0]).union(lbl[-1]).union(lbl[:, 0]).union(lbl[:, -1])
    border_labels.discard(0)
    areas = np.bincount(lbl.ravel())
    min_area = max(1, int(min_area_frac * H * W))
    keep = np.zeros_like(alpha, dtype=bool)
    kept = 0
    for li in range(1, n + 1):
        a = int(areas[li])
        if li in border_labels:
            info["bleed_removed"] += 1
            continue
        if a < min_area:
            info["specks_removed"] += 1
            continue
        keep |= (lbl == li)
        kept += 1
    info["components_kept"] = kept
    return np.where(keep, alpha, 0).astype(np.uint8), info


def _center_on_canvas(cell_rgb, mask, side, margin):
    """Place le sujet (cell_rgb masqué par mask) centré sur un canvas side²
    transparent, marge `margin` (fraction). Retourne (PIL RGBA, qc)."""
    rgba = np.dstack([cell_rgb, mask])
    bb = _autocrop_alpha(rgba)
    if bb is None:
        return None, {"empty": True}
    x0, y0, x1, y1 = bb
    sub = Image.fromarray(rgba[y0:y1, x0:x1], "RGBA")
    inner = int(side * (1 - 2 * margin))
    w, h = sub.size
    scale = min(inner / w, inner / h)
    sub = sub.resize((max(1, round(w * scale)), max(1, round(h * scale))),
                     Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ox, oy = (side - sub.size[0]) // 2, (side - sub.size[1]) // 2
    canvas.alpha_composite(sub, (ox, oy))
    arr = np.asarray(canvas)
    bb2 = _autocrop_alpha(arr)
    realm = min(bb2[0], bb2[1], side - bb2[2], side - bb2[3]) / side
    cov = float((arr[..., 3] > 32).sum()) / (side * side)
    return canvas, {"empty": False, "margin": round(realm, 3), "coverage": round(cov, 3)}


def _checker(side, sq=16):
    c = np.zeros((side, side, 3), np.uint8)
    for y in range(0, side, sq):
        for x in range(0, side, sq):
            c[y:y+sq, x:x+sq] = 90 if ((x//sq + y//sq) % 2 == 0) else 130
    return c


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sheet")
    ap.add_argument("--cols", type=int, required=True)
    ap.add_argument("--rows", type=int, required=True)
    ap.add_argument("--ids", required=True, help="liste d'ids séparés par des virgules, ordre row-major")
    ap.add_argument("--method", choices=["floodfill", "rembg"], default="floodfill")
    ap.add_argument("--rembg-model", default="u2net")
    ap.add_argument("--tol", type=float, default=42.0, help="tolérance floodfill (couleur)")
    ap.add_argument("--inset", type=float, default=0.02, help="rognage de cellule (fraction) pour éviter les coutures")
    ap.add_argument("--erode", type=int, default=1, help="érosion alpha (px) pour tuer le liseré AA")
    ap.add_argument("--min-area", type=float, default=0.004, help="aire mini d'un composant gardé (fraction de cellule)")
    ap.add_argument("--margin", type=float, default=0.10, help="marge du canvas final (fraction)")
    ap.add_argument("--side", type=int, default=512)
    ap.add_argument("--out", default=os.path.join(REPO, "assets", "raster_src"))
    ap.add_argument("--qc", default="/tmp/sheet_qc.png")
    args = ap.parse_args()

    ids = [s.strip() for s in args.ids.split(",") if s.strip()]
    if len(ids) > args.cols * args.rows:
        print(f"!! {len(ids)} ids > {args.cols*args.rows} cellules", file=sys.stderr)
        return 2
    sheet = np.asarray(Image.open(args.sheet).convert("RGB"))
    H, W, _ = sheet.shape
    cw, ch = W // args.cols, H // args.rows
    session = _get_rembg_session(args.rembg_model) if args.method == "rembg" else None
    os.makedirs(args.out, exist_ok=True)

    results, fails = [], 0
    thumbs = []
    for i, id_ in enumerate(ids):
        r, c = divmod(i, args.cols)
        inx = int(cw * args.inset); iny = int(ch * args.inset)
        cell = sheet[r*ch+iny:(r+1)*ch-iny, c*cw+inx:(c+1)*cw-inx]
        if args.method == "floodfill":
            alpha, _ref = _floodfill_alpha(cell, args.tol)
        else:
            alpha, _ref = _rembg_alpha(cell, session)
        mask, info = _clean_subject(alpha, args.min_area, args.erode)
        canvas, qc = _center_on_canvas(cell, mask, args.side, args.margin)
        status = "PASS"; notes = []
        if qc.get("empty"):
            status = "FAIL"; notes.append("sujet vide")
        else:
            if qc["margin"] < args.margin - 0.01:
                status = "FAIL"; notes.append(f"marge {qc['margin']:.2f}<{args.margin}")
            if qc["coverage"] < 0.03:
                status = "FAIL"; notes.append(f"couverture {qc['coverage']:.2f} trop faible")
            if qc["coverage"] > 0.85:
                status = "FAIL"; notes.append(f"couverture {qc['coverage']:.2f} trop forte")
            if info["bleed_removed"] > 0:
                notes.append(f"bave retirée×{info['bleed_removed']}")
            if info["components_kept"] > 3:
                notes.append(f"{info['components_kept']} composants (aura/fragmenté?)")
        if status == "FAIL":
            fails += 1
        else:
            canvas.save(os.path.join(args.out, f"{id_}.png"))
        results.append((id_, status, qc, info, notes))
        # vignette QC (sur damier)
        side = args.side
        thumb = Image.fromarray(_checker(side), "RGB").convert("RGBA")
        if canvas is not None:
            thumb.alpha_composite(canvas)
        thumbs.append((id_, status, thumb.resize((128, 128))))
        print(f"  {id_:30s} {status:4s} {qc} {info} {' '.join(notes)}")

    # planche QC
    from PIL import ImageDraw
    cols = min(5, len(thumbs)); rows = (len(thumbs)+cols-1)//cols; cell=140
    qcimg = Image.new("RGB", (cols*cell, rows*cell+8), (24, 24, 28))
    d = ImageDraw.Draw(qcimg)
    for i, (id_, status, th) in enumerate(thumbs):
        x, y = (i % cols)*cell+6, (i//cols)*cell+6
        col = (60, 200, 90) if status == "PASS" else (220, 60, 60)
        d.rectangle([x-2, y-2, x+130, y+130], outline=col, width=2)
        qcimg.paste(th.convert("RGB"), (x, y))
        d.text((x, y+128), id_[:18], fill=col)
    qcimg.save(args.qc)
    print(f"\nQC → {args.qc}   ({len(ids)-fails}/{len(ids)} PASS, {fails} FAIL)")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
