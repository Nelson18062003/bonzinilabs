#!/usr/bin/env python3
"""Voice enhancement for the BONZINI TRADING CARGO reel  ->  out/voice.wav

Rebuilds the voice track end-to-end from the raw 48 kHz mono clip audio:

    S/audio/B_orig48.wav  (street, truck + broadband noise)   src [0, 16.0]  -> out [0, 16.0]
    S/audio/A_orig48.wav  (indoor warehouse, light room)      src [0, 25.92] -> out [16.0, 41.92]

Per clip:
  1. DeepFilterNet3 denoise (model warm-up on a noise-only excerpt of the same clip so the first
     word is not eaten; per-clip attenuation limit; A's first 0.25 s crossfades back to the raw
     signal because DFN treats the voiced "V" of "Voilà" as noise).
  2. HPF 75 Hz (24 dB/oct) + rumble clean-up.
  3. Match-EQ: both clips are pulled onto the same long-term speech spectrum (1/3-oct smoothed,
     +/-7 dB, linear phase), so B and A sound like one voice in one space.
  4. Downward expander on the pauses (look-ahead, hold, slow release -> no chopped word tails),
     plus hand-placed fades where the spec says the take ends.
  5. "Broadcast narrator" tone EQ (warmth, de-mud, presence, air), de-esser.
  6. Two-stage compression (fast 3:1 peak comp + slow 2:1 leveller), gentle saturation.
  7. Per-clip loudness to -16 LUFS (BS.1770-4, implemented here), true-peak limiter -1.5 dBTP.
Then placement on the 45.000 s timeline (dual mono, float32), data/voice_activity.json, stems.

    python3 lib/voice.py             # build out/voice.wav + stems + data/voice_activity.json
    python3 lib/voice.py --report    # + spectrograms / LTAS / level plots + metrics in out/voice_report/
    python3 lib/voice.py --eval      # + faster-whisper "medium" intelligibility check raw vs processed
"""
import os, sys, json, argparse, hashlib
import numpy as np, soundfile as sf, scipy.signal as ss, scipy.ndimage as nd

HERE = os.path.dirname(os.path.abspath(__file__))
R = os.path.abspath(os.path.join(HERE, '..'))
S = os.path.abspath(os.path.join(R, '..'))
OUT = os.path.join(R, 'out')
STEMS = os.path.join(OUT, 'voice_stems')
REPORT = os.path.join(OUT, 'voice_report')
SR = 48000
DUR = 45.0
A_OFF = 16.0

# ----------------------------------------------------------------------------------------------
# parameters (the chosen variant; see out/voice_report/metrics.json for the comparison)
P = dict(
    B=dict(src=os.path.join(S, 'audio', 'B_orig48.wav'), t0=0.0, t1=16.0, proc_end=16.3,
           noise=(3.80, 4.20),            # noise-only excerpt used to warm up DFN
           atten=None,                     # DFN attenuation limit (dB), None = full suppression
           bidir='max',                    # forward + time-reversed DFN, per-bin max (onsets)
           floor=None,                     # optional (speech_db, pause_db) floor, see speech_floor()
           onset_raw=None,                 # (t_full_raw, t_full_dfn) raw->dfn crossfade at start
           fade_in=0.008,
           fade_out=(15.50, 15.72),        # speech ends ~15.5 (after it: an unrelated steady tone)
           ),
    A=dict(src=os.path.join(S, 'audio', 'A_orig48.wav'), t0=0.0, t1=25.92, proc_end=25.92,
           noise=(4.95, 5.45),
           atten=24.0,
           bidir='max',
           floor=None,
           onset_raw=(0.16, 0.30),
           fade_in=0.006,
           fade_out=(22.92, 23.20),        # speech ends 22.68 -> silent by src 23.2 (= out 39.2)
           ),
    hpf=75.0,
    match_max_db=7.0,
    trim_match_max_db=4.0,
    # expander (dB relative to the clip's active-speech level)
    exp1=dict(thresh_rel=-30.0, over_bed=8.0, ratio=3.0, range=24.0, hold=0.18, attack=0.002,
              release=0.15, lookahead=0.025),
    # second expander after the compressors (they lift the gaps by their make-up gain)
    exp2=dict(thresh_rel=-19.0, over_bed=6.0, ratio=3.0, range=20.0, hold=0.12, attack=0.002,
              release=0.12, lookahead=0.020),
    # tone EQ: (type, f, gain_db, q)
    eq=[('ls', 140.0, 1.0, 0.7),        # body under the fundamental
        ('pk', 235.0, -3.5, 1.0),       # this voice's F0 region is +15 dB over 1 kHz -> boomy
        ('pk', 480.0, -2.0, 1.2),       # boxy / mud
        ('pk', 3400.0, 3.5, 0.8),       # presence / articulation
        ('hs', 9000.0, 3.0, 0.7)],      # air (source is band-limited ~16.8 kHz)
    deess_f=5200.0, deess_thresh_rel=-4.0, deess_max=8.0,
    comp1=dict(thresh_rel=1.5, ratio=3.0, attack=0.003, release=0.09, knee=6.0),
    comp2=dict(thresh_rel=3.5, ratio=2.0, attack=0.030, release=0.35, knee=8.0),
    sat_drive=0.0,
    lufs=-16.0, tp_ceiling=-1.5,
)


def log(*a):
    print('[voice]', *a, flush=True)


# ----------------------------------------------------------------------------------------------
# DSP helpers
def db(x):
    return 20 * np.log10(np.maximum(x, 1e-12))


def rms_db(x):
    return db(np.sqrt(np.mean(np.square(x)) + 1e-24))


def biquad(kind, f, g_db, q, sr=SR):
    """RBJ cookbook biquad as a single SOS row."""
    A = 10 ** (g_db / 40)
    w = 2 * np.pi * f / sr
    cw, sw = np.cos(w), np.sin(w)
    al = sw / (2 * q)
    if kind == 'pk':
        b = [1 + al * A, -2 * cw, 1 - al * A]; a = [1 + al / A, -2 * cw, 1 - al / A]
    elif kind == 'ls':
        sa = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) - (A - 1) * cw + sa), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - sa)]
        a = [(A + 1) + (A - 1) * cw + sa, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - sa]
    elif kind == 'hs':
        sa = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) + (A - 1) * cw + sa), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sa)]
        a = [(A + 1) - (A - 1) * cw + sa, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sa]
    else:
        raise ValueError(kind)
    b, a = np.array(b) / a[0], np.array(a) / a[0]
    return np.concatenate([b, a])[None]


def apply_eq(x, bands):
    if not bands:
        return x
    sos = np.concatenate([biquad(*b) for b in bands])
    return ss.sosfilt(sos, x)


def hpf(x, f):
    sos = ss.butter(4, f, 'highpass', fs=SR, output='sos')
    return ss.sosfilt(sos, x)


def env_blocks(x, blk):
    """RMS per block of `blk` samples -> (levels_db, block_rate)."""
    n = len(x) // blk
    e = np.sqrt(np.mean(np.square(x[:n * blk]).reshape(n, blk), axis=1) + 1e-24)
    if n * blk < len(x):
        e = np.append(e, np.sqrt(np.mean(np.square(x[n * blk:])) + 1e-24))
    return db(e)


def blocks_to_samples(g_blk, blk, n):
    """Linear interpolation of a per-block gain (dB) to per-sample linear gain."""
    tb = (np.arange(len(g_blk)) + 0.5) * blk
    g = np.interp(np.arange(n), tb, g_blk)
    return 10 ** (g / 20)


def smooth_ar(target_db, rate, attack, release, direction='down'):
    """One-pole attack/release smoothing of a gain curve in dB (at `rate` Hz).
    direction='down': attack = moving toward more attenuation (lower dB)."""
    aa = np.exp(-1.0 / max(attack * rate, 1e-9))
    ar = np.exp(-1.0 / max(release * rate, 1e-9))
    out = np.empty_like(target_db)
    s = target_db[0]
    for i, t in enumerate(target_db):
        c = aa if ((t < s) if direction == 'down' else (t > s)) else ar
        s = c * s + (1 - c) * t
        out[i] = s
    return out


# ----------------------------------------------------------------------------------------------
# loudness (ITU-R BS.1770-4) and true peak
def _kweight(x, sr=SR):
    # pre-filter (high shelf) + RLB high-pass, coefficients re-derived for any sr
    f0, G, Q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
    K = np.tan(np.pi * f0 / sr); Vh = 10 ** (G / 20); Vb = Vh ** 0.4996667741545416
    a0 = 1 + K / Q + K * K
    b1 = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0]
    a1 = [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
    f0, Q = 38.13547087602444, 0.5003270373238773
    K = np.tan(np.pi * f0 / sr)
    a2 = [1, 2 * (K * K - 1) / (1 + K / Q + K * K), (1 - K / Q + K * K) / (1 + K / Q + K * K)]
    b2 = [1, -2, 1]
    return ss.lfilter(b2, a2, ss.lfilter(b1, a1, x))


def lufs(x, sr=SR):
    """Integrated loudness of a mono signal (as played on both channels of a stereo pair would be
    +3 dB; we report the mono/dual-mono-per-channel convention used by ffmpeg ebur128 on mono)."""
    y = _kweight(x, sr)
    blk, hop = int(0.4 * sr), int(0.1 * sr)
    if len(y) < blk:
        return -70.0
    ms = np.array([np.mean(y[i:i + blk] ** 2) for i in range(0, len(y) - blk + 1, hop)])
    L = -0.691 + 10 * np.log10(ms + 1e-24)
    ms = ms[L > -70]
    if not len(ms):
        return -70.0
    rel = -0.691 + 10 * np.log10(np.mean(ms)) - 10
    ms2 = ms[(-0.691 + 10 * np.log10(ms)) > rel]
    return float(-0.691 + 10 * np.log10(np.mean(ms2)))


def true_peak_db(x):
    return float(db(np.max(np.abs(ss.resample_poly(x, 4, 1)))))


# ----------------------------------------------------------------------------------------------
# stage 1 — denoise
_DF = None


def dfn(x, noise, atten):
    global _DF
    import torch
    torch.set_num_threads(2)
    if _DF is None:
        import logging
        logging.disable(logging.WARNING)
        from df.enhance import enhance, init_df
        model, st, _ = init_df(log_level='ERROR')
        _DF = (enhance, model, st)
    enhance, model, st = _DF
    # 1 s of the clip's own noise (ping-pong looped) in front, so the model and the feature
    # normalisation have converged before the first syllable.
    pre = np.concatenate([noise, noise[::-1]] * 8)[:SR].astype(np.float32)
    y = np.concatenate([pre, x.astype(np.float32)])
    out = enhance(model, st, torch.from_numpy(y[None].copy()), atten_lim_db=atten).numpy()[0]
    return out[len(pre):].astype(np.float64)


def combine_bidir(yf, yb, mode='max'):
    """DeepFilterNet is causal: the first 20-40 ms of every word that follows a pause are still
    being classified as noise and get attenuated (clipped onsets, e.g. the V of "Voici").
    Running it again on the time-reversed signal gives the mirror problem (clipped offsets).
    Per time-frequency bin we keep the stronger of the two estimates, which restores both."""
    nps, hop = 1024, 256
    _, _, F = ss.stft(yf, SR, nperseg=nps, noverlap=nps - hop)
    _, _, B = ss.stft(yb, SR, nperseg=nps, noverlap=nps - hop)
    if mode == 'max':
        Z = np.where(np.abs(F) >= np.abs(B), F, B)
    else:
        Z = 0.5 * (F + B)
    _, z = ss.istft(Z, SR, nperseg=nps, noverlap=nps - hop)
    return z[:len(yf)]


def speech_floor(x, y, g_speech_db, g_pause_db, pre=0.08, post=0.15, nps=1024, hop=256):
    """Speech-presence-dependent suppression floor. Where DFN pulled a time-frequency bin below
    `floor * |raw|`, the raw bin is mixed back up to that floor. During speech (dilated, so onsets
    and word tails are covered) the floor is g_speech_db: the weak consonant cues that sit under
    the street noise (p/t/k bursts, the B of "Bonzini") survive, and the little noise that comes
    with them is masked by the voice itself. In pauses the floor is g_pause_db."""
    _, _, X = ss.stft(x, SR, nperseg=nps, noverlap=nps - hop)
    _, _, Y = ss.stft(y, SR, nperseg=nps, noverlap=nps - hop)
    Ly = 10 * np.log10(np.mean(np.abs(Y) ** 2, axis=0) + 1e-20)
    act = (Ly > np.percentile(Ly, 90) - 25).astype(float)
    fr = SR / hop
    size = int((pre + post) * fr) + 1
    act = nd.maximum_filter1d(act, size=size, origin=int(post * fr) - size // 2)
    act = nd.uniform_filter1d(act, int(0.04 * fr) + 1)
    fl = 10 ** ((act * g_speech_db + (1 - act) * g_pause_db) / 20)
    add = np.maximum(fl[None, :] * np.abs(X) - np.abs(Y), 0)
    Z = Y + add * np.exp(1j * np.angle(X))
    _, z = ss.istft(Z, SR, nperseg=nps, noverlap=nps - hop)
    return z[:len(x)]


def cached_dfn(clip, x, noise, atten, reverse=False):
    key = hashlib.md5(x.tobytes() + noise.tobytes() + repr((atten, reverse)).encode()).hexdigest()[:10]
    tag = f'_cache_{clip}_dfn_{atten}_{"rev" if reverse else "fwd"}_'
    p = os.path.join(STEMS, tag + key + '.wav')
    if os.path.exists(p):
        return sf.read(p, dtype='float64')[0]
    y = dfn(x[::-1].copy(), noise[::-1].copy(), atten)[::-1].copy() if reverse else dfn(x, noise, atten)
    for f in os.listdir(STEMS):          # keep one cache file per clip/atten/direction
        if f.startswith(tag):
            os.remove(os.path.join(STEMS, f))
    sf.write(p, y, SR, subtype='FLOAT')
    return y


# ----------------------------------------------------------------------------------------------
# speech activity (used by the expander reference level, match-EQ frames and voice_activity.json)
def speech_frames(x, blk=480, rel=-22.0, min_on=0.06):
    """Boolean per 10 ms block: active speech (level within `rel` dB of the loud speech level)."""
    L = env_blocks(x, blk)
    ref = np.percentile(L, 90)
    act = L > ref + rel
    # remove blips shorter than min_on
    k = int(round(min_on * SR / blk))
    lab, i = act.copy(), 0
    while i < len(lab):
        if lab[i]:
            j = i
            while j < len(lab) and lab[j]:
                j += 1
            if j - i < k:
                lab[i:j] = False
            i = j
        else:
            i += 1
    return lab, ref


def speech_level(x):
    act, _ = speech_frames(x)
    L = env_blocks(x, 480)
    return float(10 * np.log10(np.mean(10 ** (L[act] / 10)))) if act.any() else rms_db(x)


# ----------------------------------------------------------------------------------------------
# match EQ
def ltas(x, act, nfft=4096):
    f, t, Z = ss.stft(x, SR, nperseg=nfft, noverlap=nfft - 480)   # hop 10 ms
    P = np.abs(Z) ** 2
    idx = np.clip((t * 100).astype(int), 0, len(act) - 1)
    m = act[idx]
    return f, 10 * np.log10(np.mean(P[:, m], axis=1) + 1e-20)


def smooth_oct(f, d, frac=3):
    out = np.empty_like(d)
    lin = 10 ** (d / 10)
    for i, fc in enumerate(f):
        if fc <= 0:
            out[i] = d[i]; continue
        lo, hi = fc * 2 ** (-0.5 / frac), fc * 2 ** (0.5 / frac)
        m = (f >= lo) & (f <= hi)
        out[i] = 10 * np.log10(np.mean(lin[m]))
    return out


def fir_from_curve(f, g_db, ntaps=4095):
    g = 10 ** (g_db / 20)
    return ss.firwin2(ntaps, f, g, fs=SR, window='hann')


# ----------------------------------------------------------------------------------------------
# dynamics
def expander(x, ref_db, p):
    """Downward expander, 1 ms control rate, look-ahead + hold; threshold relative to the speech
    level but never closer than `over_bed` dB to the measured residual noise bed."""
    blk = 48
    rate = SR / blk
    L = env_blocks(x, blk)
    # 15 ms RMS detector (1 ms blocks are too jittery: the hold's max() would latch on noise spikes)
    L = 10 * np.log10(np.maximum(nd.uniform_filter1d(10 ** (L / 10), 15), 1e-24))
    # threshold: well under the speech, but always a few dB above the residual noise bed
    Lv = L[L > -100]
    bed = float(np.percentile(Lv, 5)) if len(Lv) else -90.0
    th = max(ref_db + p['thresh_rel'], bed + p['over_bed'])
    under = np.minimum(L - th, 0)
    g = np.maximum(under * (p['ratio'] - 1), -p['range'])
    # hold: a block is "open" if any block in the next lookahead/previous hold window is open
    la = int(p['lookahead'] * rate); hd = int(p['hold'] * rate)
    size = la + hd + 1                      # window [i - hold, i + lookahead]
    g = nd.maximum_filter1d(g, size=size, origin=hd - size // 2)
    g = smooth_ar(g, rate, p['release'], p['attack'], direction='down')
    return x * blocks_to_samples(g, blk, len(x)), dict(gain=g, bed=bed, thresh=th)


def compressor(x, ref_db, c):
    blk = 48
    rate = SR / blk
    # peak-ish detector: max |x| per ms, 2 ms RMS smoothing
    n = len(x) // blk
    pk = np.max(np.abs(x[:n * blk]).reshape(n, blk), axis=1)
    pk = np.append(pk, np.max(np.abs(x[n * blk:])) if n * blk < len(x) else [])
    L = db(pk)
    th = ref_db + c['thresh_rel']
    k = c['knee']
    over = L - th
    gr = np.where(over <= -k / 2, 0.0,
                  np.where(over >= k / 2, over * (1 / c['ratio'] - 1),
                           (1 / c['ratio'] - 1) * (over + k / 2) ** 2 / (2 * k)))
    gr = smooth_ar(gr, rate, c['attack'], c['release'], direction='down')
    return x * blocks_to_samples(gr, blk, len(x)), gr


def deesser(x, p, ref_db):
    """Split-band de-esser: zero-phase complementary split at deess_f, the upper band is turned
    down when its level exceeds (speech level + deess_thresh_rel) AND dominates the lower band."""
    sos = ss.butter(4, p['deess_f'], 'highpass', fs=SR, output='sos')
    hi = ss.sosfiltfilt(sos, x)
    lo = x - hi
    blk = 48; rate = SR / blk
    Lh = env_blocks(hi, blk); Ll = env_blocks(lo, blk)
    Lh = 10 * np.log10(np.maximum(ss.convolve(10 ** (Lh / 10), np.ones(3) / 3, mode='same'), 1e-24))
    th = ref_db + p['deess_thresh_rel']
    over = np.maximum(Lh - th, 0) + np.maximum(Lh - Ll - 3, 0) * 0.5
    g = -np.minimum(over * 0.7, p['deess_max'])
    g = smooth_ar(g, rate, 0.001, 0.05, direction='down')
    return lo + hi * blocks_to_samples(g, blk, len(x)), g


def limiter(x, ceiling_db, lookahead=0.003, release=0.06):
    """Look-ahead limiter on the 4x-oversampled peak; iterates until the true peak <= ceiling."""
    y = x.copy()
    for it in range(4):
        blk = 24; rate = SR / blk
        up = np.abs(ss.resample_poly(y, 4, 1))
        n = len(y) // blk
        pk = np.max(up[:n * blk * 4].reshape(n, blk * 4), axis=1)
        pk = np.append(pk, up[n * blk * 4:].max() if n * blk < len(y) else [])
        need = np.minimum(ceiling_db - 0.05 - db(pk), 0)
        la = int(lookahead * rate) + 1
        need = nd.minimum_filter1d(need, size=2 * la + 1)
        g = smooth_ar(need, rate, 0.0005, release, direction='down')
        g = np.minimum(g, nd.minimum_filter1d(need, size=2 * la + 1))
        y = y * blocks_to_samples(g, blk, len(y))
        if true_peak_db(y) <= ceiling_db:
            break
    return y


def saturate(x, drive):
    if drive <= 0:
        return x
    pk = np.max(np.abs(x)) + 1e-12
    k = drive
    y = np.tanh(k * x / pk) / np.tanh(k) * pk
    return y


def fade_curve(n, kind='in'):
    t = np.linspace(0, 1, n)
    c = 0.5 - 0.5 * np.cos(np.pi * t)
    return c if kind == 'in' else c[::-1]


# ----------------------------------------------------------------------------------------------
def load_clip(name):
    c = P[name]
    x, sr = sf.read(c['src'], dtype='float64')
    assert sr == SR, sr
    if x.ndim > 1:
        x = x.mean(1)
    x = x[:int(round(c['proc_end'] * SR))]
    return x


def denoise_clip(name, x):
    c = P[name]
    nz = x[int(c['noise'][0] * SR):int(c['noise'][1] * SR)]
    y = cached_dfn(name, x, nz, c['atten'])
    if c.get('bidir'):
        yb = cached_dfn(name, x, nz, c['atten'], reverse=True)
        y = combine_bidir(y, yb, c['bidir'])
    if c.get('floor'):
        y = speech_floor(x, y, *c['floor'])
    if c['onset_raw']:
        a, b = c['onset_raw']
        na, nb = int(a * SR), int(b * SR)
        w = np.zeros(len(x)); w[:na] = 1.0; w[na:nb] = fade_curve(nb - na, 'out')
        y = w * x + (1 - w) * y
    return y


def match_eq(sig, max_db, fmin=90.0, fmax=15000.0):
    """Pull every signal of `sig` onto the mean (level-normalised) long-term speech spectrum."""
    specs = {}
    for n, x in sig.items():
        act = speech_frames(x)[0]
        f, L = ltas(x, act)
        specs[n] = smooth_oct(f, L - speech_level(x), 3)
    target = np.mean([specs[n] for n in sig], axis=0)
    out, rep = {}, {}
    for n, x in sig.items():
        corr = np.clip(target - specs[n], -max_db, max_db)
        corr[f < fmin] = corr[np.argmin(np.abs(f - fmin))]
        corr[f > fmax] = corr[np.argmin(np.abs(f - fmax))]
        corr = corr - np.interp(1000, f, corr)          # 0 dB at 1 kHz (level handled later)
        out[n] = ss.fftconvolve(x, fir_from_curve(f, corr), mode='same')
        rep[n] = {str(int(fr)): round(float(np.interp(fr, f, corr)), 2)
                  for fr in [100, 200, 400, 800, 1600, 3200, 6400, 12800]}
    return out, rep


def process(names=('B', 'A'), stages=False):
    out, info, st = {}, {}, {}
    raw = {n: load_clip(n) for n in names}
    den = {n: hpf(denoise_clip(n, raw[n]), P['hpf']) for n in names}
    # ---- match EQ onto a common long-term speech spectrum ----
    matched, corr = match_eq(den, P['match_max_db'])
    for n in names:
        info.setdefault(n, {})['match_eq_db'] = corr[n]
    post, dyn = {}, {}
    for n in names:
        c = P[n]
        y = matched[n]
        ref = ref_pre = speech_level(y)
        # ---- pauses: expander + scripted fades ----
        y, ex = expander(y, ref, P['exp1'])
        n0 = len(y)
        fi = int(c['fade_in'] * SR); y[:fi] *= fade_curve(fi, 'in')
        a, b = c['fade_out']
        na, nb = int(a * SR), min(int(b * SR), n0)
        y[na:nb] *= fade_curve(nb - na, 'out'); y[nb:] = 0.0
        st_exp = y.copy()
        # ---- tone ----
        y = apply_eq(y, P['eq'])
        ref = speech_level(y)
        y, g_ds = deesser(y, P, ref)
        # ---- dynamics ----
        y, g_c1 = compressor(y, ref, P['comp1'])
        ref = speech_level(y)
        y, g_c2 = compressor(y, ref, P['comp2'])
        y, ex2 = expander(y, speech_level(y), P['exp2'])
        y = saturate(y, P['sat_drive'])
        post[n] = y
        dyn[n] = dict(ex=ex, ex2=ex2, g_ds=g_ds, g_c1=g_c1, g_c2=g_c2, gated=st_exp)
    # ---- final trim-match (de-esser/compressors act a little differently on each clip) ----
    post, corr2 = match_eq(post, P['trim_match_max_db'])
    for n in names:
        c = P[n]
        y = post[n]
        fi = int(c['fade_in'] * SR)
        ex, ex2, g_ds, g_c1, g_c2, st_exp = (dyn[n][k] for k in ('ex', 'ex2', 'g_ds', 'g_c1', 'g_c2', 'gated'))
        info[n]['trim_match_eq_db'] = corr2[n]
        # ---- loudness + true peak ----
        seg = y[:int(c['t1'] * SR)]
        L = lufs(seg)
        y = y * 10 ** ((P['lufs'] - L) / 20)
        y = limiter(y, P['tp_ceiling'])
        y = y[:int(round(c['t1'] * SR))]
        # hard guarantees after the linear-phase trim EQ: clean start, silence after the fade-out
        y[:fi] *= fade_curve(fi, 'in')
        nb = min(int(c['fade_out'][1] * SR), len(y)); y[nb:] = 0.0
        out[n] = y
        info[n].update(lufs=round(lufs(y), 2), true_peak_dbtp=round(true_peak_db(y), 2),
                       expander=dict(bed_db=round(ex['bed'], 1), thresh_db=round(ex['thresh'], 1),
                                     speech_db=round(ref_pre, 1)),
                       expander2=dict(bed_db=round(ex2['bed'], 1), thresh_db=round(ex2['thresh'], 1)),
                       deess_max_gr=round(float(-g_ds.min()), 1),
                       comp1_gr_p50_p95=[round(float(np.percentile(-g_c1[g_c1 < -0.05], q)), 1) if (g_c1 < -0.05).any() else 0 for q in (50, 95)],
                       comp2_gr_p50_p95=[round(float(np.percentile(-g_c2[g_c2 < -0.05], q)), 1) if (g_c2 < -0.05).any() else 0 for q in (50, 95)],
                       deess_gr_p95=round(float(np.percentile(-g_ds[g_ds < -0.05], 95)), 1) if (g_ds < -0.05).any() else 0)
        st[n] = dict(raw=raw[n][:len(y)], denoised=den[n][:len(y)], matched=matched[n][:len(y)],
                     gated=st_exp[:len(y)], final=y)
    return out, info, st


def place(clips):
    N = int(round(DUR * SR))
    v = np.zeros(N)
    b = clips['B']; v[:len(b)] = b
    a = clips['A']; i0 = int(round(A_OFF * SR)); v[i0:i0 + len(a)] = a[:N - i0]
    return v


def voice_activity(v, gap=0.25):
    blk = 480
    L = env_blocks(v, blk)
    act = L > -42.0          # final track is at -16 LUFS; pauses are expanded well below this
    iv, i = [], 0
    while i < len(act):
        if act[i]:
            j = i
            while j < len(act) and act[j]:
                j += 1
            iv.append([i * 0.01, j * 0.01]); i = j
        else:
            i += 1
    merged = []
    for s, e in iv:
        if merged and s - merged[-1][1] < gap:
            merged[-1][1] = e
        else:
            merged.append([s, e])
    merged = [[round(s, 2), round(e, 2)] for s, e in merged if e - s >= 0.08]
    return merged


def write_outputs(clips, st):
    os.makedirs(STEMS, exist_ok=True)
    v = place(clips)
    assert len(v) == int(DUR * SR)
    sf.write(os.path.join(OUT, 'voice.wav'), np.stack([v, v], 1).astype(np.float32), SR, subtype='FLOAT')
    for n, d in st.items():
        for k, y in d.items():
            sf.write(os.path.join(STEMS, f'{n}_{k}.wav'), y.astype(np.float32), SR, subtype='FLOAT')
    # raw audio placed on the same timeline (for A/B comparison)
    raw = place({n: st[n]['raw'] for n in st})
    sf.write(os.path.join(STEMS, 'timeline_raw.wav'), raw.astype(np.float32), SR, subtype='FLOAT')
    iv = voice_activity(v)
    with open(os.path.join(R, 'data', 'voice_activity.json'), 'w') as fh:
        json.dump({'note': 'speech intervals (s) on the final 45 s timeline, gaps < 0.25 s merged; '
                           'generated by lib/voice.py', 'intervals': iv}, fh, indent=1)
    return v, iv


# ----------------------------------------------------------------------------------------------
# report / evaluation (optional; needs matplotlib, faster-whisper)
PAUSES = {'B': [(9.4, 10.0), (15.5, 16.0), (3.80, 4.20)], 'A': [(4.8, 5.7), (16.45, 16.95), (23.3, 25.9)]}
REF_TEXT = {
    'B': "Voilà, chers clients de Bonzini Trading Cargo. Voici votre conteneur qui arrive dans notre "
         "entrepôt en toute sécurité. Il sera déchargé ici, dans notre entrepôt en toute sécurité.",
    'A': "Voilà, très chers clients, nous sommes ici à l'entrepôt de Bonzini Trading Cargo. Vos colis ont "
         "été déchargés en toute sécurité. Et nous vous attendons dans notre entrepôt ici, au niveau du "
         "foyer Balengou, pour le retrait de vos colis. Et nous vous disons merci pour votre confiance.",
}


def _spec(ax, x, t0, title):
    f, t, Z = ss.stft(x, SR, nperseg=2048, noverlap=2048 - 256)
    D = 20 * np.log10(np.abs(Z) + 1e-9) + 6
    ax.pcolormesh(t + t0, f, D, vmin=-110, vmax=-20, cmap='magma', shading='auto')
    ax.set_yscale('symlog', linthresh=500); ax.set_ylim(40, 20000)
    ax.set_title(title, fontsize=10, loc='left'); ax.set_ylabel('Hz')


def report(st, info):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    os.makedirs(REPORT, exist_ok=True)
    metrics = {}
    for n, d in st.items():
        fig, axs = plt.subplots(3, 1, figsize=(16, 9.6))
        _spec(axs[0], d['raw'], 0, f'{n} raw (src)')
        _spec(axs[1], d['denoised'], 0, f'{n} after DeepFilterNet3 + HPF')
        _spec(axs[2], d['final'], 0, f'{n} final (match-EQ, expander, tone EQ, de-ess, comp, -16 LUFS, -1.5 dBTP)')
        axs[2].set_xlabel('src time (s)')
        plt.tight_layout(); plt.savefig(os.path.join(REPORT, f'spectrogram_{n}.png'), dpi=65); plt.close()
        m = {}
        for k in ('raw', 'denoised', 'final'):
            y = d[k]
            sp = speech_level(y)
            m[k] = dict(lufs=round(lufs(y), 2), speech_rms_db=round(sp, 1),
                        pauses_db_rel_speech={f'{a}-{b}': round(rms_db(y[int(a * SR):int(b * SR)]) - sp, 1)
                                              for a, b in PAUSES[n] if b * SR <= len(y)})
        metrics[n] = m
    # LTAS (speech frames) before / after
    fig, axs = plt.subplots(1, 2, figsize=(16, 5))
    for ax, k, ttl in [(axs[0], 'denoised', 'before match (after DFN)'), (axs[1], 'final', 'final')]:
        for n, d in st.items():
            act = speech_frames(d[k])[0]
            f, L = ltas(d[k], act)
            L = smooth_oct(f, L, 6)
            ax.semilogx(f[1:], L[1:] - np.interp(1000, f, L), label=n)
        ax.set_xlim(60, 20000); ax.set_ylim(-60, 15); ax.grid(alpha=.3, which='both'); ax.legend()
        ax.set_title('long-term speech spectrum, ' + ttl + ' (0 dB @ 1 kHz)')
    plt.tight_layout(); plt.savefig(os.path.join(REPORT, 'ltas_B_vs_A.png'), dpi=65); plt.close()
    # timeline
    v = sf.read(os.path.join(OUT, 'voice.wav'))[0][:, 0]
    raw = sf.read(os.path.join(STEMS, 'timeline_raw.wav'))[0]
    iv = json.load(open(os.path.join(R, 'data', 'voice_activity.json')))['intervals']
    fig, axs = plt.subplots(3, 1, figsize=(18, 10), gridspec_kw=dict(height_ratios=[3, 3, 2]))
    _spec(axs[0], raw, 0, 'timeline: raw clip audio'); _spec(axs[1], v, 0, 'timeline: out/voice.wav')
    L = env_blocks(v, 480); Lr = env_blocks(raw, 480); tt = np.arange(len(L)) * 0.01
    axs[2].plot(tt, Lr, lw=.6, color='0.6', label='raw'); axs[2].plot(tt, L, lw=.7, label='voice.wav')
    for a, b in iv:
        axs[2].axvspan(a, b, color='g', alpha=.12)
    axs[2].axvline(16.0, color='r', lw=.8); axs[2].set_ylim(-100, 0); axs[2].set_xlim(0, 45)
    axs[2].legend(loc='lower right'); axs[2].set_title('10 ms RMS (dBFS); green = data/voice_activity.json', fontsize=10, loc='left')
    for ax in axs:
        ax.set_xlim(0, 45)
    plt.tight_layout(); plt.savefig(os.path.join(REPORT, 'timeline.png'), dpi=60); plt.close()
    # the cut at 16.0
    fig, axs = plt.subplots(2, 1, figsize=(14, 6))
    i0, i1 = int(13.5 * SR), int(19.0 * SR)
    _spec(axs[0], raw[i0:i1], 13.5, 'raw around the B->A cut (16.0)')
    _spec(axs[1], v[i0:i1], 13.5, 'voice.wav around the B->A cut (16.0)')
    plt.tight_layout(); plt.savefig(os.path.join(REPORT, 'cut_16s.png'), dpi=70); plt.close()
    metrics['info'] = info
    metrics['params'] = {k: v2 for k, v2 in P.items() if k not in ('A', 'B')}
    metrics['params'].update({n: {k: v2 for k, v2 in P[n].items() if k != 'src'} for n in ('A', 'B')})
    with open(os.path.join(REPORT, 'metrics.json'), 'w') as fh:
        json.dump(metrics, fh, indent=1, ensure_ascii=False, default=str)
    log('report ->', REPORT)
    log(json.dumps({n: metrics[n] for n in st}, indent=1))


def _norm_words(t):
    import re, unicodedata
    t = unicodedata.normalize('NFD', t.lower())
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    t = t.replace("'", ' ').replace('-', ' ')
    return re.findall(r"[a-z0-9]+", t)


def _wer(ref, hyp):
    r, h = _norm_words(ref), _norm_words(hyp)
    d = np.arange(len(h) + 1)
    for i in range(1, len(r) + 1):
        prev, d[0] = d.copy(), i
        for j in range(1, len(h) + 1):
            d[j] = min(prev[j] + 1, d[j - 1] + 1, prev[j - 1] + (r[i - 1] != h[j - 1]))
    return float(d[len(h)]) / max(len(r), 1)


def whisper_words(model, x):
    y = ss.resample_poly(x, 1, 3).astype(np.float32)
    segs, _ = model.transcribe(y, language='fr', word_timestamps=True, beam_size=5, vad_filter=False,
                               condition_on_previous_text=False)
    words = [(w.word.strip(), round(w.start, 2), round(w.end, 2), round(w.probability, 3))
             for s in segs for w in (s.words or [])]
    return words


def forced_score(model, x, ref):
    """Teacher-forced probability of the *correct* script given the audio (Whisper align pass):
    a low-variance intelligibility measure (free decoding flips words on tiny changes)."""
    from faster_whisper.tokenizer import Tokenizer
    from faster_whisper.audio import pad_or_trim
    tok = Tokenizer(model.hf_tokenizer, model.model.is_multilingual, task='transcribe', language='fr')
    y = ss.resample_poly(x, 1, 3).astype(np.float32)
    feats = model.feature_extractor(y)
    nfr = min(feats.shape[-1], 3000)
    enc = model.encode(pad_or_trim(feats))
    ids = tok.encode(' ' + ref)
    r = model.model.align(enc, tok.sot_sequence, [ids], nfr)[0]
    pr = np.array(r.text_token_probs[:len(ids)], dtype=np.float64)
    words, wt = tok.split_to_word_tokens(ids + [tok.eot])
    bnd = np.pad(np.cumsum([len(t) for t in wt[:-1]]), (1, 0))
    wp = [(w.strip(), round(float(np.mean(pr[i:j])), 3)) for w, i, j in zip(words, bnd[:-1], bnd[1:])]
    return dict(mean_logp=round(float(np.mean(np.log(pr + 1e-9))), 4), mean_p=round(float(pr.mean()), 4),
                min_word=min(wp, key=lambda t: t[1]), words=wp)


def evaluate(st, variants=None):
    """faster-whisper medium (int8, 2 threads): raw vs processed, free decoding. Reports the
    transcript, WER vs the corrected script, and word probabilities (mean / 10th pct / min)."""
    from faster_whisper import WhisperModel
    model = WhisperModel('medium', device='cpu', compute_type='int8', cpu_threads=2)
    res = {}
    todo = variants or {n: {'raw': d['raw'], 'final': d['final']} for n, d in st.items()}
    for n, vs in todo.items():
        for k, x in vs.items():
            fs = forced_score(model, x, REF_TEXT[n[0]])
            w = whisper_words(model, x)
            ps = np.array([p for *_, p in w]) if w else np.zeros(1)
            txt = ' '.join(t for t, *_ in w)
            res[f'{n}/{k}'] = dict(wer=round(_wer(REF_TEXT[n[0]], txt), 3), mean_p=round(float(ps.mean()), 3),
                                   p10=round(float(np.percentile(ps, 10)), 3), min_p=round(float(ps.min()), 3),
                                   forced=fs, text=txt, words=w)
            log(f'{n}/{k}: FORCED mean logp {fs["mean_logp"]:.3f} p {fs["mean_p"]:.3f} min {fs["min_word"]}')
            log(f'{n}/{k}: WER {res[f"{n}/{k}"]["wer"]:.3f}  mean p {ps.mean():.3f}  p10 {np.percentile(ps, 10):.3f} | {txt}')
    os.makedirs(REPORT, exist_ok=True)
    p = os.path.join(REPORT, 'whisper_eval.json')
    old = json.load(open(p)) if os.path.exists(p) else {}
    old.update(res)
    with open(p, 'w') as fh:
        json.dump(old, fh, indent=1, ensure_ascii=False)
    return res


# ----------------------------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--report', action='store_true')
    ap.add_argument('--eval', action='store_true')
    a = ap.parse_args()
    os.makedirs(STEMS, exist_ok=True)
    clips, info, st = process()
    v, iv = write_outputs(clips, st)
    info['timeline'] = dict(samples=len(v), seconds=len(v) / SR, true_peak_dbtp=round(true_peak_db(v), 2),
                            n_intervals=len(iv))
    log(json.dumps(info, indent=1))
    if a.report:
        report(st, info)
    if a.eval:
        evaluate(st)


if __name__ == '__main__':
    main()
