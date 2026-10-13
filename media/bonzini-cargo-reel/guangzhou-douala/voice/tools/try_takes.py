"""Build candidate takes of one line exactly as make_final.py would (start transient cut, 48 kHz, Rubber Band to ≈ 3.12
syl/s within ×1.15 and the window, trim, fades, −3 dBFS) and run the phone-band listen test on each; nothing is written
to the deliverables.  usage: python3 try_takes.py LID TAKE [TAKE …]"""
import sys, os, json, subprocess, tempfile
import numpy as np, soundfile as sf, soxr
from scipy.signal import butter, sosfiltfilt, resample_poly
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H)
from lines import LINES, SYL_RANGE
from narr_eval_lib import span, share, METHODS
from faster_whisper import WhisperModel
V = os.path.abspath(os.path.join(H, '..')); SR = 48000
lid = sys.argv[1]; text, _, w0, w1, *_ = LINES[lid]; syl = SYL_RANGE[lid][0]; win = w1 - w0
S = WhisperModel('small', device='cpu', compute_type='int8', cpu_threads=4); B = WhisperModel('large-v3', device='cpu', compute_type='int8', cpu_threads=4)
sos = butter(4, [300, 3400], 'bandpass', fs=16000, output='sos')
def rb(y, st):
    if abs(st - 1) < 5e-4: return y
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, 'i.wav'), os.path.join(d, 'o.wav'); sf.write(a, y.astype(np.float32), SR, subtype='FLOAT')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', a, '-af', METHODS['rb_crisp'].format(t=1 / st), '-c:a', 'pcm_f32le', b], check=True)
        z, _ = sf.read(b); return z if z.ndim == 1 else z.mean(1)
for f in sys.argv[2:]:
    y, sr = sf.read(os.path.join(V, 'work', 'audio', 'vo', f + '.wav')); y = y.copy()
    if not f.split('_s')[1].startswith(('P', 'L')): y[:int(.018 * sr)] = 0
    on, off = span(y, sr); d = off - on
    st0 = max(1.0, min(1.15, syl / (3.12 * d), win / d))
    for st in sorted({round(st0, 3), round(max(1.0, st0 - .01), 3), round(max(1.0, st0 - .02), 3)}):
        seg = y[int(max(0, on - .12) * sr):int(min(len(y) / sr, off + .12) * sr)]
        z = rb(np.r_[np.zeros(14400), soxr.resample(seg, sr, SR, quality='VHQ'), np.zeros(14400)], st)
        a, b = span(z, SR); z = z[int(round((a - .03) * SR)):int(round((b + .03) * SR))].copy()
        fi, fo = int(.010 * SR), int(.020 * SR); z[:fi] *= np.sin(np.linspace(0, np.pi / 2, fi)) ** 2; z[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2
        z = z / np.abs(z).max() * 10 ** (-3 / 20)
        y16 = resample_poly(z, 1, 3); q = sosfiltfilt(sos, np.r_[np.zeros(8000), y16, np.zeros(8000)]); q = (q / np.abs(q).max() * .8).astype(np.float32)
        weak = ' '.join(s.text for s in S.transcribe(q, language='fr', beam_size=1, condition_on_previous_text=False, vad_filter=False)[0]).strip()
        big = ' '.join(s.text for s in B.transcribe(q, language='fr', beam_size=5, condition_on_previous_text=False, vad_filter=False)[0]).strip()
        print(f"{f:16s} ×{st:.3f} {b - a:.2f}s {syl / (b - a):.2f} syl/s | weak {share(text, weak)[0]:.2f} « {weak} » | large {share(text, big)[0]:.2f} « {big} »", flush=True)
