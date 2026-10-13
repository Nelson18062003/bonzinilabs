"""listen_test.py [AUDIO_DIR = audio/] [--model small] [--band 300,3400] — SERIE §3.11: the FINAL mix (music, ambience, SFX
included) through a phone band-pass, transcribed by a deliberately weak listener (faster-whisper `small`, beam 1, no prompt,
no context, no VAD), and every NARRATOR line and every REAL-VOICE SUBTITLE scored by the share of its words heard.
Model of serie/listen_test.py (same sound normaliser, serie/voice_score.py: silent letters, homophones; a heard word belongs
to every line whose window [start − .35, end + .2] contains its middle). The lines come from <dir>/score_cues.json (the plan
the mix was built on): narrator = narr[].text over [t, end]; real voice = the SUBTITLED words only (RV4: « Bonzini Trading,
faites-nous confiance. », « Voilà, c'est fort » being the stamp's), over the span of those words (data: rush2/voice/
real_words.json via the score). Writes <dir>/listen_report.json. Pass: >= 90 % of the narrator words AND >= 90 % of the
real-voice subtitle words."""
import sys, os, json, re, unicodedata, difflib, subprocess, argparse
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfiltfilt, resample_poly
HERE = os.path.dirname(os.path.abspath(__file__)); P = os.path.abspath(os.path.join(HERE, '..'))
ap = argparse.ArgumentParser(); ap.add_argument('dir', nargs='?', default=os.path.join(P, 'audio')); ap.add_argument('--model', default='small')
ap.add_argument('--band', default='300,3400'); ap.add_argument('--wav'); a = ap.parse_args()
D = os.path.abspath(a.dir); MIX = a.wav or os.path.join(D, 'mix.wav'); SC = json.load(open(os.path.join(D, 'score_cues.json')))
_vs = open(os.path.join(P, '..', '..', 'serie', 'voice_score.py')).read(); _ns = dict(re=re, unicodedata=unicodedata)
exec(_vs[_vs.index('_U = '):_vs.index('def syl(')], _ns); said = lambda t: _ns['canon'](_ns['toks'](t))
# ---- the lines ----
js = ("const S=require(%s);const o={};for(const v of S.voices()){const L=S.TEXTS().find(q=>q[6]&&q[6].voice===v.id);"
      "const txt=L?L[3].replace('|',' '):v.text;const ws=S.wordsOf(v.id);const toks=txt.split(' ').map(t=>S.nrmTok?S.nrmTok(t):t);"
      "o[v.id]={text:txt,words:ws};}console.log(JSON.stringify(o))") % json.dumps(os.path.join(P, 'overlay', 'scenes', '01_score.js'))
env = dict(os.environ, BZ_VARIANT=SC.get('variant', 'main'))
RVW = json.loads(subprocess.run(['node', '-e', js], capture_output=True, text=True, cwd=P, env=env, check=True).stdout.strip().splitlines()[-1])
def deacc(s): return unicodedata.normalize('NFD', s.lower()).encode('ascii', 'ignore').decode()
lines = []
for n in SC['narr']: lines.append(dict(id=n['id'], kind='narrator', text=n['text'], a=n['t'], b=n['end']))
for v in SC['voices']:
    r = RVW[v['id']]; sub = [re.sub(r'[^a-z]', '', deacc(t)) for t in r['text'].split()]
    ws = [w for w in r['words'] if any(re.sub(r'[^a-z]', '', deacc(w['w'])).startswith(s[:4]) for s in sub if s)]
    ws = ws or r['words']
    lines.append(dict(id=v['id'], kind='real voice', text=r['text'], a=ws[0]['s'], b=ws[-1]['e']))
# ---- the listener ----
from faster_whisper import WhisperModel
y, sr = sf.read(MIX); y = y.mean(1) if y.ndim > 1 else y
lo, hi = map(float, a.band.split(',')); y = sosfiltfilt(butter(4, [lo, hi], 'bandpass', fs=sr, output='sos'), y)
y16 = resample_poly(y, 1, 3) if sr == 48000 else y; y16 = (y16 / (np.abs(y16).max() + 1e-9) * .9).astype(np.float32)
M = WhisperModel(a.model, device='cpu', compute_type='int8', cpu_threads=4)
segs, _ = M.transcribe(y16, language='fr', word_timestamps=True, beam_size=1, condition_on_previous_text=False, vad_filter=False)
words = [(w.start, w.end, w.word.strip()) for s in segs for w in s.words]
rows = []; tot = {}
for L in lines:
    heard = [w for s0, e0, w in words if L['a'] - .35 <= (s0 + e0) / 2 <= L['b'] + .2]
    ref = said(L['text']); hyp = said(' '.join(heard))
    sm = difflib.SequenceMatcher(None, ref, hyp); ok = sum(bl.size for bl in sm.get_matching_blocks())
    missed = [w for w in ref if w not in hyp]
    rows.append(dict(id=L['id'], kind=L['kind'], text=L['text'], heard=' '.join(heard), ok=ok, n=len(ref), pct=round(100 * ok / max(1, len(ref))), missed=missed, span=[round(L['a'], 3), round(L['b'], 3)]))
    t = tot.setdefault(L['kind'], [0, 0]); t[0] += ok; t[1] += len(ref)
print(f'listen test — {os.path.relpath(MIX, P)} · phone band {lo:.0f}–{hi:.0f} Hz · faster-whisper {a.model} (beam 1, no context)')
for r in rows: print(f"  {r['id']:5s} {r['kind']:10s} {r['pct']:4d}%  « {r['text']} »  →  « {r['heard']} »" + (f"   missed {r['missed']}" if r['missed'] else ''))
res = {k: round(100 * v[0] / max(1, v[1]), 1) for k, v in tot.items()}
ok = all(v >= 90 for v in res.values())
print('  ' + ' · '.join(f'{k}: {tot[k][0]}/{tot[k][1]} words = {v} %' for k, v in res.items()) + f'  →  {"PASS" if ok else "FAIL"} (≥ 90 % each)')
json.dump(dict(mix=MIX, band=[lo, hi], model=a.model, rows=rows, totals=res, pass_=ok, asr=' '.join(w for _, _, w in words)), open(os.path.join(D, f'listen_report{"" if a.model == "small" else "_" + a.model}.json'), 'w'), indent=1, ensure_ascii=False)
sys.exit(0 if ok else 1)
