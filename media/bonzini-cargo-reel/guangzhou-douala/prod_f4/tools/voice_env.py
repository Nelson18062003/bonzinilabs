"""voice_env.py — the live waveform of the « vraie voix » badge: an envelope per real-voice segment, from the wav.

usage:  python3 tools/voice_env.py [PROD] [--fps 60] [--work DIR (default PROD/../work)]
reads   SCORE.voices() through node (id, clip, in, out, src) — the same segments lib/mix.py plays
writes  PROD/data/voice_env.json = {fps, voices: {id: {clip, in, out, rms: [0…1], bands: [[…] × 3]}}}
        index i ↔ i / fps seconds after the segment's start (60_type.js reads it at t − T[id]); 3 bands: 150–600 Hz,
        600–2000 Hz, 2–6 kHz, each normalised to its own 95th percentile, attack 10 ms / release 90 ms (bars that move
        like a meter, not like noise). Source = demucs vocals for v1–v3 (work/vN_vocals.wav), else work/vN_48.wav."""
import json, os, sys, subprocess, argparse
import numpy as np, soundfile as sf
import scipy.signal as sps
HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument('prod', nargs='?', default=os.path.abspath(os.path.join(HERE, '..')))
ap.add_argument('--fps', type=int, default=60); ap.add_argument('--work')
a = ap.parse_args(); P = os.path.abspath(a.prod); WORK = os.path.abspath(a.work or os.path.join(P, '..', 'work'))
js = "const S=require(%s);console.log(JSON.stringify(S.voices()))" % json.dumps(os.path.join(P, 'overlay', 'scenes', '01_score.js'))
r = subprocess.run(['node', '-e', js], capture_output=True, text=True, cwd=P)
if r.returncode: sys.exit(r.stderr)
voices = json.loads(r.stdout.strip().splitlines()[-1])

def source(v):
    voc = os.path.join(WORK, f"{v['clip']}_vocals.wav"); org = os.path.join(WORK, f"{v['clip']}_48.wav")
    return voc if (v.get('src', 'auto') in ('auto', 'vocals') and os.path.exists(voc)) else org

def follow(x, fps, att=.010, rel=.090):
    ka, kr = np.exp(-1 / (att * fps)), np.exp(-1 / (rel * fps)); y = np.zeros_like(x); s = 0.0
    for i, v in enumerate(x): k = ka if v > s else kr; s = k * s + (1 - k) * v; y[i] = s
    return y

out = {'fps': a.fps, 'voices': {}}
for v in voices:
    path = source(v); info = sf.info(path); sr = info.samplerate
    y, _ = sf.read(path, start=int(round(v['in'] * sr)), stop=int(round(v['out'] * sr)), always_2d=True); y = y.mean(1)
    hop = sr / a.fps; n = int(len(y) / hop); win = int(hop * 2)
    def env(lo, hi):
        z = sps.sosfiltfilt(sps.butter(4, [lo, hi], 'bandpass', fs=sr, output='sos'), y) if lo else y
        e = np.array([np.sqrt(np.mean(z[max(0, int(i * hop - win / 2)):int(i * hop + win / 2)] ** 2) + 1e-12) for i in range(n)])
        e = 20 * np.log10(e + 1e-9); ref = np.percentile(e, 95); e = np.clip((e - (ref - 30)) / 30, 0, 1)    # 30-dB window under the loud level
        return [round(float(q), 3) for q in follow(e, a.fps)]
    out['voices'][v['id']] = dict(clip=v['clip'], src=os.path.basename(path), **{'in': v['in'], 'out': v['out']}, rms=env(0, 0),
                                  bands=[env(150, 600), env(600, 2000), env(2000, 6000)])
    print(f"{v['id']:4s} {v['clip']} {v['in']:.2f}–{v['out']:.2f} from {os.path.basename(path)}: {n} values @ {a.fps}/s")
json.dump(out, open(os.path.join(P, 'data', 'voice_env.json'), 'w'))
print('→ data/voice_env.json')
