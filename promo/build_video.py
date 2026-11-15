#!/usr/bin/env python3
"""REden promo video, rebuilt as code (PIL + ffmpeg). No audio from the old video is reused.

  python build_video.py still 30 out/still.png     # one frame at t=30 s
  python build_video.py render out/reden.mp4       # full render (needs out/bgm.wav from bgm.py)

Scene 04 (vocabulary) uses the real screen recording instead of the old static "12,000" card.
Set REDEN_DEMO to the demo .mp4 if it moves."""
import math, os, re, subprocess, sys
from functools import lru_cache
from multiprocessing import Pool
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DEMO = os.environ.get('REDEN_DEMO', '/Users/sophiasun/Library/Containers/com.tencent.xinWeChat/Data/Documents/'
       'xwechat_files/wxid_iuwcvgbum3j112_dc85/msg/video/2026-11/559e8dc094ca68748c6e6030fa002d23.mp4')
MARK = Image.open(os.path.join(ROOT, 'extension', 'icons', 'mark.png')).convert('RGBA')
W, H, FPS = 1920, 1080, 30

BG1, BG2 = (36, 32, 70), (24, 21, 50)
INK, BLUE, ORANGE = (236, 233, 250), (169, 156, 255), (232, 151, 90)
MUTED, DIM, LINE = (150, 150, 190), (112, 112, 156), (70, 64, 124)
CARD = (42, 38, 84)

# (name, start, duration) — duration = time until the next scene starts
SCENES = [('intro', 0, 5.0), ('hook', 5.0, 7.0), ('meet', 12.0, 11.0), ('weight', 23.0, 7.0), ('tree', 30.0, 6.5),
          ('indent', 36.5, 7.0), ('vocab', 43.5, 20.0), ('hood', 63.5, 9.0), ('care', 72.5, 8.0), ('end', 80.5, 8.5)]
TOTAL = 89.0
TR = 0.5

# ---------------------------------------------------------------- helpers
def clamp(x): return max(0.0, min(1.0, x))
def prog(t, a, b): return clamp((t - a) / (b - a))
def eo3(x): x = clamp(x); return 1 - (1 - x) ** 3
def eio(x): x = clamp(x); return 4 * x ** 3 if x < .5 else 1 - (-2 * x + 2) ** 3 / 2
def back(x, s=1.9): x = clamp(x); return 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2

AV = '/System/Library/Fonts/Avenir Next.ttc'
GEO_I = '/System/Library/Fonts/Supplemental/Georgia Italic.ttf'
AVI = dict(bold=0, demi=2, medium=5, regular=7, heavy=8)
@lru_cache(None)
def AVN(kind, size): return ImageFont.truetype(AV, int(size), index=AVI[kind])
@lru_cache(None)
def GEO(size): return ImageFont.truetype(GEO_I, int(size))

def T(img, x, y, s, font, fill=INK, a=1.0, al='l', sp=0):
    """Text with opacity. y is the top of the line box. sp = letter spacing."""
    if a <= 0.01 or not s: return 0
    w = font.getlength(s) + sp * (len(s) - 1) if sp else font.getlength(s)
    asc, desc = font.getmetrics(); pad = 6
    m = Image.new('L', (int(w) + 2 * pad + 2, asc + desc + 2 * pad), 0); d = ImageDraw.Draw(m)
    if sp:
        cx = pad
        for ch in s: d.text((cx, pad), ch, font=font, fill=255); cx += font.getlength(ch) + sp
    else: d.text((pad, pad), s, font=font, fill=255)
    if a < 1: m = m.point(lambda v: int(v * a))
    ox = x - (w / 2 if al == 'c' else w if al == 'r' else 0)
    img.paste(fill, (int(ox) - pad, int(y) - pad), m)
    return w

@lru_cache(None)
def rmask(w, h, r):
    m = Image.new('L', (w * 2, h * 2), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, w * 2 - 1, h * 2 - 1), r * 2, fill=255)
    return m.resize((w, h), Image.LANCZOS)

def rrect(img, box, r, fill, a=1.0, outline=None, ow=2, oa=1.0):
    x0, y0, x1, y1 = [int(v) for v in box]; w, h = x1 - x0, y1 - y0
    if w < 2 or h < 2 or a <= 0.01: return
    if outline:
        m = rmask(w, h, r); img.paste(outline, (x0, y0), m.point(lambda v: int(v * oa * a)) if oa * a < 1 else m)
        if w > 2 * ow and h > 2 * ow:
            m2 = rmask(w - 2 * ow, h - 2 * ow, max(r - ow, 1)); img.paste(fill, (x0 + ow, y0 + ow), m2.point(lambda v: int(v * a)) if a < 1 else m2)
    else:
        m = rmask(w, h, r); img.paste(fill, (x0, y0), m.point(lambda v: int(v * a)) if a < 1 else m)

def ring(img, cx, cy, r, wd, col, a):
    if a <= 0.01 or r < 2: return
    s = int(2 * r + wd * 2 + 4); m = Image.new('L', (s, s), 0)
    ImageDraw.Draw(m).ellipse((wd + 2, wd + 2, s - wd - 2, s - wd - 2), outline=255, width=int(wd))
    img.paste(col, (int(cx - s / 2), int(cy - s / 2)), m.point(lambda v: int(v * a)))

def zoom(img, z, cx=W / 2, cy=H / 2):
    if abs(z - 1) < 1e-4: return img
    bw, bh = W / z, H / z; x0 = min(max(cx - bw / 2, 0), W - bw); y0 = min(max(cy - bh / 2, 0), H - bh)
    return img.resize((W, H), Image.BILINEAR, box=(x0, y0, x0 + bw, y0 + bh))

# ---------------------------------------------------------------- animated background
_yy, _xx = np.mgrid[0:108, 0:192].astype(np.float32)
_base = np.zeros((108, 192, 3), np.float32)
for _c in range(3): _base[:, :, _c] = np.linspace(BG1[_c], BG2[_c], 108)[:, None]
_rng = np.random.default_rng(3)
_dots = [(_rng.uniform(0, W), _rng.uniform(0, H), _rng.uniform(8, 26), _rng.uniform(1.5, 3.6), _rng.uniform(0, 6.3)) for _ in range(46)]

def bg(tg):
    ph = (tg % 0.5) / 0.5; pulse = 1 + (0.22 * math.exp(-5 * ph) if tg > 12 else 0)
    a = _base.copy()
    for cx, cy, r, col, amp in ((60 + 38 * math.sin(tg * .21), 38 + 14 * math.cos(tg * .17), 40, (73, 65, 150), .6),
                                (150 + 28 * math.cos(tg * .19), 78 + 14 * math.sin(tg * .23), 44, ORANGE, .075 * pulse),
                                (100 + 50 * math.sin(tg * .13 + 2), 60 + 20 * math.cos(tg * .11), 36, (110, 95, 255), .10 * pulse)):
        a += np.exp(-((_xx - cx) ** 2 + (_yy - cy) ** 2) / (r * r))[..., None] * np.array(col, np.float32) * amp
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
    d = ImageDraw.Draw(img)
    for x0, y0, v, sz, p in _dots:
        b = 0.35 + 0.3 * math.sin(tg * 1.3 + p); c = tuple(int(BG1[i] + (INK[i] - BG1[i]) * b * .42) for i in range(3))
        x = (x0 + v * 0.6 * tg) % W; y = (y0 - v * tg) % H; d.ellipse((x, y, x + sz, y + sz), fill=c)
    return img

# ---------------------------------------------------------------- demo clip reader (real screen recording)
class Clip:
    def __init__(s, src, dur, speed, cw=1400, ch=747):
        s.src, s.dur, s.speed, s.cw, s.ch = src, dur, speed, cw, ch; s.p = None; s.cur = -1; s.last = None
    def _start(s, i):
        off = i * s.speed / FPS
        cmd = ['ffmpeg', '-v', 'error', '-ss', f'{s.src + off:.3f}', '-t', f'{max(s.dur - off, .1):.3f}', '-i', DEMO,
               '-vf', f'setpts=PTS/{s.speed},fps={FPS},crop=960:512:0:32,scale={s.cw}:{s.ch}:flags=lanczos',
               '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
        s.p = subprocess.Popen(cmd, stdout=subprocess.PIPE); s.cur = i - 1
    def get(s, i):
        i = max(i, 0)
        if s.p is None: s._start(i)
        n = s.cw * s.ch * 3
        while s.cur < i:
            b = s.p.stdout.read(n)
            if len(b) < n: break
            s.last = Image.frombytes('RGB', (s.cw, s.ch), b); s.cur += 1
        return s.last if s.last is not None else Image.new('RGB', (s.cw, s.ch), BG1)
CLIPS = {}
def clip(key, src, dur, speed, cw=1400, ch=747):
    if key not in CLIPS: CLIPS[key] = Clip(src, dur, speed, cw, ch)
    return CLIPS[key]

@lru_cache(None)
def shadow(w, h):
    m = Image.new('L', (w + 160, h + 160), 0); ImageDraw.Draw(m).rounded_rectangle((80, 80, w + 80, h + 80), 24, fill=255)
    return m.filter(ImageFilter.GaussianBlur(32))

def paste_card(img, frame, x, y, a, s, r=22):
    w, h = frame.size
    if s != 1: nw, nh = int(w * s), int(h * s); frame = frame.resize((nw, nh), Image.BILINEAR); x += (w - nw) // 2; y += (h - nh) // 2; w, h = nw, nh
    sh = shadow(w, h).point(lambda v: int(v * .75 * a)); img.paste((10, 8, 28), (x - 80, y - 80 + 26), sh)
    m = rmask(w, h, r); img.paste(frame, (x, y), m.point(lambda v: int(v * a)) if a < 1 else m)
    if a > .5: ImageDraw.Draw(img).rounded_rectangle((x, y, x + w, y + h), r, outline=LINE, width=2)

# ---------------------------------------------------------------- bionic words
ROLE = {'c': ('heavy', ORANGE, .55), 'm': ('bold', INK, .45), 'f': ('demi', INK, 0)}
def split(word, role):
    n = len(re.sub(r'[^A-Za-z]', '', word)); _, _, fr = ROLE[role]
    k = (1 if n <= 3 else 2) if role == 'f' else max(1, math.ceil(n * fr))
    return word[:k], word[k:]
def word_w(word, role, size):
    h, t = split(word, role); return AVN(ROLE[role][0], size).getlength(h) + AVN('regular', size).getlength(t)
def draw_word(img, x, y, word, role, size, p, a=1.0, dim=.5, tail_a=.58):
    h, t = split(word, role); fk, col, _ = ROLE[role]; fh = AVN(fk, size); fr = AVN('regular', size)
    if p < 1: T(img, x, y, word, fr, INK, a * dim * (1 - p))
    if p > 0: T(img, x, y, h, fh, col, a * p); T(img, x + fh.getlength(h), y, t, fr, INK, a * p * tail_a)

def layout_wrap(words, size, maxw, x0, y0, lh, center=False):
    sp = AVN('regular', size).getlength(' ') + 5; lines = [[]]; x = 0
    for i, (w, r) in enumerate(words):
        ww = word_w(w, r, size)
        if x + ww > maxw and lines[-1]: lines.append([]); x = 0
        lines[-1].append((i, ww)); x += ww + sp
    pos = [None] * len(words)
    for li, ln in enumerate(lines):
        tot = sum(w for _, w in ln) + sp * (len(ln) - 1); x = x0 + ((maxw - tot) / 2 if center else 0)
        for i, ww in ln: pos[i] = (x, y0 + li * lh); x += ww + sp
    return pos

def header(img, t, label, title, sub, x=130, y=60, tsize=92, t0=0.0):
    p = eo3(prog(t, t0, t0 + .6))
    T(img, x, y, label, AVN('heavy', 20), ORANGE, p, sp=4)
    T(img, x - (1 - p) * 70, y + 32, title, AVN('bold', tsize), INK, p)
    T(img, x, y + 32 + tsize * 1.28, sub, GEO(28), MUTED, eo3(prog(t, t0 + .3, t0 + .95)))

def logo(img, cx, top, wd, a=1.0, s=1.0):
    k = wd * s / MARK.width; m = MARK.resize((max(int(MARK.width * k), 2), max(int(MARK.height * k), 2)), Image.LANCZOS)
    x, y = int(cx - m.width / 2), int(top + (wd * MARK.height / MARK.width - m.height) / 2)
    al = m.getchannel('A').point(lambda v: int(v * a)); img.paste((250, 248, 255), (x, y), al)
    bw = 0.34 * m.width; rrect(img, (x + 0.045 * m.width, y + m.height + 8 * k, x + 0.045 * m.width + bw, y + m.height + 8 * k + max(6 * k * 1.3, 3)), 3, ORANGE, a)
    return y + m.height

def wordmark(img, cx, y, size, t, t0, a=1.0):
    f = AVN('bold', size); chars = 'REden'; ws = [f.getlength(c) for c in chars]; x = cx - sum(ws) / 2
    for i, c in enumerate(chars):
        p = eo3(prog(t, t0 + i * .07, t0 + i * .07 + .5)); T(img, x, y + (1 - p) * 60, c, f, INK, p * a); x += ws[i]

def pill(img, cx, y, text, a=1.0, filled=False, size=22):
    f = AVN('demi', size); w = f.getlength(text) + 46; h = size + 22
    rrect(img, (cx - w / 2, y, cx + w / 2, y + h), h // 2, ORANGE if filled else CARD, a, outline=None if filled else LINE, ow=2)
    T(img, cx, y + 9, text, f, (36, 24, 14) if filled else INK, a, al='c')
    return w

# ---------------------------------------------------------------- scenes
def sc_intro(t, tg):
    img = bg(tg)
    for k in range(3):
        p = prog(t, .3 + k * .35, 2.4 + k * .35); ring(img, W / 2, 400, 90 + 640 * eo3(p), 3, BLUE, .32 * (1 - p) * (p > 0))
    p = prog(t, .15, 1.0); s = back(p); logo(img, W / 2, 215, 330, eo3(p * 2), max(s, .01))
    wordmark(img, W / 2, 470, 150, t, .8)
    T(img, W / 2, 665, 'Find the core. Follow the meaning.', GEO(42), (214, 210, 240), eo3(prog(t, 1.9, 2.6)), al='c')
    T(img, W / 2, 740 + (1 - eo3(prog(t, 2.5, 3.2))) * 14, 'A BROWSER EXTENSION  ·  HACKUMASS 2026', AVN('heavy', 19), ORANGE, eo3(prog(t, 2.5, 3.2)), al='c', sp=5)
    return img

S1 = [("Although", 'f'), ("the", 'f'), ("committee", 'c'), ("approved", 'c'), ("the", 'f'), ("proposal", 'c'), ("last", 'm'), ("week,", 'm'),
      ("the", 'f'), ("students", 'c'), ("who", 'f'), ("had", 'f'), ("organized", 'c'), ("the", 'f'), ("protest", 'c'), ("said", 'c'),
      ("that", 'f'), ("the", 'f'), ("changes", 'c'), ("did", 'f'), ("not", 'c'), ("go", 'c'), ("far", 'm'), ("enough.", 'm')]

def sc_hook(t, tg):
    img = bg(tg); f = AVN('bold', 96)
    out = eio(prog(t, 2.9, 3.5))
    if out < 1:
        for ln, words, y, col in ((0, "Some sentences make you".split(), 400, INK), (1, "dig for the point.".split(), 530, ORANGE)):
            ws = [f.getlength(w) for w in words]; sp = 28; x = W / 2 - (sum(ws) + sp * (len(ws) - 1)) / 2
            for i, w in enumerate(words):
                p = eo3(prog(t, .2 + ln * .9 + i * .13, .2 + ln * .9 + i * .13 + .5)); T(img, x, y + (1 - p) * 70 - out * 90, w, f, col, p * (1 - out)); x += ws[i] + sp
        us = eo3(prog(t, 1.9, 2.5)); ux0 = W / 2 - f.getlength("dig for the point.") / 2
        rrect(img, (ux0, 645 - out * 90, ux0 + f.getlength("dig for the point.") * us, 651 - out * 90), 3, ORANGE, 1 - out)
    p = eo3(prog(t, 3.3, 4.0))
    if p > 0:
        T(img, W / 2, 285 + (1 - p) * 30, 'WHAT IS THIS SENTENCE ACTUALLY SAYING?', AVN('heavy', 22), ORANGE, p, al='c', sp=5)
        pos = layout_wrap(S1, 54, 1500, 210, 380, 100, center=True)
        for i, ((w, r), (x, y)) in enumerate(zip(S1, pos)):
            q = eo3(prog(t, 4.3 + i * .085, 4.3 + i * .085 + .55)); draw_word(img, x, y - 12 * math.sin(math.pi * q), w, r, 54, q, p, dim=.55)
        if t > 6.3:
            pp = eo3(prog(t, 6.3, 6.9)); T(img, W / 2, 740, 'Bold where the meaning is. Lighter everywhere else.', GEO(34), (214, 210, 240), pp, al='c')
    return img

def clip_scene(img, t, tg, key, src, dur, speed, label, title, sub, scene_dur):
    header(img, t, label, title, sub, x=260, y=40, tsize=70)
    p = eo3(prog(t, .7, 1.5)); c = clip(key, src, dur, speed)
    fr = c.get(int(max(t - .7, 0) * FPS)); paste_card(img, fr, 260, 236 - int((1 - p) * -80) + 0, p, .93 + .07 * p) if False else \
        paste_card(img, fr, 260, 236 + int((1 - p) * 90), p, .93 + .07 * p)
    return img

def sc_meet(t, tg):
    img = bg(tg)
    return clip_scene(img, t, tg, 'meet', 12.0, 15.5, 1.45, 'STEP 1  ·  TURN IT ON', 'Meet REden', 'One switch. Every paragraph, bolded by its own grammar.', 11)

_COV = [(500, .72), (1000, .80), (2000, .86), (4000, .91), (8000, .945), (12000, .96), (17000, .972), (30000, .985)]
def _cov(v): return float(np.interp(math.log10(v), [math.log10(a) for a, _ in _COV], [b for _, b in _COV]))

def vocab_chart(img, t, px, py, pw, ph):
    a = eo3(prog(t, 1.0, 1.7)); rrect(img, (px, py + (1 - a) * 50, px + pw, py + ph + (1 - a) * 50), 22, CARD, a, outline=LINE, ow=2)
    if a < .99: return
    X0, X1, Y0, Y1 = px + 95, px + pw - 45, py + 235, py + ph - 130      # plot box
    lx = lambda v: X0 + (X1 - X0) * (math.log10(v) - math.log10(500)) / (math.log10(30000) - math.log10(500))
    ly = lambda c: Y1 - (Y1 - Y0) * (c - .66) / (1.0 - .66)
    d = ImageDraw.Draw(img)
    T(img, px + 40, py + 28, 'WHAT YOUR VOCABULARY COVERS', AVN('heavy', 18), ORANGE, 1, sp=4)
    for c in (.7, .8, .9, 1.0):
        d.line((X0, ly(c), X1, ly(c)), fill=(62, 57, 112), width=1); T(img, X0 - 14, ly(c) - 11, f'{int(c * 100)}%', AVN('regular', 19), DIM, 1, al='r')
    for v, s in ((1000, '1k'), (2000, '2k'), (5000, '5k'), (10000, '10k'), (20000, '20k')):
        T(img, lx(v), Y1 + 12, s, AVN('regular', 19), DIM, 1, al='c')
    T(img, (X0 + X1) / 2, Y1 + 46, 'words you know  (log scale)', GEO(21), MUTED, 1, al='c')
    # likely range band
    ba = eo3(prog(t, 5.6, 6.4))
    if ba > 0:
        m = Image.new('L', (int(X1 - X0), int(Y1 - Y0)), 0); ImageDraw.Draw(m).rectangle((lx(8600) - X0, 0, lx(17000) - X0, Y1 - Y0), fill=int(60 * ba)); img.paste(BLUE, (int(X0), int(Y0)), m)
        T(img, (lx(8600) + lx(17000)) / 2, Y0 + 6, 'likely range', GEO(20), (200, 195, 245), ba, al='c')
    # curve drawn left -> right, marker sweeps to the user's 12,000
    sweep = eio(prog(t, 1.8, 5.0)); vmax = 10 ** (math.log10(500) + sweep * (math.log10(12000) - math.log10(500)))
    pts = [(lx(10 ** (math.log10(500) + k / 120 * (math.log10(30000) - math.log10(500)))), ly(_cov(10 ** (math.log10(500) + k / 120 * (math.log10(30000) - math.log10(500)))))) for k in range(121)]
    pts_u = [p for p in pts if p[0] <= lx(vmax)] or pts[:1]
    if len(pts_u) > 1:
        m = Image.new('L', (int(X1 - X0) + 4, int(Y1 - Y0) + 4), 0); ImageDraw.Draw(m).polygon([(x - X0, y - Y0) for x, y in pts_u] + [(pts_u[-1][0] - X0, Y1 - Y0), (pts_u[0][0] - X0, Y1 - Y0)], fill=70)
        img.paste(ORANGE, (int(X0), int(Y0)), m)
        d.line(pts_u, fill=ORANGE, width=6, joint='curve')
    mx, my = lx(vmax), ly(_cov(vmax))
    pulse = .5 + .5 * math.sin(t * 5)
    if sweep < 1 or True: ring(img, mx, my, 16 + 5 * pulse * (sweep >= 1), 3, ORANGE, .5 + .3 * pulse)
    d.ellipse((mx - 9, my - 9, mx + 9, my + 9), fill=(255, 236, 214))
    if sweep > .02: d.line((mx, my + 12, mx, Y1), fill=ORANGE, width=2)
    # big counters
    cnt = int(round(vmax / 100) * 100) if sweep < 1 else 12000
    T(img, px + 40, py + 62, f'{cnt:,}', AVN('bold', 92), INK, 1); T(img, px + 42, py + 158, 'English words you know', AVN('medium', 22), MUTED, 1)
    cv = _cov(vmax); T(img, px + pw - 40, py + 62, f'{cv * 100:.0f}%', AVN('bold', 92), ORANGE, 1, al='r')
    T(img, px + pw - 40, py + 158, 'of a page read as it is', AVN('medium', 22), MUTED, 1, al='r')
    ca = eo3(prog(t, 6.6, 7.4))
    if ca > 0:
        cx, cy = lx(19000), ly(.9); rrect(img, (cx - 150, cy - 10 + (1 - ca) * 20, cx + 40, cy + 100 + (1 - ca) * 20), 14, (58, 52, 112), ca, outline=ORANGE, ow=2)
        T(img, cx - 130, cy + 4 + (1 - ca) * 20, 'The rest gets a', AVN('demi', 21), INK, ca); T(img, cx - 130, cy + 32 + (1 - ca) * 20, 'translation', AVN('demi', 21), ORANGE, ca); T(img, cx - 130, cy + 60 + (1 - ca) * 20, 'in brackets.', AVN('demi', 21), INK, ca)
    T(img, px + 40, py + ph - 40, 'Approximate coverage of typical English text. Your number comes from the 10-question test.', AVN('regular', 17), DIM, eo3(prog(t, 7.2, 8)))

def sc_vocab(t, tg):
    img = bg(tg)
    header(img, t, '04  —  VOCABULARY', 'Your level, your words', 'Ten questions. Then only the words new to you get a translation.', x=100, y=40, tsize=70)
    p = eo3(prog(t, .7, 1.5)); c = clip('vocab', 70.0, 26.3, 1.35, 900, 480); fr = c.get(int(max(t - .7, 0) * FPS))
    paste_card(img, fr, 100, 290 + int((1 - p) * 90), p, .93 + .07 * p)
    T(img, 100 + 450, 790, 'The real extension, running', GEO(22), MUTED, eo3(prog(t, 1.6, 2.3)), al='c')
    vocab_chart(img, t, 1060, 260, 770, 760)
    return img

def legend(img, t, items, y):
    for i, (nm, d1, d2, col, fk) in enumerate(items):
        p = back(prog(t, 4.0 + i * .3, 4.7 + i * .3)); a = eo3(prog(t, 4.0 + i * .3, 4.5 + i * .3)); x = 130 + i * 560
        rrect(img, (x, y + (1 - p) * 40, x + 6, y + 100 + (1 - p) * 40), 3, col, a)
        T(img, x + 26, y + (1 - p) * 40, nm, AVN(fk, 40), col if col != INK else INK, a)
        T(img, x + 26, y + 54 + (1 - p) * 40, d1, AVN('regular', 22), MUTED, a); T(img, x + 26, y + 80 + (1 - p) * 40, d2, AVN('regular', 22), MUTED, a)

def sc_weight(t, tg):
    img = bg(tg); header(img, t, '01  —  STYLE', 'Weight', 'Heavier where the meaning is.')
    pos = layout_wrap(S1, 56, 1640, 130, 360, 104); a = eo3(prog(t, .5, 1.1))
    for i, ((w, r), (x, y)) in enumerate(zip(S1, pos)):
        q = eo3(prog(t, 1.3 + i * .075, 1.3 + i * .075 + .5)); draw_word(img, x, y - 14 * math.sin(math.pi * q), w, r, 56, q, a, dim=.55)
    legend(img, t, [('Core', 'weight 800 · each clause\'s subject,', 'verb, object', ORANGE, 'heavy'),
                    ('Content', 'weight 650 · other meaningful', 'words', INK, 'bold'), ('Function', 'weight 500 · the, of, pronouns,', 'auxiliaries', MUTED, 'medium')], 760)
    T(img, 130, 975, 'spaCy parses every sentence on your own machine — en_core_web_trf dependency tree.', AVN('regular', 22), DIM, eo3(prog(t, 5.3, 5.9)))
    return img

S2 = [("The", 1), ("negotiations", 1), ("remained", 0), ("intractable", 1), ("for", 1), ("months,", 2), ("and", 1), ("several", 2), ("observers", 1),
      ("were", 0), ("dubious", 1), ("about", 2), ("the", 3), ("fragile", 3), ("ceasefire.", 2)]
def sc_tree(t, tg):
    img = bg(tg); header(img, t, '02  —  STYLE', 'Tree', 'Deeper in the grammar, lighter on the page.')
    words = [(w, 'c' if d == 0 else 'm') for w, d in S2]; size = 58
    pos = layout_wrap(words, size, 1640, 130, 470, 150); a = eo3(prog(t, .5, 1.1))
    spread = eo3(prog(t, 1.3, 2.3)) * (1 - eio(prog(t, 3.6, 4.7)))
    for i, ((w, r), (x, y)) in enumerate(zip(words, pos)):
        d = S2[i][1]; off = (-34 + d * 22 + (10 if i % 2 else -10)) * spread
        fade = 1 - (1 - max(1 - .1 * d, .6)) * 0 if False else 1.0
        op = (1 - eio(prog(t, 3.6, 4.7))) + eio(prog(t, 3.6, 4.7)) * max(1 - .1 * d - .02, .6)
        q = eo3(prog(t, 1.0 + i * .04, 1.5 + i * .04)); draw_word(img, x, y + off, w, r, size, q, a * op, dim=.55)
        if spread > .05: T(img, x + 4, y + off + size * 1.25, str(d), AVN('medium', 18), ORANGE, spread * a * .9)
    T(img, 130, 920, 'opacity = 1 − 0.1 × depth  ·  never below 60 %  ·  never below WCAG AA contrast', AVN('regular', 22), DIM, eo3(prog(t, 4.8, 5.5)))
    return img

CLAUSES = [(70, range(0, 8)), (0, range(8, 10)), (70, range(10, 15)), (0, range(15, 16)), (70, range(16, 24))]
def sc_indent(t, tg):
    img = bg(tg); header(img, t, '03  —  STYLE', 'Indent', 'One clause per line.'); size = 56
    A = layout_wrap(S1, size, 1500, 130, 420, 100); sp = AVN('regular', size).getlength(' ') + 5
    B = [None] * len(S1)
    for li, (ind, rg) in enumerate(CLAUSES):
        x = 130 + ind
        for i in rg: ww = word_w(*S1[i], size); B[i] = (x, 400 + li * 98); x += ww + sp
    a = eo3(prog(t, .5, 1.1))
    for i, ((w, r), pa, pb) in enumerate(zip(S1, A, B)):
        q = eo3(prog(t, 1.2 + i * .05, 1.2 + i * .05 + .5)); g = eio(prog(t, 3.0 + i * .045, 3.0 + i * .045 + .8))
        x = pa[0] + (pb[0] - pa[0]) * g; y = pa[1] + (pb[1] - pa[1]) * g
        draw_word(img, x, y - 10 * math.sin(math.pi * q), w, r, size, q, a, dim=.55)
    for li, (ind, rg) in enumerate(CLAUSES):
        if ind: rrect(img, (112, 400 + li * 98 + 4, 117, 400 + li * 98 + 70), 2, ORANGE, eo3(prog(t, 4.2 + li * .15, 4.7 + li * .15)) * .9)
    T(img, 130, 940, 'Only sentences longer than 8 words. Inner clauses step in; the main clause comes back left.', AVN('regular', 22), DIM, eo3(prog(t, 5.0, 5.7)))
    return img

def sc_hood(t, tg):
    img = bg(tg); header(img, t, 'UNDER THE HOOD', 'Built on real language analysis', '', tsize=76, y=70)
    boxes = [('Web page', ['Any English article.', 'Paragraphs are read as', 'they scroll into view.']), ('REden', ['Extension for Chrome,', 'Edge & Firefox', '(Manifest V3)']),
             ('Local server', ['Python · Flask on your', 'computer, port 5000']), ('spaCy · wordfreq · Gemini', ['Dependency parse, clause', 'layout, word frequency,', 'translations.'])]
    bw, bh, gap, x0, y0 = 360, 250, 80, 120, 330; cps = []
    for i, (ti, lines) in enumerate(boxes):
        p = back(prog(t, .6 + i * .45, 1.3 + i * .45)); a = eo3(prog(t, .6 + i * .45, 1.1 + i * .45)); x = x0 + i * (bw + gap); y = y0 + (1 - p) * 60
        hot = i == 3 and t > 3.2; pul = .5 + .5 * math.sin(t * 4) if hot else 0
        rrect(img, (x, y, x + bw, y + bh), 18, CARD, a, outline=ORANGE if hot else LINE, ow=3 if hot else 2, oa=(.55 + .45 * pul) if hot else 1)
        f = AVN('bold', 32 if len(ti) < 14 else 28)
        if i == 3: T(img, x + 28, y + 26, 'spaCy · wordfreq ·', f, INK, a); T(img, x + 28, y + 62, 'Gemini', f, ORANGE, a); ly = 112
        else: T(img, x + 28, y + 28, ti, f, INK, a); ly = 80
        for k, ln in enumerate(lines): T(img, x + 28, y + ly + k * 34, ln, AVN('regular', 22), MUTED, a)
        cps.append((x + bw / 2, y0 + bh / 2))
        if i < 3:
            ap = eo3(prog(t, 1.0 + i * .45, 1.5 + i * .45)); ax0, ax1 = x + bw + 10, x + bw + gap - 12
            rrect(img, (ax0, y0 + bh / 2 - 2, ax0 + (ax1 - ax0) * ap, y0 + bh / 2 + 2), 2, ORANGE, ap)
            if ap > .9: d = ImageDraw.Draw(img); d.polygon([(ax1 + 6, y0 + bh / 2), (ax1 - 10, y0 + bh / 2 - 9), (ax1 - 10, y0 + bh / 2 + 9)], fill=ORANGE)
    # request dot travelling to the right, then the result travelling back along the return path
    path = [(x0 + bw / 2, y0 + bh / 2)] + [(x0 + i * (bw + gap) + bw / 2, y0 + bh / 2) for i in (1, 2, 3)]
    ret = [(x0 + 3 * (bw + gap) + bw / 2, y0 + bh + 18), (x0 + 3 * (bw + gap) + bw / 2, 720), (x0 + bw / 2, 720), (x0 + bw / 2, y0 + bh + 18)]
    rp = eo3(prog(t, 4.6, 5.6))
    if rp > 0:
        d = ImageDraw.Draw(img)
        pts = ret; tot = [math.dist(pts[k], pts[k + 1]) for k in range(3)]; L = sum(tot) * rp; acc = 0
        for k in range(3):
            seg = min(max(L - acc, 0), tot[k]); acc += tot[k]
            if seg > 0:
                ux = (pts[k + 1][0] - pts[k][0]) / tot[k]; uy = (pts[k + 1][1] - pts[k][1]) / tot[k]
                n = int(seg // 22)
                for j in range(n + 1): d.ellipse((pts[k][0] + ux * j * 22 - 3, pts[k][1] + uy * j * 22 - 3, pts[k][0] + ux * j * 22 + 3, pts[k][1] + uy * j * 22 + 3), fill=ORANGE)
        T(img, W / 2, 735, 'Back to the page: bold weights · clause lines · translations — the original text is restored when you turn it off.', AVN('regular', 23), (205, 200, 235), eo3(prog(t, 5.4, 6.1)), al='c')
    if t > 2.4:
        k = ((t - 2.4) % 3.2) / 3.2; seg = k * 3; s_i = min(int(seg), 2); f = seg - s_i; f = eio(f)
        a_, b_ = path[s_i], path[s_i + 1]; px = a_[0] + (b_[0] - a_[0]) * f; py = a_[1]
        for tr in range(8):
            ff = max(f - tr * .02, 0); ppx = a_[0] + (b_[0] - a_[0]) * ff; ring(img, ppx, py, 14 - tr, 2, ORANGE, .16 * (1 - tr / 8))
        ring(img, px, py, 8, 5, ORANGE, 1)
    return img

def sc_care(t, tg):
    img = bg(tg); header(img, t, 'MADE WITH CARE', 'Readable, private, light', '', tsize=76, y=70)
    cards = [('ACCESSIBILITY', 'WCAG AA', ['Faded text never drops', 'below 4.5 : 1 contrast.']), ('EFFICIENT', 'Lazy', ['Only paragraphs near', 'the screen are analysed.']),
             ('PRIVATE', 'Local', ['Sentence analysis runs', 'on your own computer.']), ('EVERYWHERE', '3 browsers', ['Chrome, Edge and', 'Firefox from one', 'codebase.'])]
    cw, ch, gap, x0, y0 = 395, 300, 30, 135, 360
    for i, (lab, big, lines) in enumerate(cards):
        p = back(prog(t, .7 + i * .28, 1.4 + i * .28)); a = eo3(prog(t, .7 + i * .28, 1.2 + i * .28)); x = x0 + i * (cw + gap)
        y = y0 + (1 - p) * 120 + 8 * math.sin(t * 1.6 + i * 1.3) * eo3(prog(t, 2.5, 3.2))
        rrect(img, (x, y, x + cw, y + ch), 16, CARD, a, outline=LINE, ow=2)
        rrect(img, (x + 2, y, x + 2 + (cw - 4) * eo3(prog(t, 1.2 + i * .28, 1.9 + i * .28)), y + 5), 2, ORANGE, a)
        T(img, x + 30, y + 40, lab, AVN('heavy', 17), DIM, a, sp=3); T(img, x + 30, y + 80, big, AVN('bold', 56), INK, a)
        for k, ln in enumerate(lines): T(img, x + 30, y + 170 + k * 34, ln, AVN('regular', 23), MUTED, a)
    return img

def sc_end(t, tg):
    img = bg(tg)
    for k in range(3):
        p = prog(t, .2 + k * .35, 2.4 + k * .35); ring(img, W / 2, 380, 90 + 700 * eo3(p), 3, BLUE, .3 * (1 - p) * (p > 0))
    p = prog(t, .1, .9); logo(img, W / 2, 205, 300, eo3(p * 2), max(back(p), .01))
    wordmark(img, W / 2, 440, 140, t, .7)
    T(img, W / 2, 625, 'Find the core. Follow the meaning.', GEO(40), (214, 210, 240), eo3(prog(t, 1.6, 2.3)), al='c')
    a = eo3(prog(t, 2.2, 2.9)); cx = W / 2; ws = [AVN('demi', 22).getlength(s) + 46 for s in ('Chrome · Edge · Firefox', 'spaCy + Python backend', 'Built at HackUMass 2026')]
    x = cx - (sum(ws) + 2 * 18) / 2
    for s, w, fl in zip(('Chrome · Edge · Firefox', 'spaCy + Python backend', 'Built at HackUMass 2026'), ws, (False, False, True)):
        pill(img, x + w / 2, 705 + (1 - a) * 20, s, a, fl); x += w + 18
    T(img, W / 2, 800, 'github.com/1234567Yang/HackUMass_ReaDeN', AVN('regular', 22), DIM, eo3(prog(t, 3.2, 3.9)), al='c')
    fo = eio(prog(t, 6.6, 8.2))
    return Image.blend(img, Image.new('RGB', (W, H), (0, 0, 0)), fo) if fo > 0 else img

FN = dict(intro=sc_intro, hook=sc_hook, meet=sc_meet, weight=sc_weight, tree=sc_tree, indent=sc_indent, vocab=sc_vocab, hood=sc_hood, care=sc_care, end=sc_end)

def frame_at(t):
    i = max(k for k, (_, s, _) in enumerate(SCENES) if s <= t); name, s, d = SCENES[i]; lt = t - s
    def one(nm, st, du, ltm, extra=1.0):
        im = FN[nm](ltm, st + ltm); return zoom(im, extra * (1 + .035 * min(ltm, du + TR) / du))
    if i > 0 and lt < TR:
        pn, ps, pd = SCENES[i - 1]; p = eio(lt / TR)
        A = one(pn, ps, pd, pd + lt, 1 + .07 * p); B = one(name, s, d, lt, 1.07 - .07 * p)
        out = Image.blend(A, B, p)
    else: out = one(name, s, d, lt)
    ImageDraw.Draw(out).rectangle((0, H - 5, int(W * t / TOTAL), H), fill=ORANGE)
    return out

def render_chunk(args):
    k, f0, f1, out = args
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '15', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
    for f in range(f0, f1): p.stdin.write(frame_at(f / FPS).tobytes())
    p.stdin.close(); p.wait(); return out

if __name__ == '__main__':
    if sys.argv[1] == 'still': frame_at(float(sys.argv[2])).save(sys.argv[3])
    elif sys.argv[1] == 'render':
        out = sys.argv[2]; tmp = os.path.join(HERE, 'out', 'seg'); os.makedirs(tmp, exist_ok=True)
        n = int(TOTAL * FPS); step = 150; jobs = [(k, f, min(f + step, n), os.path.join(tmp, f'{k:03d}.mp4')) for k, f in enumerate(range(0, n, step))]
        with Pool(min(8, os.cpu_count() or 4)) as pool: segs = pool.map(render_chunk, jobs, chunksize=1)
        lst = os.path.join(tmp, 'list.txt'); open(lst, 'w').write(''.join(f"file '{s}'\n" for s in segs))
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-i', os.path.join(HERE, 'out', 'bgm.wav'),
                        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], check=True)
        print('done', out)
