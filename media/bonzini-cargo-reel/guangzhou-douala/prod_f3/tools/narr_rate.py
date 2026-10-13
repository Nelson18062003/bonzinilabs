"""narr_rate.py [--variant main|cut] — review 2: the narrator's rate measured on the ENERGY of each take as played (not only on
the hand-marked word span): speech span = from the first to the last 10-ms frame whose RMS is within −30 dB (and −40 dB) of the
line's loudest frame; rate = spoken syllables (takes.json `syl`) / span. Writes data/narr_rate[_cut].json, read by tools/qa.js
(ERROR > 3,30 syl/s at −30 dB, WARN > 3,20)."""
import os, sys, json, subprocess
import numpy as np, soundfile as sf
P = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')); V = os.path.join(P, '..', 'voice')
var = sys.argv[sys.argv.index('--variant') + 1] if '--variant' in sys.argv else os.environ.get('BZ_VARIANT', 'main')
js = "const S=require(%s);console.log(JSON.stringify(S.narration()))" % json.dumps(os.path.join(P, 'overlay', 'scenes', '01_score.js'))
N = json.loads(subprocess.run(['node', '-e', js], capture_output=True, text=True, cwd=P, env=dict(os.environ, BZ_VARIANT=var), check=True).stdout.strip().splitlines()[-1])
out = {}
for n in N:
    y, sr = sf.read(os.path.join(V, n['file'])); y = y.mean(1) if y.ndim > 1 else y
    h = int(.010 * sr); fr = len(y) // h; e = np.sqrt((y[:fr * h].reshape(fr, h) ** 2).mean(1)) + 1e-9; db = 20 * np.log10(e / e.max())
    r = {}
    for thr in (30, 40):
        idx = np.where(db >= -thr)[0]; span = (idx[-1] + 1 - idx[0]) * h / sr
        r[f'span{thr}'] = round(float(span), 3); r[f'sps{thr}'] = round(n['syl'] / span, 2)
    out[n['id']] = dict(file=n['file'], syl=n['syl'], marked=n['dur'], sps_marked=n['sps'], **r)
    print(f"{n['id']:4s} {n['file']:9s} syl {n['syl']} · marked {n['dur']:.3f}s {n['sps']:.2f} · −30 dB {r['span30']:.3f}s {r['sps30']:.2f} · −40 dB {r['span40']:.3f}s {r['sps40']:.2f} syl/s")
json.dump(out, open(os.path.join(P, 'data', 'narr_rate.json' if var == 'main' else f'narr_rate_{var}.json'), 'w'), indent=1)
