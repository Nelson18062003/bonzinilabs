"""Build voice/real_words.json from the hand marks (voice/work/rv_manual.json) and check them.
usage: python3 rv_words.py      -> voice/real_words.json ; prints the checks and the differences with SERIE §4 / §8.1
real_words.json = {RVid: {clip, in, out, dur, text, words: [{w, s, e, (pre), (vowel), (syl)}], cuts}} — every time relative
to the segment's `in` (s / e = word onset / end; `pre` = start of a voiced-stop voice bar; `vowel` = first vowel onset;
`syl` = syllable onsets, last = the French stressed syllable). Checks: words inside [0, dur] and in order; the cut points
sit where the stem is quiet (level re the segment's speech peak); each onset has an energy rise or a dip-to-rise in ±30 ms."""
import sys, os, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rv_common import *
V = os.path.join(R2, 'voice')
MAN = json.load(open(os.path.join(V, 'work', 'rv_manual.json')))
r3 = lambda x: round(float(x), 3)
out, rows = {}, []
def level_at(t, x, tt, eb):
    j = int(np.clip(np.searchsorted(tt, x), 0, len(tt) - 1)); return float(eb[j])
for k, g in SEGS.items():
    y, sr = vocals(g['clip'])
    a0 = g['i'] - .3; z = y[int(a0 * sr):int((g['o'] + .3) * sr)]
    tt, eb, eh = envelopes(z, sr, hop=.001, win=.010); tt = tt + a0
    pk = np.percentile(eb[(tt >= g['i']) & (tt <= g['o'])], 99.5)
    ws = []
    prev_e = -1
    for m in MAN[k]:
        assert g['i'] <= m['s'] < m['e'] <= g['o'], (k, m)
        assert m['s'] >= prev_e - 1e-9, (k, m, 'overlap'); prev_e = m['e']
        w = dict(w=m['w'], s=r3(m['s'] - g['i']), e=r3(m['e'] - g['i']))
        for f in ('pre', 'vowel'):
            if f in m: w[f] = r3(m[f] - g['i'])
        if 'syl' in m: w['syl'] = [r3(x - g['i']) for x in m['syl']]
        ws.append(w)
        # onset evidence: mean level 0-30 ms after s minus mean level 30-0 ms before s (dB) and the min in ±15 ms
        j = np.searchsorted(tt, m['s']); after = eb[j:j + 30].mean(); before = eb[j - 30:j].mean(); dip = eb[j - 15:j + 15].min()
        rows.append((k, m['w'], m['s'], after - before, dip - pk))
    cut_lv = dict(**{'in': r3(level_at(tt, g['i'], tt, eb) - pk), 'out': r3(level_at(tt, g['o'], tt, eb) - pk)})
    out[k] = {'clip': g['clip'], 'in': g['i'], 'out': g['o'], 'dur': r3(g['o'] - g['i']), 'text': g['text'], 'words': ws,
              'cuts_db_re_peak': cut_lv, 'speech': [ws[0]['s'], ws[-1]['e']], 'notes': [m['note'] for m in MAN[k] if 'note' in m]}
out['_doc'] = ('Real-voice segments of SERIE.md §4: word times relative to the segment in (source seconds - in). s = audible onset of the '
               'first phone (stop: release burst; fricative: frication; nasal: murmur; vowel: voicing), e = end of the last phone. '
               'pre = start of a voiced-stop voice bar before s; vowel = first vowel onset; syl = syllable onsets (last = stressed '
               'syllable). Measured by hand on 1-ms spectrograms of work/vN_vocals.wav (voice/check/rvz_*.png), ±10-20 ms; '
               'ASR (faster-whisper large-v3) gives the words and their order. Subtitle spelling of SERIE.md (« Bonzini Trading »).')
json.dump(out, open(os.path.join(V, 'real_words.json'), 'w'), ensure_ascii=False, indent=1)

print('== onset evidence (dB): rise = level 0-30 ms after s − level 30-0 ms before; dip = min in ±15 ms re speech peak')
for k, w, s, rise, dip in rows: print(f"  {k:6s} {w:12s} {s:7.3f}  rise {rise:+5.1f}  dip {dip:6.1f}")
print('== cut points (level re speech peak)')
for k, v in out.items():
    if k.startswith('_'): continue
    print(f"  {k:6s} in {v['in']:.2f} ({v['cuts_db_re_peak']['in']:+.1f} dB)  out {v['out']:.2f} ({v['cuts_db_re_peak']['out']:+.1f} dB)  speech {v['in'] + v['speech'][0]:.3f}–{v['in'] + v['speech'][1]:.3f}")
print('== differences with SERIE (> 40 ms flagged)')
def find(k, key):
    ws = MAN[k]; base = key.split('#')[0]; n = int(key.split('#')[1]) if '#' in key else 1
    hits = [m for m in ws if m['w'].strip('…') == base.strip('…')]
    return hits[n - 1] if len(hits) >= n else None
for src, MK in (('§4', MARKS4), ('§8.1', MARKS81)):
    for k, marks in MK.items():
        for key, kind, t in marks:
            m = find(k, key)
            if m is None: print(f'  {src} {k} {key}: not found'); continue
            ours = m['s'] if kind == 's' else m['e']; d = ours - t
            flag = '  <-- DIFF' if abs(d) > .040 + 1e-9 else ''
            extra = ''
            if kind == 's' and 'syl' in m and len(m['syl']) > 1:
                near = min(m['syl'] + [m.get('vowel', 99)], key=lambda x: abs(x - t)); extra = f"  (nearest syllable/vowel onset {near:.3f}, Δ {(near - t) * 1000:+.0f} ms)"
            print(f"  {src:4s} {k:6s} {key:14s} {'onset' if kind == 's' else 'end  '} SERIE {t:7.3f}  measured {ours:7.3f}  Δ {d * 1000:+5.0f} ms{flag}{extra}")
