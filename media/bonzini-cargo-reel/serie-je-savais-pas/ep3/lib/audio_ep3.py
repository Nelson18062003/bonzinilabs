"""« C'EST PAS ÇA. » (JE SAVAIS PAS. · 3/5) — the film's sound: 48 kHz stereo, exactly SCORE.T.end seconds, synthesised
(no samples) + the 16 voice takes of the v2 script (clear diction, E/SCRIPT_V2.md: T1 T2 N1 T3 N1b N2 N3a N3 N4 N4b N4c T4
N5 N5b N6 N6b). Built on « PAS REÇU. » (v3/lib/audio_recu.py, imported as R: voice chain, sidechain duck, carve, master,
onset checks, series SFX) and the series' synth code (audio.py, makossa.py, bikutsi.py, instruments.py). Same patterns as
ep2/lib/audio_ep2.py and ep1/lib/audio_ep1.py (cue levels by max momentary loudness, LVL table).

ONE score drives picture and sound: SCORE.T, DUR, A, soundCues() and music() are read LIVE from overlay/scenes/01_score.js
through node (which itself reads data/timing.json; without it the score runs on its DEFAULTS). Fallbacks, in order:
audio/score_cues.json (the last live read, if its T still matches), then a python replica of the score (derive_score).
The voices come from data/voice_plan.json (file start `at`, `stretch`) + data/takes.json (speech on/off) — only when they are
COMPLETE and IN STEP with the score (every voice id of the score planned, takes.json newer than every take file, the
take files present, the planned speech starts = SCORE.T within .15 s). Otherwise the engine mixes music + SFX only and says
why in the log and the report (the music is still ducked on the score's planned speech spans T/DUR, as it will be).

The shop IN THE MORNING (bulb off, warm sun from the open door): no bulb hum, an airy room with the street far away
(exactly periodic: no loop seam), a few distant birds only in long pauses.
Music (makossa, 120 BPM, beat .5 s; series code makossa.groove / guitar / bass / kit, bikutsi balafon, instruments.*):
  0 .. tenseFrom        NO music: the carton torn open, the bag's « pouf », the falling whistle, the BOUM of « C'EST PAS
                        ÇA ! » and the subtitle's letters like marbles — the shock alone
  tenseFrom .. cut      TENSE F#-minor makossa in STOP-TIME: in under TOI's cry (F#m D); the band leaves .22 s before TOI's
                        order card lands and re-enters ON it (C#m D E7: +skank +shaker +16th picking +conga +4-on-floor,
                        last bar +claps +balafon tremolo); it leaves again .22 s before the three « ? » tag stamps, which
                        hit in the break over a riser — the E7 is left hanging
  cut                   TOTAL CUT on the 3rd stamp (4 ms gate, reverb returns included): digital silence on the music bus
                        through the lesson (cricket, the soggy « pffuit », the 3 mocking guitar notes on the SFX bus)
  riseFrom .. balafonFrom  « LA PROCHAINE FOIS »: a low balafon D, the D(add9) morning pad swelling, a shaker fading in on
                        the fiche's grid, a bass pickup — and the riser SFX into the pause before N3
  balafonFrom .. stamp  the MORNING groove (light makossa: 8th-note guitar arpeggio, shaker, rim, round bass; D | E), grid
                        on the first fiche line; each line's clac carries one clear balafon note F#5 A5 B5 E6 (cues)
  stamp .. key          « ÉCRIS TOUT »: the band re-enters ON the stamp, a little fuller (+ soft kick, skank) Bm E D E
  key .. majorFrom      the KEY MOMENT (silent slow motion): the band is gone; a suspended E pad, a low E pedal from the big
                        carton's landing, the clinks spell the V chord (B6 G#6 E6), a reversed swell sucked into the ✓
  majorFrom             A MAJOR at last (the E resolves): arrival hit + the full makossa, until a break before the signature
  sigAt                 the Bonzini signature, unchanged: E6 -> G#6 (.1 s apart) + bell, alone in the break; then the violet
                        section: soft pad D(add9) -> E7sus4, bass, a light pulse, bright balafon ONLY in the speech pauses,
                        on a grid anchored so the end card lands on a beat
  endcard .. end        A-major makossa under the CTA; break; the band slams back ON the ritual stamp, lighter, a slight
                        ritardando so the final A chord (R.compose_final, on its cue) lands on a downbeat, an E accent one
                        beat before; choked dead at cut_dry
Voices: R.voice_line (trim ±30 ms, 24 -> 48 kHz soxr VHQ, Rubber Band if stretch != 1, EQ, leveller + compressor, de-esser,
  per-line loudness -18 LUFS, R.VOX_TRIM = {}: every line at the same level), small-room reverb. v2 clarity mix: music ducks
  DUCK_DB 12 dB under any voice (+ R.CARVE_DB 6 dB carve of 0.9-5 kHz, passed explicitly), soft SFX SFX_DUCK_DB 9 dB, the
  impact bus HIT_DUCK_DB 6 dB; the final chord (after the last word by construction) is not ducked. Every SFX cue is levelled
  by its max momentary loudness: LVL[name] + 20·log10(g) (g = the score's gain).
Master: HP 28 Hz, bus soft-clips, true-peak limiter; -14 LUFS integrated (pyloudnorm), TP <= -1 dBTP. WITHOUT voices the
  master (gain + limiter) is computed on music + SFX + a speech-shaped placeholder at -18 LUFS on each planned line (score
  T/DUR) and mix.wav is the music + SFX share of it: an M&E at the FINAL balance (≈ -25 LUFS), while the report gives the
  projected final loudness / true peak (normalising the M&E alone to -14 LUFS would add ≈ +18 dB and 20 dB of limiting).

usage (from E):  nice -n 5 python3 lib/audio_ep3.py            -> audio/mix.wav, audio/stems/*.wav, audio/audio_report.json
                 nice -n 5 python3 lib/audio_ep3.py --sheet    -> + out/chk_audio_sheet.jpg
                 --no-voices (music + SFX only) · --force-voices (use a plan the checks call stale) · --words (per-word margins)
                 --gallery -> audio/sfx_gallery.wav (every cue sound once, at its level, .7 s apart) and nothing else
API:    build(sheet=False) -> report dict · score() · voice_plan(sc) -> (lines, status) · compose(sc, lines, status)
        derive_score(T, DUR, words) (python replica) · sfx_<name>() -> np.ndarray (onset at sample 0)
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

TAIL = 3.0
BEAT = 0.5
BRK = 0.22                                    # stop-time: the band leaves the last .22 s before each hit it re-enters on
SIG_GAP = 0.10                                # the series signature: E6 then G#6 .1 s later (as in « PAS REÇU. »)
DUCK_DB, SFX_DUCK_DB, HIT_DUCK_DB = 12.0, 9.0, 6.0   # v2: the voice must be understood first (owner's feedback)
R.CARVE_DB = 6.0
G_TENSE, G_MAJOR, G_BRAND, G_FINAL = R.G_TENSE, R.G_MAJOR, R.G_BRAND, R.G_FINAL
G_MORNING = 10 ** (-10.5 / 20)                 # the fiche / sample groove: lighter than the tense band
MUSIC = ('groove', 'brand', 'final')
DUCKED = {'groove': DUCK_DB, 'brand': DUCK_DB, 'sfx': SFX_DUCK_DB, 'hit': HIT_DUCK_DB}   # (final: after the last word)
SENDS = {'groove': ('room', .08), 'brand': ('plate', .24), 'final': ('room', .10), 'sfx': ('room', .06),
         'hit': ('room', .08), 'vox': ('vroom', .15)}
STEMS = ('vox', 'music', 'sfx', 'hits', 'amb')
VOX_REF = -18.0                               # R.VOX_LUFS: each voice line's loudness in the vox stem (pre-master)

# SFX levels: max momentary loudness (400 ms, LUFS, pre-master, the cue alone, dry) at g = 1; the score's g scales it
# (+20·log10 g). Calibrated on ep2's delivered mix (its pre-master cue levels) and the v2 rule: the voice first.
LVL = {'carton_tear': -24.1, 'pouf': -20.1, 'soft_land': -23.1, 'fall_whistle': -25.9, 'boum': -19.5, 'marbles': -25.1,
       'gecko_skitter': -30.9, 'paper_flip': -27.1, 'pop': -28.1, 'metal_set': -25.1, 'ding_soft': -25.0,
       'whoosh_soft': -26.0, 'card_flop': -25.1, 'tag_stamp': -22.5, 'cricket': -25.0, 'pffuit': -21.9,
       'mock_guitar': -25.1, 'whoosh': -26.9, 'riser': -27.9, 'paper_slide': -26.6, 'clac': -22.0, 'balafon_note': -19.1,
       'felt': -22.9, 'tic': -28.0, 'stamp': -25.0, 'paper': -25.0, 'tonk': -26.1, 'kraft': -25.0, 'sparkle': -27.0,
       'whoosh_low': -23.6, 'carton_thud': -20.6, 'boing_soft': -25.1, 'tap': -24.1, 'crack': -23.6, 'clink': -24.1,
       'stamp_big': -19.5, 'violet_hum': -23.0, 'label_slap': -25.5, 'gloup': -28.1}
LVL_UNKNOWN = -27.0                            # a cue name added later, played by its family's sound
BIRD_LUFS = -50.0                              # a distant bird (max momentary, pre-master): morning, never a cue
HITS = ('boum', 'stamp_big', 'carton_thud', 'stamp', 'tag_stamp', 'metal_set', 'card_flop', 'tonk')   # the impact bus
GATES = ('music_cut', 'cut_dry')               # no sound: the mixdown's gates
# « loud » cues that must never start inside a word (SCRIPT_V2.md §7.3, tools/qa_score.js): reported against the words
LOUD = ('boum', 'marbles', 'metal_set', 'card_flop', 'tag_stamp', 'stamp', 'tonk', 'stamp_big', 'carton_thud',
        'bonzini_sig', 'gloup', 'clink')

def log(*a): print(*a, flush=True)
fm = R.fm
def rng(seed): return np.random.default_rng(seed)
def nrm(y, pk=.5): return y / (np.abs(y).max() + 1e-12) * pk
def smooth01(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)
def speaker(lid): m = re.match(r'[A-Za-z]+?(?=\d|$)', lid); return (m.group(0) if m else lid)[:1].upper()   # T / N / C

# =====================================================================================================================
# score (live) + fallbacks
# =====================================================================================================================
# the score's DEFAULT voice keys (01_score.js T / DUR = SCRIPT_V2.md §7.1): the replica's last resort when neither node
# nor data/timing.json is there (before the re-timing on the v2 takes)
T0 = dict(T1=.05, T2=1.97, N1=3.45, T3=7.05, N1b=10.37, N2=12.96, N3a=17.02, N3=19.27, N4=24.32, N4b=26.83, N4c=28.53,
          T4=32.8, N5=34.39, N5b=36.09, N6=39.51, N6b=42.34, end=44.59)
DUR0 = dict(T1=1.62, T2=1.08, N1=3.24, T3=2.97, N1b=1.89, N2=3.51, N3a=1.89, N3=4.05, N4=2.16, N4b=1.35, N4c=1.62, T4=1.08,
            N5=1.35, N5b=2.97, N6=2.43, N6b=1.35)
MUSIC_KEYS = ('silentUntil', 'tenseFrom', 'cut', 'riseFrom', 'balafonFrom', 'majorFrom', 'sigAt', 'finalChord', 'end')

_SC = None
def score():
    """{dur, T, DUR, A, words, cues[{t, name, g, pan}], music{…MUSIC_KEYS}, src}"""
    global _SC
    if _SC is not None: return _SC
    tm = {}
    try: tm = json.load(open(TIMING_JSON)) if os.path.exists(TIMING_JSON) else {}
    except Exception as e: log(f'[E3] WARNING data/timing.json unreadable ({e}): the score defaults')
    js = ("const S=require(%s);const o={T:S.T,DUR:S.DUR,A:S.A};"
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
        der = derive_score(Tm, Dm, words, tm.get('A'))
        if d is None: d = der; d['src'] = f'python replica of the score ({why})'
        else:
            if not d.get('cues'): d['cues'] = der['cues']; d['src'] += ' + cues from the python replica (soundCues() missing)'
            if not d.get('music'): d['music'] = der['music']; d['src'] += ' + music from the python replica (music() missing)'
    d['music'] = complete_music(d['music'] or {}, d['cues'], d['T'])
    d['dur'] = float(d['T']['end']); d['words'] = words; d['DUR'] = d.get('DUR') or {}
    d['cues'] = sorted(d['cues'], key=lambda c: c['t'])
    if d['src'].startswith('01_score.js'):
        try:
            os.makedirs(OUT_A, exist_ok=True)
            json.dump({k: d.get(k) for k in ('T', 'DUR', 'A', 'cues', 'music')}, open(CUES_DUMP, 'w'), indent=1)
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
    end = float(T['end']); b = first(cues, 'boum')
    need('tenseFrom', (b + .5) if b is not None else 2.0); need('silentUntil', mp['tenseFrom'])
    need('cut', first(cues, 'music_cut') or mp['tenseFrom'] + 8)
    rs = first(cues, 'riser', mp['cut']); need('riseFrom', (rs - .1) if rs is not None else first(cues, 'whoosh', mp['cut']) or mp['cut'] + 4)
    bn = first(cues, 'balafon_note', mp['riseFrom']); need('balafonFrom', (bn - .02) if bn is not None else mp['riseFrom'] + 3)
    mj = first(cues, 'major'); need('majorFrom', (mj - .01) if mj is not None else first(cues, 'stamp_big', mp['balafonFrom']) or end - 12)
    need('sigAt', first(cues, 'bonzini_sig') or mp['majorFrom'] + 1.4)
    need('finalChord', first(cues, 'final_chord') or end - .85); need('end', end)
    mp['_derived'] = miss
    return mp

# ------------------------------------------------------------------- python replica of 01_score.js (fallback only)
def _deacc(s): return re.sub('[̀-ͯ]', '', unicodedata.normalize('NFD', str(s).lower()))
def _forms(w):
    r = _deacc(w); return [re.sub('[^a-z0-9]', '', r), re.sub('[^a-z0-9]', '', re.sub(r"^(?:[a-z]{1,2}|qu|jusqu)['’]", '', r))]
def word_ix(words, i, prefix, nth=0):
    """index of the nth word of line i starting with prefix ('a|b' = either prefix), exactly as 01_score.js wordIx()"""
    ks = [k for k in (re.sub('[^a-z0-9]', '', _deacc(p)) for p in str(prefix).split('|')) if k]; c = 0
    for j, w in enumerate((words or {}).get(i) or []):
        if any(x.startswith(k) for x in _forms(w['w']) for k in ks):
            if c == nth: return j
            c += 1
    return -1

def derive_score(T, DUR, words, A_over=None):
    """python replica of 01_score.js v2 (A block, soundCues(), music()) — used only when node or a function is missing.
    Mirrors the score line for line (SCRIPT_V2.md §7.2-7.3 + RULE P1: WEL, WB, SYL fallbacks); check it with
    `python3 lib/audio_ep3.py --replica` (live cues vs replica). A_over = timing.json's optional hand overrides `A`."""
    T = dict(T); DUR = dict(DUR); words = words or {}
    def W(i, p, nth=0, fb=0.0):
        j = word_ix(words, i, p, nth); return T[i] + (words[i][j]['s'] if j >= 0 else fb)
    def WE(i, p, nth=0, fb=0.0):
        j = word_ix(words, i, p, nth); return T[i] + (words[i][j]['e'] if j >= 0 else fb)
    END = lambda i: T[i] + DUR.get(i, 0.0)
    SYL = lambda i, k, n: DUR.get(i, 0.0) * k / n
    def inWord(x):                       # 01_score.js inWord(): inside a spoken word (a line's last word runs to END)
        for i, ws in words.items():
            if i not in T: continue
            for j, w in enumerate(ws or []):
                s = T[i] + w['s']; e = T[i] + (max(w['e'], DUR.get(i, 0.0)) if j == len(ws) - 1 else w['e'])
                if s + .01 < x < e - .01: return True
        return False
    WEL = lambda i, p, n: max(WE(i, p, 0, SYL(i, n, n)), END(i))
    def WB(i, p, nth=0, fb=0.0, lead=.1):
        j = word_ix(words, i, p, nth)
        if j < 0: return T[i] + fb - lead
        s = T[i] + words[i][j]['s']; pe = T[i] + words[i][j - 1]['e'] + .02 if j > 0 else -1e9
        return min(s - .01, max(s - lead, pe))
    def mono(arr, gap):
        arr = list(arr)
        for k in range(1, len(arr)): arr[k] = max(arr[k], arr[k - 1] + gap)
        return arr
    a = {}
    a['bagLand'] = T['T1'] + .35
    a['slam'] = max(T['T2'] - .12, min(END('T1') + .03, T['T2'] - .03), T['T1'] + 1.4)
    a['shadow0'] = a['slam'] - .6; a['music'] = a['slam'] + .5
    a['memeOut'] = T['N1'] - .7; a['qui'] = T['N1'] - .4; a['steel'] = T['N1'] - .2
    a['clear'] = T['T3'] - .4; a['order'] = T['T3'] - .15
    a['tags'] = mono([END('N1b') + .03, END('N1b') + .25, END('N1b') + .47], .22)
    a['cut'] = max(T['N2'] - .2, a['tags'][2] + .03)
    a['soggy0'] = T['N2'] + .25; a['soggy1'] = max(a['soggy0'] + 1.2, END('N2') - .3)
    a['mock'] = END('N2') + .12
    a['next'] = max(END('N2') + .45, T['N3a'] - .25); a['sheet'] = a['next'] + .2
    a['lines'] = mono([x - .06 for x in (W('N3', 'mati', 0, SYL('N3', 4, 15)), W('N3', 'tail', 0, SYL('N3', 7, 15)),
                                         W('N3', 'poign|pogn|poing|poin', 0, SYL('N3', 9, 15)), W('N3', 'emball', 0, SYL('N3', 12, 15)))], .35)
    a['stampAll'] = max(a['lines'][3] + .5, END('N3') + .05); a['note'] = a['stampAll'] + .25
    a['ficheAside'] = max(a['note'] + 1.45, T['N4'] + .25)
    a['parcel'] = max(a['ficheAside'] + .1, WE('N4', 'echant|chant', 0, SYL('N4', 4, 8)) + .02)
    a['unbox'] = max(a['parcel'] + .8, W('N4', 'seul', 0, SYL('N4', 6, 8)) - .1)
    a['garde'] = W('N4c', 'garde', 0, 0) - .05
    a['polaIn'] = max(a['garde'] - .2, a['unbox'] + .1)
    a['pareil'] = max(WB('N4c', 'pour', 0, SYL('N4c', 2, 6), .1), a['polaIn'] + .5)
    a['parcelOut'] = max(a['unbox'] + .6, a['pareil'] - .3)
    a['check'] = T['T4'] - .2
    a['letters'] = [a['check'] - 1.1, a['check'] - .75, a['check'] - .4]
    a['taps'] = [a['letters'][0] - .7, a['letters'][0] - .48, a['letters'][0] - .26]
    a['key'] = min(END('N4c') + .45, a['taps'][0] - .55)
    a['keep'] = min(max(W('N4c', 'garde', 0, 0) + .1, a['unbox'] + .45), a['taps'][0] - .9)
    a['amberBack'] = a['key'] + .15
    a['violet'] = max(T['N5'] - .35, min(END('T4') + .05, T['N5'] - .1)); a['sig'] = a['violet']
    a['label'] = a['violet'] + .4
    a['gulps'] = mono([WEL('N5', 'toi', 5) + .03, WE('N5b', 'transp', 0, SYL('N5b', 3, 11)) + .03,
                       min(END('N5b') + .03, T['N6'] - .3)], .5)
    a['endcard'] = T['N6'] - .25; a['cta'] = T['N6']
    a['stampEnd'] = max(END('N6') + .05, T['N6b'] - .3)
    a['loop'] = min(T['end'] - .35, max(T['end'] - .6, a['stampEnd'] + 1.45))
    if A_over: a.update({k: v for k, v in A_over.items() if isinstance(v, (int, float, list))})
    Q = []
    def q(t, name, g=1, pan=0):
        if 0 <= t < T['end']: Q.append(dict(t=round(t + 1e-12, 4), name=name, g=g, pan=pan))
    q(0, 'carton_tear', .8, .3); q(.02, 'pouf', .9, .3); q(a['bagLand'], 'soft_land', .45, .3)
    q(a['shadow0'], 'fall_whistle', .7); q(a['slam'], 'boum'); q(a['slam'] + .03, 'marbles', .8); q(a['slam'] + .05, 'gecko_skitter', .35, -.6)
    q(a['memeOut'], 'paper_flip', .45); q(a['qui'], 'pop', .8); q(a['steel'], 'metal_set', .9); q(a['steel'] + .08, 'ding_soft', .5)
    q(a['clear'], 'whoosh_soft', .5); q(a['order'], 'card_flop', .8)
    for i, x in enumerate(a['tags']): q(x, 'tag_stamp', .75, .2 + .1 * i)
    q(a['cut'], 'music_cut'); q(a['cut'] + .1, 'cricket', .5); q(a['soggy1'] - .35, 'pffuit', .35); q(a['mock'], 'mock_guitar', .8)
    q(a['next'], 'whoosh', .7); q(a['next'] + .1, 'riser', .7); q(a['sheet'], 'paper_slide', .6)
    for i, x in enumerate(a['lines']): q(x, 'clac', .5, -.1 + .07 * i); q(x + .02, 'balafon_note', .45); q(x + .2, 'felt', .35, .2)
    for i, ft in enumerate((True, True, True, False)): q(a['lines'][i] + (.44 if ft else .5), 'tic', .5, .2)   # G.tagDef: lines 0-2 from a tag
    q(a['stampAll'], 'stamp'); q(a['note'], 'tic', .7, .2); q(a['note'] + .04, 'paper', .4, .2)
    tonkG = .5 if a['parcel'] > WE('N4', 'echant|chant', 0, SYL('N4', 4, 8)) + .12 else .8
    q(a['ficheAside'], 'paper_slide', .45, -.3); q(a['parcel'], 'tonk', tonkG, -.2); q(a['unbox'] - .3, 'kraft', .4, -.2); q(a['unbox'] + .1, 'paper', .45, -.2)
    q(a['polaIn'], 'paper_slide', .5, .3); q(a['pareil'], 'stamp', .9, .3); q(a['pareil'] + .06, 'sparkle', .5, .3); q(a['keep'], 'tic', .6, -.1)
    q(a['parcelOut'], 'whoosh_soft', .35, -.3)
    q(a['key'], 'whoosh_low', .6, .3); q(a['key'] + .35, 'carton_thud', .9, .2); q(a['amberBack'] + .2, 'boing_soft', .45)
    for x in a['taps']: q(x, 'tap', .8); q(x + .02, 'crack', .6)
    for i, x in enumerate(a['letters']): q(x, 'clink', .8, -.3 - .2 * i)
    q(a['check'], 'stamp_big'); q(a['check'] + .01, 'major')
    q(a['violet'], 'violet_hum', .4); q(a['sig'], 'bonzini_sig'); q(a['label'], 'label_slap', .3)
    for x in a['gulps']: q(x, 'gloup', .5 if inWord(x) else .8, -.5)
    q(a['endcard'], 'whoosh_soft', .5); q(a['cta'], 'pop', .4); q(a['stampEnd'], 'stamp_big')
    q(END('N6b') + .05, 'final_chord'); q(T['end'] - .02, 'cut_dry')
    mus = dict(silentUntil=a['music'], tenseFrom=a['music'], cut=a['cut'], riseFrom=a['next'], balafonFrom=a['lines'][0],
               majorFrom=a['check'], sigAt=a['sig'], finalChord=END('N6b') + .05, end=T['end'])
    return dict(T=T, DUR=DUR, A=a, cues=sorted(Q, key=lambda c: c['t']), music=mus)

# =====================================================================================================================
# voices: the plan, only when it is complete and in step with the score
# =====================================================================================================================
def voice_ids(sc): return [k for k, v in sc['T'].items() if k != 'end' and isinstance(v, (int, float))]

def planned_spans(sc):
    """the score's speech spans [(id, start, end)] (T / DUR): where the voices WILL be"""
    T, D = sc['T'], sc.get('DUR') or {}
    return sorted([(i, float(T[i]), float(T[i]) + float(D.get(i, 0.0))) for i in voice_ids(sc)], key=lambda x: x[1])

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
    if missing: why.append(f'score voice ids not planned: {missing}')
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
    if hard: return [], 'unusable: ' + '; '.join((why + hard)[:6]) + (' …' if len(why + hard) > 6 else '')
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

def wander(n, seed, scale, hz=8.0):
    """smooth zero-mean random modulation, peak ±scale"""
    x = dsp.onepole_lp(rng(seed).standard_normal(n), hz); x = x - x.mean()
    return x / (np.abs(x).max() + 1e-12) * scale

def thud(f_hi, f_lo, tau_f, tau, n, drive=1.0):
    t = tt(n); return np.sin(2 * np.pi * np.cumsum(f_lo + (f_hi - f_lo) * np.exp(-t / tau_f)) / SR) * np.exp(-t / tau) * drive

def hollow(t, seed, modes=((175, 1, .04), (262, .6, .03), (410, .35, .02)), glide=None):
    """damped modal body (Hz, amp, decay s) — cardboard / resin / wood: low Q, dead"""
    return R._modes(t, 1.0, modes, seed, glide)

def tick(f, seed, n=None): return R._click(f, seed, n)

def hi_short(y, t, fc, hold, tau):
    """above fc the sound is a hit, not a tail (zero-phase split): full for `hold` s, then exp decay `tau`"""
    lo, hi = dsp.zp_split(y, fc, 2); return lo + hi * np.where(t < hold, 1.0, np.exp(-(t - hold) / tau))

# =====================================================================================================================
# SFX (all synthesised, seeded; mono (n,) or stereo (n, 2); onset at sample 0; peak-normalised — levels set by LVL)
# =====================================================================================================================
def sfx_carton_tear(seed=401, dur=.2):
    """the received bag's carton torn open, ALREADY UNDER WAY at frame 0 (the loop's first sample): the flaps' packing tape
    ripping off the board (dense stick-slip, rate 620 -> 260 Hz, through the tape and board resonances 0.9-4.7 kHz), the
    fibres' crackle, a dead cardboard knock; starts at 60 % after a 2-ms fade (no click at the loop seam) and is mostly
    gone in 100 ms (T1 « Mes sacs… » starts at .05)"""
    n = ns(dur); t = tt(n); u = t / dur
    imp = stick_slip(n, 620 - 360 * u + wander(n, seed, 60, 40), seed + 1, (.3, 1))
    rip = sum(a * bp(imp, f, q) for f, q, a in ((900, 3, .7), (1700, 4, 1.0), (2900, 4, .8), (4700, 3, .45)))
    rip /= np.abs(rip).max() + 1e-9
    fib = dsp.hp(nz(n, seed + 2), 2500) * grains(n, 1800, seed + 3, .0005, (.2, 1)); fib /= np.abs(fib).max() + 1e-9
    env = (.6 + .4 * np.minimum(1, t / .015)) * np.exp(-t / .05) * np.clip((dur - t) / .05, 0, 1)
    y = (rip * .8 + fib * .3) * env + hollow(t, seed + 4, ((190, 1, .03), (300, .6, .025))) * .3 * np.exp(-t / .04)
    y[:ns(.002)] *= np.linspace(0, 1, ns(.002))
    return nrm(y)

def sfx_pouf(seed=411, dur=.5):
    """the bag pops out of the carton (« pouf »): a soft round air puff (LP noise, 35 ms), a low whump 95 -> 55 Hz, the
    tote's fabric flutter (grains around 1.7 kHz, 70 ms); -12 dB in ~70 ms"""
    n = ns(dur); t = tt(n)
    puff = dsp.lp(nz(n, seed), 700) * np.exp(-t / .035) * 1.6
    flut = bp(nz(n, seed + 1), 1700, .8) * grains(n, 380, seed + 2, .0015, (.2, 1), shape=np.exp(-t / .07)) * .5
    y = (puff + thud(95, 55, .02, .06, n) * .9 + flut) * np.minimum(1, t / .003)
    return nrm(y)

def sfx_soft_land(seed=421):
    """the bag lands on the wax cloth: a soft fabric flop (LP noise, 20 ms), a muffled counter thud 130 -> 80 Hz, its
    strap's little cloth « tp » 45 ms later (no clasp, no metal)"""
    n = ns(.35); t = tt(n)
    y = dsp.lp(nz(n, seed), 900) * np.exp(-t / .02) * 1.2 + thud(130, 80, .01, .04, n) * .8
    i = ns(.045); m = n - i; y[i:] += bp(nz(m, seed + 1), 1400, .8) * np.exp(-tt(m) / .008) * .45
    return nrm(y * np.minimum(1, t / .001))

def sfx_boum(seed=431):
    """the thick 3D amber plate « C'EST PAS ÇA ! » crushes TOI's subtitle on the wax counter: a heavy, GRAVE boum — chest
    thump 125 -> 44 Hz (soft-clipped), the series' sub_drop, the plate's dead resin body (110-620 Hz, low Q, strike glide),
    the counter's wooden knock, a short crack, the crushed letters' crunch; no metal. Above 400 Hz it is over in ~50 ms:
    TOI's « Mais » follows .12 s later"""
    n = ns(1.6); t = tt(n)
    y = dsp.softclip(thud(125, 44, .03, .15, n, 1.9), 1.4)
    s = tail_fade(I.sub_drop(1.0).copy(), 250); y[:len(s)] += s[:n] * .85
    y += hollow(t, seed + 1, ((110, 1, .07), (172, .8, .05), (246, .6, .04), (355, .45, .03), (470, .3, .025), (620, .2, .02)),
                1 + .035 * np.exp(-t / .015)) * .7
    w = A.wood(95, seed + 2, 1.0); y[:len(w)] += w * .6
    cr = dsp.hp(nz(ns(.006), seed + 3), 2500) * np.linspace(1, 0, ns(.006)) * 1.2; y[:len(cr)] += cr
    y += bp(nz(n, seed + 4), 2600, .8) * grains(n, 1500, seed + 5, .0012, (.3, 1), shape=np.exp(-t / .025)) * .8
    y = hi_short(y, t, 400, .03, .02) * np.minimum(1, t / .0004)
    return y / np.abs(y).max()

def sfx_metal_set(seed=441):
    """the supplier's brushed-steel plate set down CALMLY (no crash, he did his job): a felt-padded soft thud 150 -> 90 Hz,
    the plate's modes barely excited (168 Hz family), a brushed-metal whisper as it settles, a tiny click; above 1 kHz it
    is gone in ~.15 s (N1 starts .2 s later)"""
    n = ns(.7); t = tt(n)
    y = thud(150, 90, .012, .05, n) * .9 + dsp.lp(nz(n, seed), 600) * np.exp(-t / .015) * .5
    y += R._modes(t, 168.0, ((1, .5, .30), (1.59, .42, .22), (2.14, .36, .16), (2.65, .3, .12), (3.16, .24, .09), (4.15, .18, .06),
                             (5.4, .1, .045)), seed + 1) * .30
    y += bp(nz(n, seed + 2), 3200, .9) * np.exp(-t / .05) * .08
    c = tick(2400, seed + 3, ns(.02)) * .3; y[:len(c)] += c
    lo, hi = dsp.zp_split(y, 1000, 2); y = lo + hi * np.exp(-t / .08)
    return nrm(y * np.minimum(1, t / .0008))

def sfx_ding_soft(seed=451):
    """a soft, GENERIC « ding » (calm: the plate is right): one round FM-bell note on B5 with a short ring — nothing like any
    app's tone"""
    f = 987.77; n = ns(.8); t = tt(n)
    mod = .8 * np.exp(-t / .04) * np.sin(2 * np.pi * f * 2.0 * t)
    y = np.sin(2 * np.pi * f * t + mod) * np.exp(-t / .15) + .25 * np.sin(2 * np.pi * 2 * f * t + 1) * np.exp(-t / .06)
    return nrm(y * (1 - np.exp(-t / .002)))

def sfx_whoosh(seed, dur=.32, p0=-.5, p1=.5, lo=350, hi=3200, flap=.6, peak=.3):
    """a paper whoosh: air swept across, its band and level peaking at `peak` x dur then dying away (out of the next word's
    way), panned along its path, a paper flick at its start"""
    n = ns(dur); t = tt(n); u = t / dur
    sh = np.where(u < peak, (u / peak) ** 1.5, np.exp(-(u - peak) / (.28 * (1 - peak))))
    w = dsp.tv_biquad(nz(n, seed), 'bp', lo + (hi - lo) * sh, .9) * np.maximum(sh, .25 * np.minimum(1, t / .004))
    w = w / (np.abs(w).max() + 1e-9) * np.clip((dur - t) / .02, 0, 1)
    f = I.paper(seed + 1); f = f / (np.abs(f).max() + 1e-9) * flap
    y = w.copy(); y[:len(f)] += f[:n]
    return panst(y, p0 + (p1 - p0) * smooth01(u)) * .5

def sfx_carton_whoosh(seed=455, dur=.4):
    """the old carton slides out of frame: a cardboard scrape over the wax cloth (granular friction 600 Hz-2.4 kHz) under
    a low air sweep, panned out to the right"""
    n = ns(dur); t = tt(n); u = t / dur
    sh = np.maximum(np.sin(np.pi * u) ** .7, .35 * np.exp(-t / .05)) * np.minimum(1, t / .003)
    fr = bp(nz(n, seed), 1300, .7) * grains(n, 650, seed + 1, .0015, (.15, 1)) * sh
    air = dsp.tv_biquad(nz(n, seed + 2), 'bp', 300 + 1600 * sh, .9) * sh * .6
    y = fr / (np.abs(fr).max() + 1e-9) + air / (np.abs(air).max() + 1e-9) * .7
    y[:ns(.012)] += hollow(tt(ns(.012)), seed + 3, ((210, 1, .01), (340, .6, .008))) * .5    # the push: a dull cardboard knock
    return panst(y * .5, -.1 + .8 * smooth01(u))

def sfx_card_flop(seed=461):
    """TOI's thin order card lands and SAGS under its own weight: a flat papery « flap » (1.2 kHz, 10 ms), a soft board
    thump, then the sag — the thin board flexing (a slow stick-slip creak, ~45 Hz rate, dead modes 500 / 1100 / 2100 Hz,
    .36 s) — and a tiny settle tick"""
    n = ns(.6); t = tt(n)
    y = bp(nz(n, seed), 1200, .8) * np.exp(-t / .010) * 1.2 + thud(160, 100, .01, .03, n) * .6
    i = ns(.04); m = ns(.36); tm = tt(m)
    imp = stick_slip(m, 45 + 20 * np.sin(np.pi * tm / .36) + wander(m, seed + 1, 8, 6), seed + 2, (.3, 1))
    cr = sum(a * bp(imp, f, q) for f, q, a in ((500, 4, 1.0), (1100, 5, .6), (2100, 5, .3)))
    y[i:i + m] += cr / (np.abs(cr).max() + 1e-9) * np.sin(np.pi * tm / .36) ** .8 * .25
    place(y, tick(1800, seed + 3, ns(.02)) * .15, ns(.42))
    return nrm(y * np.minimum(1, t / .0005))

def sfx_stamp(seed=481, body=1.0, hi_tau=.03):
    """a rubber stamp on the counter: the series' stamp (rubber + table thud + paper slap) + the wax counter's wooden body;
    above 300 Hz a hit, not a tail"""
    n = ns(.6); t = tt(n); y = np.zeros(n)
    s = A.sfx_stamp(seed); y[:len(s)] += s / np.abs(s).max()
    y += hollow(t, seed + 1, ((150, 1, .05), (240, .6, .035), (380, .35, .025))) * .4 * body
    y = hi_short(y, t, 300, .03, hi_tau)
    return y / np.abs(y).max()

def sfx_riser(dur, seed=511, m0=62):
    """« souffle, montée » into the fiche: an air band rising 500 Hz -> 5 kHz, two detuned sines gliding D4 -> D6 (the
    rise's key), a breath of sub; soft at first, it peaks at its end (the pause before N3) and releases in .12 s"""
    dur = max(.4, dur); n = ns(dur + .12); t = tt(n); u = np.clip(t / dur, 0, 1)
    y = dsp.tv_biquad(nz(n, seed), 'bp', 500 * 10 ** u, 2.0) * (.35 + .65 * u ** 1.8)
    f = m2f(m0) * 4 ** u
    y += (np.sin(2 * np.pi * np.cumsum(f) / SR) + np.sin(2 * np.pi * np.cumsum(f * 1.006) / SR + 1)) * .07 * (.3 + .7 * u)
    y += np.sin(2 * np.pi * m2f(m0 - 36) * t) * u ** 2 * .15
    y *= np.minimum(1, t / .004) * np.clip(1 - (t - dur) / .12, 0, 1)
    return nrm(y)

def sfx_paper_slide(seed=521, dur=.32, p0=-.3, p1=.2):
    """a sheet / a polaroid slid over the wax cloth: paper friction grains (around 2.4 kHz) following the push, a breath of
    air, panned along the path, a soft paper settle at the end"""
    n = ns(dur + .12); t = tt(n); u = np.clip(t / dur, 0, 1)
    sh = np.sin(np.pi * u) ** .6 * (t < dur) * np.minimum(1, t / .008)
    fr = bp(nz(n, seed), 2400, .7) * grains(n, 700, seed + 1, .0012, (.15, 1)) * sh
    fr /= np.abs(fr).max() + 1e-9
    air = dsp.tv_biquad(nz(n, seed + 2), 'bp', 700 + 1800 * sh, .9) * sh; air /= np.abs(air).max() + 1e-9
    y = fr + air * .35
    i = ns(dur); m = n - i; tl = tt(m)
    y[i:] += bp(nz(m, seed + 3), 1500, .8) * np.exp(-tl / .008) * .5 + thud(150, 100, .008, .02, m) * .3
    y[:ns(.002)] += bp(nz(ns(.002), seed + 4), 3000, 1) * .5
    return panst(nrm(y), p0 + (p1 - p0) * smooth01(u))

def sfx_plate_clac(seed=531):
    """a small amber plate dropped on its line of the fiche: a short, LOW clac — the thick plate's dead knock (190 / 310 /
    470 Hz, 30 ms), a soft paper slap, a little click; above 1 kHz over in ~25 ms, so the word's first consonant (60 ms
    later) stays clear"""
    n = ns(.3); t = tt(n)
    y = hollow(t, seed, ((190, 1, .035), (310, .7, .025), (470, .4, .018))) + thud(170, 110, .008, .025, n) * .7
    y += bp(nz(n, seed + 1), 1300, .8) * np.exp(-t / .006) * .5
    c = tick(2200, seed + 2, ns(.02)) * .25; y[:len(c)] += c
    lo, hi = dsp.zp_split(y, 1000, 2); y = lo + hi * np.exp(-t / .012)
    return nrm(y * np.minimum(1, t / .0004))

def sfx_balafon_note(m, seed):
    """one clear balafon note (the series' FM mallet, warm register) with a soft sine core: the fiche's line « ticked »"""
    y = bk.balafon(m2f(m), .55, seed); t = tt(len(y))
    y = y + .35 * np.sin(2 * np.pi * m2f(m) * t) * np.exp(-t / .2) * np.minimum(1, t / .002)
    return nrm(dsp.hp(y, 200))

def sfx_felt(seed=541, dur=.36, squeak=1.0, attack=.012):
    """TOI's gloves scribble with a felt-tip pen: fibre friction (1.8-6.5 kHz) with the stroke's speed bumps, and the squeak:
    an intermittent stick-slip pulse train (~950 Hz, jittered) through two tight formants"""
    n = ns(dur); t = tt(n); r = rng(seed)
    env = np.minimum(1, t / attack) * np.clip((dur - t) / .07, 0, 1) * (.75 + .25 * np.sin(2 * np.pi * 3 * t + r.uniform(0, 6)))
    fric = dsp.butter(nz(n, seed), 'bp', [1800, 6500], 2)
    gr = grains(n, 160, seed + 1, .003, (.2, 1)); fric *= .55 + .45 * gr / (gr.max() + 1e-9)
    imp = stick_slip(n, 950 * (1 + wander(n, seed + 2, .07, 12)), seed + 3, (.6, 1))
    sq = bp(imp, 2300, 9) + .6 * bp(imp, 3600, 10)
    gate = np.clip(dsp.onepole_lp((rng(seed + 4).random(n // 480 + 1) > .45).repeat(480)[:n].astype(float), 40), 0, 1)
    sq = sq / (np.abs(sq).max() + 1e-9) * gate * squeak
    y = (fric / (np.abs(fric).max() + 1e-9) * .8 + sq * .6) * env
    y[:ns(.003)] += bp(nz(ns(.003), seed + 5), 3000, 1) * np.linspace(1, 0, ns(.003)) * .8      # the nib touches
    return nrm(y)

def sfx_tic(seed=551, f=2650.0):
    """a small dry « tic » (a pin, a ✓ drawn, a tag tied): sharp click + tiny ring"""
    return nrm(tick(f, seed))

def sfx_paper(seed=561, dur=.22):
    """a paper rustle (the note pinned / the bag lifted out of its paper): two quick paper flicks (series) and a crinkle"""
    n = ns(dur + .1); t = tt(n); y = np.zeros(n)
    for tk, a in ((0, 1.0), (.07, .6)): f = I.paper(seed + int(tk * 100)); place(y, f / (np.abs(f).max() + 1e-9) * a, ns(tk))
    y += bp(nz(n, seed + 1), 4200, 1.0) * grains(n, 500, seed + 2, .0008, (.2, 1), shape=(t < dur) * np.exp(-t / .1)) * .4
    return nrm(y)

def sfx_parcel_tonk(seed=571):
    """the small kraft parcel « ÉCHANTILLON » lands (« tonk » doux): a hollow little box (its air 240 Hz + board modes), the
    counter's soft wooden knock, a papery touch"""
    n = ns(.45); t = tt(n)
    y = hollow(t, seed, ((240, 1, .05), (365, .6, .035), (560, .35, .025), (830, .2, .015))) * .8 + thud(180, 120, .01, .04, n) * .6
    w = A.wood(310, seed + 1, .45); y[:len(w)] += w * .6
    y += bp(nz(n, seed + 2), 1600, .8) * np.exp(-t / .008) * .4
    return nrm(y * np.minimum(1, t / .0005))

def sfx_kraft(seed=581, dur=.3):
    """the parcel's kraft paper opened: a short rip of the kraft tape (stick-slip, rate falling 380 -> 140 Hz, through
    1 / 1.9 / 3 kHz), the stiff paper's crinkle; kept soft and mid (it runs under « c'est un »)"""
    n = ns(dur + .1); t = tt(n); u = np.clip(t / dur, 0, 1)
    imp = stick_slip(n, 380 - 240 * u, seed, (.3, 1))
    rip = sum(a * bp(imp, f, q) for f, q, a in ((1000, 3, 1.0), (1900, 4, .7), (3000, 4, .35)))
    rip = rip / (np.abs(rip).max() + 1e-9) * np.exp(-t / .1) * (t < dur)
    cr = bp(nz(n, seed + 1), 2600, .8) * grains(n, 260, seed + 2, .0015, (.2, 1), shape=np.clip((t - .05) / .05, 0, 1) * np.exp(-t / .2))
    y = rip + cr / (np.abs(cr).max() + 1e-9) * .5
    return nrm(dsp.lp(y, 6000) * np.minimum(1, t / .002))

def sfx_whoosh_low(dur, seed=601):
    """the big carton of the order comes in, slowed: a low air push growing toward its landing (band 140 -> 480 Hz),
    a breath of high air, cut dead AT the landing (the thud owns it)"""
    dur = max(.15, dur); n = ns(dur); t = tt(n); u = t / dur
    y = dsp.tv_biquad(nz(n, seed), 'bp', 140 * (480 / 140) ** u, 1.1) * (.35 + .65 * u ** 2)
    y += dsp.tv_biquad(nz(n, seed + 1), 'bp', 1100 * 2 ** u, 1.0) * .22 * u ** 2
    y *= np.minimum(1, t / .003); y[-ns(.003):] *= np.linspace(1, 0, ns(.003))
    return nrm(y)

def sfx_carton_thud(seed=611):
    """the big carton of the order lands, in SLOW MOTION: a deep, slowed cardboard thud — chest thump 95 -> 36 Hz with a long
    decay, the series' sub_drop, the full carton's dead body (bags inside: 95-520 Hz, low Q, slow glide), a soft papery slap,
    the bags settling inside (a muffled shuffle .1-.4 s)"""
    n = ns(1.8); t = tt(n)
    y = dsp.softclip(thud(95, 36, .045, .22, n, 1.7), 1.3)
    s = tail_fade(I.sub_drop(1.0).copy(), 250); y[:len(s)] += s[:n] * .7
    y += hollow(t, seed + 1, ((95, 1, .1), (148, .8, .075), (210, .6, .06), (300, .45, .045), (420, .3, .035), (520, .2, .028)),
                1 + .05 * np.exp(-t / .03)) * .7
    sl = bp(nz(ns(.02), seed + 2), 1400, .7) * np.linspace(1, 0, ns(.02)) * 1.2; y[:len(sl)] += sl
    sh = dsp.lp(nz(n, seed + 3), 500) * grains(n, 40, seed + 4, .02, (.3, 1), shape=np.clip((t - .1) / .05, 0, 1) * np.exp(-t / .25))
    y += sh / (np.abs(sh).max() + 1e-9) * .25
    y = hi_short(y, t, 500, .05, .05) * np.minimum(1, t / .0006)
    return y / np.abs(y).max()

def sfx_boing(seed=621, dur=.5, f0=277.18, soft=True):
    """the amber plate springs back up (« rebond » doux): a twangy saw wobbling around C#4 (11 Hz spring, decaying) through
    a formant sliding « bo- » -> « -ing », a little thump; `soft`: rounder (darker, gentler formant)"""
    n = ns(dur); t = tt(n)
    f = f0 * (1 + .14 * np.exp(-t / .12) * np.sin(2 * np.pi * 11 * t) + .2 * np.exp(-t / .03))
    ph = np.cumsum(f) / SR
    saw = dsp.lp(2 * (ph % 1.0) - 1, 3500 if soft else 6000)
    y = dsp.tv_biquad(saw, 'bp', 500 + (900 if soft else 1400) * np.clip(t / .12, 0, 1), 2.0 if soft else 3.0) * 1.6 + .7 * np.sin(2 * np.pi * ph)
    y *= np.minimum(1, t / .006) * np.exp(-t / .2)
    y += thud(150, 90, .01, .03, n) * .4
    return nrm(y)

def sfx_tap(seed=631):
    """the sample bag, held by the glove, taps the amber plate from below: a muffled « toc » — knuckles through fabric on a
    thick resin plate: a short wooden knock (380 Hz + partials), a fabric thump, a small click"""
    n = ns(.25); t = tt(n); y = np.zeros(n)
    w = A.wood(380, seed, 1.0); y[:len(w)] += w
    y += dsp.lp(nz(n, seed + 1), 700) * np.exp(-t / .01) * .6 + thud(200, 130, .008, .03, n) * .5
    return nrm(y * np.minimum(1, t / .0005))

def sfx_crack(seed=641, k=0):
    """the amber plate cracks (one more crack at each tap, each a little bigger): a dry snap (broadband, 2 ms), a burst of
    fine crackle grains (3-7 kHz, 40-80 ms), the plate's tiny low « tk »"""
    d = .04 + .02 * min(k, 2); n = ns(d + .1); t = tt(n)
    snap = dsp.hp(nz(ns(.003), seed), 1500) * np.linspace(1, .2, ns(.003)) * .45
    cr = dsp.butter(nz(n, seed + 1), 'bp', [3000, 7000], 2) * grains(n, 2500, seed + 2, .0003, (.2, 1), shape=(t < d) * np.exp(-t / (d * .6)))
    y = cr / (np.abs(cr).max() + 1e-9) * .6 + hollow(t, seed + 3, ((420, 1, .015), (690, .5, .01))) * .3
    y[:len(snap)] += snap
    y = A.sclip(y * np.minimum(1, t / .0004), .35 * np.abs(y).max())      # crest tamed: a crack, not a limiter dip
    return nrm(y)

def sfx_stamp_big(seed=671):
    """the amber ✓ / the ritual stamp « MAINTENANT, TU SAIS. »: the series' stamp doubled (rubber + table thud + paper
    slap), a chest thump with a short sub, the wax counter's dead body; above 160 Hz it is a hit, not a tail"""
    n = ns(1.2); t = tt(n); y = np.zeros(n)
    s = A.sfx_stamp(seed); y[:len(s)] += s / np.abs(s).max()
    s = I.stamp(seed + 1); y[:len(s)] += s * .7
    y += dsp.softclip(thud(110, 40, .03, .16, n, 1.6), 1.3) * .9
    y += hollow(t, seed + 2, ((140, 1, .07), (215, .7, .05), (330, .45, .035))) * .5
    tk = dsp.hp(nz(ns(.003), seed + 3), 3000) * np.linspace(1, 0, ns(.003)) * .8; y[:len(tk)] += tk
    y = hi_short(y, t, 160, .05, .07) * np.minimum(1, t / .0004)
    return y / np.abs(y).max()

def sfx_violet_hum(seed=681, dur=.7):
    """the violet light switches on: a soft switch « tk », then a warm electric swell (detuned sines A4 / E5 / E6, the brand
    pad's own tones) with a whisper of shimmer, fading as the pad takes over"""
    n = ns(dur); t = tt(n)
    env = np.minimum(1, t / .2) ** 1.5 * np.clip((dur - t) / .35, 0, 1)
    y = (np.sin(2 * np.pi * 440 * t) + np.sin(2 * np.pi * 441.8 * t + 1) + .6 * np.sin(2 * np.pi * 659.26 * t + 2)
         + .25 * np.sin(2 * np.pi * 1318.5 * t + 3)) * env * .25
    y += bp(nz(n, seed), 6000, 1.2) * env * .05
    s = A.sfx_tap(seed); y[:len(s)] += s * .5
    return nrm(y)

def sfx_label_slap(seed=691):
    """the blue Bonzini label pops on the big carton: a flat paper « fwap », the adhesive « tk », a hollow tap on the box"""
    n = ns(.3); t = tt(n)
    y = bp(nz(n, seed), 1500, .8) * np.exp(-t / .012) * 1.2 + dsp.hp(nz(n, seed + 1), 4000) * np.exp(-t / .004) * .5
    y += hollow(t, seed + 2, ((180, 1, .035), (290, .6, .025))) * .5
    return nrm(y * np.minimum(1, t / .0004))

def sfx_skitter(seed=701, dur=.32):
    """the margouillat's claws on the wax cloth (it jumps at the BOUM): two quick bursts of tiny ticks + a short scrape"""
    out = np.zeros(ns(dur + .05)); r = rng(seed)
    for k, tk in enumerate((0, .022, .041, .066, .15, .171, .197)):
        place(out, tick(r.uniform(2600, 4200), seed + k, ns(.02)) * r.uniform(.4, 1.0) * (1 if k else 1.2), ns(tk))
    n = ns(.07); sc = bp(nz(n, seed + 20), 3000, .9) * grains(n, 900, seed + 21, .0008, (.2, 1)) * np.sin(np.pi * tt(n) / .07) * 2
    place(out, sc, 0)
    return nrm(out)

def sfx_paper_flip(seed=711):
    """the meme header folds away: a paper fold (two flicks and a crease « krr »), a soft flap at the end"""
    n = ns(.42); t = tt(n); y = np.zeros(n)
    for tk, a in ((0, .8), (.09, 1.0)): f = I.paper(seed + int(tk * 100)); place(y, f / (np.abs(f).max() + 1e-9) * a, ns(tk))
    i = ns(.05); m = ns(.12); cr = bp(nz(m, seed + 1), 2400, .8) * grains(m, 900, seed + 2, .0008, (.2, 1)) * np.sin(np.pi * tt(m) / .12)
    y[i:i + m] += cr / (np.abs(cr).max() + 1e-9) * .5
    j = ns(.3); k = n - j; y[j:] += bp(nz(k, seed + 3), 1300, .8) * np.exp(-tt(k) / .01) * .5
    return nrm(y)

def sfx_sparkle(seed=721):
    """a small sparkle (« PAREIL ✓ »): a short sweep of glassy grains on E major (the series' shimmer, .3 s), kept high and
    light"""
    return A.sfx_shimmer(seed, .3)

def morning_bird(seed, kind=0):
    """a distant small bird in the street (generic, synthesised): 2-3 quick chirps — sine whistles gliding up (kind 0) or a
    short down-up trill (kind 1), 3-5 kHz, soft, a little air"""
    r = rng(seed); out = np.zeros(ns(.6))
    nch = 2 + int(r.integers(0, 2)); tk = 0.0
    for c in range(nch):
        d = r.uniform(.05, .09); n = ns(d); t = tt(n); u = t / d
        f0 = r.uniform(3000, 3800)
        f = f0 * (1 + .35 * u) if kind == 0 else f0 * (1.25 - .3 * np.sin(np.pi * u) + .05 * np.sin(2 * np.pi * 38 * t))
        y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * u) ** 1.5
        place(out, y * r.uniform(.6, 1.0), ns(tk)); tk += d + r.uniform(.04, .08)
    return dsp.lp(out, 7000)

def sfx_family(name, sd):
    """a cue name the engine does not know yet: the sound of its family (whoosh, stamp, pop, tic, clac, paper, slide, thud,
    tap, ding), or None"""
    fam = next((k for k in ('whoosh', 'stamp', 'pop', 'tic', 'clac', 'paper', 'slide', 'thud', 'tap', 'ding', 'gloup', 'clink')
                if k in name), None)
    sig = {'whoosh': lambda: sfx_whoosh(sd), 'stamp': lambda: sfx_stamp(sd), 'pop': lambda: I.pop(sd), 'tic': lambda: sfx_tic(sd),
           'clac': lambda: sfx_plate_clac(sd), 'paper': lambda: sfx_paper(sd), 'slide': lambda: sfx_paper_slide(sd),
           'thud': lambda: sfx_carton_thud(sd), 'tap': lambda: sfx_tap(sd), 'ding': lambda: sfx_ding_soft(sd),
           'gloup': lambda: R.sfx_gloup(0, sd), 'clink': lambda: R.sfx_clink(88, sd)}.get(fam)
    return (fam, sig()) if sig else (None, None)

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

# =====================================================================================================================
# the shop in the morning
# =====================================================================================================================
def morning_bed(N, dur, cut, back, seed=731):
    """the shop in the morning, door open: soft air (pink-ish 50 Hz-1.6 kHz) + a whisper of high air + the street far away
    (a low rumble 35-260 Hz that swells and recedes like distant traffic, 2 integer cycles per film), decorrelated L/R,
    EXACTLY periodic over the film (circularly filtered noise) so the loop has no seam; it leans in a little during the
    music's dead cut (cut -> back). No bulb hum: the bulb is off"""
    t = np.arange(N) / SR; f = np.fft.rfftfreq(N, 1 / SR)
    shape = np.where(f > 50, 1 / np.sqrt(np.maximum(f, 1)), 0) / (1 + (f / 1600) ** 4)
    rum = ((f > 35) & (f < 260)) / (1 + (f / 120) ** 2)
    out = np.zeros((N, 2))
    for c in range(2):
        y = np.fft.irfft(np.fft.rfft(nz(N, seed + c)) * shape, N); y /= y.std()
        h = np.fft.irfft(np.fft.rfft(nz(N, seed + 10 + c)) * ((f > 3000) & (f < 9000)), N); h /= h.std()
        u = np.fft.irfft(np.fft.rfft(nz(N, seed + 20 + c)) * rum, N); u /= u.std()
        swell = .55 + .45 * np.sin(2 * np.pi * 2 * t / dur + 1.3 + .4 * c) ** 2
        out[:, c] = y * .0019 + h * .00035 + u * .0016 * swell
    breath = 1 + .18 * np.sin(2 * np.pi * 3 * t / dur + 1.0)
    lift = 1 + .45 * np.clip((t - cut - .25) / 1.2, 0, 1) * np.clip((back - t) / .5, 0, 1)
    return out * (breath * lift)[:, None]

def bird_plan(dur, spans, avoid, cue_t, need=.38, max_birds=5):
    """[(t, kind)]: a distant bird only where nothing else happens — a slot of `need` s inside a speech pause, with no cue
    from .15 s before to its end, outside the `avoid` windows (the tags + the lesson's dead cut, the key moment, the
    signature, the end) and away from the loop seam; at most one per pause"""
    sp = sorted((a, b) for _, a, b in spans); gaps = []; prev = 0.0
    for a, b in sp + [(dur, dur)]:
        if a - prev >= need + .1: gaps.append((prev + .05, a - .05))
        prev = max(prev, b)
    out = []
    for g0, g1 in gaps:
        t = g0
        while t + need <= g1:
            ok = (t >= .5 and t + need <= dur - .8 and not any(x0 - .1 <= t + need and t <= x1 for x0, x1 in avoid)
                  and not any(t - .15 <= c <= t + need for c in cue_t))
            if ok: out.append((round(t, 3), len(out) % 2)); break
            t += .05
        if len(out) >= max_birds: break
    return out

# =====================================================================================================================
# music
# =====================================================================================================================
CH = {nm: (nm, tones, root) for nm, tones, root in mk.PROG_MINOR + mk.PROG}
CH['E7'] = ('E7', [64, 68, 71, 74], 52)
CH['Bm'] = ('Bm', [66, 71, 74, 78], 47)
TENSE_CHORDS = {'enter': ['F#m', 'D'], 'order': ['C#m', 'D', 'E7']}    # enter cycles; order climbs and holds the E7
MORNING_CHORDS = {'fiche': ['D', 'E'], 'sample': ['Bm', 'E', 'D', 'E']}  # never the tonic A: it waits for the ✓
LINE_NOTES = (78, 81, 83, 88)                  # the fiche's 4 lines: F#5 A5 B5 E6 (the last = the signature's first note)
CLINK_NOTES = (95, 92, 88)                     # P, A, S fall: B6 G#6 E6 (the V of A, resolved on the ✓)

def spans_of(vinfo, sc):
    """speech spans [(id, on, off)]: the real takes when voiced, else the score's planned spans"""
    return [(v['id'], v['film_on'], v['film_off']) for v in vinfo] if vinfo else planned_spans(sc)

def talking_at(spans, x, pre=.05, post=0.0): return any(a - pre <= x <= b + post for _, a, b in spans)

def tense_plan(cues, mp):
    """stop-time segments of the F#-minor groove: [{k, a, e, role, beat}] — enter = music().tenseFrom · order = TOI's order
    card landing (card_flop). The band stops BRK before each re-entry and BRK before the first « ? » tag stamp (the 3
    stamps hit in the break, over the riser); the gate cuts at music().cut"""
    t0, cut = mp['tenseFrom'], mp['cut']
    tags = [c['t'] for c in cues if c['name'] == 'tag_stamp' and t0 + .6 < c['t'] <= cut + 1e-6]
    brk = (tags[0] - BRK) if tags else cut
    an = [(t0, 'enter')]
    o = first(cues, 'card_flop', t0 + .6, brk - .5)
    if o is not None: an.append((o, 'order'))
    segs = [dict(k=k, a=a, e=(an[k + 1][0] - BRK if k + 1 < len(an) else brk), role=role, beat=BEAT) for k, (a, role) in enumerate(an)]
    return segs, dict(tags=tags, brk=brk)

def compose_tense(M, segs, tp, cut, spans):
    gbar = 0
    for s in segs:
        k, a, e, role = s['k'], s['a'], s['e'], s['role']
        def put(sig, t, g=1.0, p=0.0, _a=a, _e=e, _k=k):
            if _a - 1e-6 <= t < _e - 1e-6:
                M.put('groove', sig, t, g * G_TENSE, p, cut=True, tag='music_in' if (_k == 0 and t - _a < .02) else ('seg', _k))
        names = TENSE_CHORDS[role]; nb = max(1, int(math.ceil((e - a) / 2.0 - 1e-9)))
        for b in range(nb):
            tb = a + 2.0 * b
            ch = CH[names[b % len(names)] if role == 'enter' else names[min(b, len(names) - 1)]]; name, tones, root = ch
            mk.groove(put, tb, gbar, beat=BEAT, level='tense', prog=[ch] * 4)
            dense = role == 'order'; last = dense and b == nb - 1
            for j in range(16):
                tj = tb + j * .125 + (.012 if j % 2 else 0.0)
                if (dense or b >= 1) and mk.RHY[j]:
                    put(mk.guitar(m2f(tones[(j // 2) % len(tones)]), .09, bright=.45, decay=.98, seed=4000 + 16 * gbar + j, mute=1), tj, .16, -.45)
                if (dense or b >= 1) and j % 2 == 0: put(A.rattle(4100 + 16 * gbar + j, .045, .9, 1.0), tj, .22 if j % 4 == 0 else .15, .35)
                if dense and j % 4 == 2: put(A.conga(62 if j % 8 == 2 else 57, 4300 + 16 * gbar + j, slap=j % 8 == 6), tj, .40, -.3)
                if dense and j % 4:
                    put(mk.guitar(m2f(tones[mk.PICK[j] % len(tones)] + 12), .2, bright=.62, decay=.99, seed=4200 + 16 * gbar + j, mute=.5), tj, .12, .45)
                if last:
                    for h in range(2):
                        put(bk.balafon(m2f(tones[(j + h) % len(tones)] + 12 + (12 if j >= 8 else 0)), .25, 4400 + 32 * gbar + 2 * j + h),
                            tj + h * .0625, .10 + .06 * j / 16, -.45)
            for q in range(4):
                tq = tb + q * BEAT
                if dense and q % 2 == 1: put(mk.kick(), tq, .55)                         # four on the floor
                if last and q in (1, 3): put(A.clap(4500 + 4 * gbar + q), tq, .45, -.1)
            gbar += 1
        if role != 'enter':                                                            # the band lands WITH the hit
            ch = CH[names[0]]; put(mk.kick(), a, .55)
            if not talking_at(spans, a): put(I.stab([m - 12 for m in ch[1]], .18, 1.0), a, .55, 0)   # under a word: kick only
    d = min(2.4, cut - segs[-1]['a']); n = ns(d + .1); u = np.clip(tt(n) / d, 0, 1)        # riser into the cut, through the
    M.put('groove', dsp.tv_biquad(nz(n, 4600), 'bp', 900 * 7 ** u, 2.0) * u ** 1.8 * .6,   # tags' break, killed by the gate
          cut - d, .36 * G_TENSE, 0, cut=True, tag=('seg', segs[-1]['k']))

def compose_rise(M, rf, bf, spans):
    """music().riseFrom -> balafonFrom (« LA PROCHAINE FOIS »): a low balafon D (« rise_in », in the pause before N3a), the
    D(add9) morning pad swelling, a shaker on the fiche's grid (anchored backwards from balafonFrom) fading in, an A -> D
    bass pickup into the first clac"""
    M.put('groove', A.balafon(62, 6100, .9), rf, .70 * G_MORNING, -.1, tag='rise_in')
    M.put('groove', mk.bass(m2f(38), .9, .3), rf, .50 * G_MORNING, 0, tag='rise_in')
    d = bf - rf + .45; p = A.soft_pad([62, 66, 69, 76], d, 1.0); tp = tt(len(p))
    M.put('brand', p * (.35 + .65 * smooth01(tp / max(.5, bf - rf))), rf, 1.1 * G_MORNING, 0, tag=('rise', 0))
    k = 1
    while bf - k * BEAT / 2 > rf + .6:
        tk = bf - k * BEAT / 2; w = 1 - (bf - tk) / max(.6, bf - rf)
        M.put('groove', A.rattle(6150 + k, .04, .8, 1.0), tk, (.05 + .13 * w ** 1.5) * G_MORNING, .35, tag=('rise', k)); k += 1
    if bf - BEAT > rf + .3: M.put('groove', mk.bass(m2f(33), .4, .5), bf - BEAT, .45 * G_MORNING, 0, tag=('rise', 'pickup'))

def compose_morning(M, a, e, role, spans, tag_in, gbar0=0):
    """the MORNING groove (light makossa): 8th-note guitar arpeggio (soft, mid register), shaker 8ths, rim on 2 & 4, a round
    bass (root on 1, fifth on 3); 'sample' adds a soft kick on 1 & 3 and the muted skank. Grid anchored at `a`"""
    names = MORNING_CHORDS[role]; nb = max(1, int(math.ceil((e - a) / 2.0 - 1e-9)))
    for b in range(nb):
        tb = a + 2.0 * b; gb = gbar0 + b; ch = CH[names[b % len(names)]]; name, tones, root = ch
        def put(sig, t, g=1.0, p=0.0, _b=b):
            if a - 1e-6 <= t < e - 1e-6:
                M.put('groove', sig, t, g * G_MORNING, p, tag=tag_in if (_b == 0 and t - a < .02) else (role, _b))
        for j in range(0, 16, 2):
            tj = tb + j * .125
            put(mk.guitar(m2f(tones[mk.PICK[j] % len(tones)] + 12), .3, bright=.55, decay=.993, seed=6200 + 16 * gb + j), tj,
                .22 if j % 4 == 0 else .15, .4)
            put(A.rattle(6300 + 16 * gb + j, .04, .8, 1.0), tj + (.012 if j % 4 else 0), .15 if j % 4 == 0 else .10, .35)
        if role == 'sample':
            for j in range(16):
                if mk.RHY[j]:
                    put(mk.guitar(m2f(tones[(j // 2) % len(tones)]), .09, bright=.4, decay=.98, seed=6400 + 16 * gb + j, mute=1),
                        tb + j * .125 + (.012 if j % 2 else 0), .12, -.45)
        for q in range(4):
            tq = tb + q * BEAT
            if q in (1, 3): put(mk.rim(4 * gb + q), tq, .30, -.1)
            if q == 0: put(mk.bass(m2f(root - 12), .45, .4), tq, .48, 0)
            if q == 2: put(mk.bass(m2f(root - 12 + 7), .35, .4), tq, .40, 0)
            if role == 'sample' and q in (0, 2): put(mk.kick(), tq, .42)
    return gbar0 + nb

def compose_key(M, key, thud_t, check):
    """the KEY MOMENT (silent slow motion, no voice): no band; a suspended E pad (E A B E) swells from the big carton's
    arrival, a low E pedal (sub) from its landing, a reversed swell sucked into the ✓ and cut AT it (the A-major arrival)"""
    M.put('brand', A.soft_pad([64, 69, 71, 76], check - key, 1.0), key, .80 * G_BRAND, 0, tag='key_pad')
    if thud_t < check - .3: M.put('brand', I.bass_sub(28, check - thud_t), thud_t, .35 * G_BRAND, 0, tag='key_pad')
    d = min(.8, check - key - .2)
    if d > .15:
        n = ns(d); u = tt(n) / d
        sw = np.stack([dsp.tv_biquad(nz(n, 6500 + c), 'bp', 600 * 8 ** u, 1.5) * u ** 2.2 for c in range(2)], 1)
        sw[-ns(.004):] *= np.linspace(1, 0, ns(.004))[:, None]
        M.put('brand', sw / (np.abs(sw).max() + 1e-9) * .5, check - d, .30 * G_BRAND, 0, tag='key_swell', fade=False)

def compose_major(M, a, stop):
    """A MAJOR on the ✓ (the E resolves at last): arrival (stab, pad swell, kick, shimmer, sub) and the full makossa on a
    grid anchored at music().majorFrom, until the break before the signature"""
    nb = max(1, int(math.ceil((stop - a) / 2.0 - 1e-9)))
    for b in range(nb):
        tb = a + 2.0 * b
        def put(sig, t, g=1.0, p=0.0, _b=b):
            if t < stop - 1e-6: M.put('groove', sig, t, g * G_MAJOR, p, tag='major_in' if (_b == 0 and t - a < .02) else ('maj', _b))
        mk.groove(put, tb, b, level='full', prog=mk.PROG)
        name, tones, root = mk.PROG[b % 4]
        for j in range(16):
            tj = tb + j * .125 + (.012 if j % 2 else 0.0)
            if j % 2 == 0: put(A.rattle(5300 + 16 * b + j, .04, .8, 1.1), tj, .14 if j % 4 else .19, .35)
            if j in (6, 14): put(A.balafon_bright(tones[(j // 6 + b) % 4] + 12, 5400 + 16 * b + j, .6), tj, .16, -.4)
            if j % 8 == 4: put(A.conga(64 if j == 4 else 59, 5500 + 16 * b + j, slap=j == 12), tj, .30, -.3)
    tag = 'major_in'
    M.put('groove', I.stab([57, 61, 64, 69], .22, 1.0), a, 1.0 * G_MAJOR, 0, tag=tag)
    M.put('brand', A.soft_pad([69, 73, 76], 1.6, 1.0), a, .55 * G_MAJOR, 0, tag=tag)
    M.put('groove', mk.kick(), a, .5 * G_MAJOR, 0, tag=tag)
    M.put('brand', A.sfx_shimmer(5600, .5), a, .22 * G_MAJOR, 0, tag=tag)
    M.put('brand', I.bass_sub(33, .5), a, .35 * G_MAJOR, 0, tag=tag)

def brand_anchor(sig_t, card_t):
    """the violet grid: anchored so the end card lands exactly on a beat, its downbeat next to the signature"""
    k = max(3, int(round((card_t - sig_t) / BEAT)))
    return card_t - k * BEAT, k

def compose_brand(M, sig_t, card_t, spans):
    """the violet section (« PAS REÇU. »'s brand sound) from the signature to the end card: soft pad D(add9, lydian with the
    signature's G#) -> E7sus4 (2 beats before the card), the bass D A D C# | E B, a light pulse (shaker, rim), and the
    bright balafon ONLY in the speech pauses (« commande », « transport », « Bonzini » stay clear); A at the card
    (compose_end). The pulse re-enters on the first violet beat after the signature (« brand_in »)"""
    v0, nbt = brand_anchor(sig_t, card_t)
    beats = lambda b: v0 + b * BEAT
    put = lambda sig, t, g=1.0, p=0.0, tag=None, stem='brand': M.put(stem, sig, t, g * G_BRAND, p, tag=tag)
    clear = lambda t: not talking_at(spans, t, pre=.06, post=.03)
    sus = beats(nbt - 2); b0 = next((b for b in range(nbt + 1) if beats(b) >= sig_t + SIG_GAP + .2), nbt)
    put(A.soft_pad([62, 66, 69, 76], sus - sig_t + .35, 1.0), sig_t, .55, 0, tag=('brand', 'pad'))
    put(A.soft_pad([64, 69, 71, 74], card_t - sus + .30, 1.0), sus, .55, 0, tag=('brand', 'sus'))
    bl = {0: (38, .9), 2: (33, .9), 4: (38, .45), 5: (37, .45)}
    for b in range(b0, nbt - 2):
        m, d = bl.get((b - b0) % 6, (None, None))
        if m: put(mk.bass(m2f(m), d, .3), beats(b), .40, 0, tag='brand_in' if b == b0 else ('brand', b))
    put(mk.bass(m2f(40), .45, .3), sus, .42, 0, tag=('brand', 'sus')); put(mk.bass(m2f(35), .45, .3), sus + BEAT, .42, 0, tag=('brand', 'sus'))
    for e8 in range(2 * b0, 2 * nbt):                                                  # the light pulse: shaker 8ths, rim 2 & 4
        tk = v0 + e8 * BEAT / 2; tg = 'brand_in' if e8 == 2 * b0 else ('brand', 'pulse')
        put(A.rattle(5900 + e8, .04, .8, 1.0), tk, .12 if e8 % 2 == 0 else .08, .35, tag=tg, stem='groove')
        if e8 % 4 == 2: put(mk.rim(5950 + e8), tk, .22, -.1, tag=('brand', 'pulse'), stem='groove')
    pat = {2: 81, 3: 85, 5: 88, 6: 85, 8: 81, 9: 85, 10: 88, 11: 90, 13: 88, 14: 85}
    nb_bal = 0
    for e8 in range(2 * b0, 2 * (nbt - 2)):
        m = pat.get(e8 % 16); tk = v0 + e8 * BEAT / 2
        if m and clear(tk): put(A.balafon_bright(m, 5000 + e8), tk, .20, -.3 + .2 * (e8 % 3), tag=('brand', 'bal')); nb_bal += 1
    climb = [(0, 81), (.5, 83), (1, 86), (1.5, 88), (2, 88), (2.5, 91), (2.75, 93), (3.0, 95), (3.25, 98), (3.5, 100)]
    for e8, m in climb:
        tk = sus + e8 * BEAT / 2
        if tk < card_t - .01 and clear(tk):
            put(A.balafon_bright(m, 5100 + int(e8 * 4)), tk, .17 + .025 * e8, -.2 + .15 * (int(e8 * 2) % 3), tag=('brand', 'climb')); nb_bal += 1
    return dict(v0=v0, beats=nbt, b0=b0, re_entry=beats(b0), sus=sus, card=card_t, balafon_notes=nb_bal)

def compose_end(M, a, hit2, t_final, spans):
    """A-major makossa from the end card (arrival: stab, pad swell, kick, shimmer, sub), a break BRK before the ritual stamp
    and the band slams back ON it, lighter (« lite »: no kick/bass/hats) under « Maintenant, tu sais. ». The last phrase is a
    slight ritardando (beat = (final - ritual stamp) / round(.. / .5), kept within .45-.58 s) so the final A chord (on its
    cue) lands ON a downbeat; the band stops on an E accent one beat before (kick + bass; + stab and clap only in a pause)"""
    segs = [(a, (hit2 - BRK) if hit2 else None)] + ([(hit2, None)] if hit2 else [])
    stop = None; bar = 0; beat2 = BEAT
    for si, (s0, s1) in enumerate(segs):
        bt = BEAT
        if s1 is None:
            k = max(2, int(round((t_final - s0) / BEAT)))
            if .45 <= (t_final - s0) / k <= .58: bt = (t_final - s0) / k
            beat2 = bt; kk_ = int(math.floor((t_final - .3 - s0) / bt + 1e-9)); stop = s0 + max(kk_, 1) * bt; s1 = stop
        nb = max(1, int(math.ceil((s1 - s0) / (4 * bt) - 1e-9)))
        for b in range(nb):
            tb = s0 + 4 * bt * b
            def put(sig, t, g=1.0, p=0.0, _s1=s1, _si=si, _b=b):
                if t < _s1 - 1e-6: M.put('groove', sig, t, g * G_MAJOR, p, tag=('end', _si, _b))
            prog = mk.PROG[bar % 4]
            mk.groove(put, tb, 8 + bar, beat=bt, level='full' if si == 0 else 'lite', prog=[prog] * 4)
            name, tones, root = prog
            for j in range(16):
                tj = tb + j * bt / 4 + (.012 if j % 2 else 0.0)
                if j % 2 == 0: put(A.rattle(5800 + 16 * bar + j, .04, .8, 1.1), tj, .14 if j % 4 else .19, .35)
                if si == 0 and j in (6, 14): put(A.balafon_bright(tones[(j // 6 + bar) % 4] + 12, 5900 + 16 * bar + j, .6), tj, .16, -.4)
                if si == 0 and j % 8 == 4: put(A.conga(64 if j == 4 else 59, 6000 + 16 * bar + j, slap=j == 12), tj, .30, -.3)
            bar += 1
        if si == 1:                                                     # back ON the ritual stamp
            M.put('groove', mk.kick(), s0, .6 * G_MAJOR, 0, tag='hit2_band')
            if not talking_at(spans, s0): M.put('groove', I.stab([57, 61, 64, 69], .18, 1.0), s0, .8 * G_MAJOR, 0, tag='hit2_band')
    tag = 'arrival_A'
    M.put('groove', I.stab([57, 61, 64, 69], .22, 1.0), a, 1.0 * G_MAJOR, 0, tag=tag)
    M.put('brand', A.soft_pad([69, 73, 76], 2.2, 1.0), a, .55 * G_MAJOR, 0, tag=tag)
    M.put('groove', mk.kick(), a, .55 * G_MAJOR, 0, tag=tag)
    M.put('brand', A.sfx_shimmer(6100, .5), a, .22 * G_MAJOR, 0, tag=tag)
    M.put('brand', I.bass_sub(33, .5), a, .35 * G_MAJOR, 0, tag=tag)
    accent = None
    if stop is not None and stop < t_final - .15:                       # the « pa- » on E: V -> I with the final chord
        accent = 'kick + bass' if talking_at(spans, stop) else 'kick + bass + stab + clap'
        M.put('groove', mk.kick(), stop, .7 * G_MAJOR, 0, tag='stop'); M.put('groove', mk.bass(m2f(40), .18, .6), stop, .5 * G_MAJOR, 0, tag='stop')
        if not talking_at(spans, stop):
            M.put('groove', I.stab([52, 56, 59, 64], .10, 1.0), stop, .9 * G_MAJOR, 0, tag='stop'); M.put('groove', A.clap(6150), stop, .35 * G_MAJOR, -.1, tag='stop')
    return stop, beat2, accent

# =====================================================================================================================
# compose everything
# =====================================================================================================================
def cue_parts(c, cues, DUR, st):
    """the sound of one cue: (parts [(stem, sig, dt, rel_gain, pan)] | None, special str | None). `st` = running counters"""
    t, name, pan = c['t'], c['name'], c.get('pan', 0) or 0; sd = 7000 + int(round(t * 1000)) % 997
    nxt = lambda nm: first(cues, nm, t + 1e-6)
    P1 = lambda stem, sig, p=pan, dt=0.0, g=1.0: [(stem, sig, dt, g, p)]
    if name == 'carton_tear': return P1('sfx', sfx_carton_tear()), None
    if name == 'pouf': return P1('sfx', sfx_pouf()), None
    if name == 'soft_land': return P1('sfx', sfx_soft_land()), None
    if name == 'fall_whistle':
        b = nxt('boum'); d = (b - t) if (b is not None and b - t < 1.5) else .6
        return P1('sfx', R.sfx_fall_whistle(max(.15, d)), 0), None
    if name == 'boum': return P1('hit', sfx_boum(), 0), None
    if name == 'marbles': return P1('sfx', R.sfx_marbles(231, 14, .75), 0), None
    if name == 'gecko_skitter': return P1('sfx', sfx_skitter()), None
    if name == 'paper_flip': return P1('sfx', sfx_paper_flip()), None
    if name == 'pop': return P1('sfx', I.pop(sd), 0), None
    if name == 'metal_set': return P1('hit', sfx_metal_set(), .1), None
    if name == 'ding_soft': return P1('sfx', sfx_ding_soft(), .15), None
    if name == 'whoosh_soft':
        return P1('sfx', sfx_whoosh(sd, .30, -.2 + pan, .45 + pan, 300, 2200, .4)), None
    if name == 'card_flop': return P1('hit', sfx_card_flop(), 0), None
    if name == 'tag_stamp': return P1('hit', sfx_stamp(sd, body=.5, hi_tau=.02)), None
    if name in GATES: return None, 'gate'
    if name == 'cricket': return P1('amb', A.sfx_cricket(), -.6), None
    if name == 'pffuit': return P1('sfx', R.sfx_squish(sd, .4), .05), None
    if name == 'mock_guitar': return P1('sfx', A.sfx_mock(sd), .35), None
    if name == 'whoosh': return P1('sfx', sfx_carton_whoosh(sd)), None
    if name == 'riser':
        nv = next((x for x in st['voice_starts'] if x > t + .3), None)
        d = min(2.4, max(.6, (nv - .05 - t) if nv else 1.5))
        return P1('sfx', sfx_riser(d, sd), 0), None
    if name == 'paper_slide':
        k = st.get('slide', 0); st['slide'] = k + 1
        return P1('sfx', sfx_paper_slide(sd, .32, (-.4, .3, .4)[k % 3] if pan == 0 else pan - .3, pan + .1)), None
    if name == 'clac': return P1('sfx', sfx_plate_clac(sd)), None
    if name == 'balafon_note':
        k = st.get('bal', 0); st['bal'] = k + 1
        return P1('groove', sfx_balafon_note(LINE_NOTES[min(k, len(LINE_NOTES) - 1)] + 12 * (k // len(LINE_NOTES)), sd), -.2), None
    if name == 'felt': return P1('sfx', sfx_felt(sd)), None
    if name == 'tic':
        k = st.get('tic', 0); st['tic'] = k + 1
        return P1('sfx', sfx_tic(sd, (2650, 2900, 3150, 2800)[k % 4])), None
    if name == 'stamp': return P1('hit', sfx_stamp(sd)), None
    if name == 'paper': return P1('sfx', sfx_paper(sd)), None
    if name == 'tonk': return P1('hit', sfx_parcel_tonk()), None
    if name == 'kraft': return P1('sfx', sfx_kraft()), None
    if name == 'sparkle': return P1('sfx', sfx_sparkle(sd)), None
    if name == 'whoosh_low':
        th = nxt('carton_thud'); d = (th - t) if (th is not None and th - t < 1.2) else .35
        return P1('sfx', sfx_whoosh_low(d)), None
    if name == 'carton_thud': return P1('hit', sfx_carton_thud(), 0), None
    if name == 'boing_soft': return P1('sfx', sfx_boing()), None
    if name == 'tap': return P1('sfx', sfx_tap(sd)), None
    if name == 'crack':
        k = st.get('crack', 0); st['crack'] = k + 1
        return P1('sfx', sfx_crack(sd, k)), None
    if name == 'clink':
        k = st.get('clink', 0); st['clink'] = k + 1
        return P1('sfx', R.sfx_clink(CLINK_NOTES[min(k, 2)], sd)), None
    if name == 'stamp_big': return P1('hit', sfx_stamp_big(sd), 0), None
    if name == 'violet_hum': return P1('brand', sfx_violet_hum(), 0), None
    if name == 'label_slap': return P1('sfx', sfx_label_slap(), .15), None
    if name == 'gloup':
        k = st.get('gloup', 0); st['gloup'] = k + 1
        return P1('sfx', R.sfx_gloup(k, sd)), None
    if name in ('major', 'final_chord', 'bonzini_sig'): return None, name
    fam, sig = sfx_family(name, sd)
    return ([('sfx', sig, 0.0, 1.0, pan)], f'family:{fam}') if sig is not None else (None, 'unknown')

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
    # ---- music ----------------------------------------------------------------------------------------------------
    segs, tp = tense_plan(cues, mp); compose_tense(M, segs, tp, mp['cut'], spans); plan['segs'] = segs; plan['tags'] = tp
    rf, bf, mj, sg = mp['riseFrom'], mp['balafonFrom'], mp['majorFrom'], mp['sigAt']
    t_final = first(cues, 'final_chord') or mp.get('finalChord') or DUR - .85
    t_dry = first(cues, 'cut_dry') or DUR - .02
    key = first(cues, 'whoosh_low', bf, mj) or (mj - 2.35)
    thud_t = first(cues, 'carton_thud', key - .01, mj) or key + .35
    stamp_all = first(cues, 'stamp', bf + .3, key - .6)                                 # « ÉCRIS TOUT »
    compose_rise(M, rf, bf, spans)
    f_end = (stamp_all - BRK) if stamp_all else key
    gb = compose_morning(M, bf, f_end, 'fiche', spans, 'fiche_in')
    if stamp_all:
        gb = compose_morning(M, stamp_all, key, 'sample', spans, 'sample_in', gb)
        M.put('groove', mk.kick(), stamp_all, .5 * G_MORNING, 0, tag='sample_in')
        if not talking_at(spans, stamp_all): M.put('groove', I.stab([50, 54, 57, 62], .16, 1.0), stamp_all, .5 * G_MORNING, 0, tag='sample_in')
    compose_key(M, key, thud_t, mj)
    m_stop = sg - BRK
    compose_major(M, mj, m_stop)
    card = first(cues, 'whoosh_soft', sg + .5, t_final)                               # the end card's whoosh (A.endcard)
    if card is None:
        pop = first(cues, 'pop', sg + .5, t_final); card = (pop - .25) if pop is not None else (T['N6'] - .25 if 'N6' in T else None)
    if card is None or card <= sg + 1.5: card = sg + max(1.5, (t_final - sg) * .55)
    hit2 = first(cues, 'stamp_big', card, t_final - .6)
    plan['brand'] = compose_brand(M, sg, card, spans)
    stop, beat2, accent = compose_end(M, card, hit2, t_final, spans)
    plan['fiche'] = dict(rise=rf, a=bf, stop=f_end, sample=stamp_all, key=key, thud=thud_t)
    plan['major'] = dict(a=mj, stop=m_stop)
    plan['end'] = dict(card=card, hit2=hit2, stop=stop, accent=accent, final=t_final, dry=t_dry, beat2=beat2)
    # ---- the shop in the morning -------------------------------------------------------------------------------------
    if with_amb:
        M.put('amb', morning_bed(ns(DUR), DUR, mp['cut'], rf), 0.0, 1.0, fade=False)
        avoid = [(tp['brk'] - .1, rf + .3), (key - .3, mj + .4), (sg - .3, sg + .8), (t_final - .5, DUR)]
        birds = bird_plan(DUR, spans, avoid, [c['t'] for c in cues if c['name'] not in GATES])
        for k, (tb, kind) in enumerate(birds):
            b = morning_bird(7700 + k, kind); M.put('amb', b, tb, 10 ** ((BIRD_LUFS - mom_max(panst(b, -.55))) / 20), -.55, tag=('bird', k))
        plan['birds'] = [round(b[0], 3) for b in birds]
    # ---- cues -------------------------------------------------------------------------------------------------------
    unknown = []; famd = []; levels = {}
    st = dict(voice_starts=sorted(x[1] for x in spans))
    for i, c in enumerate(cues):
        tag = ('cue', i); parts, special = cue_parts(c, cues, DUR, st)
        if special == 'gate': continue
        if special == 'major': continue                                                # compose_major (music().majorFrom)
        if special == 'final_chord': R.compose_final(M, c['t'], tag); continue
        if special == 'bonzini_sig':                                                   # the series signature, unchanged
            g = c.get('g', 1)
            M.put('brand', A.balafon_bright(88, 5800, 1.2), c['t'], .17 * g, -.15, tag=tag)
            M.put('brand', A.balafon_bright(92, 5801, 1.0), c['t'] + SIG_GAP, .18 * g, .15, tag=tag)
            M.put('brand', A._bell(m2f(100), .8, .3, 1, .002) * .5, c['t'] + SIG_GAP, .06 * g, .15, tag=tag)
            plan['sig'] = (c['t'], c['t'] + SIG_GAP); continue
        if parts is None: unknown.append(c['name']); continue
        if special and special.startswith('family'): famd.append(f"{c['name']}~{special[7:]}")
        lvl = LVL.get(c['name'], LVL_UNKNOWN)
        levels[i] = put_cue(M, c, tag, parts, lvl, fade=c['name'] not in ('riser',))
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

def mixdown(st, dry_vox, sc, spans, t_back, t_dry):
    """stems -> ducked stems + premaster (N = DUR exactly); the head (before tenseFrom), the music hole (cut -> next music)
    and the dry end are applied AFTER every filter so they stay digital silence"""
    DUR, mp = sc['dur'], sc['music']; N = ns(DUR)
    d1, act = R.duck_db(dry_vox[:N], [(a, b) for _, a, b in spans])
    st = {k: v[:N].copy() for k, v in st.items()}
    for k, depth in DUCKED.items(): st[k] *= dsp.undb(d1 * depth)[:, None]
    for k in ('groove', 'brand'): st[k] = R.carve(st[k], d1, R.CARVE_DB)
    hole = R.gate(N, mp['cut'], t_on=t_back)
    dry = R.gate(N, t_dry, fade=.012)
    head = np.ones(N); head[:ns(mp['tenseFrom'])] = 0.0                     # the zero-phase carve pre-rings a few 1e-3
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

def grid_rows(sc, plan, M):
    """every musical hit vs the grid in force"""
    rows = []
    def row(nm, tc, gname, a, bt):
        if tc is None or a is None: return
        x = (tc - a) / bt; k = round(x); k16 = round(x * 4) / 4
        rows.append(dict(name=nm, t=tc, grid=gname, beat=a + k * bt, err=(x - k) * bt * 1000, err16=(x - k16) * bt * 1000))
    for s in plan['segs']: row(f"{s['role']} re-entry", s['a'], f"tense #{s['k']}", s['a'], s['beat'])
    s_last = plan['segs'][-1]
    for x in plan['tags']['tags']: row('tag_stamp', x, f"tense #{s_last['k']} (break)", s_last['a'], BEAT)
    f = plan['fiche']
    for c in sc['cues']:
        if c['name'] == 'clac' and f['a'] - 1e-6 <= c['t'] < (f['stop'] + BRK): row('clac (line)', c['t'], 'fiche', f['a'], BEAT)
    if f.get('sample'): row('ÉCRIS TOUT stamp', f['sample'], 'sample (anchor)', f['sample'], BEAT)
    b = plan.get('brand')
    if b:
        for nm, tc in (('sig note 1', plan.get('sig', (None,))[0]), ('sig note 2', plan.get('sig', (None, None))[1]),
                       ('violet re-entry', b['re_entry']), ('end card', b['card'])):
            row(nm, tc, 'violet', b['v0'], BEAT)
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
    sc = score(); T, DUR, mp = sc['T'], sc['dur'], sc['music']; N = ns(DUR)
    lines, vstatus = voice_plan(sc)
    log(f'[E3] score: {sc["src"]} · {len(sc["cues"])} cues · DUR {DUR} s · timing: '
        f'{"data/timing.json" if os.path.exists(TIMING_JSON) else "the score DEFAULTS (no data/timing.json)"}')
    log(f'[E3] music plan: {json.dumps({k: (round(v, 3) if isinstance(v, float) else v) for k, v in mp.items()})}')
    log(f'[E3] voices: {vstatus}' + ('' if lines else ' -> MUSIC + SFX ONLY (the music is still ducked on the score\'s planned speech spans)'))
    M, vinfo, unknown, famd, plan, spans = compose(sc, lines, vstatus)
    if unknown: log('[E3] WARNING cue names without any sound (listed in the report):', unknown)
    if famd: log('[E3] WARNING cue names played by their family\'s sound:', famd)
    log(f'[E3] {len(M.ev)} events · rendering')
    st, dry_vox = render(M, sc)
    seg_rows = []
    for s in plan['segs']:
        ne = sum(1 for ev in M.ev if ev[6] == ('seg', s['k']) or (s['k'] == 0 and ev[6] == 'music_in'))
        seg_rows.append(dict(s, events=ne, rate=ne / max(1e-3, s['e'] - s['a']), lufs=float(dsp.lufs_integrated(st['groove'][ns(s['a']):ns(s['e'])]))))
    t_back = min((e[2] for e in M.ev if e[0] in MUSIC and not e[5] and e[2] > mp['cut']), default=DUR)
    t_dry = plan['end']['dry']
    pre = {k: v[:N].copy() for k, v in st.items()}
    st, P, d1, act = mixdown(st, dry_vox, sc, spans, t_back, t_dry)
    proj = None
    if vinfo: Y, g, gl, ceil = master_tp(P)
    else:
        # NO VOICES: the master (gain + limiter) is computed on music + SFX + a speech-shaped placeholder at -18 LUFS per line
        # on the planned spans — the chain the film will get with its voices — and mix.wav = the music + SFX share of it
        # (an M&E at the final balance). Normalising the M&E alone to -14 LUFS would add ≈ +18 dB and 20 dB of limiting.
        PH = placeholder_voice(N, spans)
        Yf, g, gl, ceil = master_tp(P + PH)
        Y = dsp.butter(P, 'hp', 28, 2) * dsp.undb(g) * gl[:, None]
        import pyloudnorm as _pl
        proj = dict(lufs=_pl.Meter(SR).integrated_loudness(Yf), tp_dbtp=R.true_peak_db(Yf), max_gr_db=float(-20 * np.log10(gl.min())),
                    note='music + SFX + speech-shaped placeholder (-18 LUFS per planned line) through the same master')
        del Yf, PH
    assert len(Y) == N
    os.makedirs(os.path.join(OUT_A, 'stems'), exist_ok=True)
    dsp.save(os.path.join(OUT_A, 'mix.wav'), Y, 'PCM_24')
    G = dsp.undb(g)
    stems = {'vox': st['vox'], 'music': sum(st[k] for k in MUSIC), 'sfx': st['sfx'], 'hits': st['hit'], 'amb': st['amb']}
    for k, v in stems.items(): dsp.save(os.path.join(OUT_A, 'stems', f'{k}.wav'), v * G, 'FLOAT')
    for k in ('asmr',):                                                    # ep2-only stem names left by a copy: never stale files
        p = os.path.join(OUT_A, 'stems', f'{k}.wav')
        if os.path.exists(p): os.remove(p)
    # ---------------- checks ----------------
    Z, sr = sf.read(os.path.join(OUT_A, 'mix.wav')); meter = pyln.Meter(SR)
    rep = dict(sr=sr, n=len(Z), dur=len(Z) / sr, channels=Z.shape[1], master_gain_db=g, limiter_ceiling_db=ceil,
               lufs=meter.integrated_loudness(Z), tp_dbtp=R.true_peak_db(Z), sample_peak_db=20 * math.log10(np.abs(Z).max()),
               max_gr_db=float(-20 * np.log10(gl.min())), max_gr_t=float(np.argmin(gl) / SR), clipped=int((np.abs(Z) >= .9999).sum()), src=sc['src'], lra=R.lra(Z),
               dc=[float(Z[:, 0].mean()), float(Z[:, 1].mean())], unknown=unknown, family=famd, voices_status=vstatus,
               voiced=bool(vinfo), timing='data/timing.json' if os.path.exists(TIMING_JSON) else 'score defaults',
               music_plan={k: v for k, v in mp.items()}, T=T, DUR=sc.get('DUR'),
               master_mode='full mix -> -14 LUFS' if vinfo else 'M&E at the projected final gain (no voices)', projected=proj)
    rep['seam'] = dict(step=float(np.abs(Z[0] - Z[-1]).max()), local_p99=float(np.percentile(np.abs(np.diff(Z[-ns(.03):], axis=0)), 99)),
                       head_5ms_peak=float(np.abs(Z[:ns(.005)]).max()), tail_20ms_peak=float(np.abs(Z[-ns(.02):]).max()))
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
            post = float(np.abs(seg_).max()) if len(seg_) else 0.0
            rows.append(dict(t=t, name=name, kind='music off -60dB', on=off, err=None if off is None else (off - t) * 1000, mix=None, mix_err=None,
                             lvl=None, lu=None, note=f'music max |x| after = {post:.1e}'))
            continue
        tag = 'major_in' if name == 'major' else ('cue', i)
        o, _ = R.iso_onset(M, tag)
        if o is None: rows.append(dict(t=t, name=name, kind='-', on=None, err=None, mix=None, mix_err=None, lvl=None, lu=None,
                                       note='NO SOUND (unknown name)' if name in unknown else 'no event')); continue
        f = A.flux_onset(Z, t); lv = cue_level(M, tag); lv_post = None if lv is None else lv + g
        rows.append(dict(t=t, name=name, kind='alone', on=o, err=(o - t) * 1000, mix=f, mix_err=None if f is None else (f - t) * 1000,
                         lvl=lv_post, lu=None if lv is None else lv - VOX_REF, note='major_in (music().majorFrom)' if name == 'major' else ''))
    for tag, tref, note in (('music_in', mp['tenseFrom'], 'music().tenseFrom'), ('rise_in', mp['riseFrom'], 'music().riseFrom'),
                            ('fiche_in', mp['balafonFrom'], 'music().balafonFrom'), ('sample_in', plan['fiche'].get('sample'), 'band ON « ÉCRIS TOUT »'),
                            ('brand_in', plan['brand']['re_entry'], 'violet pulse re-entry'),
                            ('arrival_A', plan['end']['card'], 'A arrival = end card'), ('hit2_band', plan['end']['hit2'], 'band back ON the ritual stamp'),
                            ('stop', plan['end']['stop'], f"E accent ({plan['end']['accent']})")):
        if tref is None: continue
        o, _ = R.iso_onset(M, tag)
        if o is None: continue
        f = A.flux_onset(Z, tref); lv = cue_level(M, tag)
        rows.append(dict(t=tref, name=tag, kind='alone', on=o, err=(o - tref) * 1000, mix=f, mix_err=None if f is None else (f - tref) * 1000,
                         lvl=None if lv is None else lv + g, lu=None if lv is None else lv - VOX_REF, note=note))
    for s in plan['segs'][1:]:
        o, _ = R.iso_onset(M, ('seg', s['k']))
        rows.append(dict(t=s['a'], name=f"{s['role']}_in", kind='alone', on=o, err=None if o is None else (o - s['a']) * 1000,
                         mix=None, mix_err=None, lvl=None, lu=None, note='stop-time re-entry'))
    if plan.get('sig'):                                                    # the signature's 2nd note (not a separate cue)
        s2 = plan['sig'][1]; evs = [e for e in M.ev if e[6] and e[6][0] == 'cue' and abs(e[2] - s2) < 1e-9]
        f = A.flux_onset(Z, s2)
        rows.append(dict(t=s2, name='sig note 2', kind='placed', on=evs[0][2] if evs else None, err=0.0 if evs else None, mix=f,
                         mix_err=None if f is None else (f - s2) * 1000, lvl=None, lu=None, note='G#6, SIG_GAP after note 1'))
    kp = [e for e in M.ev if e[6] == 'key_pad']
    if kp: rows.append(dict(t=plan['fiche']['key'], name='key pad', kind='placed', on=min(e[2] for e in kp),
                            err=(min(e[2] for e in kp) - plan['fiche']['key']) * 1000, mix=None, mix_err=None, lvl=None, lu=None,
                            note='suspended E pad (slow swell: placement, not onset)'))
    rep['cues'] = rows
    rep['cues_ok'] = all(r['err'] is not None and abs(r['err']) <= 15 for r in rows if r['name'] not in unknown)
    rep['grid'] = grid_rows(sc, plan, M); rep['segments'] = seg_rows
    rep['plan'] = plan
    # voices (real) or planned spans: never two voices at once
    sp = sorted(spans, key=lambda x: x[1]); ov = []
    for (i1, a1, b1), (i2, a2, b2) in zip(sp, sp[1:]):
        if a2 < b1 - 1e-6: ov.append(dict(a=i1, b=i2, overlap=b1 - a2, two_speakers=speaker(i1) != speaker(i2)))
    gaps = [a2 - b1 for (_, _, b1), (_, a2, _) in zip(sp, sp[1:])]
    rep['speech'] = dict(src=plan['spans_src'], spans=[dict(id=i, on=a, off=b, who=speaker(i)) for i, a, b in sp], overlaps=ov,
                         min_gap=min(gaps) if gaps else None, two_voices_at_once=any(o_['two_speakers'] for o_ in ov))
    vrows = []; prev = None
    for v in vinfo:
        a, b = ns(v['film_on']), ns(v['film_off'])
        ev = R.env_db(vox, .01); seg = ev[ns(v['t0']):ns(v['t1'])]; thr = seg.max() * 10 ** (-30 / 20)
        nzi = np.nonzero(seg > thr)[0]; m_on, m_off = v['t0'] + nzi[0] / SR, v['t0'] + nzi[-1] / SR
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
        vrows.append(dict(id=v['id'], who=speaker(v['id']), file=v['file'], at=v['at'], stretch=v['stretch'], t0=v['t0'], t1=v['t1'],
                          on=v['film_on'], off=v['film_off'], T=T.get(v['id']), m_on=m_on, m_off=m_off, margin=margin, no_music=no_music,
                          margin_all=margin_all, word_min=min((x[1] for x in wm), default=None), word_min_all=min((x[2] for x in wm), default=None),
                          word_worst=min(wm, key=lambda x: x[2])[0] if wm else None, words_checked=len(wm), words_pause=nskip,
                          gap=None if prev is None else v['t0'] - prev['t1'], speech_gap=None if prev is None else v['film_on'] - prev['film_off'],
                          phone=10 * math.log10(R.kpow(vox_ph, a, b) / R.kpow(oth_ph, a, b)),
                          phone_word_min=min((x[3] for x in wm), default=None), phone_word=min(wm, key=lambda x: x[3])[0] if wm else None,
                          lufs=float(dsp.lufs_integrated(vox[ns(v['t0']):ns(v['t1'])])), deess=v['deess_max_db'], words_m=wm))
        prev = v
    rep['voices'] = vrows
    rep['voices_overlap'] = bool(ov)
    rep['voices_ok'] = bool(vinfo) and (not ov) and all(r['margin'] >= 10 for r in vrows)
    # loud cues vs the words (RULE P1) / the speech spans
    wa_ = words_abs(sc, vinfo); lrows = []
    for c in sc['cues']:
        if c['name'] not in LOUD: continue
        inw = [f'{w} ({i})' for i, w, s, e in wa_ if s + .01 < c['t'] < e - .01]
        insp = [i for i, a, b in spans if a + .01 < c['t'] < b - .01]
        lrows.append(dict(t=c['t'], name=c['name'], in_word=inw[0] if inw else None, in_span=insp[0] if insp else None))
    mrows = []                                                             # the music's own entries (band re-entries, arrivals)
    for tag, tm_ in (('music_in', mp['tenseFrom']), ('order_in', plan['segs'][1]['a'] if len(plan['segs']) > 1 else None),
                     ('rise_in', mp['riseFrom']), ('fiche_in', mp['balafonFrom']), ('sample_in', plan['fiche'].get('sample')),
                     ('major_in', mp['majorFrom']), ('brand_in', plan['brand']['re_entry']), ('arrival_A', plan['end']['card']),
                     ('hit2_band', plan['end']['hit2']), ('stop', plan['end']['stop'])):
        if tm_ is None: continue
        inw = [f'{w} ({i})' for i, w, s_, e in wa_ if s_ + .01 < tm_ < e - .01]; insp = [i for i, a, b in spans if a + .01 < tm_ < b - .01]
        mrows.append(dict(t=tm_, name=tag, in_word=inw[0] if inw else None, in_span=insp[0] if insp else None))
    rep['loud_vs_words'] = dict(words_src=('none (no word times)' if not wa_ else ('takes (vocheck)' if vinfo else 'timing.json words')),
                                rows=lrows, inside_words=[r for r in lrows if r['in_word']], music=mrows)
    # silences, levels
    a_, b_ = ns(mp['cut']), ns(t_back)
    rep['cut'] = dict(t=mp['cut'], t_back=t_back, rise_from=mp['riseFrom'], back_err_ms=(t_back - mp['riseFrom']) * 1000,
                      music_max=float(np.abs(mus[a_:b_]).max()) if b_ > a_ else 0.0,
                      music_pre_rms_db=20 * math.log10(np.sqrt(np.mean(mus[max(0, a_ - ns(.5)):a_] ** 2)) + 1e-12),
                      mix_rms_db=20 * math.log10(np.sqrt(np.mean(Z[a_:b_] ** 2)) + 1e-12),
                      amb_rms_db=20 * math.log10(np.sqrt(np.mean((stems['amb'] * G)[a_:b_] ** 2)) + 1e-12))
    rep['dry'] = dict(t=t_dry, music_max_after=float(np.abs(mus[ns(t_dry):]).max()))
    rep['silent_head'] = dict(until=mp['silentUntil'], music_max=float(np.abs(mus[:ns(mp['silentUntil'])]).max()))
    rep['digital_silence_ok'] = rep['silent_head']['music_max'] == 0 and rep['cut']['music_max'] == 0 and rep['dry']['music_max_after'] == 0
    rep['duck_max_db'] = float(-d1.min() * DUCK_DB)
    rep['final_after_speech_ms'] = (plan['end']['final'] - max((b for _, a, b in spans), default=0)) * 1000
    lev = {}
    for k, v in stems.items():
        x = v * G; li = float(dsp.lufs_integrated(x)) if np.abs(x).max() > 0 else None
        _, lm = dsp.lufs_momentary(x, .05); lev[k] = dict(lufs_int=li, lufs_m_max=float(lm.max()) if len(lm) else None,
                                                          peak_dbfs=20 * math.log10(np.abs(x).max() + 1e-12))
    rep['stem_levels_post_master'] = lev
    sec = {}                                                               # music level per section (un-ducked groove+brand, pre-master)
    for nm, a0, a1 in (('tense', mp['tenseFrom'], mp['cut']), ('rise', mp['riseFrom'], mp['balafonFrom']),
                       ('fiche+sample', mp['balafonFrom'], plan['fiche']['key']), ('key', plan['fiche']['key'], mp['majorFrom']),
                       ('major', mp['majorFrom'], mp['sigAt']), ('brand', mp['sigAt'], plan['end']['card']),
                       ('end', plan['end']['card'], plan['end']['final'])):
        x = (pre['groove'] + pre['brand'] + pre['final'])[ns(a0):ns(a1)]
        sec[nm] = dict(a=a0, b=a1, lufs_premaster=float(dsp.lufs_integrated(x)) if len(x) > ns(.4) and np.abs(x).max() > 0 else None)
    rep['music_sections'] = sec
    # report
    log(f'[E3] mix.wav {rep["n"]} samples = {rep["dur"]:.6f} s @ {sr} Hz x{rep["channels"]} · {rep["lufs"]:.2f} LUFS · TP {rep["tp_dbtp"]:.2f} dBTP · '
        f'sample peak {rep["sample_peak_db"]:.2f} dBFS · LRA {fm(rep["lra"], ".1f")} LU · master {g:+.2f} dB · limiter max GR '
        f'{rep["max_gr_db"]:.1f} dB @ {rep["max_gr_t"]:.2f} s (ceiling {ceil:.2f}) · clipped {rep["clipped"]} · {rep["master_mode"]}')
    if proj: log(f'[E3] PROJECTED final (with voice-shaped placeholder): {proj["lufs"]:.2f} LUFS · TP {proj["tp_dbtp"]:.2f} dBTP · limiter max GR '
                 f'{proj["max_gr_db"]:.1f} dB')
    log('[E3] cues (alone = the cue\'s own events rendered alone, 10 % of the max of a 1-ms envelope; mix = spectral-flux onset in mix.wav; '
        'LUFS-M = the cue alone, post master gain; LU = pre-master re a voice line at -18 LUFS)')
    for r in rows:
        log(f'    {r["t"]:7.3f}  {r["name"]:16s} {r["kind"]:15s} {fm(r["err"], "+6.1f", "   -  ", " ms")}   mix {fm(r["mix_err"], "+6.1f", "   -  ", " ms")}'
            f'   {fm(r["lvl"], "6.1f", "    - ", " LUFS-M")} {fm(r["lu"], "+6.1f", "    - ", " LU")}  {r["note"]}')
    log(f'[E3] cues within 15 ms: {rep["cues_ok"]}')
    log('[E3] tense segments: ' + ' · '.join(f'#{r["k"]} {r["role"]} {r["a"]:.3f}-{r["e"]:.3f} {r["rate"]:.0f} ev/s {r["lufs"]:.1f} LUFS' for r in seg_rows)
        + f' · break {plan["tags"]["brk"]:.3f} -> cut {mp["cut"]:.3f} (tags {", ".join(f"{x:.2f}" for x in plan["tags"]["tags"])})')
    log('[E3] grid: ' + ' · '.join(f'{x["name"]}@{x["t"]:.3f} [{x["grid"]}] {x["err"]:+.0f} (16th {x["err16"]:+.0f}) ms' for x in rep['grid']))
    log('[E3] music sections (groove+brand+final, pre-master, un-ducked): ' + ' · '.join(
        f'{k} {v["a"]:.2f}-{v["b"]:.2f} {fm(v["lufs_premaster"], ".1f")}' for k, v in sec.items()))
    log('[E3] stems (post master): ' + ' · '.join(f'{k} {fm(v["lufs_int"], ".1f")} LUFS / max-M {fm(v["lufs_m_max"], ".1f")} / pk {v["peak_dbfs"]:.1f}'
                                                 for k, v in lev.items()))
    if vinfo:
        log('[E3] voices')
        for r in vrows:
            log(f'    {r["id"]:4s} {r["file"]:11s} speech {r["on"]:7.3f}-{r["off"]:7.3f} (T {r["T"]}) · over music '
                f'{"no music" if r["no_music"] else format(r["margin"], "5.1f") + " dB"} (worst word {fm(r["word_min"], ".1f")}) · over all '
                f'{r["margin_all"]:5.1f} dB (worst {r["word_worst"]} {fm(r["word_min_all"], ".1f")}) · phone {r["phone"]:5.1f} (worst {r["phone_word"]} '
                f'{fm(r["phone_word_min"], ".1f")}) · gap {fm(r["gap"], ".3f")} · {r["lufs"]:.1f} LUFS')
        if '--words' in sys.argv:
            for r in vrows: log(f'    {r["id"]}: ' + ' '.join(f'{w}[{a:+.0f}/{b:+.0f}/{c:+.0f}]' for w, a, b, c in r['words_m']))
        log(f'[E3] all >= 10 dB over the music: {all(r["margin"] >= 10 for r in vrows)}')
    log(f'[E3] speech ({rep["speech"]["src"]}): overlaps {len(ov)} · two voices at once: {rep["speech"]["two_voices_at_once"]} · '
        f'min gap {fm(rep["speech"]["min_gap"], ".3f")} s')
    lv_ = rep['loud_vs_words']
    log(f'[E3] loud cues vs words ({lv_["words_src"]}): inside a word: {[(round(r["t"], 2), r["name"], r["in_word"]) for r in lv_["inside_words"]] or "none"}'
        f' · inside a speech span: {[(round(r["t"], 2), r["name"], r["in_span"]) for r in lv_["rows"] if r["in_span"]] or "none"}'
        f' · music entries in speech (ducked): {[(round(r["t"], 2), r["name"], r["in_word"] or r["in_span"]) for r in lv_["music"] if r["in_span"]] or "none"}')
    log(f'[E3] head silent until {mp["silentUntil"]:.3f}: music max |x| {rep["silent_head"]["music_max"]:.1e} · cut at {mp["cut"]:.3f}: music max |x| '
        f'{rep["cut"]["music_max"]:.1e} until the next music at {t_back:.3f} (riseFrom {mp["riseFrom"]:.3f}, {rep["cut"]["back_err_ms"]:+.1f} ms; pre-cut '
        f'{rep["cut"]["music_pre_rms_db"]:.1f} dBFS RMS; mix in the hole {rep["cut"]["mix_rms_db"]:.1f}, room {rep["cut"]["amb_rms_db"]:.1f} dBFS RMS) · '
        f'after cut_dry {t_dry:.3f}: music max {rep["dry"]["music_max_after"]:.1e} · final chord {rep["final_after_speech_ms"]:+.0f} ms after the last speech')
    log(f'[E3] loop seam (end -> start): step {rep["seam"]["step"]:.4f} vs local p99 {rep["seam"]["local_p99"]:.4f} · first 5 ms peak '
        f'{rep["seam"]["head_5ms_peak"]:.4f} · last 20 ms peak {rep["seam"]["tail_20ms_peak"]:.4f}')
    if plan.get('birds') is not None: log(f'[E3] birds at {plan["birds"]}')
    try: json.dump(rep, open(REPORT, 'w'), indent=1, default=lambda o: float(o) if isinstance(o, (np.floating, np.integer)) else str(o))
    except Exception as e: log(f'[E3] WARNING report not written: {e}')
    if sheet: make_sheet(Z, stems, G, d1, rep, sc, vinfo, plan, M, spans)
    return rep

# =====================================================================================================================
# gallery: every cue sound once, at its level
# =====================================================================================================================
def gallery():
    sc = score(); cues = sc['cues']; seen = []; out = []
    st = dict(voice_starts=[]); t = .3
    names = []
    for c in cues:
        if c['name'] not in names: names.append(c['name'])
    M = R.Mix(len(names) * 1.2 + 3)
    for nm in names:
        c = dict(next(x for x in cues if x['name'] == nm)); c['t'] = t
        parts, special = cue_parts(c, cues, sc['dur'], st)
        if parts:
            put_cue(M, c, ('g', nm), parts, LVL.get(nm, LVL_UNKNOWN)); seen.append((round(t, 2), nm)); t += max(.7, max(len(p[1]) for p in parts) / SR * .8)
        elif special == 'bonzini_sig':
            M.put('brand', A.balafon_bright(88, 5800, 1.2), t, .17, -.15); M.put('brand', A.balafon_bright(92, 5801, 1.0), t + SIG_GAP, .18, .15)
            seen.append((round(t, 2), nm)); t += 1.2
        elif special == 'final_chord': R.compose_final(M, t, None); seen.append((round(t, 2), nm)); t += 1.2
    buf = np.zeros((ns(t + 1), 2))
    for stem, sig, t0, g, p, c, tag in M.ev: R.place_at(buf, R.stereo_of(sig, g, p), ns(t0))
    buf = buf * dsp.undb(-14 - dsp.lufs_integrated(buf)); buf, _ = dsp.limiter(buf, ceiling_db=-1.5)
    dsp.save(GALLERY, buf, 'PCM_24')
    log(f'[E3] gallery -> {GALLERY}: ' + ' · '.join(f'{a} {b}' for a, b in seen))

# =====================================================================================================================
# sheet
# =====================================================================================================================
def make_sheet(Z, stems, G, d1, rep, sc, vinfo, plan, M, spans, path=SHEET):
    import matplotlib; matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import scipy.signal as sps
    T, DUR, mp, cues = sc['T'], sc['dur'], sc['music'], sc['cues']
    plt.rcParams.update({'font.size': 8, 'axes.facecolor': '#120d1e', 'figure.facecolor': '#0b0814', 'text.color': '#e8e2f4',
                         'axes.labelcolor': '#e8e2f4', 'xtick.color': '#b9b0cc', 'ytick.color': '#b9b0cc', 'axes.edgecolor': '#3a3050'})
    fig = plt.figure(figsize=(22, 34), dpi=100)
    fig.subplots_adjust(top=.955, bottom=.01, left=.045, right=.965)
    gs = fig.add_gridspec(9, 12, height_ratios=[3.4, 1.0, 2.3, 1.55, 1.7, 1.7, 1.35, 1.75, 1.9], hspace=.5, wspace=.5)
    hot = {'boum': '#ff5a5a', 'stamp_big': '#ff5a5a', 'carton_thud': '#ff5a5a', 'stamp': '#ff8a3a', 'tag_stamp': '#ff8a3a',
           'metal_set': '#ff8a3a', 'card_flop': '#ff8a3a', 'tonk': '#ff8a3a', 'clac': '#ffb24a', 'balafon_note': '#ffd84a',
           'tap': '#7fffd4', 'crack': '#7fffd4', 'clink': '#7fffd4', 'bonzini_sig': '#b48cff', 'violet_hum': '#b48cff',
           'label_slap': '#b48cff', 'final_chord': '#ffd84a', 'major': '#ffd84a', 'music_cut': '#3ee0ff', 'cut_dry': '#3ee0ff'}
    ccol = lambda nm: hot.get(nm, '#9fe08a')
    vcol = lambda lid: '#ffb24a' if speaker(lid) == 'T' else ('#7fd4ff' if speaker(lid) == 'C' else '#e8e2f4')
    xt = np.arange(0, DUR + .01, 2.0); m = Z.mean(1); voiced = bool(vinfo)
    def marks(ax, labels=False):
        ax.axvspan(mp['cut'], rep['cut']['t_back'], color='#3ee0ff', alpha=.06)
        for c in cues: ax.axvline(c['t'], ymin=.94 if labels else 0, ymax=1, color=ccol(c['name']), lw=.9, alpha=.9 if labels else .22)
    def spec(ax, x, a0, a1, nper, top_pct, rng_db, fl):
        f, t, S_ = sps.stft(x, SR, nperseg=nper, noverlap=nper - nper // 16)
        P_ = 20 * np.log10(np.abs(S_) + 1e-9); rr = np.interp(fl, f, np.arange(len(f))); Pi = P_[np.round(rr).astype(int)]; top = np.percentile(Pi, top_pct)
        ax.pcolormesh(t + a0, fl, Pi, vmin=top - rng_db, vmax=top, cmap='magma', shading='auto'); ax.set_yscale('log'); ax.set_ylim(fl[0], fl[-1]); ax.set_xlim(a0, a1)
    # 1 spectrogram
    ax = fig.add_subplot(gs[0, :])
    spec(ax, m, 0, DUR, 4096, 99.8, 85, np.geomspace(30, 18000, 420)); ax.set_xticks(xt); ax.set_ylabel('Hz')
    ax.set_title('mix.wav — log spectrogram · cue ticks + names (top) · speech spans (bottom bars: amber = TOI, white = narrator'
                 + ('' if voiced else '; PLANNED spans, NO VOICE IN THIS MIX') + ') · cyan = music TOTAL cut (cut -> next music) · gold ticks = musical anchors',
                 loc='left', pad=78)
    marks(ax, True)
    for c in cues: ax.text(c['t'], 19500, c['name'], rotation=90, fontsize=5.6, va='bottom', ha='center', color=ccol(c['name']))
    for i, a, b in spans:
        ax.plot([a, b], [36, 36], color=vcol(i), lw=6, solid_capstyle='butt', alpha=1 if voiced else .5)
        ax.text((a + b) / 2, 41, i, ha='center', fontsize=7.5, color='w')
    e_ = plan['end']
    lab = [(0, 'no music: tear · pouf · whistle · BOUM'), (mp['tenseFrom'], 'TENSE F#m stop-time'), (plan['tags']['brk'], 'tags'),
           (mp['cut'], 'CUT · cricket · pffuit · mock'), (mp['riseFrom'], 'rise'), (mp['balafonFrom'], 'MORNING fiche (D|E)'),
           (plan['fiche'].get('sample') or mp['balafonFrom'] + 3, 'sample'), (plan['fiche']['key'], 'KEY (E sus)'), (mp['majorFrom'], 'A MAJOR'),
           (mp['sigAt'], 'sig · violet'), (e_['card'], 'A makossa · end card'), (e_['final'], 'final')]
    for k, (x0, lb) in enumerate(lab): ax.text(x0 + .05, 60 if k % 2 == 0 else 78, lb, fontsize=7.2, color='w', alpha=.9)
    anchors = [s['a'] for s in plan['segs']] + [mp['riseFrom'], mp['balafonFrom'], mp['majorFrom'], plan['brand']['v0'], e_['card']] + \
              [x for x in (plan['fiche'].get('sample'), e_['hit2']) if x]
    for a in anchors: ax.axvline(a, ymin=0, ymax=.05, color='#ffd84a', lw=1.6)
    # 2 waveform
    ax = fig.add_subplot(gs[1, :]); tw = np.arange(len(m)) / SR
    ax.plot(tw, Z[:, 0], lw=.25, color='#c9b6ff'); ax.plot(tw, -np.abs(Z[:, 1]), lw=.25, color='#ffb24a', alpha=.6)
    ax.set_xlim(0, DUR); ax.set_ylim(-1, 1); ax.set_xticks(xt)
    for s in (1, -1): ax.axhline(s * 10 ** (-1 / 20), color='r', lw=.5, ls='--')
    ax.set_title(f'waveform (L up / |R| down) · ±1 dBFS lines · TP {rep["tp_dbtp"]:.2f} dBTP · sample peak {rep["sample_peak_db"]:.2f} dBFS', loc='left'); marks(ax)
    # 3 levels
    ax = fig.add_subplot(gs[2, :])
    def mom(x, hop=.02): tm, lm = dsp.lufs_momentary(x, hop); return tm, np.maximum(lm, -80)
    for x, lb, col, lw in ((Z, 'mix', '#ffffff', 1.2), (stems['vox'] * G, 'voices', '#ffb24a', 1.0), (stems['music'] * G, 'music (ducked)', '#3ee0ff', 1.0),
                           (stems['sfx'] * G, 'sfx', '#9fe08a', .8), (stems['hits'] * G, 'impacts', '#ff5a5a', .9), (stems['amb'] * G, 'room + birds + cricket', '#7f9f6a', .7)):
        if np.abs(x).max() == 0: continue
        tm, lm = mom(x); ax.plot(tm, lm, color=col, lw=lw, label=lb)
    ts, ls = dsp.lufs_shortterm(Z, .05); ax.plot(ts, ls, color='#ffd84a', lw=1, ls='--', label='mix short-term (3 s)')
    for i, a, b in spans: ax.axvspan(a, b, color=vcol(i), alpha=.08)
    for r in rep['voices']:
        txt = 'no\nmusic' if r['no_music'] else f'+{r["margin"]:.1f}'
        ax.text((r['on'] + r['off']) / 2, -5, f'{r["id"]}\n{txt}', ha='center', va='top', fontsize=7.5,
                color='#9fe08a' if (r['no_music'] or r['margin'] >= 10) else '#ff5a5a')
    ax.set_xlim(0, DUR); ax.set_ylim(-75, -2); ax.set_xticks(xt); ax.axhline(-14, color='w', lw=.5, ls=':')
    ax2 = ax.twinx(); ax2.plot(np.arange(len(d1))[::240] / SR, d1[::240] * DUCK_DB, color='#ff7ad9', lw=1, label='music duck (dB)')
    ax2.set_ylim(-40, 2); ax2.set_ylabel('duck dB', color='#ff7ad9')
    ax.legend(loc='lower left', ncol=7, fontsize=7, facecolor='#120d1e'); ax2.legend(loc='lower right', fontsize=7, facecolor='#120d1e')
    ax.set_title(f'momentary loudness (400 ms) per stem, post master gain, pre-limiter · integrated {rep["lufs"]:.2f} LUFS'
                 + ('' if voiced else f' · NO VOICES: M&E at the projected final gain {rep["master_gain_db"]:+.1f} dB, the duck follows the PLANNED spans '
                                      f'(projected final {rep["projected"]["lufs"]:.2f} LUFS, TP {rep["projected"]["tp_dbtp"]:.2f})'), loc='left'); marks(ax)
    # 4 envelope zooms
    key, mj = plan['fiche']['key'], mp['majorFrom']
    zs = [(mp['cut'] - .9, mp['cut'] + .45, f'the tags\' break + TOTAL cut at music().cut = {mp["cut"]:.3f}: music (cyan) vs mix (white)', 'cut'),
          (key - .2, mj + .6, f'the key moment {key:.2f} -> ✓ {mj:.2f}: taps, cracks, clinks (sfx) over the E pad; the A arrival', 'key'),
          (DUR - 1.2, DUR, f'final chord {e_["final"]:.2f} · cut_dry {e_["dry"]:.3f} · the loop seam', 'end')]
    for j, (a0, a1, title, kind) in enumerate(zs):
        ax = fig.add_subplot(gs[3, 4 * j:4 * j + 4]); a, b = ns(max(0, a0)), min(len(Z), ns(a1)); xs = np.arange(a, b) / SR
        e = lambda x: 20 * np.log10(R.env_db(x[a:b], .002) + 1e-9)
        ax.plot(xs, e(Z), color='#ffffff', lw=.8, label='mix'); ax.plot(xs, e(stems['music'] * G), color='#3ee0ff', lw=.9, label='music')
        ax.plot(xs, e(stems['amb'] * G), color='#7f9f6a', lw=.7, label='room')
        if kind in ('key', 'cut'): ax.plot(xs, e((stems['sfx'] + stems['hits']) * G), color='#ff5a5a', lw=.7, label='sfx+hits')
        if kind == 'cut': ax.axvline(mp['cut'], color='#3ee0ff', lw=1.2)
        if kind == 'end': ax.axvline(e_['dry'], color='#3ee0ff', lw=1.2)
        ax.set_ylim(-110, 0); ax.set_xlim(a0, a1); ax.set_title(title, loc='left', fontsize=7.5); ax.legend(fontsize=6.5, facecolor='#120d1e', ncol=2)
        ax.set_ylabel('dBFS (2-ms RMS)')
    # 5 zoom spectrograms (2 rows of 3)
    zz = [(0.0, mp['tenseFrom'] + .8, 'opening: tear · pouf · land · whistle · BOUM · marbles · skitter · music in'),
          (mp['tenseFrom'] + .5, mp['cut'] + .3, 'meme fold · QUI A TORT pop · steel set · ding · order card · tags in the break · CUT'),
          (mp['cut'] - .2, mp['balafonFrom'] + .6, 'the cut: cricket · pffuit · mock guitar · carton out · riser · the rise'),
          (mp['balafonFrom'] - .3, (plan['fiche'].get('sample') or mp['balafonFrom'] + 3) + 1.0, 'the fiche: clac + balafon note + felt + tic ×4 · ÉCRIS TOUT · note'),
          (key - 1.6, mj + 1.2, 'pareil · sparkle · KEY: whoosh · thud · boing · taps/cracks · clinks B6 G#6 E6 · ✓ + A major'),
          (mp['sigAt'] - .4, DUR, 'signature · violet · label · gloups · end card · CTA · ritual stamp · final · dry cut')]
    for j, (a0, a1, title) in enumerate(zz):
        ax = fig.add_subplot(gs[4 + j // 3, 4 * (j % 3):4 * (j % 3) + 4]); a, b = ns(max(0, a0)), min(len(m), ns(a1))
        spec(ax, m[a:b], a / SR, b / SR, 2048, 99.7, 80, np.geomspace(40, 16000, 300))
        for c in cues:
            if a0 <= c['t'] <= a1:
                ax.axvline(c['t'], ymin=.9, ymax=1, color=ccol(c['name']), lw=1.2)
                ax.text(c['t'], 17000, c['name'], rotation=90, fontsize=5.6, va='bottom', ha='center', color=ccol(c['name']))
        for i, va, vb in spans:
            if vb > a0 and va < a1: ax.axvspan(max(a0, va), min(a1, vb), ymin=0, ymax=.03, color=vcol(i))
        ax.set_title(title, loc='left', fontsize=7.3, pad=40)
    # 6 grids
    ax = fig.add_subplot(gs[6, :8])
    def grid(a, e, bt, col, alpha=.5):
        tb = a
        while tb < e - 1e-6: ax.axvline(tb, color=col, lw=.8, alpha=alpha); tb += bt
    for s in plan['segs']:
        grid(s['a'], s['e'], s['beat'], '#ffd84a')
        if s['k'] > 0: ax.axvspan(s['a'] - BRK, s['a'], color='#ff5a5a', alpha=.15)
    ax.axvspan(plan['tags']['brk'], mp['cut'], color='#ff5a5a', alpha=.15)
    f = plan['fiche']; grid(f['a'], f['stop'], BEAT, '#ffb24a')
    if f.get('sample'): grid(f['sample'], f['key'], BEAT, '#ffb24a'); ax.axvspan(f['sample'] - BRK, f['sample'], color='#ff5a5a', alpha=.15)
    grid(mj, plan['major']['stop'], BEAT, '#ffd84a'); ax.axvspan(plan['major']['stop'], mp['sigAt'], color='#ff5a5a', alpha=.15)
    b = plan['brand']; grid(b['v0'], b['card'] + 1e-3, BEAT, '#b48cff', .6)
    if e_['hit2']:
        grid(e_['card'], e_['hit2'] - BRK, BEAT, '#ffd84a'); ax.axvspan(e_['hit2'] - BRK, e_['hit2'], color='#ff5a5a', alpha=.15)
        grid(e_['hit2'], e_['final'] + .01, e_['beat2'], '#ffd84a')
    for c in cues: ax.plot([c['t']], [.5], 'v', color=ccol(c['name']), ms=5)
    ax.set_xlim(0, DUR); ax.set_xticks(xt); ax.set_yticks([])
    ax.set_title('beat grids: gold = makossa (stop-time segments anchored on the hits), amber = the morning groove (fiche on the 1st clac, sample on '
                 'the ÉCRIS TOUT stamp), violet = brand grid (the end card on a beat) · red = breaks · triangles = cues', loc='left', fontsize=7.5)
    ax = fig.add_subplot(gs[6, 8:]); ax.axis('off')
    gl_ = ['hit               t        grid            beat   err  16th'] + [f'{x["name"][:16]:16s} {x["t"]:7.3f}  {x["grid"][:14]:14s} {x["beat"]:7.3f} {x["err"]:+5.0f} {x["err16"]:+5.0f}'
                                                                         for x in rep['grid']]
    gl_ += ['', 'segment     anchor-stop    ev/s LUFS*'] + [f'#{r["k"]} {r["role"]:6s} {r["a"]:6.3f}-{r["e"]:6.3f} {r["rate"]:4.0f} {r["lufs"]:5.1f}' for r in rep['segments']]
    gl_ += ['* un-ducked groove stem, pre-master']
    ax.text(0, 1.05, '\n'.join(gl_), family='monospace', fontsize=6.4, va='top')
    # 7 cue table (3 columns)
    ax = fig.add_subplot(gs[7, :]); ax.axis('off')
    hd = f'{"t":>7} {"cue":16s} {"alone":>7} {"mix":>7} {"LUFS-M":>6} {"LU":>5}'
    L = [f'{r["t"]:7.3f} {r["name"][:16]:16s} {fm(r["err"], "+6.1f", "     -")} {fm(r["mix_err"], "+6.1f", "     -")} {fm(r["lvl"], "6.1f", "     -")} {fm(r["lu"], "+5.1f", "    -")}'
         for r in rep['cues']]
    h = int(math.ceil(len(L) / 3))
    for j in range(3): ax.text(j / 3, .93, '\n'.join([hd] + L[j * h:(j + 1) * h]), family='monospace', fontsize=6.0, va='top')
    ok = rep['cues_ok']
    ax.text(0, 1.03, f'every cue within 15 ms (alone, ms): {ok} · music_cut / cut_dry rows = music below -60 dB re just before · music max |x| in '
                     f'[cut, next music) = {rep["cut"]["music_max"]:.1e}, after cut_dry = {rep["dry"]["music_max_after"]:.1e}, before tenseFrom = '
                     f'{rep["silent_head"]["music_max"]:.1e} · mix = spectral-flux onset in mix.wav (masked cues may differ) · LUFS-M = the cue alone, '
                     f'post master · LU = pre-master re a -18 LUFS voice line' + (f' · UNKNOWN: {rep["unknown"]}' if rep['unknown'] else ''),
            fontsize=7.4, va='top', color='#9fe08a' if ok else '#ff5a5a')
    # 8 voices + loudness
    ax = fig.add_subplot(gs[8, :]); ax.axis('off')
    L = []
    if voiced:
        L.append(f'{"id":4s} {"take":11s} {"region":>15}  {"speech (plan)":>15}  {"T.id":>6}  {"measured":>15}  {"gap":>6}  {"LUFS":>6}  {"/music":>8} '
                 f'{"word min":>8}  {"/all":>6} {"worst word (all)":>20}  {"phone":>6} {"worst word (phone)":>20}  de-ess')
        for r in rep['voices']:
            L.append(f'{r["id"]:4s} {r["file"]:11s} {r["t0"]:7.3f}-{r["t1"]:7.3f}  {r["on"]:7.3f}-{r["off"]:7.3f}  {r["T"] if r["T"] is not None else float("nan"):6.3f}  '
                     f'{r["m_on"]:7.3f}-{r["m_off"]:7.3f}  {fm(r["gap"], "6.3f", "   -  ")}  {r["lufs"]:6.1f}  '
                     f'{"no mus." if r["no_music"] else format(r["margin"], "+7.1f"):>8} {fm(r["word_min"], "+6.1f", "   -"):>8}  '
                     f'{r["margin_all"]:+6.1f} {(r["word_worst"] or "-")[:12]:>12} {fm(r["word_min_all"], "+6.1f")}   {r["phone"]:+6.1f} '
                     f'{(r["phone_word"] or "-")[:12]:>12} {fm(r["phone_word_min"], "+6.1f")}   {r["deess"]:4.1f} dB')
    else:
        L.append(f'NO VOICES IN THIS MIX — {rep["voices_status"]}')
        L.append('planned speech (score T/DUR): ' + ' '.join(f'{s["id"]} {s["on"]:.2f}-{s["off"]:.2f}' for s in rep['speech']['spans']))
    L.append('')
    L.append(f'speech ({rep["speech"]["src"]}): overlaps {len(rep["speech"]["overlaps"])} · two voices at once: {rep["speech"]["two_voices_at_once"]} · '
             f'min gap {fm(rep["speech"]["min_gap"], ".3f")} s · duck {rep["duck_max_db"]:.1f} dB + {R.CARVE_DB:.0f} dB carve 0.9-5 kHz (look-ahead '
             f'100 ms, att 35, rel 220 ms) · soft SFX duck {SFX_DUCK_DB:.0f} dB · impacts {HIT_DUCK_DB:.0f} dB · final chord not ducked '
             f'({rep["final_after_speech_ms"]:+.0f} ms after the last speech)')
    lvw = rep['loud_vs_words']
    L.append(f'loud cues vs words ({lvw["words_src"]}): inside a word: '
             + (', '.join(f'{r["name"]}@{r["t"]:.2f} «{r["in_word"]}»' for r in lvw['inside_words']) or 'none')
             + ' · inside a speech span: ' + (', '.join(f'{r["name"]}@{r["t"]:.2f} ({r["in_span"]})' for r in lvw['rows'] if r['in_span']) or 'none'))
    L.append('music sections (groove + brand + final, pre-master, un-ducked LUFS): ' + ' · '.join(
        f'{k} {v["a"]:.2f}-{v["b"]:.2f} {fm(v["lufs_premaster"], ".1f")}' for k, v in rep['music_sections'].items()))
    L.append(f'stems post master: ' + ' · '.join(f'{k} {fm(v["lufs_int"], ".1f")} LUFS (max-M {fm(v["lufs_m_max"], ".1f")})' for k, v in rep['stem_levels_post_master'].items()))
    L.append(f'mix.wav: {rep["n"]} samples = {rep["dur"]:.6f} s @ {rep["sr"]} Hz, {rep["channels"]} ch · integrated {rep["lufs"]:.2f} LUFS (pyloudnorm) · '
             f'true peak {rep["tp_dbtp"]:.2f} dBTP (8x) · sample peak {rep["sample_peak_db"]:.2f} dBFS · LRA {fm(rep["lra"], ".1f")} LU · master '
             f'{rep["master_gain_db"]:+.2f} dB ({rep["master_mode"]})' + (f' · PROJECTED final {rep["projected"]["lufs"]:.2f} LUFS, TP '
             f'{rep["projected"]["tp_dbtp"]:.2f} dBTP' if rep.get('projected') else '') + f' · limiter max GR {rep["max_gr_db"]:.1f} dB · clipped {rep["clipped"]} · seam step {rep["seam"]["step"]:.4f} (local p99 {rep["seam"]["local_p99"]:.4f})')
    L.append(f'score: {rep["src"]} · timing: {rep["timing"]} · birds at {plan.get("birds")}')
    ax.text(0, 1, '\n'.join(L), family='monospace', fontsize=7.0, va='top')
    fig.suptitle("« C'EST PAS ÇA. » (JE SAVAIS PAS. · 3/5) — audio check sheet (lib/audio_ep3.py)" + ('' if voiced else ' — MUSIC + SFX ONLY (no voices yet)'),
                 x=.01, y=.997, ha='left', fontsize=15, color='w')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fig.savefig(path, dpi=100, facecolor=fig.get_facecolor(), pil_kwargs={'quality': 88})
    plt.close(fig)
    log('[E3] sheet ->', path)

def check_replica():
    """live cues vs the python replica (run on the same T / DUR / words)"""
    sc = score(); d = derive_score(sc['T'], sc['DUR'], sc['words'], None)
    a = [(c['name'], round(c['t'], 3), c['g']) for c in sc['cues']]; b = [(c['name'], round(c['t'], 3), c['g']) for c in d['cues']]
    diff = [(x, y) for x, y in zip(a, b) if x[0] != y[0] or abs(x[1] - y[1]) > 2e-3 or abs(x[2] - y[2]) > 1e-9]
    md = {k: (round(sc['music'].get(k, -1), 3), round(d['music'][k], 3)) for k in d['music'] if abs(sc['music'].get(k, -1) - d['music'][k]) > 2e-3}
    log(f'[E3] replica check: live {len(a)} cues ({sc["src"]}) vs replica {len(b)} · differing cues: {diff[:8] or "none"} · music keys differing: {md or "none"}')
    return not diff and len(a) == len(b) and not md

if __name__ == '__main__':
    if '--gallery' in sys.argv: gallery()
    elif '--replica' in sys.argv: sys.exit(0 if check_replica() else 1)
    else: build(sheet='--sheet' in sys.argv)
