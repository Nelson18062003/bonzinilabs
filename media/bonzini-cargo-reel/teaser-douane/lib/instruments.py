"""« Douane Groove » instruments (48 kHz mono float, deterministic): afro-house / 3-step drums, log drum, chords, the bikutsi
ostinato (reused from the series), the paperwork percussion (stamp, thermal printer, calculator, typing) and the transition FX.
All sounds are synthesised — no samples."""
import os, sys, math
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
for p in (HERE, os.path.join(HERE, '..', '..', 'douane2', 'lib'), os.path.join(HERE, '..', '..', 'douane-partie-2', 'lib'), os.path.join(HERE, '..', '..', 'explainer', 'lib', 'audio'),
          '/home/user/bonzinilabs/media/bonzini-cargo-reel/explainer/lib/audio'):
    if os.path.isdir(p) and p not in sys.path: sys.path.insert(0, p)
import dsp
from dsp import SR
import money_sfx as mf
import customs_sfx as cf
import bikutsi as bk
import makossa as mk

def n_(t): return int(round(t * SR))
def m2f(m): return 440.0 * 2 ** ((m - 69) / 12)
def env_exp(n, tau): return np.exp(-np.arange(n) / (tau * SR))
def noise(n, seed): return np.random.default_rng(seed).uniform(-1, 1, n)

# ---------- drums ----------------------------------------------------------------------------------------------------
def kick(g=1.0, seed=0):
    """deep house kick: sine with a fast pitch drop, a click, soft-clipped (reads on phone speakers through its 2nd harmonic)"""
    n = n_(.42); t = np.arange(n) / SR
    f = 46 + 110 * np.exp(-t / .028); ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t / .16)
    click = noise(n_(.004), seed) * np.linspace(1, 0, n_(.004)) * .35
    y[:len(click)] += click
    return dsp.softclip(y * 1.6, 1.2) * .9 * g

def log_drum(m, dur=.22, glide_to=None, glide_t=.06, g=1.0):
    """amapiano log drum: sine+triangle, pitch from +12 st down to the note in ~40 ms, ~180 ms decay, LP 900 Hz, driven"""
    n = n_(dur + .1); t = np.arange(n) / SR
    f0 = m2f(m); f = f0 * 2 ** (np.exp(-t / .014))                 # +12 st → note (exp)
    if glide_to is not None:
        k = np.clip((t - (dur - glide_t)) / glide_t, 0, 1); f = f * (2 ** ((glide_to - m) / 12)) ** k
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = .75 * np.sin(ph) + .35 * (2 / np.pi) * np.arcsin(np.sin(ph))
    a = np.exp(-t / .07) * .65 + np.exp(-t / .18) * .35
    a *= np.clip((dur + .06 - t) / .06, 0, 1)
    y = dsp.lp(y * a, 900, .9)
    return dsp.softclip(y * 2.5, 1.0) * .55 * g

def shaker(g=1.0, seed=0):
    n = n_(.06); y = noise(n, seed); y = dsp.hp(dsp.lp(y, 11000), 5200)
    a = np.minimum(np.arange(n) / (SR * .006), 1) * env_exp(n, .018)
    return y * a * .35 * g

def hat_open(g=1.0, seed=0):
    n = n_(.22); y = dsp.hp(noise(n, seed), 7600); return y * env_exp(n, .07) * .28 * g

def rim(g=1.0, seed=0):
    n = n_(.05); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * 1720 * t) * env_exp(n, .008) + dsp.hp(noise(n, seed), 2500) * env_exp(n, .004) * .5
    return y * .4 * g

def conga(m=62, g=1.0, seed=0, slap=False):
    n = n_(.3); t = np.arange(n) / SR; f = m2f(m) * (1 + .25 * np.exp(-t / .01))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, .09 if not slap else .04)
    y += dsp.hp(noise(n, seed), 1800) * env_exp(n, .006 if not slap else .012) * (.5 if slap else .25)
    return y * .45 * g

def clap(g=1.0, seed=0):
    n = n_(.25); y = np.zeros(n); r = np.random.default_rng(seed)
    for k, d in enumerate([0, .009, .018, .028]):
        i = n_(d); m = n - i; y[i:] += r.uniform(-1, 1, m) * env_exp(m, .012 if k < 3 else .08)
    return dsp.hp(dsp.lp(y, 6000), 900) * .32 * g

# ---------- tonal ----------------------------------------------------------------------------------------------------
CHORDS = {   # E minor afro-house progression (voicings, MIDI)
    'Em9': [52, 59, 62, 66, 71], 'Cmaj7#11': [48, 55, 59, 64, 66], 'Am9': [45, 52, 55, 59, 64], 'B7sus4': [47, 54, 57, 59, 64], 'B7b9': [47, 54, 57, 60, 63]}
def pad(notes, dur, g=1.0, seed=0, cutoff=1400):
    """warm filtered supersaw chord (mono sum), slow attack and release"""
    n = n_(dur); out = np.zeros(n)
    for i, m in enumerate(notes): out += dsp.supersaw(m2f(m), n, voices=5, detune_cents=12, seed=seed + i).mean(1)
    a = np.minimum(np.arange(n) / (SR * .35), 1) * np.minimum((n - np.arange(n)) / (SR * .4), 1)
    return dsp.lp(out * a, cutoff, .6) * .09 * g

def stab(notes, dur=.16, g=1.0, cutoff=2600):
    """short plucked chord on the off-beat (drop only)"""
    n = n_(dur + .15); t = np.arange(n) / SR; out = np.zeros(n)
    for m in notes: out += dsp.saw(m2f(m), n) + .5 * dsp.saw(m2f(m) * 1.004, n)
    a = np.exp(-t / .06) * np.clip((dur + .12 - t) / .12, 0, 1)
    return dsp.lp(out * a, cutoff, .8) * .05 * g

def bass_sub(m, dur, g=1.0):
    n = n_(dur); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * m2f(m) * t) * np.minimum(t / .01, 1) * np.clip((dur - t) / .05, 0, 1)
    return y * .5 * g

def balafon(m, dur=.5, seed=0, g=1.0): return bk.balafon(m2f(m), dur, seed) * g
def guitar_mute(m, seed=0, g=1.0): return mk.guitar(m2f(m), .18, .55, .985, seed, mute=.6) * .8 * g

# ---------- paperwork percussion & FX ----------------------------------------------------------------------------------
def stamp(seed=0, g=1.0): return mf.stamp_hit(seed) * g
def printer(dur=1.0, seed=0, rate=90, g=1.0): return mf.printer(dur, seed, rate) * g
def calc(seed=0, g=1.0): return mf.calc_key(seed) * g
def typing(nk=6, gap=.08, seed=0, g=1.0): return cf.typing(nk, gap, seed) * g
def paper(seed=0, g=1.0): return mf.paper_flick(seed) * g
def whoosh(dur=.4, seed=0, lo=300, hi=3500, g=1.0): return mf.whoosh_s(dur, seed, lo, hi) * g
def pop(seed=0, g=1.0): return mf.pop_s(seed) * g

def riser(dur=2.0, seed=0, chop=True):
    """band-pass noise sweeping 800 Hz → 6 kHz, chopped in 16ths then 32nds (the printer running away), sub crescendo"""
    n = n_(dur); t = np.arange(n) / SR; y = noise(n, seed)
    fc = 800 * (6000 / 800) ** (t / dur); out = dsp.tv_biquad(y, 'bp', fc, 2.2)
    if chop:
        step = np.where(t < dur / 2, .125, .0625); ph = (t % step) / step; gate = (ph < .55).astype(float)
        gate = dsp.onepole_lp(gate, 400); out = out * gate
    out *= (t / dur) ** 1.6
    sub = np.sin(2 * np.pi * 41.2 * t) * (t / dur) ** 2 * .35
    return (out * .5 + sub)

def sub_drop(g=1.0):
    n = n_(.9); t = np.arange(n) / SR; f = 35 + 20 * np.exp(-t / .25)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .45) * np.minimum(t / .004, 1)
    burst = dsp.lp(noise(n_(.03), 7), 3000) * np.linspace(1, 0, n_(.03))
    y[:len(burst)] += burst * .6
    return dsp.softclip(y * 1.3, 1.0) * .9 * g

def reverse_stamp(seed=0, g=1.0):
    s = np.pad(stamp(seed), (0, n_(.9))); ir = dsp.make_ir(1.2, 1.0, .8, .4)
    w = dsp.reverb(np.stack([s, s], 1), ir, wet=1.0)[:, 0]
    w = w[:n_(.9)]; return w[::-1] * g * 1.2

def tape_stop(x, dur=.35):
    """pitch-down the tail of a signal like a stopping tape"""
    n = len(x); k = n_(dur); i0 = max(0, n - k)
    rate = np.ones(n); rate[i0:] = np.linspace(1, .05, n - i0)
    pos = np.cumsum(rate); pos = pos[pos < n - 1]
    return np.interp(pos, np.arange(n), x)
