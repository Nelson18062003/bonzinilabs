"""The narrator lines of the series (SERIE.md §5): exact on-screen text, spoken syllables, film window (budget), kind.
Spoken syllables = standard careful French: elision of the final e, enchaînements and liaisons, schwa kept where three
consonants would meet (« autre voiture », « filment quoi », « faire venir », « arrive devant ») and in « conteneur »,
« dessus » (careful diction) — the conservative count where the TTS may or may not say it."""
LINES = {
    # id: (text, spoken syllables, window start, window end, film, key words that must be heard right)
    'N1':   ("Là-bas, en Chine, on charge.",          6, 0.20, 2.30, 'film 1 (+ film 2)', ['Chine', 'charge']),
    'N2':   ("Ici, à Douala, on reçoit.",             9, 2.95, 5.95, 'film 1 (+ film 2)', ['Douala', 'reçoit']),
    'N3a':  ("Un conteneur part.",                    5, 6.75, 8.50, 'film 1', ['conteneur', 'part']),
    'N3b':  ("Un autre arrive.",                      4, 8.80, 10.40, 'film 1', ['autre', 'arrive']),
    'N4':   ("Ici, une autre voiture arrive.",        9, 15.20, 18.40, 'film 1', ['voiture', 'arrive']),
    'N5a':  ("Tes colis sont en Chine ?",             6, 32.45, 34.40, 'film 1 (film 2: 15.00–16.95; film 3 colis)', ['colis', 'Chine']),
    'N5b':  ("Écris : colis.",                        4, 34.75, 36.15, 'film 1 (film 3 colis)', ['Écris', 'colis']),
    'NC2b': ("Réponds : colis.",                      4, 17.30, 18.70, 'film 2', ['Réponds', 'colis']),
    'NA':   ("Ils filment quoi ?",                    4, 0.15, 1.45, 'film 3', ['filment', 'quoi']),
    'NB':   ("Une voiture sort du conteneur !",       8, 2.10, 4.95, 'film 3', ['voiture', 'sort', 'conteneur']),
    'NC':   ("Et les téléphones sortent aussi !",     8, 7.95, 10.80, 'film 3', ['téléphones', 'sortent', 'aussi']),
    'NDa':  ("Une voiture à faire venir ?",           7, 15.00, 17.85, 'film 3', ['voiture', 'faire venir']),
    'NDb':  ("Écris : voiture.",                      4, 18.25, 19.55, 'film 3', ['Écris', 'voiture']),
    'NDw':  ("Réponds : voiture.",                    4, 18.25, 19.55, 'film 3 wa', ['Réponds', 'voiture']),
    'H':    ("Elle va où, cette machine ?",           6, 0.05, 2.25, 'film 4', ['va où', 'machine']),
    'S1':   ("Elle sort du conteneur.",               6, 2.32, 4.33, 'film 4', ['sort', 'conteneur']),
    'S2':   ("La grue la soulève.",                   5, 4.75, 6.35, 'film 4', ['grue', 'soulève']),
    'S3':   ("Elle passe au-dessus de la rue.",       8, 6.90, 9.75, 'film 4', ['passe', 'dessus', 'rue']),
    'S4':   ("Elle arrive devant la boutique.",       8, 10.15, 12.90, 'film 4', ['arrive', 'devant', 'boutique']),
    'S5':   ("Et elle entre.",                        3, 13.40, 14.70, 'film 4', ['entre']),
    'NEa':  ("Une machine à faire venir ?",           7, 19.45, 22.30, 'film 4', ['machine', 'faire venir']),
    'NEb':  ("Écris : machine.",                      4, 22.70, 24.00, 'film 4', ['Écris', 'machine']),
    'NEw':  ("Réponds : machine.",                    4, 22.70, 24.00, 'film 4 wa', ['Réponds', 'machine']),
}
QUESTIONS = {'N5a', 'NA', 'NDa', 'H', 'NEa'}
# pairs synthesised as one utterance and split at the pause (natural length for the short call-to-action lines)
PAIRS = {'PN12': ('N1', 'N2'), 'PN3': ('N3a', 'N3b'), 'PN5': ('N5a', 'N5b'), 'PNC2': ('N5a', 'NC2b'), 'PND': ('NDa', 'NDb'),
         'PNDw': ('NDa', 'NDw'), 'PNE': ('NEa', 'NEb'), 'PNEw': ('NEa', 'NEw')}
# lead-in takes: « Regarde bien. » + the line, synthesised together so that the line's first word is not utterance-initial
# (the voice holds an utterance-initial short word for 0.4–0.6 s: « Iiils filment… », « Uuun autre… »); only the line is kept
PAIRS.update({'L' + k: (None, k) for k in ('NA', 'N3b', 'S5', 'NC', 'NB', 'S1', 'N5a', 'NDa', 'NEa', 'S3', 'S4', 'N3a')})
RATE_MAX, STRETCH_MAX = 3.2, 1.15
# spoken syllables of clear, careful narration (DICTION.md): word-final schwas dropped (« un(e) », « autr(e) arrive »,
# « téléphon(es) sortent »), enchaînements and liaisons (« sont‿en », « sortent‿aussi »), « Douala » [dwa.la] (2), and
# the schwas of careful speech kept (« con-te-neur », « au-de-ssus », « de-vant », « fai-re ve-nir », « re-çoit », « fil-me
# quoi », « autre voiture » [o.tʁə.vwa]). The vowel-nucleus count of a take (nuclei.py) over-counts on /ʁ/ and /l/
# transitions (±1–2): it is shown, never used. Range kept as (n, n) for the tools that read a range.
_STD = {'N1': 6, 'N2': 8, 'N3a': 5, 'N3b': 4, 'N4': 9, 'N5a': 6, 'N5b': 4, 'NC2b': 4, 'NA': 4, 'NB': 8, 'NC': 8, 'NDa': 7,
        'NDb': 4, 'NDw': 4, 'H': 6, 'S1': 6, 'S2': 5, 'S3': 8, 'S4': 8, 'S5': 3, 'NEa': 7, 'NEb': 4, 'NEw': 4}
SYL_RANGE = {k: (v, v) for k, v in _STD.items()}
SERIE_SYL = {'N1': 6, 'N2': 9, 'N3a': 5, 'N3b': 5, 'N4': 10, 'N5a': 6, 'N5b': 4, 'NC2b': 4, 'NA': 4, 'NB': 9, 'NC': 9, 'NDa': 9,
             'NDb': 4, 'NDw': 4, 'H': 7, 'S1': 6, 'S2': 5, 'S3': 9, 'S4': 8, 'S5': 4, 'NEa': 9, 'NEb': 4, 'NEw': 4}
