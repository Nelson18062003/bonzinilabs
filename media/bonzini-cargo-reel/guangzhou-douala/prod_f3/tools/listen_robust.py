"""listen_robust.py MIX.wav [...] (film 3, integration 2) — how robust the weak listener's verdict is: the mix + AAC round trips
(BRS=96k,112k,… env; default 128k,160k,192k,224k), each through the front end of tools/listen_test.py (phone band, small,
beam 1); counts the decodes that hear RV5 (« fort ») and RV4 (« faites … confiance »). V=1 prints every transcript.
Why: whisper small sometimes enters a no-punctuation mode and skips the real voice entirely; a mix where 2 of 11 AAC
bitrates do that is on a knife edge even if the delivered file happens to pass. Informative, not a gate."""
import sys, os, subprocess, tempfile, time, numpy as np, soundfile as sf
from scipy.signal import butter, sosfiltfilt, resample_poly
from faster_whisper import WhisperModel
t0 = time.time(); M = WhisperModel('small', device='cpu', compute_type='int8', cpu_threads=4); print(f'model {time.time()-t0:.1f}s', flush=True)
def asr(path):
    y, sr = sf.read(path); y = y.mean(1) if y.ndim > 1 else y
    y = sosfiltfilt(butter(4, [300, 3400], 'bandpass', fs=sr, output='sos'), y)
    y16 = resample_poly(y, 1, 3) if sr == 48000 else y; y16 = (y16 / (np.abs(y16).max() + 1e-9) * .9).astype(np.float32)
    segs, _ = M.transcribe(y16, language='fr', word_timestamps=True, beam_size=1, condition_on_previous_text=False, vad_filter=False)
    return ' '.join(s.text.strip() for s in segs)
FAILS = set()
import atexit, shutil
td = tempfile.mkdtemp(prefix='robust_', dir=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'out')); atexit.register(shutil.rmtree, td, True)
for mix in sys.argv[1:]:
    tests = [('mix', mix)]
    for br in os.environ.get('BRS', '128k,160k,192k,224k').split(','):
        m4 = os.path.join(td, f'a{br}.m4a'); w = os.path.join(td, f'a{br}.wav')
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', mix, '-c:a', 'aac', '-b:a', br, '-ar', '48000', m4], check=True)
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', m4, '-c:a', 'pcm_f32le', '-ar', '48000', w], check=True); tests.append((br, w))
    ok = 0; FAILS.clear()
    for k, p in tests:
        t0 = time.time(); txt = asr(p); low = txt.lower()
        rv5 = 'fort' in low.split('aussi')[0] if 'aussi' in low else 'fort' in low
        rv4 = 'confiance' in low and 'faite' in low
        ok += rv5 and rv4
        if not (rv5 and rv4): FAILS.add(k)
        (print if os.environ.get('V') else (lambda *a, **k: None))(f'  {os.path.basename(os.path.dirname(mix))}/{k:5s} RV5 {"Y" if rv5 else "-"} RV4 {"Y" if rv4 else "-"} ({time.time()-t0:.0f}s) {txt}', flush=True)
    print(f'== {mix}: {ok}/{len(tests)} decodes hear RV5 + RV4 · fails: {[k for k, p in tests if k in FAILS]}', flush=True)
