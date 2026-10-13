"""Shared definitions for the real-voice (RV) measurements: segments of SERIE.md §4, the marks it gives, envelopes."""
import os, json
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfiltfilt

R2 = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
WORK = os.path.join(R2, 'work')

# SERIE.md §4: id -> clip, in, out, subtitle text (corrected, faithful)
SEGS = {
    'RV1-A': dict(clip='v1', i=8.85, o=11.05, text="Nous disons comme ça : merci déjà…"),
    'RV1-B': dict(clip='v1', i=11.55, o=13.70, text="…aux clients qui nous ont fait confiance."),
    'RV2':   dict(clip='v2', i=3.65, o=7.35, text="Voilà, ce véhicule doit être chargé dans le conteneur."),
    'RV3':   dict(clip='v2', i=14.45, o=18.62, text="Voilà, directement déposé, directement reçu."),
    'RV4':   dict(clip='v2', i=18.80, o=22.75, text="Voilà, c'est fort, Bonzini Trading, faites-nous confiance."),
    'RV5':   dict(clip='v1', i=87.95, o=88.75, text="C'est fort !"),
}
# SERIE.md §4 marks (source seconds): (word occurrence key, kind 's' onset / 'e' end-of-speech, time)
MARKS4 = {
    'RV1-A': [('Nous', 's', 9.06), ('merci', 's', 9.70), ('déjà…', 'e', 10.82)],
    'RV1-B': [('aux', 's', 11.82), ('clients', 's', 11.98), ('confiance.', 's', 13.14), ('confiance.', 'e', 13.44)],
    'RV2':   [('Voilà,', 's', 3.83), ('ce', 's', 4.97), ('conteneur.', 'e', 7.12)],
    'RV3':   [('Voilà,', 's', 14.64), ('directement#1', 's', 15.64), ('déposé,', 's', 16.34), ('déposé,', 'e', 16.80),
              ('directement#2', 's', 17.60), ('reçu.', 's', 18.26), ('reçu.', 'e', 18.50)],
    'RV4':   [('Voilà,', 's', 19.24), ("c'est", 's', 19.52), ('fort,', 's', 19.68), ('Bonzini', 's', 20.12),
              ('faites-nous', 's', 21.47), ('confiance.', 'e', 22.57)],
    'RV5':   [("C'est", 's', 88.10), ('fort !', 's', 88.24), ('fort !', 'e', 88.58)],
}
# SERIE.md §8.1 re-measured marks
MARKS81 = {
    'RV3': [('Voilà,', 's', 14.62), ('directement#1', 's', 15.62), ('déposé,', 's', 16.36), ('directement#2', 's', 17.60),
            ('reçu.', 's', 18.28), ('reçu.', 'e', 18.50)],
    'RV4': [('Voilà,', 's', 19.24), ('fort,', 's', 19.66), ('Bonzini', 's', 20.12)],
    'RV1-A': [('Nous', 's', 9.14), ('merci', 's', 9.66)],
    'RV1-B': [('aux', 's', 11.80), ('confiance.', 'e', 13.42)],
    'RV5': [("C'est", 's', 88.10), ('fort !', 's', 88.22), ('fort !', 'e', 88.58)],
    'RV2': [('Voilà,', 's', 3.94), ('ce', 's', 4.96), ('conteneur.', 'e', 7.12)],
}
# silences of §4 that carry the cuts
SIL4 = {'RV1-A': [(8.50, 9.05), (10.82, 11.81)], 'RV1-B': [(10.82, 11.81), (13.45, 14.22)], 'RV2': [(3.10, 3.83), (7.12, 7.5)],
        'RV3': [(13.68, 14.60), (18.52, 18.84)], 'RV4': [(18.56, 18.84), (22.57, None)], 'RV5': [(86.61, 88.10), (88.60, 90.72)]}

_cache = {}
def vocals(clip):
    if clip not in _cache:
        y, sr = sf.read(os.path.join(WORK, f'{clip}_vocals.wav')); _cache[clip] = ((y.mean(1) if y.ndim > 1 else y).astype(np.float64), sr)
    return _cache[clip]

def envelopes(y, sr, hop=.002, win=.012):
    """broadband (100 Hz–8 kHz) and high band (> 2.5 kHz) RMS in dB, one value per `hop` (centered windows)"""
    bb = sosfiltfilt(butter(4, [100, 8000], 'bandpass', fs=sr, output='sos'), y)
    hb = sosfiltfilt(butter(4, 2500, 'hp', fs=sr, output='sos'), y)
    h, w = int(hop * sr), int(win * sr)
    def env(z):
        c = np.cumsum(np.r_[0, z ** 2]); n = len(z); idx = np.arange(0, n, h)
        a = np.clip(idx - w // 2, 0, n); b = np.clip(idx + w // 2, 0, n)
        return 10 * np.log10((c[b] - c[a]) / np.maximum(b - a, 1) + 1e-12)
    return np.arange(0, len(y), h) / sr, env(bb), env(hb)
