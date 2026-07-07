# Prompts audio — EFFETS (SFX) (Règle F, docs/12)

> Générés par `tools/assets/gen_audio_prompts.py` — ne pas éditer à la main.
> À coller dans le générateur audio (Gemini).
>
> ⚠️ **Gemini ne respecte pas les durées** : **retravail obligatoire** (trim au
> silence des deux côtés, mono, normalisation, encodage) — section ffmpeg en bas.

## Cadre commun

Style : single short fantasy game UI/combat sound effect, dry and clean, no music, no reverb tail longer than the effect, mono, punchy and readable at low volume, no speech.

## Effets

### `ui-tap`

```
single short fantasy game UI/combat sound effect, dry and clean, no music, no reverb tail longer than the effect, mono, punchy and readable at low volume, no speech, a soft muted wooden/parchment tap for pressing a UI button, ~120 ms
```

Destination : `assets/audio/sfx/ui-tap.ogg` (+ `.m4a`).

---

### `ui-confirm`

```
single short fantasy game UI/combat sound effect, dry and clean, no music, no reverb tail longer than the effect, mono, punchy and readable at low volume, no speech, a small bright confirming chime for a validated action, ~250 ms
```

Destination : `assets/audio/sfx/ui-confirm.ogg` (+ `.m4a`).

---

### `ui-error`

```
single short fantasy game UI/combat sound effect, dry and clean, no music, no reverb tail longer than the effect, mono, punchy and readable at low volume, no speech, a short low dull thud/buzz for a refused action, ~250 ms
```

Destination : `assets/audio/sfx/ui-error.ogg` (+ `.m4a`).

---

### `map-step`

```
single short fantasy game UI/combat sound effect, dry and clean, no music, no reverb tail longer than the effect, mono, punchy and readable at low volume, no speech, a single soft horse hoof / boot step on grass, ~200 ms
```

Destination : `assets/audio/sfx/map-step.ogg` (+ `.m4a`).

---

### `map-pickup`

```
single short fantasy game UI/combat sound effect, dry and clean, no music, no reverb tail longer than the effect, mono, punchy and readable at low volume, no speech, a bright shimmering coin/treasure pickup chime, ~400 ms
```

Destination : `assets/audio/sfx/map-pickup.ogg` (+ `.m4a`).

---

### `end-turn`

```
single short fantasy game UI/combat sound effect, dry and clean, no music, no reverb tail longer than the effect, mono, punchy and readable at low volume, no speech, a short distant herald horn call marking the end of a turn, ~700 ms
```

Destination : `assets/audio/sfx/end-turn.ogg` (+ `.m4a`).

---

### `combat-hit`

```
single short fantasy game UI/combat sound effect, dry and clean, no music, no reverb tail longer than the effect, mono, punchy and readable at low volume, no speech, a solid melee impact: blade-on-armor clash with a meaty thud, ~300 ms
```

Destination : `assets/audio/sfx/combat-hit.ogg` (+ `.m4a`).

---

### `combat-shoot`

```
single short fantasy game UI/combat sound effect, dry and clean, no music, no reverb tail longer than the effect, mono, punchy and readable at low volume, no speech, a bow release with a quick arrow whoosh, ~300 ms
```

Destination : `assets/audio/sfx/combat-shoot.ogg` (+ `.m4a`).

---

### `combat-spell`

```
single short fantasy game UI/combat sound effect, dry and clean, no music, no reverb tail longer than the effect, mono, punchy and readable at low volume, no speech, a magical shimmer/whoosh of a spell being cast, ~500 ms
```

Destination : `assets/audio/sfx/combat-spell.ogg` (+ `.m4a`).

---

### `combat-death`

```
single short fantasy game UI/combat sound effect, dry and clean, no music, no reverb tail longer than the effect, mono, punchy and readable at low volume, no speech, a soft armored body collapse / fade for a unit dying, ~500 ms
```

Destination : `assets/audio/sfx/combat-death.ogg` (+ `.m4a`).

## Retravail (obligatoire — durées Gemini non fiables)

```bash
# Trimmer au silence, mono, normaliser, encoder court :
ffmpeg -i <gemini.wav> -ac 1 -af silenceremove=1:0:-50dB,areverse,silenceremove=1:0:-50dB,areverse,loudnorm -ar 44100 trimmed.wav
ffmpeg -i trimmed.wav -c:a libvorbis -q:a 4 assets/audio/sfx/<id>.ogg
ffmpeg -i trimmed.wav -c:a aac -b:a 96k assets/audio/sfx/<id>.m4a
```
