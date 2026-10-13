"""Rank the narrator takes of each line (voice/work/take_eval.json) and propose a choice.
Hard filters: fits (speech × stretch ≤ window, stretch ≤ 1.15 to reach ≤ 3.2 syl/s), large-v3 hears the exact words,
every key word heard by large-v3 AND by the weak listener (small, phone band), questions rise at the end, no inside pause
> 0.50 s, the take does not end on the file's last sample (tail ≥ 0.10 s).
Score = weak-listener share + 0.3 × large-v3 share − 0.8 × (stretch − 1) + question rise bonus − 0.3 × (pause > 0.40 s).
usage: python3 select.py [--top 4] [--write]     (--write: voice/work/choice.json with the best fitting take per line)"""
import sys, os, json, difflib
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H)
from lines import LINES, QUESTIONS, STRETCH_MAX, SYL_RANGE
from nuclei import nuclei
from narr_eval_lib import toks, heard_tokens
from steady import steady
from prosody import prosody
import re
_pr = {}
def npause(name, r):
    """pauses ≥ 0.15 s (a stop closure, even held, stays under it)"""
    return sum(1 for a_, b_ in pros_of(name, r)['pauses'] if b_ - a_ >= .15)
def pros_of(name, r):
    if name not in _pr:
        y, sr = sf.read(os.path.join(V, 'work', 'audio', 'vo', name + '.wav')); _pr[name] = prosody(y.mean(1) if y.ndim > 1 else y, sr, r['on'], r['off'])
    return _pr[name]
import soundfile as sf
_nu = {}
def syl_of(name, lid):
    if name not in _nu:
        y, sr = sf.read(os.path.join(V, 'work', 'audio', 'vo', name + '.wav')); _nu[name] = len(nuclei(y.mean(1) if y.ndim > 1 else y, sr))
    lo, hi = SYL_RANGE[lid]; return min(hi, max(lo, _nu[name]))
_st = {}
def steady_of(name):
    if name not in _st:
        y, sr = sf.read(os.path.join(V, 'work', 'audio', 'vo', name + '.wav')); _st[name] = steady(y.mean(1) if y.ndim > 1 else y, sr)[0]
    return _st[name]
V = os.path.abspath(os.path.join(H, '..'))
EV = json.load(open(os.path.join(V, 'work', 'take_eval.json')))
a = sys.argv[1:]; TOP = int(a[a.index('--top') + 1]) if '--top' in a else 4
def ratio(ref, h): return sum(b.size for b in difflib.SequenceMatcher(None, ref, h).get_matching_blocks()) / max(1, len(ref))
def has(k, h):
    kk = toks(k); return any(h[i:i + len(kk)] == kk for i in range(len(h) - len(kk) + 1))
choice = json.load(open(os.path.join(V, 'work', 'choice.json'))) if os.path.exists(os.path.join(V, 'work', 'choice.json')) else {}
for lid, (text, syl, w0, w1, film, keys) in LINES.items():
    win = w1 - w0; ref = toks(text); rows = []; syl0 = syl
    for name, r in EV.items():
        if r['id'] != lid or r.get('skipped'): continue
        hb, hs = heard_tokens(ref, toks(r['big'])), heard_tokens(ref, toks(r['small']))
        exact = hb == ref; rb_, rs_ = ratio(ref, hb), ratio(ref, hs)
        miss = [k for k in keys if not has(k, hb)] + [k + '(weak)' for k in keys if not has(k, hs)]
        q_ok = True; bonus = 0
        if lid in QUESTIONS:
            # heard as a question: large-v3 (or the weak listener) writes « ? », and the pitch of the last word rises
            # (« où », « quoi » make H / NA questions by their words: there the pitch alone decides)
            qmark = r['big'].rstrip().endswith('?') or r['small'].rstrip().endswith('?')
            rise = (r['final_st'] or -9) > 1.5 or (r['final_slope'] or -99) > 25        # the last 250 ms of voicing climb ≥ 25 st/s
            q_ok = rise
            bonus = .15 * min(1, max(0, (r['final_st'] or 0) / 4)) + .1 * min(1, max(0, (r['final_slope'] or 0) / 60)) + .1 * qmark
        syl = syl_of(name, lid); need = max(1.0, syl / (3.2 * r['dur'])); fits = need <= STRETCH_MAX + 1e-6 and r['dur'] * need <= win + 1e-6
        why = [x for x, bad in (('no fit', not fits), ('not exact', not exact), ('missed ' + ','.join(miss), bool(miss)), ('no rise', not q_ok),
                                 ('pause %.2f' % r['max_pause'], r['max_pause'] > .50), ('clipped', r['tail'] < .10),
                                 ('drawl %.2fs' % max(pros_of(name, r)['max_inner'], steady_of(name)), pros_of(name, r)['max_inner'] > .45 or pros_of(name, r)['max_any'] > .62 or steady_of(name) > .30),
                                 ('%d pauses for %d breaks' % (npause(name, r), len(re.findall(r'[,:;]', text))),
                                  npause(name, r) - len(re.findall(r'[,:;]', text)) > (1 if lid.startswith('S') else 0))) if bad]
        st = max(need, min(max(1.0, syl / (3.12 * r['dur'])), STRETCH_MAX, win / r['dur']))   # aim 3.12 syl/s, never past ×1.15 or the window
        score = rs_ + .3 * rb_ - .8 * (st - 1) + bonus - .3 * (r['max_pause'] > .40) - 1.5 * max(0, pros_of(name, r)['max_inner'] - .38)
        rows.append((not why, score, name, r, st, why, rs_, syl))
    rows.sort(key=lambda x: (x[0], x[1]), reverse=True)
    ok = [x for x in rows if x[0]]
    print(f"\n{lid:5s} « {text} »  {syl} syl, window {win:.2f}s (min {syl / 3.2:.2f}s at 3.2)  — {len(ok)}/{len(rows)} usable takes (+ {sum(1 for r in EV.values() if r['id'] == lid and r.get('skipped'))} skipped)")
    for good, score, name, r, st, why, rs_, syl in rows[:TOP]:
        print(f"  {'OK ' if good else '-- '} {name:16s} {r['dur']:.2f}s {syl}syl ×{st:.3f} → {r['dur'] * st:.2f}s {syl / (r['dur'] * st):.2f} syl/s | weak {rs_:.2f} « {r['small']} » | "
              f"fin {r['final_st']} st, slope {r['final_slope']} | pause {r['max_pause']:.2f} syl≤{pros_of(name, r)['max_inner']:.2f} p{len(pros_of(name, r)['pauses'])} | score {score:.2f} {'; '.join(why)}")
    if '--sheet' in a and rows and (a[a.index('--sheet') + 1] in ('all', lid) or lid in a[a.index('--sheet') + 1].split(',')):
        import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt, numpy as np
        sel = rows[:int(os.environ.get('NSHEET', '6'))]
        fig, axs = plt.subplots(len(sel), 1, figsize=(12, 2.0 * len(sel)), squeeze=False)
        for q, (good, score, name, r, st_, why, rs_, sy) in zip(axs[:, 0], sel):
            y, sr = sf.read(os.path.join(V, 'work', 'audio', 'vo', name + '.wav')); y = y.mean(1) if y.ndim > 1 else y
            q.specgram(y, NFFT=1024, Fs=sr, noverlap=1024 - 96, cmap='magma', vmin=-140); q.set_ylim(0, 7000); q.set_yticks([])
            pr = pros_of(name, r)
            for x in pr['nuclei']: q.axvline(x, color='lime', lw=.8, ls='--')
            for p0, p1 in pr['pauses']: q.axvspan(p0, p1, color='c', alpha=.25)
            q.axvline(r['on'], color='w'); q.axvline(r['off'], color='w')
            if lid in QUESTIONS:                                  # pitch track (pyin), white, on a 100–450 Hz scale mapped to the plot height
                import librosa
                f0, vo, _ = librosa.pyin(y.astype(np.float32), fmin=90, fmax=450, sr=sr, frame_length=1024, hop_length=240)
                tt = np.arange(len(f0)) * 240 / sr; q.plot(tt, (f0 - 100) / 350 * 7000, color='w', lw=1.5)
            q.set_xlim(max(0, r['on'] - .1), r['off'] + .1); q.tick_params(labelsize=6); q.xaxis.set_major_locator(plt.MultipleLocator(.1)); q.grid(axis='x', alpha=.25)
            q.set_title(f"{'OK' if good else '--'} {name} {r['dur']:.2f}s ×{st_:.3f} {sy}syl  syl {pr['syl_lens']}  « {r['big']} » {'; '.join(why)}", fontsize=7, loc='left')
        fig.tight_layout(); fig.savefig(os.path.join(V, 'check', f'cand_{lid}.png'), dpi=70); plt.close(fig)
    if '--write' in a and ok:
        _, _, name, r, st, _, _, syl = ok[0]
        if lid not in choice or choice[lid].get('auto', True): choice[lid] = dict(file=name + '.wav', stretch=round(st, 3), syl=syl, auto=True)
if '--write' in a:
    choice.setdefault('_method', 'rb_crisp'); json.dump(choice, open(os.path.join(V, 'work', 'choice.json'), 'w'), ensure_ascii=False, indent=1)
