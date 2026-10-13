"""listen_test.py [AUDIO_DIR = audio/] [--model small] [--band 300,3400] — SERIE §3.11: the FINAL mix (music, ambience, SFX
included) through a phone band-pass, transcribed by a deliberately weak listener (faster-whisper `small`, beam 1, no prompt,
no context, no VAD), and every NARRATOR line and every REAL-VOICE SUBTITLE scored by the share of its words heard.
Model of serie/listen_test.py (same sound normaliser, serie/voice_score.py: silent letters, homophones). Review 2: the heard words
are matched to the whole script IN ORDER (difflib), and a matched word counts for its line when its middle lies within 1,5 s
before / 1,0 s after it (whisper's word times drift across pauses); « part » = « par » and an elided letter split off a
reference word (« D'Ouala ») are joined back — both printed when used. --wav FILE --tag NAME: any other file (the mp4's AAC). The lines come from <dir>/score_cues.json (the plan
the mix was built on): narrator = narr[].text over [t, end]; real voice = the SUBTITLED words only (RV4: « Bonzini Trading,
faites-nous confiance. », « Voilà, c'est fort » being the stamp's), over the span of those words (data: rush2/voice/
real_words.json via the score). Writes <dir>/listen_report.json. Pass: >= 90 % of the narrator words AND >= 90 % of the
real-voice subtitle words."""
import sys, os, json, re, unicodedata, difflib, subprocess, argparse
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfiltfilt, resample_poly
HERE = os.path.dirname(os.path.abspath(__file__)); P = os.path.abspath(os.path.join(HERE, '..'))
ap = argparse.ArgumentParser(); ap.add_argument('dir', nargs='?', default=os.path.join(P, 'audio')); ap.add_argument('--model', default='small')
ap.add_argument('--band', default='300,3400'); ap.add_argument('--wav'); ap.add_argument('--tag', default='', help='report name suffix (review 2: share / whatsapp = the audio decoded from the mp4)'); a = ap.parse_args()
D = os.path.abspath(a.dir); MIX = a.wav or os.path.join(D, 'mix.wav'); SC = json.load(open(os.path.join(D, 'score_cues.json')))
_vs = open(os.path.join(P, '..', '..', 'serie', 'voice_score.py')).read(); _ns = dict(re=re, unicodedata=unicodedata)
exec(_vs[_vs.index('_U = '):_vs.index('def syl(')], _ns)
# review 2 — two SOUND normalisations on top of serie/voice_score.py (same principle: compare sounds, not spellings), printed in
# the report when used: (1) exact homophones of THESE lines: « part » = « par » [paʁ]; (2) an elided letter the transcriber split
# off a reference word is joined back when the join IS that word (« D'Ouala » = « Douala » [dwala]; the voice team's
# narr_eval_lib.heard_tokens rule). Nothing else: « Freddy » for « Trading » stays a miss.
LOCAL_HOMO = {'part': 'par'}
said = lambda t: [LOCAL_HOMO.get(w, w) for w in _ns['canon'](_ns['toks'](t))]
NORM = []
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
# review 2 — words are matched to the WHOLE script IN ORDER (difflib over the film), then each matched word counts for its line if
# its middle lies within 1,5 s before / 1,0 s after the line: whisper's word times drift across pauses (the « un » of « Un
# conteneur », spoken at 6,75, was stamped 5,46–6,18 at the end of the previous sentence and fell outside the old ±,35 s window)
lines.sort(key=lambda L: L['a'])
REF = []                                                             # (token, line index)
for i, L in enumerate(lines): REF += [(w, i) for w in said(L['text'])]
HYP = []                                                             # (token, middle time, raw word)
for s0, e0, w in words:
    for q in said(w): HYP.append((q, (s0 + e0) / 2, w))
RS = set(w for w, _ in REF); HJ = []; k = 0
while k < len(HYP):                                                  # elided letters joined back (« D'Ouala » = « douala »)
    if k + 1 < len(HYP) and len(HYP[k][0]) <= 2 and HYP[k][0] + HYP[k + 1][0] in RS and HYP[k + 1][0] not in RS:
        NORM.append(f'{HYP[k][0]}+{HYP[k + 1][0]} → {HYP[k][0] + HYP[k + 1][0]}'); HJ.append((HYP[k][0] + HYP[k + 1][0], HYP[k][1], HYP[k][2] + HYP[k + 1][2])); k += 2
    else: HJ.append(HYP[k]); k += 1
sm = difflib.SequenceMatcher(None, [w for w, _ in REF], [w for w, _, _ in HJ], autojunk=False)
hit = {}
for bl in sm.get_matching_blocks():
    for d in range(bl.size):
        i, j = bl.a + d, bl.b + d; L = lines[REF[i][1]]
        if L['a'] - 1.5 <= HJ[j][1] <= L['b'] + 1.0: hit[i] = j
for li, L in enumerate(lines):
    idx = [i for i, (_, l_) in enumerate(REF) if l_ == li]; ref = [REF[i][0] for i in idx]
    ok = sum(1 for i in idx if i in hit); missed = [REF[i][0] for i in idx if i not in hit]
    heard = [w for s0, e0, w in words if L['a'] - .35 <= (s0 + e0) / 2 <= L['b'] + .2]
    if 'par' in ref and any(REF[i][0] == 'par' and i in hit for i in idx): NORM.append(f"{L['id']}: part ≡ par")
    rows.append(dict(id=L['id'], kind=L['kind'], text=L['text'], heard=' '.join(heard), ok=ok, n=len(ref), pct=round(100 * ok / max(1, len(ref))), missed=missed, span=[round(L['a'], 3), round(L['b'], 3)]))
    t = tot.setdefault(L['kind'], [0, 0]); t[0] += ok; t[1] += len(ref)
print(f'listen test — {os.path.relpath(MIX, P)} · phone band {lo:.0f}–{hi:.0f} Hz · faster-whisper {a.model} (beam 1, no context)')
for r in rows: print(f"  {r['id']:5s} {r['kind']:10s} {r['pct']:4d}%  « {r['text']} »  →  « {r['heard']} »" + (f"   missed {r['missed']}" if r['missed'] else ''))
res = {k: round(100 * v[0] / max(1, v[1]), 1) for k, v in tot.items()}
ok = all(v >= 90 for v in res.values())
print('  ' + ' · '.join(f'{k}: {tot[k][0]}/{tot[k][1]} words = {v} %' for k, v in res.items()) + f'  →  {"PASS" if ok else "FAIL"} (≥ 90 % each)')
if NORM: print('  sound normalisations used: ' + ' · '.join(NORM))
json.dump(dict(mix=MIX, band=[lo, hi], model=a.model, rows=rows, totals=res, pass_=ok, asr=' '.join(w for _, _, w in words), normalisations=NORM), open(os.path.join(D, f'listen_report{"" if a.model == "small" else "_" + a.model}{"_" + a.tag if a.tag else ""}.json'), 'w'), indent=1, ensure_ascii=False)
sys.exit(0 if ok else 1)
