"""« PATRON, ATTENDS ! » (JE SAVAIS PAS. · 4/5) — the film's sound: 48 kHz stereo, exactly SCORE.T.end seconds, synthesised
(no samples) + the 12 voice takes of the v2 script (clear diction, E/SCRIPT_V2.md: C1 T1 T2 C2 C3 T3 T3b C4 N1 C5 N2 N3 —
C = TA COMMANDE the talking parcel, T = TOI, N = the narrator). Built on « PAS REÇU. » (v3/lib/audio_recu.py, imported as R:
voice chain, sidechain duck, carve, master, onset checks, series SFX: the same night counter under the bulb) and the series'
synth code (audio.py, makossa.py, bikutsi.py, instruments.py). Same patterns as ep2/lib/audio_ep2.py (v2 clarity mix).

ONE score drives picture and sound: SCORE.T, DUR, A, U, LINES, SPEAKER, soundCues() and music() are read LIVE from
overlay/scenes/01_score.js through node (which itself reads data/timing.json; without it the score runs on its DEFAULTS).
Fallbacks, in order: audio/score_cues.json (the last live read, if its T still matches), then a python replica of the score
(derive_score; `--check-replica` compares it with the live score). Every cue name the score emits has a sound; a name added
later plays its family's sound (whoosh, stamp, pop, tic, glass…) or nothing — it is listed in the log and the report, never
a crash. The voices come from data/voice_plan.json (file start `at`, `stretch`) + data/takes.json (speech on/off) — only when
they are COMPLETE and IN STEP with the score (every score line planned, plan file = take file, the take files present, the
planned speech starts = SCORE.T within .15 s). Otherwise the engine mixes music + SFX only and says why (the music is still
ducked on the score's planned speech spans T/DUR, as it will be with the voices).

Night: the wax counter of a Mboppi shop under the bulb (« PAS REÇU. »'s bulb: the filament's 100 Hz family, fine hiss, a slow
sway, sparse filament crackles), exactly periodic over the film (integer cycles, circular noise) — the loop has no seam; every
SFX tail that runs past the end wraps onto frame 0 (the loop continues it).
Music (makossa, 120 BPM, beat .5 s; series code makossa.groove / guitar / bass / kit, bikutsi balafon, instruments.*):
  0 .. tenseFrom        NO music: the parcel already crushed on the phone glass at frame 0 (THOK + glass crackle + cut
                        breath), its soft re-presses under the words, the dezoom, the landing on the cloth — the bulb alone
  tenseFrom .. cut      TENSE F#-minor makossa, at night. The fake message's ding IS the band's downbeat. Stop-time:
                        'enter' (F#m | D: quarter picking, bass, hats, rim; + muted skank and shaker from bar 2, + conga
                        from bar 3) under T1 and « Il a mis trois cœurs » — the band leaves .22 s before the « aww » and
                        re-anchors ON it: two beats of nothing but the sweet D(add9) strum and its sigh (the gag), then the
                        band snaps back on the E7 (4-on-the-floor, skank, 16th picking, conga, claps, balafon tremolo,
                        riser) under « c'est lui ! Je paie. » — the E7 is left hanging
  cut                   TOTAL CUT on the parcel's landing (boing + bonk; 4 ms gate, reverb returns included): digital
                        silence on the music bus through C2, C3 (no sound under it), the ring, the pick-up, « Allô ? »,
                        the steel plate, T3b and its low riser, the big stamp, the shatter, FAUX MESSAGE and C4
  majorFrom             the A-MAJOR CHORD ALONE (the E7 resolves): a soft strummed A + a warm held pad under THE RULE
                        (N1), ducked like any music (>= 14 dB under the voice); the 3 clinks spell C#7 A6 E6
  fullFrom              the container, violet light: A-major full makossa (arrival stab, kick, violet pad swell,
                        shimmer) under C5; the band leaves .22 s before the signature
  sigAt                 the Bonzini signature, unchanged: E6 -> G#6 (.1 s apart) + bell, alone in the break
  tonk                  the band slams back ON the enamel plate's « tonk » (the I after the signature's V) — A-major
                        makossa under N2 and the end card; its bright balafon never starts inside « Bonzini », « Chine »,
                        « Douala »
  stampEnd .. end       break .22 s before the ritual stamp, the band slams back ON it, lighter, a slight ritardando so the
                        final A chord (R.compose_final, on its cue) lands on a downbeat, an E accent one beat before (kick
                        and bass only if it falls in a word); the music is choked dead (12 ms) on the « toc » on the glass,
                        digital silence to the last sample; the loop's THOK is frame 0
Voices: R.voice_line (trim ±30 ms, 24 -> 48 kHz soxr VHQ, Rubber Band if stretch != 1, EQ, leveller + compressor, de-esser,
  per-line loudness -18 LUFS, R.VOX_TRIM = {}: every line at the same level, the three speakers alike), small-room reverb.
  v2 clarity mix (as ep2): the music ducks DUCK_DB 12 dB under any voice + R.CARVE_DB 6 dB carve of 0.9-5 kHz (passed
  explicitly) + a 150 Hz low cut under the voice (SCRIPT_V2.md §7.3, « pour le haut-parleur du téléphone »: the music loses
  everything under 150 Hz while a voice speaks, full range in the pauses; --music-hp static applies it everywhere), soft SFX
  SFX_DUCK_DB 9 dB, the impact bus HIT_DUCK_DB 6 dB (in DUCKED); the final chord (after the last word by construction) is
  ducked only if it starts inside a speech span. Every SFX cue is levelled by its max momentary loudness: LVL[name] +
  20·log10(g) (g = the score's gain). Rule P1 (the score's outOfWords) is checked against the words in the report.
Master: HP 28 Hz, bus soft-clips, true-peak limiter; -14 LUFS integrated (pyloudnorm), TP <= -1 dBTP. WITHOUT voices the
  master (gain + limiter) is computed on music + SFX + a speech-shaped placeholder at -18 LUFS on each planned line (score
  T/DUR) and mix.wav is the music + SFX share of it: an M&E at the FINAL balance (the report gives the projected loudness and
  true peak of the voiced film); --me-norm normalises the M&E alone to -14 LUFS instead (a listening preview only).

usage (from E):  nice -n 5 python3 lib/audio_ep4.py            -> audio/mix.wav, audio/stems/*.wav, audio/audio_report.json
                 nice -n 5 python3 lib/audio_ep4.py --sheet    -> + out/chk_audio_sheet.jpg
                 --no-voices · --force-voices (use a plan the checks call stale) · --words (per-word margins)
                 --music-hp duck|static|off (default duck) · --me-norm · --gallery (audio/sfx_gallery.wav, every cue once)
                 --check-replica (python replica vs the live score, no mix) · EP_DIR=<copy> to run on a copy of E
API:    build(sheet=False) -> report dict · score() · voice_plan(sc) -> (lines, status) · compose(sc, lines, status)
        derive_score(T, DUR, words, A_over, U) · sfx_<name>() -> np.ndarray (onset at sample 0)
"""
import os, sys, json, math, re, subprocess, unicodedata
HERE = os.path.dirname(os.path.abspath(__file__))
E = os.path.abspath(os.environ.get('EP_DIR') or os.path.join(HERE, '..'))      # the episode folder (EP_DIR: test on a copy)
SP = os.path.abspath(os.path.join(HERE, '..', '..', '..'))                      # the scratch root (= E/../.. as in ep2)
V3LIB = os.path.join(SP, 'v3', 'lib')
if not os.path.isdir(V3LIB): V3LIB = os.path.join(SP, 'pas-recu', 'lib')   # repo layout: the « PAS REÇU. » sound library
if V3LIB not in sys.path: sys.path.insert(0, V3LIB)
import audio_recu as R                       # « PAS REÇU. »: imports audio (dsp, makossa, bikutsi, instruments) in order
import numpy as np
from audio import ns, tt, nz, ex, m2f, bp, panst, place, tail_fade, grains
A, dsp, SR, mk, bk, I = R.A, R.dsp, R.SR, R.mk, R.bk, R.I

SCORE_JS = os.path.join(E, 'overlay', 'scenes', '01_score.js')
TIMING_JSON = os.path.join(E, 'data', 'timing.json')
PLAN_JSON = os.path.join(E, 'data', 'voice_plan.json')
TAKES_JSON = os.path.join(E, 'data', 'takes.json')
VOCHECK_JSON = os.path.join(E, 'data', 'vocheck.json')
VO_DIR = os.path.join(E, 'audio', 'vo')
OUT_A = os.path.join(E, 'audio')
CUES_DUMP = os.path.join(OUT_A, 'score_cues.json')
REPORT = os.path.join(OUT_A, 'audio_report.json')
GALLERY = os.path.join(OUT_A, 'sfx_gallery.wav')
SHEET = os.path.join(E, 'out', 'chk_audio_sheet.jpg')
# the voice chain of R reads these module globals at call time
R.PLAN_JSON, R.TAKES_JSON, R.VOCHECK_JSON, R.VO_DIR = PLAN_JSON, TAKES_JSON, VOCHECK_JSON, VO_DIR
R.CACHE = os.path.join(OUT_A, '.cache')
R.VOX_TRIM = {}                                # v2 (clear diction): every line levelled the same, no whispered line
_R_LUFS_MONO = R.lufs_mono
def lufs_safe(y):
    """BS.1770 integrated loudness that also works on a line shorter than one 400-ms block (T3 « Allô ? » is .32 s of speech:
    R.lufs_mono returns NaN there and R.voice_line would turn the whole mix into NaN): the signal is zero-padded to one
    block, i.e. its loudness = its momentary loudness"""
    y = np.asarray(y, float)
    n0 = int(round(.42 * SR))
    if len(y) < n0: y = np.concatenate([y, np.zeros((n0 - len(y),) + y.shape[1:])])
    v = _R_LUFS_MONO(y) if y.ndim == 1 else float(R.dsp.lufs_integrated(y))
    return float(v) if np.isfinite(v) else -70.0
R.lufs_mono = lufs_safe                         # used by R.voice_line (per-line loudness) and our placeholder

TAIL = 3.0
BEAT = 0.5
S16 = BEAT / 4
BRK = 0.22                                    # stop-time: the band leaves the last .22 s before each hit it re-enters on
SIG_GAP = 0.10                                # the series signature: E6 then G#6 .1 s later (as in « PAS REÇU. »)
DUCK_DB, SFX_DUCK_DB, HIT_DUCK_DB = 12.0, 9.0, 6.0   # v2: the voice must be understood first (owner's feedback)
R.CARVE_DB = 6.0
MUSIC_HP_HZ = 150.0                           # SCRIPT_V2.md §7.3: low cut of the music for the phone speaker (see --music-hp)
G_TENSE, G_MAJOR, G_BRAND, G_FINAL = R.G_TENSE, R.G_MAJOR, R.G_BRAND, R.G_FINAL
G_HOLD = 10 ** (-13.0 / 20)                   # the A-major chord held alone under THE RULE (N1)
MUSIC = ('groove', 'brand', 'final')
DUCKED = {'groove': DUCK_DB, 'brand': DUCK_DB, 'sfx': SFX_DUCK_DB, 'hit': HIT_DUCK_DB}   # (final: only if it starts in a word)
SENDS = {'groove': ('room', .08), 'brand': ('plate', .24), 'final': ('room', .10), 'sfx': ('room', .06),
         'hit': ('room', .08), 'vox': ('vroom', .15)}
STEMS = ('vox', 'music', 'sfx', 'hits', 'amb')
WRAP = ('sfx', 'hit', 'amb')                  # stems whose tails past the end wrap onto frame 0 (the loop goes on)
VOX_REF = -18.0                               # R.VOX_LUFS: each voice line's loudness in the vox stem (pre-master)
AMB_LUFS = -47.0                              # the bulb bed, integrated, pre-master

# SFX levels: max momentary loudness (400 ms, K-weighted, LUFS, pre-master, the cue alone, dry) at g = 1; the score's g
# scales it (+20·log10 g). Calibrated on ep1/ep2's delivered v2 mixes (their pre-master cue levels, voices at -18 LUFS) and
# the v2 rule: the voice first.
LVL = {'thok_glass': -17.0, 'glass_crackle': -25.0, 'breath_cut': -24.0, 'gecko_skitter': -27.0, 'thok_soft': -22.0,
       'whoosh_soft': -24.0, 'parcel_land': -21.5, 'ding_msg': -20.5, 'heart_pop': -22.0, 'plate_pop': -23.0,
       'aww_guitar': -20.0, 'whoosh_small': -24.0, 'boing_carton': -20.0, 'bonk': -19.5, 'band_in': -24.0,
       'phone_ring': -19.5, 'plate_flip': -23.0, 'phone_pickup': -21.0, 'steel_descend': -21.0, 'low_riser': -21.0,
       'big_stamp': -18.0, 'crack_glow': -22.0, 'glass_shatter': -18.5, 'peel': -23.0, 'stamp': -21.5, 'clink': -21.0,
       'tic': -21.0, 'gloup': -25.0, 'violet_hum': -22.0, 'glass_tonk': -20.5, 'ribbon_shimmer': -21.0,
       'label_slap': -22.0, 'tonk': -23.0, 'pop': -23.0, 'stamp_big': -19.0, 'whoosh': -21.0, 'toc_glass': -21.0,
       # names the v2 score dropped (SCRIPT_V2.md §7.3), kept ready in case they come back
       'hic': -27.0, 'boing': -22.0, 'boing_small': -25.0, 'doors_close': -24.0, 'pin': -26.0, 'line_tone': -27.0}
LVL_UNKNOWN = -27.0                           # a cue name added later, played by its family's sound
HITS = ('thok_glass', 'boing_carton', 'bonk', 'big_stamp', 'glass_shatter', 'stamp', 'stamp_big', 'glass_tonk', 'tonk')
BRAND_CUES = ('violet_hum', 'ribbon_shimmer')  # on the brand bus (violet = Bonzini only)
GATES = ('music_cut', 'cut_dry')               # no sound: the mixdown's gates (not emitted by the v2 score; handled anyway)
NO_FADE = ('low_riser', 'whoosh', 'phone_ring')   # cut dead by design (the stamp, the toc, the pick-up)
# « loud » cues that must never start inside a word (SCRIPT_V2.md §7.3 = tools/qa_score.js LOUD): reported against the words
LOUD = ('ding_msg', 'heart_pop', 'aww_guitar', 'boing_carton', 'bonk', 'phone_ring', 'plate_flip', 'phone_pickup', 'big_stamp',
        'glass_shatter', 'peel', 'stamp', 'clink', 'major', 'gloup', 'glass_tonk', 'ribbon_shimmer', 'label_slap', 'bonzini_sig',
        'tonk', 'pop', 'stamp_big', 'final_chord')
HEART_NOTES = (81, 85, 88)                     # the fake's 3 hearts pop on A5 C#6 E6 (sweet, the relative major)
CLINK_NOTES = (97, 93, 88)                     # the hearts land: C#7 A6 E6 — the A-major chord that has just arrived
TIC_F = (2650, 2900, 3150, 3400)               # THE RULE's 4 words, stamped
SHIMMER_NOTES = (95, 100, 102, 104)            # B6 E7 F#7 G#7: above the signature's register

def log(*a): print(*a, flush=True)
fm = R.fm
def rng(seed): return np.random.default_rng(seed)
def nrm(y, pk=.5): return y / (np.abs(y).max() + 1e-12) * pk
def smooth01(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)
def arg(name, default=None):
    if name in sys.argv:
        i = sys.argv.index(name)
        if i + 1 < len(sys.argv) and not sys.argv[i + 1].startswith('--'): return sys.argv[i + 1]
        return True
    return default

# =====================================================================================================================
# score (live) + fallbacks
# =====================================================================================================================
# the score's DEFAULT keys (01_score.js T / DUR / U = SCRIPT_V2.md §7.1): the replica's last resort when neither node nor
# data/timing.json is there (before the re-timing on the v2 takes)
LINES0 = ['C1', 'T1', 'T2', 'C2', 'C3', 'T3', 'T3b', 'C4', 'N1', 'C5', 'N2', 'N3']
T0 = dict(C1=.2, T1=3.88, T2=8.12, C2=11.67, C3=14.52, T3=19.01, T3b=20.16, C4=23.11, N1=25.32, C5=30.65, N2=33.14, N3=39.47,
          end=44.84)
DUR0 = dict(C1=3.28, T1=3.89, T2=3.0, C2=2.5, C3=3.89, T3=.56, T3b=1.94, C4=1.67, N1=4.87, C5=1.94, N2=5.98, N3=4.67)
U0 = dict(C1=11.8, T1=14, T2=10.8, C2=9, C3=14, T3=2, T3b=7, C4=6, N1=17.54, C5=7, N2=21.54, N3=16.8)
SPK0 = {'C': 'cm', 'T': 'toi', 'N': 'nar'}
MUSIC_KEYS = ('silentUntil', 'tenseFrom', 'cut', 'majorFrom', 'fullFrom', 'sigAt', 'end')

_SC = None
def score():
    """{dur, T, DUR, A, U, LINES, SPEAKER, words, cues[{t, name, g, pan}], music{…MUSIC_KEYS}, src}"""
    global _SC
    if _SC is not None: return _SC
    tm = {}
    try: tm = json.load(open(TIMING_JSON)) if os.path.exists(TIMING_JSON) else {}
    except Exception as e: log(f'[E4] WARNING data/timing.json unreadable ({e}): the score defaults')
    js = ("const S=require(%s);const o={T:S.T,DUR:S.DUR,A:S.A,U:S.U,LINES:S.LINES,SPEAKER:S.SPEAKER};"
          "o.cues=typeof S.soundCues==='function'?S.soundCues():null;o.music=typeof S.music==='function'?S.music():null;"
          "console.log(JSON.stringify(o))") % json.dumps(SCORE_JS)
    d, why = None, ''
    try:
        r = subprocess.run(['node', '-e', js], capture_output=True, text=True, timeout=60, check=True, cwd=E)
        d = json.loads(r.stdout.strip().splitlines()[-1]); d['src'] = '01_score.js (live)'
    except Exception as e: why = f'node failed: {str(e)[:200]}'
    if d is None:
        try:
            j = json.load(open(CUES_DUMP)); ref = {k: v for k, v in (tm or T0).items() if isinstance(v, (int, float))}
            if all(abs(j['T'].get(k, -9) - v) < 1e-6 for k, v in ref.items()):
                d = j; d['src'] = f'audio/score_cues.json (last live read; {why})'
        except Exception: pass
    words = tm.get('words', {}) if isinstance(tm.get('words'), dict) else {}
    if d is None or not d.get('cues') or not d.get('music'):
        Tm = dict(d['T']) if d and d.get('T') else {**T0, **{k: v for k, v in tm.items() if isinstance(v, (int, float))}}
        Dm = dict(d['DUR']) if d and d.get('DUR') else {**DUR0, **(tm.get('dur') or {})}
        der = derive_score(Tm, Dm, words, tm.get('A'), (d or {}).get('U'))
        if d is None: d = der; d['src'] = f'python replica of the score ({why})'
        else:
            if not d.get('cues'): d['cues'] = der['cues']; d['src'] += ' + cues from the python replica (soundCues() missing)'
            if not d.get('music'): d['music'] = der['music']; d['src'] += ' + music from the python replica (music() missing)'
    d['LINES'] = d.get('LINES') or [k for k in LINES0 if k in d['T']] or [k for k in d['T'] if k != 'end']
    d['SPEAKER'] = d.get('SPEAKER') or {k: SPK0.get(k[:1], k[:1]) for k in d['LINES']}
    d['U'] = d.get('U') or dict(U0)
    d['music'] = complete_music(d['music'] or {}, d['cues'], d['T'])
    d['dur'] = float(d['T']['end']); d['words'] = words; d['DUR'] = d.get('DUR') or {}
    d['cues'] = sorted(d['cues'], key=lambda c: c['t'])
    if d['src'].startswith('01_score.js'):
        try:
            os.makedirs(OUT_A, exist_ok=True)
            json.dump({k: d.get(k) for k in ('T', 'DUR', 'A', 'U', 'LINES', 'SPEAKER', 'cues', 'music')}, open(CUES_DUMP, 'w'), indent=1)
        except Exception: pass
    _SC = d
    return d

def first(cues, name, after=-1.0, before=1e9):
    return next((c['t'] for c in cues if c['name'] == name and after < c['t'] < before), None)

def complete_music(mp, cues, T):
    """every music() key the engine uses, derived from the cues when the score does not give it"""
    mp = {k: float(v) for k, v in mp.items() if isinstance(v, (int, float))}; miss = []
    def need(k, v):
        if k not in mp and v is not None: mp[k] = float(v); miss.append(k)
    end = float(T['end'])
    need('tenseFrom', first(cues, 'ding_msg') or 3.0); need('silentUntil', mp['tenseFrom'])
    need('cut', first(cues, 'boing_carton') or first(cues, 'music_cut') or mp['tenseFrom'] + 7.5)
    need('majorFrom', first(cues, 'major') or (first(cues, 'stamp', mp['cut']) or end - 20) + 1.9)
    need('fullFrom', first(cues, 'violet_hum', mp['majorFrom']) or mp['majorFrom'] + 5.5)
    need('sigAt', first(cues, 'bonzini_sig') or mp['fullFrom'] + 2.1)
    need('end', end)
    mp['_derived'] = miss
    return mp

# ------------------------------------------------------------------- python replica of 01_score.js (fallback only)
def _deacc(s): return re.sub('[̀-ͯ]', '', unicodedata.normalize('NFD', str(s).lower().replace('œ', 'oe').replace('æ', 'ae')))
def _forms(w):
    r = _deacc(w); return [re.sub('[^a-z0-9]', '', r), re.sub('[^a-z0-9]', '', re.sub(r"^(?:[a-z]{1,2}|qu|jusqu)['’]", '', r))]
def find_word(words, i, prefix, nth=0):
    """the nth word {w, s, e} of line i starting with prefix ('a|b' = either prefix), exactly as 01_score.js word()"""
    ks = [k for k in (re.sub('[^a-z0-9]', '', _deacc(p)) for p in str(prefix).split('|')) if k]; c = 0
    for w in (words or {}).get(i) or []:
        if any(x and x.startswith(k) for x in _forms(w['w']) for k in ks):
            if c == nth: return w
            c += 1
    return None

PUNCT = re.compile(r'^[«»!?.,…-]+$')
def out_of_words(t, T, DUR, words, LINES):
    """01_score.js outOfWords(): a short cue never STARTS inside a word -> (t, k)"""
    u = t
    for _ in range(8):
        hit = None
        for i in LINES:
            if i not in T or i not in DUR: continue
            if u < T[i] - .05 or u > T[i] + DUR[i] + .03: continue
            ws = [w for w in (words.get(i) or []) if not PUNCT.match(str(w['w']))]
            for j, w in enumerate(ws):
                e = max(w['e'], DUR[i]) if j == len(ws) - 1 else w['e']
                if T[i] + w['s'] - .03 < u < T[i] + e: hit = T[i] + e + .03; break
            if hit is not None: break
        if hit is None: return u, 1.0
        u = hit
    return (u, 1.0) if u - t <= .6 else (t, .5)

def derive_score(T, DUR, words, A_over=None, U=None):
    """python replica of 01_score.js (A block, soundCues(), music()) — used only when node or a function is missing.
    Mirrors the v2 score line for line; `--check-replica` compares it with the live score."""
    T = dict(T); DUR = dict(DUR); U = dict(U or U0); words = words or {}; L = [k for k in LINES0 if k in T]
    def W(i, p, nth=0, fb=0.0): w = find_word(words, i, p, nth); return T[i] + (w['s'] if w else fb)
    def WE(i, p, nth=0, fb=0.0): w = find_word(words, i, p, nth); return T[i] + (w['e'] if w else fb)
    END = lambda i: T[i] + DUR[i]
    SYL = lambda i, u: DUR[i] * u / U[i]
    WEL = lambda i, p: max(WE(i, p, 0, DUR[i]), END(i))
    a = {}
    a['thok'] = 0.0
    a['presses'] = [0.0, W('C1', 'attend', 0, SYL('C1', 2.54)), W('C1', 'pai|pay', 0, SYL('C1', 6.8)), W('C1', 'compt|comt|cont', 0, SYL('C1', 10.8))]
    a['hook2'] = W('C1', 'ne', 0, SYL('C1', 5.8)) - .05
    a['bubble'] = max(WEL('C1', 'compt|comt|cont') + .05, a['hook2'] + 1.45)
    a['dezoom'] = a['bubble'] - .45; a['land'] = a['dezoom'] + .42
    a['toiIn'] = T['T1'] - .2
    a['hearts'] = [max(T['T1'] + .45 + .35 * i, a['bubble'] + .35 + .35 * i) for i in range(3)]
    a['toiTxt1'] = T['T2'] - .1
    a['aww'] = WE('T2', 'coeur|queur', 0, SYL('T2', 5)) + .03
    a['jump'] = T['C2'] - .55; a['jumpLand'] = T['C2'] - .25; a['bonk'] = a['jumpLand'] + .05; a['cut'] = a['jumpLand']
    a['band'] = T['C3'] - .1
    a['allo'] = END('C3') + .02; a['ring'] = [a['allo'] + .08]; a['pickup'] = T['T3'] - .1
    a['supIn0'] = END('T3') + .02; a['supIn1'] = a['supIn0'] + .85; a['tremble'] = a['supIn1']
    a['stamp'] = END('T3b') + .12; a['toiOut'] = END('T3b') - .02
    a['shatter'] = a['stamp'] + .45; a['peel'] = a['shatter'] + .12; a['fauxStamp'] = a['shatter'] + .3
    a['roll'] = [END('C4') + .1 + .1 * i for i in range(3)]
    a['major'] = END('C4') + .05
    a['ruleW'] = [W('N1', 'nouveau', 0, SYL('N1', 7)), W('N1', 'compte', 0, SYL('N1', 9)), W('N1', 'ancien', 0, SYL('N1', 12.54)),
                  W('N1', 'numero', 0, SYL('N1', 14.54))]
    a['rule'] = max(T['N1'] - .15, a['ruleW'][0] - .7)                  # v2: never an empty poster before « nouveau »
    a['ruleSub'] = W('N1', 'appel', 0, SYL('N1', 10.54))
    a['ruleOut'] = max(T['N1'] - .15 + 3.8, END('N1') + .4, a['ruleSub'] + 2.0)
    a['gulp'] = WEL('N1', 'numero') + .03
    a['cont'] = max(T['C5'] - .15, a['ruleOut'] - .2); a['violet'] = a['cont']
    a['leap'] = T['C5'] + .25; a['enter'] = a['leap'] + .55
    a['ribbon'] = max(a['enter'] + .15, W('C5', 'doua|doula|douw|ouala', 0, SYL('C5', 4)))
    a['shimmer'] = WEL('C5', 'doua|doula|douw|ouala') + .03
    a['bzLabel'] = a['ribbon'] + .35
    a['sig'] = max(T['N2'] - .5, WEL('C5', 'doua|doula|douw|ouala') + .03)
    a['plateBZ'] = T['N2'] - .2
    a['endcard'] = T['N3'] - .2; a['cta'] = T['N3'] - .12
    a['stampEnd'] = max(W('N3', 'maintenant', 0, SYL('N3', 11.26)) - .32, WE('N3', 'commentaire|comment', 0, SYL('N3', 10)) + .03)
    a['loop0'] = T['end'] - .55
    if A_over: a.update({k: v for k, v in A_over.items() if isinstance(v, (int, float, list))})
    Q = []; used = []
    def q(t, name, g=1, pan=0):
        if 0 <= t < T['end']: Q.append(dict(t=round(t, 4), name=name, g=g, pan=pan))
    def qx(t, name, g=1, pan=0):
        u, k = out_of_words(t, T, DUR, words, L)
        while any(abs(x - u) < .07 for x in used): u += .08
        used.append(u); q(u, name, g * k, pan)
    q(0, 'thok_glass'); q(.02, 'glass_crackle', .3); q(0, 'breath_cut', .3); q(.05, 'gecko_skitter', .3, -.6)
    for p in a['presses'][1:]: q(p, 'thok_soft', .3)
    qx(a['dezoom'], 'whoosh_soft', .25); q(a['land'], 'parcel_land', .7, -.3)
    q(a['bubble'], 'ding_msg', .8)
    for i, h in enumerate(a['hearts']): qx(h, 'heart_pop', .25, .1 * i)
    q(a['toiIn'], 'plate_pop', .4, .2); qx(a['aww'], 'aww_guitar', .5)
    q(a['jump'], 'whoosh_small', .4); q(a['jumpLand'], 'boing_carton'); q(a['bonk'], 'bonk', .7, .2); q(a['jumpLand'] + .05, 'gecko_skitter', .35, -.6)
    q(a['band'], 'band_in', .35)
    for r_ in a['ring']: q(r_, 'phone_ring', .7, .4)
    qx(max(a['allo'] - .1, END('C3') + .03), 'plate_flip', .5, .2); q(a['pickup'], 'phone_pickup', .5, .3)
    q(a['supIn0'], 'steel_descend', .25); q(a['tremble'], 'low_riser', .4)
    qx(a['toiOut'], 'whoosh_small', .3, .4)
    q(a['stamp'], 'big_stamp'); q(a['stamp'] + .04, 'crack_glow', .6); q(a['shatter'], 'glass_shatter')
    q(a['peel'], 'peel', .4); q(a['fauxStamp'], 'stamp')
    for i, r_ in enumerate(a['roll']): qx(r_, 'clink', .5, -.3 - .15 * i)
    q(a['major'], 'major')
    for w in a['ruleW']: q(w, 'tic', .2)
    qx(a['gulp'], 'gloup', .8, -.6)
    q(a['violet'], 'violet_hum', .4); qx(a['enter'], 'glass_tonk', .45); qx(a['shimmer'], 'ribbon_shimmer', .3)
    qx(a['bzLabel'], 'label_slap', .3); q(a['sig'], 'bonzini_sig'); q(a['plateBZ'], 'tonk', .8)
    qx(a['endcard'], 'whoosh_soft', .4); q(a['cta'], 'pop', .5); q(a['stampEnd'], 'stamp_big'); q(a['loop0'], 'whoosh', .6)
    q(max(END('N3') + .02, T['end'] - .9), 'final_chord'); q(T['end'] - .1, 'toc_glass', .6)
    mus = dict(silentUntil=a['bubble'], tenseFrom=a['bubble'], cut=a['cut'], majorFrom=a['major'], fullFrom=a['cont'],
               sigAt=a['sig'], end=T['end'])
    return dict(T=T, DUR=DUR, A=a, U=U, LINES=L, SPEAKER={k: SPK0.get(k[:1], k[:1]) for k in L},
                cues=sorted(Q, key=lambda c: c['t']), music=mus)

def check_replica():
    """the python replica vs the live score: same cues (name, t within .1 ms, g), same music()"""
    sc = score()
    if not sc['src'].startswith('01_score.js'): log(f'[E4] replica check needs the live score; src = {sc["src"]}'); return False
    d = derive_score(sc['T'], sc['DUR'], sc['words'], (json.load(open(TIMING_JSON)).get('A') if os.path.exists(TIMING_JSON) else None), sc['U'])
    live = [(c['name'], round(c['t'], 4), round(c['g'], 4)) for c in sc['cues']]
    rep = [(c['name'], round(c['t'], 4), round(c['g'], 4)) for c in d['cues']]
    diff = [(a_, b_) for a_, b_ in zip(live, rep) if a_[0] != b_[0] or abs(a_[1] - b_[1]) > 1e-4 or abs(a_[2] - b_[2]) > 1e-4]
    mdiff = {k: (sc['music'].get(k), d['music'].get(k)) for k in d['music'] if abs(float(sc['music'].get(k, -99)) - d['music'][k]) > 1e-6}
    ok = len(live) == len(rep) and not diff and not mdiff
    log(f'[E4] replica vs live: {len(rep)} vs {len(live)} cues · differing cues {diff[:6]} · music diff {mdiff} -> {"IDENTICAL" if ok else "DIFFERENT"}')
    return ok

# ------------------------------------------------------------------- speakers, spans, brand words
def speaker(sc, lid): return (sc.get('SPEAKER') or {}).get(lid) or SPK0.get(str(lid)[:1], str(lid)[:1])
def voice_ids(sc): return [k for k in sc['LINES'] if k in sc['T']]

def planned_spans(sc):
    """the score's speech spans [(id, start, end)] (T / DUR): where the voices WILL be"""
    T, D = sc['T'], sc.get('DUR') or {}
    return sorted([(i, float(T[i]), float(T[i]) + float(D.get(i, 0.0))) for i in voice_ids(sc)], key=lambda x: x[1])

def spans_of(vinfo, sc):
    """speech spans [(id, on, off)]: the real takes when voiced, else the score's planned spans"""
    return [(v['id'], v['film_on'], v['film_off']) for v in vinfo] if vinfo else planned_spans(sc)

def talking_at(spans, x, pre=.05, post=0.0): return any(a - pre <= x <= b + post for _, a, b in spans)

def make_busy(spans, wabs):
    """busy(x): is a word being said at x? With word times for the line (takes' vocheck words, or timing.json words): inside
    a word ([s - .03, e]) or in the line's last word (up to the speech end: the ASR stamps it early). Without word times: the
    whole speech span (conservative: a line's inner pauses count as speech)"""
    by = {}
    for i, w, s, e in wabs: by.setdefault(i, []).append((s, e))
    def busy(x, pre=.05):
        for i, a, b in spans:
            if not (a - pre <= x <= b): continue
            ws = sorted(by.get(i, []))
            if not ws: return True
            if any(s - .03 <= x <= e for s, e in ws) or ws[-1][0] - .03 <= x <= b: return True
        return False
    return busy

# the brand-critical words (SCRIPT_V2.md §1 / DICTION rule 5: « Bonzini », « Chine », « Douala » must be recognised):
# (line, prefix, fallback = U-units u0..u1 into the line). No bright balafon / band accent starts inside them.
KEY_WORDS = (('C5', 'doua|doula|douw|ouala', 4, 7), ('N2', 'bonzini', 2.54, 5.54), ('N2', 'chine', 16.54, 17.54), ('N2', 'doua|doula|douw|ouala', 18.54, 21.54))
def key_windows(sc):
    T, DUR, U, words = sc['T'], sc.get('DUR') or {}, sc.get('U') or U0, sc.get('words') or {}
    out = []
    for i, p, u0, u1 in KEY_WORDS:
        if i not in T: continue
        w = find_word(words, i, p); d = DUR.get(i, 2.0); un = U.get(i, U0.get(i, 10))
        s, e = (w['s'], w['e']) if w else (d * u0 / un, d * u1 / un)
        if abs(u1 - un) < 1e-6: e = max(e, d)                            # the line's last word: the ASR end is early (WEL)
        out.append((T[i] + s - .04, T[i] + e))
    return out

def voice_plan(sc):
    """-> (lines [{id, file, at, stretch, on, off, words}] sorted by film speech start, status str). lines = [] when the plan
    is absent, incomplete or stale (then the film is mixed without voices)."""
    if '--no-voices' in sys.argv: return [], 'disabled (--no-voices)'
    force = '--force-voices' in sys.argv
    if not os.path.exists(PLAN_JSON): return [], 'data/voice_plan.json absent'
    if not os.path.exists(TAKES_JSON): return [], 'data/takes.json absent'
    try: plan = json.load(open(PLAN_JSON)); takes = json.load(open(TAKES_JSON))
    except Exception as e: return [], f'voice plan unreadable ({e})'
    try: vc = json.load(open(VOCHECK_JSON))
    except Exception: vc = {}
    import soundfile as sf
    ids = voice_ids(sc); T = sc['T']; why = []; hard = []; out = []; stale_words = []
    extra = [i for i in plan if i not in ids]; missing = [i for i in ids if i not in plan]
    if extra: why.append(f'plan ids not in the score: {extra}')
    if missing: why.append(f'score lines not planned: {missing}')
    t_takes = os.path.getmtime(TAKES_JSON)
    for lid, p in plan.items():
        tk = takes.get(lid)
        if not tk: hard.append(f'{lid}: no take in takes.json'); continue
        if tk.get('file') != p.get('file'): hard.append(f"{lid}: plan file {p.get('file')} != take {tk.get('file')}"); continue
        f = os.path.join(VO_DIR, p['file'])
        if not os.path.exists(f): hard.append(f"{lid}: audio/vo/{p['file']} missing"); continue
        if os.path.getmtime(f) > t_takes + 1: why.append(f"{lid}: {p['file']} is newer than takes.json (re-generated after the takes were chosen)")
        try:
            if float(tk['off']) > sf.info(f).duration + .02: hard.append(f"{lid}: take off {tk['off']} beyond the file")
        except Exception as e: hard.append(f'{lid}: {e}'); continue
        st = float(p.get('stretch', 1.0)); on_film = float(p['at']) + float(tk['on']) * st
        wds = vc.get(p['file'], {}).get('words', []) if os.path.exists(VOCHECK_JSON) and os.path.getmtime(VOCHECK_JSON) + 1 >= os.path.getmtime(f) else []
        if not wds: stale_words.append(lid)
        if lid in T and abs(on_film - float(T[lid])) > .15:
            why.append(f'{lid}: planned speech start {on_film:.2f} vs SCORE.T {float(T[lid]):.2f}')
        out.append(dict(id=lid, file=p['file'], at=float(p['at']), stretch=st, on=float(tk['on']), off=float(tk['off']),
                        words=[w for w in wds if w['e'] > w['s'] and any(ch.isalnum() for ch in w['w'])]))
    if hard: return [], 'unusable (mixing without voices): ' + '; '.join((why + hard)[:6]) + (' …' if len(why + hard) > 6 else '')
    if why and not force:
        return [], 'stale (mixing without voices; --force-voices to use it anyway): ' + '; '.join(why[:6]) + (' …' if len(why) > 6 else '')
    out = sorted(out, key=lambda v: v['at'] + v['on'] * v['stretch'])
    if stale_words: why = why + [f'no ASR words (data/vocheck.json older than the take, or absent) for {stale_words}: word margins skipped']
    return out, (f'{len(out)} lines' + (' (FORCED despite: ' + '; '.join(why[:4]) + ')' if why else ''))

# =====================================================================================================================
# small synthesis helpers
# =====================================================================================================================
def stick_slip(n, rate, seed, amp=(.4, 1.0)):
    """impulse train following an instantaneous rate (Hz, scalar or array): friction that sticks and slips"""
    r = rng(seed); rate = np.broadcast_to(np.asarray(rate, float), (n,))
    ph = np.cumsum(np.maximum(rate, 1.0)) / SR
    idx = np.nonzero(np.diff(np.floor(ph)) > 0)[0] + 1
    imp = np.zeros(n); imp[0] = 1.0; imp[idx] = r.uniform(*amp, len(idx))
    return imp

def thud(f_hi, f_lo, tau_f, tau, n, drive=1.0):
    t = tt(n); return np.sin(2 * np.pi * np.cumsum(f_lo + (f_hi - f_lo) * np.exp(-t / tau_f)) / SR) * np.exp(-t / tau) * drive

def hollow(t, seed, modes=((175, 1, .04), (262, .6, .03), (410, .35, .02)), glide=None):
    """the damped body of a cardboard box (low Q: cardboard is dead)"""
    return R._modes(t, 1.0, modes, seed, glide)

def tick(f, seed, n=None): return R._click(f, seed, n)

def flick(seed, fc=2500, ms=3.0, g=.8):
    m = ns(ms / 1000); return bp(nz(m, seed), fc, 1.0) * np.linspace(1, 0, m) * g

def glass_ping(f, seed, d=.08, n=None):
    """one glass shard / pane partial set (1, 2.32, 4.07): bright, inharmonic"""
    n = n or ns(max(.12, d * 3)); t = tt(n)
    y = sum(a * np.sin(2 * np.pi * f * r_ * t + seed % 7 + i) * np.exp(-t / (d / r_ ** .5)) for i, (r_, a) in
            enumerate(((1, 1.0), (2.32, .35), (4.07, .15))))
    return y * np.minimum(1, t / .0003)

# =====================================================================================================================
# SFX (all synthesised, seeded; mono (n,) or stereo (n, 2); onset at sample 0)
# =====================================================================================================================
def sfx_thok_glass(seed=11):
    """THE HOOK: TA COMMANDE already crushed against the phone glass at frame 0 — the series' parcel-on-the-glass THOK
    (audio.sfx_thok: chest thump + hollow cardboard knock + crush + two glass partials, a touch wide). Above 400 Hz it is
    over in ~60 ms: C1 « Patron » starts .2 s later"""
    y = A.sfx_thok(seed); t = tt(len(y))
    lo, hi = dsp.zp_split(y, 400, 2)
    y = lo + hi * np.where(t < .06, 1.0, np.exp(-(t - .06) / .035))[:, None]
    return y / np.abs(y).max()

def sfx_glass_crackle(seed=411, dur=.17):
    """the phone glass under the pressure: a few stressed micro-cracks (sharp high pings 3-8 kHz, 2-6 ms), dense at the
    impact then sparse, spread a little; all over before C1's first word (.2 s)"""
    n = ns(dur + .04); out = np.zeros((n, 2)); r = rng(seed)
    times = np.concatenate([[0, .005, .011, .019], np.sort(r.uniform(.03, dur, 6))])
    for k, tk in enumerate(times):
        m = ns(.03); f = r.uniform(3000, 8000)
        p = glass_ping(f, seed + k, r.uniform(.002, .006), m)
        p[:ns(.0008)] += dsp.hp(nz(ns(.0008), seed + 50 + k), 4000) * .6
        a = (1.0 if k < 4 else r.uniform(.25, .65)) * (1 - .5 * tk / dur)
        place(out, panst(p * a, r.uniform(-.5, .5)), ns(tk))
    t = tt(n); out += panst(dsp.hp(nz(n, seed + 1), 5000) * np.exp(-t / .04) * .06, 0)
    return out / np.abs(out).max()

def sfx_breath_cut(seed=421, dur=.14):
    """« souffle coupé »: the parcel's breath knocked out by the impact — a short breathy « hhh » through /a/ formants
    (650 / 1100 / 2500 Hz), a soft glottal bump, cut short at `dur` (before C1 at .2 s)"""
    n = ns(dur + .02); t = tt(n); src = nz(n, seed)
    y = bp(src, 650, 3) + .8 * bp(src, 1100, 4) + .45 * bp(src, 2500, 5) + .15 * dsp.hp(src, 4000)
    y *= np.minimum(1, t / .006) * (1 - .4 * np.clip(t / dur, 0, 1)) * np.clip((dur - t) / .012, 0, 1)
    y[:ns(.03)] += thud(150, 110, .01, .012, ns(.03)) * .25 * np.abs(y).max()
    return nrm(y)

def sfx_skitter(seed=431, dur=.26):
    """the margouillat's claws on the wax cloth: two quick bursts of tiny ticks + a short fabric rustle"""
    out = np.zeros(ns(dur + .06)); r = rng(seed)
    for k, tk in enumerate((0, .021, .043, .068, .15, .172, .196, .222)):
        place(out, tick(r.uniform(2200, 3800), seed + k, ns(.02)) * r.uniform(.35, .9) * (1.2 if k == 0 else 1), ns(tk))
    c = A.sfx_cloth(seed + 20, .24, 2400, .003); place(out, c / (np.abs(c).max() + 1e-9) * .55, 0)
    return nrm(out)

def sfx_thok_soft(seed=441):
    """the parcel re-presses on the glass on a strong syllable: a LOW muffled thud only (120 -> 58 Hz + the box's dead body,
    nothing above 400 Hz): under the phone band, it never masks the word it sits in"""
    n = ns(.32); t = tt(n)
    y = thud(130, 58, .015, .07, n, 1.3) + hollow(t, seed, ((150, 1, .03), (230, .5, .02))) * .5
    y = dsp.lp(dsp.lp(y, 380), 380) * np.minimum(1, t / .001)
    return nrm(y)

def sfx_whoosh(seed, dur=.32, p0=-.5, p1=.5, lo=350, hi=3200, flap=.6, peak=.3):
    """a short air whoosh (the dezoom, the leap, the plate sliding away, the end card): air swept across, its band and level
    peaking at `peak` x dur then dying away, panned along its path, a cloth flick at its start"""
    n = ns(dur); t = tt(n); u = t / dur
    sh = np.where(u < peak, (u / peak) ** 1.5, np.exp(-(u - peak) / (.28 * (1 - peak))))
    w = dsp.tv_biquad(nz(n, seed), 'bp', lo + (hi - lo) * sh, .9) * np.maximum(sh, .25 * np.minimum(1, t / .004))
    w = w / (np.abs(w).max() + 1e-9) * np.clip((dur - t) / .02, 0, 1)
    f = I.paper(seed + 1); f = f / (np.abs(f).max() + 1e-9) * flap
    y = w.copy(); y[:len(f)] += f[:n]
    return panst(y, p0 + (p1 - p0) * smooth01(u)) * .5

def sfx_parcel_land(seed=451, bounce=.12):
    """the parcel falls back on the wax cloth: a hollow cardboard thud over the wooden counter, the cloth's slap, one small
    bounce (+.12 s) and a tiny settle"""
    n = ns(.6); y = np.zeros(n)
    def hit(a, sd):
        m = ns(.4); tm = tt(m)
        h = thud(150, 70, .012, .06, m, 1.2) * .9 + hollow(tm, sd, ((160, 1, .035), (240, .7, .025), (380, .4, .018), (590, .25, .012))) * .8
        h += bp(nz(m, sd + 5), 1600, .8) * np.exp(-tm / .008) * .8
        return h * np.minimum(1, tm / .0006) * a
    place(y, hit(1.0, seed), 0); place(y, hit(.30, seed + 10), ns(bounce)); place(y, hit(.09, seed + 20), ns(bounce + .07))
    c = A.sfx_cloth(seed + 30, .18, 2200, .004); place(y, c / (np.abs(c).max() + 1e-9) * .2, ns(.01))
    return nrm(y)

def sfx_heart_pop(k=0, seed=461):
    """one of the fake's 3 little hearts pops on the bubble: a tiny bubble pop + a soft bell « plink » (A5 / C#6 / E6:
    sweet, the relative major of the tense F#m)"""
    n = ns(.45); y = np.zeros(n)
    p = I.pop(seed); y[:len(p)] += p / (np.abs(p).max() + 1e-9) * .7
    b = A._bell(m2f(HEART_NOTES[k % 3]), .42, .14, seed, .0015); y[:len(b)] += b / (np.abs(b).max() + 1e-9) * .45
    return nrm(y)

def sfx_plate_pop(seed=471):
    """TOI's amber plate pops in: a soft rising « bloop » (260 -> 560 Hz) + a light wooden tap + a breath of air"""
    n = ns(.3); t = tt(n)
    f = 260 + 300 * (1 - np.exp(-t / .02))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .05) * np.minimum(1, t / .002)
    w = A.wood(420, seed, .6); y[:len(w)] += w
    y += bp(nz(n, seed + 1), 2000, .9) * np.exp(-t / .01) * .3
    return nrm(y)

def sfx_aww(seed=481):
    """the « aww » after « trois cœurs »: a sweet D(add9) strummed up on the makossa guitar (D4 F#4 A4 E5, 18 ms apart),
    then a lead F#5 that sighs down a tone to E5 (« awww »), a little to the right"""
    out = np.zeros((ns(1.3), 2))
    for i, m in enumerate((62, 66, 69, 76)):
        g = mk.guitar(m2f(m), .95, bright=.5, decay=.996, seed=seed + i)
        place(out, panst(g * (.8 + .05 * i), -.25 + .1 * i), ns(.018 * i))
    lead = mk.guitar(m2f(78), 1.05, bright=.62, decay=.997, seed=seed + 9)
    lead = A.bend(lead, -200, .16, .5)
    place(out, panst(lead * 1.0, .3), ns(.09))
    out *= np.minimum(1, tt(len(out)) / .001)[:, None]
    return out / np.abs(out).max()

def sfx_boing(seed=491, dur=.55, f0=277.18):
    """a spring « boing »: a twangy saw starting sharp then wobbling around C#4 (11 Hz spring, decaying), through a formant
    sliding « bo- » (500 Hz) -> « -ing » (1.9 kHz), a little thump at the start"""
    n = ns(dur); t = tt(n)
    f = f0 * (1 + .16 * np.exp(-t / .12) * np.sin(2 * np.pi * 11 * t) + .25 * np.exp(-t / .03))
    ph = np.cumsum(f) / SR
    saw = dsp.lp(2 * (ph % 1.0) - 1, 6000)
    y = dsp.tv_biquad(saw, 'bp', 500 + 1400 * np.clip(t / .12, 0, 1), 3.0) * 1.6 + .5 * np.sin(2 * np.pi * ph)
    y *= np.minimum(1, t / .004) * np.exp(-t / .22)
    y += thud(150, 90, .01, .03, n) * .5
    return nrm(y)

def sfx_boing_carton(seed=501):
    """C2's interruption: the parcel lands between the two plates — a cardboard « boing » (the spring twang on the box's
    hollow thud), the music stops dead on it"""
    b = sfx_boing(seed, .55, 277.18); n = len(b); t = tt(n)
    y = b * .8 + thud(160, 80, .012, .05, n, 1.0) * .7 + hollow(t, seed + 1, ((170, 1, .03), (260, .6, .025), (400, .35, .015))) * .6
    y[:ns(.003)] += flick(seed + 2, 1800, 3.0, .6)
    return nrm(y)

def sfx_bonk(seed=511):
    """TOI's plate bonks into the parcel: a comic hollow « bonk » (a block whose pitch drops 570 -> 510 Hz, two inharmonic
    partials, a short thump)"""
    n = ns(.35); t = tt(n)
    f = 510 * (1 + .12 * np.exp(-t / .012))
    y = (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .07) + .45 * np.sin(2 * np.pi * np.cumsum(f * 1.72) / SR + 1) * np.exp(-t / .035)
         + .2 * np.sin(2 * np.pi * np.cumsum(f * 2.9) / SR + 2) * np.exp(-t / .02))
    y += thud(200, 110, .01, .04, n) * .6
    y[:ns(.002)] += flick(seed, 2200, 2.0, .7)
    return nrm(y * np.minimum(1, t / .0005))

def sfx_band_in(seed=521, dur=.11):
    """the dark band slides in at the top: a soft paper swipe (band 2.6 -> 1.1 kHz), a tiny soft tap — over before C3"""
    n = ns(dur + .06); t = tt(n); u = np.clip(t / dur, 0, 1)
    y = dsp.tv_biquad(nz(n, seed), 'bp', 2600 * (1100 / 2600) ** u, 1.0) * np.maximum(np.sin(np.pi * u) ** .8, .3 * (t < .004)) * (t < dur)
    y[:ns(.003)] += flick(seed + 1, 3000, 3.0, .5)
    s = A.sfx_setdown(seed); place(y, s / (np.abs(s).max() + 1e-9) * .3, ns(dur - .01))
    return nrm(y)

def sfx_phone_ring(seed=531, dur=.38):
    """ONE generic ring (no real phone's tone): a small speaker's warble between D6 and F#6 (20 Hz), soft square, the phone
    buzzing on the wooden counter under it; cut short by the pick-up"""
    dur = max(.12, dur); n = ns(dur + .03); t = tt(n)
    sw = .5 + .5 * np.tanh(np.sin(2 * np.pi * 20 * t) * 8)
    f = 1174.66 * (1 - sw) + 1479.98 * sw
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.tanh(np.sin(ph) * 2.2) * .6 + np.sin(ph) * .4
    y = dsp.butter(y, 'bp', [500, 6000], 2); y = y + bp(y, 2400, 1.2) * .5
    env = np.minimum(1, t / .006) * np.clip((dur - t) / .02, 0, 1)
    buzz = dsp.lp(np.tanh(np.sin(2 * np.pi * 150 * t) * 3) + .4 * nz(n, seed) * (np.sin(2 * np.pi * 150 * t) > .6), 900)
    return nrm(y * env / (np.abs(y).max() + 1e-9) + buzz * env * .12)

def sfx_plate_flip(seed=541):
    """TOI's plate flips over to « ALLÔ ? »: a quick air « fwip » (700 Hz -> 2.6 kHz), the plate lands back (wood tap +
    soft set-down) at +.14 s"""
    n = ns(.34); t = tt(n); u = np.clip(t / .14, 0, 1)
    y = dsp.tv_biquad(nz(n, seed), 'bp', 700 * (2600 / 700) ** u, 1.1) * np.maximum(np.sin(np.pi * u) ** 1.2, .3 * (t < .004)) * (t < .14) * .8
    y[:ns(.003)] += flick(seed + 3, 2800, 3.0, .5)
    w = A.wood(380, seed + 1, .7); place(y, w, ns(.14)); s = A.sfx_setdown(seed + 2); place(y, s * .5, ns(.14))
    return nrm(y)

def sfx_phone_pickup(seed=551):
    """the pick-up « clic », .1 s before « Allô ? »: a plastic click pair (3.1 kHz then 1.7 kHz, 16 ms apart), a tiny thump,
    a breath of line hiss — 50 ms"""
    n = ns(.09); y = np.zeros(n); t = tt(n)
    place(y, tick(3100, seed, ns(.02)), 0); place(y, tick(1700, seed + 1, ns(.025)) * .7, ns(.016))
    y += thud(240, 150, .005, .012, n) * .3
    y += dsp.hp(nz(n, seed + 2), 3000) * np.exp(-t / .02) * .04
    return nrm(y)

def sfx_steel_descend(seed=561, dur=.85):
    """the honest steel plate comes down GENTLY (no crush): a soft air glide (1.4 kHz -> 520 Hz) with the brushed steel's
    faint hum (780 / 1243 / 1891 / 2650 Hz) — it swells in the silence after « Allô ? » and is gone under « Il dit… »"""
    dur = max(.3, dur); n = ns(dur + .1); t = tt(n); u = np.clip(t / dur, 0, 1)
    sh = np.where(u < .38, .22 + .78 * (u / .38) ** 1.2, np.exp(-(u - .38) / .16))
    air = dsp.tv_biquad(nz(n, seed), 'bp', 1400 * (520 / 1400) ** u, .9) * sh
    steel = R._modes(t, 1.0, ((780, 1, 2.0), (1243, .6, 2.0), (1891, .35, 2.0), (2650, .2, 2.0)), seed + 1) * sh * .25
    y = air / (np.abs(air).max() + 1e-9) + steel
    y[:ns(.002)] += tick(2400, seed + 2, ns(.002)) * .2
    y *= np.clip((dur + .1 - t) / .05, 0, 1)
    return nrm(y)

def sfx_low_riser(dur, seed=571):
    """« un grave qui monte sous la bulle »: a low tone gliding 46 -> 78 Hz with its 2nd-4th harmonics (phone-audible),
    a noise band rising 90 -> 420 Hz, the bubble's tremble (7 -> 11 Hz, deepening); it grows to the big stamp and stops
    dead just before it. Nothing above ~500 Hz: T3b runs over it"""
    dur = max(.4, dur); n = ns(dur); t = tt(n); u = t / dur
    f = 46 * (78 / 46) ** u; ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph) + .55 * np.sin(2 * ph + .4) + .3 * np.sin(3 * ph + .9) + .15 * np.sin(4 * ph)
    trem = 1 + (.12 + .25 * u) * np.sin(2 * np.pi * np.cumsum(7 + 4 * u) / SR)
    nb = dsp.tv_biquad(nz(n, seed), 'bp', 90 * (420 / 90) ** u, 1.4)
    y = (tone * .7 / 1.6 + nb / (np.abs(nb).max() + 1e-9) * .4) * trem * (.3 + .7 * u ** 1.5)
    y = dsp.lp(y, 600) * np.minimum(1, t / .004); y[-ns(.003):] *= np.linspace(1, 0, ns(.003))
    return nrm(y)

def sfx_crack_glow(seed=581, dur=.4):
    """3 cracks glowing orange on the stamped bubble: three sharp cracks (0, .09, .2 s) each with its splitting lacquer
    crackle (2-6 kHz grains), over a warm « glow » hum rising 180 -> 300 Hz; over before the shatter (.41 s)"""
    n = ns(dur + .06); t = tt(n); out = np.zeros(n)
    for k, tk in enumerate((0, .09, .2)):
        m = ns(.09); tm = tt(m)
        c = bp(nz(m, seed + 10 + k), 3600, .9) * grains(m, 2500, seed + 20 + k, .0005, (.2, 1), shape=np.exp(-tm / .025))
        c = c / (np.abs(c).max() + 1e-9) * .8; c[:ns(.002)] += dsp.hp(nz(ns(.002), seed + k), 2500)
        place(out, c * (1 - .2 * k), ns(tk))
    u = np.clip(t / dur, 0, 1)
    ph = 2 * np.pi * np.cumsum(180 + 120 * u) / SR
    glow = (np.sin(ph) + .4 * np.sin(2 * ph + 1) + .2 * np.sin(3 * ph + 2)) * u ** 1.5 * np.clip((dur + .06 - t) / .06, 0, 1) * .18
    return nrm(out + glow)

def sfx_glass_shatter(seed=591, dur=1.2, slow=.78):
    """the fake message shatters (slow motion x0.5): a low « whump » and a crack burst, then ~46 glass shards (inharmonic
    pings 1.2-5.6 kHz: the slow motion lowers them), dense first then sparser, each its own pan — the highs fold away after
    .22 s (C4 follows ~.44 s later), a soft tinkle stays"""
    n = ns(dur); t = tt(n); r = rng(seed); out = np.zeros((n, 2))
    out += panst(thud(130, 55, .02, .07, n, 1.0) * .6, 0)
    m = ns(.06); cb = dsp.hp(nz(m, seed + 1), 2000) * grains(m, 6000, seed + 2, .0004, (.3, 1), shape=np.exp(-tt(m) / .015))
    cb = cb / (np.abs(cb).max() + 1e-9) * 1.1; cb[:ns(.004)] += dsp.hp(nz(ns(.004), seed), 1500) * np.linspace(1.5, 0, ns(.004))
    place(out, panst(cb, 0), 0)
    for j in range(46):
        tj = r.uniform(0, .012) if j < 4 else float(r.exponential(.13))
        if tj > dur - .25: continue
        f = r.uniform(1500, 7200) * slow
        p = glass_ping(f, seed + 100 + j, r.uniform(.03, .16), ns(.4))
        place(out, panst(p * r.uniform(.25, 1.0) * np.exp(-tj / .35), r.uniform(-.85, .85)), ns(tj))
    lo, hi = dsp.zp_split(out, 1200, 2)
    out = lo + hi * np.where(t < .22, 1.0, np.exp(-(t - .22) / .14))[:, None]
    out *= np.minimum(1, t / .0004)[:, None]
    return out / np.abs(out).max()

def sfx_peel(seed=601, dur=.16):
    """the pill « « TON FOURNISSEUR » ? » peels off (« PAS TON FOURNISSEUR » underneath): an adhesive « tchk-scriit »
    (stick-slip 1.2 kHz -> 260 Hz through the sticker's resonances) + a little paper flutter"""
    n = ns(dur + .06); t = tt(n); u = np.clip(t / dur, 0, 1)
    imp = stick_slip(n, 950 * (1 - u) + 260, seed, (.3, 1))
    y = sum(w * bp(imp, f, q) for f, q, w in ((1800, 4, .8), (3000, 5, 1.0), (4600, 5, .5)))
    y = y / (np.abs(y).max() + 1e-9) * np.minimum(1, t / .002) * (1 - .6 * u) * (t < dur)
    fl = bp(nz(n, seed + 1), 2200, .9) * (.5 + .5 * np.sin(2 * np.pi * 22 * t)) * np.clip((t - .06) / .03, 0, 1) * np.clip((dur + .06 - t) / .05, 0, 1) * .25
    return nrm(y + fl)

def sfx_stamp_void(seed=611):
    """« FAUX MESSAGE » hits the void where the bubble was: the series' rubber stamp (rubber + thud + paper slap), no box;
    above 300 Hz a hit, not a tail (C4 starts .13 s later)"""
    n = ns(.5); t = tt(n); y = np.zeros(n)
    s = A.sfx_stamp(seed); y[:len(s)] += s / np.abs(s).max()
    lo, hi = dsp.zp_split(y, 300, 2)
    y = lo + hi * np.where(t < .03, 1.0, np.exp(-(t - .03) / .03))
    return y / np.abs(y).max()

def sfx_tic(seed=621, f=2650.0):
    """a small dry « tic » (THE RULE's words stamped): sharp click + tiny ring"""
    return nrm(tick(f, seed))

def sfx_glass_tonk(seed=631):
    """the parcel jumps into the violet-glass container: thick glass answering (930 / 1460 / 2310 / 3380 / 4720 Hz, short)
    over the box's dull thud"""
    n = ns(.5); t = tt(n)
    glass = R._modes(t, 1.0, ((930, 1, .12), (1460, .7, .09), (2310, .45, .07), (3380, .25, .05), (4720, .12, .03)), seed)
    y = glass * .55 + thud(170, 95, .01, .05, n) * .8 + hollow(t, seed + 1, ((180, 1, .03), (270, .6, .02))) * .6
    y[:ns(.002)] += flick(seed + 2, 3000, 2.0, .5)
    return nrm(y * np.minimum(1, t / .0004))

def sfx_ribbon_shimmer(seed=641, dur=.5, sig_near=False):
    """the kraft ribbon turns violet: a soft airy glass sweep (3.5 -> 8.4 kHz) with fine sparkle grains and a crisp first
    glint; its pitched bells (B6 E7 F#7 G#7, above the signature) — unless `sig_near`: when the Bonzini signature follows
    within the sweep, the shimmer stays unpitched air (nothing may blur the signature's two notes, and bells after it would
    land on the enamel plate and « Ensuite »)"""
    n = ns(dur + .45); t = tt(n); out = np.zeros((n, 2)); r = rng(seed); u = np.clip(t / dur, 0, 1)
    sw = np.sin(np.pi * np.clip(t / (dur + .25), 0, 1)) ** 1.2
    air = dsp.tv_biquad(nz(n, seed), 'bp', 3500 * 2.4 ** u, 2.0) * sw
    out += panst(air / (np.abs(air).max() + 1e-9) * .5, -.6 + 1.2 * u)
    sp = dsp.hp(nz(n, seed + 1), 6000) * grains(n, 900, seed + 2, .0005, (.2, 1), shape=sw)
    out += panst(sp / (np.abs(sp).max() + 1e-9) * .45, .1)
    g0 = glass_ping(8400, seed + 3, .012, ns(.05)); place(out, panst(g0 * .6, -.5), 0)            # the crisp first glint
    for j in range(0 if sig_near else 8):
        tb = .04 + j * .06 + r.uniform(0, .03)
        b = A._bell(m2f(SHIMMER_NOTES[j % 4]), .5, .2, j, .002)
        place(out, panst(b * r.uniform(.25, .5) * (1 - .5 * j / 8), -.5 + .14 * j), ns(tb))
    return out / np.abs(out).max()

def sfx_violet_hum(seed=651, dur=.7):
    """the violet light switches on with the container: a soft switch « tk », then a warm electric swell (detuned sines
    A4 / E5 / E6) with a whisper of shimmer, fading as the band takes over"""
    n = ns(dur); t = tt(n)
    env = np.minimum(1, t / .2) ** 1.5 * np.clip((dur - t) / .35, 0, 1)
    y = (np.sin(2 * np.pi * 440 * t) + np.sin(2 * np.pi * 441.8 * t + 1) + .6 * np.sin(2 * np.pi * 659.26 * t + 2)
         + .25 * np.sin(2 * np.pi * 1318.5 * t + 3)) * env * .25
    y += bp(nz(n, seed), 6000, 1.2) * env * .05
    s = A.sfx_tap(seed); y[:len(s)] += s * .5
    return nrm(y)

def sfx_label_slap(seed=661):
    """the « BONZINI TRADING CARGO » label sticks on the parcel: a flat paper « fwap », the adhesive « tk », a hollow tap"""
    n = ns(.3); t = tt(n)
    y = bp(nz(n, seed), 1500, .8) * np.exp(-t / .012) * 1.2 + dsp.hp(nz(n, seed + 1), 4000) * np.exp(-t / .004) * .5
    y += hollow(t, seed + 2, ((180, 1, .035), (290, .6, .025))) * .5
    return nrm(y * np.minimum(1, t / .0004))

def sfx_tonk(seed=671):
    """the enamel plate « BONZINI TRADING CARGO » lands: the series' tonk (set-down + hollow wooden « tonk ») + the enamel's
    faint ring on A6 (the band's I comes in ON it)"""
    y = np.zeros(ns(.6)); s = R.sfx_tonk(seed); y[:len(s)] += s / (np.abs(s).max() + 1e-9)
    b = A._bell(m2f(93), .55, .16, seed, .001); y[:len(b)] += b / (np.abs(b).max() + 1e-9) * .1
    return nrm(y)

def sfx_stamp_big(seed=681):
    """the ritual stamp « MAINTENANT, TU SAIS. »: the series' stamp doubled (rubber + table thud + paper slap), a chest
    thump with a short sub, the wooden counter's body; above 160 Hz it is a hit, not a tail (« Maintenant » .32 s later)"""
    n = ns(1.2); t = tt(n); y = np.zeros(n)
    s = A.sfx_stamp(seed); y[:len(s)] += s / np.abs(s).max()
    s = I.stamp(seed + 1); y[:len(s)] += s * .7
    y += dsp.softclip(thud(110, 40, .03, .16, n, 1.6), 1.3) * .9
    y += hollow(t, seed + 2, ((140, 1, .07), (215, .7, .05), (330, .45, .035))) * .5
    y[:ns(.003)] += dsp.hp(nz(ns(.003), seed + 3), 3000) * np.linspace(1, 0, ns(.003)) * .8
    lo, hi = dsp.zp_split(y, 160, 2)
    y = lo + hi * np.where(t < .05, 1.0, np.exp(-(t - .05) / .07))
    y *= np.minimum(1, t / .0004)
    return y / np.abs(y).max()

def sfx_loop_whoosh(dur, seed=691):
    """the loop: the parcel pops out of the container (a hollow glass « pok ») and leaps at the lens — rising air
    (450 Hz -> 3.4 kHz, the fabric's flutter) that grows and is cut dead AT the « toc » on the glass"""
    dur = max(.15, dur); n = ns(dur); t = tt(n); u = t / dur
    y = dsp.tv_biquad(nz(n, seed), 'bp', 450 * (3400 / 450) ** u, 1.3) * (.18 + .82 * u ** 2) * (1 + .4 * np.sin(2 * np.pi * 41 * t))
    y = y / (np.abs(y).max() + 1e-9)
    m = ns(.08); tm = tt(m)
    pok = np.sin(2 * np.pi * np.cumsum(520 + 200 * (1 - np.exp(-tm / .01))) / SR) * np.exp(-tm / .025) + glass_ping(1900, seed, .02, m) * .3
    y[:m] += pok * .55
    y *= np.minimum(1, t / .0005); y[-ns(.0015):] *= np.linspace(1, 0, ns(.0015))
    return nrm(y)

def sfx_toc_glass(seed=701):
    """the « petit toc » on the phone glass, .1 s before the loop's THOK: a light cardboard knock + the glass's short
    partials (2.35 / 3.87 / 5.73 kHz)"""
    n = ns(.3); t = tt(n)
    y = thud(190, 120, .006, .02, n) * .7 + bp(nz(n, seed), 900, 1.5) * np.exp(-t / .01) * .5
    y += (.5 * np.sin(2 * np.pi * 2350 * t) * np.exp(-t / .06) + .3 * np.sin(2 * np.pi * 3870 * t + 1) * np.exp(-t / .04)
          + .12 * np.sin(2 * np.pi * 5730 * t + 2) * np.exp(-t / .025))
    y[:ns(.002)] += flick(seed + 1, 3500, 2.0, .6)
    return nrm(y * np.minimum(1, t / .0003))

# ---- names the v2 score dropped (SCRIPT_V2.md §7.3); ready if they come back --------------------------------------------
def sfx_doors_close(seed=711):
    """the container's glass doors close softly: two muffled glass-and-hinge clunks, .12 s apart"""
    n = ns(.5); y = np.zeros(n)
    for k, tk in enumerate((0, .12)):
        m = ns(.3); tm = tt(m)
        c = thud(220, 130, .008, .03, m) * .7 + R._modes(tm, 1.0, ((620, 1, .05), (1040, .5, .035), (1710, .25, .02)), seed + k) * .5
        place(y, c * (1 - .35 * k) * np.minimum(1, tm / .0005), ns(tk))
    return nrm(y)

def sfx_pin(seed=721):
    """a push-pin into the kraft tag: a tiny metal tick + a soft press"""
    n = ns(.15); y = np.zeros(n); place(y, tick(3600, seed, ns(.03)), 0)
    y += thud(260, 160, .004, .015, n) * .3
    return nrm(y)

def sfx_line_tone(seed=731, dur=.6):
    """a generic soft line tone (425 Hz, small speaker)"""
    n = ns(dur); t = tt(n)
    y = np.tanh(np.sin(2 * np.pi * 425 * t) * 1.5) * np.minimum(1, t / .01) * np.clip((dur - t) / .03, 0, 1)
    return nrm(dsp.butter(y, 'bp', [300, 3400], 2))

def sfx_family(name, sd):
    """a cue name the engine does not know yet: the sound of its family, or (None, None)"""
    fam = next((k for k in ('whoosh', 'stamp', 'pop', 'tic', 'tick', 'click', 'clic', 'ding', 'gloup', 'clink', 'glass',
                            'boing', 'ring', 'crack', 'thud', 'thok', 'tap', 'paper', 'slide', 'land', 'shimmer', 'hum',
                            'swoosh', 'door', 'slam', 'knock', 'bell', 'rustle', 'beep', 'bip', 'riser')
                if k in name), None)
    sig = {'whoosh': lambda: sfx_whoosh(sd), 'stamp': lambda: sfx_stamp_void(sd), 'pop': lambda: I.pop(sd),
           'tic': lambda: sfx_tic(sd), 'tick': lambda: sfx_tic(sd), 'click': lambda: sfx_phone_pickup(sd), 'clic': lambda: sfx_phone_pickup(sd),
           'ding': lambda: R.sfx_ding_msg(sd), 'gloup': lambda: R.sfx_gloup(0, sd), 'clink': lambda: R.sfx_clink(88, sd),
           'glass': lambda: sfx_toc_glass(sd), 'boing': lambda: sfx_boing(sd), 'ring': lambda: sfx_phone_ring(sd),
           'crack': lambda: sfx_crack_glow(sd), 'thud': lambda: sfx_thok_soft(sd), 'thok': lambda: sfx_thok_soft(sd),
           'tap': lambda: A.sfx_tap(sd), 'paper': lambda: sfx_band_in(sd), 'slide': lambda: sfx_band_in(sd),
           'land': lambda: sfx_parcel_land(sd), 'shimmer': lambda: sfx_ribbon_shimmer(sd), 'hum': lambda: sfx_violet_hum(sd),
           'swoosh': lambda: sfx_whoosh(sd), 'door': lambda: sfx_doors_close(sd), 'slam': lambda: sfx_thok_soft(sd),
           'knock': lambda: sfx_bonk(sd), 'bell': lambda: R.sfx_ding_msg(sd), 'rustle': lambda: A.sfx_cloth(sd, .3),
           'beep': lambda: sfx_tic(sd, 2400.0), 'bip': lambda: sfx_tic(sd, 2400.0), 'riser': lambda: sfx_low_riser(1.2, sd)}.get(fam)
    return (fam, sig()) if sig else (None, None)

# =====================================================================================================================
# the night counter under the bulb
# =====================================================================================================================
def night_bed(N, dur, cut, back, seed=741):
    """the bulb over the wax counter (« PAS REÇU. »'s night): the filament's 100 Hz family (phone-audible through its
    300-700 Hz harmonics), a slow sway, a fine hiss pulsing at 100 Hz, a whisper of night air — EXACTLY periodic over the
    film (every frequency an integer number of cycles, the noise circularly filtered): the loop has no seam. It leans in
    a little in the music's dead cut (cut -> back)"""
    t = np.arange(N) / SR; f = np.fft.rfftfreq(N, 1 / SR)
    per = lambda fr: round(fr * N / SR) * SR / N                         # an integer number of cycles over the film
    y = sum(a * np.sin(2 * np.pi * per(100 * h) * t + .7 * h) for h, a in
            ((1, .45), (2, .30), (3, .24), (4, .14), (5, .11), (6, .07), (7, .05), (9, .025)))
    y += .12 * np.sin(2 * np.pi * per(50) * t)
    k_sw = max(1, round(dur / 4.0)); y *= 1 + .07 * np.sin(2 * np.pi * k_sw * t / dur)
    out = np.zeros((N, 2))
    for c in range(2):
        h = np.fft.irfft(np.fft.rfft(nz(N, seed + c)) * ((f > 2500) & (f < 9000)), N); h /= h.std()
        a = np.fft.irfft(np.fft.rfft(nz(N, seed + 10 + c)) * np.where(f > 60, 1 / np.sqrt(np.maximum(f, 1)), 0) / (1 + (f / 1200) ** 4), N); a /= a.std()
        out[:, c] = y * .02 * (1 if c == 0 else .96) + h * .005 * (1 + .6 * np.sin(2 * np.pi * per(100) * t) ** 2) + a * .0012
    lift = 1 + .4 * np.clip((t - cut - .3) / 2.0, 0, 1) * np.clip((back - t) / .4, 0, 1)
    return out * lift[:, None]

def crackle_events(dur, cut, back, seed=751):
    """[(t, sig)] sparse filament crackles (~2.5/s, denser in the dead cut); every one ends before the film does"""
    r = rng(seed); ev = []; t = 0.0
    while True:
        t += r.exponential(1 / (2.5 + (2.5 if cut <= t < back else 0)))
        if t >= dur - .06: break
        k = int(r.integers(1, 5)); y = np.zeros(ns(.03))
        for j in range(k):
            c = bp(nz(ns(.0025), int(r.integers(1e9))), r.uniform(2500, 6500), 1.2) * np.linspace(1, 0, ns(.0025))
            place(y, c * r.uniform(.3, 1), ns(r.uniform(0, .02)))
        ev.append((t, y * r.uniform(.4, 1.0)))
    return ev

# =====================================================================================================================
# music
# =====================================================================================================================
CH = {nm: (nm, tones, root) for nm, tones, root in mk.PROG_MINOR + mk.PROG}
CH['E7'] = ('E7', [64, 68, 71, 74], 52)

def tense_plan(cues, mp):
    """stop-time segments of the F#-minor groove: [{k, a, e, role, beat}] — enter = music().tenseFrom (the ding) · aww =
    the « aww » cue (the band leaves BRK before it, re-anchors ON it). The last segment ends at music().cut (the gate)"""
    t0, cut = mp['tenseFrom'], mp['cut']
    an = [(t0, 'enter')]
    aw = first(cues, 'aww_guitar', t0 + .8, cut - .4)
    if aw is not None: an.append((aw, 'aww'))
    return [dict(k=k, a=a, e=(an[k + 1][0] - BRK if k + 1 < len(an) else cut), role=role, beat=BEAT) for k, (a, role) in enumerate(an)]

def compose_tense(M, segs, busy):
    """the night's tense makossa (F#m | D), density climbing bar by bar; the aww segment: two beats of nothing but the
    aww, then the band snaps back on the E7 (left hanging by the gate) with a riser"""
    gbar = 0
    for s in segs:
        k, a, e, role = s['k'], s['a'], s['e'], s['role']
        def put(sig, t, g=1.0, p=0.0, tag=None, _a=a, _e=e, _k=k):
            if _a - 1e-6 <= t < _e - 1e-6:
                M.put('groove', sig, t, g * G_TENSE, p, cut=True, tag=tag or ('music_in' if (_k == 0 and t - _a < .02) else ('seg', _k)))
        if role == 'enter':
            nb = max(1, int(math.ceil((e - a) / (4 * BEAT) - 1e-9)))
            for b in range(nb):
                tb = a + 4 * BEAT * b; ch = CH[('F#m', 'D')[b % 2]]; name, tones, root = ch
                mk.groove(put, tb, gbar, beat=BEAT, level='tense', prog=[ch] * 4)
                for j in range(16):
                    tj = tb + j * S16 + (.012 if j % 2 else 0.0)
                    if b >= 1 and mk.RHY[j]:
                        put(mk.guitar(m2f(tones[(j // 2) % len(tones)]), .09, bright=.45, decay=.98, seed=4000 + 16 * gbar + j, mute=1), tj, .15, -.45)
                    if b >= 1 and j % 2 == 0: put(A.rattle(4100 + 16 * gbar + j, .045, .9, 1.0), tj, .20 if j % 4 == 0 else .13, .35)
                    if b >= 2 and j % 4 == 2: put(A.conga(62 if j % 8 == 2 else 57, 4300 + 16 * gbar + j, slap=j % 8 == 6), tj, .34, -.3)
                gbar += 1
        else:                                                                     # 'aww': ON the aww, the band waits 2 beats
            back = a + 2 * BEAT
            s['back'] = back if back < e - .3 else None
            put(mk.bass(m2f(38), .95, .3), a, .30, 0, tag=('seg', k))            # a soft D pedal under the sweet strum
            if s['back'] is not None:
                ch = CH['E7']; name, tones, root = ch
                nb = max(1, int(math.ceil((e - back) / (4 * BEAT) - 1e-9)))
                for b in range(nb):
                    tb = back + 4 * BEAT * b
                    def put2(sig, t, g=1.0, p=0.0, _tb=tb):
                        put(sig, t, g, p, tag='band_back' if (abs(t - back) < .02) else ('seg', k))
                    mk.groove(put2, tb, gbar, beat=BEAT, level='tense', prog=[ch] * 4)
                    for j in range(16):
                        tj = tb + j * S16 + (.012 if j % 2 else 0.0)
                        if mk.RHY[j]:
                            put2(mk.guitar(m2f(tones[(j // 2) % len(tones)]), .09, bright=.45, decay=.98, seed=4500 + 16 * gbar + j, mute=1), tj, .16, -.45)
                        if j % 2 == 0: put2(A.rattle(4600 + 16 * gbar + j, .045, .9, 1.0), tj, .22 if j % 4 == 0 else .15, .35)
                        if j % 4: put2(mk.guitar(m2f(tones[mk.PICK[j] % len(tones)] + 12), .2, bright=.62, decay=.99, seed=4700 + 16 * gbar + j, mute=.5), tj, .11, .45)
                        if j % 4 == 2: put2(A.conga(62 if j % 8 == 2 else 57, 4800 + 16 * gbar + j, slap=j % 8 == 6), tj, .36, -.3)
                        for h in range(2):
                            put2(bk.balafon(m2f(tones[(j + h) % len(tones)] + 12 + (12 if j >= 8 else 0)), .25, 4900 + 32 * gbar + 2 * j + h),
                                 tj + h * S16 / 2, .09 + .05 * j / 16, -.45)
                    for q in range(4):
                        put2(mk.kick(), tb + q * BEAT, .55)                       # four on the floor
                        if q in (1, 3): put2(A.clap(5000 + 4 * gbar + q), tb + q * BEAT, .40, -.1)
                    gbar += 1
                put(mk.kick(), back, .55, 0, tag='band_back')                     # the band snaps back
                if not busy(back): put(I.stab([m - 12 for m in ch[1]], .16, 1.0), back, .5, 0, tag='band_back')
        if s is segs[-1]:                                                         # riser into the cut, killed by the gate
            r0 = s.get('back') or max(a, e - 1.5); d = max(.3, e - r0); n = ns(d + .1); u = np.clip(tt(n) / d, 0, 1)
            M.put('groove', dsp.tv_biquad(nz(n, 4600), 'bp', 900 * 7 ** u, 2.0) * u ** 1.8 * .6, r0, .34 * G_TENSE, 0, cut=True, tag=('seg', k), fade=False)

def compose_hold(M, a, until):
    """the A-major chord ALONE after « C'était un faux message ! » (the hanging E7 resolves): a soft strummed A on the
    makossa guitar, a short A bass, a warm pad held to `until` (music().fullFrom) — under THE RULE it is ducked like any
    music and stays >= 14 dB under the voice"""
    tag = 'major_in'
    for i, m in enumerate((45, 52, 57, 61, 64, 69)):
        M.put('groove', mk.guitar(m2f(m), 2.6, bright=.45, decay=.998, seed=6100 + i), a + .014 * i, .26 * G_HOLD, -.3 + .12 * i, tag=tag)
    M.put('groove', I.pad([57, 61, 64, 69, 76], max(1.0, until - a + .45), 1.0, seed=6150, cutoff=1500), a, 2.2 * G_HOLD, 0, tag=tag)
    M.put('groove', mk.bass(m2f(45), 1.2, .3), a, .45 * G_HOLD, 0, tag=tag)

def makossa_bars(M, a, stop, bar0, level, tagfn, g, avoid=(), beat=BEAT, extras=True):
    """A-major makossa bars from a (grid anchor) to stop; bright balafon / conga slaps never start inside `avoid`"""
    clear = lambda t: not any(x0 <= t <= x1 for x0, x1 in avoid)
    nb = max(1, int(math.ceil((stop - a) / (4 * beat) - 1e-9)))
    for b in range(nb):
        tb = a + 4 * beat * b
        def put(sig, t, gg=1.0, p=0.0, _b=b):
            if t < stop - 1e-6: M.put('groove', sig, t, gg * g, p, tag=tagfn(_b, t))
        prog = mk.PROG[(bar0 + b) % 4]
        mk.groove(put, tb, bar0 + b, beat=beat, level=level, prog=[prog] * 4)
        name, tones, root = prog
        for j in range(16):
            tj = tb + j * beat / 4 + (.012 if j % 2 else 0.0)
            if j % 2 == 0: put(A.rattle(5300 + 16 * (bar0 + b) + j, .04, .8, 1.1), tj, .14 if j % 4 else .19, .35)
            if extras and j in (6, 14) and clear(tj): put(A.balafon_bright(tones[(j // 6 + b) % 4] + 12, 5400 + 16 * (bar0 + b) + j, .6), tj, .16, -.4)
            if extras and j % 8 == 4 and (j != 12 or clear(tj)): put(A.conga(64 if j == 4 else 59, 5500 + 16 * (bar0 + b) + j, slap=j == 12), tj, .30, -.3)
    return nb

def compose_full(M, a, stop, avoid, busy):
    """the container, violet light: A-major full makossa from music().fullFrom (arrival: stab, kick, violet pad swell,
    shimmer) to the signature break"""
    makossa_bars(M, a, stop, 0, 'full', lambda b, t: 'full_in' if (b == 0 and t - a < .02) else ('full', b), G_MAJOR, avoid)
    tag = 'full_in'
    if not busy(a): M.put('groove', I.stab([57, 61, 64, 69], .22, 1.0), a, .9 * G_MAJOR, 0, tag=tag)
    M.put('groove', mk.kick(), a, .5 * G_MAJOR, 0, tag=tag)
    M.put('brand', A.soft_pad([69, 73, 76], max(1.0, min(2.2, stop - a + .3)), 1.0), a, .5 * G_BRAND, 0, tag=tag)
    M.put('brand', A.sfx_shimmer(5600, .5), a, .20 * G_BRAND, 0, tag=tag)

def compose_main(M, a, stop, avoid, busy):
    """the band slams back ON the enamel plate's tonk (the I after the signature's V): A-major makossa under N2 and the end
    card, to the break before the ritual stamp"""
    nb = makossa_bars(M, a, stop, 2, 'full', lambda b, t: 'brand_in' if (b == 0 and t - a < .02) else ('main', b), G_MAJOR, avoid)
    tag = 'brand_in'
    M.put('groove', mk.kick(), a, .6 * G_MAJOR, 0, tag=tag); M.put('groove', mk.bass(m2f(45), .4, .6), a, .5 * G_MAJOR, 0, tag=tag)
    if not busy(a) and not any(x0 <= a <= x1 for x0, x1 in avoid):
        M.put('groove', I.stab([57, 61, 64, 69], .2, 1.0), a, .9 * G_MAJOR, 0, tag=tag)
    return nb

def compose_end(M, hit2, t_final, busy, avoid, bar0=8):
    """the band slams back ON the ritual stamp, lighter (« lite »: no kick/bass/hats) under « Maintenant, tu sais. »; the
    last phrase is a slight ritardando (beat within .45-.58 s) so the final A chord lands ON a downbeat; an E accent
    (« pa- ») one beat before it — kick + bass only if it falls in a word. -> (stop, beat, accent kind)"""
    k = max(2, int(round((t_final - hit2) / BEAT))); bt = BEAT
    if .45 <= (t_final - hit2) / k <= .58: bt = (t_final - hit2) / k
    kk_ = int(math.floor((t_final - .3 - hit2) / bt + 1e-9)); stop = hit2 + max(kk_, 1) * bt
    if stop >= t_final - .1: stop = None
    makossa_bars(M, hit2, stop or (t_final - .05), bar0, 'lite', lambda b, t: 'hit2_band' if (b == 0 and t - hit2 < .02) else ('end', b),
                 G_MAJOR, avoid, beat=bt, extras=False)
    M.put('groove', mk.kick(), hit2, .6 * G_MAJOR, 0, tag='hit2_band')
    if not busy(hit2): M.put('groove', I.stab([57, 61, 64, 69], .18, 1.0), hit2, .8 * G_MAJOR, 0, tag='hit2_band')
    kind = None
    if stop is not None:
        inw = busy(stop, pre=.02)
        M.put('groove', mk.kick(), stop, .6 * G_MAJOR, 0, tag='stop'); M.put('groove', mk.bass(m2f(40), .18, .6), stop, .5 * G_MAJOR, 0, tag='stop')
        if not inw:
            M.put('groove', I.stab([52, 56, 59, 64], .10, 1.0), stop, .9 * G_MAJOR, 0, tag='stop'); M.put('groove', A.clap(6150), stop, .35 * G_MAJOR, -.1, tag='stop')
        kind = 'kick+bass (in a word)' if inw else 'full (kick bass stab clap)'
    return stop, bt, kind

# =====================================================================================================================
# levels + cue placement
# =====================================================================================================================
def mom_max(x):
    """max momentary loudness (400 ms, K-weighted, LUFS) of an event (mono = centre-panned)"""
    x = x if x.ndim == 2 else panst(x, 0.0)
    if len(x) < ns(.45): x = np.vstack([x, np.zeros((ns(.45) - len(x), 2))])
    _, lm = dsp.lufs_momentary(x, .01)
    return float(lm.max())

def put_cue(M, c, tag, parts, lvl, fade=True):
    """parts: [(stem, sig, dt, rel_gain, pan)] scaled together so that the cue reaches lvl + 20·log10(g) (g = the score's
    gain); returns the gain applied"""
    d0 = min(p[2] for p in parts); L = max(p[2] + len(p[1]) / SR for p in parts) - d0
    buf = np.zeros((ns(L) + 2, 2))
    for _, s, dt, gr, p in parts: R.place_at(buf, R.stereo_of(np.asarray(s, float), gr, p), ns(dt - d0))
    G = 10 ** ((lvl - mom_max(buf)) / 20) * float(c.get('g', 1) or 0)
    for stem, s, dt, gr, p in parts: M.put(stem, s, c['t'] + dt, gr * G, p, tag=tag, fade=fade)
    return G

def cue_parts(c, cues, st):
    """the sound of one cue: (parts [(stem, sig, dt, rel_gain, pan)] | None, special str | None). `st` = running counters"""
    t, name, pan = c['t'], c['name'], c.get('pan', 0) or 0; sd = 7000 + int(round(t * 1000)) % 997
    nxt = lambda nm, within=9.0: (lambda x: x if (x is not None and x - t <= within) else None)(first(cues, nm, t + 1e-6))
    def cnt(k): v = st.get(k, 0); st[k] = v + 1; return v
    stem = 'hit' if name in HITS else 'brand' if name in BRAND_CUES else 'sfx'
    P1 = lambda sig, p=pan: ([(stem, sig, 0.0, 1.0, p)], None)
    if name in GATES: return None, 'gate'
    if name in ('major', 'final_chord', 'bonzini_sig'): return None, name
    if name == 'thok_glass': return P1(sfx_thok_glass(), 0)
    if name == 'glass_crackle': return P1(sfx_glass_crackle())
    if name == 'breath_cut': return P1(sfx_breath_cut())
    if name == 'gecko_skitter': return P1(sfx_skitter(431 + 7 * cnt('skitter')))
    if name == 'thok_soft': return P1(sfx_thok_soft(441 + 3 * cnt('thok_soft')))
    if name == 'whoosh_soft':
        return P1(sfx_whoosh(sd, .30, -.2 + pan, .45 + pan, 300, 2200, .4))
    if name == 'parcel_land': return P1(sfx_parcel_land())
    if name == 'ding_msg': return P1(R.sfx_ding_msg(), .15 if pan == 0 else pan)
    if name == 'heart_pop': return P1(sfx_heart_pop(cnt('heart'), sd))
    if name == 'plate_pop': return P1(sfx_plate_pop())
    if name == 'aww_guitar': return P1(sfx_aww())
    if name == 'whoosh_small':
        b = nxt('boing_carton', .6); d = min(.32, (b - t)) if b is not None else .28
        return P1(sfx_whoosh(sd, max(.15, d), -.3 + pan, .3 + pan, 400, 2800, .45, .55 if b is not None else .3))
    if name == 'boing_carton': return P1(sfx_boing_carton(), 0)
    if name == 'bonk': return P1(sfx_bonk())
    if name == 'band_in': return P1(sfx_band_in())
    if name == 'phone_ring':
        pk = nxt('phone_pickup', 1.5); return P1(sfx_phone_ring(sd, min(1.2, (pk - t - .01)) if pk is not None else .9))
    if name == 'plate_flip': return P1(sfx_plate_flip())
    if name == 'phone_pickup': return P1(sfx_phone_pickup())
    if name == 'steel_descend':
        lr = nxt('low_riser', 1.6); return P1(sfx_steel_descend(sd, (lr - t) if lr is not None else .85), 0)
    if name == 'low_riser':
        bs = nxt('big_stamp', 3.5); return P1(sfx_low_riser(((bs - t) - .005) if bs is not None else 1.6), 0)
    if name == 'big_stamp': return P1(R.sfx_big_stamp(), 0)
    if name == 'crack_glow': return P1(sfx_crack_glow(), .05)
    if name == 'glass_shatter': return P1(sfx_glass_shatter(), 0)
    if name == 'peel': return P1(sfx_peel(), -.25 if pan == 0 else pan)
    if name == 'stamp': return P1(sfx_stamp_void(sd), .05)
    if name == 'clink': return P1(R.sfx_clink(CLINK_NOTES[min(cnt('clink'), 2)], sd))
    if name == 'tic': return P1(sfx_tic(sd, TIC_F[cnt('tic') % 4]))
    if name == 'gloup': return P1(R.sfx_gloup(cnt('gloup'), sd))
    if name == 'violet_hum': return P1(sfx_violet_hum(), 0)
    if name == 'glass_tonk': return P1(sfx_glass_tonk(), .1 if pan == 0 else pan)
    if name == 'ribbon_shimmer':
        sg = first(cues, 'bonzini_sig', t - .3, t + .9)
        return P1(sfx_ribbon_shimmer(sd, .5, sg is not None))
    if name == 'label_slap': return P1(sfx_label_slap(), .15 if pan == 0 else pan)
    if name == 'tonk': return P1(sfx_tonk(), 0)
    if name == 'pop': return P1(I.pop(sd), 0)
    if name == 'stamp_big': return P1(sfx_stamp_big(), 0)
    if name == 'whoosh':
        tc = nxt('toc_glass', 1.0); return P1(sfx_loop_whoosh((tc - t) if tc is not None else .45), 0)
    if name == 'toc_glass': return P1(sfx_toc_glass(), 0)
    if name == 'hic': return P1(R.sfx_hic())
    if name == 'boing': return P1(sfx_boing(sd))
    if name == 'boing_small': return P1(sfx_boing(sd, .32, 415.3))
    if name == 'doors_close': return P1(sfx_doors_close())
    if name == 'pin': return P1(sfx_pin())
    if name == 'line_tone': return P1(sfx_line_tone())
    fam, sig = sfx_family(name, sd)
    return ([('sfx', sig, 0.0, 1.0, pan)], f'family:{fam}') if sig is not None else (None, 'unknown')

# =====================================================================================================================
# compose everything
# =====================================================================================================================
def compose(sc, lines, status='', with_amb=True):
    T, DUR, cues, mp = sc['T'], sc['dur'], sc['cues'], sc['music']
    M = R.Mix(DUR); plan = {'voices': status}
    # ---- voices ---------------------------------------------------------------------------------------------------
    vinfo = []
    for v in lines:
        y, t0, on, off, info = R.voice_line(v)
        M.put('vox', y, t0, 1.0, 0.0, tag=('vox', v['id']), fade=False)
        vinfo.append(dict(v, sig_len=len(y) / SR, t0=t0, t1=t0 + len(y) / SR, film_on=on, film_off=off, **info))
    spans = spans_of(vinfo, sc); plan['spans_src'] = 'takes' if vinfo else 'score T/DUR (planned)'
    avoid = key_windows(sc); plan['avoid'] = avoid
    busy = make_busy(spans, words_abs(sc, vinfo)); plan['busy_src'] = 'words' if words_abs(sc, vinfo) else 'speech spans (no word times)'
    # ---- music ----------------------------------------------------------------------------------------------------
    segs = tense_plan(cues, mp); compose_tense(M, segs, busy); plan['segs'] = segs
    t_final = first(cues, 'final_chord', mp['sigAt']) or DUR - .7
    t_dry = first(cues, 'toc_glass', t_final) or first(cues, 'cut_dry') or DUR - .1
    compose_hold(M, mp['majorFrom'], mp['fullFrom'])
    sig = first(cues, 'bonzini_sig') or mp['sigAt']
    full_stop = sig - BRK if sig - BRK > mp['fullFrom'] + .6 else mp['fullFrom'] + .6
    compose_full(M, mp['fullFrom'], full_stop, avoid, busy)
    tonk = first(cues, 'tonk', sig, sig + 1.5)
    re_entry = tonk if tonk is not None else sig + SIG_GAP + .3
    hit2 = first(cues, 'stamp_big', re_entry + 1.0, t_final - .6)
    main_stop = (hit2 - BRK) if hit2 is not None else t_final - .05
    compose_main(M, re_entry, main_stop, avoid, busy)
    stop = beat2 = kind = None
    if hit2 is not None: stop, beat2, kind = compose_end(M, hit2, t_final, busy, avoid)
    plan['hold'] = dict(a=mp['majorFrom'], until=mp['fullFrom'])
    plan['full'] = dict(a=mp['fullFrom'], stop=full_stop, sig=sig)
    plan['main'] = dict(a=re_entry, tonk=tonk, stop=main_stop)
    plan['end'] = dict(hit2=hit2, stop=stop, accent=kind, final=t_final, dry=t_dry, beat2=beat2 or BEAT)
    # ---- the night counter --------------------------------------------------------------------------------------------
    if with_amb:
        nb_ = night_bed(ns(DUR), DUR, mp['cut'], mp['majorFrom'])
        nb_ *= dsp.undb(AMB_LUFS - dsp.lufs_integrated(nb_))
        M.put('amb', nb_, 0.0, 1.0, fade=False)
        for k, (tc, y) in enumerate(crackle_events(DUR, mp['cut'], mp['majorFrom'])): M.put('amb', y, tc, .012, .1)
    # ---- cues -------------------------------------------------------------------------------------------------------
    unknown = []; famd = []; levels = {}
    st = {}
    for i, c in enumerate(cues):
        tag = ('cue', i); parts, special = cue_parts(c, cues, st)
        if special == 'gate': continue
        if special == 'major': continue                                                # compose_hold (music().majorFrom)
        if special == 'final_chord': R.compose_final(M, c['t'], tag); continue
        if special == 'bonzini_sig':                                                   # the series signature, unchanged
            g = c.get('g', 1)
            M.put('brand', A.balafon_bright(88, 5800, 1.2), c['t'], .17 * g, -.15, tag=tag)
            M.put('brand', A.balafon_bright(92, 5801, 1.0), c['t'] + SIG_GAP, .18 * g, .15, tag=tag)
            M.put('brand', A._bell(m2f(100), .8, .3, 1, .002) * .5, c['t'] + SIG_GAP, .06 * g, .15, tag=tag)
            plan['sig'] = (c['t'], c['t'] + SIG_GAP); continue
        if parts is None: unknown.append(c['name']); continue
        if special and special.startswith('family'): famd.append(f"{c['name']}~{special[7:]}")
        levels[i] = put_cue(M, c, tag, parts, LVL.get(c['name'], LVL_UNKNOWN), fade=c['name'] not in NO_FADE)
    return M, vinfo, unknown, famd, plan, spans

# =====================================================================================================================
# render + mix
# =====================================================================================================================
def render(M, sc, fx=True):
    DUR, cut = sc['dur'], sc['music']['cut']
    N = ns(DUR + TAIL); raw = {}
    for stem, sig, t, g, p, c, tag in M.ev:
        k = (stem, c)
        if k not in raw: raw[k] = np.zeros((N, 2))
        R.place_at(raw[k], R.stereo_of(sig, g, p), ns(t))
    ir = R.irs(); gc = R.gate(N, cut); out = {}; dry_vox = None
    for (stem, c), x in raw.items():
        if stem == 'vox': dry_vox = x.copy()
        s = SENDS.get(stem)
        if s and fx: x = x + dsp.reverb(x, ir[s[0]], wet=s[1])
        if c: x = x * gc[:, None]
        out[stem] = out.get(stem, 0) + x
    for k in ('vox', 'groove', 'brand', 'final', 'sfx', 'hit', 'amb'):
        if k not in out: out[k] = np.zeros((N, 2))
    if dry_vox is None: dry_vox = np.zeros((N, 2))
    return out, dry_vox

def wrap_tail(x, N):
    """the part of a stem past the film's end wraps onto frame 0: the loop continues it (no step at the seam)"""
    y = x[:N].copy(); tail = x[N:]
    if len(tail): m = min(len(tail), N); y[:m] += tail[:m]
    return y

def lowcut_under_voice(x, d1, fc=MUSIC_HP_HZ, mode='duck'):
    """SCRIPT_V2.md §7.3: the music's low end (< fc, zero-phase complementary split) — removed while a voice speaks (on the
    sidechain curve: d1 = 0 .. -1), kept in the pauses ('duck'); removed everywhere ('static'); kept ('off')"""
    if mode == 'off' or not fc: return x
    lo, hi = dsp.zp_split(x, fc, 2)
    if mode == 'static': return hi
    return hi + lo * (1 - np.clip(-d1, 0, 1))[:, None]

def mixdown(st, dry_vox, sc, spans, t_back, t_dry, final_in_speech=False, hp_mode='duck'):
    """stems -> ducked stems + premaster (N = DUR exactly); the head (before tenseFrom), the music hole (cut -> next music)
    and the dry end are applied AFTER every filter so they stay digital silence; SFX / amb tails wrap onto frame 0"""
    DUR, mp = sc['dur'], sc['music']; N = ns(DUR)
    d1, act = R.duck_db(dry_vox[:N], [(a, b) for _, a, b in spans])
    st = {k: (wrap_tail(v, N) if k in WRAP else v[:N].copy()) for k, v in st.items()}
    duck = dict(DUCKED)
    if final_in_speech: duck['final'] = DUCK_DB
    for k, depth in duck.items(): st[k] *= dsp.undb(d1 * depth)[:, None]
    for k in ('groove', 'brand'): st[k] = R.carve(st[k], d1, R.CARVE_DB)
    for k in MUSIC: st[k] = lowcut_under_voice(st[k], d1, MUSIC_HP_HZ, hp_mode)
    hole = R.gate(N, mp['cut'], t_on=t_back)
    dry = R.gate(N, t_dry, fade=.012)
    head = np.ones(N); head[:ns(mp['tenseFrom'])] = 0.0                     # the zero-phase filters pre-ring a few 1e-3
    for k in MUSIC: st[k] *= (hole * dry * head)[:, None]
    music = sum(st[k] for k in MUSIC)
    P = A.sclip(music, .7) + st['sfx'] + A.sclip(st['hit'], .5) + st['amb'] + st['vox']
    return st, P, d1, act

def master_tp(P):
    """R.master (HP 28 Hz, -14 LUFS, true-peak limiter) with the ceiling lowered until TP <= -1 dBTP"""
    Y, g, gl = R.master(P); tp = R.true_peak_db(Y); ceil = -1.3
    while tp > -1.0 and ceil > -3:
        ceil -= (tp + 1.0) + .05; Y, g, gl = R.master(P, ceiling=ceil); tp = R.true_peak_db(Y)
    return Y, g, gl, ceil

def placeholder_voice(N, spans, seed=777):
    """speech-shaped noise at VOX_REF LUFS per line on the planned spans — ONLY to estimate the master gain the film will
    get once the voices are in (never written anywhere)"""
    x = np.zeros((N, 2))
    for k, (_, a, b) in enumerate(spans):
        n = ns(b - a); t = tt(n)
        if n < ns(.1): continue
        y = dsp.butter(nz(n, seed + k), 'bp', [150, 4000], 2) * (.35 + .65 * np.abs(np.sin(2 * np.pi * 2.2 * t)))
        y *= np.minimum(1, t / .03) * np.clip((n / SR - t) / .03, 0, 1)
        y = y * dsp.undb(VOX_REF - R.lufs_mono(y))
        i = ns(a); m = min(n, N - i)
        if m > 0: x[i:i + m] += panst(y, 0)[:m]
    return x

# =====================================================================================================================
# checks + build
# =====================================================================================================================
def cue_level(M, tag, G=1.0):
    """max momentary loudness (400 ms) of a cue's own events rendered alone, dry, times G"""
    evs = [e for e in M.ev if e[6] == tag]
    if not evs: return None
    t0 = min(e[2] for e in evs); t1 = max(e[2] + len(e[1]) / SR for e in evs)
    buf = np.zeros((ns(t1 - t0) + ns(.45), 2))
    for e in evs: R.place_at(buf, R.stereo_of(e[1], e[3], e[4]), ns(e[2] - t0))
    _, lm = dsp.lufs_momentary(buf * G, .02)
    return float(np.max(lm)) if len(lm) else None

def words_abs(sc, vinfo):
    """absolute word windows [(id, w, s, e)]: from the takes (vocheck words) when voiced, else timing.json words, else []"""
    out = []
    if vinfo:
        for v in vinfo:
            for w in v['words']:
                s = v['at'] + max(w['s'], v['on']) * v['stretch']; e = v['at'] + min(w['e'], v['off']) * v['stretch']
                if e > s: out.append((v['id'], w['w'], s, e))
    else:
        for i, ws in (sc.get('words') or {}).items():
            if i in sc['T']: out += [(i, w['w'], sc['T'][i] + w['s'], sc['T'][i] + w['e']) for w in ws if w['e'] > w['s']]
    return out

def grid_rows(sc, plan):
    """every musical hit vs the grid in force"""
    rows = []
    def row(nm, tc, gname, a, bt):
        if tc is None or a is None: return
        x = (tc - a) / bt; k = round(x); k16 = round(x * 4) / 4
        rows.append(dict(name=nm, t=tc, grid=gname, beat=a + k * bt, err=(x - k) * bt * 1000, err16=(x - k16) * bt * 1000))
    for s in plan['segs']:
        row(f"{s['role']} anchor", s['a'], f"tense #{s['k']}", s['a'], s['beat'])
        if s.get('back'): row('band back', s['back'], f"tense #{s['k']}", s['a'], s['beat'])
    f = plan['full']; row('full arrival', f['a'], 'full', f['a'], BEAT)
    m = plan['main']; row('re-entry (tonk)', m['a'], 'main (anchor)', m['a'], BEAT)
    e = plan['end']
    if e.get('hit2'):
        row('ritual stamp', e['hit2'], 'end (anchor)', e['hit2'], e['beat2'])
        if e.get('stop'): row('stop accent', e['stop'], f"end rit. {60 / e['beat2']:.0f}bpm", e['hit2'], e['beat2'])
        row('final chord', e['final'], f"end rit. {60 / e['beat2']:.0f}bpm", e['hit2'], e['beat2'])
    return rows

def build(sheet=False):
    import soundfile as sf, pyloudnorm as pyln
    try:
        if os.nice(0) < 5: os.nice(5 - os.nice(0))
    except Exception: pass
    hp_mode = str(arg('--music-hp', 'duck'))
    if hp_mode not in ('duck', 'static', 'off'): hp_mode = 'duck'
    sc = score(); T, DUR, mp = sc['T'], sc['dur'], sc['music']; N = ns(DUR)
    lines, vstatus = voice_plan(sc)
    log(f'[E4] score: {sc["src"]} · {len(sc["cues"])} cues · DUR {DUR} s · timing: '
        f'{"data/timing.json" if os.path.exists(TIMING_JSON) else "the score DEFAULTS (no data/timing.json)"}')
    log(f'[E4] music plan: {json.dumps({k: (round(v, 3) if isinstance(v, float) else v) for k, v in mp.items()})}')
    log(f'[E4] voices: {vstatus}' + ('' if lines else ' -> MUSIC + SFX ONLY (the music is still ducked on the score\'s planned speech spans)'))
    M, vinfo, unknown, famd, plan, spans = compose(sc, lines, vstatus)
    if unknown: log('[E4] WARNING cue names without any sound (listed in the report):', unknown)
    if famd: log('[E4] WARNING cue names played by their family\'s sound:', famd)
    log(f'[E4] {len(M.ev)} events · rendering')
    st, dry_vox = render(M, sc)
    nonfinite = [k for k, v in st.items() if not np.isfinite(v).all()]
    if nonfinite:                                                          # never ship NaN: say it, zero the bad samples
        log(f'[E4] ERROR non-finite samples in the stems {nonfinite} (zeroed)')
        for k in nonfinite: st[k] = np.nan_to_num(st[k], nan=0.0, posinf=0.0, neginf=0.0)
        dry_vox = np.nan_to_num(dry_vox, nan=0.0, posinf=0.0, neginf=0.0)
    seg_rows = []
    for s in plan['segs']:
        ne = sum(1 for ev in M.ev if ev[6] in (('seg', s['k']),) or (s['k'] == 0 and ev[6] == 'music_in') or (ev[6] == 'band_back' and s['role'] == 'aww'))
        x = st['groove'][ns(s['a']):ns(s['e'])]
        seg_rows.append(dict(s, events=ne, rate=ne / max(1e-3, s['e'] - s['a']), lufs=float(dsp.lufs_integrated(x)) if len(x) > ns(.4) else None))
    t_back = min((e[2] for e in M.ev if e[0] in MUSIC and not e[5] and e[2] > mp['cut']), default=DUR)
    t_dry = plan['end']['dry']
    final_in_speech = talking_at(spans, plan['end']['final'], pre=0.0)
    pre = {k: v[:N].copy() for k, v in st.items()}
    st, P, d1, act = mixdown(st, dry_vox, sc, spans, t_back, t_dry, final_in_speech, hp_mode)
    proj = None; PH = None if vinfo else placeholder_voice(N, spans)
    if vinfo or arg('--me-norm'): Y, g, gl, ceil = master_tp(P)
    else:
        # NO VOICES: the master (gain + limiter) is computed on music + SFX + a speech-shaped placeholder at -18 LUFS per line
        # on the planned spans — the chain the film will get with its voices — and mix.wav = the music + SFX share of it
        # (an M&E at the final balance). Normalising the M&E alone to -14 LUFS would add >10 dB and heavy limiting.
        Yf, g, gl, ceil = master_tp(P + PH)
        Y = dsp.butter(P, 'hp', 28, 2) * dsp.undb(g) * gl[:, None]
        proj = dict(lufs=pyln.Meter(SR).integrated_loudness(Yf), tp_dbtp=R.true_peak_db(Yf), max_gr_db=float(-20 * np.log10(gl.min())),
                    note='music + SFX + speech-shaped placeholder (-18 LUFS per planned line) through the same master')
        del Yf
    assert len(Y) == N
    os.makedirs(os.path.join(OUT_A, 'stems'), exist_ok=True)
    dsp.save(os.path.join(OUT_A, 'mix.wav'), Y, 'PCM_24')
    G = dsp.undb(g)
    stems = {'vox': st['vox'], 'music': sum(st[k] for k in MUSIC), 'sfx': st['sfx'], 'hits': st['hit'], 'amb': st['amb']}
    for k, v in stems.items(): dsp.save(os.path.join(OUT_A, 'stems', f'{k}.wav'), v * G, 'FLOAT')
    # ---------------- checks ----------------
    Z, sr = sf.read(os.path.join(OUT_A, 'mix.wav')); meter = pyln.Meter(SR)
    master_mode = 'full mix -> -14 LUFS' if vinfo else ('M&E normalised alone to -14 LUFS (--me-norm, preview only)' if arg('--me-norm')
                                                        else 'M&E at the projected final gain (no voices)')
    rep = dict(sr=sr, n=len(Z), dur=len(Z) / sr, channels=Z.shape[1], master_gain_db=g, limiter_ceiling_db=ceil,
               lufs=meter.integrated_loudness(Z), tp_dbtp=R.true_peak_db(Z), sample_peak_db=20 * math.log10(np.abs(Z).max()),
               max_gr_db=float(-20 * np.log10(gl.min())), max_gr_t=float(np.argmin(gl) / SR), clipped=int((np.abs(Z) >= .9999).sum()),
               src=sc['src'], lra=R.lra(Z), dc=[float(Z[:, 0].mean()), float(Z[:, 1].mean())], unknown=unknown, family=famd,
               voices_status=vstatus, voiced=bool(vinfo), timing='data/timing.json' if os.path.exists(TIMING_JSON) else 'score defaults',
               music_plan={k: v for k, v in mp.items()}, T=T, DUR=sc.get('DUR'), master_mode=master_mode, projected=proj, nonfinite_stems=nonfinite,
               mix_settings=dict(DUCK_DB=DUCK_DB, SFX_DUCK_DB=SFX_DUCK_DB, HIT_DUCK_DB=HIT_DUCK_DB, CARVE_DB=R.CARVE_DB, VOX_TRIM=R.VOX_TRIM,
                                 DUCKED=sorted(DUCKED) + (['final'] if final_in_speech else []), MUSIC_HP_HZ=MUSIC_HP_HZ, music_hp_mode=hp_mode,
                                 VOX_REF=VOX_REF, AMB_LUFS=AMB_LUFS))
    rep['seam'] = dict(step=float(np.abs(Z[0] - Z[-1]).max()), local_p99=float(np.percentile(np.abs(np.diff(Z[-ns(.03):], axis=0)), 99)),
                       head_5ms_peak=float(np.abs(Z[:ns(.005)]).max()), tail_20ms_peak=float(np.abs(Z[-ns(.02):]).max()))
    sm = np.vstack([Z[-ns(.02):], Z[:ns(.02)]]); dd = np.abs(np.diff(sm, axis=0)).max(1)
    rep['seam']['diff_at_seam'] = float(dd[ns(.02) - 1]); rep['seam']['diff_p999_around'] = float(np.percentile(dd, 99.9))
    mus = stems['music'] * G; vox = stems['vox'] * G; rest = (stems['sfx'] + stems['hits'] + stems['amb']) * G
    vox_ph, oth_ph = (R.phone(vox), R.phone(mus + rest)) if vinfo else (None, None)
    em = R.env_db(mus)
    def music_off(t):
        pre_ = em[max(0, ns(t - .3)):ns(t - .01)].max()
        nzi = np.nonzero(em[ns(t - .3):ns(t + .2)] > pre_ * 1e-3)[0]
        return (ns(t - .3) + int(nzi.max())) / SR if len(nzi) else None
    rows = []
    for i, c in enumerate(sc['cues']):
        t, name = c['t'], c['name']
        if name in GATES:
            off = music_off(t); seg_ = mus[ns(t):(ns(t_back) if name == 'music_cut' else N)]
            rows.append(dict(t=t, name=name, kind='music off -60dB', on=off, err=None if off is None else (off - t) * 1000, mix=None, mix_err=None,
                             lvl=None, lu=None, note=f'music max |x| after = {float(np.abs(seg_).max()) if len(seg_) else 0:.1e}'))
            continue
        tag = 'major_in' if name == 'major' else ('cue', i)
        o, _ = R.iso_onset(M, tag)
        if o is None: rows.append(dict(t=t, name=name, kind='-', on=None, err=None, mix=None, mix_err=None, lvl=None, lu=None,
                                       note='NO SOUND (unknown name)' if name in unknown else 'no event')); continue
        f = A.flux_onset(Z, t); lv = cue_level(M, tag); lv_post = None if lv is None else lv + g
        rows.append(dict(t=t, name=name, kind='alone', on=o, err=(o - t) * 1000, mix=f, mix_err=None if f is None else (f - t) * 1000,
                         lvl=lv_post, lu=None if lv is None else lv - VOX_REF, note='the held A-major chord (music().majorFrom)' if name == 'major' else ''))
    # the music's own entries (anchors of the plan)
    aww_seg = next((s for s in plan['segs'] if s['role'] == 'aww'), None)
    for tag, tref, note in (('music_in', mp['tenseFrom'], 'music().tenseFrom (the ding)'),
                            ('band_back', aww_seg.get('back') if aww_seg else None, 'band back on the E7, 2 beats after the aww'),
                            ('full_in', mp['fullFrom'], 'music().fullFrom (the container)'),
                            ('brand_in', plan['main']['a'], 'band ON the enamel tonk'),
                            ('hit2_band', plan['end']['hit2'], 'band back ON the ritual stamp'),
                            ('stop', plan['end']['stop'], f"E accent ({plan['end']['accent']})")):
        if tref is None: continue
        o, _ = R.iso_onset(M, tag)
        if o is None: continue
        f = A.flux_onset(Z, tref); lv = cue_level(M, tag)
        rows.append(dict(t=tref, name=tag, kind='alone', on=o, err=(o - tref) * 1000, mix=f, mix_err=None if f is None else (f - tref) * 1000,
                         lvl=None if lv is None else lv + g, lu=None if lv is None else lv - VOX_REF, note=note))
    if plan.get('sig'):                                                    # the signature's 2nd note (not a separate cue)
        s2 = plan['sig'][1]; evs = [e for e in M.ev if e[6] and e[6][0] == 'cue' and abs(e[2] - s2) < 1e-9]
        f = A.flux_onset(Z, s2)
        rows.append(dict(t=s2, name='sig note 2', kind='placed', on=evs[0][2] if evs else None, err=0.0 if evs else None, mix=f,
                         mix_err=None if f is None else (f - s2) * 1000, lvl=None, lu=None, note='G#6, SIG_GAP after note 1'))
    rep['cues'] = rows
    rep['cues_ok'] = all(r['err'] is not None and abs(r['err']) <= 15 for r in rows if r['name'] not in unknown)
    rep['cue_names'] = sorted({c['name'] for c in sc['cues']})
    rep['grid'] = grid_rows(sc, plan); rep['segments'] = seg_rows
    rep['plan'] = plan
    # speech: never two voices at once (real takes, else the planned spans)
    sp = sorted(spans, key=lambda x: x[1]); ov = []
    for (i1, a1, b1), (i2, a2, b2) in zip(sp, sp[1:]):
        if a2 < b1 - 1e-6: ov.append(dict(a=i1, b=i2, overlap=b1 - a2, two_speakers=speaker(sc, i1) != speaker(sc, i2)))
    gaps = [dict(a=i1, b=i2, gap=a2 - b1, change=speaker(sc, i1) != speaker(sc, i2)) for (i1, _, b1), (i2, a2, _) in zip(sp, sp[1:])]
    rep['speech'] = dict(src=plan['spans_src'], spans=[dict(id=i, on=a, off=b, who=speaker(sc, i)) for i, a, b in sp], overlaps=ov,
                         gaps=gaps, min_gap=min((x['gap'] for x in gaps), default=None),
                         min_gap_speaker_change=min((x['gap'] for x in gaps if x['change']), default=None),
                         two_voices_at_once=any(o_['two_speakers'] for o_ in ov), sequence=' '.join(f'{i}:{speaker(sc, i)}' for i, _, _ in sp))
    vrows = []; prev = None
    ev = R.env_db(dry_vox[:N], .01) if vinfo else None                   # measured on/off: the DRY voice (no reverb tail)
    for v in vinfo:
        a, b = ns(v['film_on']), ns(v['film_off'])
        seg = ev[ns(v['t0']):ns(v['t1'])]; thr = seg.max() * 10 ** (-30 / 20)
        nzi = np.nonzero(seg > thr)[0] if len(seg) and seg.max() > 0 else np.array([], int)
        m_on, m_off = (v['t0'] + nzi[0] / SR, v['t0'] + nzi[-1] / SR) if len(nzi) else (v['film_on'], v['film_off'])
        pm = R.kpow(mus, a, b); no_music = pm < 1e-12
        margin = 10 * math.log10(R.kpow(vox, a, b) / pm)
        margin_all = 10 * math.log10(R.kpow(vox, a, b) / R.kpow(mus + rest, a, b))
        wm = []; lp = R.kpow(vox, a, b); nskip = 0
        for w in v['words']:
            wa = ns(v['at'] + max(w['s'], v['on']) * v['stretch']); wb = ns(v['at'] + min(w['e'], v['off']) * v['stretch'])
            if wb - wa > ns(.04) and R.kpow(vox, wa, wb) < lp * .01: nskip += 1; continue
            if wb - wa > ns(.04):
                wm.append((w['w'], 10 * math.log10(R.kpow(vox, wa, wb) / R.kpow(mus, wa, wb)),
                           10 * math.log10(R.kpow(vox, wa, wb) / R.kpow(mus + rest, wa, wb)),
                           10 * math.log10(R.kpow(vox_ph, wa, wb) / R.kpow(oth_ph, wa, wb))))
        vrows.append(dict(id=v['id'], who=speaker(sc, v['id']), file=v['file'], at=v['at'], stretch=v['stretch'], t0=v['t0'], t1=v['t1'],
                          on=v['film_on'], off=v['film_off'], T=T.get(v['id']), m_on=m_on, m_off=m_off, margin=margin, no_music=no_music,
                          margin_all=margin_all, word_min=min((x[1] for x in wm), default=None), word_min_all=min((x[2] for x in wm), default=None),
                          word_worst=min(wm, key=lambda x: x[2])[0] if wm else None, words_checked=len(wm), words_pause=nskip,
                          gap=None if prev is None else v['t0'] - prev['t1'], speech_gap=None if prev is None else v['film_on'] - prev['film_off'],
                          measured_gap=None if prev is None else m_on - prev['m_off'],
                          phone=10 * math.log10(R.kpow(vox_ph, a, b) / R.kpow(oth_ph, a, b)),
                          phone_word_min=min((x[3] for x in wm), default=None), phone_word=min(wm, key=lambda x: x[3])[0] if wm else None,
                          lufs=lufs_safe(vox[ns(v['t0']):ns(v['t1'])]), deess=v['deess_max_db'], words_m=wm,
                          finite=bool(np.isfinite(vox[ns(v['t0']):ns(v['t1'])]).all())))
        prev = dict(v, m_off=m_off)
    rep['voices'] = vrows
    rep['voices_overlap'] = bool(ov) or any(r['measured_gap'] is not None and r['measured_gap'] < 0 for r in vrows)
    n1 = next((r for r in vrows if r['id'] == 'N1'), None)
    rep['voices_ok'] = bool(vinfo) and (not rep['voices_overlap']) and all(r['margin'] >= 10 for r in vrows) and (n1 is None or n1['no_music'] or n1['margin'] >= 14)
    # expected margins (pre-master, music after duck/carve/low cut) vs a voice line at VOX_REF on each speech span
    lk = lambda x, a, b: -0.691 + 10 * math.log10(R.kpow(x, a, b))
    mus_pm = sum(st[k] for k in MUSIC); rest_pm = st['sfx'] + st['hit'] + st['amb']
    ph_v, ph_m, ph_a = (R.phone(PH), R.phone(mus_pm), R.phone(mus_pm + rest_pm)) if PH is not None else (None, None, None)
    exp_rows = []
    for i, a0, b0 in spans:
        a, b = ns(a0), ns(b0)
        if b - a < ns(.1): continue
        ml = lk(mus_pm, a, b) if np.abs(mus_pm[a:b]).max() > 0 else None
        al = lk(mus_pm + rest_pm, a, b)
        pm_ = pa_ = None
        if ph_v is not None and R.kpow(ph_v, a, b) > 1e-12:
            pm_ = None if ml is None else 10 * math.log10(R.kpow(ph_v, a, b) / R.kpow(ph_m, a, b))
            pa_ = 10 * math.log10(R.kpow(ph_v, a, b) / R.kpow(ph_a, a, b))
        exp_rows.append(dict(id=i, who=speaker(sc, i), on=a0, off=b0, music_lufs=ml, all_lufs=al,
                             margin_music=None if ml is None else VOX_REF - ml, margin_all=VOX_REF - al, phone_music=pm_, phone_all=pa_))
    rep['expected_margins'] = dict(note=f'VOX_REF {VOX_REF} LUFS per line vs the K-weighted mean of the ducked music (and of everything '
                                        f'else) over each speech span, pre-master; phone_* = the speech-shaped placeholder vs the music '
                                        f'(vs everything) through the 300 Hz-8 kHz phone band (no voices only)', rows=exp_rows)
    e_n1 = next((r for r in exp_rows if r['id'] == 'N1'), None)
    rep['n1_hold'] = dict(min_db=14.0, expected=None if e_n1 is None else e_n1['margin_music'],
                          real=None if n1 is None else (None if n1['no_music'] else n1['margin']),
                          ok=(e_n1 is None or e_n1['margin_music'] is None or e_n1['margin_music'] >= 14) and (n1 is None or n1['no_music'] or n1['margin'] >= 14))
    # loud cues vs the words (RULE P1) / the speech spans
    wa_ = words_abs(sc, vinfo); lrows = []
    for c in sc['cues']:
        if c['name'] not in LOUD or (c.get('g', 1) or 0) < .2: continue
        inw = [f'{w} ({i})' for i, w, s, e in wa_ if s - .03 + .005 < c['t'] < e - .005]
        insp = [i for i, a, b in spans if a + .01 < c['t'] < b - .01]
        lrows.append(dict(t=c['t'], name=c['name'], in_word=inw[0] if inw else None, in_span=insp[0] if insp else None))
    mrows = []
    for tag, tm_ in (('music_in', mp['tenseFrom']), ('band_back', aww_seg.get('back') if aww_seg else None), ('major_in', mp['majorFrom']),
                     ('full_in', mp['fullFrom']), ('brand_in', plan['main']['a']), ('hit2_band', plan['end']['hit2']), ('stop', plan['end']['stop']),
                     ('final', plan['end']['final'])):
        if tm_ is None: continue
        inw = [f'{w} ({i})' for i, w, s_, e in wa_ if s_ + .01 < tm_ < e - .01]; insp = [i for i, a, b in spans if a + .01 < tm_ < b - .01]
        mrows.append(dict(t=tm_, name=tag, in_word=inw[0] if inw else None, in_span=insp[0] if insp else None))
    rep['loud_vs_words'] = dict(words_src=('none (no word times: the score defaults)' if not wa_ else ('takes (vocheck)' if vinfo else 'timing.json words')),
                                rows=lrows, inside_words=[r for r in lrows if r['in_word']], music=mrows)
    # silences, levels
    a_, b_ = ns(mp['cut']), ns(t_back)
    rep['cut'] = dict(t=mp['cut'], t_back=t_back, major_from=mp['majorFrom'], back_err_ms=(t_back - mp['majorFrom']) * 1000,
                      music_max=float(np.abs(mus[a_:b_]).max()) if b_ > a_ else 0.0,
                      music_pre_rms_db=20 * math.log10(np.sqrt(np.mean(mus[max(0, a_ - ns(.5)):a_] ** 2)) + 1e-12),
                      mix_rms_db=20 * math.log10(np.sqrt(np.mean(Z[a_:b_] ** 2)) + 1e-12),
                      amb_rms_db=20 * math.log10(np.sqrt(np.mean((stems['amb'] * G)[a_:b_] ** 2)) + 1e-12))
    rep['dry'] = dict(t=t_dry, music_max_after=float(np.abs(mus[ns(t_dry):]).max()) if ns(t_dry) < N else 0.0)
    rep['silent_head'] = dict(until=mp['silentUntil'], music_max=float(np.abs(mus[:ns(mp['silentUntil'])]).max()))
    rep['digital_silence_ok'] = rep['silent_head']['music_max'] == 0 and rep['cut']['music_max'] == 0 and rep['dry']['music_max_after'] == 0
    rep['duck_max_db'] = float(-d1.min() * DUCK_DB)
    rep['final_after_speech_ms'] = (plan['end']['final'] - max((b for _, a, b in spans), default=0)) * 1000
    lev = {}
    for k, v in stems.items():
        x = v * G; li = float(dsp.lufs_integrated(x)) if np.abs(x).max() > 0 else None
        _, lm = dsp.lufs_momentary(x, .05)
        lev[k] = dict(lufs_int=li, lufs_m_max=float(lm.max()) if len(lm) and np.abs(x).max() > 0 else None,
                      peak_dbfs=20 * math.log10(np.abs(x).max() + 1e-12),
                      low_150_db=(10 * math.log10(np.mean(dsp.butter(x.mean(1), 'lp', 150, 4) ** 2) / (np.mean(x.mean(1) ** 2) + 1e-20) + 1e-20)
                                  if np.abs(x).max() > 0 else None))
    rep['stem_levels_post_master'] = lev
    sec = {}                                                               # music level per section (un-ducked, pre-master)
    aw = aww_seg['a'] if aww_seg else mp['cut']
    for nm, a0, a1 in (('tense enter', mp['tenseFrom'], aw - BRK), ('aww + E7', aw, mp['cut']), ('A held (N1)', mp['majorFrom'], mp['fullFrom']),
                       ('full (C5)', mp['fullFrom'], plan['full']['stop']), ('main (N2+N3a)', plan['main']['a'], plan['main']['stop']),
                       ('end (lite)', plan['end']['hit2'] or plan['main']['stop'], plan['end']['final'])):
        x = (pre['groove'] + pre['brand'] + pre['final'])[ns(a0):ns(a1)]
        sec[nm] = dict(a=a0, b=a1, lufs_premaster=float(dsp.lufs_integrated(x)) if len(x) > ns(.4) and np.abs(x).max() > 0 else None)
    rep['music_sections'] = sec
    # report
    log(f'[E4] mix.wav {rep["n"]} samples = {rep["dur"]:.6f} s @ {sr} Hz x{rep["channels"]} · {rep["lufs"]:.2f} LUFS · TP {rep["tp_dbtp"]:.2f} dBTP · '
        f'sample peak {rep["sample_peak_db"]:.2f} dBFS · LRA {fm(rep["lra"], ".1f")} LU · master {g:+.2f} dB · limiter max GR '
        f'{rep["max_gr_db"]:.1f} dB @ {rep["max_gr_t"]:.2f} s (ceiling {ceil:.2f}) · clipped {rep["clipped"]} · {rep["master_mode"]}')
    if proj: log(f'[E4] PROJECTED final (with the speech-shaped placeholder): {proj["lufs"]:.2f} LUFS · TP {proj["tp_dbtp"]:.2f} dBTP · '
                 f'limiter max GR {proj["max_gr_db"]:.1f} dB')
    log('[E4] cues (alone = the cue\'s own events rendered alone, 10 % of the max of a 1-ms envelope; mix = spectral-flux onset in mix.wav; '
        'LUFS-M = the cue alone, post master gain; LU = pre-master re a voice line at -18 LUFS)')
    for r in rows:
        log(f'    {r["t"]:7.3f}  {r["name"]:16s} {r["kind"]:6s} {fm(r["err"], "+6.1f", "   -  ", " ms")}   mix {fm(r["mix_err"], "+6.1f", "   -  ", " ms")}'
            f'   {fm(r["lvl"], "6.1f", "    - ", " LUFS-M")} {fm(r["lu"], "+6.1f", "    - ", " LU")}  {r["note"]}')
    log(f'[E4] cues within 15 ms: {rep["cues_ok"]} · cue names: {len(rep["cue_names"])} · unknown: {unknown or "none"} · family: {famd or "none"}')
    log('[E4] tense segments: ' + ' · '.join(f'#{r["k"]} {r["role"]} {r["a"]:.3f}-{r["e"]:.3f}{" back " + format(r["back"], ".3f") if r.get("back") else ""} '
                                           f'{r["rate"]:.0f} ev/s {fm(r["lufs"], ".1f")} LUFS' for r in seg_rows))
    log('[E4] grid: ' + ' · '.join(f'{x["name"]}@{x["t"]:.3f} [{x["grid"]}] {x["err"]:+.0f} ms' for x in rep['grid']))
    log('[E4] music sections (groove+brand+final, pre-master, un-ducked): ' + ' · '.join(
        f'{k} {v["a"]:.2f}-{v["b"]:.2f} {fm(v["lufs_premaster"], ".1f")}' for k, v in sec.items()))
    log('[E4] stems (post master): ' + ' · '.join(f'{k} {fm(v["lufs_int"], ".1f")} LUFS / max-M {fm(v["lufs_m_max"], ".1f")} / pk {v["peak_dbfs"]:.1f}'
                                                 for k, v in lev.items()))
    if vinfo:
        log('[E4] voices')
        for r in vrows:
            log(f'    {r["id"]:4s} {r["who"]:3s} {r["file"]:11s} speech {r["on"]:7.3f}-{r["off"]:7.3f} (T {r["T"]}) · over music '
                f'{"no music" if r["no_music"] else format(r["margin"], "5.1f") + " dB"} (worst word {fm(r["word_min"], ".1f")}) · over all '
                f'{r["margin_all"]:5.1f} dB (worst {r["word_worst"]} {fm(r["word_min_all"], ".1f")}) · phone {r["phone"]:5.1f} (worst {r["phone_word"]} '
                f'{fm(r["phone_word_min"], ".1f")}) · gap {fm(r["measured_gap"], ".3f")} · {r["lufs"]:.1f} LUFS')
        if '--words' in sys.argv:
            for r in vrows: log(f'    {r["id"]}: ' + ' '.join(f'{w}[{a:+.0f}/{b:+.0f}/{c:+.0f}]' for w, a, b, c in r['words_m']))
        log(f'[E4] all >= 10 dB over the music: {all(r["margin"] >= 10 for r in vrows)} · voices ok: {rep["voices_ok"]}')
    else:
        log('[E4] expected margins (no voices; a line at -18 LUFS vs the ducked music / everything; phone band: placeholder vs music / '
            'everything): ' + ' · '.join(f'{r["id"]} {fm(r["margin_music"], "+.0f", "silent")}/{r["margin_all"]:+.0f} '
                                         f'(ph {fm(r["phone_music"], "+.0f", "-")}/{fm(r["phone_all"], "+.0f", "-")})' for r in exp_rows))
    log(f'[E4] THE RULE (N1) over the held chord: expected {fm(rep["n1_hold"]["expected"], "+.1f")} dB, real {fm(rep["n1_hold"]["real"], "+.1f")} dB '
        f'(>= 14): {rep["n1_hold"]["ok"]}')
    log(f'[E4] speech ({rep["speech"]["src"]}): {rep["speech"]["sequence"]} · overlaps {len(ov)} · two voices at once: {rep["speech"]["two_voices_at_once"]} · '
        f'min gap {fm(rep["speech"]["min_gap"], ".3f")} s (speaker change {fm(rep["speech"]["min_gap_speaker_change"], ".3f")} s)')
    lv_ = rep['loud_vs_words']
    log(f'[E4] loud cues vs words ({lv_["words_src"]}): inside a word: {[(round(r["t"], 2), r["name"], r["in_word"]) for r in lv_["inside_words"]] or "none"}'
        f' · inside a speech span: {[(round(r["t"], 2), r["name"], r["in_span"]) for r in lv_["rows"] if r["in_span"]] or "none"}'
        f' · music entries in speech: {[(round(r["t"], 2), r["name"], r["in_word"] or r["in_span"]) for r in lv_["music"] if r["in_span"]] or "none"}')
    log(f'[E4] head silent until {mp["silentUntil"]:.3f}: music max |x| {rep["silent_head"]["music_max"]:.1e} · cut at {mp["cut"]:.3f}: music max |x| '
        f'{rep["cut"]["music_max"]:.1e} until the next music at {t_back:.3f} (majorFrom {mp["majorFrom"]:.3f}, {rep["cut"]["back_err_ms"]:+.1f} ms; pre-cut '
        f'{rep["cut"]["music_pre_rms_db"]:.1f} dBFS RMS; mix in the hole {rep["cut"]["mix_rms_db"]:.1f}, room {rep["cut"]["amb_rms_db"]:.1f} dBFS RMS) · '
        f'after the toc {t_dry:.3f}: music max {rep["dry"]["music_max_after"]:.1e} · final chord {rep["final_after_speech_ms"]:+.0f} ms after the last speech')
    log(f'[E4] loop seam (end -> start): step {rep["seam"]["step"]:.4f} · |diff| at the seam {rep["seam"]["diff_at_seam"]:.4f} vs p99.9 around '
        f'{rep["seam"]["diff_p999_around"]:.4f} · first 5 ms peak {rep["seam"]["head_5ms_peak"]:.4f} · last 20 ms peak {rep["seam"]["tail_20ms_peak"]:.4f}')
    try: json.dump(rep, open(REPORT, 'w'), indent=1, default=lambda o: float(o) if isinstance(o, (np.floating, np.integer)) else str(o))
    except Exception as e: log(f'[E4] WARNING report not written: {e}')
    if sheet: make_sheet(Z, stems, G, d1, rep, sc, vinfo, plan, M, spans)
    return rep

# =====================================================================================================================
# gallery: every cue sound once, at its level
# =====================================================================================================================
def gallery():
    sc = score(); cues = sc['cues']; seen = []; st = {}; t = .3; names = []
    for c in cues:
        if c['name'] not in names: names.append(c['name'])
    M = R.Mix(len(names) * 1.3 + 3)
    for nm in names:
        c = dict(next(x for x in cues if x['name'] == nm)); c['t'] = t; c['g'] = 1.0
        sub = [dict(x, t=x['t'] - (next(y for y in cues if y['name'] == nm)['t']) + t) for x in cues]   # neighbours keep their offsets
        parts, special = cue_parts(c, sub, st)
        if parts:
            put_cue(M, c, ('g', nm), parts, LVL.get(nm, LVL_UNKNOWN)); seen.append((round(t, 2), nm)); t += max(.75, max(len(p[1]) for p in parts) / SR * .8)
        elif special == 'bonzini_sig':
            M.put('brand', A.balafon_bright(88, 5800, 1.2), t, .17, -.15); M.put('brand', A.balafon_bright(92, 5801, 1.0), t + SIG_GAP, .18, .15)
            seen.append((round(t, 2), nm)); t += 1.2
        elif special == 'final_chord': R.compose_final(M, t, None); seen.append((round(t, 2), nm)); t += 1.4
        elif special == 'major': compose_hold(M, t, t + 1.5); seen.append((round(t, 2), nm)); t += 2.0
    buf = np.zeros((ns(t + 1), 2))
    for stem, sig, t0, g, p, c, tag in M.ev: R.place_at(buf, R.stereo_of(sig, g, p), ns(t0))
    buf = buf * dsp.undb(-14 - dsp.lufs_integrated(buf)); buf, _ = dsp.limiter(buf, ceiling_db=-1.5)
    dsp.save(GALLERY, buf, 'PCM_24')
    log(f'[E4] gallery -> {GALLERY}: ' + ' · '.join(f'{a} {b}' for a, b in seen))

# =====================================================================================================================
# sheet
# =====================================================================================================================
def make_sheet(Z, stems, G, d1, rep, sc, vinfo, plan, M, spans, path=SHEET):
    import matplotlib; matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import scipy.signal as sps
    T, DUR, mp, cues = sc['T'], sc['dur'], sc['music'], sc['cues']
    voiced = bool(vinfo)
    plt.rcParams.update({'font.size': 8, 'axes.facecolor': '#120d1e', 'figure.facecolor': '#0b0814', 'text.color': '#e8e2f4',
                         'axes.labelcolor': '#e8e2f4', 'xtick.color': '#b9b0cc', 'ytick.color': '#b9b0cc', 'axes.edgecolor': '#3a3050'})
    fig = plt.figure(figsize=(22, 34), dpi=100)
    fig.subplots_adjust(top=.955, bottom=.01, left=.045, right=.965)
    gs = fig.add_gridspec(9, 12, height_ratios=[3.4, 1.0, 2.3, 1.55, 1.7, 1.7, 1.35, 1.75, 1.9], hspace=.5, wspace=.5)
    hot = {'thok_glass': '#ff5a5a', 'big_stamp': '#ff5a5a', 'glass_shatter': '#ff5a5a', 'stamp_big': '#ff5a5a', 'stamp': '#ff8a3a',
           'boing_carton': '#ff8a3a', 'bonk': '#ff8a3a', 'phone_ring': '#7fffd4', 'phone_pickup': '#7fffd4', 'ding_msg': '#7fffd4',
           'aww_guitar': '#ffb24a', 'bonzini_sig': '#b48cff', 'violet_hum': '#b48cff', 'ribbon_shimmer': '#b48cff', 'tonk': '#b48cff',
           'final_chord': '#ffd84a', 'major': '#ffd84a', 'toc_glass': '#3ee0ff'}
    ccol = lambda nm: hot.get(nm, '#9fe08a')
    vcol = lambda lid: {'toi': '#ffb24a', 'cm': '#c8a46a', 'nar': '#e8e2f4'}.get(speaker(sc, lid), '#e8e2f4')
    xt = np.arange(0, DUR + .01, 1.0); m = Z.mean(1)
    def marks(ax, labels=False):
        ax.axvspan(mp['cut'], mp['majorFrom'], color='#3ee0ff', alpha=.06)
        for c in cues: ax.axvline(c['t'], ymin=.94 if labels else 0, ymax=1, color=ccol(c['name']), lw=.9, alpha=.9 if labels else .22)
    def spec(ax, x, a0, a1, nper, top_pct, rng_db, fl):
        f, t, S_ = sps.stft(x, SR, nperseg=nper, noverlap=nper - nper // 16)
        P = 20 * np.log10(np.abs(S_) + 1e-9); rr = np.interp(fl, f, np.arange(len(f))); Pi = P[np.round(rr).astype(int)]; top = np.percentile(Pi, top_pct)
        ax.pcolormesh(t + a0, fl, Pi, vmin=top - rng_db, vmax=top, cmap='magma', shading='auto'); ax.set_yscale('log'); ax.set_ylim(fl[0], fl[-1]); ax.set_xlim(a0, a1)
    # 1 spectrogram
    ax = fig.add_subplot(gs[0, :])
    spec(ax, m, 0, DUR, 4096, 99.8, 85, np.geomspace(30, 18000, 420)); ax.set_xticks(xt); ax.set_ylabel('Hz')
    ax.set_title('mix.wav — log spectrogram · cue ticks + names (top) · speech spans (bottom bars: tan = TA COMMANDE, amber = TOI, white = narrator'
                 + ('' if voiced else '; PLANNED spans, no voices yet') + ') · cyan = music TOTAL cut window (cut -> majorFrom) · gold = musical anchors',
                 loc='left', pad=78)
    marks(ax, True)
    for c in cues: ax.text(c['t'], 19500, c['name'], rotation=90, fontsize=6.2, va='bottom', ha='center', color=ccol(c['name']))
    for i, a, b in spans:
        ax.plot([a, b], [36, 36], color=vcol(i), lw=6, solid_capstyle='butt'); ax.text((a + b) / 2, 41, i, ha='center', fontsize=8, color='w')
    e = plan['end']
    lab = [(0, 'no music: THOK · crackle · breath'), (mp['tenseFrom'], 'TENSE F#m (night)'), (mp['cut'], 'CUT · call · stamp · shatter (SFX only)'),
           (mp['majorFrom'], 'A held (THE RULE)'), (mp['fullFrom'], 'A makossa · violet'), (plan['full']['sig'] - .1, 'sig'),
           (plan['main']['a'], 'band ON the tonk'), ((e['hit2'] or DUR - 2.5), 'ritual · lite · rit.'), (e['final'], 'final')]
    for x0, lb in lab: ax.text(x0 + .05, 60, lb, fontsize=7.5, color='w', alpha=.9)
    anchors = [s['a'] for s in plan['segs']] + [s['back'] for s in plan['segs'] if s.get('back')] + [mp['majorFrom'], mp['fullFrom'], plan['main']['a']] + [x for x in (e['hit2'], e['stop'], e['final']) if x]
    for a in anchors: ax.axvline(a, ymin=0, ymax=.05, color='#ffd84a', lw=1.6)
    # 2 waveform
    ax = fig.add_subplot(gs[1, :]); tw = np.arange(len(m)) / SR
    ax.plot(tw, Z[:, 0], lw=.25, color='#c9b6ff'); ax.plot(tw, -np.abs(Z[:, 1]), lw=.25, color='#ffb24a', alpha=.6)
    ax.set_xlim(0, DUR); ax.set_ylim(-1, 1); ax.set_xticks(xt)
    for s in (1, -1): ax.axhline(s * 10 ** (-1 / 20), color='r', lw=.5, ls='--')
    ax.set_title(f'waveform (L up / |R| down) · ±1 dBFS lines · TP {rep["tp_dbtp"]:.2f} dBTP · sample peak {rep["sample_peak_db"]:.2f} dBFS · {rep["master_mode"]}', loc='left'); marks(ax)
    # 3 levels
    ax = fig.add_subplot(gs[2, :])
    def mom(x, hop=.02): tm, lm = dsp.lufs_momentary(x, hop); return tm, np.maximum(lm, -80)
    for x, lb, col, lw in ((Z, 'mix', '#ffffff', 1.2), (stems['vox'] * G, 'voices', '#ffb24a', 1.0), (stems['music'] * G, 'music (ducked)', '#3ee0ff', 1.0),
                           (stems['sfx'] * G, 'sfx', '#ff5a5a', .8), (stems['hits'] * G, 'impacts', '#ff8a3a', .8), (stems['amb'] * G, 'bulb', '#9fe08a', .7)):
        if np.abs(x).max() == 0: continue
        tm, lm = mom(x); ax.plot(tm, lm, color=col, lw=lw, label=lb)
    ts, ls = dsp.lufs_shortterm(Z, .05); ax.plot(ts, ls, color='#ffd84a', lw=1, ls='--', label='mix short-term (3 s)')
    for i, a, b in spans: ax.axvspan(a, b, color=vcol(i), alpha=.08)
    if voiced:
        for r in rep['voices']:
            txt = 'no\nmusic' if r['no_music'] else f'+{r["margin"]:.1f}'
            ax.text((r['on'] + r['off']) / 2, -5, f'{r["id"]}\n{txt}', ha='center', va='top', fontsize=7.5, color='#9fe08a' if (r['no_music'] or r['margin'] >= 10) else '#ff5a5a')
    else:
        for r in rep['expected_margins']['rows']:
            txt = 'no\nmusic' if r['margin_music'] is None else f'~+{r["margin_music"]:.0f}'
            ok = r['margin_music'] is None or r['margin_music'] >= (14 if r['id'] == 'N1' else 10)
            ax.text((r['on'] + r['off']) / 2, -5, f'{r["id"]}\n{txt}', ha='center', va='top', fontsize=7.5, color='#9fe08a' if ok else '#ff5a5a')
    ax.set_xlim(0, DUR); ax.set_ylim(-75, -2); ax.set_xticks(xt); ax.axhline(-14, color='w', lw=.5, ls=':')
    ax2 = ax.twinx(); ax2.plot(np.arange(len(d1))[::240] / SR, d1[::240] * DUCK_DB, color='#ff7ad9', lw=1, label='music duck (dB)')
    ax2.set_ylim(-40, 2); ax2.set_ylabel('duck dB', color='#ff7ad9')
    ax.legend(loc='lower left', ncol=7, fontsize=7, facecolor='#120d1e'); ax2.legend(loc='lower right', fontsize=7, facecolor='#120d1e')
    ax.set_title(f'momentary loudness (400 ms) per stem, post master gain · integrated {rep["lufs"]:.2f} LUFS'
                 + (f' (projected with voices {rep["projected"]["lufs"]:.2f})' if rep.get('projected') else '') + ' · numbers = '
                 + ('voice over the music bed during each line (dB)' if voiced else 'EXPECTED margin of a -18 LUFS line over the ducked music (dB)'), loc='left'); marks(ax)
    # 4 envelope zooms
    zs = [(0.0, mp['tenseFrom'] + .5, f'the head: no music until the ding at {mp["tenseFrom"]:.2f} (THOK at frame 0, the bulb)', 'head'),
          (mp['cut'] - .4, mp['cut'] + .5, f'the TOTAL cut at music().cut = {mp["cut"]:.3f} (boing + bonk): music (cyan) vs mix', 'cut'),
          (DUR - .8, DUR, f'final chord {e["final"]:.2f} · choked on the toc {e["dry"]:.3f} · the loop seam (last sample)', 'end')]
    for j, (a0, a1, title, kind) in enumerate(zs):
        ax = fig.add_subplot(gs[3, 4 * j:4 * j + 4]); a, b = ns(a0), min(len(Z), ns(a1)); xs = np.arange(a, b) / SR
        env = lambda x: 20 * np.log10(R.env_db(x[a:b], .002) + 1e-9)
        ax.plot(xs, env(Z), color='#ffffff', lw=.8, label='mix'); ax.plot(xs, env(stems['music'] * G), color='#3ee0ff', lw=.9, label='music')
        ax.plot(xs, env(stems['amb'] * G), color='#9fe08a', lw=.7, label='bulb'); ax.plot(xs, env((stems['sfx'] + stems['hits']) * G), color='#ff5a5a', lw=.7, label='sfx+hits')
        if kind == 'cut': ax.axvline(mp['cut'], color='#3ee0ff', lw=1.2)
        if kind == 'end': ax.axvline(e['dry'], color='#3ee0ff', lw=1.2)
        ax.set_ylim(-110, 0); ax.set_xlim(a0, a1); ax.set_title(title, loc='left', fontsize=7.5); ax.legend(fontsize=6.5, facecolor='#120d1e', ncol=2)
        ax.set_ylabel('dBFS (2-ms RMS)')
    # 5 zoom spectrograms (2 rows of 3)
    f_ = lambda nm, after=-1.0, d=0.0: (first(cues, nm, after) if first(cues, nm, after) is not None else d)
    zz = [(0.0, 4.4, 'the hook: THOK · crackle · breath · re-presses · dezoom · landing · DING (music in) · TOI\'s plate'),
          ((first(cues, 'aww_guitar') or mp['cut'] - 2) - .9, mp['cut'] + .9, 'stop-time break · « aww » · E7 back · riser · CUT on the boing · bonk'),
          (f_('plate_flip', mp['cut'], mp['cut'] + 6) - .25, f_('low_riser', mp['cut'], mp['cut'] + 8) + .6, 'the call: plate flip · ONE ring · pick-up · « Allô ? » · steel · low riser'),
          (f_('big_stamp', mp['cut'], mp['majorFrom'] - 2.5) - .4, mp['majorFrom'] + .9, 'the fall: big stamp · cracks · shatter · peel · FAUX MESSAGE · C4 · A chord · clinks'),
          (mp['fullFrom'] - .5, plan['main']['a'] + 1.2, 'the container: A makossa · glass tonk · label · shimmer · SIGNATURE · band ON the tonk'),
          ((e['hit2'] or DUR - 2.6) - .3, DUR, 'ritual stamp · « Maintenant, tu sais. » · stop · final A · whoosh · toc (dry)')]
    for j, (a0, a1, title) in enumerate(zz):
        ax = fig.add_subplot(gs[4 + j // 3, 4 * (j % 3):4 * (j % 3) + 4]); a, b = ns(max(0, a0)), min(len(m), ns(a1))
        if b - a < ns(.2): ax.axis('off'); continue
        spec(ax, m[a:b], a / SR, b / SR, 2048, 99.7, 80, np.geomspace(40, 16000, 300))
        for c in cues:
            if a0 <= c['t'] <= a1:
                ax.axvline(c['t'], ymin=.9, ymax=1, color=ccol(c['name']), lw=1.2)
                ax.text(c['t'], 17000, c['name'], rotation=90, fontsize=5.8, va='bottom', ha='center', color=ccol(c['name']))
        for i, sa, sb in spans:
            if sb > a0 and sa < a1: ax.axvspan(max(a0, sa), min(a1, sb), ymin=0, ymax=.03, color=vcol(i))
        ax.set_title(title, loc='left', fontsize=7.3, pad=40)
    # 6 grids
    ax = fig.add_subplot(gs[6, :8])
    for s in plan['segs']:
        k = 0
        while s['a'] + k * s['beat'] < s['e']: ax.axvline(s['a'] + k * s['beat'], color='#ffd84a', lw=.8, alpha=.5); k += 1
        if s['k'] > 0: ax.axvspan(s['a'] - BRK, s['a'], color='#ff5a5a', alpha=.15)
    for a, e_, bt in ((mp['fullFrom'], plan['full']['stop'], BEAT), (plan['main']['a'], plan['main']['stop'], BEAT),
                      (e['hit2'] or 0, (e['final'] + .01) if e['hit2'] else 0, e['beat2'])):
        tb = a
        while tb < e_: ax.axvline(tb, color='#ffd84a', lw=.8, alpha=.5); tb += bt
    ax.axvspan(plan['full']['stop'], plan['main']['a'], color='#b48cff', alpha=.15)
    if e['hit2']: ax.axvspan(e['hit2'] - BRK, e['hit2'], color='#ff5a5a', alpha=.15)
    ax.axvspan(mp['cut'], mp['majorFrom'], color='#3ee0ff', alpha=.08); ax.axvspan(mp['majorFrom'], mp['fullFrom'], color='#ffd84a', alpha=.06)
    for c in cues: ax.plot([c['t']], [.5], 'v', color=ccol(c['name']), ms=5)
    ax.set_xlim(0, DUR); ax.set_xticks(xt); ax.set_yticks([])
    ax.set_title('beat grids: gold = makossa (stop-time segments anchored on the ding, the aww, the container, the tonk, the ritual stamp) · '
                 'red = breaks · violet = the signature break · cyan = the music hole · pale gold = the held A chord · triangles = cues', loc='left', fontsize=7.5)
    ax = fig.add_subplot(gs[6, 8:]); ax.axis('off')
    gl_ = ['hit              t        grid            beat   err'] + [f'{x["name"][:15]:15s} {x["t"]:7.3f}  {x["grid"][:14]:14s} {x["beat"]:7.3f} {x["err"]:+5.0f}' for x in rep['grid']]
    gl_ += ['', 'segment     anchor-stop     ev/s LUFS*'] + [f'#{r["k"]} {r["role"]:6s} {r["a"]:6.3f}-{r["e"]:6.3f} {r["rate"]:4.0f} {fm(r["lufs"], "5.1f")}' for r in rep['segments']]
    gl_ += ['', 'music section      LUFS* (pre-master)'] + [f'{k:17s} {fm(v["lufs_premaster"], "6.1f")}' for k, v in rep['music_sections'].items()] + ['* un-ducked']
    ax.text(0, 1.05, '\n'.join(gl_), family='monospace', fontsize=6.6, va='top')
    # 7 cue table (3 columns)
    ax = fig.add_subplot(gs[7, :]); ax.axis('off')
    hd = f'{"t":>7} {"cue":16s} {"alone":>7} {"mix":>7} {"LUFS-M":>6} {"LU":>5}'
    L = [f'{r["t"]:7.3f} {r["name"][:16]:16s} {fm(r["err"], "+6.1f", "     -")} {fm(r["mix_err"], "+6.1f", "     -")} {fm(r["lvl"], "6.1f", "     -")} {fm(r["lu"], "+5.0f", "    -")}' for r in rep['cues']]
    h = int(math.ceil(len(L) / 3))
    for j in range(3): ax.text(j / 3, .93, '\n'.join([hd] + L[j * h:(j + 1) * h]), family='monospace', fontsize=6.6, va='top')
    ok = rep['cues_ok']
    ax.text(0, 1.03, f'every cue within 15 ms (alone, ms): {ok} · unknown names: {rep["unknown"] or "none"} · music max |x|: head {rep["silent_head"]["music_max"]:.1e}, '
                     f'[cut, next music) {rep["cut"]["music_max"]:.1e}, after the toc {rep["dry"]["music_max_after"]:.1e} · mix = spectral-flux onset in mix.wav '
                     f'(masked cues may differ) · LU = the cue alone re a -18 LUFS voice line', fontsize=7.8, va='top', color='#9fe08a' if ok else '#ff5a5a')
    # 8 voices + loudness
    ax = fig.add_subplot(gs[8, :]); ax.axis('off')
    if voiced:
        L = [f'{"id":4s} {"who":3s} {"take":11s} {"speech":>15}  {"T.id":>6}  {"measured":>15}  {"gap":>6}  {"LUFS":>6}  {"/music":>8} {"/all":>6} {"worst word":>12}  {"phone":>6}  de-ess']
        for r in rep['voices']:
            L.append(f'{r["id"]:4s} {r["who"]:3s} {r["file"]:11s} {r["on"]:7.3f}-{r["off"]:7.3f}  {r["T"] if r["T"] is not None else float("nan"):6.3f}  '
                     f'{r["m_on"]:7.3f}-{r["m_off"]:7.3f}  {fm(r["measured_gap"], "6.3f", "   -  ")}  {r["lufs"]:6.1f}  '
                     f'{"no mus." if r["no_music"] else format(r["margin"], "+7.1f"):>8} {r["margin_all"]:+6.1f} {(r["word_worst"] or "-")[:12]:>12}  {r["phone"]:+6.1f}  {r["deess"]:4.1f} dB')
    else:
        L = ['NO VOICES YET (' + rep['voices_status'][:150] + ')', 'expected margins of a -18 LUFS line (pre-master): over the ducked music / over everything']
        L += ['  ' + '  '.join(f'{r["id"]}:{fm(r["margin_music"], "+.0f", "-")}/{r["margin_all"]:+.0f}' for r in rep['expected_margins']['rows'])]
        L += ['phone band (300 Hz-8 kHz), speech-shaped placeholder vs the music / vs everything else:',
              '  ' + '  '.join(f'{r["id"]}:{fm(r["phone_music"], "+.0f", "-")}/{fm(r["phone_all"], "+.0f", "-")}' for r in rep['expected_margins']['rows'])]
    sp_ = rep['speech']
    L.append('')
    L.append(f'speech ({sp_["src"]}): {sp_["sequence"]} · overlaps {len(sp_["overlaps"])} · two voices at once: {sp_["two_voices_at_once"]} · min gap {fm(sp_["min_gap"], ".3f")} s '
             f'(speaker change {fm(sp_["min_gap_speaker_change"], ".3f")} s) · THE RULE over the held chord: expected {fm(rep["n1_hold"]["expected"], "+.1f")} / real '
             f'{fm(rep["n1_hold"]["real"], "+.1f")} dB (>= 14: {rep["n1_hold"]["ok"]})')
    L.append(f'duck {rep["duck_max_db"]:.1f} dB + {R.CARVE_DB:.0f} dB carve 0.9-5 kHz + {MUSIC_HP_HZ:.0f} Hz low cut ({rep["mix_settings"]["music_hp_mode"]}) on the music · '
             f'soft SFX duck {SFX_DUCK_DB:.0f} dB · impacts {HIT_DUCK_DB:.0f} dB · VOX_TRIM {{}} · loud cues inside words: '
             f'{[(round(r["t"], 2), r["name"]) for r in rep["loud_vs_words"]["inside_words"]] or "none"} ({rep["loud_vs_words"]["words_src"]})')
    pj = rep.get('projected')
    L.append(f'mix.wav: {rep["n"]} samples = {rep["dur"]:.6f} s @ {rep["sr"]} Hz, {rep["channels"]} ch · integrated {rep["lufs"]:.2f} LUFS · true peak {rep["tp_dbtp"]:.2f} dBTP · '
             f'sample peak {rep["sample_peak_db"]:.2f} dBFS · LRA {fm(rep["lra"], ".1f")} LU · master {rep["master_gain_db"]:+.2f} dB · limiter max GR {rep["max_gr_db"]:.1f} dB · '
             f'clipped {rep["clipped"]}' + (f' · PROJECTED with voices {pj["lufs"]:.2f} LUFS, TP {pj["tp_dbtp"]:.2f} dBTP' if pj else ''))
    L.append(f'loop seam: step {rep["seam"]["step"]:.4f} · |diff| at the seam {rep["seam"]["diff_at_seam"]:.4f} vs p99.9 around {rep["seam"]["diff_p999_around"]:.4f} · '
             f'score: {rep["src"]} · timing: {rep["timing"]}')
    ax.text(0, 1, '\n'.join(L), family='monospace', fontsize=7.2, va='top')
    fig.suptitle("« PATRON, ATTENDS ! » (JE SAVAIS PAS. · 4/5) — audio check sheet (lib/audio_ep4.py)" + ('' if voiced else ' — MUSIC + SFX ONLY (no voices yet)'),
                 x=.01, y=.997, ha='left', fontsize=15, color='w')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fig.savefig(path, dpi=100, facecolor=fig.get_facecolor(), pil_kwargs={'quality': 88})
    plt.close(fig)
    log('[E4] sheet ->', path)

if __name__ == '__main__':
    if '--check-replica' in sys.argv: sys.exit(0 if check_replica() else 1)
    if '--gallery' in sys.argv: gallery(); sys.exit(0)
    build(sheet='--sheet' in sys.argv)
