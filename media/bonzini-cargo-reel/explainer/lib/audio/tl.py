"""Timeline API for the audio side — mirror of overlay/lib.js `TL` (same word matching rules).

All music / SFX / mix timing is read from data/timeline.json at run time; nothing is hard-coded.
    tl = load()                    tl.ch('s3') -> {start,end,num,title,kind}
    tl.seg('V05') -> {start,end,words:[{w,s,e,emph}]}
    tl.wt('V05', 'camion')         start time of that word (None if missing and no fallback)
    tl.word('V10', 'achat')        word dict; also matches elided forms (l'achat, d'..., qu'...)
"""
import os, json, re, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
E = os.path.abspath(os.path.join(HERE, '..', '..'))
TL_PATH = os.path.join(E, 'data', 'timeline.json')


def norm(w):
    w = unicodedata.normalize('NFD', w.lower())
    w = ''.join(c for c in w if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]', '', w)


def norm_elided(w):
    """'l'achat' -> 'achat', "jusqu'à" -> 'a' ... (strip a leading elided article/pronoun)."""
    m = re.match(r"^\s*(?:l|d|j|qu|n|s|c|m|t)['’](.+)$", w.lower())
    return norm(m.group(1)) if m else norm(w)


class Timeline:
    def __init__(self, path=TL_PATH):
        self.path = path
        self.data = json.load(open(path))
        d = self.data
        self.duration = float(d['duration'])
        self.bpm = float(d.get('bpm', 100.0))
        self.beat = 60.0 / self.bpm
        self.bar = 4 * self.beat
        self.chapters = d['chapters']
        self.segments = d['segments']
        self.speech = [tuple(map(float, s)) for s in d.get('speech') or [[s['start'], s['end']] for s in self.segments]]

    # ------------------------------------------------------------------ lookups
    def ch(self, cid):
        return next((c for c in self.chapters if c['id'] == cid), None)

    def seg(self, sid):
        return next((s for s in self.segments if s['id'] == sid), None)

    def ch_at(self, t):
        for c in self.chapters:
            if c['start'] <= t < c['end']:
                return c
        return self.chapters[-1]

    def next_ch(self, cid):
        ids = [c['id'] for c in self.chapters]
        i = ids.index(cid)
        return self.chapters[i + 1] if i + 1 < len(ids) else None

    def word(self, sid, prefix, nth=0):
        s = self.seg(sid)
        if not s or not s.get('words'):
            return None
        k = norm(prefix)
        c = 0
        for w in s['words']:
            if norm(w['w']).startswith(k) or norm_elided(w['w']).startswith(k):
                if c == nth:
                    return w
                c += 1
        return None

    def wt(self, sid, prefix, fallback=None, nth=0):
        w = self.word(sid, prefix, nth)
        if w:
            return float(w['s'])
        if fallback is not None:
            return fallback
        return None

    def words_matching(self, prefix, kinds=('vo', 'sp')):
        """All (segment, word) whose word starts with prefix, in time order."""
        k = norm(prefix)
        out = []
        for s in self.segments:
            if s['kind'] not in kinds:
                continue
            for w in s.get('words', []):
                if norm(w['w']).startswith(k) or norm_elided(w['w']).startswith(k):
                    out.append((s, w))
        return out

    # ------------------------------------------------------------------ grid
    def on_grid(self, t, tol=0.02):
        return abs(t / self.beat - round(t / self.beat)) * self.beat < tol

    def snap(self, t):
        return round(t / self.beat) * self.beat

    def next_beat(self, t, eps=1e-6):
        import math
        return math.ceil(t / self.beat - eps) * self.beat


def load(path=TL_PATH):
    return Timeline(path)
