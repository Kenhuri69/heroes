#!/usr/bin/env python3
"""Porte de siège **brisée** (backlog `siege-visual-overhaul` Lot 3, dernier item).

La porte était une tranche FIXE du tableau de fortification : l'assaut pouvait
raser les segments voisins (catapulte, `WallBombarded`) sans que le gatehouse ne
change jamais d'aspect. Ce générateur dérive les variantes **brisées** de l'art
PEINT existant — jamais de matière inventée, c'est la recette du Lot 1 de ce même
plan (« composition hors-ligne depuis la matière peinte existante ») :

- **ouverture creusée** : le vantail est sa propre matière, très assombrie, fondue
  par un masque doux (pas de bord au cordeau, sinon ça se lit comme une vignette
  collée — le défaut « sprite plaqué » relevé par le porteur) ;
- **éclats de planche** : des languettes de l'art d'origine restaurées au
  linteau, à peine assombries ⇒ des planches rompues encore accrochées ;
- **gravats** copiés de la zone rasée du MÊME tableau ⇒ pierre, teinte et lumière
  cohérentes par construction (et donc justes pour chaque maison, dont l'art
  n'est qu'un `tint_siege_faction.py` du même master).

Sorties (7 déclinaisons : générique + 6 maisons, géométries identiques — vérifié
par diff d'alpha) :
- `assets/combat/siege-run-band-gate-broken[-<faction>].png` — bande des 2
  rangées de porte, découpée au MÊME rect que les tranches du run
  (dérivé de `assets/layouts/siege-scene.json`) ⇒ continuité pixel avec les
  rangées voisines, aucune constante recopiée à la main ;
- `assets/combat/siege-piece-gate-broken[-<faction>].png` — même traitement sur
  l'art de porte du mode « pièces » (chemin de repli du client).

**Déterministe** : aucun RNG (masques et offsets = arithmétique fixe) ⇒ sortie
reproductible. Repli client gracieux : sans ces fichiers, la porte intacte reste
affichée.

Ids de faction : ce module vit dans `tools/` (hors `packages/`) ⇒ IDs opaques
autorisés (le garde-fou CI ne scanne que `packages/`).

Usage : python3 tools/assets/gen_siege_gate_broken.py [--only haven,necropolis]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets" / "combat"
LAYOUT = ROOT / "assets" / "layouts" / "siege-scene.json"

# Déclinaisons peintes livrées (cf. `tint_siege_faction.py` ; `test-faction`
# exclue, comme pour les scènes `siege-scene-*`).
FACTIONS = ["haven", "necropolis", "arcane-hunters", "sylvan-court", "vox-arcana", "dungeon"]

# Géométrie relevée sur le master `siege-run*.png` (394×1200) et sur l'art de
# porte du kit `siege-piece-gate*.png` (192×252) : boîte du VANTAIL seul.
RUN_DOOR = (180, 564, 223, 626)
PIECE_DOOR = (66, 126, 126, 208)
# Gravats LIBRES (posés sur fond transparent) de la zone rasée du master.
RUN_RUBBLE = (36, 726, 146, 812)


def _darken(im: Image.Image, factor: float) -> Image.Image:
    """Assombrit les canaux COULEUR en laissant l'ALPHA intact (`Image.eval`
    l'aurait rendu translucide — l'ouverture devenait un trou transparent)."""
    r, g, b, a = im.split()

    def f(v: int) -> int:
        return int(v * factor)

    return Image.merge("RGBA", (r.point(f), g.point(f), b.point(f), a))


def _panel_mask(size: tuple[int, int]) -> Image.Image:
    """Masque du vantail : rectangle à sommet arrondi (l'art a une arche), bords
    ADOUCIS pour que le vide se fonde dans l'ébrasement de pierre."""
    w, h = size
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle((2, 2, w - 3, h - 2), radius=max(3, w // 3), fill=255)
    return m.filter(ImageFilter.GaussianBlur(max(1.0, w * 0.06)))


def _shard_mask(size: tuple[int, int], keep: list[tuple[float, float, float]]) -> Image.Image:
    """Masque des éclats restés au linteau : pour chaque (x0, x1, hauteur), une
    languette dentelée qui descend depuis le haut du vantail."""
    w, h = size
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    for a, b, frac in keep:
        xa, xb = a * w, b * w
        mid = (xa + xb) / 2
        d.polygon(
            [(xa, 0), (xb, 0), (xb, h * frac * 0.72), (mid, h * frac), (xa, h * frac * 0.55)],
            fill=255,
        )
    return Image.composite(m, Image.new("L", (w, h), 0), _panel_mask(size))


def _break_door(im: Image.Image, box: tuple[int, int, int, int], void: float, shard: float) -> None:
    """Vantail défoncé : ouverture creusée dans sa propre matière + éclats."""
    w, h = box[2] - box[0], box[3] - box[1]
    orig = im.crop(box)
    im.paste(_darken(orig, void), (box[0], box[1]), _panel_mask((w, h)))
    im.paste(
        _darken(orig, shard),
        (box[0], box[1]),
        _shard_mask((w, h), [(0.06, 0.24, 0.46), (0.4, 0.52, 0.3), (0.72, 0.9, 0.56)]),
    )


def _rubble(
    im: Image.Image,
    at: tuple[int, int],
    size: tuple[int, int],
    src_frac: tuple[float, float, float, float] = (0.0, 0.0, 1.0, 1.0),
) -> None:
    """Colle un tas de gravats découpé dans la zone rasée du MÊME tableau."""
    x0, y0, x1, y1 = RUN_RUBBLE
    fw, fh = x1 - x0, y1 - y0
    src = im.crop(
        (
            x0 + int(fw * src_frac[0]),
            y0 + int(fh * src_frac[1]),
            x0 + int(fw * src_frac[2]),
            y0 + int(fh * src_frac[3]),
        )
    ).resize(size, Image.LANCZOS)
    # Les gravats tombent DANS l'ombre du porche : sans cet assombrissement, la
    # pierre claire du tas éclatait comme un autocollant sur le vide creusé.
    im.alpha_composite(_darken(src, 0.82), at)


def _band_rows(img_h: int) -> tuple[int, int]:
    """Bornes Y (px image) des rangées de porte — MÊME découpe que `runFrame`
    côté client, dérivée du layout (rien n'est recopié à la main)."""
    run = json.loads(LAYOUT.read_text())["run"]
    s = img_h / run["h"]
    rows, period = run["gateRows"], run["period"]
    top = (rows[0] * period - period / 2 - run["topBp"]) * s
    bot = (rows[-1] * period + period / 2 - run["topBp"]) * s
    return round(top), round(bot)


def build_run_band(src: Path, dst: Path) -> None:
    im = Image.open(src).convert("RGBA")
    _break_door(im, RUN_DOOR, void=0.3, shard=0.55)
    # Gravats : des blocs tombés DANS l'ouverture, puis un petit épandage devant
    # (le vantail a cédé vers l'extérieur).
    _rubble(im, (RUN_DOOR[0] + 4, RUN_DOOR[3] - 18), (36, 19), (0.10, 0.35, 0.60, 0.95))
    _rubble(im, (RUN_DOOR[0] - 8, RUN_DOOR[3] - 9), (18, 10), (0.45, 0.10, 0.90, 0.55))
    y0, y1 = _band_rows(im.height)
    band = im.crop((0, y0, im.width, y1))
    band.save(dst)
    print(f"✓ {dst.relative_to(ROOT)} ({band.width}×{band.height})")


def build_piece(src: Path, run_src: Path, dst: Path) -> None:
    im = Image.open(src).convert("RGBA")
    _break_door(im, PIECE_DOOR, void=0.26, shard=0.52)
    # Les gravats viennent du RUN de la même maison (l'art de pièce n'a pas de
    # zone rasée) ⇒ même pierre, même teinte.
    run = Image.open(run_src).convert("RGBA")
    pile = run.crop(
        (
            RUN_RUBBLE[0] + int((RUN_RUBBLE[2] - RUN_RUBBLE[0]) * 0.10),
            RUN_RUBBLE[1] + int((RUN_RUBBLE[3] - RUN_RUBBLE[1]) * 0.35),
            RUN_RUBBLE[0] + int((RUN_RUBBLE[2] - RUN_RUBBLE[0]) * 0.60),
            RUN_RUBBLE[1] + int((RUN_RUBBLE[3] - RUN_RUBBLE[1]) * 0.95),
        )
    ).resize((54, 30), Image.LANCZOS)
    im.alpha_composite(_darken(pile, 0.82), (PIECE_DOOR[0] + 6, PIECE_DOOR[3] - 22))
    im.save(dst)
    print(f"✓ {dst.relative_to(ROOT)} ({im.width}×{im.height})")


def main() -> None:
    ap = argparse.ArgumentParser(description="Variantes de porte brisée (siège)")
    ap.add_argument("--only", help="liste de maisons (défaut : générique + toutes)")
    args = ap.parse_args()
    wanted = args.only.split(",") if args.only else [""] + FACTIONS
    for f in wanted:
        suffix = f"-{f}" if f else ""
        run = OUT / f"siege-run{suffix}.png"
        if run.exists():
            build_run_band(run, OUT / f"siege-run-band-gate-broken{suffix}.png")
        piece = OUT / f"siege-piece-gate{suffix}.png"
        if piece.exists() and run.exists():
            build_piece(piece, run, OUT / f"siege-piece-gate-broken{suffix}.png")


if __name__ == "__main__":
    main()
