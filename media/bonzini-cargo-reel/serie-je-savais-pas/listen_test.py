"""Intelligibility proxy: transcribe the FINAL mix (music + sfx included) with a deliberately weaker ASR model
(faster-whisper 'small', no prompt, no context), after a phone-speaker band-pass, and score each voice line by the
share of its words recognised. usage: python3 listen_test.py EPISODE_DIR MIX.wav [model]
Words are compared by SOUND (voice_score.py's normaliser: numbers in words, silent letters, exact homophones), and a heard
word belongs to every line whose window [start − .35, end + .2] contains its MIDDLE (the ASR stamps a word that follows a
pause at the START of the pause, which used to hand a line's first word to the previous line)."""
import sys, os, json, re, unicodedata, difflib
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfiltfilt, resample_poly
from faster_whisper import WhisperModel
E, MIX = sys.argv[1], sys.argv[2]; MODEL = sys.argv[3] if len(sys.argv) > 3 else 'small'
_vs = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'voice_score.py')).read(); _ns = dict(re=re, unicodedata=unicodedata)
exec(_vs[_vs.index('_U = '):_vs.index('def syl(')], _ns); said = lambda t: _ns['canon'](_ns['toks'](t))
y, sr = sf.read(MIX); y = y.mean(1) if y.ndim > 1 else y
sos = butter(4, [300, 7000], 'bandpass', fs=sr, output='sos'); y = sosfiltfilt(sos, y)          # phone speaker
y16 = resample_poly(y, 1, 3) if sr == 48000 else y; y16 = (y16 / (np.abs(y16).max() + 1e-9) * .9).astype(np.float32)
M = WhisperModel(MODEL, device='cpu', compute_type='int8', cpu_threads=4)
segs, _ = M.transcribe(y16, language='fr', word_timestamps=True, beam_size=1, condition_on_previous_text=False, vad_filter=False)
words = [(w.start, w.end, w.word.strip()) for s in segs for w in s.words]
T = json.load(open(os.path.join(E, 'data', 'timing.json'))); script = {s['id']: s['text'] for s in json.load(open(os.path.join(E, 'data', 'script.json')))['segments']}
tot_ok = tot = 0; rows = []
for i, txt in script.items():
    if i not in T: continue
    a, b = T[i] - .35, T[i] + T['dur'][i] + .2
    heard = [w for s0, e0, w in words if a <= (s0 + e0) / 2 <= b]
    ref = said(txt); hyp = said(' '.join(heard))
    sm = difflib.SequenceMatcher(None, ref, hyp); ok = sum(bl.size for bl in sm.get_matching_blocks())
    tot_ok += ok; tot += len(ref); rows.append((i, ok / max(1, len(ref)), txt, ' '.join(heard)))
for i, r, txt, h in rows: print(f"{i:4s} {r * 100:5.0f}%  « {txt} »  →  « {h} »")
print(f"OVERALL words recognised: {tot_ok}/{tot} = {100 * tot_ok / max(1, tot):.0f}%")
