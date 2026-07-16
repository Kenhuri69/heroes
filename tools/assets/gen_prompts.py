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

SUFFIX = ("no text, no watermark, no signature, no border frame, no ground line, "
          "no decorative sparkles, no star glints, no lens flare")
SHEET_BG = "flat uniform light grey background (#c8c8c8)"
# Garde-fou marge (docs/12 §4) : le LLM cadre souvent trop serré et les
# extrémités (ailes déployées, armes, bâtons, bannières) débordent → la porte
# anti-bave de sheet_extract.py les supprime. On force un zoom arrière suffisant.
MARGIN_GUARD = (
    "IMPORTANT: keep every subject fully inside its cell with generous empty "
    "margin all around — fully spread wings, weapons, staves and all "
    "extremities must NOT be cropped or touch any edge; zoom each subject out "
    "enough that nothing is clipped,"
)

# Palettes par faction — docs/12 §2.3 (fallback générique pour toute nouvelle
# faction tant que sa palette n'est pas ajoutée ici ET dans le guide).
PALETTES = {
    "haven": "off-white and light steel armor, sky-blue cloth, gold accents, holy light ambiance",
    "necropolis": "bone white, ash grey and black, necrotic green glow, tattered cloth, spectral mist",
    "arcane-hunters": "midnight blue and arcane violet, silver trim, glowing cyan runes, hunter gear",
    "vox-arcana": "black gothic stone with silver/gold filigree, electric cyan and neon magenta, "
    "wisteria violet, Korean oni/pagoda accents, concert neon lanterns",
    "dungeon": "dark violet and black, obsidian stone and cold silver, arcane magenta glow, "
    "coiled-serpent motifs, dark-elf sorcery, subterranean cavern ambiance",
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


# Planches « à découper par 8 » : 8 sujets max par planche (grille 4×2) —
# taille fiable pour Gemini (au-delà, la qualité par cellule chute et la
# découpe souffre). Une famille plus grande est éclatée en -p1, -p2, …
MAX_PER_SHEET = 8


def _sheets(slug: str, title: str, rule: str, ids: list[str], cells: list[str],
            subject_fmt: str, style_lines: list[str], dest: str,
            side: int = 512) -> dict[str, str]:
    """Éclate la famille en planches de MAX_PER_SHEET sujets max."""
    chunks = [(ids[i:i + MAX_PER_SHEET], cells[i:i + MAX_PER_SHEET])
              for i in range(0, len(ids), MAX_PER_SHEET)]
    out = {}
    for n, (cids, ccells) in enumerate(chunks, 1):
        s = slug if len(chunks) == 1 else f"{slug}-p{n}"
        t = title if len(chunks) == 1 else f"{title} — planche {n}/{len(chunks)}"
        out[f"{s}.md"] = _sheet_file(
            slug=s, title=t, rule=rule, ids=cids, cells=ccells,
            subject=subject_fmt.format(n=len(cids)),
            style_lines=style_lines, dest=dest, side=side)
    return out


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
        MARGIN_GUARD,
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

## Prompt (à coller dans Gemini — Nano Banana/Copilot en repli)

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
        files.update(_sheets(
            slug=f"units-{fid}",
            title=f"unités {fid} (T1→T{manifest['tiers']})",
            rule="A (sprites 512² painterly, alpha strict après extraction)",
            ids=ids,
            cells=cells,
            subject_fmt="Character sheet, {n} fantasy creatures of the same army",
            style_lines=[
                "digital painting, heroic fantasy concept art style",
                "(Heroes of Might and Magic, MTG illustration quality), painterly brush strokes,",
                "dynamic action pose, 3/4 view, soft directional light from upper-left,",
                f"army visual identity: {palette},",
                "clear power progression from cell 1 (weakest) to the last cell (mightiest),",
            ],
            dest=f"assets/units/{fid}/",
        ))
        # locales de faction utilisées uniquement pour les noms — rien d'autre
        _ = core_en, core_fr
    return files


def war_machines_sheet() -> dict[str, str]:
    """Machines de guerre communes (data/core/war-machines.json, doc 02 §5) —
    pièces de combat achetées à la Forge, **faction-agnostiques** (aucun
    `groupId`) : engins de siège mécaniques, pas des créatures. Règle A
    (sprites 512² painterly, alpha strict). Palette bois/fer neutre, aucune
    identité de faction. Staging core parallèle à `buildings/core/`."""
    loc_en, loc_fr = _locales(DATA / "core" / "locales")
    machines = _load(DATA / "core" / "war-machines.json")["warMachines"]
    # Indices visuels dérivés des capacités (data/core/abilities.json) — les
    # machines ne sont pas dans ABILITY_HINTS (pensé pour des créatures).
    cue = {
        "ballista": "a large wheeled bolt-thrower ballista, taut torsion springs "
                    "and a heavy iron-tipped bolt loaded, crew rigging",
        "catapulte": "a heavy timber catapult / trebuchet with a loaded boulder "
                     "in its sling arm and counterweight, siege-breaking bulk",
        "arrow-tower": "a fixed fortified arrow tower of stone and timber, "
                       "arrow-slits and a crenellated top, planted on the ground "
                       "(immobile defensive structure)",
    }
    ids, cells = [], []
    for w in machines:
        name = _name(loc_en, loc_fr, f"warMachine.{w['id']}", w["id"])
        ids.append(w["id"])
        cells.append(f"\"{name}\" — {cue.get(w['id'], 'a fantasy war machine')}")
    return _sheets(
        slug="war-machines",
        title="machines de guerre communes (Forge, faction-agnostiques)",
        rule="A (sprites 512² painterly, alpha strict après extraction)",
        ids=ids,
        cells=cells,
        subject_fmt="Character sheet, {n} medieval fantasy war machines and siege engines",
        style_lines=[
            "digital painting, heroic fantasy concept art style",
            "(Heroes of Might and Magic, MTG illustration quality), painterly brush strokes,",
            "mechanical constructs of timber, iron and rope, NOT living creatures,",
            "3/4 view, ready-for-battle stance, soft directional light from upper-left,",
            "neutral weathered wood-and-iron palette, no faction heraldry,",
        ],
        dest="assets/units/core/",
    )


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
    return _sheets(
        slug="artifacts",
        title="icônes d'artefacts",
        rule="C (planche d'icônes, fond gris clair plat)",
        ids=ids,
        cells=cells,
        subject_fmt="Item sheet, {n} magical fantasy artifacts",
        style_lines=[
            "digital painting, painterly MTG illustration quality,",
            "rich material detail (metal, leather, gem, parchment),",
            "soft directional light from upper-left,",
        ],
        dest="assets/artifacts/",
    )


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
    files.update(_sheets(
        slug="buildings-core",
        title="bâtiments communs de ville",
        rule="C (planche de vignettes, fond gris clair plat)",
        ids=ids,
        cells=cells,
        subject_fmt="Building sheet, {n} medieval fantasy town buildings",
        style_lines=[
            "digital painting, painterly HoMM town-screen style,",
            "each building isolated on its plot, slight 3/4 aerial view,",
            "soft directional light from upper-left,",
        ],
        dest="assets/buildings/core/",
    ))

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
        files.update(_sheets(
            slug=f"buildings-{fid}",
            title=f"bâtiments {fid}",
            rule="C (planche de vignettes, fond gris clair plat)",
            ids=ids,
            cells=cells,
            subject_fmt="Building sheet, {n} fantasy dwellings of the same town",
            style_lines=[
                "digital painting, painterly HoMM town-screen style,",
                "each building isolated on its plot, slight 3/4 aerial view,",
                f"architectural identity: {palette},",
                "soft directional light from upper-left,",
            ],
            dest=f"assets/buildings/{fid}/",
        ))
    return files


def _all_resources() -> list[str]:
    """Union des ressources du jeu : startingResources + keyResources +
    factionResources des manifestes — partagée par mines et tas ramassables."""
    resources = list(_load(DATA / "core" / "config.json")["newGame"]["startingResources"])
    for fid in _load(DATA / "factions" / "index.json")["factions"]:
        m = _load(DATA / "factions" / fid / "manifest.json")
        extra = list(m.get("keyResources", []))
        extra += [r["id"] if isinstance(r, dict) else r
                  for r in m.get("factionResources", [])]
        resources += [r for r in extra if r not in resources]
    return resources


def mines_sheets() -> dict[str, str]:
    """Mines de ressources (objets de la carte d'aventure) — une mine par
    ressource de `_all_resources()`."""
    resources = _all_resources()
    cues = {
        "gold": "a gold mine entrance with cart rails and nuggets",
        "wood": "a sawmill with a water wheel and stacked logs",
        "ore": "an open ore pit with wooden scaffolding",
        "crystal": "a crystal cavern with glowing crystal clusters",
        "gems": "a gem pond glittering with cut jewels",
        "mercury": "an alchemist's lab with bubbling silver vats",
        "sulfur": "a smoking sulfur pit with yellow deposits",
        "essence": "an arcane essence extractor with a levitating orb",
    }
    ids = [f"mine-{r}" for r in resources]
    cells = [f"\"{r} mine\" — {cues.get(r, f'a fantasy mine producing {r}')}"
             for r in resources]
    return _sheets(
        slug="mines",
        title="mines de ressources (objets de carte)",
        rule="C (planche de vignettes, fond gris clair plat)",
        ids=ids,
        cells=cells,
        subject_fmt="Building sheet, {n} small fantasy resource mines",
        style_lines=[
            "digital painting, painterly HoMM adventure-map style,",
            "each mine isolated on its plot, slight 3/4 aerial view,",
            "bold readable silhouette at 64 pixels (adventure map tile size),",
            "soft directional light from upper-left,",
        ],
        dest="assets/mines/",
    )


def resource_piles_sheet() -> dict[str, str]:
    """Tas de ressources RAMASSABLES (objets de carte consommés au passage) —
    famille `resources/pile-<res>` distincte du visuel de mine (plan
    map-design-issues Lot 2) : petits butins posés au sol, une entrée par
    ressource de `_all_resources()` (symétrie avec les mines)."""
    resources = _all_resources()
    cues = {
        "gold": "a small heap of gold coins with a few loose coins",
        "wood": "a neat stack of cut timber logs",
        "ore": "a pile of grey iron ore chunks",
        "crystal": "a cluster of glowing purple crystal shards",
        "gems": "a small mound of colorful cut gemstones",
        "mercury": "a corked flask of quicksilver on a small crate",
        "sulfur": "a heap of yellow sulfur powder and rocks",
        "essence": "a glowing arcane phial nested in a small chest",
        "resonance": "a humming tuning-fork crystal on a small lacquered stand",
    }
    ids = [f"pile-{r}" for r in resources]
    cells = [f"\"{r} pile\" — {cues.get(r, f'a small pile of {r}')}"
             for r in resources]
    return _sheets(
        slug="resource-piles",
        title="tas de ressources ramassables (objets de carte)",
        rule="C (planche de vignettes, fond gris clair plat)",
        ids=ids,
        cells=cells,
        subject_fmt="Item sheet, {n} small fantasy resource piles lying on the ground",
        style_lines=[
            "digital painting, painterly HoMM adventure-map style,",
            "collectible loot piles resting on flat ground, slight 3/4 aerial view,",
            "bold readable silhouette at 64 pixels (adventure map tile size),",
            "soft directional light from upper-left,",
        ],
        dest="assets/resources/",
    )


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
    return _sheets(
        slug="hero-avatars",
        title="avatars de héros (archétypes par faction)",
        rule="B (bustes painterly 256²)",
        ids=ids,
        cells=cells,
        subject_fmt="Portrait sheet, {n} heroic fantasy bust portraits",
        style_lines=[
            "painterly digital painting (Heroes of Might and Magic style), NOT photorealistic,",
            "bust shot, 3/4 face turn, determined expression,",
            "warm key light upper-left, cool rim light,",
            "each bust fully isolated with clear empty space around head and shoulders (for clean cut-out),",
        ],
        dest="assets/heroes/",
        side=256,
    )


def map_heroes_sheet() -> dict[str, str]:
    """Jetons de HÉROS sur la carte d'aventure (règle A, sprite transparent).

    Remplace l'écusson placeholder `render/heroSprite.ts` : un héros monté par
    faction, même style/échelle que les sprites d'unités (rendus sur les tuiles).
    Convention de nommage runtime : `assets/map/hero-<faction>.png`.
    """
    factions = [f for f in _load(DATA / "factions" / "index.json")["factions"]
                if f != "test-faction"]
    ids, cells = [], []
    for fid in factions:
        palette = PALETTES.get(fid, DEFAULT_PALETTE)
        ids.append(f"hero-{fid}")
        cells.append(
            f"a heroic mounted commander of the {fid} faction riding a "
            f"caparisoned steed, banner or cloak flowing — {palette}")
    return _sheets(
        slug="map-heroes",
        title="jetons de héros sur la carte (montés, par faction)",
        rule="A (sprites 512² painterly, alpha strict après extraction)",
        ids=ids,
        cells=cells,
        subject_fmt="Character sheet, {n} mounted fantasy heroes of different armies",
        style_lines=[
            "digital painting, heroic fantasy concept art style",
            "(Heroes of Might and Magic, MTG illustration quality), painterly brush strokes,",
            "each hero mounted on a steed, dynamic 3/4 view riding pose,",
            "soft directional light from upper-left,",
            "readable as a small map token at 64px tall,",
        ],
        dest="assets/map/",
    )


def map_props_sheets() -> dict[str, str]:
    """STRUCTURES & OBJETS de la carte d'aventure (règle C, fond gris clair).

    Remplace les formes procédurales `render/townsLayer.ts` (donjon) et
    `render/mapObjects.ts` (coffre/tente/panneau). Convention de nommage :
    `assets/map/town-<faction>.png` et `assets/map/<object>.png`.
    """
    factions = [f for f in _load(DATA / "factions" / "index.json")["factions"]
                if f != "test-faction"]
    ids, cells = [], []
    # Châteaux de ville par faction (le drapeau de propriétaire est ajouté par
    # le code — garder l'architecture neutre en couleur d'équipe).
    for fid in factions:
        palette = PALETTES.get(fid, DEFAULT_PALETTE)
        ids.append(f"town-{fid}")
        cells.append(
            f"a grand {fid} faction castle-town seen in slight 3/4 aerial view, "
            f"walls, towers and keep — architecture identity: {palette}")
    # Objets communs (faction-agnostiques) — silhouette lisible à 64px.
    OBJECTS = [
        ("chest", "a closed wooden treasure chest bound with iron and gold, "
                  "faint gold glint at the lid seam"),
        ("camp", "a small recruitment war-camp: a peaked tent with a pennant "
                 "and a low campfire"),
        ("signpost", "a weathered wooden signpost with hanging boards at a "
                     "crossroads, marking a place to visit"),
        ("shrine", "a small mossy stone shrine with a glowing rune, a place of "
                   "blessing"),
    ]
    for oid, desc in OBJECTS:
        ids.append(oid)
        cells.append(desc)
    return _sheets(
        slug="map-props",
        title="structures & objets de la carte (villes + objets)",
        rule="C (planche de vignettes, fond gris clair plat)",
        ids=ids,
        cells=cells,
        subject_fmt="Item sheet, {n} fantasy map structures and objects",
        style_lines=[
            "digital painting, painterly MTG illustration quality,",
            "rich material detail (stone, timber, iron, cloth),",
            "soft directional light from upper-left,",
            "readable as a small map icon at 64px tall,",
        ],
        dest="assets/map/",
    )


def map_bonus_places_sheets() -> dict[str, str]:
    """Lieux de bonus visitables (règle C, fond gris clair) — un visuel PAR
    NATURE d'effet (doc 02 §2.2). Distingue l'écurie (mouvement), la tour de
    guet (vision), le moulin (ressource) et la fontaine (chance), aujourd'hui
    rendus par un panneau/autel générique. Le sanctuaire `levelXp` garde
    `shrine` (planche `map-props`). Convention : `assets/map/<place>.png`.
    """
    PLACES = [
        ("fountain", "an ornate stone fountain with clear flowing water and a "
                     "soft blessing aura, a place granting good luck"),
        ("stable", "a wooden horse stable with a fenced paddock, hay bales and a "
                   "saddled horse, a place granting swift travel"),
        ("watchtower", "a tall slender stone watchtower with a lit lantern at its "
                       "top, a lookout that extends sight over the land"),
        ("mill", "a rustic water mill with a turning wooden wheel beside a small "
                 "stream, a place that produces resources"),
    ]
    return _sheets(
        slug="map-bonus-places",
        title="lieux de bonus de la carte (fontaine, écurie, tour de guet, moulin)",
        rule="C (planche de vignettes, fond gris clair plat)",
        ids=[p[0] for p in PLACES],
        cells=[p[1] for p in PLACES],
        subject_fmt="Item sheet, {n} fantasy map bonus locations",
        style_lines=[
            "digital painting, painterly MTG illustration quality,",
            "rich material detail (stone, timber, iron, water, cloth),",
            "soft directional light from upper-left,",
            "readable as a small map icon at 64px tall,",
        ],
        dest="assets/map/",
    )


def map_dwellings_sheets() -> dict[str, str]:
    """Camps d'habitation hors ville PAR FACTION (règle C, fond gris clair) —
    architecture teintée à la faction de la créature recrutable (doc 02 §2.2).
    Le client retombe sur le camp générique (`camp`) si le camp de faction
    manque. Convention : `assets/map/camp-<faction>.png`.
    """
    factions = [f for f in _load(DATA / "factions" / "index.json")["factions"]
                if f != "test-faction"]
    ids, cells = [], []
    for fid in factions:
        palette = PALETTES.get(fid, DEFAULT_PALETTE)
        ids.append(f"camp-{fid}")
        cells.append(
            f"a creature dwelling war-camp with {fid} faction architecture "
            f"identity: {palette} — a peaked tent with a pennant, a carved totem "
            f"and a low campfire")
    return _sheets(
        slug="map-dwellings",
        title="camps d'habitation par faction",
        rule="C (planche de vignettes, fond gris clair plat)",
        ids=ids,
        cells=cells,
        subject_fmt="Item sheet, {n} fantasy creature dwelling war-camps",
        style_lines=[
            "digital painting, painterly MTG illustration quality,",
            "rich material detail (timber, hide, iron, cloth),",
            "soft directional light from upper-left,",
            "readable as a small map icon at 64px tall,",
        ],
        dest="assets/map/",
    )


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
            "darker vignetted edges, lower third and foreground kept open and "
            "uncluttered for UI and building overlays,",
            "atmospheric depth, volumetric light,",
            "no text, no watermark, no signature, no border frame, "
            "no decorative sparkles, no star glints, no lens flare",
        ])

    scenes = [("title", "landscape with a lone hero on horseback overlooking "
                        "a kingdom of castles at dawn")]
    for fid in factions:
        palette = PALETTES.get(fid, DEFAULT_PALETTE)
        # Décor de ville COMPOSABLE (UX-TOWNVIEW lot 2) : le client pose les
        # bâtiments interactifs dans la bande d'avant-plan. Le fond doit donc
        # offrir des terrasses / lots vides dégagés au premier plan (et NON une
        # cité déjà saturée de bâtiments qui rivalisent avec les vignettes),
        # avec un unique donjon focal en haut.
        scenes.append((f"town-{fid}",
                       f"{fid} faction town built on a terraced hillside seen "
                       f"from a gentle elevation: one grand central keep as the "
                       f"single focal landmark upper-center, open stepped terraces "
                       f"and vacant building plots descending toward a wide "
                       f"uncluttered foreground courtyard with room to place "
                       f"building icons, only a few sparse structures hinted in "
                       f"the mid-ground, no dense crowd of buildings in the "
                       f"foreground, {palette}"))
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
    files.update(war_machines_sheet())
    files.update(artifacts_sheet())
    files.update(buildings_sheets())
    files.update(mines_sheets())
    files.update(resource_piles_sheet())
    files.update(hero_avatars_sheet())
    files.update(map_heroes_sheet())
    files.update(map_props_sheets())
    files.update(map_bonus_places_sheets())
    files.update(map_dwellings_sheets())
    files.update(singles_files())
    for name, content in sorted(files.items()):
        (OUT / name).write_text(content)
        print(f"  {(OUT / name).relative_to(REPO)}")
    print(f"\n{len(files)} fichiers de prompts générés dans {OUT.relative_to(REPO)}/")


if __name__ == "__main__":
    main()
