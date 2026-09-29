"""Build data/captions.json from the Whisper word timings (+ manual corrections).
Output times are on the FINAL timeline: clip B plays at out 0..16.0 (src = out),
clip A plays at out 16.0.. (src = out - 16.0)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
T = json.load(open(sys.argv[1]))
A_OFF = 16.0
CONFIG = json.load(open(os.path.join(HERE, '..', 'data', 'config.json')))
district = CONFIG.get('district', '').strip()

def words(key, off, t0, t1, fix=None):
    out = []
    for s in T[key]['segments']:
        for w in s['words']:
            if w['s'] >= t0 - 1e-3 and w['e'] <= t1 + 1e-3:
                txt = w['w'].strip()
                if fix and txt in fix: txt = fix[txt]
                out.append({'w': txt, 's': round(w['s'] + off, 3), 'e': round(w['e'] + off, 3)})
    return out

# clip B (street / container). First 3.2 s is unintelligible for ASR (truck noise);
# forced-alignment scoring picked "Voilà, chers clients de Bonzini Trading Cargo."
hook = [('Voilà,', 0.00, 0.38), ('chers', 0.40, 0.90), ('clients', 0.90, 1.70), ('de', 1.72, 1.92),
        ('Bonzini', 1.94, 2.46), ('Trading', 2.46, 2.84), ('Cargo.', 2.86, 3.18)]
hook = [{'w': w, 's': s, 'e': e} for w, s, e in hook]
B = words('B_clean16k.wav', 0.0, 3.5, 15.6, fix={'contenu': 'conteneur'})
A = words('A_raw16k.wav', A_OFF, 0.0, 22.8, fix={"l": "l'", "'entrepôt": "entrepôt"})
# merge the l' + entrepôt split
merged = []
for w in A:
    if merged and merged[-1]['w'] == "l'":
        merged[-1] = {'w': "l'" + w['w'], 's': merged[-1]['s'], 'e': w['e']}; continue
    merged.append(w)
A = merged
# the district name after "ici" is not verifiable from the audio -> configurable
fixed = []
for w in A:
    if w['w'] == 'en' and 29.0 < w['s'] < 29.6: continue          # "en" before the district
    if w['w'].startswith('Gonçois'):
        if district: fixed.append({'w': f'à', 's': w['s'] - 0.3, 'e': w['s']}); fixed.append({'w': district + ',', 's': w['s'], 'e': w['e']})
        continue
    fixed.append(w)
A = fixed
if not district:
    for w in A:
        if w['w'] == 'ici' and 29.0 < w['s'] < 29.5: w['w'] = 'ici,'

allw = B + A
def page(ws_text, t_first):
    """grab consecutive words starting at time t_first matching ws_text"""
    n = len(ws_text.split())
    idx = next(i for i, w in enumerate(allw) if abs(w['s'] - t_first) < 0.06)
    ws = allw[idx:idx + n]
    got = ' '.join(w['w'] for w in ws)
    assert got == ws_text, (got, ws_text)
    return ws

EMPH = {'conteneur', 'sécurité.', 'déchargé', 'déchargés', 'Bonzini', 'Trading', 'Cargo.', 'colis', 'colis.',
        'Balengou,', 'merci', 'confiance.', 'entrepôt'}
spec = [
    ('Voici votre conteneur', 3.72, 'B'),
    ('qui arrive dans notre entrepôt', 5.20, 'B'),
    ('en toute sécurité.', 7.70, 'B'),
    ('Il sera déchargé ici,', 10.04, 'B'),
    ('dans notre entrepôt', 12.24, 'B'),
    ('en toute sécurité.', 14.46, 'B'),
    ('Voilà, très chers clients,', 16.00, 'A'),
    ("nous sommes ici à l'entrepôt", 17.54, 'A'),
    ('de Bonzini Trading Cargo.', 19.14, 'A'),
    ('Vos colis ont été déchargés', 21.74, 'A'),
    ('en toute sécurité.', 23.96, 'A'),
    ('Et nous vous attendons', 25.80, 'A'),
    ('dans notre entrepôt ici,' if not district else f'dans notre entrepôt ici à {district},', 27.72, 'A'),
    ('au niveau du foyer Balengou,', 30.68, 'A'),
    ('pour le retrait de vos colis.', 33.00, 'A'),
    ('Et nous vous disons merci', 34.66, 'A'),
    ('pour votre confiance.', 36.36, 'A'),
]
pages = []
for text, t, clip in spec:
    ws = page(text, t)
    for w in ws: w['emph'] = w['w'] in EMPH
    pages.append({'text': text, 'clip': clip, 'words': ws})
for i, p in enumerate(pages):
    start = p['words'][0]['s'] - 0.08
    nxt = pages[i + 1]['words'][0]['s'] - 0.08 if i + 1 < len(pages) else 1e9
    last = p['words'][-1]['e']
    p['in'] = round(start, 3)
    p['out'] = round(min(nxt, last + 0.55), 3)
json.dump({'note': 'times are seconds on the final 45 s timeline; words[].emph = highlight word',
           'hook_title': {'text': 'Voilà, chers clients de Bonzini Trading Cargo.', 'in': 0.0, 'out': 3.3, 'words': hook},
           'pages': pages}, open(os.path.join(HERE, '..', 'data', 'captions.json'), 'w'), ensure_ascii=False, indent=1)
for p in pages: print(f"{p['in']:6.2f}-{p['out']:6.2f}  {p['text']}")
