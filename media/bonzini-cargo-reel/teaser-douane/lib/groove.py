"""« Ni plus. Ni moins. (Douane Groove) » — the teaser's original track, arranged bar by bar from the storyboard (§4).
120 BPM, E minor, afro-house / 3-step; the drum kit is made of paperwork. Renders the main cut (24 s) and the short cut (15 s)
from the same bar recipes, plus stems and data/grid_<cut>.json (every hit: t, instrument, role) to sync the picture.
usage: python3 groove.py [main|short|both]   → out/music_<cut>.wav, out/stems_<cut>/*.wav, data/grid_<cut>.json"""
import os, sys, json, math
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import instruments as I
from instruments import dsp, SR, n_, m2f
T = os.path.abspath(os.path.join(HERE, '..'))
BEAT, STEP, BAR = .5, .125, 2.0

class Mix:
    def __init__(self, dur):
        self.n = n_(dur) + n_(1.5); self.st = {}; self.grid = []
    def put(self, stem, sig, t, g=1.0, pan=0.0, role=None, inst=None):
        if t < -1e-6: sig = sig[n_(-t):]; t = 0
        i = n_(t); sig = np.asarray(sig, float)
        if sig.ndim == 2: sig = sig.mean(1)
        if i >= self.n: return
        s = sig[:self.n - i] * g
        if stem not in self.st: self.st[stem] = np.zeros((self.n, 2))
        L, R = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
        self.st[stem][i:i + len(s), 0] += s * L; self.st[stem][i:i + len(s), 1] += s * R
        if role: self.grid.append({'t': round(t, 4), 'inst': inst or stem, 'role': role})

# ---------- voice (TTS words, tuned) -----------------------------------------------------------------------------------
VO = os.path.join(T, 'audio', 'vo')
def _load(name):
    import soundfile as sf
    from scipy.signal import resample_poly
    y, sr = sf.read(os.path.join(VO, name)); y = y if y.ndim == 1 else y.mean(1)
    g = math.gcd(sr, SR); y = resample_poly(y, SR // g, sr // g)
    nz = np.where(np.abs(y) > .02 * np.abs(y).max())[0]; y = y[max(0, nz[0] - n_(.01)):nz[-1] + n_(.06)]
    return y / (np.abs(y).max() + 1e-9) * .9

def _syllables(y, k=2):
    """split a short utterance into k syllables at the deepest energy valleys"""
    fr = n_(.01); e = np.sqrt(np.convolve(y ** 2, np.ones(fr) / fr, 'same')); e = dsp.onepole_lp(e, 40)
    n = len(y); cuts = []
    for j in range(1, k):
        lo, hi = int(n * (j / k - .22)), int(n * (j / k + .22)); i = lo + int(np.argmin(e[lo:hi])); cuts.append(i)
    b = [0] + cuts + [n]; return [y[b[i]:b[i + 1]] for i in range(k)]

def _tune(seg, midi):
    """shift a syllable so its median pitch lands on `midi` (keeps the natural contour)"""
    import librosa
    f0, vf, _ = librosa.pyin(seg.astype(np.float32), fmin=120, fmax=500, sr=SR, frame_length=2048)
    f = f0[vf] if vf is not None and np.any(vf) else np.array([])
    if len(f) < 3: return seg
    steps = 12 * math.log2(m2f(midi) / float(np.median(f)))
    steps = max(-7, min(7, steps))
    return librosa.effects.pitch_shift(seg.astype(np.float32), sr=SR, n_steps=steps, bins_per_octave=12)

def sung(name, notes, gap=.03):
    y = _load(name); parts = _syllables(y, len(notes)); out = []
    for p, m in zip(parts, notes): out.append(_tune(p, m)); out.append(np.zeros(n_(gap)))
    v = np.concatenate(out)
    v = dsp.hp(v, 120); ir = dsp.make_ir(.9, .8, .6, .3, predelay=.012)
    v = np.concatenate([v, np.zeros(n_(.4))]); w = dsp.reverb(np.stack([v, v], 1), ir, wet=.18)[:, 0]
    return v + w

def said(name, stretch=1.0, gain=1.0):
    """the narrator's word as spoken (intelligible), tightened in time, compressed, a short plate"""
    import librosa
    y = _load(name)
    if abs(stretch - 1) > .01: y = librosa.effects.time_stretch(y.astype(np.float32), rate=stretch)
    y = dsp.hp(y, 90)
    y = y / (np.abs(y).max() + 1e-9) * .95 * gain
    y = np.concatenate([y, np.zeros(n_(.35))]); ir = dsp.make_ir(.8, .7, .5, .3, predelay=.01)
    return y + dsp.reverb(np.stack([y, y], 1), ir, wet=.1)[:, 0]

def whisper(name, seed=0):
    """the « plus… » whisper: the TTS word through a noise vocoder (keeps the envelope, replaces the voice by breath)"""
    y = _load(name); parts = _syllables(y, 2); p = parts[1]
    fr = n_(.008); e = np.sqrt(np.convolve(p ** 2, np.ones(fr) / fr, 'same'))
    nz = I.noise(len(p), seed); bands = [(400, 900), (900, 1800), (1800, 3500), (3500, 7000)]; out = np.zeros(len(p))
    for lo, hi in bands:
        b = dsp.hp(dsp.lp(p, hi), lo); eb = np.sqrt(np.convolve(b ** 2, np.ones(fr) / fr, 'same'))
        out += dsp.hp(dsp.lp(nz, hi), lo) * eb
    out = out / (np.abs(out).max() + 1e-9) * .6
    return out

def spoken(name):
    y = _load(name); y = dsp.hp(y, 90)
    y = np.concatenate([y, np.zeros(n_(.3))]); ir = dsp.make_ir(.7, .6, .5, .3, predelay=.008); w = dsp.reverb(np.stack([y, y], 1), ir, wet=.12)[:, 0]
    return y + w

# ---------- recipes ----------------------------------------------------------------------------------------------------
CH = I.CHORDS
def add(*sigs):
    """sum signals of different lengths"""
    n = max(len(x) for x in sigs); out = np.zeros(n)
    for x in sigs: out[:len(x)] += x
    return out
def tchak(mx, t, role='tchak'):
    mx.put('fx', I.stamp(3), t, 1.0, role=role, inst='tchak')
    mx.put('fx', I.mf.thud_s(.6, 180, 70, 5), t, .35)

def motor(f_hz, dur, g=.18, seed=0, contour=None):
    """the thermal printer's stepper motor, tuned (E3): a buzzy pulse train in 16ths + a tone"""
    n = n_(dur); t = np.arange(n) / SR
    f = np.full(n, f_hz) if contour is None else contour
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = dsp.lp(np.sign(np.sin(ph)) * .6 + np.sin(ph * 2) * .3, 2200)
    gate = ((t % STEP) / STEP < .45).astype(float); gate = dsp.onepole_lp(gate, 300)
    tick = np.zeros(n)
    for k in range(int(dur / STEP) + 1):
        i = n_(k * STEP); c = dsp.hp(I.noise(n_(.012), seed + k), 900) * np.linspace(1, 0, n_(.012))
        tick[i:i + len(c)] += c[:n - i] * .8
    return (tone * gate * .55 + dsp.lp(tick, 1600)) * g

def talking_printer(t0, dur=1.0):
    """motor pitch following « on ve-rra… / à l'a-rri-vée » (no voice): 3 + 4 syllable contour around E3"""
    n = n_(dur); t = np.arange(n) / SR; base = m2f(52)
    sylls = [(0, .12, 0), (.13, .12, 2), (.26, .22, -1), (.5, .1, 0), (.61, .1, 3), (.72, .1, 5), (.83, .17, 1)]
    f = np.full(n, base)
    for a, d, st in sylls:
        i0, i1 = n_(a), min(n, n_(a + d)); f[i0:i1] = base * 2 ** (st / 12)
    f = dsp.onepole_lp(f, 30)
    return motor(base, dur, .22, 11, contour=f)

def pad_bar(mx, t, ch, dur=BAR, cutoff=1400, g=1.0):
    mx.put('music', I.pad(CH[ch], dur + .3, g, cutoff=cutoff), t, 1.0)

def clean_kit(mx, t, swing=False, full=True, g=1.0, hats=True):
    """the 4 « due » instruments: stamp kick (4 on the floor), calculator clave, printer shaker, keyboard hat"""
    for s in (1, 5, 9, 13): mx.put('kit', add(I.stamp(20 + s) * .55 * g, I.kick(.6 * g)), t + (s - 1) * STEP, 1.0, role='due_kick' if s == 1 else None, inst='stamp')
    for s in (1, 4, 7, 11, 13): mx.put('kit', I.calc(30 + s, .7 * g), t + (s - 1) * STEP, 1.0, .25)
    for s in range(1, 17): mx.put('kit', I.shaker(.8 * g, 40 + s), t + (s - 1) * STEP, 1.0, -.2)
    if hats:
        for s in (3, 7, 11, 15): mx.put('kit', I.typing(1, .05, 50 + s, .9 * g), t + (s - 1) * STEP, .8, .3)

def three_step(mx, t, g=1.0, logs=True, stabs=True, osti=True, ch='Em9', kick=True):
    sw = .017
    if kick:
        for s in (1, 5, 9): mx.put('kit', I.kick(.95 * g), t + (s - 1) * STEP, 1.0, role='kick3' if s == 1 else None, inst='kick')
    for s in range(1, 17):
        tt = t + (s - 1) * STEP + (sw if s % 2 == 0 else 0); mx.put('kit', I.shaker(.9 * g if s % 2 else .5 * g, 60 + s), tt, 1.0, -.25)
    for s in (3, 7, 11, 15): mx.put('kit', I.hat_open(.75 * g, 70 + s), t + (s - 1) * STEP, 1.0, .3)
    for s in (1, 4, 7, 11): mx.put('kit', I.calc(80 + s, .6 * g), t + (s - 1) * STEP, 1.0, .2)
    if logs:
        root = {'Em9': 40, 'Cmaj7#11': 36, 'Am9': 45, 'B7sus4': 47, 'B7b9': 47}[ch]
        for s, m, gl in ((1, root, None), (4, root, None), (7, root, root + 3), (11, root, None), (14, root, root - 2)):
            mx.put('bass', I.log_drum(m, .2 if gl is None else .24, glide_to=gl, g=g), t + (s - 1) * STEP, 1.0)
    if stabs:
        for s in (3, 7, 11, 15): mx.put('music', I.stab(CH[ch], .12, .8 * g), t + (s - 1) * STEP, 1.0)
    if osti:
        notes = [64, 67, 71, 66, 64, 71, 67, 64, 69, 67, 66, 71]                         # 12 triplet 8ths (4 against 3)
        for k, m in enumerate(notes):
            tt = t + k * (BAR / 12); mx.put('music', I.guitar_mute(m, 90 + k, .55 * g), tt, 1.0, -.35)
            if k % 3 == 0: mx.put('music', I.balafon(m + 12, .3, 100 + k, .22 * g), tt, 1.0, .35)

def logo(mx, t0, voice_t=None, g=1.0):
    for k, (m, d) in enumerate(((64, .25), (67, .25), (71, .25), (76, 1.25))):
        mx.put('music', I.balafon(m, .5 if k < 3 else 1.6, 200 + k, .55 * g), t0 + k * .25, 1.0, (k - 1.5) * .2, role='logo' if k == 0 else None, inst='balafon')
    if voice_t is not None: mx.put('vox', spoken('S3_s2.wav'), voice_t, .9, role='bonzini', inst='voice')

# ---------- the two cuts -------------------------------------------------------------------------------------------------
def bar_M1(mx, t):
    tchak(mx, t)
    mx.put('kit', motor(m2f(52), 1.0, .16, 1), t, 1.0)
    mx.put('kit', talking_printer(t + 1.0), t + 1.0, 1.0, role='talk', inst='printer')
    for k, m in enumerate((64, 67, 71, 76)): mx.put('music', dsp.lp(I.balafon(m, .45, 300 + k), 600), t + k * .5, .35, (k - 1.5) * .2)
    for k in (1.0, 1.5): mx.put('fx', I.paper(10 + int(k * 2), .5), t + k, 1.0, role='line', inst='paper')
    pad_bar(mx, t, 'Em9', cutoff=800, g=.8)

def bar_M2(mx, t):
    pad_bar(mx, t, 'Cmaj7#11', cutoff=1500)
    for s in (1, 5, 9, 13): mx.put('kit', add(I.stamp(20 + s) * .5, I.kick(.55)), t + (s - 1) * STEP, 1.0, role='due', inst='stamp')
    for s in (4, 7, 11, 13): mx.put('kit', I.calc(30 + s, .7), t + .25 + (s - 1) * STEP - .375, 1.0, .25)
    for s in range(5, 17): mx.put('kit', I.shaker(.8, 40 + s), t + (s - 1) * STEP, 1.0, -.2)
    for s in (7, 11, 15): mx.put('kit', I.typing(1, .05, 50 + s, .9), t + (s - 1) * STEP, .8, .3)
    mx.put('bass', I.bass_sub(36, .45), t, 1.0)
    for k in range(4): mx.grid.append({'t': round(t + k * .25, 4), 'inst': ['stamp', 'calc', 'printer', 'keys'][k], 'role': 'due_line'})
    mx.put('fx', I.rim(.4, 9), t + 1.75, .5, role='due_rule', inst='wood')
    for k in (1.0, 1.5): mx.put('fx', I.paper(20 + int(k * 2), .45), t + k, 1.0, role='line', inst='paper')

def bar_M3(mx, t):
    pad_bar(mx, t, 'Am9', cutoff=1700); clean_kit(mx, t); mx.put('bass', I.bass_sub(45, .45), t, 1.0)
    intruders_win(mx, t)
    for k, w in enumerate((.125, .625, 1.125, 1.625)): mx.put('vox', whisper('S1_s1.wav', k), t + w, .55, (k % 3 - 1) * .5, role='plus', inst='whisper')
    for k, w in enumerate((0, .5, 1.0, 1.5)): mx.put('fx', I.paper(30 + k, .5), t + w, 1.0, role='q', inst='paper')

def intruders_win(mx, t):
    """intruder k enters at t + .5·(k-1) and stays to the end of the bar"""
    for s in (6, 14): mx.put('kit', dsp.lp(I.stamp(110 + s), 400) * 1.3, t + (s - 1) * STEP, 1.0, .15)
    for s in range(5, 17, 2): p = I.printer(.1, 120 + s, 120, .25); mx.put('kit', p, t + (s - 1) * STEP, 1.0, -.3); mx.put('kit', p * .7, t + s * STEP, 1.0, .3)
    for s in (9, 13): mx.put('kit', add(dsp.lp(I.stamp(130 + s), 1200) * .9, I.conga(55, .6, 131 + s, slap=True)), t + (s - 1) * STEP, 1.0, -.1)
    mx.put('fx', add(I.rim(1.0, 140), I.calc(141, .8)), t + 1.5, 1.0, role='taxi', inst='taximeter')
    for k in range(16): mx.put('kit', I.calc(150 + k, .4), t + 1.5 + k * .03125, 1.0, .4)

def bar_M4(mx, t):
    pad_bar(mx, t, 'B7sus4', cutoff=1100)
    sub = Mix(2.2); clean_kit(sub, 0, g=.8); intruders_win(sub, 0)
    far = sum(sub.st.values()); far = far[:n_(2.2)]
    ir = dsp.make_ir(4.0, 3.5, 3.0, 1.2, predelay=.03); far = far * .3 + dsp.reverb(far, ir, wet=.8); far = dsp.lp(far, 3000)
    mx.put('kit', far.mean(1), t, .9)
    for s in (1, 11): mx.put('kit', I.kick(.9), t + (s - 1) * STEP, 1.0, role='half' if s == 1 else None, inst='kick')
    sw = I.bass_sub(35, 2.0) * np.linspace(.2, 1, n_(2.0)); mx.put('bass', sw, t, 1.0)
    mx.put('fx', add(I.paper(40, 1.0), I.whoosh(.5, 41, 200, 2500, .6)), t, 1.0, role='pull', inst='crumple')
    mx.put('fx', add(I.kick(.7) * .6, dsp.lp(I.noise(n_(.2), 42), 500) * np.exp(-np.arange(n_(.2)) / (SR * .05)) * .5), t + 1.5, 1.0, role='fold', inst='thud')
    for k in range(10): mx.put('vox', whisper('S1_s1.wav' if k % 2 else 'S1_s2.wav', 200 + k), t + k * .2, .35, [-.7, 0, .7][k % 3])

def bar_M5(mx, t, dur=1.5):
    mx.put('music', I.pad(CH['B7sus4'], 1.0, .9, cutoff=1600), t, 1.0); mx.put('music', I.pad(CH['B7b9'], .55, .9, cutoff=2000), t + 1.0, 1.0)
    mx.put('fx', I.riser(dur, 50), t, 1.0, role='rise', inst='riser')
    for k in range(int(1.0 / STEP)): mx.put('kit', I.kick(.35 + .3 * k / 8), t + k * STEP, 1.0)
    for k in range(int(.5 / (STEP / 2))): mx.put('kit', I.kick(.65), t + 1.0 + k * STEP / 2, 1.0)
    sw = I.bass_sub(35, dur) * np.linspace(.3, 1.1, n_(dur)); mx.put('bass', sw, t, 1.0)
    for k in range(7): mx.put('vox', whisper('S1_s2.wav', 300 + k), t + k * .2, .4, [-.6, .6, 0][k % 3])
    mx.grid.append({'t': round(t + 1.2333, 4), 'inst': 'bitcrush', 'role': 'glitch'})

def silence_gap(mx, t):
    mx.put('fx', I.reverse_stamp(7, 1.0)[-n_(.2):], t + .3, .9, role='revstamp', inst='stamp')

def bar_drop(mx, t, ch, voice=None):
    pad_bar(mx, t, ch, cutoff=2400, g=.9)
    three_step(mx, t, ch=ch)
    if voice: mx.put('vox', voice[1], t + voice[0], 1.0, role=voice[2], inst='voice')

def bar_M6(mx, t):
    mx.put('fx', I.sub_drop(1.0), t, 1.0, role='drop', inst='sub')
    for k in range(10): mx.put('fx', I.paper(400 + k, .35) * (1 - k / 12), t + k * .06, 1.0, (k % 3 - 1) * .4)
    bar_drop(mx, t, 'Em9', (1.5, said('X2_niplus.wav', 1.0), 'niplus'))

def bar_M7(mx, t):
    for k, w in enumerate((0, .5, 1.0)):
        n = n_(.45); tt = np.arange(n) / SR; st = dsp.tv_biquad(I.noise(n, 500 + k), 'bp', 300 * (6 ** (tt / .45)), 3.0) * (tt / .45) ** 1.5 * .5
        mx.put('fx', st, t + w, 1.0, role='stretch', inst='rubber')
    v = said('X2_nimoins.wav')
    mx.put('fx', add(I.pop(510, .8), I.whoosh(.15, 511, 1500, 6000, .4)), t + 1.5, 1.0, role='snap', inst='elastic')
    bar_drop(mx, t, 'Cmaj7#11', (1.5, v, 'nimoins'))

def bar_M8(mx, t):
    bar_drop(mx, t, 'Am9')
    for w, ins in ((.375, 'clave'), (.5, 'kick'), (.75, 'log'), (.875, 'clave')): mx.grid.append({'t': round(t + w, 4), 'inst': ins, 'role': 'seg'})
    mx.grid.append({'t': round(t + 1.0, 4), 'inst': 'kick', 'role': 'lock'})

def bar_M9(mx, t):
    pad_bar(mx, t, 'B7sus4', cutoff=2200, g=.6); pad_bar(mx, t + 1.0, 'B7b9', BAR / 2, cutoff=2200, g=.6)
    three_step(mx, t, ch='B7sus4', stabs=False)
    for k in range(7): mx.put('fx', I.typing(1, .05, 600 + k, 1.1), t + k * STEP, 1.0, .2, role='key', inst='keyboard')

def bar_M10(mx, t):
    pad_bar(mx, t, 'Em9', cutoff=1800)
    three_step(mx, t, g=.8, kick=False, stabs=False)
    v = said('X2_niplusnimoins.wav', 1.1)
    mx.put('vox', v, t + .9, 1.0, role='niplus_nimoins', inst='voice')

def bar_M11(mx, t):
    pad_bar(mx, t, 'Em9', cutoff=1500, g=.8)
    three_step(mx, t, g=.25, stabs=False, osti=False)
    logo(mx, t, voice_t=t + .8)
    tchak(mx, t + 1.5, 'tchak_end')

def bar_M12(mx, t, dur=2.0):
    pad_bar(mx, t, 'Em9', dur, cutoff=1200, g=.8)
    mx.put('bass', I.log_drum(40, .5), t, 1.0)
    m = motor(m2f(52), .5, .14, 7, contour=m2f(52) * np.linspace(.5, 1, n_(.5)))
    mx.put('kit', m * np.linspace(0, 1, len(m)), t + dur - .5, 1.0, role='pickup', inst='printer')
    mx.put('music', I.pad(CH['B7b9'], .55, .6, cutoff=1500), t + dur - .5, 1.0)

def bar_end_short(mx, t):
    """short cut 12.0–14.5: Em9 stabs, sonic logo from +0.5, « Bonzini Labs » at +1.3, TCHAK at +2.0"""
    pad_bar(mx, t, 'Em9', 2.5, cutoff=1600, g=.8)
    for s in (3, 7, 11, 15): mx.put('music', I.stab(CH['Em9'], .12, .7), t + (s - 1) * STEP, 1.0)
    three_step(mx, t, g=.3, stabs=False, osti=False)
    logo(mx, t + .5, voice_t=t + 1.3)
    tchak(mx, t + 2.0, 'tchak_end')

CUTS = {
    'main': [(0, bar_M1), (2, bar_M2), (4, bar_M3), (6, bar_M4), (8, bar_M5), (9.5, silence_gap), (10, bar_M6), (12, bar_M7),
             (14, bar_M8), (16, bar_M9), (18, bar_M10), (20, bar_M11), (22, bar_M12)],
    'short': [(0, bar_M1), (2, bar_M2), (4, bar_M3), (6, bar_M5), (7.5, silence_gap), (8, bar_M6), (10, bar_M7),
              (12, bar_end_short), (14.5, lambda mx, t: bar_M12(mx, t, .5))],
}
DUR = {'main': 24.0, 'short': 15.0}

def render(cut):
    mx = Mix(DUR[cut])
    for t0, fn in CUTS[cut]: fn(mx, t0)
    os.makedirs(os.path.join(T, 'out', f'stems_{cut}'), exist_ok=True)
    N = n_(DUR[cut]); out = {}
    for k, v in mx.st.items():
        v = v[:N].copy()
        if k == 'music': v = v + dsp.reverb(v, dsp.make_ir(1.6, 1.4, 1.1, .5), wet=.14)
        out[k] = v; dsp.save(os.path.join(T, 'out', f'stems_{cut}', f'{k}.wav'), v)
    sil = (n_(9.5), n_(9.8)) if cut == 'main' else (n_(7.5), n_(7.8))
    json.dump(sorted(mx.grid, key=lambda g: g['t']), open(os.path.join(T, 'data', f'grid_{cut}.json'), 'w'), indent=0)
    return out, sil

def mixdown(cut):
    st, sil = render(cut)
    vox = st.get('vox', 0); bed = sum(v for k, v in st.items() if k != 'vox')
    # duck the bed under the sung words (-4 dB) and keep the digital silence truly silent
    env = np.abs(vox).mean(1) if isinstance(vox, np.ndarray) else np.zeros(len(bed))
    duck = dsp.onepole_lp((env > .015).astype(float), 12.0)
    mid = dsp.butter(dsp.butter(bed, 'hp', 700, 2), 'lp', 4000, 2)            # the bed's speech band is ducked harder
    bed = bed * (1 - .45 * duck)[:, None] - mid * (.45 * duck)[:, None]
    vox = vox * 1.25 if isinstance(vox, np.ndarray) else vox
    mix = bed + (vox if isinstance(vox, np.ndarray) else 0)
    mix = dsp.hp(mix, 35)
    mix = dsp.compressor(mix, thr_db=-14, ratio=2.0, att=.005, rel=.12)
    mix = mix * dsp.undb(-14 - dsp.lufs_integrated(mix)); mix, _ = dsp.limiter(mix, ceiling_db=-1.2)
    mix = mix * dsp.undb(-14 - dsp.lufs_integrated(mix)); mix, _ = dsp.limiter(mix, ceiling_db=-1.2)
    a, b = sil; mix[a:b] = 0
    dsp.save(os.path.join(T, 'out', f'music_{cut}.wav'), mix, 'PCM_24')
    print(cut, 'LUFS', round(dsp.lufs_integrated(mix), 2), 'peak', round(20 * math.log10(np.abs(mix).max() + 1e-9), 2), 'dur', len(mix) / SR)

if __name__ == '__main__':
    which = sys.argv[1] if len(sys.argv) > 1 else 'both'
    for c in (['main', 'short'] if which == 'both' else [which]): mixdown(c)
