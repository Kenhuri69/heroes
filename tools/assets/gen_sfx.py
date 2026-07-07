#!/usr/bin/env python3
"""Génère des SFX & jingles **procéduraux déterministes** (doc 12 Règle P/F,
lot UXD-6).

Le modèle *musique* de Gemini ne produit pas de one-shots courts et secs ;
on synthétise donc nous-mêmes : (1) les SFX dry/courts/mono → `assets/audio/sfx/`
et (2) les **jingles** victoire/défaite (stings musicaux courts) →
`assets/audio/music/`, encodés OGG (Vorbis) + repli M4A (AAC).

Pur stdlib (wave/math/random) pour la synthèse — aucun numpy — puis `ffmpeg`
pour l'encodage. La **synthèse est déterministe** (RNG seedé par effet) : le PCM
est identique à chaque run. NB : le conteneur OGG embarque un n° de série
aléatoire (muxer ffmpeg), donc les octets `.ogg` varient d'un run à l'autre
**sans que le son change** — ne re-commiter un `.ogg` que si l'effet a réellement
été modifié.

Usage : `python3 tools/assets/gen_sfx.py`  (nécessite ffmpeg dans le PATH).
"""
from __future__ import annotations

import math
import os
import random
import struct
import subprocess
import tempfile
import wave

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "..", "assets", "audio", "sfx"))
MUSIC_OUT = os.path.normpath(os.path.join(HERE, "..", "..", "assets", "audio", "music"))


# --- petites briques de synthèse (listes de flottants, mono) ---------------

def _n(dur: float) -> int:
    return max(1, int(SR * dur))


def sine(freq: float, dur: float, phase: float = 0.0) -> list[float]:
    w = 2 * math.pi * freq
    return [math.sin(w * (i / SR) + phase) for i in range(_n(dur))]


def chirp(f0: float, f1: float, dur: float) -> list[float]:
    """Balayage de fréquence linéaire (phase = intégrale de f(t))."""
    k = (f1 - f0) / dur
    out = []
    for i in range(_n(dur)):
        t = i / SR
        out.append(math.sin(2 * math.pi * (f0 * t + 0.5 * k * t * t)))
    return out


def noise(dur: float, seed: int) -> list[float]:
    rng = random.Random(seed)
    return [rng.uniform(-1.0, 1.0) for _ in range(_n(dur))]


def exp_env(dur: float, decay: float, attack: float = 0.002) -> list[float]:
    na = max(1, int(SR * attack))
    out = []
    for i in range(_n(dur)):
        t = i / SR
        a = min(1.0, i / na)
        out.append(a * math.exp(-t * decay))
    return out


def span_env(dur: float, attack: float, release: float) -> list[float]:
    """Enveloppe globale linéaire : montée `attack`, plateau, descente `release`."""
    out = []
    for i in range(_n(dur)):
        t = i / SR
        a = min(1.0, t / attack) if attack > 0 else 1.0
        r = 1.0 if t < dur - release else max(0.0, (dur - t) / release)
        out.append(a * r)
    return out


def one_pole_lp(x: list[float], fc: float) -> list[float]:
    dt = 1 / SR
    rc = 1 / (2 * math.pi * fc)
    a = dt / (rc + dt)
    y, prev = [], 0.0
    for s in x:
        prev = prev + a * (s - prev)
        y.append(prev)
    return y


def one_pole_hp(x: list[float], fc: float) -> list[float]:
    dt = 1 / SR
    rc = 1 / (2 * math.pi * fc)
    a = rc / (rc + dt)
    y, prev_x, prev_y = [], 0.0, 0.0
    for s in x:
        prev_y = a * (prev_y + s - prev_x)
        prev_x = s
        y.append(prev_y)
    return y


def mul(x: list[float], env: list[float]) -> list[float]:
    n = min(len(x), len(env))
    return [x[i] * env[i] for i in range(n)]


def add(*layers: list[float]) -> list[float]:
    n = max(len(l) for l in layers)
    out = [0.0] * n
    for l in layers:
        for i, v in enumerate(l):
            out[i] += v
    return out


def scale(x: list[float], g: float) -> list[float]:
    return [v * g for v in x]


def saw_tone(freq: float, dur: float, partials: int = 6) -> list[float]:
    """Timbre riche (somme d'harmoniques 1/n) — pour le cor."""
    out = [0.0] * _n(dur)
    for h in range(1, partials + 1):
        s = sine(freq * h, dur)
        for i in range(len(out)):
            out[i] += s[i] / h
    return out


def normalize(x: list[float], target_peak: float) -> list[float]:
    peak = max((abs(v) for v in x), default=0.0)
    if peak < 1e-6:
        return x
    return [v * (target_peak / peak) for v in x]


def fade_edges(x: list[float], fin: float = 0.002, fout: float = 0.006) -> list[float]:
    ni, no = int(SR * fin), int(SR * fout)
    n = len(x)
    for i in range(min(ni, n)):
        x[i] *= i / ni
    for i in range(min(no, n)):
        x[n - 1 - i] *= i / no
    return x


# --- définition des effets câblés ------------------------------------------

def sfx_ui_tap() -> list[float]:
    body = mul(sine(180, 0.12), exp_env(0.12, 40))
    click = mul(one_pole_lp(noise(0.12, 1), 2600), exp_env(0.12, 95))
    return normalize(add(scale(body, 0.9), scale(click, 0.5)), 0.5)


def sfx_combat_hit() -> list[float]:
    clang = mul(one_pole_hp(one_pole_lp(noise(0.30, 2), 6500), 1700), exp_env(0.30, 24))
    thud = add(mul(sine(115, 0.30), exp_env(0.30, 17)),
               scale(mul(sine(72, 0.30), exp_env(0.30, 15)), 0.6))
    return normalize(add(scale(clang, 0.75), scale(thud, 1.0)), 0.92)


def sfx_combat_spell() -> list[float]:
    sweep = mul(chirp(420, 1500, 0.5), exp_env(0.5, 3.0, attack=0.06))
    octave = scale(mul(chirp(840, 3000, 0.5), exp_env(0.5, 3.5, attack=0.06)), 0.3)
    shimmer = scale(mul(one_pole_hp(noise(0.5, 3), 3200), exp_env(0.5, 4.5, attack=0.08)), 0.15)
    return normalize(add(sweep, octave, shimmer), 0.7)


def sfx_combat_death() -> list[float]:
    fall = mul(chirp(320, 70, 0.45), exp_env(0.5, 4.0, attack=0.01))
    clatter = mul(one_pole_lp(noise(0.5, 4), 3200), exp_env(0.5, 8.0))
    return normalize(add(scale(fall, 0.9), scale(clatter, 0.35)), 0.72)


def sfx_end_turn() -> list[float]:
    # Appel de cor à deux notes (E4 → A4), légèrement adouci (« lointain »).
    note1 = mul(saw_tone(330, 0.40), exp_env(0.40, 3.2, attack=0.04))
    note2 = mul(saw_tone(440, 0.42), exp_env(0.42, 3.0, attack=0.04))
    n1 = [0.0] * _n(0.70)
    for i, v in enumerate(note1):
        n1[i] += v
    off = int(SR * 0.30)
    for i, v in enumerate(note2):
        if off + i < len(n1):
            n1[off + i] += v
    return normalize(one_pole_lp(n1, 2200), 0.78)


def sfx_map_step() -> list[float]:
    thud = add(mul(sine(92, 0.20), exp_env(0.20, 32)),
               scale(mul(sine(60, 0.20), exp_env(0.20, 28)), 0.5))
    grass = scale(mul(one_pole_hp(noise(0.20, 5), 2000), exp_env(0.20, 60)), 0.25)
    return normalize(add(thud, grass), 0.55)


def _bell(base: float, dur: float, seed_env: float) -> list[float]:
    # Cloche inharmonique (ratios non entiers) à décroissance rapide.
    parts = [(1.0, 1.0), (1.48, 0.6), (2.0, 0.4), (2.67, 0.22)]
    layers = [scale(mul(sine(base * r, dur), exp_env(dur, seed_env)), a) for r, a in parts]
    return add(*layers)


def sfx_map_pickup() -> list[float]:
    hit1 = _bell(1200, 0.40, 9.0)
    hit2 = _bell(1600, 0.31, 11.0)
    buf = [0.0] * _n(0.40)
    for i, v in enumerate(hit1):
        buf[i] += v
    off = int(SR * 0.09)
    for i, v in enumerate(hit2):
        if off + i < len(buf):
            buf[off + i] += v * 0.85
    return normalize(buf, 0.72)


EFFECTS = {
    "ui-tap": sfx_ui_tap,
    "combat-hit": sfx_combat_hit,
    "combat-spell": sfx_combat_spell,
    "combat-death": sfx_combat_death,
    "end-turn": sfx_end_turn,
    "map-step": sfx_map_step,
    "map-pickup": sfx_map_pickup,
}


# --- jingles de fin de partie (stings musicaux courts, → music/) -------------

def _chord(notes: list[float], dur: float, partials: int, decay: float,
           attack: float, arpeggio: float = 0.0) -> list[float]:
    """Accord (option. arpégé) au timbre cuivré (somme d'harmoniques)."""
    buf = [0.0] * _n(dur)
    for k, f in enumerate(notes):
        onset = arpeggio * k
        seg = mul(saw_tone(f, dur - onset, partials), exp_env(dur - onset, decay, attack))
        off = int(SR * onset)
        for i, v in enumerate(seg):
            if off + i < len(buf):
                buf[off + i] += v / len(notes)
    return buf


def jingle_victory() -> list[float]:
    """Fanfare majeure triomphante (do majeur arpégé + basse + swell)."""
    dur = 3.2
    chord = _chord([523.25, 659.25, 783.99, 1046.50], dur, 5, 0.9, 0.02, arpeggio=0.10)
    bass = mul(saw_tone(130.81, dur, 4), exp_env(dur, 0.7, attack=0.05))
    # éclat de cymbale : bruit aigu en crescendo bref au tout début
    cym_env = [min(1.0, (i / SR) / 0.35) * math.exp(-(i / SR) * 6) for i in range(_n(0.6))]
    cym = mul(one_pole_hp(noise(0.6, 21), 4000), cym_env)
    buf = add(scale(chord, 1.0), scale(bass, 0.6))
    for i, v in enumerate(cym):
        if i < len(buf):
            buf[i] += v * 0.12
    return normalize(mul(buf, span_env(dur, 0.10, 0.9)), 0.92)


def jingle_defeat() -> list[float]:
    """Sting mineur sombre (glissando descendant + accord de la mineur + cor grave)."""
    dur = 3.5
    gliss = mul(chirp(330, 130, 0.6), exp_env(0.6, 1.5, attack=0.02))
    chord = _chord([220.0, 261.63, 329.63], dur, 3, 0.9, 0.15)
    horn = mul(saw_tone(110.0, dur, 4), exp_env(dur, 0.7, attack=0.2))
    buf = [0.0] * _n(dur)
    for i, v in enumerate(gliss):
        buf[i] += v * 0.5
    buf = add(buf, scale(chord, 0.7), scale(horn, 0.5))
    return normalize(mul(one_pole_lp(buf, 2200), span_env(dur, 0.2, 1.2)), 0.85)


JINGLES = {
    "victory": jingle_victory,
    "defeat": jingle_defeat,
}


def write_wav(path: str, samples: list[float]) -> None:
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = bytearray()
        for v in samples:
            q = int(max(-1.0, min(1.0, v)) * 32767)
            frames += struct.pack("<h", q)
        w.writeframes(bytes(frames))


def encode(wav: str, ogg: str, m4a: str, m4a_rate: str = "96k") -> None:
    # `-bitexact` + `-map_metadata -1` : sortie **reproductible au bit** (pas de
    # n° de série Ogg aléatoire ni d'horodatage/encodeur embarqué) → re-générer
    # ne produit aucun diff parasite.
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-bitexact", "-i", wav,
                    "-map_metadata", "-1", "-c:a", "libvorbis", "-q:a", "4", ogg], check=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-bitexact", "-i", wav,
                    "-map_metadata", "-1", "-c:a", "aac", "-b:a", m4a_rate, m4a], check=True)


def _emit(tmp: str, out_dir: str, name: str, fn, m4a_rate: str) -> None:
    samples = fade_edges(fn())
    wav = os.path.join(tmp, f"{name}.wav")
    write_wav(wav, samples)
    ogg = os.path.join(out_dir, f"{name}.ogg")
    m4a = os.path.join(out_dir, f"{name}.m4a")
    encode(wav, ogg, m4a, m4a_rate)
    print(f"{name:12s} {len(samples) / SR:.2f}s  "
          f"ogg={os.path.getsize(ogg) // 1024}Ko  m4a={os.path.getsize(m4a) // 1024}Ko")


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(MUSIC_OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for name, fn in EFFECTS.items():
            _emit(tmp, OUT, name, fn, "96k")
        for name, fn in JINGLES.items():  # jingles → music/ (128 kbps)
            _emit(tmp, MUSIC_OUT, name, fn, "128k")
    print(f"→ {OUT} / {MUSIC_OUT}")


if __name__ == "__main__":
    main()
