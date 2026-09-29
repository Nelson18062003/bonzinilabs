"""Footage access for the explainer: clips A, B (src 0-16.6 s) and B2 (= B src 16.0-30.6 s),
AI-upscaled 1080x1920 frames with Lanczos fallback, graded with the v1 look (per source frame),
and fractional source times (frame blending for slow motion)."""
import os, sys, functools, math
import numpy as np, cv2

HERE = os.path.dirname(os.path.abspath(__file__))
E = os.path.abspath(os.path.join(HERE, '..'))
S = os.path.abspath(os.path.join(E, '..'))
sys.path.insert(0, os.path.join(S, 'reel', 'lib'))
import base            # noqa: E402  (v1 footage module)
import grade as G      # noqa: E402  (v1 grade)

WORK = base.WORK
W, H = 1080, 1920
CLIPS = {'A': dict(fps=25, n=648), 'B': dict(fps=30, n=498), 'B2': dict(fps=30, n=438)}
base.CLIPS['B2'] = CLIPS['B2']

# --- grade support for B2 (same look as B, its own exposure statistics) ---
_B2_STATS = os.path.join(E, 'assets', 'grade_stats_B2.npz')
@functools.lru_cache(maxsize=1)
def _b2_stats():
    if os.path.exists(_B2_STATS):
        return np.load(_B2_STATS)['B2']
    raw = G._measure('B2')
    st = G._smooth(raw, 0.7 * 30).astype(np.float32)
    os.makedirs(os.path.dirname(_B2_STATS), exist_ok=True)
    np.savez(_B2_STATS, B2=st)
    return st

_orig_stats, _orig_idx = G._stats, G._src_index
def _stats():
    d = dict(_orig_stats()); d['B2'] = _b2_stats(); return d
def _src_index(clip, t):
    if clip == 'B2':
        return min(max(int(round(t * 30)), 0), CLIPS['B2']['n'] - 1)
    return _orig_idx(clip, t)
G._stats, G._src_index = _stats, _src_index
G.P['B2'] = G.P['B']

def raw_frame(clip, idx):
    idx = max(0, min(int(idx), CLIPS[clip]['n'] - 1))
    return base.frame(clip, idx)

def graded_frame(clip, idx):
    idx = max(0, min(int(idx), CLIPS[clip]['n'] - 1))
    im = raw_frame(clip, idx)
    if clip == 'A':
        return G.grade(im, 16.0 + idx / 25.0, 'A')
    return G.grade(im, idx / 30.0, clip)

@functools.lru_cache(maxsize=24)
def _graded_cached(clip, idx):
    return graded_frame(clip, idx)

def at(clip, src_t, blend=True):
    """graded frame at fractional source time (linear blend of the two nearest frames)."""
    fps, n = CLIPS[clip]['fps'], CLIPS[clip]['n']
    x = max(0.0, min(src_t * fps, n - 1.0))
    i0 = int(math.floor(x)); f = x - i0
    a = _graded_cached(clip, i0)
    if not blend or f < 0.08 or i0 + 1 >= n:
        return a
    if f > 0.92:
        return _graded_cached(clip, i0 + 1)
    return cv2.addWeighted(a, 1 - f, _graded_cached(clip, i0 + 1), f, 0)
