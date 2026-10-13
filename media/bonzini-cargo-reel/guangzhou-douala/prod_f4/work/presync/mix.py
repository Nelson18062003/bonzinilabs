"""mix.py — the film's sound, built from the score: 48 kHz stereo, exactly SCORE.T.end seconds, -14 LUFS, TP <= -1 dBTP.
prod_f4: « ELLE VA OÙ, CETTE MACHINE ? » (film 4, BZ_VARIANT=wa → audio_wa/) — SERIE.md §3.11, §5.4 « son ». The film-4
sound design (pulse, hydraulics, chain, scrape, clank / clonk, wind, whoom, creaks, shimmer, thunk) and the « nappe » of
step 3 live in lib/sfx_film4.py (merged below); a music section with groove: false plays no groove (its pad only).

ONE score drives picture and sound. A node one-liner reads overlay/scenes/01_score.js and returns {T, A, N, FPS, voices,
narr: SCORE.narration(), amb: SCORE.ambience(), cues: SCORE.soundCues(), music: SCORE.music()}; the plan is dumped to
<out>/score_cues.json (tools/qa.js compares it to the live score: a stale mix is an error).

LEVELS     SERIE's dB are levels in the FINISHED mix, the voice at about -14 (music -18, -26 under a voice; Douala's real sound
           -16; the voice's « air » -24 …). Every element is levelled K-weighted (ungated) on its own span to
           lv(x) = VOICE_LUFS + (x + 14) in the premaster, then the master brings the whole to -14 LUFS integrated.
REAL VOICE voices() — exactly the samples [in, out) of the demucs vocals (work/vN_vocals.wav, 44.1 kHz → 48 kHz soxr VHQ:
           duration and word times kept), NEVER stretched / pitch-shifted. HP 120 Hz and +2.5 dB at 3 kHz, both ZERO-PHASE;
           a gentle feed-forward leveller (3:1 from 18 dB under the speech's loud level, 4/80 ms, no look-ahead: gain only,
           no delay) so the fast soft syllables (« disons comme ça ») survive a phone speaker — it made the weak listener
           stable on RV1-A; the room before the first word / after the last one 12 dB down (gain only); 20-ms fades;
           speech span at VOICE_LUFS. Under it, its own « air »: work/vN_accomp.wav at the SAME source times, -24 (60-ms fades).
           Checked: sample count, x-corr lag 0.
NARRATOR   narration() — rush2/voice/<file>.wav (the chosen take, Rubber Band stretch already baked): placed so its speech
           onset (`lead`, takes.json `on`) lands on T[id]; HP 70 Hz zero-phase, speech span at VOICE_LUFS + NARR_TRIM; no
           other processing. Checked: never overlaps another voice (wav extents and speech spans).
AMBIENCE   ambience() — Guangzhou = work/vN_accomp.wav (voice-free) at the shot's source times, Douala = work/vN_48.wav;
           `lvl` when its window leads, the score's keys (secondary -12 dB, 150-ms crossfades at the glides); under a REAL
           voice the Guangzhou picture's sound steps down to -30 (out if it is the voice's own clip); ducked 8 dB under
           every voice.
MUSIC      music() — the series' makossa (100 BPM: picked guitar, round bass, shaker; congas + balafon answers in the
           reprise) rendered bar by bar, ONE BUFFER PER SECTION levelled to its `db` (lowpass + the wind pad of the map),
           ducked to `duckUnderVoice` under every voice; hits (kick + strummed chord + bass) on the downbeats; the stops are
           digital silence (4-ms gates, reverb returns included); a button chord on the last downbeat before `end`.
SFX        soundCues() — synthesised, seeded: whoosh, whip (the filé), pop, felt, tick, ping, balafon_note, stamp (DÉPOSÉ),
           stamp_low (REÇU, lower), stamp_big (C'EST FORT !, the biggest), tonk, bonzini_sig; each levelled on its loudest
           400 ms to SFX_LVL[name] (+ 20·log10 of the score's g relative to the loudest cue of that name).
MASTER     HP 28 Hz + true-peak limiter, -14 LUFS integrated (pyloudnorm), TP <= -1 dBTP (8x oversampled check, the ceiling
           is lowered until it holds); 48 kHz stereo PCM 24, N = round(T.end x 48000) samples.

usage:  nice -n 5 python3 lib/mix.py [--stems] [--out DIR]     (BZ_VARIANT=cut → audio_cut/)
        → <out>/mix.wav, mix_report.json, score_cues.json (+ stems/{voice,narr,amb,music,sfx}.wav)
Sound library: the series' code (scratchpad v3/lib: audio_recu, audio, makossa, instruments + explainer dsp)."""
import os, sys, json, math, subprocess, argparse
HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.abspath(os.path.join(HERE, '..'))                        # the production folder (rush2/prod_<name>)
SP = os.path.abspath(os.path.join(P, '..', '..'))                     # the scratchpad
V3LIB = os.path.join(SP, 'v3', 'lib')
if V3LIB not in sys.path: sys.path.insert(0, V3LIB)
import audio_recu as R                       # imports the series' audio module (dsp, makossa, bikutsi, instruments) in order
import sfx_film4 as F4SFX                    # film 4: its own SFX + the « nappe »
import numpy as np
import soundfile as sf
import scipy.signal as sps
from audio import ns, tt, nz, ex, m2f, bp, panst, place, tail_fade, grains
A, dsp, SR, mk, bk, I = R.A, R.dsp, R.SR, R.mk, R.bk, R.I

ap = argparse.ArgumentParser()
ap.add_argument('--out'); ap.add_argument('--stems', action='store_true'); ap.add_argument('--work')
ap.add_argument('--mute', default='', help='experiments only: comma list of stems to leave out (air, amb, music, sfx, hit, sig, pad)')
ARGS = ap.parse_args()
VARIANT = os.environ.get('BZ_VARIANT') or 'main'
OUT_A = os.path.abspath(ARGS.out or os.path.join(P, 'audio' if VARIANT == 'main' else f'audio_{VARIANT}'))
WORK = os.path.abspath(ARGS.work or os.path.join(P, '..', 'work'))
VOICE_DIR = os.path.abspath(os.path.join(P, '..', 'voice'))
SCORE_JS = os.path.join(P, 'overlay', 'scenes', '01_score.js')

VOICE_LUFS = -17.0                           # speech spans (real voice and narrator) in the premaster
NARR_TRIM = 0.0
def lv(x): return VOICE_LUFS + (x + 14.0)    # SERIE level (finished mix, voice ≈ -14) → premaster LUFS
AIR_LVL, GZ_UNDER_RV, AMB_DUCK, SFX_DUCK, HIT_DUCK = -24.0, -30.0, 13.0, 5.0, 4.0   # film 4: the crowd of Douala is speech-like — 13 dB under every voice (film 1: 10), SFX 5 (3)
CARVE = 6.0                                  # + a 0.9-5 kHz dip of the beds (ambience, music) under every voice
AMB_CAP = 10.0
RV_COMP = tuple(map(float, os.environ.get('BZ_RV_COMP', '18,3').split(','))) if os.environ.get('BZ_RV_COMP', '18,3') else None   # (dB under the speech's 95th pct, ratio)
HIT_LVL = -14.0                              # the makossa « coup » (opening, reprise): its loudest 400 ms, like the voice                               # never lift a clip's own sound by more than 10 dB
SFX_LVL = {'whoosh': -24, 'whip': -19, 'pop': -22, 'felt': -27, 'tick': -27, 'ping': -27, 'balafon_note': -27,
           'stamp': -14, 'stamp_low': -14, 'stamp_big': -12, 'tonk': -19, 'bonzini_sig': -17}
SFX_LVL.update(F4SFX.LVL)
SENDS = {'music': ('room', .08), 'sfx': ('room', .07), 'hit': ('room', .10), 'sig': ('plate', .22)}
def log(*a): print(*a, flush=True)
def db(x): return 20 * math.log10(max(float(x), 1e-20))
def smooth01(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)
def nrm(y, pk=.5): return y / (np.abs(y).max() + 1e-12) * pk
def rng(seed): return np.random.default_rng(seed)

# =====================================================================================================================
# the score
# =====================================================================================================================
def score():
    js = ("const S=require(%s);const o={T:S.T,A:S.A,N:S.N,FPS:S.FPS,variant:S.VARIANT,voices:S.voices(),narr:S.narration(),"
          "amb:S.ambience(),cues:S.soundCues(),music:S.music()};console.log(JSON.stringify(o))") % json.dumps(SCORE_JS)
    r = subprocess.run(['node', '-e', js], capture_output=True, text=True, cwd=P, env=os.environ)
    if r.returncode: sys.exit('node could not evaluate the score:\n' + r.stderr[-2000:])
    sc = json.loads(r.stdout.strip().splitlines()[-1]); sc['dur'] = float(sc['T']['end'])
    os.makedirs(OUT_A, exist_ok=True); json.dump(sc, open(os.path.join(OUT_A, 'score_cues.json'), 'w'), indent=1)
    return sc

# =====================================================================================================================
# audio files (48 kHz)
# =====================================================================================================================
_AU = {}
def load48(path):
    if path not in _AU:
        if not os.path.exists(path): _AU[path] = None
        else:
            y, sr = sf.read(path, always_2d=True); y = y.astype(np.float64)
            if y.shape[1] == 1: y = np.repeat(y, 2, 1)
            if sr != SR:
                import soxr
                y = soxr.resample(y, sr, SR, quality='VHQ')
            _AU[path] = y
    return _AU[path]

def clip_audio(clip, kind):
    """kind 'vocals' | 'accomp' | 'orig' → (stereo float array at 48 kHz, path) or (None, path)"""
    path = os.path.join(WORK, f'{clip}_{ {"vocals": "vocals", "accomp": "accomp", "orig": "48"}[kind] }.wav')
    return load48(path), path

def span(y, a, n):
    """exactly n samples from sample a (zero-padded outside the file)"""
    out = np.zeros((n,) + y.shape[1:]); i0, i1 = max(0, a), min(len(y), a + n)
    if i1 > i0: out[i0 - a:i1 - a] = y[i0:i1]
    return out

def kms(x):
    """K-weighted mean square (ungated), as LUFS; a mono signal counts as placed centre-panned"""
    y = dsp.kweight(panst(x, 0) if x.ndim == 1 else x)
    return 10 * math.log10(float(np.mean(np.sum(y ** 2, 1))) + 1e-20) - .691

def lufs_m(x, win=.4, hop=.05):
    """loudest 400-ms window (momentary loudness peak) of a short signal"""
    y = dsp.kweight(panst(x, 0) if x.ndim == 1 else x); p = np.sum(y ** 2, 1); w = ns(win)
    if len(p) <= w: return 10 * math.log10(float(np.mean(p)) + 1e-20) - .691
    c = np.concatenate([[0], np.cumsum(p)]); m = (c[w:] - c[:-w])[::ns(hop)] / w
    return 10 * math.log10(float(m.max()) + 1e-20) - .691

def ramp_db(N, keys):
    """a dB curve from [(t, dB)] keys (linear in dB between keys, held outside)"""
    k = sorted(keys); ts = np.array([q[0] for q in k]); vs = np.array([q[1] for q in k])
    return np.interp(np.arange(N) / SR, ts, vs)

def zp_hp(x, fc, order=2): return sps.sosfiltfilt(sps.butter(order, fc, 'hp', fs=SR, output='sos'), x, axis=0)

def zp_presence(x, fc=3000.0, gain_db=2.5, q=.9):
    b, a = dsp._rbj('peak', fc, q, gain_db / 2)                       # forward + backward = gain_db, zero phase
    return sps.filtfilt(b, a, x, axis=0)

def xcorr_lag(a, b, maxlag=480):
    sos = sps.butter(4, [300, 3400], 'bandpass', fs=SR, output='sos')
    a = sps.sosfiltfilt(sos, a); b = sps.sosfiltfilt(sos, b); n = min(len(a), len(b))
    c = sps.correlate(b[:n], a[:n], mode='full', method='fft'); mid = n - 1
    return int(np.argmax(c[mid - maxlag:mid + maxlag + 1])) - maxlag

def cosfade(x, fi, fo):
    x = x.copy(); fi, fo = max(1, ns(fi)), max(1, ns(fo))
    e = (np.sin(np.linspace(0, np.pi / 2, fi)) ** 2); x[:fi] *= e if x.ndim == 1 else e[:, None]
    e = (np.cos(np.linspace(0, np.pi / 2, fo)) ** 2); x[-fo:] *= e if x.ndim == 1 else e[:, None]
    return x

# =====================================================================================================================
# the real voice + its air
# =====================================================================================================================
def real_voice(v):
    y, path = clip_audio(v['clip'], 'vocals')
    if y is None: y, path = clip_audio(v['clip'], 'orig')
    if y is None: raise SystemExit(f"{v['id']}: no audio for {v['clip']} ({path})")
    mono = y.mean(1); a, n = ns(v['in']), ns(v['out']) - ns(v['in'])
    raw = span(mono, a, n)
    x = zp_presence(zp_hp(raw, float(v.get('hp', 120))), float((v.get('presence') or {}).get('hz', 3000)), float((v.get('presence') or {}).get('db', 2.5)))
    s0, s1 = v['speech'][0] - v['t'], v['speech'][1] - v['t']        # the speech span, relative to the segment
    if RV_COMP:                                                       # a gentle leveller: the fast, soft syllables come up (gain only, no delay)
        from scipy.ndimage import uniform_filter1d
        e = np.sqrt(uniform_filter1d(x[ns(s0):ns(s1)] ** 2, ns(.01)) + 1e-20); ref = 20 * np.log10(np.percentile(e, 95))
        x = dsp.compressor(x, thr_db=ref - RV_COMP[0], ratio=RV_COMP[1], att=.004, rel=.08, knee_db=6.0)
    room = ramp_db(n, [(0, -12), (max(0, s0 - .045), -12), (max(0, s0 - .01), 0), (s1 + .02, 0), (s1 + .06, -12), (n / SR, -12)])
    x = x * dsp.undb(room)
    g = VOICE_LUFS + float(v.get('gain', 0)) - kms(x[ns(s0):ns(s1)])
    x = cosfade(x * dsp.undb(g), v.get('fadeIn') or .02, v.get('fadeOut') or .02)
    lag = xcorr_lag(raw, x)
    info = dict(id=v['id'], clip=v['clip'], src=os.path.basename(path), t=v['t'], samples=len(x), expected=n, lag=lag, gain_db=round(g, 2), speech=v['speech'])
    air = None; ac, apath = clip_audio(v['clip'], 'accomp')
    if ac is not None and v.get('air'):
        z = span(ac, a, n); la = kms(z); ga = min(AMB_CAP, lv(AIR_LVL) - la)
        air = cosfade(z * dsp.undb(ga), .06, .06); info.update(air=os.path.basename(apath), air_gain_db=round(ga, 2), air_raw_lufs=round(la, 1))
    return x, air, info

# =====================================================================================================================
# the narrator
# =====================================================================================================================
def narrator(nl):
    if not nl.get('file'): return None, dict(id=nl['id'], note='no take: not placed')
    path = os.path.join(VOICE_DIR, nl['file']); y = load48(path)
    if y is None: raise SystemExit(f"{nl['id']}: {path} missing")
    x = zp_hp(y.mean(1), 70.0)
    s0, s1 = ns(nl['lead']), ns(nl['lead'] + nl['dur'])
    g = VOICE_LUFS + NARR_TRIM - kms(x[s0:s1]); x = cosfade(x * dsp.undb(g), .005, .01)
    return x, dict(id=nl['id'], file=nl['file'], at=nl['wav'], speech=[nl['t'], nl['end']], wav_end=round(nl['wav'] + len(x) / SR, 4),
                   gain_db=round(g, 2), sps=nl['sps'], stretch=nl.get('stretch'))

# =====================================================================================================================
# ambience
# =====================================================================================================================
def ambience(seg, rv, N):
    kind = 'accomp' if clip_audio(seg['clip'], 'accomp')[0] is not None else 'orig'
    y, path = clip_audio(seg['clip'], kind)
    if y is None: return None, dict(shot=seg['shot'], note=f'no audio ({path})')
    n = ns(seg['t1'] - seg['t0']); t = seg['t0'] + np.arange(n) / SR
    info = dict(shot=seg['shot'], clip=seg['clip'], src=os.path.basename(path), mode=seg['mode'], t0=seg['t0'], t1=seg['t1'])
    if seg['mode'] == 'match' and seg.get('map'):
        mp = np.array(seg['map']); s = np.interp(t, mp[:, 0], mp[:, 1]); vel = np.gradient(s) * SR
        pos = np.clip(s * SR, 0, len(y) - 1); idx = np.arange(len(y))
        out = np.stack([np.interp(pos, idx, y[:, c]) for c in range(2)], 1) * smooth01(np.abs(vel) / .25)[:, None]
    else:
        out = span(y, ns(seg['in']), n)
    raw = kms(out) if np.any(out) else -120.0
    base = float(seg.get('lvl', -16)) + float(seg.get('g', 0))                   # SERIE level when its window leads
    lvl = np.full(n, base)
    if seg.get('keys'): lvl = lvl + ramp_db(n, [(k[0] - seg['t0'], k[1]) for k in seg['keys']])
    if seg.get('gz'):                                                             # under a REAL voice: the voice brings its air
        for v in rv:
            if v['t'] >= seg['t1'] or v['end'] <= seg['t0']: continue
            cap = -60.0 if v['clip'] == seg['clip'] else GZ_UNDER_RV
            w = smooth01(np.minimum((t - (v['t'] - .15)) / .15, ((v['end'] + .15) - t) / .15))
            lvl = lvl - w * np.maximum(0, lvl - cap)
    gain = np.minimum(AMB_CAP, lvl - raw)
    out = out * dsp.undb(gain)[:, None]
    fi, fo = ns(seg.get('fadeIn', .03)), ns(seg.get('fadeOut', .03))
    if fi > 1: out[:fi] *= (np.sin(np.linspace(0, np.pi / 2, fi)) ** 2)[:, None]
    if fo > 1: out[-fo:] *= (np.cos(np.linspace(0, np.pi / 2, fo)) ** 2)[:, None]
    info.update(level=base, raw_lufs=round(raw, 1), gain_db=round(float(np.median(gain)), 2), capped=bool(np.any(lvl - raw > AMB_CAP)))
    return out, info

# =====================================================================================================================
# SFX (synthesised, seeded; mono (n,) or stereo (n, 2); onset at sample 0)
# =====================================================================================================================
def stick_slip(n, rate, seed, amp=(.4, 1.0)):
    r = rng(seed); rate = np.broadcast_to(np.asarray(rate, float), (n,))
    ph = np.cumsum(np.maximum(rate, 1.0)) / SR
    idx = np.nonzero(np.diff(np.floor(ph)) > 0)[0] + 1
    imp = np.zeros(n); imp[0] = 1.0; imp[idx] = r.uniform(*amp, len(idx))
    return imp

def wander(n, seed, scale, hz=8.0):
    x = dsp.onepole_lp(rng(seed).standard_normal(n), hz); x = x - x.mean()
    return x / (np.abs(x).max() + 1e-12) * scale

def thud(f_hi, f_lo, tau_f, tau, n, drive=1.0):
    t = tt(n); return np.sin(2 * np.pi * np.cumsum(f_lo + (f_hi - f_lo) * np.exp(-t / tau_f)) / SR) * np.exp(-t / tau) * drive

def sfx_whoosh(seed, dur=.32, p0=-.5, p1=.5, lo=350, hi=3400, peak=.35, flap=.5):
    dur = max(.12, dur); n = ns(dur); t = tt(n); u = t / dur
    sh = np.where(u < peak, (u / peak) ** 1.5, np.exp(-(u - peak) / (.28 * (1 - peak))))
    w = dsp.tv_biquad(nz(n, seed), 'bp', lo + (hi - lo) * sh, .9) * np.maximum(sh, .25 * np.minimum(1, t / .004))
    w = w / (np.abs(w).max() + 1e-9) * np.clip((dur - t) / .02, 0, 1)
    f = I.paper(seed + 1); f = f / (np.abs(f).max() + 1e-9) * flap
    y = w.copy(); y[:len(f)] += f[:n]
    return panst(y, p0 + (p1 - p0) * smooth01(u)) * .5

def sfx_whip(seed=971, dur=.24):
    """the filé: a fast air rip left → right, bright, a cloth snap on the switch"""
    y = sfx_whoosh(seed, dur, -.7, .7, 600, 7000, .45, .2)
    n = len(y); i = ns(dur * .45); m = ns(.05)
    sn = dsp.butter(nz(m, seed + 3), 'bp', [1500, 6000], 2) * np.exp(-tt(m) / .008)
    if i + m <= n: y[i:i + m] += panst(sn, .2) * .25
    return y

def sfx_felt(seed=501, dur=.36, squeak=1.0, attack=.012):
    """a felt-tip pen drawn on (the route, the underlines): fibre friction + the intermittent squeak (series)"""
    dur = max(.08, dur); n = ns(dur); t = tt(n); r = rng(seed)
    env = np.minimum(1, t / attack) * np.clip((dur - t) / .07, 0, 1) * (.75 + .25 * np.sin(2 * np.pi * 3 * t + r.uniform(0, 6)))
    fric = dsp.butter(nz(n, seed), 'bp', [1800, 6500], 2)
    gr = grains(n, 160, seed + 1, .003, (.2, 1)); fric *= .55 + .45 * gr / (gr.max() + 1e-9)
    imp = stick_slip(n, 950 * (1 + wander(n, seed + 2, .07, 12)), seed + 3, (.6, 1))
    sq = bp(imp, 2300, 9) + .6 * bp(imp, 3600, 10)
    gate = np.clip(dsp.onepole_lp((rng(seed + 4).random(n // 480 + 1) > .45).repeat(480)[:n].astype(float), 40), 0, 1)
    sq = sq / (np.abs(sq).max() + 1e-9) * gate * squeak
    y = (fric / (np.abs(fric).max() + 1e-9) * .8 + sq * .6) * env
    y[:ns(.003)] += bp(nz(ns(.003), seed + 5), 3000, 1) * np.linspace(1, 0, ns(.003)) * .8
    return nrm(y)

def sfx_ping(seed=981, m=96):
    """a parcel arrives at Douala: a small glassy ping (bell partials) with a soft tail"""
    y = np.zeros(ns(.8)); place(y, A._bell(m2f(m), .7, .18, seed, .002), 0); place(y, .35 * A._bell(m2f(m + 7), .5, .1, seed + 1, .002), 0)
    return nrm(y)

def sfx_balafon_note(seed=991):
    """MERCI: one warm balafon note (A4, wooden bar, resonator) + its octave, soft"""
    y = np.zeros(ns(1.3)); b = A.balafon(69, seed, .9); place(y, nrm(b, 1.0), 0)
    b2 = A.balafon(81, seed + 1, .6); place(y, nrm(b2, .35), ns(.004))
    return nrm(dsp.lp(y, 5000))

def sfx_stamp(seed=941, pitch=1.0, sub=1.0, body=.9):
    """the series' rubber stamp + table thud + paper slap; pitch < 1 = lower (REÇU)"""
    n = ns(.9); t = tt(n); y = np.zeros(n)
    s = A.sfx_stamp(seed); y[:len(s)] += s / (np.abs(s).max() + 1e-9)
    s = I.stamp(seed + 1); y[:len(s)] += s * .7
    if pitch != 1.0:
        y = sps.resample(y, int(round(len(y) / pitch)))[:n]; y = np.pad(y, (0, max(0, n - len(y))))
    y += np.sin(2 * np.pi * np.cumsum((40 + 70 * np.exp(-t / .03)) * pitch) / SR) * np.exp(-t / .14) * body * sub
    return nrm(y, .9)

def sfx_stamp_big(seed=671):
    """C'EST FORT !: the stamp doubled, a chest thump with a short sub, a hollow body; above 160 Hz a hit, not a tail"""
    n = ns(1.2); t = tt(n); y = np.zeros(n)
    s = A.sfx_stamp(seed); y[:len(s)] += s / np.abs(s).max()
    s = I.stamp(seed + 1); y[:len(s)] += s * .7
    y += dsp.softclip(thud(110, 38, .03, .18, n, 1.7), 1.3) * .95
    y += R._modes(t, 1.0, ((140, 1, .07), (215, .7, .05), (330, .45, .035)), seed + 2, None) * .5
    tk = dsp.hp(nz(ns(.003), seed + 3), 3000) * np.linspace(1, 0, ns(.003)) * .8; y[:len(tk)] += tk
    lo, hi = dsp.zp_split(y, 160, 2)
    y = lo + hi * np.where(t < .05, 1.0, np.exp(-(t - .05) / .07))
    y *= np.minimum(1, t / .0004)
    return y / np.abs(y).max()

def sfx_pill(seed=611):
    """the amber pill pops in: a soft pop, then its bounce settling"""
    y = np.zeros(ns(.4)); p = I.pop(seed); p = p / (np.abs(p).max() + 1e-9); y[:len(p)] += p
    s = A.sfx_setdown(seed + 1); place(y, s / np.abs(s).max() * .45, ns(.10))
    s = A.sfx_setdown(seed + 2); place(y, s / np.abs(s).max() * .18, ns(.17))
    return nrm(y)

def sfx_sig(seed=961):
    """the series' Bonzini signature: bright balafon E6 then G#6 .1 s later, a bell on the second"""
    y = np.zeros(ns(1.4)); b1 = A.balafon_bright(88, seed, 1.2); b2 = A.balafon_bright(92, seed + 1, 1.0)
    place(y, b1 * .9, 0); place(y, b2, ns(.10)); place(y, A._bell(m2f(100), .8, .3, 1, .002) * .25, ns(.10))
    return nrm(y, .7)

def cue_signal(c, i):
    name, d, sd = c['name'], c.get('d'), 9000 + 37 * i
    p = float(c.get('pan', 0))
    table = {
        'whoosh': lambda: ('sfx', sfx_whoosh(sd, d or .32, -.5 if p >= 0 else .5, .5 if p >= 0 else -.5)),
        'whip': lambda: ('sfx', sfx_whip(sd, (d or .2) + .04)),
        'pop': lambda: ('sfx', sfx_pill(sd) if 'pill' in (c.get('note') or '') else nrm(I.pop(sd), .6)),
        'felt': lambda: ('sfx', sfx_felt(sd, d or .3)),
        'tick': lambda: ('sfx', nrm(A.wood(1250, sd, 1.0), .5)),
        'ping': lambda: ('sfx', sfx_ping(sd)),
        'balafon_note': lambda: ('sig', sfx_balafon_note(sd)),
        'stamp': lambda: ('hit', sfx_stamp(sd)),
        'stamp_low': lambda: ('hit', sfx_stamp(sd, pitch=.82, sub=1.15)),
        'stamp_big': lambda: ('hit', sfx_stamp_big(sd)),
        'tonk': lambda: ('sfx', nrm(R.sfx_tonk(sd), .8)),
        'bonzini_sig': lambda: ('sig', sfx_sig(sd)),
    }
    table.update(F4SFX.table(c, i, d, sd, p))
    if name in table: return table[name]() + (None,)
    fam = next((k for k in table if k.split('_')[0] in name), None)
    if fam: return table[fam]() + (f'{name}~{fam}',)
    return None, None, name

# =====================================================================================================================
# music
# =====================================================================================================================
def strum(tones, seed, spread=.012, dur=1.2, bright=.75):
    """a strummed guitar chord (down-stroke, low → high), Karplus-Strong"""
    y = np.zeros(ns(dur + spread * len(tones)))
    for k, m in enumerate(sorted(tones)):
        place(y, mk.guitar(m2f(m), dur, bright=bright, decay=.997, seed=seed + k), ns(k * spread))
    return y

def music_hit(prog_bar, seed):
    """the makossa « coup »: kick + strummed chord (an octave up) + the bass root + a soft crash"""
    name, tones, root = prog_bar
    n = ns(1.6); y = np.zeros(n)
    place(y, nrm(mk.kick(), .9), 0); place(y, nrm(strum([m + 12 for m in tones] + [tones[0]], seed), .6), 0)
    place(y, nrm(mk.bass(m2f(root - 12), .9, 1.0), .7), 0)
    y += dsp.hp(nz(n, seed + 5), 5000) * np.exp(-tt(n) / .3) * .08
    return y

def wind_pad(dur, seed=777):
    """the map's very soft wind: two slow band-passed noises, gusting, faded in and out"""
    n = ns(dur); t = tt(n)
    g = .6 + .4 * np.sin(2 * np.pi * .23 * t + .7) * np.sin(2 * np.pi * .11 * t + 1.9)
    l = dsp.tv_biquad(nz(n, seed), 'bp', 420 + 260 * np.sin(2 * np.pi * .17 * t), .8) * g
    r = dsp.tv_biquad(nz(n, seed + 1), 'bp', 480 + 240 * np.sin(2 * np.pi * .13 * t + 1.2), .8) * g
    y = np.stack([l, r], 1) * np.minimum(1, t / .6)[:, None] * np.clip((dur - t) / .5, 0, 1)[:, None]
    return y / (np.abs(y).max() + 1e-9)

def compose_section(sec, mp, dur, end, stops, N):
    """one section rendered alone (stereo buffer of the whole film), on its own bar grid"""
    bt = float(mp.get('beat') or 60.0 / mp['bpm']); bar = 4 * bt
    g0 = float(sec.get('grid0') if sec.get('grid0') is not None else mp.get('grid0', 0))
    prog = mk.PROG_MINOR if sec.get('prog', mp.get('prog')) == 'minor' else mk.PROG
    inStop = lambda t: any(a - 1e-6 <= t < b - 1e-6 for a, b in stops)
    buf = np.zeros((N + ns(3), 2)); placed = [0]
    hi_t = min(sec['t1'], end)
    def put(sig, t, g=1.0, p=0.0):
        if sec['t0'] - 1e-6 <= t < hi_t - 1e-6 and not inStop(t):
            R.place_at(buf, R.stereo_of(tail_fade(np.asarray(sig, float)), g, p), ns(t)); placed[0] += 1
    b0 = int(math.floor((sec['t0'] - g0) / bar + 1e-9)); b1 = int(math.ceil((hi_t - g0) / bar - 1e-9))
    for b in range(b0, b1):
        tb = g0 + b * bar; bi = b % 4
        if sec.get('groove') is False: continue                          # a suspended section: its pad only
        mk.groove(put, tb, bi, beat=bt, level=sec.get('level', 'full'), prog=prog)
        name, tones, root = prog[bi]
        for j in range(16):
            tj = tb + j * bt / 4 + (.012 if j % 2 else 0.0)
            if sec.get('shaker') and j % 2 == 0: put(A.rattle(5300 + 16 * b + j, .04, .8, 1.1), tj, .16 if j % 4 else .22, .35)
            if sec.get('congas') and j % 8 == 4: put(A.conga(64 if j == 4 else 59, 5500 + 16 * b + j, slap=j == 12), tj, .32, -.3)
            if sec.get('balafon') and j in (6, 14): put(A.balafon_bright(tones[(j // 6 + b) % 4] + 12, 5400 + 16 * b + j, .6), tj, .17, -.4)
    hits = []; hbuf = np.zeros_like(buf)                                  # the hits apart: levelled on their own peak
    for h in mp.get('hits', []):
        if sec['t0'] - 1e-6 <= h < hi_t - 1e-6 and not inStop(h):
            k = int(math.floor((h - g0) / bar + 1e-6)) % 4; hs = R.stereo_of(music_hit(prog[k], 7700 + int(h * 100)), 1, 0)
            R.place_at(hbuf, hs * dsp.undb(lv(HIT_LVL) - lufs_m(hs)), ns(h)); hits.append(h)
    button = None
    if end < dur - .05 and sec['t1'] >= end - 1e-6:                      # the band stops on a button: the last downbeat
        tb = max([g0 + b * bar for b in range(b0, b1 + 1) if g0 + b * bar <= end - .15] or [None])
        if tb is not None:
            buf[ns(tb):] = 0                                               # nothing of the groove after the button
            hb = music_hit(prog[0], 7900); hb = R.stereo_of(hb * np.exp(-tt(len(hb)) / .25), 1, 0)
            R.place_at(hbuf, hb * dsp.undb(lv(HIT_LVL - 2) - lufs_m(hb)), ns(tb)); button = tb
    if sec.get('pad'):
        if (sec['pad'] or {}).get('name') == 'nappe': pd = F4SFX.nappe(sec['t1'] - sec['t0'], tuple(prog[0][1][:3]))
        else: pd = wind_pad(sec['t1'] - sec['t0'])
        buf_pad = np.zeros_like(buf); R.place_at(buf_pad, pd, ns(sec['t0']))
    else: buf_pad = None
    if sec.get('lowpass'): buf = dsp.butter(buf, 'lp', float(sec['lowpass']), 4)
    return buf, hbuf, buf_pad, dict(t0=sec['t0'], t1=sec['t1'], level=sec.get('level'), grid0=g0, events=placed[0], hits=hits, button=button)

def gate(N, a, b, fade=.004):
    """0 inside [a, b) (raised-cosine edges of `fade`), 1 elsewhere"""
    g = np.ones(N); i0, i1 = max(0, ns(a)), min(N, ns(b)); g[i0:i1] = 0; k = ns(fade)
    if i0 > 0: j = max(0, i0 - k); g[j:i0] *= np.cos(np.linspace(0, np.pi / 2, i0 - j)) ** 2
    if i1 < N: j = min(N, i1 + k); g[i1:j] *= np.sin(np.linspace(0, np.pi / 2, j - i1)) ** 2
    return g

# =====================================================================================================================
# assembly
# =====================================================================================================================
def build():
    try:
        if os.nice(0) < 5: os.nice(5 - os.nice(0))
    except Exception: pass
    sc = score(); dur = sc['dur']; N = ns(dur); NT = N + ns(3.0)
    log(f'[mix] score: T.end {dur} s ({sc["N"]} frames) · variant {sc.get("variant")} · {len(sc["voices"])} real voice(s) · '
        f'{len(sc["narr"])} narrator line(s) · {len(sc["amb"])} ambience segment(s) · {len(sc["cues"])} cue(s) · music {sc["music"].get("bpm")} bpm')
    st = {k: np.zeros((NT, 2)) for k in ('voice', 'narr', 'air', 'amb', 'music', 'pad', 'sfx', 'hit', 'sig')}
    rep = dict(voices=[], narr=[], amb=[], cues=[], unknown=[], music=[])
    # ---- real voice + air ----
    for v in sc['voices']:
        x, air, info = real_voice(v); R.place_at(st['voice'], panst(x, 0), ns(v['t']))
        if air is not None: R.place_at(st['air'], air, ns(v['t']))
        rep['voices'].append(info)
    # ---- narrator ----
    for nl in sc['narr']:
        x, info = narrator(nl); rep['narr'].append(info)
        if x is not None: R.place_at(st['narr'], panst(x, 0), ns(nl['wav']))
    # ---- voices never overlap (speech spans AND the narrator wav extents against real speech) ----
    spans = sorted([(v['speech'][0], v['speech'][1], v['id']) for v in sc['voices']] + [(n['speech'][0], n['speech'][1], n['id']) for n in rep['narr'] if 'speech' in n])
    overlaps = [f'{a[2]}/{b[2]}' for a, b in zip(spans, spans[1:]) if b[0] < a[1] - 1e-6]
    for n in rep['narr']:
        if 'at' not in n: continue
        for v in sc['voices']:
            if n['at'] < v['speech'][1] and n['wav_end'] > v['speech'][0]: overlaps.append(f'{n["id"]} wav / {v["id"]} speech')
    dry = (st['voice'] + st['narr'])[:N].copy()
    # ---- ambience ----
    for seg in sc['amb']:
        x, info = ambience(seg, sc['voices'], N); rep['amb'].append(info)
        if x is not None: R.place_at(st['amb'], x, ns(seg['t0']))
    # ---- music: one buffer per section, levelled on its own span ----
    mp = sc['music']; end = min(dur, float(mp.get('end', dur))); stops = mp.get('stops', [])
    sec_db = np.full(N, np.nan); sec_duck = np.zeros(N)
    for sec in mp.get('sections', []):
        buf, hbuf, pad, info = compose_section(sec, mp, dur, end, stops, N)
        a, b = ns(sec['t0']), ns(min(sec['t1'], end)); seg = buf[a:b]
        L = kms(seg) if np.any(seg) else -120.0; g = lv(float(sec.get('db', -18))) - L
        st['music'][:len(buf)] += buf[:NT] * dsp.undb(g) + hbuf[:NT]
        if pad is not None:
            pdb = float((sec.get('pad') or {}).get('db', -30)); Lp = kms(pad[a:b]); st['pad'][:len(pad)] += pad[:NT] * dsp.undb(lv(pdb) - Lp)
        sec_db[a:b] = float(sec.get('db', -18)); sec_duck[a:b] = float(sec.get('db', -18)) - float(sec.get('duckUnderVoice', -26))
        info.update(raw_lufs=round(L, 1), gain_db=round(g, 2), db=sec.get('db'), duck_db=sec_duck[a]); rep['music'].append(info)
    # carry the duck depth across the gaps (the tails of a section keep its depth)
    last = 8.0
    for i in range(N):
        if sec_db[i] == sec_db[i]: last = sec_duck[i]
        else: sec_duck[i] = last
    # ---- cues ----
    M = []
    gmax = {}
    for c in sc['cues']: gmax[c['name']] = max(gmax.get(c['name'], 0), float(c.get('g', 1)))
    for i, c in enumerate(sc['cues']):
        stem, sig, alias = cue_signal(c, i)
        if sig is None: rep['unknown'].append(alias); continue
        if alias: rep['unknown'].append(alias)
        key = alias.split('~')[1] if alias else c['name']
        tgt = lv(SFX_LVL.get(key, -24)) + 20 * math.log10(max(1e-3, float(c.get('g', 1)) / gmax[c['name']]))
        sig = sig if sig.ndim == 2 else panst(sig, float(c.get('pan', 0)))
        g = tgt - lufs_m(sig); M.append((stem, sig, c['t'], g))
        rep['cues'].append(dict(t=c['t'], name=c['name'], stem=stem, d=c.get('d'), lvl=SFX_LVL.get(key), gain_db=round(g, 1)))
    for stem, sig, t, g in M: R.place_at(st[stem], sig * dsp.undb(g), ns(t))
    # ---- sends ----
    ir = R.irs()
    for k, (bus, wet) in SENDS.items(): st[k] = st[k] + dsp.reverb(st[k], ir[bus], wet=wet)
    st['narr'] = st['narr'] + dsp.reverb(st['narr'], ir['room'], wet=.035)
    st = {k: v[:N] for k, v in st.items()}
    # ---- music stops (digital silence, reverb included) + the end ----
    gm = np.ones(N)
    for a, b in stops: gm *= gate(N, a, b)
    if end < dur: gm *= gate(N, end, dur + 1, fade=.06)
    st['music'] *= gm[:, None]; st['pad'] *= gm[:, None]
    if end < dur:                                                             # from the freeze on: the ambience alone (§3.10)
        ge = gate(N, end, dur + 1, fade=.12)[:, None]
        for k in ('sig', 'sfx', 'hit', 'narr', 'voice', 'air'): st[k] = st[k] * ge
    # ---- ducking: the sidechain is every voice (dry real voice + narrator), their speech spans held ----
    d1, _ = R.duck_db(dry, [(a, b) for a, b, _ in spans]) if np.any(dry) else (np.zeros(N), None)
    st['music'] *= dsp.undb(d1 * sec_duck)[:, None]; st['pad'] *= dsp.undb(d1 * 6)[:, None]
    st['amb'] *= dsp.undb(d1 * AMB_DUCK)[:, None]
    st['amb'] = R.carve(st['amb'], d1, CARVE); st['music'] = R.carve(st['music'], d1, CARVE)
    st['sfx'] *= dsp.undb(d1 * SFX_DUCK)[:, None]; st['hit'] *= dsp.undb(d1 * HIT_DUCK)[:, None]
    # ---- premaster + master ----
    for k in filter(None, ARGS.mute.split(',')): st[k] = st[k] * 0
    Pm = A.sclip(st['music'] + st['pad'] + st['sig'], .7) + st['sfx'] + A.sclip(st['hit'], .6) + st['amb'] + st['air'] + st['voice'] + st['narr']
    ceil = -1.3; Y, g, gl = R.master(Pm, -14.0, ceil); tp = R.true_peak_db(Y)
    while tp > -1.0 and ceil > -4:
        ceil -= (tp + 1.0) + .05; Y, g, gl = R.master(Pm, -14.0, ceil); tp = R.true_peak_db(Y)
    fo = ns(.02); Y[-fo:] *= np.linspace(1, 0, fo)[:, None]                 # no click at the loop point
    assert len(Y) == N
    os.makedirs(OUT_A, exist_ok=True); dsp.save(os.path.join(OUT_A, 'mix.wav'), Y, 'PCM_24')
    G = dsp.undb(g)
    stems = {'voice': st['voice'] + st['air'], 'narr': st['narr'], 'amb': st['amb'], 'music': st['music'] + st['pad'] + st['sig'], 'sfx': st['sfx'] + st['hit']}
    if ARGS.stems:
        os.makedirs(os.path.join(OUT_A, 'stems'), exist_ok=True)
        for k, v in stems.items(): dsp.save(os.path.join(OUT_A, 'stems', f'{k}.wav'), v * G, 'FLOAT')
    # ---- checks ----
    import pyloudnorm as pyln
    Z, sr = sf.read(os.path.join(OUT_A, 'mix.wav')); meter = pyln.Meter(SR)
    voice_ok = all(v['samples'] == v['expected'] and v['lag'] == 0 for v in rep['voices'])
    rest_all = stems['amb'] + stems['music'] + stems['sfx'] + st['air']
    vm = []
    for v in sc['voices']:
        a, b = ns(v['speech'][0]), ns(v['speech'][1])
        vm.append(dict(id=v['id'], margin_db=round(10 * math.log10(R.kpow(st['voice'], a, b) / R.kpow(rest_all, a, b)), 1)))
    for n in rep['narr']:
        if 'speech' not in n: continue
        a, b = ns(n['speech'][0]), ns(n['speech'][1])
        vm.append(dict(id=n['id'], margin_db=round(10 * math.log10(R.kpow(st['narr'], a, b) / R.kpow(rest_all + st['voice'], a, b)), 1)))
    # the last 0.30 s: ambience only (no voice, music, sfx)
    tail = ns(.30); tail_other = float(np.abs((stems['voice'] + stems['narr'] + stems['music'] + stems['sfx'])[-tail:]).max())
    rep.update(sr=sr, n=len(Z), dur=len(Z) / sr, frames=len(Z) / sr * sc['FPS'], channels=Z.shape[1], lufs=round(meter.integrated_loudness(Z), 2),
               tp_dbtp=round(R.true_peak_db(Z), 2), master_gain_db=round(g, 2), limiter_ceiling_db=round(ceil, 2),
               max_gr_db=round(float(-20 * np.log10(gl.min())), 2), clipped=int((np.abs(Z) >= .9999).sum()), voice_ok=voice_ok,
               voice_over_rest=vm, overlaps=overlaps, tail_only_amb=tail_other < 1e-6, duck_max=round(float(-d1.min()), 3))
    json.dump(rep, open(os.path.join(OUT_A, 'mix_report.json'), 'w'), indent=1, default=lambda o: o.tolist() if hasattr(o, 'tolist') else str(o))
    log(f'[mix] {os.path.relpath(OUT_A, P)}/mix.wav {rep["n"]} samples = {rep["dur"]:.6f} s ({rep["frames"]:.2f} frames) @ {sr} Hz ×{rep["channels"]} · '
        f'{rep["lufs"]:.2f} LUFS · TP {rep["tp_dbtp"]:.2f} dBTP · master {g:+.2f} dB · limiter max GR {rep["max_gr_db"]:.1f} dB (ceiling {ceil:.2f})')
    for v in rep['voices']:
        log(f'    voice {v["id"]:5s} {v["clip"]} ({v["src"]}) at {v["t"]:.3f}: {v["samples"]} samples (= {v["expected"]}) · lag {v["lag"]} · '
            f'gain {v["gain_db"]:+.1f} dB · air {v.get("air")} {v.get("air_gain_db", 0):+.1f} dB (raw {v.get("air_raw_lufs")} LUFS)')
    for n in rep['narr']: log(f'    narr  {n["id"]:5s} {n.get("file")} wav at {n.get("at")} → {n.get("wav_end")} · speech {n.get("speech")} · gain {n.get("gain_db", 0):+.1f} dB · {n.get("sps", 0):.2f} syl/s')
    for v in vm: log(f'    {v["id"]:5s} over everything else (K-weighted, speech span): {v["margin_db"]:+.1f} dB')
    for a_ in rep['amb']:
        log(f'    amb {a_["shot"]:5s} {a_.get("clip", ""):4s} {a_.get("t0", 0):6.2f}-{a_.get("t1", 0):6.2f} {a_.get("src", a_.get("note", "")):14s} lvl {a_.get("level")} raw {a_.get("raw_lufs")} '
            f'gain {a_.get("gain_db", 0):+.1f} dB' + (' (CAPPED)' if a_.get('capped') else ''))
    for m in rep['music']: log(f'    music {m["t0"]:.2f}-{m["t1"]:.2f} {m["level"]:5s} grid {m["grid0"]:.2f} · {m["events"]} events · hits {m["hits"]} · button {m["button"]} · raw {m["raw_lufs"]} LUFS → {m["db"]} (gain {m["gain_db"]:+.1f}) · duck {m["duck_db"]} dB')
    log(f'    cues: ' + ' · '.join(f'{c["t"]:.2f} {c["name"]}' for c in rep['cues']))
    if rep['unknown']: log('[mix] WARNING cue names without a dedicated sound:', rep['unknown'])
    if overlaps: log('[mix] ERROR voices overlap:', overlaps)
    ok = voice_ok and not overlaps and rep['tp_dbtp'] <= -1.0 + 1e-6 and abs(rep['lufs'] + 14) < .3 and rep['n'] == N and rep['tail_only_amb']
    log(f'[mix] {"OK" if ok else "CHECK"}: real voice untouched {voice_ok} · no overlap {not overlaps} · -14 LUFS {abs(rep["lufs"] + 14) < .3} · '
        f'TP <= -1 {rep["tp_dbtp"] <= -1.0 + 1e-6} · length = T.end {rep["n"] == N} · last 0.30 s ambience only {rep["tail_only_amb"]}')
    return rep

if __name__ == '__main__':
    build()
