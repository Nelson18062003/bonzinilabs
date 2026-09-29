"""Small, dependency-light DSP toolkit for the reel's music / SFX / mix (48 kHz, float64).

Everything is deterministic (seeded RNG only). Signals are numpy arrays: mono (n,) or stereo (n, 2).
Contents: band-limited oscillators (polyBLEP), envelopes, RBJ biquads (static + time-varying,
block-wise with carried state), convolution reverb with a synthesized IR, tempo-synced ping-pong
delay, compressor, true-peak-aware lookahead limiter, BS.1770-4 loudness, report plots (PIL).
"""
import numpy as np
import scipy.signal as sps
from scipy.ndimage import minimum_filter1d, uniform_filter1d
import soundfile as sf

SR = 48000
DUR = 45.0
N = int(round(DUR * SR))
BPM = 120.0
BEAT = 60.0 / BPM          # 0.5 s
BAR = 4 * BEAT              # 2.0 s


def mtof(m):
    return 440.0 * 2.0 ** ((np.asarray(m, dtype=float) - 69.0) / 12.0)


def ns(t):
    return int(round(t * SR))


def db(x):
    return 20 * np.log10(np.maximum(np.abs(x), 1e-12))


def undb(d):
    return 10.0 ** (np.asarray(d) / 20.0)


def rng(seed):
    return np.random.default_rng(seed)


def stereo(x):
    x = np.asarray(x, dtype=float)
    return np.stack([x, x], axis=1) if x.ndim == 1 else x


def pan(x, p):
    """Constant-power pan of a mono signal; p in [-1, 1] (scalar or per-sample array)."""
    a = (np.asarray(p) + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1)


def add_at(buf, sig, t, gain=1.0):
    """Mix sig into buf starting at time t (s). Handles mono->stereo and clipping at edges."""
    i0 = ns(t)
    sig = stereo(sig) if buf.ndim == 2 else sig
    if i0 < 0:
        sig = sig[-i0:]
        i0 = 0
    n = min(len(sig), len(buf) - i0)
    if n > 0:
        buf[i0:i0 + n] += gain * sig[:n]
    return buf


# ----------------------------------------------------------------------------- oscillators
def _phase(freq, n, phase0=0.0):
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    dt = f / SR
    ph = np.mod(phase0 + np.cumsum(dt) - dt[0], 1.0)
    return ph, dt


def _polyblep(t, dt):
    y = np.zeros_like(t)
    m = t < dt
    x = t[m] / dt[m]
    y[m] = x + x - x * x - 1.0
    m = t > 1.0 - dt
    x = (t[m] - 1.0) / dt[m]
    y[m] = x * x + x + x + 1.0
    return y


def saw(freq, n, phase0=0.0):
    t, dt = _phase(freq, n, phase0)
    return 2.0 * t - 1.0 - _polyblep(t, dt)


def pulse(freq, n, pw=0.5, phase0=0.0):
    t, dt = _phase(freq, n, phase0)
    t2 = np.mod(t + pw, 1.0)
    s1 = 2.0 * t - 1.0 - _polyblep(t, dt)
    s2 = 2.0 * t2 - 1.0 - _polyblep(t2, dt)
    return s1 - s2   # zero-mean for any pw


def sine(freq, n, phase0=0.0):
    t, _ = _phase(freq, n, phase0)
    return np.sin(2 * np.pi * t)


def tri(freq, n, phase0=0.0):
    # integrated band-limited square would be ideal; for the low/soft uses here a naive tri is clean
    t, _ = _phase(freq, n, phase0)
    return 1.0 - 4.0 * np.abs(t - 0.5)


def supersaw(freq, n, voices=7, detune_cents=18.0, seed=0, width=1.0):
    """Stereo detuned saw stack. freq scalar or per-sample array."""
    r = rng(seed)
    out = np.zeros((n, 2))
    spread = np.linspace(-1, 1, voices)
    for i, s in enumerate(spread):
        cents = s * detune_cents * (0.85 + 0.3 * r.random())
        f = np.asarray(freq, dtype=float) * 2 ** (cents / 1200.0)
        v = saw(f, n, phase0=r.random())
        g = 1.0 if abs(s) < 1e-9 else 0.8
        out += pan(v * g, s * width * 0.9)
    return out / np.sqrt(voices)


def noise(n, seed=0, ch=1):
    r = rng(seed)
    return r.standard_normal(n) if ch == 1 else r.standard_normal((n, ch))


# ----------------------------------------------------------------------------- envelopes
def adsr(n, a, d, s, r, gate, curve=4.0):
    """ADSR as an array of n samples. gate = note-on duration (s). Exponential-ish segments."""
    t = np.arange(n) / SR
    env = np.zeros(n)
    a = max(a, 1e-4)
    ma = t < a
    env[ma] = (t[ma] / a) ** 0.9
    md = (t >= a) & (t < gate)
    env[md] = s + (1 - s) * np.exp(-(t[md] - a) * curve / max(d, 1e-4))
    gi = min(int(gate * SR), n)
    lvl = env[gi - 1] if gi > 0 else 0.0
    mr = t >= gate
    env[mr] = lvl * np.exp(-(t[mr] - gate) * 6.9 / max(r, 1e-4))
    return env


def expdecay(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def fade(x, fin=0.002, fout=0.005):
    x = x.copy()
    a, b = int(fin * SR), int(fout * SR)
    if a > 0:
        w = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
        x[:a] *= w if x.ndim == 1 else w[:, None]
    if b > 0:
        w = np.cos(np.linspace(0, np.pi / 2, b)) ** 2
        x[-b:] *= w if x.ndim == 1 else w[:, None]
    return x


# ----------------------------------------------------------------------------- filters
def _rbj(kind, fc, q, gain_db=0.0):
    """Vectorized RBJ cookbook coefficients. fc may be an array -> (b, a) arrays of shape (k, 3)."""
    fc = np.clip(np.asarray(fc, dtype=float), 10.0, SR * 0.49)
    w = 2 * np.pi * fc / SR
    cw, sw = np.cos(w), np.sin(w)
    alpha = sw / (2 * q)
    A = 10 ** (gain_db / 40.0)
    if kind == 'lp':
        b = np.stack([(1 - cw) / 2, 1 - cw, (1 - cw) / 2], -1)
        a = np.stack([1 + alpha, -2 * cw, 1 - alpha], -1)
    elif kind == 'hp':
        b = np.stack([(1 + cw) / 2, -(1 + cw), (1 + cw) / 2], -1)
        a = np.stack([1 + alpha, -2 * cw, 1 - alpha], -1)
    elif kind == 'bp':
        b = np.stack([alpha, np.zeros_like(w), -alpha], -1)
        a = np.stack([1 + alpha, -2 * cw, 1 - alpha], -1)
    elif kind == 'peak':
        b = np.stack([1 + alpha * A, -2 * cw, 1 - alpha * A], -1)
        a = np.stack([1 + alpha / A, -2 * cw, 1 - alpha / A], -1)
    elif kind in ('ls', 'hs'):
        sq = 2 * np.sqrt(A) * alpha
        sgn = 1 if kind == 'ls' else -1
        b = np.stack([A * ((A + 1) - sgn * (A - 1) * cw + sq),
                      sgn * 2 * A * ((A - 1) - sgn * (A + 1) * cw),
                      A * ((A + 1) - sgn * (A - 1) * cw - sq)], -1)
        a = np.stack([(A + 1) + sgn * (A - 1) * cw + sq,
                      -sgn * 2 * ((A - 1) + sgn * (A + 1) * cw),
                      (A + 1) + sgn * (A - 1) * cw - sq], -1)
    else:
        raise ValueError(kind)
    return b / a[..., :1], a / a[..., :1]


def biquad(x, kind, fc, q=0.707, gain_db=0.0):
    b, a = _rbj(kind, fc, q, gain_db)
    return sps.lfilter(b, a, x, axis=0)


def tv_biquad(x, kind, fc, q=0.707, gain_db=0.0, block=32):
    """Time-varying biquad: coefficients updated every `block` samples, filter state carried.
    fc: scalar or per-sample array (len(x)); q may also be per-sample."""
    n = len(x)
    if np.isscalar(fc) and np.isscalar(q):
        return biquad(x, kind, fc, q, gain_db)
    idx = np.arange(0, n, block)
    fcb = np.broadcast_to(np.asarray(fc, dtype=float), (n,))[idx]
    qb = np.broadcast_to(np.asarray(q, dtype=float), (n,))[idx]
    B, A = _rbj(kind, fcb, qb, gain_db)
    y = np.empty_like(x, dtype=float)
    shp = (2,) + x.shape[1:]
    zi = np.zeros(shp)
    for k, i0 in enumerate(idx):
        seg = x[i0:i0 + block]
        y[i0:i0 + block], zi = sps.lfilter(B[k], A[k], seg, axis=0, zi=zi)
    return y


def lp(x, fc, q=0.707):
    return tv_biquad(x, 'lp', fc, q)


def hp(x, fc, q=0.707):
    return tv_biquad(x, 'hp', fc, q)


def butter(x, kind, fc, order=4):
    sos = sps.butter(order, fc, btype={'lp': 'lowpass', 'hp': 'highpass', 'bp': 'bandpass'}[kind], fs=SR, output='sos')
    return sps.sosfilt(sos, x, axis=0)


def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    return sps.lfilter([1 - a], [1, -a], x, axis=0)


def dc_block(x, fc=12.0):
    return butter(x, 'hp', fc, order=2)


# ----------------------------------------------------------------------------- nonlinear
def softclip(x, drive=1.0):
    return np.tanh(x * drive) / np.tanh(drive)


def bitcrush(x, bits=6, hold=4):
    q = 2 ** (bits - 1)
    y = np.round(x * q) / q
    if hold > 1:
        idx = (np.arange(len(y)) // hold) * hold
        y = y[idx]
    return y


# ----------------------------------------------------------------------------- space
def make_ir(dur=2.4, rt_low=2.2, rt_mid=1.8, rt_high=0.7, predelay=0.018, seed=7, early=True, bright=1.0):
    """Stereo decaying-noise IR with frequency-dependent decay, early reflections, soft onset."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    r = rng(seed)
    out = np.zeros((n, 2))
    for ch in range(2):
        z = r.standard_normal(n)
        lo = butter(z, 'lp', 350, 2)
        mid = butter(z, 'bp', [350, 4000], 2)
        hi = butter(z, 'hp', 4000, 2) * bright
        env = lambda rt: 10 ** (-3 * t / rt)
        out[:, ch] = lo * env(rt_low) + mid * env(rt_mid) + hi * env(rt_high)
    onset = 1 - np.exp(-t / 0.012)
    out *= onset[:, None]
    if early:
        for k in range(10):
            d = 0.004 + r.random() * 0.07
            g = 0.5 * (0.85 ** k)
            i = int(d * SR)
            out[i, k % 2] += g * np.sign(r.standard_normal()) * 3
    pd = int(predelay * SR)
    out = np.concatenate([np.zeros((pd, 2)), out])[:n]
    out /= np.sqrt(np.sum(out ** 2) / 2)
    return out


def reverb(x, ir, wet=1.0, hp_fc=180.0, lp_fc=9000.0):
    """Returns ONLY the wet signal (stereo). x mono or stereo (summed to mono send)."""
    m = x if x.ndim == 1 else x.mean(axis=1)
    m = butter(m, 'hp', hp_fc, 2)
    m = butter(m, 'lp', lp_fc, 2)
    y = np.stack([sps.oaconvolve(m, ir[:, c])[:len(m)] for c in range(2)], axis=1)
    return y * wet


def pingpong(x, delay_s, fb=0.45, taps=8, lp_fc=5000.0, hp_fc=250.0, first='L'):
    """Tempo-synced ping-pong delay, wet only (stereo). Each repeat is darker."""
    m = x if x.ndim == 1 else x.mean(axis=1)
    n = len(m)
    d = int(round(delay_s * SR))
    out = np.zeros((n, 2))
    y = butter(m, 'hp', hp_fc, 2)
    c0 = 0 if first == 'L' else 1
    for k in range(1, taps + 1):
        y = onepole_lp(y, lp_fc)
        sh = k * d
        if sh >= n:
            break
        ch = (c0 + k - 1) % 2
        out[sh:, ch] += (fb ** (k - 1)) * y[:n - sh]
    return out


def haas(x, ms=12.0, side='R'):
    d = int(ms * SR / 1000)
    y = np.concatenate([np.zeros(d), x])[:len(x)]
    return np.stack([x, y], 1) if side == 'R' else np.stack([y, x], 1)


def width(x, w):
    m = (x[:, 0] + x[:, 1]) / 2
    s = (x[:, 0] - x[:, 1]) / 2 * w
    return np.stack([m + s, m - s], 1)


# ----------------------------------------------------------------------------- dynamics
def smooth_gain_db(target_db, att, rel, step):
    """Asymmetric one-pole smoothing of a gain curve in dB (sampled every `step` seconds).
    Going DOWN (more reduction) uses `att`, going UP uses `rel` (time constants in s)."""
    ca = np.exp(-step / max(att, 1e-6))
    cr = np.exp(-step / max(rel, 1e-6))
    out = np.empty_like(target_db)
    g = target_db[0]
    for i, v in enumerate(target_db):
        c = ca if v < g else cr
        g = c * g + (1 - c) * v
        out[i] = g
    return out


def compressor(x, thr_db=-18, ratio=2.0, att=0.01, rel=0.15, knee_db=6.0, makeup_db=0.0,
               sc=None, block=16, detector='rms', rms_win=0.01, return_gain=False):
    """Feed-forward compressor; detection on block level (peak or short RMS), dB-domain smoothing."""
    s = x if sc is None else sc
    s = np.abs(s) if s.ndim == 1 else np.max(np.abs(s), axis=1)
    if detector == 'rms':
        s = np.sqrt(np.maximum(uniform_filter1d(s ** 2, max(1, int(rms_win * SR))), 0.0))
    nb = int(np.ceil(len(s) / block))
    pad = np.zeros(nb * block)
    pad[:len(s)] = s
    lvl = db(pad.reshape(nb, block).max(axis=1))
    over = lvl - thr_db
    gr = np.where(over <= -knee_db / 2, 0.0,
                  np.where(over >= knee_db / 2, over * (1 - 1 / ratio),
                           (1 - 1 / ratio) * (over + knee_db / 2) ** 2 / (2 * knee_db)))
    g = smooth_gain_db(-gr, att, rel, block / SR)
    tb = (np.arange(nb) + 0.5) * block
    gs = np.interp(np.arange(len(s)), tb, g) + makeup_db
    lin = undb(gs)
    y = x * (lin if x.ndim == 1 else lin[:, None])
    return (y, gs) if return_gain else y


def true_peak_env(x, os=4):
    """Per-sample max |x| over a 4x-oversampled version (approx. true peak), channels merged."""
    x2 = stereo(x)
    up = sps.resample_poly(x2, os, 1, axis=0)
    a = np.max(np.abs(up), axis=1)
    n = len(x2)
    a = a[:n * os].reshape(n, os).max(axis=1)
    return a


def limiter(x, ceiling_db=-1.2, lookahead=0.004, release=0.12):
    """Lookahead true-peak-aware brickwall limiter. Output true peak <= ceiling (approx, 4x OS)."""
    c = undb(ceiling_db)
    pk = true_peak_env(x)
    req = np.minimum(1.0, c / np.maximum(pk, 1e-9))
    L = max(1, int(lookahead * SR))
    g = minimum_filter1d(req, size=2 * L + 1, mode='nearest')
    g = uniform_filter1d(g, size=L, mode='nearest')
    # release: block-wise recovery that never exceeds g (keeps guarantee)
    blk = 16
    nb = int(np.ceil(len(g) / blk))
    gp = np.ones(nb * blk)
    gp[:len(g)] = g
    gmin = gp.reshape(nb, blk).min(axis=1)
    cr = np.exp(-blk / (release * SR))
    out = np.empty(nb)
    cur = 1.0
    for i in range(nb):
        v = gmin[i]
        cur = v if v < cur else cr * cur + (1 - cr) * v
        out[i] = cur
    gs = np.repeat(out, blk)[:len(g)]
    gs = np.minimum(gs, g)
    y = stereo(x) * gs[:, None]
    return y, gs


# ----------------------------------------------------------------------------- loudness
_KB1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
_KA1 = [1.0, -1.69065929318241, 0.73248077421585]
_KB2 = [1.0, -2.0, 1.0]
_KA2 = [1.0, -1.99004745483398, 0.99007225036621]


def kweight(x):
    y = sps.lfilter(_KB1, _KA1, stereo(x), axis=0)
    return sps.lfilter(_KB2, _KA2, y, axis=0)


def _block_ms(x, win, hop):
    y = kweight(x)
    p = np.sum(y ** 2, axis=1)
    c = np.concatenate([[0.0], np.cumsum(p)])
    w, h = int(win * SR), int(hop * SR)
    starts = np.arange(0, len(p) - w + 1, h)
    return (c[starts + w] - c[starts]) / w, starts


def lufs_integrated(x, mask=None):
    """BS.1770-4 integrated loudness. `mask` (per-sample bool) optionally restricts blocks
    (block kept if >50% of its samples are in mask) -- used to measure 'during speech' loudness."""
    ms, st = _block_ms(x, 0.4, 0.1)
    if mask is not None:
        c = np.concatenate([[0], np.cumsum(mask.astype(float))])
        frac = (c[st + int(0.4 * SR)] - c[st]) / (0.4 * SR)
        ms = ms[frac > 0.5]
    if len(ms) == 0:
        return -np.inf
    lk = -0.691 + 10 * np.log10(np.maximum(ms, 1e-20))
    ms = ms[lk > -70]
    if len(ms) == 0:
        return -np.inf
    rel = -0.691 + 10 * np.log10(np.mean(ms)) - 10
    lk = -0.691 + 10 * np.log10(np.maximum(ms, 1e-20))
    ms = ms[lk > rel]
    return -0.691 + 10 * np.log10(np.mean(ms))


def lufs_shortterm(x, hop=0.1):
    ms, st = _block_ms(x, 3.0, hop)
    return (st + int(1.5 * SR)) / SR, -0.691 + 10 * np.log10(np.maximum(ms, 1e-20))


def lufs_momentary(x, hop=0.05):
    ms, st = _block_ms(x, 0.4, hop)
    return (st + int(0.2 * SR)) / SR, -0.691 + 10 * np.log10(np.maximum(ms, 1e-20))


# ----------------------------------------------------------------------------- io
def load(path, n=None):
    x, sr = sf.read(path, always_2d=True, dtype='float64')
    if sr != SR:
        from math import gcd
        g = gcd(sr, SR)
        x = sps.resample_poly(x, SR // g, sr // g, axis=0)
    if x.shape[1] == 1:
        x = np.repeat(x, 2, axis=1)
    x = x[:, :2]
    if n is not None:
        if len(x) < n:
            x = np.concatenate([x, np.zeros((n - len(x), 2))])
        x = x[:n]
    return x


def save(path, x, subtype='FLOAT'):
    x = stereo(x)
    sf.write(path, x.astype(np.float32 if subtype == 'FLOAT' else np.float64), SR, subtype=subtype)


# ----------------------------------------------------------------------------- report plots
def _cmap(v):
    """v in [0,1] -> RGB uint8 (magma-like, hand-rolled; no matplotlib available)."""
    stops = np.array([[0, 0, 4], [40, 11, 84], [101, 21, 110], [159, 42, 99], [212, 72, 66],
                      [245, 125, 21], [250, 193, 39], [252, 255, 164]], dtype=float)
    p = np.clip(v, 0, 1) * (len(stops) - 1)
    i = np.minimum(p.astype(int), len(stops) - 2)
    f = (p - i)[..., None]
    return (stops[i] * (1 - f) + stops[i + 1] * f).astype(np.uint8)


def report_png(path, x, title, markers=(), sections=(), extra_curves=(), px_per_s=40, height=900):
    """Log-frequency spectrogram + waveform + short-term loudness with timeline markers."""
    from PIL import Image, ImageDraw, ImageFont
    m = stereo(x).mean(axis=1)
    dur = len(m) / SR
    Wd = int(dur * px_per_s)
    lm, tm = 70, 40
    spec_h, wav_h, loud_h = int(height * 0.55), int(height * 0.2), int(height * 0.2)
    img = Image.new('RGB', (Wd + lm + 20, tm + spec_h + wav_h + loud_h + 60), (12, 10, 20))
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
    except Exception:
        font = ImageFont.load_default()
    # spectrogram
    nfft, hop = 4096, SR // px_per_s
    f, t, Z = sps.stft(m, SR, nperseg=nfft, noverlap=nfft - hop, boundary=None, padded=False)
    P = 20 * np.log10(np.abs(Z) + 1e-9)
    fl = np.geomspace(25, 20000, spec_h)
    rows = np.interp(fl, f, np.arange(len(f)))
    Pi = np.array([np.interp(rows, np.arange(len(f)), P[:, k]) for k in range(P.shape[1])]).T
    top = np.percentile(Pi, 99.7)
    v = (Pi - (top - 90)) / 90
    rgb = _cmap(v[::-1])
    sp = Image.fromarray(rgb).resize((Wd, spec_h))
    img.paste(sp, (lm, tm))
    for fr in [50, 100, 300, 1000, 3500, 10000]:
        y = tm + spec_h - int(np.interp(np.log(fr), np.log(fl), np.arange(spec_h)))
        d.line([(lm - 6, y), (lm, y)], fill=(200, 200, 200))
        d.text((4, y - 7), f'{fr if fr < 1000 else str(fr // 1000) + "k"}', fill=(200, 200, 200), font=font)
        if fr in (300, 3500):
            for xx in range(lm, lm + Wd, 6):
                d.point((xx, y), fill=(90, 220, 255))
    # waveform
    y0 = tm + spec_h + 10
    st = stereo(x)
    spp = len(m) / Wd
    for k in range(Wd):
        seg = st[int(k * spp):int((k + 1) * spp)]
        if len(seg) == 0:
            continue
        hi, lo = seg.max(), seg.min()
        yc = y0 + wav_h / 2
        d.line([(lm + k, yc - hi * wav_h / 2), (lm + k, yc - lo * wav_h / 2)], fill=(169, 71, 254))
    d.line([(lm, y0 + wav_h / 2), (lm + Wd, y0 + wav_h / 2)], fill=(60, 60, 80))
    # short-term loudness
    y1 = y0 + wav_h + 10
    tt, L = lufs_shortterm(x, hop=0.05)
    tm_, M = lufs_momentary(x, hop=0.05)

    def ly(v):
        return y1 + loud_h - (np.clip(v, -40, -5) + 40) / 35 * loud_h
    for ref in (-14, -24, -34):
        d.line([(lm, ly(ref)), (lm + Wd, ly(ref))], fill=(55, 55, 70))
        d.text((4, ly(ref) - 7), f'{ref} LU', fill=(160, 160, 160), font=font)
    d.line([(lm + tm_[i] * px_per_s, ly(M[i])) for i in range(len(M))], fill=(243, 167, 69), width=1)
    d.line([(lm + tt[i] * px_per_s, ly(L[i])) for i in range(len(L))], fill=(92, 240, 255), width=2)
    for (ct, curve, col) in extra_curves:
        d.line([(lm + ct[i] * px_per_s, ly(curve[i])) for i in range(len(ct))], fill=col, width=1)
    # sections + markers
    for (a, b, name) in sections:
        d.rectangle([lm + a * px_per_s, 4, lm + b * px_per_s - 2, 16], outline=(243, 167, 69))
        d.text((lm + a * px_per_s + 3, 3), name, fill=(243, 167, 69), font=font)
    for s in range(0, int(dur) + 1):
        xx = lm + s * px_per_s
        d.line([(xx, tm + spec_h), (xx, tm + spec_h + 4)], fill=(200, 200, 200))
        if s % 2 == 0:
            d.text((xx - 5, tm + spec_h + wav_h + loud_h + 32), str(s), fill=(200, 200, 200), font=font)
    for (mt, name) in markers:
        xx = lm + mt * px_per_s
        d.line([(xx, tm), (xx, tm + spec_h + wav_h + loud_h + 20)], fill=(254, 86, 13))
        d.text((xx + 2, tm + 2 + (hash(name) % 5) * 14), name, fill=(255, 255, 255), font=font)
    d.text((lm, tm + spec_h + wav_h + loud_h + 44), title + '   [cyan = short-term LUFS, amber = momentary; dotted = 300 Hz / 3.5 kHz]',
           fill=(234, 246, 255), font=font)
    img.save(path)


def clipper(x, thr_db=-3.0, os_=4):
    """Oversampled soft-knee clipper: transparent below thr, smooth tanh knee up to 0 dBFS-ish.
    Used to shave kick/impact transients before the limiter (less limiter pumping)."""
    t = undb(thr_db)
    x2 = stereo(x)
    up = sps.resample_poly(x2, os_, 1, axis=0)
    a = np.abs(up)
    over = a > t
    y = up.copy()
    y[over] = np.sign(up[over]) * (t + (1 - t) * np.tanh((a[over] - t) / (1 - t)))
    return sps.resample_poly(y, 1, os_, axis=0)[:len(x2)]
