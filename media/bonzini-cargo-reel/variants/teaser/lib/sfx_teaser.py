"""TEASER sound design (18.5 s): impacts on hits, whooshes on cuts, UI blips/dings on keyword slams.
Reuses v1's synth building blocks (lib/sfx.py). Run: nice -n 5 python3 lib/sfx_teaser.py -> out/sfx.wav
"""
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dsp
from dsp import SR, N, ns, mtof, add_at, stereo, pan, undb
import sfx as X
from sfx import D6, E6, F6, G6, A6, A5, D7, F7, A7

V = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(V, 'out')


def render():
    ir_small = dsp.make_ir(0.9, 0.7, 0.6, 0.3, 0.006, seed=21)
    ir_big = dsp.make_ir(2.6, 2.3, 2.0, 0.8, 0.025, seed=22)
    dry = np.zeros((N, 2)); wet = np.zeros((N, 2)); wet_s = np.zeros((N, 2))
    cues = []

    def put(sig, t, gain_db, send_big=0.0, send_small=0.25, name=None):
        g = undb(gain_db); s = stereo(sig)
        add_at(dry, s, t, g)
        if send_big: add_at(wet, s, t, g * send_big)
        if send_small: add_at(wet_s, s, t, g * send_small)
        if name: cues.append((round(t, 3), name))

    SPEECH = [(1.40, 6.95), (7.25, 11.25), (11.55, 15.63)]

    def swish(t_cut, dur=0.28, lvl=-15, seed=0, p=(-0.5, 0.5), hi=5200):
        """short whoosh whose peak lands exactly on the cut; inside speech it is darker (<2.4 kHz peak
        sweep, stays out of the consonant band) and 5 dB lower so it never masks a word"""
        talk = any(a <= t_cut <= b for a, b in SPEECH)
        f_lo, f_hi, g = (300, 2400, lvl - 5) if talk else (700, hi, lvl)
        put(X.whoosh(dur, 0.78, f_lo, f_hi, p[0], p[1], seed, 0.3 if talk else 0.15), t_cut - 0.78 * dur, g, 0.12, 0.2, 'swish')

    # ---- HOOK 0.00 - 1.30
    put(X.impact(1.25, 10, 1.8), 0.0, 0.0, 0.45, name='IMPACT hook')
    put(X.glitch(0.14, 40, 2000, 1.0), 0.0, -14, 0.1, name='slam glitch')
    put(pan(X.chirp(220, 2600, 0.26, 1), -0.2), 0.02, -15, 0.2)
    put(X.impact(0.6, 11, 0.8), 0.5, -7, 0.3, name='hit TRADING CARGO')
    put(pan(X.click(5), 0.1), 0.5, -10, 0.2)
    put(X.scan_sweep(0.35, 900, 9000, 3, -0.8, 0.8), 0.58, -18, 0.15, name='underline sweep')
    put(X.glitch(0.13, 41, 2200, 0.9), 0.95, -17, 0.1, name='hook glitch-out')
    # ---- cuts (whooshes)
    for j, (t, lvl, dur) in enumerate([(1.0, -7, .26), (2.0, -8, .24), (3.0, -7, .26), (5.0, -12, .22), (8.0, -6, .3),
                                       (9.0, -10, .22), (9.5, -8, .24), (10.5, -7, .26), (11.5, -6, .3), (12.5, -7, .24),
                                       (13.5, -7, .24), (14.5, -6, .32)]):
        swish(t, dur, lvl, 100 + j, (-0.5, 0.5) if j % 2 else (0.5, -0.5))
    # whip pan 4.0-4.5 (big L->R) + landing
    put(X.whoosh(0.62, 0.55, 300, 4200, -0.95, 0.95, 9, 0.5), 3.92, -4, 0.2, name='whip')
    put(X.impact(0.5, 12, 0.6), 4.5, -12, 0.2, name='whip land')
    # ---- slam 1: CONTENEUR (2.32) + ARRIVÉ ✓ (3.14)
    put(X.impact(0.7, 13, 0.9), 2.32, -6, 0.3, name='CONTENEUR slam')
    put(X.glitch(0.1, 42, 2500, 1.0), 2.32, -17, 0.1)
    put(pan(X.beep(A6, 0.03, 2, 0.2), 0.2), 2.36, -16, 0.2)
    ding = pan(X.bell(D6, 1.1, 1.0, 3.5, 0.3), -0.15)
    add_at(ding, pan(X.bell(A6, 1.3, 1.0, 3.5, 0.4), 0.15), 0.08, 0.9)
    put(pan(X.click(6), 0), 3.14, -9, 0.1, name='ARRIVÉ stamp')
    put(ding, 3.16, -11, 0.4)
    put(X.glitch(0.12, 43, 1800, 1.0, fall=True), 3.9, -17, 0.1, name='slam1 out')
    # ---- transition 7.00: suck-in, glitch, impact, whoosh out
    put(X.layer((X.reverse_swell(0.5, 12, ir_small), 0.8), (X.whoosh(0.5, 0.97, 600, 6000, -0.4, 0.2, 13, 0.2), 1.0)), 6.5, -11, name='suck-in')
    put(X.glitch(0.2, 60, 1400, 1.0), 6.8, -16, 0.1)
    put(X.impact(1.1, 20, 1.5), 7.0, -1.0, 0.45, name='IMPACT cut B->A')
    put(X.glitch(0.26, 61, 1200, 1.0), 7.0, -16, 0.2)
    put(X.whoosh(0.55, 0.22, 500, 4000, 0.3, -0.5, 14, 0.3), 7.02, -17, 0.25)
    # ---- slam 2: COLIS DÉCHARGÉS ✓ (8.41), check completes ~8.80
    n = ns(0.12); tt = np.arange(n) / SR
    pop = dsp.sine(1300 * np.exp(-tt / 0.02) + 650, n) * np.exp(-tt / 0.03)
    put(X.layer((pan(dsp.fade(pop, 0.0003, 0.02), -0.15), 1.0), (pan(X.click(16), 0), 0.4)), 8.41, -7, 0.15, name='COLIS slam pop')
    put(X.impact(0.6, 14, 0.8), 8.41, -9, 0.25)
    ding2 = pan(X.bell(D6, 1.2, 1.0, 3.5, 0.35), -0.15)
    add_at(ding2, pan(X.bell(A6, 1.4, 1.0, 3.5, 0.45), 0.15), 0.09, 0.9)
    put(ding2, 8.80, -11, 0.4, name='check ding')
    # ---- slam 3: EN TOUTE SÉCURITÉ (9.79), shield ping on "sécurité" (10.17)
    put(X.impact(0.55, 15, 0.8), 9.79, -9, 0.25, name='SÉCURITÉ slam')
    put(X.glitch(0.1, 44, 2500, 1.0), 9.79, -18, 0.1)
    sp = X.layer((pan(X.bell(D6, 1.6, 0.7, 2.0, 0.55), -0.15), 1.0), (pan(X.bell(D6 + 12, 1.2, 0.5, 2.0, 0.35), 0.15), 0.3))
    put(sp, 10.17, -11, 0.5, name='shield ping')
    put(X.glitch(0.1, 45, 1800, 1.0, fall=True), 11.2, -18, 0.1)
    # ---- line 3: small glitch at 11.5, shimmer on "confiance"
    put(X.glitch(0.1, 46, 2200, 0.8), 11.46, -19, 0.1)
    put(X.shimmer(0.7, 38, level=1.0), 14.6, -16, 0.6, name='shimmer confiance')
    # ---- end card
    put(X.reverse_swell(1.0, 39, ir_big), 15.0, -4, name='reverse swell')
    put(X.impact(1.4, 40, 2.2), 16.0, -2.5, 0.6, name='IMPACT logo lock')
    put(X.shimmer(1.0, 41, (D7, E6 + 12, F7, A7, 105, 110), 16, 1.0), 16.02, -16, 0.7)
    put(X.ticks(16.15, 16.7, 28, 40, fr=(2500, 7000)), 16.15, -17, 0.0, 0.3, name='decrypt ticks')
    put(pan(X.beep(A6, 0.035, 41, 0.1), 0.0), 16.75, -13, 0.3, name='tagline blip')
    put(pan(X.beep(D7, 0.03, 42, 0.1), 0.15), 17.05, -15, 0.3, name='location blip')

    y = dry + dsp.reverb(wet, ir_big, 0.6, 250, 8000) + dsp.reverb(wet_s, ir_small, 0.5, 400, 10000)
    y = dsp.butter(dsp.dc_block(y, 20), 'hp', 35, 2)
    f = np.ones(N); T = np.arange(N) / SR; m = T >= 17.9
    f[m] = np.cos((T[m] - 17.9) / (N / SR - 17.9) * np.pi / 2) ** 2
    return y * f[:, None], cues


def main():
    y, cues = render()
    y = y * undb(-3.0) / dsp.true_peak_env(y).max()
    dsp.save(os.path.join(OUT, 'sfx.wav'), y[:N], 'FLOAT')
    os.makedirs(os.path.join(OUT, 'audio_report'), exist_ok=True)
    json.dump({'cues': cues}, open(os.path.join(OUT, 'audio_report', 'sfx_cues.json'), 'w'), ensure_ascii=False, indent=1)
    print('sfx', dsp.lufs_integrated(y), len(cues), 'cues')


if __name__ == '__main__':
    main()
