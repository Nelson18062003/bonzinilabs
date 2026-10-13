"""Voice-quality check of the stretch methods: CPP (cepstral peak prominence, dB: harmonic clarity, phasiness lowers it) and
f0 glitches (frame-to-frame jumps > 1 semitone per second of voicing: WSOLA splices show up here), original vs each method.
usage: python3 stretch_q.py TAKE.wav …"""
import sys, os, subprocess, tempfile
import numpy as np, soundfile as sf, soxr, librosa
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from narr_eval_lib import METHODS
SR = 48000; ST = 1.10
def run(y, m):
    if METHODS[m] is None: return librosa.effects.time_stretch(y.astype(np.float32), rate=1 / ST)
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, 'i.wav'), os.path.join(d, 'o.wav'); sf.write(a, y.astype(np.float32), SR, subtype='FLOAT')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', a, '-af', METHODS[m].format(t=1 / ST), '-c:a', 'pcm_f32le', b], check=True)
        z, _ = sf.read(b); return z if z.ndim == 1 else z.mean(1)
def cpp(y):
    n = 2048; hop = 480; w = np.hanning(n); out = []
    e = np.array([np.sqrt(np.mean(y[i:i + n] ** 2)) for i in range(0, len(y) - n, hop)]); thr = e.max() * .1
    q0, q1 = int(SR / 400), int(SR / 120)          # quefrency range of F0 120–400 Hz
    for k, i in enumerate(range(0, len(y) - n, hop)):
        if e[k] < thr: continue
        S = 20 * np.log10(np.abs(np.fft.rfft(y[i:i + n] * w)) + 1e-9); C = 20 * np.log10(np.abs(np.fft.irfft(S)) + 1e-9)
        q = np.arange(q0, q1); c = C[q0:q1]; p = np.argmax(c); A = np.vstack([q, np.ones_like(q)]).T
        m, b = np.linalg.lstsq(A, c, rcond=None)[0]; out.append(c[p] - (m * q[p] + b))
    return float(np.mean(out))
def glitches(y):
    f0, v, _ = librosa.pyin(y.astype(np.float32), fmin=120, fmax=450, sr=SR, frame_length=2048, hop_length=480)
    st = 12 * np.log2(f0); ok = v[1:] & v[:-1]; j = np.abs(np.diff(st))[ok]
    return float(np.sum(j > 1.0) / (ok.sum() * 480 / SR + 1e-9))
for p in sys.argv[1:]:
    y, sr = sf.read(p); y = y.mean(1) if y.ndim > 1 else y; y = soxr.resample(y, sr, SR, quality='VHQ')
    print(f"{os.path.basename(p):12s} orig      CPP {cpp(y):5.2f} dB  glitches {glitches(y):5.2f}/s")
    for m in METHODS:
        z = run(y, m); print(f"{'':12s} {m:9s} CPP {cpp(z):5.2f} dB  glitches {glitches(z):5.2f}/s", flush=True)
