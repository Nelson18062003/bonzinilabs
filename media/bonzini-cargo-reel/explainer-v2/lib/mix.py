"""« Le parcours de vos colis » — final mix: narrator + team quotes + ducked music (+ optional SFX) -> -14 LUFS / -1.2 dBTP.

mix(voice_vo, voice_sp, music, sfx=None) takes arrays (n, 2) or wav paths, returns (stereo float array, report dict).
- narrator ('vo', Kyutai TTS): treated like prix-de-revient (hp 80 Hz + gentle 2.2:1 compression), levelled to VO_LUFS.
- team quotes ('sp', real on-site voice): hp 90 Hz, -2 dB @ 1.3 kHz (forward/boxy), +2 dB @ 5 kHz (articulation),
  lp 15 kHz (hiss), the same gentle compression, then each quote is level-matched to the narrator's median line.
- music: 3-band duck (zero-phase split, no phase smear) under every segment, deeper under the team quotes:
  voice band (250 Hz-4.5 kHz) -9 dB under 'vo' / -12 dB under 'sp'; lows and air ducked 3 / 2 dB less so the groove
  keeps its pulse. 80 ms look-ahead + attack, 450 ms release, short gaps (< 0.75 s) do not let the bed bob up.
- sfx (optional, out/sfx.wav if present, made by lib/sfx.py): levelled to SFX_LUFS, ducked lightly under speech; the
  per-line rider measures the voice against music + sfx, so the bed gives way where the foley is busy.
- music stops (out/sfx_report.json["music_stops"], from the `music_stop_beat` cue): music gated for one beat.
- master: light glue compression, -14 LUFS integrated, true-peak limiter at CEIL_DBTP (checked with ffmpeg ebur128).

usage: PYTHONDONTWRITEBYTECODE=1 nice -n 5 python3 lib/mix.py [--asr]   -> out/final_mix.wav (+ out/mix_report.json)
       --asr: transcribe 52-65 s of the final mix with faster-whisper (large-v3, int8) as an intelligibility check
"""
import os, sys, json, re, subprocess
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
X = os.path.dirname(HERE)
REEL = os.environ.get('BONZINI_REEL', '/home/user/bonzinilabs/media/bonzini-cargo-reel')
sys.path.insert(0, os.path.join(REEL, 'explainer', 'lib', 'audio'))
import dsp                                   # noqa: E402
from dsp import SR, ns, undb, db             # noqa: E402

TL = json.load(open(os.path.join(X, 'data', 'timeline.json')))
DUR = float(TL['duration']); N = ns(DUR)
SEGS = TL['segments']
OUT = os.path.join(X, 'out')

VO_LUFS = -16.0                         # speech loudness of the voice bus before the master
MUSIC_LUFS = -21.0                      # whole-track loudness of the (unducked) music bed, relative to VO_LUFS
DUCK_DB = {'vo': -9.0, 'sp': -12.0}     # voice-band duck depth
BAND_OFFSET_DB = (1.5, 0.0, 1.0)        # low (<250 Hz) / voice band / air (>4.5 kHz): how much LESS they duck
RIDE_MIN_LU = {'vo': 12.5, 'sp': 14.5}   # per-line rider: deepen that line's duck (max RIDE_MAX_DB) until voice-over-bed >= this
RIDE_MAX_DB = 4.0
SFX_LUFS, SFX_DUCK_DB = -29.5, -4.0
MUSIC_STOP_DB, MUSIC_STOP_RAMPS = -40.0, (.012, .03)   # 'music stops one beat' gate depth, (down, up) ramps in s
ATTACK, RELEASE, LOOKAHEAD, HOLD, MERGE_GAP = .08, .45, .08, .15, .75
HIT_DUCK_CAP_DB = -3.0                  # if a music hit ever lands under speech, let it through for 0.3 s
TARGET_LUFS, CEIL_DBTP = -14.0, -1.2


def _st(x):
    if isinstance(x, str): x = dsp.load(x)
    x = dsp.stereo(np.asarray(x, dtype=float))
    if len(x) < N: x = np.concatenate([x, np.zeros((N - len(x), 2))])
    return x[:N]


def _mask(kinds=('vo', 'sp'), pre=0.0, post=0.0):
    m = np.zeros(N, bool)
    for s in SEGS:
        if s['kind'] in kinds: m[ns(max(0, s['start'] - pre)):ns(min(DUR, s['end'] + post))] = True
    return m


def _lufs_mono(x): return dsp.lufs_integrated(np.stack([x, x], 1))


def _seg_gain_curve(gains, ramp=.03):
    """Per-sample linear gain: gains {seg_id: dB} applied over [start-.1, end+.2] with short ramps (in silence)."""
    g = np.zeros(N)
    for s in SEGS:
        if s['id'] in gains: g[ns(max(0, s['start'] - .1)):ns(min(DUR, s['end'] + .2))] = gains[s['id']]
    k = max(1, ns(ramp))
    return undb(np.convolve(g, np.ones(k) / k, 'same'))


# ============================================================================ voice
def comp(x):
    """Gentle speech compression (prix-de-revient settings, threshold relative to the levelled speech)."""
    return dsp.compressor(x, thr_db=VO_LUFS - 4.0, ratio=2.2, att=.006, rel=.12, knee_db=6, return_gain=True)


def process_vo(x):
    m = x.mean(1)
    m = dsp.hp(m, 80)
    m = m * undb(VO_LUFS - _lufs_mono(m))
    m, gr = comp(m)
    return m * undb(VO_LUFS - _lufs_mono(m)), gr


def process_sp(x):
    m = x.mean(1)
    m = dsp.butter(m, 'hp', 90, 2)
    m = dsp.biquad(m, 'peak', 1300, 1.0, -2.0)
    m = dsp.biquad(m, 'peak', 5000, .8, 2.0)
    m = dsp.butter(m, 'lp', 15000, 2)
    m = m * undb(VO_LUFS - _lufs_mono(m))
    m, gr = comp(m)
    return m, gr


def seg_lufs(x, s): return _lufs_mono(x[ns(s['start']):ns(s['end'])])


# ============================================================================ ducking
def duck_db(depth_offset=0.0, hits=(), extra=None):
    """Gain curve (dB, per sample): DUCK_DB[kind] + offset during each segment, gaps < MERGE_GAP bridged at the
    shallower of the two depths, look-ahead + attack before speech, release after it."""
    step = .001
    tt = np.arange(0, DUR, step)
    extra = extra or {}
    iv = sorted((s['start'] - LOOKAHEAD, s['end'] + HOLD, min(0.0, DUCK_DB[s['kind']] + depth_offset - extra.get(s['id'], 0.0)))
                for s in SEGS)
    tgt = np.zeros_like(tt)
    for k, (a, b, d) in enumerate(iv):
        tgt[(tt >= a) & (tt < b)] = np.minimum(tgt[(tt >= a) & (tt < b)], d)
        if k + 1 < len(iv) and iv[k + 1][0] - b < MERGE_GAP:
            m = (tt >= b) & (tt < iv[k + 1][0])
            tgt[m] = max(d, iv[k + 1][2])
    for h in hits:
        m = (tt >= h - .02) & (tt < h + .3)
        tgt[m] = np.maximum(tgt[m], HIT_DUCK_CAP_DB)
    g = dsp.smooth_gain_db(tgt, ATTACK / 3, RELEASE / 3, step)
    return np.interp(np.arange(N) / SR, tt, g)


def split3(x, f1=250.0, f2=4500.0):
    low, rest = dsp.zp_split(x, f1, 2)
    mid, high = dsp.zp_split(rest, f2, 2)
    return low, mid, high


# ============================================================================ mix
def _ffmpeg_measure(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true:framelog=quiet',
                        '-f', 'null', '-'], capture_output=True, text=True)
    t = r.stderr
    f = lambda pat: float(re.findall(pat, t)[-1])
    return {'I': f(r'I:\s+(-?[\d.]+) LUFS'), 'LRA': f(r'LRA:\s+(-?[\d.]+) LU'), 'TP': f(r'Peak:\s+(-?[\d.]+) dBFS')}


def mix(voice_vo, voice_sp, music, sfx=None, hits_path=os.path.join(OUT, 'music_hits.json')):
    vo_in, sp_in, mu = _st(voice_vo), _st(voice_sp), _st(music)
    rep = {}
    # --- voice
    vo, gr_vo = process_vo(vo_in)
    sp, gr_sp = process_sp(sp_in)
    ref = float(np.median([seg_lufs(vo, s) for s in SEGS if s['kind'] == 'vo']))
    sp_gain = {s['id']: round(float(np.clip(ref - seg_lufs(sp, s), -8, 8)), 2) for s in SEGS if s['kind'] == 'sp'}
    sp = sp * _seg_gain_curve(sp_gain)
    v = vo + sp
    V = np.stack([v, v], 1)
    rep['sp_match_gain_db'] = sp_gain
    rep['comp_gr_db_p50_p95_max'] = {k: [round(float(np.percentile(-g[np.abs(x) > 1e-3], p)), 2) for p in (50, 95)] + [round(float(-g.min()), 2)]
                                     for k, g, x in (('vo', gr_vo, vo), ('sp', gr_sp, sp))}
    rep['seg_lufs'] = {s['id']: round(seg_lufs(v, s), 2) for s in SEGS}
    # --- music: level, 3-band duck
    hits = []
    if hits_path and os.path.exists(hits_path):
        hits = [h['t'] for h in json.load(open(hits_path)) if h['kind'].startswith('hit') or h['kind'] == 'final_chord']
    mu = mu * undb(MUSIC_LUFS - dsp.lufs_integrated(mu))
    bands = split3(mu)
    duck = lambda extra: sum(b * undb(duck_db(off, hits, extra))[:, None] for b, off in zip(bands, BAND_OFFSET_DB))
    mu_d = duck(None)
    # --- sfx: optional, levelled + lightly ducked
    fx_d = np.zeros((N, 2))
    if sfx is not None:
        fx = _st(sfx)
        L = dsp.lufs_integrated(fx)
        if np.isfinite(L):
            fx = fx * undb(SFX_LUFS - L)
            g = dsp.smooth_gain_db(np.where(_mask(pre=LOOKAHEAD, post=HOLD), SFX_DUCK_DB, 0.0)[::48], ATTACK / 3, RELEASE / 3, 48 / SR)
            fx_d = fx * undb(np.interp(np.arange(N), np.arange(0, N, 48)[:len(g)], g))[:, None]
            rep['sfx_gain_db'] = round(float(SFX_LUFS - L), 2)
    ride = {}                                                 # per-line rider (extra passes), only where needed;
    for _ in range(4):                                        # iterated: with sfx in the bed, -x dB of music < -x dB of bed
        more = False
        for s in SEGS:
            m = _seg_mask(s)
            lu = dsp.lufs_integrated(V, m) - dsp.lufs_integrated(mu_d + fx_d, m)
            want = min(RIDE_MAX_DB, ride.get(s['id'], 0.0) + (RIDE_MIN_LU[s['kind']] - lu) * 1.1)
            if lu < RIDE_MIN_LU[s['kind']] - .05 and want > ride.get(s['id'], 0.0) + .05:
                ride[s['id']] = round(float(want), 2); more = True
        if not more: break
        mu_d = duck(ride)
    rep['rider_extra_duck_db'] = ride
    stops = _music_stops()
    if stops:
        mu_d = mu_d * _stop_gain(stops)[:, None]
        rep['music_stops'] = stops
    bed = mu_d + fx_d
    # --- master
    y = V + bed
    y = dsp.compressor(y, thr_db=-18, ratio=1.8, att=.01, rel=.2, knee_db=6)
    for ceil in (CEIL_DBTP - .1, CEIL_DBTP - .15):
        y = y * undb(TARGET_LUFS - dsp.lufs_integrated(y))
        y, lg = dsp.limiter(y, ceiling_db=ceil)
    rep['limiter_gr_max_db'] = round(float(-db(lg.min())), 2)
    # --- measurements (pre-master components; master gain is common to both)
    for kind in ('vo', 'sp'):
        m = _mask((kind,))
        rep[f'voice_over_bed_LU_{kind}'] = round(float(dsp.lufs_integrated(V, m) - dsp.lufs_integrated(bed, m)), 2)
        rep[f'music_duck_realised_LU_{kind}'] = round(float(dsp.lufs_integrated(mu_d, m) - dsp.lufs_integrated(mu, m)), 2)
    rep['voice_over_bed_LU_per_segment'] = {s['id']: round(float(
        dsp.lufs_integrated(V, _seg_mask(s)) - dsp.lufs_integrated(bed, _seg_mask(s))), 1) for s in SEGS}
    rep['music_gap_LUFS_vs_speech'] = round(float(dsp.lufs_integrated(mu_d, ~_mask(pre=.3, post=.6)) - dsp.lufs_integrated(V, _mask())), 2)
    return y, rep


def _music_stops(path=os.path.join(OUT, 'sfx_report.json')):
    """[[t0, t1], ...] from lib/sfx.py (the `music_stop_beat` cue: music stops one beat)"""
    try: return [[float(a), float(b)] for a, b in json.load(open(path)).get('music_stops', []) if b > a]
    except (OSError, ValueError): return []


def _stop_gain(stops):
    g = np.zeros(N)
    for a, b in stops: g[ns(a):ns(b)] = MUSIC_STOP_DB
    lin = undb(g)
    for a, b in stops:                                        # short cos ramps: down at a, up at b
        i0, k0 = ns(a), max(1, ns(MUSIC_STOP_RAMPS[0])); i1, k1 = ns(b), max(1, ns(MUSIC_STOP_RAMPS[1]))
        dn = undb(MUSIC_STOP_DB) + (1 - undb(MUSIC_STOP_DB)) * np.cos(np.linspace(0, np.pi / 2, k0)) ** 2
        up = undb(MUSIC_STOP_DB) + (1 - undb(MUSIC_STOP_DB)) * np.sin(np.linspace(0, np.pi / 2, k1)) ** 2
        lin[i0:i0 + k0] = dn[:len(lin[i0:i0 + k0])]
        lin[i1:i1 + k1] = up[:len(lin[i1:i1 + k1])]
    return lin[:N]


def _seg_mask(s):
    m = np.zeros(N, bool); m[ns(s['start']):ns(s['end'])] = True
    return m


def asr_check(path, t0=52.0, t1=65.0):
    import scipy.signal as sps
    from faster_whisper import WhisperModel
    x = dsp.load(path)[ns(t0):ns(t1)].mean(1)
    x16 = sps.resample_poly(x, 1, 3).astype(np.float32)
    model = WhisperModel('large-v3', device='cpu', compute_type='int8', cpu_threads=2)
    segs, _ = model.transcribe(x16, language='fr', beam_size=5, vad_filter=False, word_timestamps=False)
    out = [(round(t0 + s.start, 2), round(t0 + s.end, 2), s.text.strip()) for s in segs]
    return out


def main():
    sfx_path = os.path.join(OUT, 'sfx.wav')
    sfx = sfx_path if os.path.exists(sfx_path) else None
    y, rep = mix(os.path.join(X, 'audio', 'voice_vo.wav'), os.path.join(X, 'audio', 'voice_sp.wav'),
                 os.path.join(OUT, 'music.wav'), sfx)
    path = os.path.join(OUT, 'final_mix.wav')
    dsp.save(path, y, 'PCM_24')
    ff = _ffmpeg_measure(path)
    if ff['TP'] > CEIL_DBTP:                                  # safety: never ship above the ceiling
        y = y * undb(CEIL_DBTP - .05 - ff['TP']); dsp.save(path, y, 'PCM_24'); ff = _ffmpeg_measure(path)
    rep.update({'sfx': 'out/sfx.wav' if sfx else None, 'internal_LUFS': round(float(dsp.lufs_integrated(y)), 2),
                'ffmpeg_I_LUFS': ff['I'], 'ffmpeg_true_peak_dBTP': ff['TP'], 'ffmpeg_LRA': ff['LRA'],
                'sample_peak_dBFS': round(float(db(np.abs(y).max())), 2), 'duration_s': len(y) / SR})
    json.dump(rep, open(os.path.join(OUT, 'mix_report.json'), 'w'), indent=1)
    print(f"final_mix.wav  {rep['duration_s']:.3f} s  |  LUFS {ff['I']} (internal {rep['internal_LUFS']})  |  true peak {ff['TP']} dBTP"
          f"  |  sample peak {rep['sample_peak_dBFS']} dBFS  |  LRA {ff['LRA']} LU  |  sfx: {rep['sfx']}")
    print(f"voice-over-bed during speech: vo {rep['voice_over_bed_LU_vo']} LU, sp {rep['voice_over_bed_LU_sp']} LU"
          f"  (music duck realised: vo {rep['music_duck_realised_LU_vo']} LU, sp {rep['music_duck_realised_LU_sp']} LU)")
    print('per segment:', rep['voice_over_bed_LU_per_segment'])
    print('sp match gain dB:', rep['sp_match_gain_db'], '| comp GR p50/p95/max:', rep['comp_gr_db_p50_p95_max'],
          '| rider', rep['rider_extra_duck_db'], '| limiter GR max', rep['limiter_gr_max_db'], '| music in gaps vs speech', rep['music_gap_LUFS_vs_speech'], 'LU')
    if '--asr' in sys.argv:
        for a, b, t in asr_check(path): print(f'ASR {a:6.2f}-{b:6.2f}  {t}')


if __name__ == '__main__':
    main()
