#!/usr/bin/env python3
"""Build the soundtrack for "Sehari Dalam Hidup".

Everything is deterministic and offline:

- assets/bed.mp3        a synthesized ambient bed for the full 109 s cut
                        (A-minor pad, sub bass, a slow heartbeat pulse and a faint clock tick)
- assets/sfx-full.mp3   foley for the full cut on the series timeline
- assets/vo-full.mp3    the English narration, one line per page (audio/vo/*.wav from Kokoro)

The standalone episode hosts play the same three tracks offset with data-media-start.

Foley clips come from the HyperFrames media-use bundled SFX library (copied into
audio/sfx/). The cue times mirror the GSAP schedule in the compositions: a key
press per timestamp character, a soft click per headline word, a bass thud when a
stamp lands, a whoosh on every page push, rain during the 15:40 page, pops when
names are cloaked, a ping when e-Filing is accepted.

Requires numpy and ffmpeg. Run from the project root:  python3 audio/make-audio.py
"""
from __future__ import annotations

import math
import os
import subprocess
import sys
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SFX_DIR = os.path.join(ROOT, "audio", "sfx")
OUT_DIR = os.path.join(ROOT, "assets")
SR = 48000
F = 1 / 30  # one frame, matches the compositions
PUSH = 0.45

# ---- the series schedule (must match the compositions) ----------------------
EPISODES = [
    {"id": "ep1", "start": 5.0, "own": 24.0},
    {"id": "ep2", "start": 29.0, "own": 26.0},
    {"id": "ep3", "start": 55.0, "own": 24.0},
    {"id": "ep4", "start": 79.0, "own": 24.0},
]
TITLE = {"start": 0.0, "own": 5.0}
END = {"start": 103.0, "own": 6.0}
TOTAL = 109.0
PAGES = 5


# ---- helpers ----------------------------------------------------------------
def load_sample(name: str) -> np.ndarray:
    """Decode an mp3 from audio/sfx to mono float32 at SR, peak-normalised."""
    path = os.path.join(SFX_DIR, name + ".mp3")
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
        check=True, capture_output=True,
    ).stdout
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    peak = np.max(np.abs(x)) or 1.0
    return x / peak


def trim_tail(x: np.ndarray, seconds: float, fade: float = 0.05) -> np.ndarray:
    n = min(len(x), int(seconds * SR))
    y = x[:n].copy()
    k = min(n, int(fade * SR))
    if k > 0:
        y[-k:] *= np.linspace(1, 0, k)
    return y


class Mixer:
    def __init__(self, seconds: float):
        self.buf = np.zeros((int(seconds * SR) + SR, 2))

    def add(self, t: float, x: np.ndarray, gain: float = 1.0, pan: float = 0.0):
        if t < 0:
            return
        i = int(t * SR)
        n = min(len(x), len(self.buf) - i)
        if n <= 0:
            return
        l = math.cos((pan + 1) * math.pi / 4)
        r = math.sin((pan + 1) * math.pi / 4)
        self.buf[i:i + n, 0] += x[:n] * gain * l
        self.buf[i:i + n, 1] += x[:n] * gain * r

    def add_stereo(self, t: float, x: np.ndarray, gain: float = 1.0):
        i = int(t * SR)
        n = min(len(x), len(self.buf) - i)
        self.buf[i:i + n] += x[:n] * gain

    def render(self, seconds: float) -> np.ndarray:
        y = self.buf[: int(seconds * SR)]
        return np.tanh(y * 1.15) / math.tanh(1.15)  # soft ceiling


def write_mp3(path: str, stereo: np.ndarray):
    wav = path[:-4] + ".wav"
    pcm = np.clip(stereo * 32767, -32768, 32767).astype(np.int16)
    with wave.open(wav, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-codec:a", "libmp3lame", "-b:a", "192k", path], check=True)
    os.remove(wav)
    print(f"  {os.path.relpath(path, ROOT)}  {len(stereo) / SR:.1f}s")


# ---- music bed ----------------------------------------------------------------
def midi(n: float) -> float:
    return 440.0 * 2 ** ((n - 69) / 12)


# A minor, four-and-a-half-second chords: Am(add9) · Fmaj7 · C(add9) · G
CHORDS = [
    [45, 52, 57, 59, 60],   # A2 E3 A3 B3 C4
    [41, 48, 52, 57, 60],   # F2 C3 E3 A3 C4
    [48, 55, 59, 62, 64],   # C3 G3 B3 D4 E4
    [43, 50, 55, 59, 62],   # G2 D3 G3 B3 D4
]
CHORD_LEN = 4.5


def pad_note(freq: float, seconds: float, seed: int) -> np.ndarray:
    """A soft, slightly detuned pad voice: six partials with a slow vibrato."""
    t = np.arange(int(seconds * SR)) / SR
    rng = np.random.default_rng(seed)
    out = np.zeros_like(t)
    for d in (-0.0025, 0.0, 0.0025):
        vib = 1 + 0.0015 * np.sin(2 * math.pi * (0.13 + 0.05 * rng.random()) * t + rng.random() * 6.28)
        ph = 2 * math.pi * freq * (1 + d) * vib
        for k in range(1, 7):
            out += np.sin(k * np.cumsum(ph) / SR + rng.random() * 6.28) / (k ** 1.7)
    out /= np.max(np.abs(out)) or 1.0
    # envelope: 1.4 s attack, 1.6 s release
    env = np.ones_like(t)
    a = int(1.4 * SR)
    r = int(1.6 * SR)
    env[:a] = np.linspace(0, 1, a) ** 1.5
    env[-r:] *= np.linspace(1, 0, r) ** 1.2
    return out * env


def build_bed(seconds: float) -> np.ndarray:
    mix = Mixer(seconds)
    t_chord = 0.0
    i = 0
    while t_chord < seconds:
        chord = CHORDS[i % len(CHORDS)]
        for j, n in enumerate(chord):
            pan = (j - 2) * 0.28
            gain = 0.16 if j > 0 else 0.11
            mix.add(t_chord, pad_note(midi(n), CHORD_LEN + 1.6, seed=i * 10 + j), gain=gain, pan=pan)
        # sub bass: root an octave down, soft attack
        root = midi(chord[0] - 12)
        tt = np.arange(int((CHORD_LEN + 1.0) * SR)) / SR
        sub = np.sin(2 * math.pi * root * tt)
        env = np.minimum(1, tt / 0.9) * np.exp(-np.maximum(0, tt - CHORD_LEN + 0.6) * 2.5)
        mix.add(t_chord, sub * env, gain=0.22)
        t_chord += CHORD_LEN
        i += 1

    # heartbeat pulse every 2 s: a 52 Hz thump with a fast decay
    tt = np.arange(int(0.45 * SR)) / SR
    thump = np.sin(2 * math.pi * 52 * tt * (1 + 0.6 * np.exp(-tt * 30))) * np.exp(-tt * 11)
    t = 1.0
    while t < seconds - 2:
        mix.add(t, thump, gain=0.33)
        t += 2.0

    # faint clock tick every second: a 3 ms noise burst, alternating pan
    rng = np.random.default_rng(7)
    tick = rng.standard_normal(int(0.004 * SR)) * np.linspace(1, 0, int(0.004 * SR)) ** 2
    tick = np.convolve(tick, np.ones(14) / 14, mode="same")
    k = 0
    t = 0.5
    while t < seconds - 1:
        mix.add(t, tick, gain=0.03, pan=-0.35 if k % 2 == 0 else 0.35)
        t += 1.0
        k += 1

    bed = mix.render(seconds)
    # gentle widening: tiny delay on the right channel
    d = int(0.011 * SR)
    bed[d:, 1] = 0.85 * bed[d:, 1] + 0.15 * bed[:-d, 0]
    # fade in, fade out
    n = len(bed)
    fi = int(1.5 * SR)
    fo = int(2.4 * SR)
    bed[:fi] *= np.linspace(0, 1, fi)[:, None]
    bed[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 0.8
    peak = np.max(np.abs(bed)) or 1.0
    return bed / peak * 0.5


# ---- foley cues --------------------------------------------------------------
def ease_power2_out(u: float) -> float:
    return 1 - (1 - u) ** 2


def counter_ticks(t0: float, dur: float, start: float, end: float):
    """Times at which a power2.out count-up crosses each integer."""
    times = []
    for v in range(int(math.floor(start)) + 1, int(math.floor(end)) + 1):
        u_target = (v - start) / (end - start)
        # invert 1-(1-u)^2 = u_target
        u = 1 - math.sqrt(max(0.0, 1 - u_target))
        times.append(t0 + u * dur)
    return times


def page_cues(cues: list, base: float, own: float, ep: str, pages: int = PAGES):
    step = own / pages
    for k in range(pages):
        P = base + k * step
        t0 = P + 0.5
        if k > 0:
            cues.append((P, "whoosh-short", 0.55, 0.0))
        # timestamp characters (hh:mm)
        for i in range(5):
            t = t0 + i * (0.16 - 2 * F)
            cues.append((t, "key-press", 0.32 if i != 2 else 0.18, -0.25))
        # headline words: a soft click each (word count differs per page; six is the max)
        words = {
            "ep1": [3, 6, 6, 4, 6], "ep2": [2, 2, 4, 2, 4], "ep3": [4, 6, 4, 2, 1], "ep4": [3, 3, 2, 5, 3],
        }[ep][k]
        for i in range(words):
            cues.append((t0 + 0.22 + i * (0.15 - F), "click-soft", 0.16, 0.25))
        # stamp lands at the end of its slam
        cues.append((t0 + 1.55 + 0.22 - 0.03, "impact-bass-2", 0.55, -0.15))
        # page-specific extras
        if ep == "ep1" and k == 4:  # cause-list ticks
            for i in range(14):
                cues.append((t0 + 1.2 + i * 0.045, "click-soft", 0.12 if i != 8 else 0.3, 0.1))
        if ep == "ep2" and k == 1:  # matters called 1 -> 8
            for t in counter_ticks(t0 + 1.1, 2.4, 1, 8):
                cues.append((t, "click", 0.22, 0.3))
        if ep == "ep4" and k == 2:  # hours 0 -> 9.4
            for t in counter_ticks(t0 + 1.1, 2.2, 0, 9.4):
                cues.append((t, "click", 0.2, 0.3))
        if ep == "ep3" and k == 1:  # names cloaked
            for i in range(4):
                cues.append((t0 + 2.4 + i * 0.3 + 0.1, "pop", 0.3, 0.35))
        if ep == "ep3" and k == 4:  # e-Filing accepted
            cues.append((t0 + 2.9, "ping", 0.35, 0.2))


def rain(seconds: float, seed: int = 3) -> np.ndarray:
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    x = rng.standard_normal(n)
    x = np.convolve(x, np.ones(6) / 6, mode="same")           # take the top off
    patter = 1 + 0.35 * np.convolve(rng.standard_normal(n), np.ones(900) / 900, mode="same") * 12
    x = x * patter
    env = np.ones(n)
    fi, fo = int(1.2 * SR), int(0.6 * SR)
    env[:fi] = np.linspace(0, 1, fi)
    env[-fo:] = np.linspace(1, 0, fo)
    x = x * env
    return x / (np.max(np.abs(x)) or 1.0)


def build_sfx(seconds: float, cues: list, rains: list) -> np.ndarray:
    samples = {}
    mix = Mixer(seconds)
    for t, name, gain, pan in cues:
        if name not in samples:
            samples[name] = load_sample(name)
        x = samples[name]
        if name == "impact-bass-2":
            x = trim_tail(x, 1.1, fade=0.5)
        if name in ("key-press", "click", "click-soft"):
            x = trim_tail(x, 0.18, fade=0.06)
        mix.add(t, x, gain=gain, pan=pan)
    for t, dur in rains:
        r = rain(dur)
        mix.add(t, r, gain=0.16, pan=-0.2)
        mix.add(t + 0.013, r, gain=0.16, pan=0.2)
    return mix.render(seconds)


def card_cues(cues: list, base: float, words_at: float, stamp_at: float, nwords: int, seam: bool):
    if seam:
        cues.append((base, "whoosh", 0.7, 0.0))
    durs = [0.2, 0.16, 0.18]
    t = base + words_at
    for i in range(nwords):
        cues.append((t, "click-soft", 0.2, 0.25))
        t += durs[i % 3] - F
    cues.append((base + stamp_at + 0.22 - 0.03, "impact-bass-2", 0.6, -0.15))


# ---- voiceover ---------------------------------------------------------------
VO_DIR = os.path.join(ROOT, "audio", "vo")
VO_LEAD = 0.55  # seconds after a page (or card) starts before the line begins


def load_vo(key: str) -> np.ndarray | None:
    path = os.path.join(VO_DIR, key + ".wav")
    if not os.path.exists(path):
        return None
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
        check=True, capture_output=True,
    ).stdout
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    peak = np.max(np.abs(x)) or 1.0
    return x / peak * 0.9


def vo_cues(base: float, own: float, ep: str):
    step = own / PAGES
    return [(base + k * step + VO_LEAD, f"{ep}-p{k + 1}", step - VO_LEAD - 0.3) for k in range(PAGES)]


def build_vo(seconds: float, cues: list) -> np.ndarray:
    mix = Mixer(seconds)
    missing = []
    for t, key, window in cues:
        x = load_vo(key)
        if x is None:
            missing.append(key)
            continue
        if len(x) / SR > window:
            print(f"  warning: {key} runs {len(x) / SR:.2f}s, window is {window:.2f}s")
        mix.add(t, x, gain=0.95, pan=0.0)
    if missing:
        print("  missing voiceover lines (run the tts step first):", ", ".join(missing))
    return mix.render(seconds)


def duck(bed: np.ndarray, vo: np.ndarray, depth_db: float = 7.0) -> np.ndarray:
    """Lower the bed while the voice speaks; 0.25 s attack, 0.6 s release."""
    env = np.abs(vo[:, 0])
    win = int(0.05 * SR)
    env = np.convolve(env, np.ones(win) / win, mode="same")
    gate = (env > 0.02).astype(np.float64)
    att = int(0.25 * SR)
    rel = int(0.6 * SR)
    k = np.concatenate([np.ones(att), np.ones(rel)])  # asymmetric smoothing
    k /= k.sum()
    g = np.convolve(gate, k, mode="same")
    g = np.clip(g / (g.max() or 1.0), 0, 1)
    gain = 10 ** (-depth_db * g / 20)
    out = bed.copy()
    n = min(len(out), len(gain))
    out[:n] *= gain[:n, None]
    return out


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    print("voiceover, full cut")
    vo = [(TITLE["start"] + VO_LEAD, "title", TITLE["own"] - VO_LEAD)]
    for ep in EPISODES:
        vo += vo_cues(ep["start"], ep["own"], ep["id"])
    vo.append((END["start"] + VO_LEAD, "end", END["own"] - VO_LEAD))
    vo_full = build_vo(TOTAL, vo)
    write_mp3(os.path.join(OUT_DIR, "vo-full.mp3"), vo_full)

    print("bed (ducked under the voice)")
    write_mp3(os.path.join(OUT_DIR, "bed.mp3"), duck(build_bed(TOTAL), vo_full))

    print("foley, full cut")
    cues: list = []
    card_cues(cues, TITLE["start"], 0.35, 2.0, 3, seam=False)
    rains = []
    for ep in EPISODES:
        cues.append((ep["start"], "whoosh", 0.7, 0.0))
        page_cues(cues, ep["start"], ep["own"], ep["id"])
        if ep["id"] == "ep3":
            step = ep["own"] / PAGES
            rains.append((ep["start"] + 2 * step + 0.3, step))
    card_cues(cues, END["start"], 0.5, 2.1, 3, seam=True)
    write_mp3(os.path.join(OUT_DIR, "sfx-full.mp3"), build_sfx(TOTAL, cues, rains))


if __name__ == "__main__":
    sys.exit(main())
