# Prompts audio — MUSIQUES (Règle F, docs/12)

> Générés par `tools/assets/gen_audio_prompts.py` — ne pas éditer à la main.
> À coller dans le générateur audio (Gemini).
>
> ⚠️ **Gemini ne respecte pas les durées** : les cibles ci-dessous sont
> indicatives. **Retravail obligatoire** après génération (trim + points de
> boucle propres + normalisation + encodage) — voir la section ffmpeg en bas.

## Cadre commun

Style : orchestral heroic fantasy game music in the spirit of Heroes of Might and Magic / Might & Magic Online, warm acoustic orchestra (strings, horns, woodwinds, harp, light choir), tonal and melodic, NO modern drums, no synths, no vocals with words, seamless loopable ambience, consistent tempo and key throughout so the track can loop cleanly.

## Pistes

### `menu` (loop, cible ~90 s)

```
orchestral heroic fantasy game music in the spirit of Heroes of Might and Magic / Might & Magic Online, warm acoustic orchestra (strings, horns, woodwinds, harp, light choir), tonal and melodic, NO modern drums, no synths, no vocals with words, seamless loopable ambience, consistent tempo and key throughout so the track can loop cleanly,
main menu theme: noble and hopeful, a memorable heroic main melody over sweeping strings and a triumphant horn call, sunrise-over-the-kingdom mood
```

Destination : `assets/audio/music/menu.ogg` (+ `.m4a`).

---

### `adventure` (loop, cible ~120 s)

```
orchestral heroic fantasy game music in the spirit of Heroes of Might and Magic / Might & Magic Online, warm acoustic orchestra (strings, horns, woodwinds, harp, light choir), tonal and melodic, NO modern drums, no synths, no vocals with words, seamless loopable ambience, consistent tempo and key throughout so the track can loop cleanly,
overworld exploration theme: calm, curious and pastoral, gentle strings and woodwinds, a wandering flute melody, unhurried travel mood, low intensity so it can play for a long time without fatigue
```

Destination : `assets/audio/music/adventure.ogg` (+ `.m4a`).

---

### `combat` (loop, cible ~90 s)

```
orchestral heroic fantasy game music in the spirit of Heroes of Might and Magic / Might & Magic Online, warm acoustic orchestra (strings, horns, woodwinds, harp, light choir), tonal and melodic, NO modern drums, no synths, no vocals with words, seamless loopable ambience, consistent tempo and key throughout so the track can loop cleanly,
tactical battle theme: tense and driving but still orchestral, staccato strings, urgent horns and timpani, rising stakes, no downtime
```

Destination : `assets/audio/music/combat.ogg` (+ `.m4a`).

---

### `town` (loop, cible ~90 s)

```
orchestral heroic fantasy game music in the spirit of Heroes of Might and Magic / Might & Magic Online, warm acoustic orchestra (strings, horns, woodwinds, harp, light choir), tonal and melodic, NO modern drums, no synths, no vocals with words, seamless loopable ambience, consistent tempo and key throughout so the track can loop cleanly,
town / castle theme: stately, safe and prosperous, warm strings and harp, a dignified processional melody, the feeling of a thriving stronghold
```

Destination : `assets/audio/music/town.ogg` (+ `.m4a`).

---

### `victory` (oneshot, cible ~6 s)

```
orchestral heroic fantasy game music in the spirit of Heroes of Might and Magic / Might & Magic Online, warm acoustic orchestra (strings, horns, woodwinds, harp, light choir), tonal and melodic, NO modern drums, no synths, no vocals with words, seamless loopable ambience, consistent tempo and key throughout so the track can loop cleanly,
short triumphant victory fanfare: bright brass and a cymbal swell resolving to a major chord, celebratory, ends cleanly (no loop)
```

Destination : `assets/audio/music/victory.ogg` (+ `.m4a`).

---

### `defeat` (oneshot, cible ~6 s)

```
orchestral heroic fantasy game music in the spirit of Heroes of Might and Magic / Might & Magic Online, warm acoustic orchestra (strings, horns, woodwinds, harp, light choir), tonal and melodic, NO modern drums, no synths, no vocals with words, seamless loopable ambience, consistent tempo and key throughout so the track can loop cleanly,
short somber defeat sting: descending strings and a low horn resolving to a minor chord, mournful but dignified, ends cleanly (no loop)
```

Destination : `assets/audio/music/defeat.ogg` (+ `.m4a`).

## Retravail (obligatoire — durées Gemini non fiables)

```bash
# 1. Trimmer les silences de tête/queue et normaliser :
ffmpeg -i <gemini.wav> -af silenceremove=1:0:-50dB,loudnorm -ar 44100 trimmed.wav
# 2. (boucle) repérer un point de boucle propre (passage à zéro) et couper
#    la piste sur une mesure entière ; vérifier à l'oreille que la fin
#    enchaîne sur le début sans clic.
# 3. Encoder OGG (+ repli m4a) :
ffmpeg -i trimmed.wav -c:a libvorbis -q:a 4 assets/audio/music/<id>.ogg
ffmpeg -i trimmed.wav -c:a aac -b:a 128k assets/audio/music/<id>.m4a
```
