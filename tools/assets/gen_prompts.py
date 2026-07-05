#!/usr/bin/env python3
"""
gen_prompts.py — Génère les PROMPTS DE PLANCHE personnalisés à partir des
données du jeu (`data/`), selon les templates de docs/12-assets-style-guide.md.

C'est le pont « data-driven » du pipeline L1 (planche LLM) : chaque fichier
produit dans assets/prompts/ contient, pour UNE planche :
  - la grille (cols×rows) et l'ordre row-major des ids ;
  - le prompt prêt à coller dans le LLM image (Gemini / Nano Banana / Copilot) ;
  - la commande tools/assets/sheet_extract.py exacte à lancer au retour ;
  - la destination de staging des PNG validés.

Une nouvelle faction = relancer ce script : les planches unités / bâtiments /
avatars sont dérivées du manifeste, des unités et des locales, zéro rédaction
manuelle. Les pièces uniques (fonds, logo — règles D/E) sont aussi émises ici
pour tout centraliser.

Usage : python3 tools/assets/gen_prompts.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
DATA = REPO / "data"
OUT = REPO / "assets" / "prompts"

SUFFIX = ("no text, no watermark, no signature, no border frame, no ground line")
SHEET_BG = "flat uniform light grey background (#c8c8c8)"

# Palettes par faction — docs/12 §2.3 (fallback générique pour toute nouvelle
# faction tant que sa palette n'est pas ajoutée ici ET dans le guide).
PALETTES = {
    "haven": "off-white and light steel armor, sky-blue cloth, gold accents, holy light ambiance",
    "necropolis": "bone white, ash grey and black, necrotic green glow, tattered cloth, spectral mist",
    "arcane-hunters": "midnight blue and arcane violet, silver trim, glowing cyan runes, hunter gear",
    "test-faction": "plain neutral grey with orange accents (placeholder faction)",
}
DEFAULT_PALETTE = "muted heroic fantasy palette matching the faction lore"

# Indices visuels par capacité connue (ids de data/core/abilities.json)
ABILITY_HINTS = {
    "flying": "large spread wings, airborne pose",
    "shooter": "aiming a ranged weapon",
    "ranged": "aiming a ranged weapon",
    "undead": "unmistakably undead",
    "charge": "charging forward",
}


def _load(path: Path):
    return json.loads(path.read_text())


def _locales(*dirs: Path) -> tuple[dict, dict]:
    """Fusionne les locales EN et FR des dossiers donnés."""
    en, fr = {}, {}
    for d in dirs:
        for lang, acc in (("en", en), ("fr", fr)):
            p = d / f"{lang}.json"
            if p.is_file():
                acc.update(_load(p))
    return en, fr


def _name(loc_en: dict, loc_fr: dict, key: str, fallback: str) -> str:
    """Résout `<key>.name` puis `<key>` (les deux formats coexistent dans les
    locales) ; sans locale (ex. artefacts), humanise l'id (`lame-aiguisee` →
    `lame aiguisee`)."""
    keys = (f"{key}.name", key)
    en = next((loc_en[k] for k in keys if k in loc_en), fallback.replace("-", " "))
    fr = next((loc_fr[k] for k in keys if k in loc_fr), None)
    return f"{en} (fr: {fr})" if fr and fr != en else en


def _grid(n: int, cols: int = 4) -> tuple[int, int]:
    cols = min(cols, n)
    return cols, math.ceil(n / cols)


def _sheet_file(slug: str, title: str, rule: str, ids: list[str], cells: list[str],
                subject: str, style_lines: list[str], dest: str,
                side: int = 512) -> str:
    cols, rows = _grid(len(ids))
    cell_lines = "\n".join(f"cell {i + 1}: {c}" for i, c in enumerate(cells))
    prompt = "\n".join([
        f"{subject} in a {cols}x{rows} grid,",
        *style_lines,
        "each subject centered in its own cell, not touching cell edges,",
        "clear spacing between cells,",
        cell_lines,
        f"{SHEET_BG}, no ground shadow,",
        SUFFIX,
    ])
    extract = (
        f"python3 tools/assets/sheet_extract.py <planche.png> \\\n"
        f"  --cols {cols} --rows {rows} --side {side} \\\n"
        f"  --ids {','.join(ids)} \\\n"
        f"  --out assets/raster_src --qc /tmp/qc-{slug}.png"
    )
    return f"""# Planche — {title}

> Générée par `tools/assets/gen_prompts.py` — ne pas éditer à la main.
> Règle {rule} de `docs/12-assets-style-guide.md`. Grille **{cols}×{rows}**,
> ordre row-major. Planche cible ≥ {cols * 512}×{rows * 512} px.

## Prompt (à coller dans le LLM image)

```
{prompt}
```

## Extraction au retour (QC verte obligatoire — jamais committer un FAIL)

```bash
{extract}
```

Puis copier les PNG validés de `assets/raster_src/` vers `{dest}`.
"""


def units_sheets() -> dict[str, str]:
    core_en, core_fr = _locales(DATA / "core" / "locales")
    files = {}
    for fid in _load(DATA / "factions" / "index.json")["factions"]:
        fdir = DATA / "factions" / fid
        manifest = _load(fdir / "manifest.json")
        loc_en, loc_fr = _locales(DATA / "core" / "locales", fdir / "locales")
        ids, cells = [], []
        for uid in manifest["units"]:
            u = _load(fdir / "units" / f"{uid}.json")
            name = _name(loc_en, loc_fr, f"unit.{uid}", uid)
            hints = [ABILITY_HINTS[a["id"]] for a in u.get("abilities", [])
                     if a["id"] in ABILITY_HINTS]
            speed = u["stats"]["speed"]
            hints.append("swift and agile" if speed >= 7 else
                         "slow and massive" if speed <= 4 else "steady stance")
            ids.append(uid)
            cells.append(f"tier {u['tier']} unit \"{name}\" — {', '.join(hints)}")
        palette = PALETTES.get(fid, DEFAULT_PALETTE)
        files[f"units-{fid}.md"] = _sheet_file(
            slug=f"units-{fid}",
            title=f"unités {fid} (T1→T{manifest['tiers']})",
            rule="A (sprites 512² painterly, alpha strict après extraction)",
            ids=ids,
            cells=cells,
            subject=f"Character sheet, {len(ids)} fantasy creatures of the same army",
            style_lines=[
                "digital painting, heroic fantasy concept art style",
                "(Heroes of Might and Magic, MTG illustration quality), painterly brush strokes,",
                "dynamic action pose, 3/4 view, soft directional light from upper-left,",
                f"army visual identity: {palette},",
                "clear power progression from cell 1 (weakest) to the last cell (mightiest),",
            ],
            dest=f"assets/units/{fid}/",
        )
        # locales de faction utilisées uniquement pour les noms — rien d'autre
        _ = core_en, core_fr
    return files


def artifacts_sheet() -> dict[str, str]:
    loc_en, loc_fr = _locales(DATA / "core" / "locales")
    arts = _load(DATA / "core" / "artifacts.json")["artifacts"]
    bonus_cue = {
        "attack": "an offensive weapon-like relic",
        "defense": "a protective relic (shield, aegis, bracer)",
        "power": "a relic crackling with raw magic",
        "knowledge": "a scholarly relic (orb, tome, circlet)",
        "luck": "a lucky charm relic",
        "morale": "an inspiring banner-like relic",
    }
    ids, cells = [], []
    for a in arts:
        name = _name(loc_en, loc_fr, f"artifact.{a['id']}", a["id"])
        cues = [f"{bonus_cue.get(k, k)} (+{v} {k})" for k, v in a.get("bonus", {}).items()]
        ids.append(a["id"])
        cells.append(f"\"{name}\" — {', '.join(cues)}")
    return {"artifacts.md": _sheet_file(
        slug="artifacts",
        title="icônes d'artefacts",
        rule="C (planche d'icônes, fond gris clair plat)",
        ids=ids,
        cells=cells,
        subject=f"Item sheet, {len(ids)} magical fantasy artifacts",
        style_lines=[
            "digital painting, painterly MTG illustration quality,",
            "rich material detail (metal, leather, gem, parchment),",
            "soft directional light from upper-left,",
        ],
        dest="assets/artifacts/",
    )}


def buildings_sheets() -> dict[str, str]:
    loc_en, loc_fr = _locales(DATA / "core" / "locales")
    core_cue = {
        "townHall": "a stately town hall with a clock tower",
        "fort": "a fortified keep with battlements",
        "mageGuild": "a wizard tower with a glowing observatory",
        "market": "a bustling covered market stall",
        "tavern": "a cosy timber tavern with a hanging sign",
        "forge": "a smithy with a glowing furnace and anvil",
    }
    files = {}
    core = _load(DATA / "core" / "buildings.json")
    core_list = core["buildings"] if isinstance(core, dict) else core
    ids, cells = [], []
    for b in core_list:
        bid = b["id"] if isinstance(b, dict) else b
        name = _name(loc_en, loc_fr, f"building.{bid}", bid)
        ids.append(bid)
        cells.append(f"\"{name}\" — {core_cue.get(bid, 'a medieval fantasy town building')}")
    files["buildings-core.md"] = _sheet_file(
        slug="buildings-core",
        title="bâtiments communs de ville",
        rule="C (planche de vignettes, fond gris clair plat)",
        ids=ids,
        cells=cells,
        subject=f"Building sheet, {len(ids)} medieval fantasy town buildings",
        style_lines=[
            "digital painting, painterly HoMM town-screen style,",
            "each building isolated on its plot, slight 3/4 aerial view,",
            "soft directional light from upper-left,",
        ],
        dest="assets/buildings/core/",
    )

    for fid in _load(DATA / "factions" / "index.json")["factions"]:
        fdir = DATA / "factions" / fid
        manifest = _load(fdir / "manifest.json")
        fb_path = fdir / "buildings.json"
        if not fb_path.is_file():
            continue
        fb = _load(fb_path)
        fb_list = fb["buildings"] if isinstance(fb, dict) else fb
        if not fb_list:
            continue
        f_en, f_fr = _locales(DATA / "core" / "locales", fdir / "locales")
        dwelling_unit = {dw["buildingId"]: dw["unitId"]
                         for dw in manifest.get("town", {}).get("dwellings", [])}
        palette = PALETTES.get(fid, DEFAULT_PALETTE)
        ids, cells = [], []
        for b in fb_list:
            bid = b["id"] if isinstance(b, dict) else b
            name = _name(f_en, f_fr, f"building.{bid}", bid)
            if bid in dwelling_unit:
                uid = dwelling_unit[bid]
                uname = _name(f_en, f_fr, f"unit.{uid}", uid)
                cue = f"the dwelling where \"{uname}\" creatures are recruited"
            else:
                cue = "a faction-specific town building"
            ids.append(bid)
            cells.append(f"\"{name}\" — {cue}")
        files[f"buildings-{fid}.md"] = _sheet_file(
            slug=f"buildings-{fid}",
            title=f"bâtiments {fid}",
            rule="C (planche de vignettes, fond gris clair plat)",
            ids=ids,
            cells=cells,
            subject=f"Building sheet, {len(ids)} fantasy dwellings of the same town",
            style_lines=[
                "digital painting, painterly HoMM town-screen style,",
                "each building isolated on its plot, slight 3/4 aerial view,",
                f"architectural identity: {palette},",
                "soft directional light from upper-left,",
            ],
            dest=f"assets/buildings/{fid}/",
        )
    return files


def hero_avatars_sheet() -> dict[str, str]:
    # Pas encore de héros nommés dans data/ (cf. plan) : archétypes par faction.
    factions = [f for f in _load(DATA / "factions" / "index.json")["factions"]
                if f != "test-faction"]
    archetypes = [("might", "a battle-hardened might hero, armored commander"),
                  ("magic", "a wise magic hero, robed spellcaster")]
    ids, cells = [], []
    for fid in factions:
        palette = PALETTES.get(fid, DEFAULT_PALETTE)
        for slug, desc in archetypes:
            ids.append(f"{fid}-{slug}")
            cells.append(f"{desc} of the {fid} faction — {palette}")
    return {"hero-avatars.md": _sheet_file(
        slug="hero-avatars",
        title="avatars de héros (archétypes par faction)",
        rule="B (bustes painterly 256²)",
        ids=ids,
        cells=cells,
        subject=f"Portrait sheet, {len(ids)} heroic fantasy bust portraits",
        style_lines=[
            "painterly digital painting (Heroes of Might and Magic style), NOT photorealistic,",
            "bust shot, 3/4 face turn, determined expression,",
            "warm key light upper-left, cool rim light,",
            "each bust over a soft dark faction-themed backdrop kept INSIDE its cell,",
        ],
        dest="assets/heroes/",
        side=256,
    )}


def singles_files() -> dict[str, str]:
    """Pièces uniques (règles D/E) : fonds d'ambiance + logo."""
    factions = [f for f in _load(DATA / "factions" / "index.json")["factions"]
                if f != "test-faction"]
    terrains = [t for t, spec in
                _load(DATA / "core" / "config.json")["adventure"]["terrains"].items()
                if spec.get("moveCost") is not None]

    def bg(scene: str) -> str:
        return "\n".join([
            f"Epic painterly fantasy {scene}, Heroes of Might and Magic concept art,",
            "wide 16:9 composition (1920x1080), focal point upper-center,",
            "darker vignetted edges, lower third kept simple for UI overlay,",
            "atmospheric depth, volumetric light,",
            "no text, no watermark, no signature, no border frame",
        ])

    scenes = [("title", "landscape with a lone hero on horseback overlooking "
                        "a kingdom of castles at dawn")]
    for fid in factions:
        palette = PALETTES.get(fid, DEFAULT_PALETTE)
        scenes.append((f"town-{fid}",
                       f"cityscape of a {fid} faction stronghold, {palette}"))
    for t in terrains:
        scenes.append((f"combat-{t}",
                       f"battlefield clearing on {t} terrain seen from a slight "
                       f"elevation, open ground in the middle for a battle"))
    scenes += [("victory", "triumphant army banners raised at sunset"),
               ("defeat", "abandoned battlefield at dusk, broken banners, rain")]

    backgrounds = "# Fonds d'ambiance (Règle D — pièces uniques)\n\n" \
        "> Générés par `tools/assets/gen_prompts.py`. Un prompt = une image " \
        "1920×1080.\n> Staging : `assets/backgrounds/<id>.jpg` (< 500 Ko, " \
        "JPEG q80-85 accepté).\n\n" + "\n".join(
            f"## {sid}\n\n```\n{bg(desc)}\n```\n" for sid, desc in scenes)

    logo = """# Logo du jeu (Règle E — pièce unique)

> Généré par `tools/assets/gen_prompts.py`. Master ≥ 1024², fond transparent.
> Staging : `assets/logo/heroes-master.png`. Déclinaisons favicon/PWA : script
> à écrire au lot intégration.

```
Fantasy game logo emblem: a heraldic shield crossed by a knight sword,
a small golden crown above, engraved metal and gold, painterly finish,
the word "Heroes" in carved gold lettering integrated under the emblem,
readable at small size, centered on a fully transparent background,
no watermark, no signature, no border frame
```
"""
    return {"backgrounds.md": backgrounds, "logo.md": logo}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    files: dict[str, str] = {}
    files.update(units_sheets())
    files.update(artifacts_sheet())
    files.update(buildings_sheets())
    files.update(hero_avatars_sheet())
    files.update(singles_files())
    for name, content in sorted(files.items()):
        (OUT / name).write_text(content)
        print(f"  {(OUT / name).relative_to(REPO)}")
    print(f"\n{len(files)} fichiers de prompts générés dans {OUT.relative_to(REPO)}/")


if __name__ == "__main__":
    main()
