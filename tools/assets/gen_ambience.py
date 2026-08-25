#!/usr/bin/env python3
"""Ambiances de BIOME (reliquat `game-ergonomics-immersion-review` Lot 9.3).

L'infrastructure de résolution audio était livrée (registre hors bundle, replis
gracieux) mais il manquait les **pistes** : l'ambiance par biome restait bloquée
« en attente de matière sonore ». On la synthétise, comme les SFX et les jingles
victoire/défaite (`gen_sfx.py`) — même moule : stdlib `wave` + `ffmpeg`, RNG
**seedé par piste** ⇒ PCM reproductible, encodage `-bitexact` ⇒ octets stables.

Sortie : `assets/audio/ambience/<terrain>.{ogg,m4a}` — clés `ambience/<terrain>`
auto-découvertes par le registre client. Les terrains sans fichier restent
SILENCIEUX (repli gracieux : grass/dirt/rough n'ont pas d'ambiance propre, la
piste d'aventure suffit).

Ces boucles sont volontairement **discrètes** (crête ~0.22, elles passent SOUS
la musique) et **bouclées proprement** (la queue est fondue dans la tête). Une
vraie piste déposée au même nom les remplace sans toucher une ligne de code.

Usage : python3 tools/assets/gen_ambience.py [--only forest,snow]
        (nécessite ffmpeg dans le PATH, comme gen_sfx.py)
"""

from __future__ import annotations

import argparse
import math
import os
import random
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from gen_sfx import (  # noqa: E402  (import après ajustement de sys.path)
    SR,
    add,
    chirp,
    encode,
    mul,
    noise,
    normalize,
    one_pole_hp,
    one_pole_lp,
    scale,
    sine,
    write_wav,
)

OUT = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "assets", "audio", "ambience")
)
DUR = 24.0  # boucle assez longue pour ne pas « tourner » à l'oreille
PEAK = 0.22  # l'ambiance DOUBLE la musique, elle ne la couvre jamais


def _slow_swell(dur: float, period: float, depth: float, phase: float = 0.0) -> list[float]:
    """Enveloppe de souffle : oscillation TRÈS lente autour de 1 (rafales)."""
    n = int(SR * dur)
    w = 2 * math.pi / period
    return [1.0 - depth + depth * (0.5 + 0.5 * math.sin(w * (i / SR) + phase)) for i in range(n)]


def _wind(dur: float, seed: int, fc: float, period: float, depth: float) -> list[float]:
    """Vent : bruit passe-bas modulé par des rafales lentes."""
    return mul(one_pole_lp(noise(dur, seed), fc), _slow_swell(dur, period, depth))


def _sparse(dur: float, seed: int, count: int, make) -> list[float]:
    """Sème `count` événements courts à des instants tirés d'un RNG SEEDÉ."""
    out = [0.0] * int(SR * dur)
    rng = random.Random(seed)
    for k in range(count):
        ev = make(rng, k)
        at = int(SR * rng.uniform(0.2, dur - 1.5))
        gain = rng.uniform(0.35, 1.0)
        for i, v in enumerate(ev):
            j = at + i
            if j < len(out):
                out[j] += v * gain
    return out


def _decay(x: list[float], decay: float) -> list[float]:
    return [v * math.exp(-(i / SR) * decay) for i, v in enumerate(x)]


def forest() -> list[float]:
    """Feuillage (bruit doux) + quelques oiseaux."""
    leaves = _wind(DUR, 0xF07E, 1100, 7.5, 0.55)
    birds = _sparse(
        DUR,
        0xB1D5,
        14,
        lambda rng, k: _decay(
            scale(chirp(rng.uniform(1900, 3200), rng.uniform(2600, 4200), 0.09), 0.5), 26
        ),
    )
    return normalize(add(scale(leaves, 0.9), scale(birds, 0.5)), PEAK)


def snow() -> list[float]:
    """Vent froid (rafales profondes) + rares cristaux."""
    gust = _wind(DUR, 0x5E01, 520, 11.0, 0.75)
    low = mul(one_pole_lp(noise(DUR, 0x5E02), 160), _slow_swell(DUR, 17.0, 0.6, 1.1))
    tinkle = _sparse(
        DUR, 0x5E03, 6, lambda rng, k: _decay(scale(sine(rng.uniform(3200, 4600), 0.06), 0.28), 34)
    )
    return normalize(add(scale(gust, 1.0), scale(low, 0.7), scale(tinkle, 0.35)), PEAK)


def sand() -> list[float]:
    """Désert : sifflement sec (bruit de bande haute) + bourdon très bas."""
    hiss = mul(
        one_pole_hp(one_pole_lp(noise(DUR, 0x5A0D), 4200), 1400),
        _slow_swell(DUR, 9.0, 0.6),
    )
    drone = mul(sine(58, DUR), _slow_swell(DUR, 13.0, 0.5, 0.7))
    return normalize(add(scale(hiss, 1.0), scale(drone, 0.5)), PEAK)


def swamp() -> list[float]:
    """Marais : nappe sourde + crapauds + insectes."""
    murk = _wind(DUR, 0x5A11, 380, 12.0, 0.45)
    frogs = _sparse(
        DUR,
        0x5A12,
        10,
        lambda rng, k: _decay(
            mul(sine(rng.uniform(140, 210), 0.22), _slow_swell(0.22, 0.05, 0.9)), 9
        ),
    )
    insects = mul(
        one_pole_hp(noise(DUR, 0x5A13), 5200), _slow_swell(DUR, 4.0, 0.8, 2.0)
    )
    return normalize(add(scale(murk, 0.9), scale(frogs, 0.8), scale(insects, 0.3)), PEAK)


def river() -> list[float]:
    """Eau courante : bruit de bande modulé vite + roulement bas."""
    flow = mul(
        one_pole_hp(one_pole_lp(noise(DUR, 0x21FE), 3000), 700),
        _slow_swell(DUR, 2.6, 0.35),
    )
    rumble = mul(one_pole_lp(noise(DUR, 0x21FF), 210), _slow_swell(DUR, 8.0, 0.4, 0.4))
    return normalize(add(scale(flow, 1.0), scale(rumble, 0.55)), PEAK)


AMBIENCES = {"forest": forest, "snow": snow, "sand": sand, "swamp": swamp, "river": river}


def loop_edges(x: list[float], fade: float = 2.0) -> list[float]:
    """Rend la boucle propre : la QUEUE est fondue dans la TÊTE (crossfade), donc
    la fin rejoint le début sans clic (le client joue `loop = true`)."""
    n = len(x)
    f = min(int(SR * fade), n // 3)
    out = list(x[: n - f])
    for i in range(f):
        w = i / f
        out[i] = x[i] * w + x[n - f + i] * (1 - w)
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="Ambiances de biome (boucles)")
    ap.add_argument("--only", help="liste de terrains (défaut : tous)")
    args = ap.parse_args()
    names = args.only.split(",") if args.only else list(AMBIENCES)
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for name in names:
            fn = AMBIENCES[name]
            samples = loop_edges(fn())
            wav = os.path.join(tmp, f"{name}.wav")
            write_wav(wav, samples)
            ogg = os.path.join(OUT, f"{name}.ogg")
            m4a = os.path.join(OUT, f"{name}.m4a")
            # 64 kbps : une nappe d'ambiance discrète n'a pas besoin de plus, et
            # le budget d'images/assets de la CI est partagé.
            encode(wav, ogg, m4a, "64k")
            print(
                f"{name:8s} {len(samples) / SR:.1f}s  ogg={os.path.getsize(ogg) // 1024}Ko  "
                f"m4a={os.path.getsize(m4a) // 1024}Ko"
            )
    print(f"→ {OUT}")


if __name__ == "__main__":
    main()
