#!/usr/bin/env python3
"""
process_sprite.py — Pipeline de traitement d'une image unique générée par LLM
(sprite d'unité, avatar, icône isolée) : détourage rembg, trim, recentrage
carré avec marge, resize, contrôle qualité.

Porté du projet Hogwarth (tools/process_monster_png.py). Aligné sur
docs/12-assets-style-guide.md — Règle A (sprites 512², marge 8 %, alpha strict)
et critères d'acceptation §8. Pour une PLANCHE N×M, utiliser sheet_extract.py.

Usage :
    python3 tools/assets/process_sprite.py \
        --src /chemin/vers/image_generee.png \
        --id  t4-griffon \
        --dest assets/units/haven

Options :
    --model birefnet|u2net   modèle rembg (birefnet = translucides ; default)
    --margin 0.08            marge intérieure relative
    --side 512               taille finale carrée (256 pour un avatar)
    --dry-run                écrit dans /tmp/<id>_check.png

Le script imprime un récap des critères et exit non-zero si un critère
bloquant échoue (alpha 0 % ou poids > 700 KB).

Prérequis LOURD à la demande (modèle ~176 Mo au 1er run) :
    python3 -m pip install "rembg[cpu]" onnxruntime
"""

from __future__ import annotations
import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DEST_DIR  = REPO_ROOT / "assets" / "units"

# Seuils durs : exit 1 si dépassés
HARD_MAX_KB      = 700
SOFT_MAX_KB      = 350      # warning au-delà
MIN_ALPHA0_PCT   = 5        # < 5 % de fond transparent → fond opaque non détouré
MIN_ALPHA255_PCT = 10
MIN_OCC          = 0.50
MAX_OCC          = 0.95


def color(s: str, c: str) -> str:
    codes = {"g": "32", "r": "31", "y": "33", "b": "34", "d": "2"}
    return f"\033[{codes.get(c, '0')}m{s}\033[0m" if sys.stdout.isatty() else s


def check(label: str, ok: bool, detail: str = "") -> bool:
    mark = color("✓", "g") if ok else color("✗", "r")
    print(f"  {mark} {label}{(' — ' + detail) if detail else ''}")
    return ok


def warn(label: str, detail: str = "") -> None:
    print(f"  {color('⚠', 'y')} {label}{(' — ' + detail) if detail else ''}")


def main() -> int:
    p = argparse.ArgumentParser(description="Pipeline image unique LLM (cf. docs/12).")
    p.add_argument("--src",    required=True, help="image source (fond opaque)")
    p.add_argument("--id",     required=True, help="identifiant de l'asset (sans extension)")
    p.add_argument("--model",  choices=("birefnet", "u2net"), default="birefnet",
                   help="modèle rembg (birefnet-general préserve les translucides)")
    p.add_argument("--margin", type=float, default=0.08, help="marge intérieure (default 0.08)")
    p.add_argument("--side",   type=int,   default=512,  help="taille finale carrée (default 512)")
    p.add_argument("--dest",   default=None,
                   help="dossier de destination (default: assets/units ; ex: assets/heroes)")
    p.add_argument("--dry-run", action="store_true",
                   help="écrit dans /tmp/<id>_check.png au lieu du dossier de destination")
    args = p.parse_args()

    src = Path(args.src).expanduser().resolve()
    if not src.is_file():
        print(color(f"erreur: source introuvable: {src}", "r"))
        return 2

    # Imports tardifs : permet --help sans dépendances
    try:
        from PIL import Image
        from rembg import new_session, remove
    except ImportError as e:
        print(color(f"erreur: {e}. Installer avec: pip install \"rembg[cpu]\" onnxruntime pillow", "r"))
        return 2

    print(color(f"\n[1/5] Source : {src.name}", "b"))
    img_in = Image.open(src).convert("RGBA")
    print(f"  taille : {img_in.size}, mode : {img_in.mode}")

    # Refus si déjà transparente (on relancerait sur un fichier déjà traité)
    a_in = img_in.split()[3]
    transparent_in = a_in.histogram()[0] / (img_in.size[0] * img_in.size[1])
    if transparent_in > 0.05:
        warn("source déjà partiellement transparente",
             f"{transparent_in*100:.0f}% pixels alpha=0 (attendu <5% sur image brute)")
        print("  (poursuite, mais rembg risque d'amplifier les artefacts)")

    print(color(f"\n[2/5] Détourage rembg ({args.model})", "b"))
    sess = new_session(args.model + "-general" if args.model == "birefnet" else args.model)
    img_out = remove(
        img_in, session=sess, alpha_matting=True,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=10,
        alpha_matting_erode_size=8,
    )

    print(color("\n[3/5] Trim alpha bbox", "b"))
    bbox = img_out.split()[3].getbbox()
    if not bbox:
        print(color("erreur: alpha entièrement vide après détourage", "r"))
        return 1
    trimmed = img_out.crop(bbox)
    print(f"  bbox : {bbox} → {trimmed.size}")

    print(color(f"\n[4/5] Recentrage carré (marge {args.margin:.0%})", "b"))
    w, h     = trimmed.size
    side_in  = max(w, h)
    full     = int(side_in / (1 - 2 * args.margin))
    canvas   = Image.new("RGBA", (full, full), (0, 0, 0, 0))
    canvas.paste(trimmed, ((full - w) // 2, (full - h) // 2), trimmed)
    final    = canvas.resize((args.side, args.side), Image.LANCZOS)

    print(color("\n[5/5] Sauvegarde", "b"))
    if args.dry_run:
        out = Path(f"/tmp/{args.id}_check.png")
    else:
        dest_dir = Path(args.dest).expanduser().resolve() if args.dest else DEST_DIR
        dest_dir.mkdir(parents=True, exist_ok=True)
        out = dest_dir / f"{args.id}.png"
    final.save(out, optimize=True)
    weight_kb = out.stat().st_size // 1024
    print(f"  → {out}  ({weight_kb} KB)")

    # ── Vérifications (docs/12 §8) ───────────────────────────────
    print(color("\n[QA] Critères docs/12-assets-style-guide.md §8", "b"))
    pixels   = args.side * args.side
    hist     = final.split()[3].histogram()
    pct_a0   = hist[0] / pixels * 100
    pct_a255 = hist[255] / pixels * 100
    bb       = final.split()[3].getbbox() or (0, 0, args.side, args.side)
    occ_w    = (bb[2] - bb[0]) / args.side
    occ_h    = (bb[3] - bb[1]) / args.side

    blocking = []
    blocking.append(not check("dimensions",
                              final.size == (args.side, args.side),
                              f"{final.size}"))
    blocking.append(not check("mode RGBA",
                              final.mode == "RGBA"))
    blocking.append(not check(f"alpha 0 ≥ {MIN_ALPHA0_PCT}% (fond transparent)",
                              pct_a0 >= MIN_ALPHA0_PCT,
                              f"{pct_a0:.1f}%"))
    check(f"alpha 255 ≥ {MIN_ALPHA255_PCT}% (sujet plein)",
          pct_a255 >= MIN_ALPHA255_PCT,
          f"{pct_a255:.1f}%")
    check(f"occupation H/W dans [{int(MIN_OCC*100)}%–{int(MAX_OCC*100)}%]",
          MIN_OCC <= occ_w <= MAX_OCC and MIN_OCC <= occ_h <= MAX_OCC,
          f"{occ_w*100:.0f}% × {occ_h*100:.0f}%")
    check(f"poids ≤ {SOFT_MAX_KB} KB",
          weight_kb <= SOFT_MAX_KB,
          f"{weight_kb} KB")
    blocking.append(weight_kb > HARD_MAX_KB)

    if any(blocking):
        print(color("\n→ BLOQUANT : un critère essentiel a échoué.", "r"))
        return 1
    print(color("\n→ OK. Voir docs/12 §8 pour la check-list complète.", "g"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
