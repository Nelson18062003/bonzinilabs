"""stem_levels.py [AUDIO_DIR] — K-weighted level (LUFS, ungated) of each stem over each voice's speech span and over the
gaps between voices (needs lib/mix.py --stems): which stem competes with which voice."""
import sys, os, json, math, numpy as np, soundfile as sf
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'explainer', 'lib', 'audio'))
import dsp
D = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'audio')
sc = json.load(open(os.path.join(D, 'score_cues.json'))); SR = 48000
st = {k: sf.read(os.path.join(D, 'stems', k + '.wav'))[0] for k in ('voice', 'narr', 'amb', 'music', 'sfx')}
def L(x, a, b):
    y = dsp.kweight(x[int(a * SR):int(b * SR)]); return 10 * math.log10(float(np.mean(np.sum(y ** 2, 1))) + 1e-20) - .691
spans = sorted([(v['speech'][0], v['speech'][1], v['id']) for v in sc['voices']] + [(n['t'], n['end'], n['id']) for n in sc['narr']])
print(f'{"span":22s}' + ''.join(f'{k:>8s}' for k in st))
for a, b, i in spans: print(f'{i:5s} {a:6.2f}-{b:6.2f}     ' + ''.join(f'{L(x, a, b):8.1f}' for x in st.values()))
prev = 0
for a, b, i in spans + [(sc['dur'], sc['dur'], 'end')]:
    if a - prev > .3: print(f'gap   {prev:6.2f}-{a:6.2f}     ' + ''.join(f'{L(x, prev, a):8.1f}' for x in st.values()))
    prev = max(prev, b)
