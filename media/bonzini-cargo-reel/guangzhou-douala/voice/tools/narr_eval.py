"""Measure every narrator take: speech span (robust edges), spoken rate, the stretch it needs (≤ 3.2 syl/s as played),
whether it fits its film window, exact words (faster-whisper large-v3, clean), a weak listener (faster-whisper small, no
context, through a phone-speaker band-pass 300–3400 Hz), key words, the final pitch movement (questions must rise),
the longest inside pause, and clipped edges.
usage: python3 narr_eval.py [--only N1,N2] [--redo]    (takes = voice/work/audio/vo/<id>_s*.wav) -> voice/work/take_eval.json"""
import sys, os, re, json, glob, difflib, unicodedata
import numpy as np, soundfile as sf, librosa
from scipy.signal import butter, sosfiltfilt, resample_poly
from faster_whisper import WhisperModel
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H)
from lines import LINES, QUESTIONS, RATE_MAX, STRETCH_MAX, SYL_RANGE
V = os.path.abspath(os.path.join(H, '..')); VO = os.path.join(V, 'work', 'audio', 'vo'); OUT = os.path.join(V, 'work', 'take_eval.json')
a = sys.argv[1:]
only = set(a[a.index('--only') + 1].split(',')) if '--only' in a else None
REDO = '--redo' in a
from narr_eval_lib import span, toks

def pauses(y, sr, on, off):
    fr = int(.01 * sr); e = np.sqrt(np.convolve(y ** 2, np.ones(fr) / fr, 'same')); act = e > max(e.max() * .04, 1e-4)
    i, j = int(on * sr), int(off * sr); seg = act[i:j]; best, cur = 0, 0
    for v in seg:
        cur = 0 if v else cur + 1; best = max(best, cur)
    return best / sr

def final_move(y, sr, words):
    """semitones: median f0 of the last word's voiced frames minus the median f0 of everything before it, and the slope
    of the last 250 ms of voicing (st/s)"""
    f0, vo, _ = librosa.pyin(y.astype(np.float32), fmin=90, fmax=500, sr=sr, frame_length=1024, hop_length=240)
    t = np.arange(len(f0)) * 240 / sr; ok = vo & np.isfinite(f0)
    if ok.sum() < 5 or not words: return None, None, None
    st = 12 * np.log2(np.where(ok, f0, np.nan) / np.nanmedian(f0[ok]))
    lw0 = words[-1]['s']; last = ok & (t >= lw0); prev = ok & (t < lw0)
    mv = float(np.nanmedian(st[last]) - np.nanmedian(st[prev])) if last.sum() >= 3 and prev.sum() >= 3 else None
    tv = t[ok]; sv = st[ok]; sel = tv >= tv[-1] - .25
    slope = float(np.polyfit(tv[sel], sv[sel], 1)[0]) if sel.sum() >= 4 else None
    return mv, slope, float(np.nanmax(sv) - np.nanmin(sv))

res = json.load(open(OUT)) if os.path.exists(OUT) and not REDO else {}
BIG = WhisperModel('large-v3', device='cpu', compute_type='int8', cpu_threads=4)
SMALL = WhisperModel('small', device='cpu', compute_type='int8', cpu_threads=4)
phone = butter(4, [300, 3400], 'bandpass', fs=16000, output='sos')
for p in sorted(glob.glob(os.path.join(VO, '*_s*.wav'))):
    name = os.path.basename(p)[:-4]; lid = name.rsplit('_s', 1)[0]
    if lid not in LINES or (only and lid not in only) or name in res: continue
    text, _, w0, w1, film, keys = LINES[lid]; win = w1 - w0; syl = SYL_RANGE[lid][0]     # the fewest spoken syllables: never drop a take that could fit
    y, sr = sf.read(p); y = y.mean(1) if y.ndim > 1 else y
    on, off = span(y, sr); dur = off - on
    need0 = max(1.0, syl / (RATE_MAX * dur)); mp0 = pauses(y, sr, on, off)
    slack = max(0.0, mp0 - .30)                       # what capping the longest inside pause at 0.30 s could give back
    if need0 > STRETCH_MAX + 1e-6 or dur - slack > win + 1e-6:
        res[name] = dict(id=lid, on=round(on, 3), off=round(off, 3), dur=round(dur, 3), syl=syl, rate_raw=round(syl / dur, 2),
                         stretch_needed=round(need0, 3), window=round(win, 2), fits=False, max_pause=round(mp0, 3),
                         skipped='too fast (needs > ×%.2f)' % STRETCH_MAX if need0 > STRETCH_MAX else 'too long for the window')
        print(f"{name:14s} {dur:.2f}s raw {syl / dur:.2f} need×{need0:.3f} win {win:.2f} SKIP {res[name]['skipped']}", flush=True)
        json.dump(res, open(OUT, 'w'), ensure_ascii=False, indent=1); continue
    y16 = resample_poly(y, 16000 // np.gcd(sr, 16000), sr // np.gcd(sr, 16000)).astype(np.float32)
    segs, _ = BIG.transcribe(y16 / (np.abs(y16).max() + 1e-9) * .9, language='fr', word_timestamps=True, beam_size=5, condition_on_previous_text=False, vad_filter=False)
    ws = [dict(w=w.word.strip(), s=round(w.start, 3), e=round(w.end, 3), p=round(w.probability, 3)) for s in segs for w in s.words]
    big = ' '.join(w['w'] for w in ws)
    yb = sosfiltfilt(phone, y16); yb = (yb / (np.abs(yb).max() + 1e-9) * .8).astype(np.float32)
    segs2, _ = SMALL.transcribe(yb, language='fr', beam_size=1, condition_on_previous_text=False, vad_filter=False)
    small = ' '.join(s.text for s in segs2)
    ref = toks(text); hb, hs = toks(big), toks(small)
    ratio = lambda h: sum(b.size for b in difflib.SequenceMatcher(None, ref, h).get_matching_blocks()) / max(1, len(ref))
    def has(k, h):
        kk = toks(k); return any(h[i:i + len(kk)] == kk for i in range(len(h) - len(kk) + 1))
    miss_b = [k for k in keys if not has(k, hb)]; miss_s = [k for k in keys if not has(k, hs)]
    need = max(1.0, syl / (RATE_MAX * dur)); st = max(1.0, syl / (3.12 * dur))           # aim 3.12 syl/s (margin under 3.2)
    if dur * st > win: st = max(need, win / dur)
    mv, slope, rng = final_move(y, sr, ws)
    endtail = len(y) / sr - off
    e_end = float(np.sqrt(np.mean(y[-int(.01 * sr):] ** 2)) / (np.abs(y).max() + 1e-9))
    res[name] = dict(id=lid, on=round(on, 3), off=round(off, 3), dur=round(dur, 3), syl=syl, rate_raw=round(syl / dur, 2),
                     stretch_needed=round(need, 3), stretch=round(st, 3), played=round(dur * st, 3), rate_played=round(syl / (dur * st), 2),
                     window=round(win, 2), fits=bool(dur * need <= win + 1e-6 and need <= STRETCH_MAX),
                     big=big, exact=(hb == ref), big_ratio=round(ratio(hb), 3), small=small.strip(), small_ratio=round(ratio(hs), 3),
                     miss_big=miss_b, miss_small=miss_s, final_st=None if mv is None else round(mv, 2), final_slope=None if slope is None else round(slope, 1),
                     f0_range=None if rng is None else round(rng, 1), max_pause=round(pauses(y, sr, on, off), 3), tail=round(endtail, 3),
                     end_level=round(e_end, 4), words=ws)
    r = res[name]; lab = 'EXACT' if r['exact'] else f"{r['big_ratio']:.2f}"
    print(f"{name:14s} {r['dur']:.2f}s raw {r['rate_raw']:.2f} need×{r['stretch_needed']:.3f} win {win:.2f} {'FIT' if r['fits'] else '---'} "
          f"| L {lab} « {big} » | S {r['small_ratio']:.2f} « {small.strip()} » "
          f"| fin {r['final_st']} st slope {r['final_slope']} | pause {r['max_pause']:.2f} tail {endtail:.2f}", flush=True)
    json.dump(res, open(OUT, 'w'), ensure_ascii=False, indent=1)
json.dump(res, open(OUT, 'w'), ensure_ascii=False, indent=1)
