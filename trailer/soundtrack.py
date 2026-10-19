"""Synthesise the trailer's soundtrack from timeline.json. Everything is generated here: no samples, no licences.

    python soundtrack.py      -> soundtrack.wav (48 kHz stereo) and soundtrack.mp3
"""
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

HERE = Path(__file__).parent
TL = json.loads((HERE / "timeline.json").read_text())
SR = 48000
N = int(TL["duration"] * SR) + SR
C = TL["cues"]
rng = np.random.default_rng(1843)

dry = np.zeros((N, 2))
wet = np.zeros((N, 2))   # sent to the reverb


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def lp(x, f, order=2):
    return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def place(sig, at, gain=1.0, pan=0.0, send=0.3):
    """Mix a mono signal in at time `at` (s), panned -1..1, with some sent to the reverb."""
    i = int(at * SR)
    if i >= N or len(sig) == 0:
        return
    sig = sig[: N - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    for buf, g in ((dry, gain), (wet, gain * send)):
        buf[i:i + len(sig), 0] += sig * g * l
        buf[i:i + len(sig), 1] += sig * g * r


def env(n, a, d, sustain=0.0):
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), np.exp(-(t - a) / max(d, 1e-4)))
    return e * (1 - sustain) + sustain


def noise(dur):
    return rng.standard_normal(int(dur * SR))


def saw(f, t):
    return 2 * ((f * t) % 1) - 1


# ---------- instruments ----------
def room_tone(a, b):
    t = t_axis(b - a)
    brown = np.cumsum(noise(b - a)); brown = hp(brown - brown.mean(), 20); brown /= np.abs(brown).max() + 1e-9
    hum = 0.5 * np.sin(2 * np.pi * 50 * t) + 0.25 * np.sin(2 * np.pi * 100 * t) + 0.1 * np.sin(2 * np.pi * 150 * t)
    s = lp(brown, 400) * 0.8 + hum * 0.35
    fade = np.minimum(1, np.minimum(t / 0.3, (t[-1] - t) / 0.08))
    place(s * fade, a, 0.09, 0, 0.05)


def click(at, g=0.25):
    s = bp(noise(0.012), 2000, 6000) * env(int(0.012 * SR), 0.0005, 0.002)
    place(s, at, g, 0.1, 0.05)


def clink(at, g=0.3, pan=0.0, base=None, send=0.5):
    base = base or (1100 + rng.random() * 1500)
    t = t_axis(0.35)
    s = np.zeros_like(t)
    for m, a, d in ((1, 1, 0.16), (2.76, 0.55, 0.11), (5.4, 0.32, 0.07), (8.93, 0.18, 0.045)):
        s += a * np.sin(2 * np.pi * base * m * (0.995 + rng.random() * 0.01) * t) * np.exp(-t / d)
    s[: int(0.02 * SR)] += bp(noise(0.02), 3500, 7000) * 0.5 * np.exp(-np.arange(int(0.02 * SR)) / SR / 0.004)
    place(s, at, g, pan, send)


def chain_rattle(at, count=7, spread=1.1, g=0.22, pan=0.4, send=0.6):
    for k in range(count):
        clink(at + rng.random() * spread, g * (0.5 + rng.random() * 0.5), pan + (rng.random() - 0.5) * 0.3, send=send)


def braam(at, intensity=1.0):
    dur = 4.5
    t = t_axis(dur)
    s = np.zeros_like(t)
    for f in (55, 55.6, 82.4, 110.3, 109.6):
        s += saw(f, t)
    cutoff = 200 + 1800 * np.exp(-t / 0.9)
    # time-varying low-pass by blending two fixed filters
    bright, dark = lp(s, 1600, 4), lp(s, 220, 4)
    k = (cutoff - 200) / 1800
    s = bright * k + dark * (1 - k)
    s = np.tanh(s * 1.8)
    s += 0.9 * np.sin(2 * np.pi * 41.2 * t)
    e = env(len(t), 0.04, 1.6) * (1 - np.clip((t - 3.6) / 0.9, 0, 1))
    place(s * e, at, 0.32 * intensity, 0, 0.35)


def drone(a, b, g):
    t = t_axis(b - a)
    s = np.sin(2 * np.pi * 55 * t) + 0.7 * np.sin(2 * np.pi * 55.35 * t) + 0.45 * np.sin(2 * np.pi * 82.5 * t + 1) + 0.25 * np.sin(2 * np.pi * 164.8 * t)
    s += 0.35 * lp(noise(b - a), 300)
    lfo = 0.75 + 0.25 * np.sin(2 * np.pi * 0.13 * t)
    fade = np.minimum(1, np.minimum(t / 1.8, (t[-1] - t) / 0.6))
    place(s * lfo * fade, a, 0.06 * g, 0, 0.4)


def bell(at):
    t = t_axis(9)
    base = 98.0
    s = np.zeros_like(t)
    for r, a, d in ((0.5, 0.9, 7), (1, 1, 5), (1.19, 0.6, 3.4), (1.56, 0.5, 2.6), (2, 0.55, 2.2), (2.51, 0.35, 1.6), (2.66, 0.3, 1.4), (3.01, 0.25, 1.1), (4.1, 0.2, 0.7)):
        s += a * np.sin(2 * np.pi * base * r * t) * np.exp(-t / d)
    s[: int(0.03 * SR)] += bp(noise(0.03), 1500, 6000) * 0.6 * np.exp(-np.arange(int(0.03 * SR)) / SR / 0.006)
    place(s, at, 0.28, 0, 0.7)


def slam(at):
    t = t_axis(2.5)
    f = 35 + 115 * np.exp(-t / 0.05)
    kick = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.35)
    nz = lp(noise(2.5), 2500) * np.exp(-t / 0.08)
    metal = sum(a * np.sin(2 * np.pi * 180 * r * t) for r, a in ((1, 1), (2.3, 0.6), (3.7, 0.4), (5.9, 0.3))) * np.exp(-t / 0.5)
    s = np.tanh(1.6 * (kick * 1.1 + nz * 0.6 + metal * 0.25))
    place(s, at, 0.36, 0, 0.45)


def whoosh(peak):
    dur = 0.45
    t = t_axis(dur)
    s = bp(noise(dur), 300, 4000) * (t / dur) ** 2.5
    place(s * np.exp(-np.clip(t - dur * 0.92, 0, None) / 0.02), peak - dur, 0.16, rng.random() - 0.5, 0.2)


def glitch(at, dur):
    n = int(dur * SR)
    hold = 40 + int(rng.random() * 160)
    s = np.repeat(rng.standard_normal(n // hold + 1), hold)[:n]
    s = np.round(s * 4) / 4
    buzz = np.sign(np.sin(2 * np.pi * (100 + rng.random() * 300) * np.arange(n) / SR))
    s = (s * 0.6 + buzz * 0.4) * (rng.random(n // 2400 + 1).repeat(2400)[:n] > 0.25)
    place(hp(s, 200) * env(n, 0.002, dur * 0.6), at, 0.1 + 0.08 * min(1, dur), rng.random() - 0.5, 0.1)


def pulse(a, b):
    # trailer pulse: low hits that speed up, with a clock tick between
    t, beat = a, 0
    while t < b - 0.05:
        k = (t - a) / (b - a)
        interval = 0.72 * (1 - k) + 0.17 * k
        tt = t_axis(0.5)
        f = 45 + 50 * np.exp(-tt / 0.04)
        hit = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.18)
        place(hit, t, 0.2 + 0.2 * k, 0, 0.15)
        tick = bp(noise(0.03), 3000, 8000) * np.exp(-t_axis(0.03) / 0.006)
        place(tick, t + interval / 2, 0.06 + 0.06 * k, 0.4 if beat % 2 else -0.4, 0.2)
        t += interval
        beat += 1


def wind(a, b):
    t = t_axis(b - a)
    nz = noise(b - a)
    s = 0.6 * bp(nz, 300, 900) + 0.4 * bp(nz, 900, 2200)
    lfo = 0.55 + 0.45 * np.sin(2 * np.pi * 0.21 * t + 1) * np.sin(2 * np.pi * 0.07 * t)
    fade = np.minimum(1, np.minimum(t / 1.2, (t[-1] - t) / 0.4))
    place(s * lfo * fade, a, 0.12, -0.2, 0.5)


def riser(a, b):
    t = t_axis(b - a)
    k = t / (b - a)
    f = 90 * (14 ** k)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.5 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR)
    s = (0.5 * tone + 0.8 * hp(noise(b - a), 800) * k) * k ** 2.2
    s[-int(0.005 * SR):] *= np.linspace(1, 0, int(0.005 * SR))
    place(s, a, 0.2, 0, 0.3)


def heartbeat(a, b):
    t = a
    while t < b:
        k = (t - a) / (b - a)
        interval = 1.0 * (1 - k) + 0.5 * k
        for off, g in ((0, 1), (0.18, 0.7)):
            tt = t_axis(0.3)
            thump = lp(np.sin(2 * np.pi * (55 + 25 * np.exp(-tt / 0.03)) * tt) * np.exp(-tt / 0.09), 200)
            place(thump, t + off, 0.32 * g * (0.6 + 0.4 * k), 0, 0.1)
        t += interval


def stinger(at):
    t = t_axis(1.6)
    s = sum(saw(f, t) for f in (233.1, 246.9, 329.6, 349.2, 466.2, 493.9))
    s = np.tanh(2.2 * lp(s, 3000)) * np.exp(-t / 0.5)
    s += 0.8 * lp(noise(1.6), 5000) * np.exp(-t / 0.18)
    f = 30 + 120 * np.exp(-t / 0.06)
    s += 1.2 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.4)
    place(np.tanh(s), at, 0.95, 0, 0.5)


def rumble(at, dur=1.8):
    t = t_axis(dur)
    s = lp(noise(dur), 120, 4) * 3 + 0.6 * np.sin(2 * np.pi * 38 * t)
    place(s * np.sin(np.pi * np.clip(t / dur, 0, 1)), at, 0.3, 0, 0.3)


def grind(at):
    d = 0.09
    s = bp(noise(d), 1800, 4200) * env(int(d * SR), 0.005, 0.03) + 0.4 * bp(noise(d), 300, 800) * env(int(d * SR), 0.002, 0.02)
    place(s, at, 0.16, -0.15, 0.25)


def eerie_tone(at, dur=2.4):
    t = t_axis(dur)
    s = np.sin(2 * np.pi * 1180 * t + 6 * np.sin(2 * np.pi * 5.5 * t)) * np.minimum(1, t / 0.8) * np.minimum(1, (dur - t) / 0.6)
    place(s, at, 0.035, 0.3, 0.6)


def musicbox(a, b, notes, step=0.55, g=0.09, detune=1.0):
    t = a
    i = 0
    while t < b - 0.3:
        n = notes[i % len(notes)]
        if n is not None:
            f = 440 * 2 ** ((n - 69) / 12) * detune
            tt = t_axis(1.6)
            wob = 1 + 0.004 * np.sin(2 * np.pi * 0.7 * (t + tt))
            s = (np.sin(2 * np.pi * f * wob * tt) + 0.35 * np.sin(2 * np.pi * 3 * f * tt) * np.exp(-tt / 0.15) + 0.15 * np.sin(2 * np.pi * 5.4 * f * tt) * np.exp(-tt / 0.06)) * np.exp(-tt / 0.6)
            place(s, t, g, 0.15 * np.sin(i), 0.7)
        t += step
        i += 1


def pad(a, b, freqs, g):
    t = t_axis(b - a)
    s = sum(np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.003 * t) for f in freqs)
    fade = np.minimum(1, np.minimum(t / 1.5, (t[-1] - t) / 0.6))
    place(lp(s, 1800) * fade, a, g, 0, 0.6)


def birds(a, b):
    t = a + 0.2
    while t < b - 0.4:
        n = 2 + int(rng.random() * 4)
        f0 = 2600 + rng.random() * 1800
        pan = rng.random() * 1.6 - 0.8
        for k in range(n):
            d = 0.05 + rng.random() * 0.07
            tt = t_axis(d)
            f = f0 * (1 + 0.35 * np.sin(np.pi * tt / d)) * (1 + 0.04 * k)
            chirp = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / d)
            place(chirp, t + k * (d + 0.03), 0.05, pan, 0.4)
        t += 0.6 + rng.random() * 1.4


# ---------- the score ----------
for a, b in C["roomtone"]:
    room_tone(a, b)
for x in C["clicks"]:
    click(x)
for x in C["chainFar"]:
    chain_rattle(x, 5, 1.0, 0.07, 0.7, 0.9)
for x in C["subliminal"]:
    t = t_axis(0.4); place(np.sin(2 * np.pi * (3000 - 2500 * t / 0.4) * t) * np.sin(np.pi * t / 0.4), x - 0.05, 0.03, 0, 0.6)
a, b = C["interference"]
t = t_axis(b - a)
s = (hp(noise(b - a), 1500) * 0.6 + np.sign(np.sin(2 * np.pi * 50 * t)) * 0.3) * (t / (b - a)) ** 2
place(s, a, 0.22, 0, 0.1)
for x in C["thud"]:
    tt = t_axis(1.2); place(np.sin(2 * np.pi * (38 + 60 * np.exp(-tt / 0.03)) * tt) * np.exp(-tt / 0.3), x, 0.45, 0, 0.3)
# an original lullaby for the eulogy, slow and slightly wrong
A_MINOR = [69, 72, 76, 74, 72, 71, 69, 68, None, 69, 76, 74, 72, 71, 72, 69, None, 64, 69, 72, 71, 68, 69, None]
musicbox(C["musicbox"][0], C["musicbox"][1], A_MINOR, 0.52, 0.085, 0.997)
for x, k in C["braam"]:
    braam(x, k)
for x in C["warningAppear"]:
    t = t_axis(1.2); place(bp(noise(1.2), 2000, 9000) * (t / 1.2) ** 2, x - 1.0, 0.08, 0.6, 0.6)
chain_rattle(C["chainNear"][0], 7, 1.3, 0.18, 0.55, 0.4)
chain_rattle(C["chainNear"][1], 4, 0.6, 0.15, 0.55, 0.4)
for a, b, g in C["drone"]:
    drone(a, b, g)
for x in C["bell"]:
    bell(x)
for x in C["slam"]:
    slam(x)
for x in C["escTick"]:
    click(x, 0.18)
for x in C["whoosh"]:
    whoosh(x)
for x, d in C["glitch"]:
    glitch(x, d)
pulse(*C["pulse"])
wind(*C["wind"])
for x in C["flash"]:
    t = t_axis(0.25); place(bp(noise(0.25), 3000, 9000) * np.exp(-t / 0.06), x, 0.2, 0.3, 0.5)
riser(*C["riser"])
heartbeat(*C["heartbeat"])
# the choices: a click, the Crypt rising, the file's ghost drifting in, a chime for the tally; the impostor falling
for x in C["uiClick"]:
    s_ = bp(noise(0.02), 1500, 5000) * env(int(0.02 * SR), 0.0005, 0.004) + 0.5 * np.sin(2 * np.pi * 900 * t_axis(0.02)) * np.exp(-t_axis(0.02) / 0.005)
    place(s_, x, 0.32, -0.2, 0.15)
for x in C["cryptRise"]:
    rumble(x, 1.0)
a_, b_ = C["flight"]
tt_ = t_axis(b_ - a_)
place(bp(noise(b_ - a_), 500, 3000) * np.sin(np.pi * tt_ / (b_ - a_)) ** 2 + 0.3 * np.sin(2 * np.pi * (1600 - 900 * tt_ / (b_ - a_)) * tt_) * np.sin(np.pi * tt_ / (b_ - a_)), a_, 0.12, 0, 0.6)
for x in C["cryptEnter"]:
    tt_ = t_axis(1.2); place(np.sin(2 * np.pi * (40 + 50 * np.exp(-tt_ / 0.04)) * tt_) * np.exp(-tt_ / 0.3), x, 0.4, 0, 0.4)
    eerie_tone(x, 1.4)
for x in C["chime"]:
    for k_, f_ in enumerate((1318.5, 1975.5)):
        clink(x + k_ * 0.09, 0.14, 0.1, f_ / 1.0, 0.7)
for x in C["fall"]:
    tt_ = t_axis(0.9); f_ = 900 * np.exp(-tt_ / 0.35) + 80
    place(0.5 * np.sin(2 * np.pi * np.cumsum(f_) / SR) * np.exp(-tt_ / 0.5) + bp(noise(0.9), 600, 4000) * np.exp(-tt_ / 0.25), x, 0.2, 0.3, 0.3)
    for k_ in range(6):
        clink(x + 0.05 + k_ * 0.07, 0.07, 0.4, 2400 + k_ * 180, 0.4)
for x in C["rollover"]:
    click(x, 0.1)
for x in C["stinger"]:
    stinger(x)
for x in C["stoneRise"]:
    rumble(x)
for start, text in C["carve"]:
    for i, ch in enumerate(text):
        if ch.strip():
            grind(start + i / 7)
for x in C["tremble"]:
    eerie_tone(x)
for x in C["taglineHit"]:
    tt = t_axis(2.5); place(np.sin(2 * np.pi * 49 * tt) * np.exp(-tt / 0.7) + 0.2 * bp(noise(2.5), 4000, 9000) * np.exp(-tt / 1.0), x, 0.22, 0, 0.6)
# the title holds on a low drone and the lullaby again, slower and wrong
tb = C["titleBed"]
drone(tb[0], tb[2], 0.6)
musicbox(tb[1], tb[2], [69, 72, 76, 74, 72, 71, 69, None], 0.7, 0.07, 0.985)
a, b = C["morning"]
pad(a + 0.1, b + 0.5, [146.8, 185.0, 220.0, 293.7], 0.03)
birds(*C["birds"])
clink(C["linkDrop"][0], 0.42, 0, 1500, 0.35)
for x in C["linkRattle"]:
    clink(x, 0.16, 0.05, 1700 + rng.random() * 400, 0.35)

# ---------- reverb and master ----------
ir_t = np.arange(int(2.6 * SR)) / SR
ir = np.stack([lp(rng.standard_normal(len(ir_t)), 6000) * np.exp(-ir_t / 0.55) for _ in range(2)], axis=1)
ir[: int(0.012 * SR)] = 0
ir /= np.abs(ir).sum(axis=0).max() / 6
rev = np.stack([fftconvolve(wet[:, c], ir[:, c])[:N] for c in range(2)], axis=1)
mix = dry + rev * 0.9
# silences the edit relies on: the hush before the jump, and the very end
for a, b in ((75.8, 76.2),):
    i, j = int(a * SR), int(b * SR)
    mix[i:j] *= np.linspace(1, 0, j - i)[:, None] ** 8
mix[int((TL["duration"] - 0.05) * SR):] *= 0
mix = mix[: int(TL["duration"] * SR)]
peak = np.abs(mix).max()
mix = np.tanh(mix / peak * 1.25) / np.tanh(1.25) * 0.89
wav = (np.clip(mix, -1, 1) * 32767).astype("<i2")

import wave
with wave.open(str(HERE / "soundtrack.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(wav.tobytes())
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(HERE / "soundtrack.wav"), "-codec:a", "libmp3lame", "-b:a", "160k", str(HERE / "soundtrack.mp3")], check=True)
print("soundtrack written", len(mix) / SR, "s")
