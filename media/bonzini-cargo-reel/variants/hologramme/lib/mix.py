"""Final mix: voice + (multiband-ducked) music + (ducked) SFX -> glue -> -14 LUFS / <= -1 dBTP.

Inputs  out/voice.wav (voice builder; provisional fallback built from audio/{B,A}_dfn.wav if absent)
        out/music.wav, out/sfx.wav (lib/music.py, lib/sfx.py)
        data/voice_activity.json (optional; else speech is detected from the voice envelope)
Output  out/final_mix.wav (48 kHz stereo PCM 24-bit, exactly 45.000 s)
        out/audio_report/final_mix.png, mix_report.json, loudness logs

Run:  nice -n 5 python3 lib/mix.py
"""
import os, sys, json, re, subprocess
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import dsp
from dsp import SR, N, undb, db

R = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))      # this variant's root
S = '/tmp/claude-0/-home-user-bonzinilabs/5fd5d24c-f443-5c7d-8c0d-137b9d5733f0/scratchpad'
VOICE = os.path.join(S, 'reel', 'out', 'voice.wav')                  # shared clean voice (v1 timeline)
OUT = os.path.join(R, 'out')
REP = os.path.join(OUT, 'audio_report')
T = np.arange(N) / SR

DUCK_MUSIC_DB = -9.0          # broadband equivalent; split per band below
BAND_SCALE = (0.7, 1.2, 0.8)  # low (<200 Hz) / mid (200 Hz-4 kHz, the voice band) / high
DUCK_SFX_DB = -3.0
ATTACK, RELEASE = 0.080, 0.450
LOOKAHEAD = 0.06              # music starts dipping just before the first syllable
MERGE_GAP = 0.30              # don't let the music bob up between words
VOICE_OVER_MUSIC_LU = 11.0    # target: voice ~10 LU above the ducked music during speech
IMPACTS = (0.0, 16.0, 40.0)   # let the big hits through: duck limited to -3 dB for 0.3 s
TARGET_LUFS, CEIL_DBTP = -14.0, -1.0


# ----------------------------------------------------------------------------- inputs
def load_voice():
    p = VOICE
    if os.path.exists(p):
        return dsp.load(p, N), 'reel/out/voice.wav (shared)'
    print('!! out/voice.wav missing -> provisional voice from audio/*_dfn.wav')
    v = np.zeros((N, 2))
    b = dsp.load(os.path.join(S, 'audio', 'B_dfn.wav'))[:dsp.ns(16.0)]
    a = dsp.load(os.path.join(S, 'audio', 'A_dfn.wav'))[:dsp.ns(25.92)]
    b = dsp.fade(b, 0.01, 0.03)
    a = dsp.fade(a, 0.01, 0.03)
    dsp.add_at(v, b, 0.0)
    dsp.add_at(v, a, 16.0)
    v = dsp.butter(v, 'hp', 80, 2)
    v *= undb(-16.0 - dsp.lufs_integrated(v))
    return v, 'provisional (audio/B_dfn + audio/A_dfn)'


def speech_intervals(voice):
    p = os.path.join(R, 'data', 'voice_activity.json')
    if os.path.exists(p):
        d = json.load(open(p))
        iv = d.get('intervals') or d.get('segments') or d.get('speech') or d
        out = []
        for s in iv:
            if isinstance(s, dict):
                out.append((float(s.get('s', s.get('start'))), float(s.get('e', s.get('end')))))
            else:
                out.append((float(s[0]), float(s[1])))
        return out, 'data/voice_activity.json'
    # fallback: envelope detector (20 ms RMS, threshold 22 dB under the speech level)
    m = dsp.butter(voice.mean(axis=1), 'bp', [150, 4000], 2)
    hop = int(0.01 * SR)
    e = np.sqrt(np.convolve(m ** 2, np.ones(2 * hop) / (2 * hop), 'same'))[::hop]
    ed = db(e)
    thr = np.percentile(ed[ed > -80], 90) - 22
    act = ed > thr
    out, on = [], None
    for i, a in enumerate(act):
        t = i * 0.01
        if a and on is None:
            on = t
        if not a and on is not None:
            if t - on > 0.08:
                out.append((on, t))
            on = None
    if on is not None:
        out.append((on, N / SR))
    return out, 'envelope detector'


def merge(iv, gap):
    iv = sorted(iv)
    out = [list(iv[0])]
    for s, e in iv[1:]:
        if s - out[-1][1] < gap and not (out[-1][1] < 16.0 <= s):   # never bridge the 16.0 cut
            out[-1][1] = max(out[-1][1], e)
        else:
            out.append([s, e])
    return [tuple(x) for x in out]


# ----------------------------------------------------------------------------- ducking
def duck_curve(iv, depth_db):
    """Per-sample gain (dB): depth during speech, 80 ms attack / 450 ms release, lookahead."""
    step = 0.001
    tt = np.arange(0, N / SR, step)
    tgt = np.zeros_like(tt)
    for s, e in iv:
        tgt[(tt >= s - LOOKAHEAD) & (tt < e)] = depth_db
    for ti in IMPACTS:                                   # let the three big hits breathe
        m = (tt >= ti - 0.02) & (tt < ti + 0.30)
        tgt[m] = np.maximum(tgt[m], -3.0)
    g = dsp.smooth_gain_db(tgt, ATTACK / 3.0, RELEASE / 3.0, step)   # ~time-to-95% = 3 tau... use tau=T/3
    return np.interp(T, tt, g)


def split3(x, f1=200.0, f2=4000.0):
    """Perfect-reconstruction 3-band split (complementary subtraction)."""
    low = dsp.butter(dsp.butter(x, 'lp', f1, 2), 'lp', f1, 2)       # LR4-style low band
    rest = x - low
    mid = dsp.butter(dsp.butter(rest, 'lp', f2, 2), 'lp', f2, 2)
    high = rest - mid
    return low, mid, high


# ----------------------------------------------------------------------------- measurement
def ffmpeg_measure(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true:framelog=quiet',
                        '-f', 'null', '-'], capture_output=True, text=True)
    txt = r.stderr
    I = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', txt)[-1])
    LRA = float(re.findall(r'LRA:\s+(-?[\d.]+) LU', txt)[-1])
    TP = float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', txt)[-1])
    r2 = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af',
                         'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-f', 'null', '-'],
                        capture_output=True, text=True)
    js = json.loads(r2.stderr[r2.stderr.rindex('{'):r2.stderr.rindex('}') + 1])
    return {'ebur128_I_LUFS': I, 'ebur128_LRA_LU': LRA, 'ebur128_truepeak_dBTP': TP,
            'loudnorm_input_i': float(js['input_i']), 'loudnorm_input_tp': float(js['input_tp']),
            'loudnorm_input_lra': float(js['input_lra'])}


def main():
    os.makedirs(REP, exist_ok=True)
    voice, vsrc = load_voice()
    music = dsp.load(os.path.join(OUT, 'music.wav'), N)
    sfx = dsp.load(os.path.join(OUT, 'sfx.wav'), N)
    iv_raw, ivsrc = speech_intervals(voice)
    iv = merge(iv_raw, MERGE_GAP)
    speech = np.zeros(N, bool)
    for s, e in iv:
        speech[(T >= s) & (T < e)] = True
    print(f'voice: {vsrc}; speech: {ivsrc}; {len(iv)} intervals')

    # --- music: multiband duck
    g_db = duck_curve(iv, DUCK_MUSIC_DB)                    # broadband reference curve (<= 0)
    lo, mi, hi = split3(music)
    bands = [b * undb(g_db * k)[:, None] for b, k in zip((lo, mi, hi), BAND_SCALE)]
    music_d = bands[0] + bands[1] + bands[2]

    # --- level music so voice sits ~10 LU above the ducked music during speech
    Lv = dsp.lufs_integrated(voice, speech)
    Lmd = dsp.lufs_integrated(music_d, speech)
    g_music = Lv - VOICE_OVER_MUSIC_LU - Lmd
    music_d *= undb(g_music)

    # --- sfx: -3 dB under speech; the drop impact peaks ~1.5 LU over the voice (momentary)
    g_sfx_curve = undb(duck_curve(iv, DUCK_SFX_DB))[:, None]
    tm, M = dsp.lufs_momentary(sfx, 0.02)
    imp = M[(tm > 15.95) & (tm < 16.5)].max()
    g_sfx = (Lv + 1.5) - imp
    sfx_d = sfx * undb(g_sfx) * g_sfx_curve

    mix = dsp.dc_block(voice + music_d + sfx_d, 10.0)
    # --- master: gentle glue, loudness, true-peak limiter (iterate to land on -14.0)
    mix *= undb(TARGET_LUFS - dsp.lufs_integrated(mix))
    mix, glue_gr = dsp.compressor(mix, thr_db=-17.0, ratio=1.5, att=0.03, rel=0.25, knee_db=8,
                                  detector='rms', rms_win=0.05, return_gain=True)
    gain = TARGET_LUFS - dsp.lufs_integrated(mix)
    for it in range(4):
        y, lim_g = dsp.limiter(mix * undb(gain), CEIL_DBTP - 0.3, 0.004, 0.10)
        L = dsp.lufs_integrated(y)
        if abs(L - TARGET_LUFS) < 0.05:
            break
        gain += TARGET_LUFS - L
    y = y[:N]
    path = os.path.join(OUT, 'final_mix.wav')
    dsp.save(path, y, 'PCM_24')

    # ------------------------------------------------------------------ report
    meas = ffmpeg_measure(path)
    vol = lambda x, m: round(float(dsp.lufs_integrated(x, m)), 2)
    gap = ~speech & (T > 0.5) & (T < 43.5)
    per = {}
    master_g = undb(gain)
    for a, b, nm in [(0, 4, 'intro'), (4, 16, 'B groove'), (16, 24, 'drop'), (24, 32, 'var A'), (32, 39.2, 'var B/merci')]:
        m = speech & (T >= a) & (T < b)
        per[nm] = round(vol(voice, m) - vol(music_d, m), 1)
    rep = {
        'voice_source': vsrc, 'speech_source': ivsrc, 'speech_intervals_merged': [(round(s, 2), round(e, 2)) for s, e in iv],
        'duck_music_db': DUCK_MUSIC_DB, 'duck_band_db': [round(DUCK_MUSIC_DB * k, 1) for k in BAND_SCALE],
        'duck_sfx_db': DUCK_SFX_DB, 'attack_s': ATTACK, 'release_s': RELEASE,
        'music_gain_db': round(float(g_music), 2), 'sfx_gain_db': round(float(g_sfx), 2),
        'voice_lufs_speech': round(float(Lv), 2),
        'voice_minus_ducked_music_LU_overall': round(float(Lv - vol(music_d, speech)), 2),
        'voice_minus_ducked_music_LU_by_section': per,
        'music_in_gaps_lufs_premaster': vol(music_d, gap),
        'glue_gr_db_p50_p95_max': [round(float(np.percentile(-glue_gr, 50)), 2), round(float(np.percentile(-glue_gr, 95)), 2), round(float(-glue_gr.min()), 2)],
        'limiter_gr_db_max': round(float(-db(lim_g.min())), 2),
        'limiter_gr_over_1db_pct': round(float(100 * np.mean(lim_g < undb(-1))), 2),
        'master_gain_db': round(float(gain), 2),
        'python_lufs': round(float(dsp.lufs_integrated(y)), 2),
        'python_truepeak_dbtp_4x': round(float(db(dsp.true_peak_env(y).max())), 2),
        'dc_offset': [float(y[:, 0].mean()), float(y[:, 1].mean())],
        'samples': int(len(y)), 'duration_s': len(y) / SR,
        'ffmpeg': meas,
    }
    # per-cue audibility: SFX momentary max vs the ducked music / voice around it (post master gain)
    cf = os.path.join(REP, 'sfx_cues.json')
    if os.path.exists(cf):
        tmv, Mv = dsp.lufs_momentary(voice * master_g, 0.02)
        tmm, Mm = dsp.lufs_momentary(music_d * master_g, 0.02)
        tms, Ms = dsp.lufs_momentary(sfx_d * master_g, 0.02)
        rows = []
        for t, name in json.load(open(cf))['cues']:
            w = lambda tm, M: float(M[(tm >= t) & (tm < t + 0.4)].max())
            rows.append((t, name, round(w(tms, Ms), 1), round(w(tmm, Mm), 1), round(w(tmv, Mv), 1)))
        rep['sfx_cue_momentary_LUFS__t_name_sfx_music_voice'] = rows
    json.dump(rep, open(os.path.join(REP, 'mix_report.json'), 'w'), indent=1)
    print(json.dumps(rep, indent=1))

    # plots: final mix with speech bands + per-stem short-term loudness (post master gain)
    vt, vL = dsp.lufs_shortterm(voice * master_g, 0.05)
    mt, mL = dsp.lufs_shortterm(music_d * master_g, 0.05)
    st, sL = dsp.lufs_shortterm(sfx_d * master_g, 0.05)
    marks = [(0.0, 'IMPACT'), (3.62, 'wire'), (7.7, 'chime'), (12.0, 'whip'), (16.0, 'DROP/REBUILD'),
             (22.95, 'check'), (26.2, 'sonar'), (38.0, 'brkdn'), (40.0, 'IMPACT/HOLO'), (41.4, 'bloom'), (43.5, 'fade')]
    secs = [(s, e, 'voice') for s, e in iv]
    dsp.report_png(os.path.join(REP, 'final_mix.png'), y, 'final_mix.wav  (+ white=voice ST, violet=ducked music ST, green=sfx ST)',
                   marks, secs, extra_curves=[(vt, vL, (255, 255, 255)), (mt, mL, (190, 120, 255)), (st, sL, (80, 220, 120))])
    # ffmpeg reference pictures too
    for name in ('music', 'sfx', 'final_mix'):
        src = os.path.join(OUT, name + '.wav')
        subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-lavfi',
                        'showspectrumpic=s=1600x600:legend=1:fscale=log:color=magma:scale=log', os.path.join(REP, f'{name}_ffspec.png')])
        subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-lavfi',
                        'showwavespic=s=1600x300:split_channels=1:colors=#62F1FF|#F3A745', os.path.join(REP, f'{name}_wave.png')])


if __name__ == '__main__':
    main()
