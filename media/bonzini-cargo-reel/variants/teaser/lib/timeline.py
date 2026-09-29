"""TEASER variant — single source of truth for the 18.5 s cut (30 fps, 120 BPM, bar = 2.0 s).

Everything (voice assembly, captions/overlay, compositor EDL, SFX cues, music) reads from here.
Run `python3 lib/timeline.py` to dump data/timeline.json for the overlay renderer.

Voice boundaries were checked on spectrograms + faster-whisper (large-v3) re-transcription:
  * line 2 "sécurité" really ends at A 9.72 (not 9.22), line 3 "confiance" runs to A 23.15.
  * internal hesitations tightened in silence/noise: B 7.96->8.16 (0.20 s), A 21.10->21.56 (0.46 s).
"""
import os, json

FPS = 30
DUR = 18.5
NF = int(round(DUR * FPS))          # 555 frames
BEAT, BAR = 0.5, 2.0
HERE = os.path.dirname(os.path.abspath(__file__))
V = os.path.abspath(os.path.join(HERE, '..'))

# ---------------------------------------------------------------- voice: (clip, src_in, src_out, out_in)
VOICE = [
    ('B', 3.70, 7.96, 1.40),    # "Voici votre conteneur qui arrive dans notre entrepôt"
    ('B', 8.16, 9.45, 5.66),    # "en toute sécurité."
    ('A', 5.74, 9.74, 7.25),    # "Vos colis ont été déchargés en toute sécurité."
    ('A', 18.64, 21.10, 11.55), # "Et nous vous disons merci pour"
    ('A', 21.56, 23.18, 14.01), # "votre confiance."
]
JOIN_XF = {1: 0.025, 4: 0.025}     # crossfade (s) into segment i (internal edits)

# ---------------------------------------------------------------- words on the teaser timeline
# (text, start, end, emph)  — derived from captions.json + spectrogram corrections, mapped via VOICE
WORDS = [
    ('Voici', 1.55, 2.08, 0), ('votre', 2.08, 2.32, 0), ('conteneur', 2.32, 2.90, 1),
    ('qui', 2.90, 3.14, 0), ('arrive', 3.14, 3.50, 1), ('dans', 3.50, 4.40, 0), ('notre', 4.40, 4.66, 0),
    ('entrepôt', 4.66, 5.59, 1),
    ('en', 5.76, 5.88, 0), ('toute', 5.88, 6.16, 0), ('sécurité.', 6.16, 6.86, 1),
    ('Vos', 7.31, 7.55, 0), ('colis', 7.57, 7.95, 1), ('ont', 7.95, 8.13, 0), ('été', 8.13, 8.41, 0),
    ('déchargés', 8.41, 9.43, 1),
    ('en', 9.79, 9.91, 0), ('toute', 9.91, 10.17, 0), ('sécurité.', 10.17, 11.20, 1),
    ('Et', 11.57, 11.93, 0), ('nous', 11.93, 12.07, 0), ('vous', 12.07, 12.19, 0), ('disons', 12.19, 12.55, 0),
    ('merci', 12.55, 13.21, 1),
    ('pour', 13.21, 13.81, 0), ('votre', 14.14, 14.55, 0), ('confiance.', 14.55, 15.60, 1),
]
# caption pages: (first word index, last word index exclusive, in, out, hero)
PAGES = [
    (0, 3, 1.45, 2.90, 0),
    (3, 8, 2.90, 5.64, 0),
    (8, 11, 5.70, 6.96, 0),
    (11, 16, 7.24, 9.62, 0),
    (16, 19, 9.70, 11.34, 0),
    (19, 24, 11.50, 13.21, 1),
    (24, 27, 13.21, 15.62, 1),
]

# ---------------------------------------------------------------- picture EDL
# each shot: out_in, out_out, clip, list of (out_t, src_t) speed keyframes (linear between -> speed ramps),
#            zoom (z0 -> z1 over the shot), focus (fx, fy) in 0..1 of the frame, punch (zoom kick at the head)
SHOTS = [
    # --- B: arrival --------------------------------------------------------------------------
    dict(a=0.00, b=1.00, clip='B', keys=[(0.00, 0.10), (1.00, 1.10)], z=(1.16, 1.06), f=(0.42, 0.45), punch=0.18),   # HOOK: red cab
    dict(a=1.00, b=2.00, clip='B', keys=[(1.00, 2.20), (2.00, 3.20)], z=(1.05, 1.12), f=(0.45, 0.40), punch=0.08),   # container behind cab
    dict(a=2.00, b=3.00, clip='B', keys=[(2.00, 3.30), (2.30, 3.78), (3.00, 4.20)], z=(1.04, 1.14), f=(0.55, 0.45), punch=0.07),  # end + wheel (ramp 1.6x -> 0.6x into "CONTENEUR")
    dict(a=3.00, b=4.00, clip='B', keys=[(3.00, 7.30), (4.00, 8.50)], z=(1.10, 1.02), f=(0.42, 0.55), punch=0.08),   # wide trailer, 3 axles
    dict(a=4.00, b=4.50, clip='B', keys=[(4.00, 12.28), (4.50, 12.86)], z=(1.06, 1.10), f=(0.5, 0.5), punch=0.0, whip=True),  # whip pan
    dict(a=4.50, b=5.00, clip='B', keys=[(4.50, 12.86), (5.00, 13.22)], z=(1.12, 1.04), f=(0.50, 0.62), punch=0.08),  # lands on the trailer wheels (slowing)
    dict(a=5.00, b=6.00, clip='B', keys=[(5.00, 15.50), (6.00, 16.30)], z=(1.04, 1.12), f=(0.60, 0.50), punch=0.07),  # container end + red cab turning
    dict(a=6.00, b=7.00, clip='B', keys=[(6.00, 8.55), (6.50, 9.30), (7.00, 10.60)], z=(1.02, 1.16), f=(0.45, 0.55), punch=0.05, ff=True),  # trailer rolls away: fast-forward burst into the cut
    # --- A: warehouse ------------------------------------------------------------------------
    dict(a=7.00, b=8.00, clip='A', keys=[(7.00, 0.00), (8.00, 1.00)], z=(1.14, 1.04), f=(0.45, 0.55), punch=0.16),    # white SUV (transition hit)
    dict(a=8.00, b=9.00, clip='A', keys=[(8.00, 12.90), (8.40, 13.18), (9.00, 13.46)], z=(1.02, 1.10), f=(0.55, 0.55), punch=0.10),  # yellow sacks (slow-mo into "DÉCHARGÉS")
    dict(a=9.00, b=9.50, clip='A', keys=[(9.00, 17.30), (9.50, 17.72)], z=(1.06, 1.10), f=(0.45, 0.55), punch=0.06),   # carton stacks
    dict(a=9.50, b=10.50, clip='A', keys=[(9.50, 21.84), (9.79, 22.02), (10.50, 22.30)], z=(1.10, 1.02), f=(0.50, 0.45), punch=0.09),  # walls of goods ("SÉCURITÉ")
    dict(a=10.50, b=11.50, clip='A', keys=[(10.50, 2.25), (11.50, 3.30)], z=(1.04, 1.10), f=(0.50, 0.50), punch=0.06),  # SUV rear + cars
    dict(a=11.50, b=12.50, clip='A', keys=[(11.50, 20.08), (12.50, 20.54)], z=(1.10, 1.03), f=(0.55, 0.45), punch=0.07), # crate + blue goods (slow)
    dict(a=12.50, b=13.50, clip='A', keys=[(12.50, 18.88), (13.50, 19.18)], z=(1.03, 1.10), f=(0.50, 0.50), punch=0.06), # cartons -> crate (slow)
    dict(a=13.50, b=14.50, clip='A', keys=[(13.50, 22.70), (14.50, 23.08)], z=(1.08, 1.02), f=(0.50, 0.55), punch=0.06), # cartons 15x96 + blue wall (slow)
    dict(a=14.50, b=18.50, clip='A', keys=[(14.50, 23.84), (15.10, 24.10), (16.00, 24.40), (18.50, 24.90)], z=(1.02, 1.20), f=(0.50, 0.45), punch=0.05, outro=True),  # push-in -> blurred end-card bed
]
CUTS = [s['a'] for s in SHOTS[1:]]
BIG_HITS = [0.0, 7.0, 16.0]                      # impacts (flash + shake + sub)
FLASH = {0.0: .55, 1.0: .25, 2.32: .30, 7.0: .95, 8.41: .30, 9.79: .25, 16.0: .55}
GLITCH = [(0.95, 1.08, .35), (3.92, 4.05, .30), (6.78, 7.00, 'in'), (7.00, 7.30, 'out'), (11.46, 11.56, .30)]

# ---------------------------------------------------------------- graphics cues (overlay)
CUES = dict(
    hook=(0.0, 1.34),                 # BONZINI slam @0.00, TRADING CARGO @0.50
    slam1=(2.32, 3.95, 3.14),         # CONTENEUR (+ ARRIVÉ ✓ stamp @3.14)
    slam2=(8.41, 9.46),               # COLIS DÉCHARGÉS ✓
    slam3=(9.79, 11.28, 10.17),       # EN TOUTE SÉCURITÉ (shield pulse @10.17)
    end=(15.30, 16.0, DUR),           # logo pieces fly in -> lock @16.00
    hud=(1.05, 15.35),
)


def dump():
    words = [dict(w=w, s=s, e=e, emph=bool(m)) for (w, s, e, m) in WORDS]
    pages = [dict(text=' '.join(x['w'] for x in words[i:j]), words=words[i:j], **{'in': a, 'out': b}, hero=bool(h))
             for (i, j, a, b, h) in PAGES]
    d = dict(fps=FPS, dur=DUR, nframes=NF, pages=pages, cues=CUES, cuts=CUTS, big_hits=BIG_HITS,
             brand='BONZINI TRADING CARGO', location_line='Foyer Balengou')
    os.makedirs(os.path.join(V, 'data'), exist_ok=True)
    json.dump(d, open(os.path.join(V, 'data', 'timeline.json'), 'w'), ensure_ascii=False, indent=1)
    return d


if __name__ == '__main__':
    d = dump()
    tot = 0
    for c, a, b, o in VOICE:
        print(f'voice {c} {a:6.2f}-{b:6.2f} -> out {o:6.2f}-{o + b - a:6.2f}')
    for p in d['pages']:
        print(f"{p['in']:5.2f}-{p['out']:5.2f} {'H' if p['hero'] else ' '} {p['text']}")
    print('shots', len(SHOTS), 'cuts', CUTS)
