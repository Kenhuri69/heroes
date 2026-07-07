#!/usr/bin/env python3
"""
gen_audio_prompts.py — Génère les PROMPTS AUDIO à coller dans un générateur de
son (Gemini / autre), selon la Règle F de docs/12-assets-style-guide.md.

Pendant du gen_prompts.py (images) pour l'AUDIO (UXD-6). Émet deux fichiers :
  - assets/prompts/audio-music.md : pistes musicales par contexte (bouclables).
  - assets/prompts/audio-sfx.md   : effets ponctuels (UI / carte / combat).

⚠️ Gemini NE respecte PAS les durées demandées (retour utilisateur). Chaque
fiche rappelle donc le **retravail obligatoire** après génération : trimmer au
silence, poser des **points de boucle** propres pour les musiques, normaliser,
convertir en `.ogg` (+ repli `.m4a`) — commandes ffmpeg fournies.

Convention de nommage runtime (registre client à venir, UXD-6B) :
  assets/audio/music/<id>.ogg   et   assets/audio/sfx/<id>.ogg

Usage : python3 tools/assets/gen_audio_prompts.py
"""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
OUT = REPO / "assets" / "prompts"

# Cadre sonore commun (Règle F) — collé à tous les prompts musique.
MUSIC_STYLE = (
    "orchestral heroic fantasy game music in the spirit of Heroes of Might and "
    "Magic / Might & Magic Online, warm acoustic orchestra (strings, horns, "
    "woodwinds, harp, light choir), tonal and melodic, NO modern drums, no "
    "synths, no vocals with words, seamless loopable ambience, consistent tempo "
    "and key throughout so the track can loop cleanly"
)
SFX_STYLE = (
    "single short fantasy game UI/combat sound effect, dry and clean, no music, "
    "no reverb tail longer than the effect, mono, punchy and readable at low "
    "volume, no speech"
)

# — Musiques (bouclables). loop = piste d'ambiance ; oneshot = jingle court. —
MUSIC = [
    ("menu", "loop", "~90 s",
     "main menu theme: noble and hopeful, a memorable heroic main melody over "
     "sweeping strings and a triumphant horn call, sunrise-over-the-kingdom mood"),
    ("adventure", "loop", "~120 s",
     "overworld exploration theme: calm, curious and pastoral, gentle strings "
     "and woodwinds, a wandering flute melody, unhurried travel mood, low "
     "intensity so it can play for a long time without fatigue"),
    ("combat", "loop", "~90 s",
     "tactical battle theme: tense and driving but still orchestral, staccato "
     "strings, urgent horns and timpani, rising stakes, no downtime"),
    ("town", "loop", "~90 s",
     "town / castle theme: stately, safe and prosperous, warm strings and harp, "
     "a dignified processional melody, the feeling of a thriving stronghold"),
    ("victory", "oneshot", "~6 s",
     "short triumphant victory fanfare: bright brass and a cymbal swell "
     "resolving to a major chord, celebratory, ends cleanly (no loop)"),
    ("defeat", "oneshot", "~6 s",
     "short somber defeat sting: descending strings and a low horn resolving to "
     "a minor chord, mournful but dignified, ends cleanly (no loop)"),
]

# — Effets ponctuels (one-shots courts). —
SFX = [
    ("ui-tap", "a soft muted wooden/parchment tap for pressing a UI button, ~120 ms"),
    ("ui-confirm", "a small bright confirming chime for a validated action, ~250 ms"),
    ("ui-error", "a short low dull thud/buzz for a refused action, ~250 ms"),
    ("map-step", "a single soft horse hoof / boot step on grass, ~200 ms"),
    ("map-pickup", "a bright shimmering coin/treasure pickup chime, ~400 ms"),
    ("end-turn", "a short distant herald horn call marking the end of a turn, ~700 ms"),
    ("combat-hit", "a solid melee impact: blade-on-armor clash with a meaty thud, ~300 ms"),
    ("combat-shoot", "a bow release with a quick arrow whoosh, ~300 ms"),
    ("combat-spell", "a magical shimmer/whoosh of a spell being cast, ~500 ms"),
    ("combat-death", "a soft armored body collapse / fade for a unit dying, ~500 ms"),
]

FFMPEG_MUSIC = (
    "# 1. Trimmer les silences de tête/queue et normaliser :\n"
    "ffmpeg -i <gemini.wav> -af silenceremove=1:0:-50dB,loudnorm -ar 44100 trimmed.wav\n"
    "# 2. (boucle) repérer un point de boucle propre (passage à zéro) et couper\n"
    "#    la piste sur une mesure entière ; vérifier à l'oreille que la fin\n"
    "#    enchaîne sur le début sans clic.\n"
    "# 3. Encoder OGG (+ repli m4a) :\n"
    "ffmpeg -i trimmed.wav -c:a libvorbis -q:a 4 assets/audio/music/<id>.ogg\n"
    "ffmpeg -i trimmed.wav -c:a aac -b:a 128k assets/audio/music/<id>.m4a"
)
FFMPEG_SFX = (
    "# Trimmer au silence, mono, normaliser, encoder court :\n"
    "ffmpeg -i <gemini.wav> -ac 1 -af silenceremove=1:0:-50dB,areverse,"
    "silenceremove=1:0:-50dB,areverse,loudnorm -ar 44100 trimmed.wav\n"
    "ffmpeg -i trimmed.wav -c:a libvorbis -q:a 4 assets/audio/sfx/<id>.ogg\n"
    "ffmpeg -i trimmed.wav -c:a aac -b:a 96k assets/audio/sfx/<id>.m4a"
)


def music_file() -> str:
    lines = []
    for id_, kind, dur, desc in MUSIC:
        lines.append(
            f"### `{id_}` ({kind}, cible {dur})\n\n"
            "```\n"
            f"{MUSIC_STYLE},\n{desc}\n"
            "```\n\n"
            f"Destination : `assets/audio/music/{id_}.ogg` (+ `.m4a`)."
        )
    body = "\n\n---\n\n".join(lines)
    return f"""# Prompts audio — MUSIQUES (Règle F, docs/12)

> Générés par `tools/assets/gen_audio_prompts.py` — ne pas éditer à la main.
> À coller dans le générateur audio (Gemini).
>
> ⚠️ **Gemini ne respecte pas les durées** : les cibles ci-dessous sont
> indicatives. **Retravail obligatoire** après génération (trim + points de
> boucle propres + normalisation + encodage) — voir la section ffmpeg en bas.

## Cadre commun

Style : {MUSIC_STYLE}.

## Pistes

{body}

## Retravail (obligatoire — durées Gemini non fiables)

```bash
{FFMPEG_MUSIC}
```
"""


def sfx_file() -> str:
    lines = []
    for id_, desc in SFX:
        lines.append(
            f"### `{id_}`\n\n"
            "```\n"
            f"{SFX_STYLE}, {desc}\n"
            "```\n\n"
            f"Destination : `assets/audio/sfx/{id_}.ogg` (+ `.m4a`)."
        )
    body = "\n\n---\n\n".join(lines)
    return f"""# Prompts audio — EFFETS (SFX) (Règle F, docs/12)

> Générés par `tools/assets/gen_audio_prompts.py` — ne pas éditer à la main.
> À coller dans le générateur audio (Gemini).
>
> ⚠️ **Gemini ne respecte pas les durées** : **retravail obligatoire** (trim au
> silence des deux côtés, mono, normalisation, encodage) — section ffmpeg en bas.

## Cadre commun

Style : {SFX_STYLE}.

## Effets

{body}

## Retravail (obligatoire — durées Gemini non fiables)

```bash
{FFMPEG_SFX}
```
"""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "audio-music.md").write_text(music_file())
    (OUT / "audio-sfx.md").write_text(sfx_file())
    print(f"  {(OUT / 'audio-music.md').relative_to(REPO)} ({len(MUSIC)} pistes)")
    print(f"  {(OUT / 'audio-sfx.md').relative_to(REPO)} ({len(SFX)} effets)")


if __name__ == "__main__":
    main()
