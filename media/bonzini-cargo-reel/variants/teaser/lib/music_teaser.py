"""TEASER score — 18.5 s, 120 BPM, D minor, one chord per bar (Dm Bb F C | Dm Bb F C | Dm9), all synthesized.

  0.00        IMPACT (sub boom + crash + noise) and the groove is ON immediately (drop-style open)
  0.50        stab + clap accent (hook "TRADING CARGO")
  0-6.5       groove A: 4-on-the-floor, clap 2&4, 16th hats, pumping 8th bass, filtered arp
  6.0-7.0     build (snare roll 8ths->32nds, riser, reverse cymbal), kick out at 6.5
  7.00        IMPACT on the B->A cut; 7-8 half-bar breath (kick + sub, no bass/clap)
  8-14        groove B (brighter: open hats, arp +1 oct, shaker)
  13.5-16     breakdown (drums thin, bass out at 14.5) + riser + roll into
  16.00       FINAL HIT (logo lock): sub boom, crash, Dm(add9) chord, bell stack, arp echoes; fade 17.7-18.5

Run: nice -n 5 python3 lib/music_teaser.py   -> out/music.wav
"""
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dsp
from dsp import SR, N, BEAT, BAR, ns, mtof, add_at, pan, undb
import music as M            # v1 instruments (kick, clap, hat, bass_note, pluck, bell, sub_boom, riser, ...)

V = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(V, 'out')
T = np.arange(N) / SR
DUR = N / SR
PROG = ['Dm', 'Bb', 'F', 'C']


def chord(k):
    return 'Dm9' if k >= 8 else PROG[k % 4]


def auto(points, log=False):
    ts = np.array([p[0] for p in points], float); vs = np.array([p[1] for p in points], float)
    return np.exp(np.interp(T, ts, np.log(vs))) if log else np.interp(T, ts, vs)


def z():
    return np.zeros((N, 2))


def groove_on(t):
    return (0.0 <= t < 6.5) or (7.0 <= t < 14.5)


def render():
    st = {k: z() for k in ['kick', 'clap', 'roll', 'hats', 'perc', 'cymbal', 'bass', 'pad', 'arp', 'lead', 'impact', 'riser', 'stab']}
    kicks = []
    K = M.kick(True)
    for i in range(int(DUR / BEAT)):
        t = i * BEAT
        if groove_on(t) and not (13.5 <= t < 14.5 and i % 2):      # half-time kicks in the last bar before the break
            g = 1.0 if t >= 7.0 else 0.92
            add_at(st['kick'], K, t, g); kicks.append((t, 1.0))
    add_at(st['kick'], K, 16.0, 1.0); kicks.append((16.0, 1.0))

    claps = [M.clap(s) for s in range(4)]
    for b in range(0, 8):
        for beat in (1, 3):
            t = b * BAR + beat * BEAT
            if (0.4 <= t < 6.0) or (8.0 <= t < 14.0):
                add_at(st['clap'], claps[(b + beat) % 4], t, 0.8 if t >= 8 else 0.7)
    # hook accent on 0.50 (clap + snare layered)
    add_at(st['clap'], claps[1], 0.5, 0.9)
    add_at(st['roll'], pan(M.snare(3, 1.1), 0), 0.5, 0.55)

    hats = [M.hat(False, s) for s in range(6)]
    hat_o = M.hat(True, 0)
    acc = [0.45, 0.28, 1.0, 0.32]
    for i in range(int(DUR / (BEAT / 4))):
        t = i * BEAT / 4
        q = i % 4
        if 1.0 <= t < 6.5:
            add_at(st['hats'], pan(hats[i % 6], 0.25 if q % 2 else -0.1), t, 0.75 * acc[q])
        elif 7.5 <= t < 14.0:
            if q == 2 and t >= 8.0:
                add_at(st['hats'], pan(hat_o, 0.15), t, 0.55)
            else:
                add_at(st['hats'], pan(hats[i % 6], 0.3 if q % 2 else -0.15), t, 0.62 * acc[q])
            if t >= 8.0 and q in (1, 3):
                add_at(st['perc'], pan(M.shaker(i % 5), -0.45), t + 0.006, 0.42 if q == 1 else 0.28)

    # builds: snare roll 6.0-7.0 and 15.0-16.0 (8ths -> 16ths -> 32nds, rising)
    def roll(t0, lvl=1.0):
        times = list(np.arange(t0, t0 + .5, .125)) + list(np.arange(t0 + .5, t0 + .75, .0625)) + list(np.arange(t0 + .75, t0 + 1.0, .03125))
        for j, t in enumerate(times):
            u = (t - t0)
            s = dsp.butter(M.snare(j + int(t0 * 10), 1.0 + 0.5 * u), 'hp', 150 + 900 * u, 2)
            add_at(st['roll'], pan(s, 0.2 * np.sin(j)), t, lvl * (0.16 + 0.7 * u ** 1.5))
    roll(6.0); roll(15.0, 0.85)
    # tom fill into groove B + into the break
    for t0 in (7.5, 13.5):
        for j, m in enumerate([57, 52, 48, 45]):
            add_at(st['perc'], pan(M.tom(m, j), -0.4 + 0.27 * j), t0 + j * 0.125, 0.42)
    # cymbals
    for t0, g, d in ((0.0, 0.85, 2.4), (7.0, 0.8, 2.2), (8.0, 0.35, 1.8), (16.0, 0.95, 2.5)):
        add_at(st['cymbal'], M.crash(int(t0 * 3) + 1, d), t0, g)
    add_at(st['cymbal'], M.reverse_cymbal(1.0, 3), 6.0, 0.35)
    add_at(st['cymbal'], M.reverse_cymbal(1.5, 5), 14.5, 0.38)

    # bass: 8ths pumping; 7-8 sustained sub C; final D at 16
    for b in range(0, 8):
        ch = PROG[b % 4]; root = M.BASS_ROOT[ch]
        for e in range(8):
            t = b * BAR + e * BEAT / 2
            if not ((0.0 <= t < 6.5) or (8.0 <= t < 14.5)):
                continue
            hi = t >= 8.0 and e in (3, 6)
            vel = (0.8 if e % 2 else 1.0) * (0.85 if t < 7 else 1.0)
            note = M.bass_note(root + (12 if hi else 0), 0.2, cut_peak=(1100 if t < 7 else 1300) * vel, cut_base=105, seed=b * 8 + e)
            add_at(st['bass'], pan(note, 0.0), t, vel)
    for (t0, dur, m, g, att) in ((7.0, 1.0, 36, 0.55, 0.004), (16.0, 2.5, 38, 0.5, 0.004)):
        n = ns(dur + 0.5); tt = np.arange(n) / SR
        x = dsp.sine(mtof(m), n) + 0.25 * dsp.lp(dsp.saw(mtof(m), n), 300, 0.7)
        add_at(st['bass'], pan(x * dsp.adsr(n, att, 0.8, 0.6, 0.45, dur), 0), t0, g)

    # pad (supersaw chords), filter automation opens into 7.0 and 16.0
    pad = z()
    for b in range(0, 9):
        ch = chord(b); t0 = b * BAR
        dur = BAR if b < 8 else DUR - 16.0
        n = ns(dur + 0.6)
        seg = np.zeros((n, 2))
        for j, m in enumerate(M.PAD_VOICING[ch]):
            seg += dsp.supersaw(mtof(m), n, voices=7, detune_cents=16, seed=b * 10 + j) * (0.9 if j else 1.0)
        seg *= dsp.adsr(n, 0.02 if b in (0, 8) else 0.08, 0.6, 0.85, 0.45, dur)[:, None]
        add_at(pad, seg, t0 - (0.02 if b else 0.0))
    cut = auto([(0, 4200), (0.6, 1500), (1.4, 1250), (5.8, 1500), (6.98, 5200), (7.0, 2600), (7.9, 1300), (8.0, 1250),
                (13.8, 1500), (15.97, 5600), (16.0, 3400), (17.0, 2200), (DUR, 1100)], log=True)
    pad = dsp.hp(dsp.lp(pad, cut, 0.9), 110, 0.7)
    st['pad'] = pad * auto([(0, 1.0), (1.3, 0.8), (6.0, 0.8), (7.0, 0.95), (8.0, 0.7), (14.0, 0.7), (16.0, 1.0), (DUR, 1.0)])[:, None]

    # arp (16ths); groove B one octave up & sparser; final echoes
    arp = z()
    pat = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 1, 2, 3, 2]
    sparse = {0, 3, 6, 10, 12, 14}
    for i in range(int(16.0 / (BEAT / 4))):
        t = i * BEAT / 4; b = int(t // BAR); q = i % 16
        tones = M.ARP_TONES[PROG[b % 4]]; m = tones[pat[q]]
        if t < 1.0 or 6.5 <= t < 7.0:
            continue
        if t < 7.0:
            u = t / 7.0
            note = M.pluck(m, 800 * (4 ** u), 2.2, 0.14 + 0.05 * u); vel = (0.55 if q % 4 == 0 else 0.4) * 0.8
        elif t < 14.0:
            if q not in sparse: continue
            note = dsp.hp(M.pluck(m + 12, 2900, 1.8, 0.11), 650, 0.7); vel = 0.5 if q in (0, 10) else 0.38
        else:    # break: full 16ths opening with the riser
            u = (t - 14.0) / 2.0
            note = M.pluck(m, 900 * (6 ** u), 2.5, 0.12 + 0.1 * u); vel = (0.45 + 0.35 * u) * 0.5
        add_at(arp, pan(note, (-0.35 if i % 2 else 0.35) * (0.5 if t < 7 else 1.0)), t, vel)
    for j, (dt, m) in enumerate([(0.0, 74), (0.25, 81), (0.5, 76), (0.75, 77), (1.0, 81), (1.5, 74)]):
        add_at(arp, pan(M.pluck(m, 2600, 2.0, 0.2), [-0.4, 0.4][j % 2]), 16.0 + dt, 0.55 * (0.9 ** j))
    st['arp'] = arp
    for j, (t, m) in enumerate([(16.0, 74), (16.02, 81), (16.04, 88)]):
        add_at(st['lead'], pan(M.bell(m, 2.6, 50 + j), (-0.5, 0.0, 0.5)[j]), t, 0.35)
    # hook stabs (0.00 + 0.50): short bright Dm chord hits
    for t0, g in ((0.0, 1.0), (0.5, 0.7)):
        n = ns(0.45); tt = np.arange(n) / SR
        s = sum(dsp.supersaw(mtof(m), n, voices=5, detune_cents=18, seed=int(t0 * 10) + m) for m in (62, 65, 69, 74))
        s = dsp.lp(s, 1200 + 5000 * np.exp(-tt / 0.08), 1.2) * np.exp(-tt / 0.12)[:, None]
        add_at(st['stab'], dsp.fade(s, 0.001, 0.05), t0, g)

    # impacts & risers
    for t0, g, dur, tau in ((0.0, 0.95, 2.0, 0.45), (7.0, 0.9, 2.0, 0.40), (16.0, 0.9, 2.5, 0.6)):
        add_at(st['impact'], pan(M.sub_boom(dur, tau=tau), 0), t0, g)
        add_at(st['impact'], M.noise_burst(1.0, int(t0)), t0, 0.35 * g)
    add_at(st['riser'], M.riser(5.5, 7.0, 1, 300, 9000, (52, 62), 0.85), 5.5)
    add_at(st['riser'], M.riser(14.0, 16.0, 2, 200, 10000, (48, 62), 1.0), 14.0)
    return st, kicks


LEVELS = {'kick': 0.0, 'bass': -1.5, 'clap': -8.5, 'hats': -11.0, 'perc': -16.0, 'cymbal': -15.0,
          'pad': -9.5, 'arp': -13.0, 'lead': -18.0, 'roll': -11.0}


def mixdown(st, kicks):
    body = (T >= 8.0) & (T < 14.0)
    ref = dsp.lufs_integrated(st['kick'], body)
    gains = {}
    for k, tgt in LEVELS.items():
        mask = body if k not in ('lead', 'roll') else ((T >= 16.0) & (T < 17.5) if k == 'lead' else (T >= 15.5) & (T < 16.0))
        l = dsp.lufs_integrated(st[k], mask)
        gains[k] = undb(ref + tgt - l) if np.isfinite(l) else 1.0
    s = {k: st[k] * gains.get(k, 1.0) for k in st}
    groove = dsp.lufs_integrated(sum(s[k] for k in LEVELS if k not in ('lead', 'roll')), body)

    def level(name, a, b, rel):
        l = dsp.lufs_integrated(st[name], (T >= a) & (T < b)); gains[name] = undb(groove + rel - l); s[name] = st[name] * gains[name]
    level('impact', 7.0, 7.6, -1.5)
    level('riser', 15.3, 16.0, -7.5)
    level('stab', 0.0, 0.8, -6.0)

    sc_bass = sidechain(kicks, 0.85, 0.07)
    sc_syn = sidechain(kicks, 0.55, 0.11)[:, None]
    sc_arp = sidechain(kicks, 0.3, 0.09)[:, None]
    sc_bass = sc_bass[:, None]
    ir_hall = dsp.make_ir(3.0, 2.8, 2.2, 0.9, 0.03, seed=11)
    ir_room = dsp.make_ir(1.1, 0.9, 0.8, 0.35, 0.008, seed=12)
    drums = s['kick'] + s['clap'] + s['roll'] + s['hats'] + s['perc'] + s['cymbal']
    drums += dsp.reverb(s['clap'] + 0.3 * s['perc'] + 0.4 * s['roll'], ir_room, 0.35, 300, 8000)
    drums = dsp.compressor(drums, thr_db=-14, ratio=2.5, att=0.008, rel=0.12, knee_db=6)
    bass = dsp.biquad(dsp.hp(s['bass'], 32, 0.7) * sc_bass, 'peak', 420, 1.0, -2.0)
    syn = s['pad'] * sc_syn + (s['arp'] + s['lead']) * sc_arp + s['stab']
    dly = dsp.pingpong(s['arp'], 0.375, 0.4, 6, 4200, 500) + dsp.pingpong(s['lead'], 0.5, 0.45, 5, 5000, 600, 'R')
    rev = dsp.reverb(s['pad'] * 0.35 + s['arp'] * 0.6 + s['lead'] * 0.9 + s['stab'] * 0.4, ir_hall, 0.5, 250, 7500)
    syn = syn + 0.45 * dly * sc_arp + rev * sc_syn
    # voice pocket on the synth bus while the narrator speaks (1.4-15.6)
    # voice pocket while the narrator speaks (1.4-15.6): synth bus 1.4 kHz / 700 Hz dips, bass bus low-mid dip
    # (the drawn vowels, e.g. "entrepôô", have their formants at 400-900 Hz)
    pocket = dsp.biquad(dsp.biquad(dsp.biquad(syn, 'peak', 1400, 0.55, -4.5), 'peak', 700, 0.9, -4.0), 'peak', 400, 1.0, -2.5)
    pk = auto([(0, 0.0), (1.2, 0.0), (1.4, 1.0), (15.6, 1.0), (15.9, 0.0), (DUR, 0.0)])[:, None]
    syn = syn * (1 - pk) + pocket * pk
    bpk = dsp.biquad(dsp.biquad(bass, 'peak', 550, 0.9, -5.0), 'hs', 900, 0.7, -4.0)
    bass = bass * (1 - pk) + bpk * pk
    fx = s['impact'] + s['riser']
    fx = fx + dsp.reverb(s['impact'] + 0.5 * s['riser'], ir_hall, 0.3, 200, 6000)
    macro = undb(auto([(0, 0.0), (1.3, -1.0), (6.0, -1.0), (6.98, 0.0), (7.0, 0.0), (7.9, -1.0), (8.0, 0.0),
                       (14.0, 0.0), (14.5, -2.0), (15.95, -0.5), (16.0, 0.0), (DUR, 0.0)]))[:, None]
    mix = (drums + bass + syn) * macro + fx
    mix = dsp.butter(mix, 'hp', 28, 4)
    mix = dsp.biquad(mix, 'ls', 70, 0.7, -2.5)
    f = np.ones(N); m = T >= 17.7
    f[m] = np.cos((T[m] - 17.7) / (DUR - 17.7) * np.pi / 2) ** 2
    mix *= f[:, None]
    mix = dsp.compressor(mix, thr_db=-16, ratio=1.8, att=0.02, rel=0.2, knee_db=8)
    mix *= undb(-14.0 - dsp.lufs_integrated(mix))
    mix = dsp.clipper(mix, -4.0)
    mix, gr = dsp.limiter(mix, -1.2, 0.004, 0.08)
    return mix, {k: round(float(20 * np.log10(v)), 2) for k, v in gains.items()}


def sidechain(kick_times, depth, rel_tau=0.085, hold=0.012):
    g = np.ones(N); L = ns(0.45); tt = np.arange(L) / SR
    shape = np.where(tt < 0.003, tt / 0.003, np.where(tt < 0.003 + hold, 1.0, np.exp(-(tt - 0.003 - hold) / rel_tau)))
    for tk, d in kick_times:
        i = ns(tk); n = min(L, N - i)
        if n > 0: g[i:i + n] = np.minimum(g[i:i + n], 1 - d * depth * shape[:n])
    return g


def main():
    st, kicks = render()
    mix, gains = mixdown(st, kicks)
    dsp.save(os.path.join(OUT, 'music.wav'), mix[:N], 'FLOAT')
    print(json.dumps({'lufs': dsp.lufs_integrated(mix), 'peak': float(dsp.db(np.abs(mix).max())), 'gains': gains}))
    os.makedirs(os.path.join(OUT, 'audio_report'), exist_ok=True)
    dsp.report_png(os.path.join(OUT, 'audio_report', 'music.png'), mix, 'teaser music',
                   [(0, 'IMPACT'), (0.5, 'stab'), (6, 'build'), (7, 'IMPACT/CUT'), (8, 'groove B'), (14, 'break'), (16, 'LOCK'), (17.7, 'fade')],
                   [(0, 6.5, 'GROOVE A'), (6, 7, 'BUILD'), (8, 14, 'GROOVE B'), (14, 16, 'BREAK'), (16, DUR, 'END')])


if __name__ == '__main__':
    main()
