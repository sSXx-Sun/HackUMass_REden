#!/usr/bin/env python3
"""Synthesises a fresh background track for the REden promo (no samples, pure numpy).
120 BPM, Am-F-C-G loop. Layers come in as the video gets busier; every scene cut gets a small whoosh.
Usage: python bgm.py out.wav [total_seconds]"""
import sys, wave
import numpy as np

SR = 44100
TOTAL = float(sys.argv[2]) if len(sys.argv) > 2 else 89.0
CUTS = [5.0, 12.0, 23.0, 30.0, 36.5, 43.5, 63.5, 72.5, 80.5]   # scene starts in build_video.py
BEAT, BAR = 0.5, 2.0
N = int(SR * TOTAL)
L = np.zeros(N, np.float32); R = np.zeros(N, np.float32)
rng = np.random.default_rng(7)

def add(sig, t0, pan=0.0, gain=1.0, bus=None):
    i = int(t0 * SR)
    if i >= N or i + len(sig) <= 0: return
    a = max(0, -i); sig = sig[a:]; i = max(i, 0); sig = sig[:N - i]
    l = gain * np.sqrt(0.5 * (1 - pan)) ; r = gain * np.sqrt(0.5 * (1 + pan))
    (bus or (L, R))[0][i:i + len(sig)] += sig * l
    (bus or (L, R))[1][i:i + len(sig)] += sig * r

def tt(d): return np.arange(int(d * SR)) / SR
def env(d, a, r):
    t = tt(d); e = np.minimum(t / max(a, 1e-4), 1) * np.minimum((d - t) / max(r, 1e-4), 1)
    return np.clip(e, 0, 1).astype(np.float32)
def lowpass(x, k): return np.convolve(x, np.ones(k) / k, mode='same').astype(np.float32)

CH = [(110.00, (0, 3, 7)), (87.31, (0, 4, 7)), (130.81, (0, 4, 7)), (98.00, (0, 4, 7))]  # Am F C G
def hz(root, semi): return root * 2 ** (semi / 12)

# separate buses so the reverb only touches the soft layers, drums stay dry
WET = (np.zeros(N, np.float32), np.zeros(N, np.float32))
bars = int(TOTAL // BAR) + 1
for b in range(bars):
    t0 = b * BAR; root, tri = CH[b % 4]
    # pad
    for s in tri:
        for det, pan in ((-0.004, -0.5), (0.0, 0.0), (0.004, 0.5)):
            f = hz(root * 2, s) * (1 + det); t = tt(BAR + 0.6)
            sig = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t)) * env(BAR + 0.6, 0.5, 0.9)
            add(sig, t0, pan, 0.028, WET)
    # arpeggio plucks from 5 s
    if t0 + BAR > 5.0 and t0 < TOTAL - 5:
        pat = [0, 1, 2, 1, 0, 2, 1, 2]
        for k, p in enumerate(pat):
            tn = t0 + k * 0.25
            if tn < 5.0: continue
            f = hz(root * 4, tri[p]); t = tt(0.9)
            sig = (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * 2 * f * t) + 0.18 * np.sin(2 * np.pi * 3 * f * t)) \
                  * np.exp(-t * 8.5) * np.minimum(t / 0.004, 1)
            add(sig.astype(np.float32), tn, (-0.45 if k % 2 else 0.45), 0.075, WET)
    # bell melody over the vocabulary section
    if 43.5 <= t0 < 63.5:
        for k, (beat, p) in enumerate(((0, 2), (1.5, 1), (2.5, 2), (3, 0))):
            f = hz(root * 8, tri[p]); t = tt(1.2)
            sig = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2.76 * f * t)) * np.exp(-t * 5)
            add(sig.astype(np.float32), t0 + beat * BEAT, 0.3, 0.05, WET)
    # bass from 23 s to the end card
    if 23.0 <= t0 < 80.5:
        for beat in (0, 1.5, 2, 3.5):
            f = root / 2; t = tt(0.45)
            sig = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)) * np.exp(-t * 5) * np.minimum(t / 0.006, 1)
            add(sig.astype(np.float32), t0 + beat * BEAT, 0, 0.30)

# drums (dry): kick from 12 s, hats from 12 s, clap from 23 s
tk = tt(0.35); kick = (np.sin(2 * np.pi * (45 * tk + 80 * (1 - np.exp(-tk * 30)) / 30 * 1.0)) * np.exp(-tk * 11)).astype(np.float32)
tk2 = tt(0.35); kick = (np.sin(2 * np.pi * np.cumsum(45 + 110 * np.exp(-tk2 * 40)) / SR) * np.exp(-tk2 * 10)).astype(np.float32)
noise = rng.standard_normal(SR).astype(np.float32)
hat = (noise[:int(0.07 * SR)] - lowpass(noise, 6)[:int(0.07 * SR)]) * np.exp(-tt(0.07) * 60)
clap = (noise[:int(0.2 * SR)] - lowpass(noise, 40)[:int(0.2 * SR)]) * np.exp(-tt(0.2) * 22)
nb = int(TOTAL / BEAT)
for k in range(nb):
    t = k * BEAT
    if 12.0 <= t < 80.5:
        add(kick, t, 0, 0.55)
        add(hat, t + BEAT / 2, 0.2, 0.10)
        if 23.0 <= t and k % 2 == 1: add(clap, t, 0, 0.16)
        if 43.5 <= t < 63.5: add(hat, t + BEAT / 4, -0.2, 0.05); add(hat, t + 3 * BEAT / 4, 0.2, 0.05)

# riser into the first drop and whoosh at every cut
def whoosh(t0, d, gain):
    n = rng.standard_normal(int(d * SR)).astype(np.float32); t = tt(d)
    sig = (n - lowpass(n, 30)) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    add(sig, t0, 0.0, gain)
whoosh(9.6, 2.4, 0.10)
for c in CUTS: whoosh(c - 0.12, 0.7, 0.06)
for c in (12.0, 23.0, 43.5, 80.5):
    t = tt(1.0); add((np.sin(2 * np.pi * np.cumsum(38 + 90 * np.exp(-t * 25)) / SR) * np.exp(-t * 3.2)).astype(np.float32), c, 0, 0.5)

# sidechain pump on the soft layers once the kick starts
tg = np.arange(N) / SR
pump = np.where(tg >= 12.0, 1 - 0.55 * np.exp(-6 * ((tg % BEAT) / BEAT)), 1.0).astype(np.float32)
WL, WR = WET[0] * pump, WET[1] * pump

# cheap convolution reverb
ir = rng.standard_normal(int(1.6 * SR)).astype(np.float32) * np.exp(-tt(1.6) * 3.2); ir = (ir - lowpass(ir, 8)) * 0.5
n = 1 << (N + len(ir)).bit_length(); fir = np.fft.rfft(ir, n)
def rev(x): return np.fft.irfft(np.fft.rfft(x, n) * fir, n)[:N].astype(np.float32)
mixL = L + WL + 0.35 * rev(WL) * 0.08 * 6; mixR = R + WR + 0.35 * rev(WR) * 0.08 * 6

# master: fades, gentle soft clip, normalise
fade = np.minimum(tg / 1.0, 1) * np.minimum((TOTAL - tg) / 3.5, 1)
out = np.stack([mixL, mixR], 1) * fade[:, None]
out = np.tanh(out * 1.3); out *= 0.89 / np.abs(out).max()
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((out * 32767).astype('<i2').tobytes())
print('wrote', sys.argv[1], f'{TOTAL:.1f}s')
