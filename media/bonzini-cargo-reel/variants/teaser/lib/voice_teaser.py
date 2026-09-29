"""Assemble the teaser voice track from v1's clean stems (read-only) -> out/voice.wav (48 kHz, dual-mono, 18.5 s).

Line starts get a 12 ms fade-in, line ends a 60 ms fade-out; internal hesitation cuts are 25 ms
equal-power crossfades made inside silence/noise.  Also writes data/voice_activity.json.
"""
import os, sys, json
import numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dsp
from timeline import VOICE, JOIN_XF, DUR, V

STEMS = '/tmp/claude-0/-home-user-bonzinilabs/5fd5d24c-f443-5c7d-8c0d-137b9d5733f0/scratchpad/reel/out/voice_stems'
SR = 48000
N = int(round(DUR * SR))


# clip-gain rides on the source stems: (clip, t0, t1, dB, ramp) — the speaker starts "Voi-" of "Voici"
# ~30 dB under the rest of the line; lift it so it survives under the music.
RIDES = [('B', 3.84, 4.225, 14.0, 0.03)]


def load(clip):
    x, sr = sf.read(os.path.join(STEMS, f'{clip}_final.wav'), always_2d=True)
    assert sr == SR
    x = x.mean(axis=1)
    t = np.arange(len(x)) / SR
    for c, t0, t1, g, r in RIDES:
        if c != clip: continue
        w = np.clip(np.minimum((t - t0) / r + 1, (t1 - t) / r), 0, 1)   # trapezoid, full gain on [t0, t1-r]
        w = np.where((t > t0 - r) & (t < t1), w, 0)
        x = x * 10 ** (g * w / 20)
    return x


def main():
    src = {c: load(c) for c in 'AB'}
    out = np.zeros(N)
    iv = []
    for i, (clip, a, b, o) in enumerate(VOICE):
        xf_in = JOIN_XF.get(i, 0.0)
        xf_out = JOIN_XF.get(i + 1, 0.0)
        a0 = a - xf_in / 2
        b0 = b + xf_out / 2
        seg = src[clip][int(round(a0 * SR)):int(round(b0 * SR))].copy()
        n = len(seg)
        env = np.ones(n)
        if xf_in:      # equal-power crossfade in
            k = int(round(xf_in * SR)); env[:k] = np.sin(np.linspace(0, np.pi / 2, k))
        else:
            k = int(0.012 * SR); env[:k] = np.sin(np.linspace(0, np.pi / 2, k)) ** 2
        if xf_out:
            k = int(round(xf_out * SR)); env[-k:] = np.cos(np.linspace(0, np.pi / 2, k))
        else:
            k = int(0.060 * SR); env[-k:] = np.cos(np.linspace(0, np.pi / 2, k)) ** 2
        seg *= env
        p = int(round((o - xf_in / 2) * SR))
        out[p:p + n] += seg[:max(0, min(n, N - p))]
        if not xf_in:
            iv.append([o, o + (b - a)])
        else:
            iv[-1][1] = o + (b - a)
    # per-line loudness report (lines = entries without an incoming crossfade)
    for s, e in iv:
        m = np.zeros(N, bool); m[int(s * SR):int(e * SR)] = True
        print(f'line {s:5.2f}-{e:5.2f}  {dsp.lufs_integrated(np.stack([out, out], 1), m):6.2f} LUFS')
    st = np.stack([out, out], axis=1)
    sf.write(os.path.join(V, 'out', 'voice.wav'), st.astype(np.float32), SR, subtype='FLOAT')
    # speech intervals, tight (from the envelope, gaps < 0.25 s merged) for ducking
    hop = int(0.01 * SR)
    e = np.sqrt(np.convolve(out ** 2, np.ones(2 * hop) / (2 * hop), 'same'))[::hop]
    ed = 20 * np.log10(e + 1e-9)
    thr = np.percentile(ed[ed > -80], 90) - 24
    act = ed > thr
    spans, on = [], None
    for i, a_ in enumerate(act):
        t = i * 0.01
        if a_ and on is None: on = t
        if not a_ and on is not None:
            if t - on > 0.06: spans.append([round(on, 2), round(t, 2)])
            on = None
    merged = [spans[0]]
    for s, e_ in spans[1:]:
        if s - merged[-1][1] < 0.25: merged[-1][1] = e_
        else: merged.append([s, e_])
    json.dump({'note': 'speech intervals on the 18.5 s teaser timeline (envelope, gaps < .25 s merged)', 'lines': iv,
               'intervals': merged}, open(os.path.join(V, 'data', 'voice_activity.json'), 'w'), indent=1)
    print('intervals', merged)


if __name__ == '__main__':
    main()
