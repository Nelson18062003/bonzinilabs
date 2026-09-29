"""Final mix: polished voice + multiband-ducked music + ducked SFX -> glue -> -14 LUFS / <= -1 dBTP.

Inputs   audio/voice_track.wav (narrator + team quotes, placed by lib/build_timeline.py)
         out/music.wav, out/sfx.wav (lib/audio/music.py, lib/audio/sfx.py)
         data/timeline.json (segments -> voice polish per kind, `speech` -> ducking, chapters -> report)
Output   out/final_mix.wav (48 kHz stereo PCM 24-bit, exactly timeline.duration)
         out/audio_report/{final_mix*.png, mix_report.json, alignment.txt, *_ffspec.png, *_wave.png}

Run:     nice -n 5 python3 lib/audio/mix.py --all     (music + sfx + mix, all from the timeline)
         nice -n 5 python3 lib/audio/mix.py           (mix only, reuses out/music.wav + out/sfx.wav)
         [--timeline f.json --voice v.wav --out dir]   (dry runs against another timeline)
"""
import os, sys, json, re, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np
import scipy.signal as sps
import dsp
import tl as tlmod
from dsp import SR, ns, undb, db

E = tlmod.E
OUT = os.path.join(E, 'out')
REP = os.path.join(OUT, 'audio_report')
VOICE = os.path.join(E, 'audio', 'voice_track.wav')

DUCK_BANDS_DB = (-6.0, -10.0, -7.0)   # music duck under speech: <200 Hz / 200 Hz-4 kHz (voice band) / >4 kHz
DUCK_SFX_DB = -3.0
ATTACK, RELEASE, LOOKAHEAD = 0.080, 0.450, 0.080
MERGE_GAP = 0.75                      # don't let the music bob up between sentences of one chapter
HIT_DUCK_LIMIT_DB = (-2.0, -5.0, -4.0)  # at the big hits, cap the duck for 0.3 s so they land
VOICE_OVER_MUSIC_LU = 11.0            # voice ~11 LU above the ducked music during speech
RIDE_LU = (10.0, 12.5)                # per-chapter rider keeps voice - ducked music inside this window
SFX_TOP_OVER_VOICE_LU = 0.0           # loudest SFX (final logo impact, momentary) vs the voice's speech loudness
SEG_LUFS = -16.0                      # every voice segment is levelled to this before bus compression
TARGET_LUFS, CEIL_DBTP = -14.0, -1.0


# ============================================================================ voice polish
def seg_mask(tl, N, kind, ramp=0.02):
    """Smooth 0..1 mask over the segments of one kind (ramps sit in the silence around them)."""
    m = np.zeros(N)
    for s in tl.segments:
        if s['kind'] != kind:
            continue
        a, b = ns(max(0.0, s['start'] - 0.05)), ns(min(tl.duration, s['end'] + 0.12))
        m[a:b] = 1.0
    k = max(1, ns(ramp))
    return np.convolve(m, np.ones(k) / k, 'same')


def deesser(x, f_split=6000.0, thr_db=-8.0, ratio=3.0, max_red_db=6.0):
    """Split-band de-esser: reduce the >6 kHz band when it gets loud relative to the full signal."""
    lo, hi = dsp.zp_split(x, f_split, 3)
    env = lambda y: np.sqrt(np.maximum(dsp.onepole_lp(y ** 2, 1 / (2 * np.pi * 0.004)), 1e-12))
    rel = db(env(hi)) - db(env(x))
    red = np.clip((rel - thr_db) * (1 - 1 / ratio), 0, max_red_db)
    red = dsp.smooth_gain_db(-red[::48], 0.002, 0.06, 48 / SR)
    g = undb(np.interp(np.arange(len(x)), np.arange(0, len(x), 48)[:len(red)], red))
    return lo + hi * g, float(-red.min())


def polish_voice(tl, v):
    """Gentle, cohesive treatment: per-kind EQ (synthetic VO vs real team quotes), per-segment levelling,
    2:1 bus compression, soft peak control. Returns mono voice + stats."""
    N = len(v)
    x = v.mean(axis=1)
    x = dsp.butter(x, 'hp', 70, 2)
    # --- per-segment levelling (loudness-matched segments before any dynamics)
    gains = {}
    for s in tl.segments:
        a, b = ns(s['start']), ns(s['end'])
        L = dsp.lufs_integrated(x[a:b]) - 3.01
        if np.isfinite(L):
            g = float(np.clip(SEG_LUFS - L, -6, 6))
            gains[s['id']] = round(g, 2)
            x[max(0, a - ns(0.03)):min(N, b + ns(0.1))] *= undb(g)
    # --- VO (Kokoro): de-ess the 8-11 kHz sibilance, a little presence, soften the top
    vo = x.copy()
    vo = dsp.biquad(vo, 'peak', 3000, 0.8, 2.5)
    vo = dsp.biquad(vo, 'hs', 9000, 0.7, -1.0)
    vo, ds_red = deesser(vo, 6000, -12.0, 4.0, 9.0)
    vo = dsp.biquad(vo, 'peak', 180, 1.0, -1.0)
    # --- team quotes (real, denoised): tame the forward 1.3 kHz, open the top a little, clean the lows
    sp = dsp.butter(x, 'hp', 90, 2)
    sp = dsp.biquad(sp, 'peak', 1300, 1.0, -1.5)
    sp = dsp.biquad(sp, 'peak', 5000, 0.8, 2.0)
    sp = dsp.butter(sp, 'lp', 15000, 2)
    mv, ms = seg_mask(tl, N, 'vo'), seg_mask(tl, N, 'sp')
    rest = np.clip(1 - mv - ms, 0, 1)
    y = vo * mv + sp * ms + x * rest
    # --- gentle bus compression (2:1, ~2-4 dB on the louder syllables) + soft peak control
    y, gr = dsp.compressor(y, thr_db=SEG_LUFS - 3.0, ratio=2.0, att=0.006, rel=0.12, knee_db=8,
                           detector='rms', rms_win=0.01, return_gain=True)
    # re-level each segment after the dynamics (quotes compress less than the VO): +-1.5 dB max,
    # relative to the median segment so the whole narration stays one consistent level
    post, Ls = {}, {}
    for s in tl.segments:
        a, b = ns(s['start']), ns(s['end'])
        L = dsp.lufs_integrated(y[a:b])
        if np.isfinite(L):
            Ls[s['id']] = (a, b, L)
    ref = float(np.median([v[2] for v in Ls.values()])) if Ls else 0.0
    for sid, (a, b, L) in Ls.items():
        g = float(np.clip(ref - L, -1.5, 1.5))
        post[sid] = round(g, 2)
        y[max(0, a - ns(0.03)):min(N, b + ns(0.1))] *= undb(g)
    y = y * undb(SEG_LUFS - dsp.lufs_integrated(np.stack([y, y], 1)))
    ceiling = SEG_LUFS + 13.0                          # peak-to-loudness ratio kept <= 13 dB
    ys, lg = dsp.limiter(np.stack([y, y], 1), ceiling, 0.003, 0.06)
    stats = {'segment_gain_db': gains, 'segment_post_gain_db': post, 'deesser_max_red_db': round(ds_red, 1),
             'comp_gr_db_p50_p95_max': [round(float(np.percentile(-gr[np.abs(y) > 1e-4], 50)), 2),
                                        round(float(np.percentile(-gr[np.abs(y) > 1e-4], 95)), 2), round(float(-gr.min()), 2)],
             'peak_limiter_gr_max_db': round(float(-db(lg.min())), 2),
             'peak_limiter_gr_over_1db_pct_of_speech': round(float(100 * np.mean(lg[(mv + ms) > 0.5] < undb(-1))), 3)}
    return ys, stats


# ============================================================================ ducking
def merge(iv, gap):
    iv = sorted(iv)
    out = [list(iv[0])]
    for s, e in iv[1:]:
        if s - out[-1][1] < gap:
            out[-1][1] = max(out[-1][1], e)
        else:
            out.append([s, e])
    return [tuple(x) for x in out]


def duck_curve(N, iv, depth_db, hits=(), hit_limit=None):
    """Per-sample gain (dB): depth during speech; 80 ms attack / 450 ms release (to ~95 %), lookahead."""
    step = 0.001
    T = np.arange(N) / SR
    tt = np.arange(0, N / SR, step)
    tgt = np.zeros_like(tt)
    for s, e in iv:
        tgt[(tt >= s - LOOKAHEAD) & (tt < e)] = depth_db
    if hit_limit is not None:
        for h in hits:
            m = (tt >= h - 0.02) & (tt < h + 0.30)
            tgt[m] = np.maximum(tgt[m], hit_limit)
    g = dsp.smooth_gain_db(tgt, ATTACK / 3.0, RELEASE / 3.0, step)
    return np.interp(T, tt, g)


def split3(x, f1=200.0, f2=4000.0):
    """Zero-phase 3-band split (low + mid + high == x exactly, no phase rotation between bands)."""
    low, rest = dsp.zp_split(x, f1, 2)
    mid, high = dsp.zp_split(rest, f2, 2)
    return low, mid, high


# ============================================================================ measurement / report
def ffmpeg_measure(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true:framelog=quiet',
                        '-f', 'null', '-'], capture_output=True, text=True)
    txt = r.stderr
    I = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', txt)[-1])
    LRA = float(re.findall(r'LRA:\s+(-?[\d.]+) LU', txt)[-1])
    TP = float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', txt)[-1])
    return {'ebur128_I_LUFS': I, 'ebur128_LRA_LU': LRA, 'ebur128_truepeak_dBTP': TP}


def onset_env(x, hop=240, nfft=1024):
    m = dsp.stereo(x).mean(axis=1)
    _, t, Z = sps.stft(m, SR, nperseg=nfft, noverlap=nfft - hop, boundary=None, padded=False)
    M = np.log1p(1000 * np.abs(Z))
    flux = np.maximum(0, np.diff(M, axis=1)).sum(axis=0)
    tt = t[1:] + 0.0045                                 # frame centre -> onset time (calibrated on a click / the kick)
    return tt, flux


def nearest_onset(tt, flux, t, pre=0.04, post=0.10):
    """Strongest onset in [t - pre, t + post] (hits land ON the event; risers/whooshes lead into it)."""
    m = (tt >= t - pre) & (tt <= t + post)
    if not m.any():
        return None, 0.0
    i = np.argmax(np.where(m, flux, -1))
    ctx = (tt >= t - 1.0) & (tt <= t + 1.0)
    prom = flux[i] / (np.median(flux[ctx]) + 1e-9)
    return float(tt[i]), float(prom)


def alignment_table(tl, music, sfx, cues, logo, hit):
    mt, mf = onset_env(music)
    st, sf_ = onset_env(sfx)
    rows = []
    ev = [(c['start'], f"chapter {c['id']}" + (f" « {c['title']} »" if c.get('title') else '')) for c in tl.chapters]
    ev += [(c['start'] + 0.15, f"title slam {c['id']}") for c in tl.chapters if c.get('num')]
    if logo is not None:
        ev.append((logo, 'logo lock (brand, Bonzini)'))
    if hit is not None:
        ev.append((hit, 'final hit (V11 start)'))
    ev.sort()
    lines = [f"{'t (s)':>8}  {'event':34s} {'on beat':>7} {'music onset':>12} {'Δms':>6} {'prom':>5}  {'sfx onset':>10} {'Δms':>6} {'prom':>5}"]
    for t, name in ev:
        a, pa = nearest_onset(mt, mf, t) if not name.startswith('title') else (None, 0.0)
        b, pb = nearest_onset(st, sf_, t)
        f = lambda v: f'{v:12.3f}' if v is not None else f"{'-':>12}"
        d = lambda v: f'{1000 * (v - t):6.0f}' if v is not None else f"{'-':>6}"
        ob = 'yes' if tl.on_grid(t) else 'no'
        lines.append(f'{t:8.3f}  {name[:34]:34s} {ob:>7} {f(a)} {d(a)} {pa:5.1f}  {f(b)[2:]} {d(b)} {pb:5.1f}')
        rows.append({'t': t, 'event': name, 'on_beat': tl.on_grid(t), 'music_onset': a, 'music_prom': round(pa, 1),
                     'sfx_onset': b, 'sfx_prom': round(pb, 1)})
    return '\n'.join(lines), rows


# ============================================================================ main
def main(tl=None):
    tl = tl or tlmod.load()
    os.makedirs(REP, exist_ok=True)
    N = ns(tl.duration)
    T = np.arange(N) / SR
    voice_raw = dsp.load(VOICE, N)
    voice, vstats = polish_voice(tl, voice_raw)
    music = dsp.load(os.path.join(OUT, 'music.wav'), N)
    sfx = dsp.load(os.path.join(OUT, 'sfx.wav'), N)
    minfo = json.load(open(os.path.join(REP, 'music_info.json'))) if os.path.exists(os.path.join(REP, 'music_info.json')) else {}
    cues = json.load(open(os.path.join(REP, 'sfx_cues.json')))['cues'] if os.path.exists(os.path.join(REP, 'sfx_cues.json')) else []
    logo, fhit = minfo.get('logo_hit'), minfo.get('final_hit')
    if abs(minfo.get('duration_s', tl.duration) - tl.duration) > 1e-3:
        print('!! music.wav was rendered for another timeline — run with --all')

    iv = merge(tl.speech, MERGE_GAP)
    speech = np.zeros(N, bool)
    for s, e in iv:
        speech[ns(s):ns(e)] = True
    hits = [0.0] + [h for h in (logo, fhit) if h is not None]

    # --- music: 3-band duck under speech (voice band deepest), the big hits let through
    lo, mi, hi = split3(music)
    curves = [duck_curve(N, iv, d, hits, lim) for d, lim in zip(DUCK_BANDS_DB, HIT_DUCK_LIMIT_DB)]
    music_d = sum(b * undb(c)[:, None] for b, c in zip((lo, mi, hi), curves))
    Lv = dsp.lufs_integrated(voice, speech)
    g_music = Lv - VOICE_OVER_MUSIC_LU - dsp.lufs_integrated(music_d, speech)
    music_d *= undb(g_music)
    # --- per-chapter rider: pull any chapter whose voice/music ratio leaves RIDE_LU back inside it
    trims, pts = {}, []
    for c in tl.chapters:
        m = speech & (T >= c['start']) & (T < c['end'])
        tr = 0.0
        if m.sum() > ns(1.0):
            d = dsp.lufs_integrated(voice, m) - dsp.lufs_integrated(music_d, m)
            tr = (d - RIDE_LU[0]) if d < RIDE_LU[0] else (min(2.0, d - RIDE_LU[1]) if d > RIDE_LU[1] else 0.0)
        trims[c['id']] = round(float(tr), 2)
        pts += [(max(0.0, c['start'] - 0.3), None), (c['start'], tr)]
    tv, last = [], trims[tl.chapters[0]['id']]
    for t, v in pts:
        tv.append((t, last if v is None else v))
        if v is not None:
            last = v
    ride = np.interp(T, [p[0] for p in tv] + [tl.duration], [p[1] for p in tv] + [last])
    music_d *= undb(ride)[:, None]

    # --- sfx: -3 dB under speech; level so the final logo impact peaks (momentary) at the voice level
    sfx_curve = undb(duck_curve(N, iv, DUCK_SFX_DB, hits, -1.0))[:, None]
    sfx_d = sfx * sfx_curve
    tm, M = dsp.lufs_momentary(sfx_d, 0.02)
    top_t = fhit if fhit is not None else float(tm[np.argmax(M)])
    top = M[(tm > top_t - 0.1) & (tm < top_t + 0.6)].max()
    g_sfx = (Lv + SFX_TOP_OVER_VOICE_LU) - top
    sfx_d *= undb(g_sfx)

    mix = dsp.dc_block(voice + music_d + sfx_d, 10.0)
    # --- master: glue, loudness, true-peak limiter (iterate to land on -14.0 LUFS)
    mix *= undb(TARGET_LUFS - dsp.lufs_integrated(mix))
    mix, glue_gr = dsp.compressor(mix, thr_db=-17.0, ratio=1.5, att=0.03, rel=0.25, knee_db=8,
                                  detector='rms', rms_win=0.05, return_gain=True)
    gain = TARGET_LUFS - dsp.lufs_integrated(mix)
    for _ in range(5):
        y, lim_g = dsp.limiter(mix * undb(gain), CEIL_DBTP - 0.35, 0.004, 0.10)
        L = dsp.lufs_integrated(y)
        if abs(L - TARGET_LUFS) < 0.03:
            break
        gain += TARGET_LUFS - L
    y = y[:N]
    y[-1] = 0.0
    path = os.path.join(OUT, 'final_mix.wav')
    dsp.save(path, y, 'PCM_24')

    # ------------------------------------------------------------------ report
    meas = ffmpeg_measure(path)
    mg = undb(gain)
    vol = lambda x, m: round(float(dsp.lufs_integrated(x, m)), 1)
    per = []
    for c in tl.chapters:
        m = speech & (T >= c['start']) & (T < c['end'])
        g = ~speech & (T >= c['start']) & (T < c['end'])
        per.append({'chapter': c['id'], 'voice_minus_ducked_music_LU': round(vol(voice, m) - vol(music_d, m), 1) if m.any() else None,
                    'music_gap_lufs_post_master': vol(music_d * mg, g) if g.sum() > ns(0.5) else None})
    rep = {
        'timeline': tl.path, 'duration_s': tl.duration, 'samples': int(len(y)), 'bpm': tl.bpm,
        'speech_intervals_merged': [(round(s, 2), round(e, 2)) for s, e in iv],
        'duck_music_db_low_mid_high': DUCK_BANDS_DB, 'duck_sfx_db': DUCK_SFX_DB,
        'attack_s': ATTACK, 'release_s': RELEASE, 'lookahead_s': LOOKAHEAD, 'hits_let_through': hits,
        'voice_polish': vstats,
        'music_gain_db': round(float(g_music), 2), 'music_rider_trim_db': trims, 'sfx_gain_db': round(float(g_sfx), 2),
        'voice_lufs_speech_premaster': round(float(Lv), 2),
        'voice_minus_ducked_music_LU_overall': round(float(Lv - dsp.lufs_integrated(music_d, speech)), 2),
        'per_chapter': per,
        'glue_gr_db_p50_p95_max': [round(float(np.percentile(-glue_gr, 50)), 2), round(float(np.percentile(-glue_gr, 95)), 2), round(float(-glue_gr.min()), 2)],
        'limiter_gr_db_max': round(float(-db(lim_g.min())), 2),
        'limiter_gr_over_1db_pct': round(float(100 * np.mean(lim_g < undb(-1))), 3),
        'master_gain_db': round(float(gain), 2),
        'python_lufs': round(float(dsp.lufs_integrated(y)), 2),
        'python_truepeak_dbtp_4x': round(float(db(dsp.true_peak_env(y).max())), 2),
        'music_tail_last_100ms_dbfs': round(float(db(np.abs(music[-ns(0.1):]).max())), 1),
        'final_last_100ms_dbfs': round(float(db(np.abs(y[-ns(0.1):]).max())), 1),
        'ffmpeg': meas,
    }
    # per-cue audibility (post master gain): momentary max of sfx / music / voice in [t, t+0.4]
    tmv, Mv = dsp.lufs_momentary(voice * mg, 0.02)
    tmm, Mm = dsp.lufs_momentary(music_d * mg, 0.02)
    tms, Ms = dsp.lufs_momentary(sfx_d * mg, 0.02)
    w = lambda tm_, M_, t: round(float(M_[(tm_ >= t) & (tm_ < t + 0.4)].max()), 1)
    rep['sfx_cues__t_name_sfxM_musicM_voiceM'] = [(t, n, w(tms, Ms, t), w(tmm, Mm, t), w(tmv, Mv, t)) for t, n in cues]
    table, rows = alignment_table(tl, music, sfx, cues, logo, fhit)
    rep['alignment'] = rows
    json.dump(rep, open(os.path.join(REP, 'mix_report.json'), 'w'), indent=1, ensure_ascii=False)
    open(os.path.join(REP, 'alignment.txt'), 'w').write(table + '\n')

    # ------------------------------------------------------------------ pictures
    vt, vL = dsp.lufs_shortterm(voice * mg, 0.05)
    mt_, mL = dsp.lufs_shortterm(music_d * mg, 0.05)
    st_, sL = dsp.lufs_shortterm(sfx_d * mg, 0.05)
    marks = [(c['start'], c['id'], (254, 86, 13)) for c in tl.chapters]
    marks += [(h, n, (243, 167, 69)) for h, n in ((logo, 'LOGO'), (fhit, 'FINAL')) if h is not None]
    secs = [(s, e, 'speech') for s, e in iv]
    extra = [(vt, vL, (255, 255, 255)), (mt_, mL, (190, 120, 255)), (st_, sL, (80, 220, 120))]
    title = 'final_mix.wav (white = voice ST, violet = ducked music ST, green = sfx ST)'
    dsp.report_png(os.path.join(REP, 'final_mix.png'), y, title, marks, secs, extra, px_per_s=12, height=700)
    D = tl.duration
    wins = [(0, D * 0.27), (D * 0.25, D * 0.52), (D * 0.5, D * 0.77), (D * 0.75, D)]
    for k, (a, b) in enumerate(wins):
        dsp.report_png(os.path.join(REP, f'final_mix_zoom{k + 1}.png'), y, title, marks + [(t, n[:14], (120, 200, 255)) for t, n in cues if 'whoosh' not in n],
                       secs, extra, px_per_s=40, height=700, t0=a, t1=b)
    for name in ('music', 'sfx', 'final_mix'):
        src = os.path.join(OUT, name + '.wav')
        subprocess.run(['nice', '-n', '5', 'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-threads', '1', '-i', src, '-lavfi',
                        'showspectrumpic=s=1600x600:legend=1:fscale=log:color=magma:scale=log', os.path.join(REP, f'{name}_ffspec.png')])
        subprocess.run(['nice', '-n', '5', 'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-threads', '1', '-i', src, '-lavfi',
                        'showwavespic=s=1600x300:split_channels=1:colors=#A947FE|#F3A745', os.path.join(REP, f'{name}_wave.png')])
    print(table)
    print(json.dumps({k: rep[k] for k in ('voice_minus_ducked_music_LU_overall', 'music_gain_db', 'sfx_gain_db', 'glue_gr_db_p50_p95_max',
                                          'limiter_gr_db_max', 'limiter_gr_over_1db_pct', 'python_lufs', 'python_truepeak_dbtp_4x', 'ffmpeg',
                                          'final_last_100ms_dbfs')}, indent=1))
    print('per chapter:', [(p['chapter'], p['voice_minus_ducked_music_LU']) for p in per])
    print('voice polish:', {k: v for k, v in vstats.items() if k != 'segment_gain_db'})
    return rep


def _arg(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


if __name__ == '__main__':
    # optional (testing): --timeline other.json  --out other_dir  --voice other_voice.wav
    import music, sfx
    tl = tlmod.load(_arg('--timeline', tlmod.TL_PATH))
    VOICE = _arg('--voice', VOICE)
    if _arg('--out'):
        for mod in (sys.modules[__name__], music, sfx):
            mod.OUT = os.path.abspath(_arg('--out'))
            mod.REP = os.path.join(mod.OUT, 'audio_report')
    if '--all' in sys.argv:
        music.main(tl, stems='--stems' in sys.argv)
        sfx.main(tl)
    main(tl)
