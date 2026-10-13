"""Listen report of the FINAL narrator files: each voice/<id>.wav through a phone-speaker band-pass (300–3400 Hz,
4th-order Butterworth, zero phase), 0.5 s of silence each side, transcribed by a deliberately weak listener
(faster-whisper small, beam 1, no context) and by large-v3; share of the reference words recognised, compared by sound
(narr_eval_lib.toks: écrit = écris, il filme = ils filment, colie = colis …). Pass = weak listener ≥ 90 %.
Also: the spoken rate as played (syllables / speech span), the window, and a sheet voice/check/final_lines.png
(spectrogram + words.json marks) to look at.  usage: python3 listen.py -> voice/listen_report.json + listen_report.txt"""
import sys, os, json, difflib
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfiltfilt, resample_poly
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
from faster_whisper import WhisperModel
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H)
from lines import LINES
from narr_eval_lib import toks, span, share
V = os.path.abspath(os.path.join(H, '..'))
TK = json.load(open(os.path.join(V, 'takes.json'))); WD = json.load(open(os.path.join(V, 'words.json')))
SMALL = WhisperModel('small', device='cpu', compute_type='int8', cpu_threads=4)
BIG = WhisperModel('large-v3', device='cpu', compute_type='int8', cpu_threads=4)
sos = butter(4, [300, 3400], 'bandpass', fs=16000, output='sos')
rep, lines = {}, []
ids = [i for i in LINES if i in TK]
fig, ax = plt.subplots(len(ids), 1, figsize=(12, 1.9 * len(ids)))
for n, lid in enumerate(ids):
    text = LINES[lid][0]; y, sr = sf.read(os.path.join(V, f'{lid}.wav')); y = y.mean(1) if y.ndim > 1 else y
    y16 = resample_poly(y, 1, 3); z = sosfiltfilt(sos, np.r_[np.zeros(8000), y16, np.zeros(8000)]); z = (z / (np.abs(z).max() + 1e-9) * .8).astype(np.float32)
    weak = ' '.join(s.text for s in SMALL.transcribe(z, language='fr', beam_size=1, condition_on_previous_text=False, vad_filter=False)[0]).strip()
    big = ' '.join(s.text for s in BIG.transcribe(z, language='fr', beam_size=5, condition_on_previous_text=False, vad_filter=False)[0]).strip()
    r = lambda h: share(text, h)[0]
    on, off = span(y, sr); syl = TK[lid]['syl']; w0, w1 = LINES[lid][2], LINES[lid][3]
    rep[lid] = dict(text=text, weak_heard=weak, weak_share=round(r(weak), 3), large_heard=big, large_share=round(r(big), 3), passed=bool(r(weak) >= .9),
                    speech=round(off - on, 3), rate=round(syl / (off - on), 2), window=round(w1 - w0, 2), fits=bool((off - on) <= w1 - w0 + 1e-6))
    q = rep[lid]
    lines.append(f"{lid:5s} {'PASS' if q['passed'] else 'FAIL'} weak {q['weak_share'] * 100:3.0f}% « {weak} » · large {q['large_share'] * 100:3.0f}% « {big} » · "
                 f"{q['speech']:.2f}s {q['rate']:.2f} syl/s (window {q['window']:.2f})")
    print(lines[-1], flush=True)
    a = ax[n]; a.specgram(y, NFFT=1024, Fs=sr, noverlap=1024 - 120, cmap='magma', vmin=-140); a.set_ylim(0, 7000); a.set_yticks([])
    for w in WD.get(lid, []):
        a.axvline(w['s'], color='lime', lw=1); a.axvline(w['e'], color='cyan', lw=.8, ls=':'); a.text(w['s'] + .01, 6200, w['w'], color='w', fontsize=8)
    a.set_title(f"{lid} « {text} »  {q['speech']:.2f}s  {q['rate']:.2f} syl/s  ×{TK[lid]['stretch']}  weak {q['weak_share'] * 100:.0f}%", fontsize=8, loc='left')
    a.set_xlim(0, max(2.0, len(y) / sr)); a.tick_params(labelsize=6)
fig.tight_layout(); fig.savefig(os.path.join(V, 'check', 'final_lines.png'), dpi=72)
tot = np.mean([q['weak_share'] for q in rep.values()])
lines.append(f"ALL: weak listener {tot * 100:.1f}% of the words; {sum(q['passed'] for q in rep.values())}/{len(rep)} lines ≥ 90 %; "
             f"{sum(q['fits'] for q in rep.values())}/{len(rep)} fit their window; max rate {max(q['rate'] for q in rep.values()):.2f} syl/s")
print(lines[-1])
json.dump(rep, open(os.path.join(V, 'listen_report.json'), 'w'), ensure_ascii=False, indent=1)
open(os.path.join(V, 'listen_report.txt'), 'w').write(
    'Listen report — final narrator files through a phone-speaker band-pass 300–3400 Hz; weak listener = faster-whisper small '
    '(beam 1, no context); words compared by sound. Pass = weak ≥ 90 %.\n\n' + '\n'.join(lines) + '\n')
