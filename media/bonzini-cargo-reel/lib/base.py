"""Shared access to the (ungraded) base footage on the FINAL timeline.

Final timeline (30 fps, 1080x1920, 45.0 s = 1350 frames):
  out [0.0, 16.0)   -> clip B (container arrival), src_t = out_t          (B_stab @ 30 fps, 498 frames, 16.6 s)
  out [16.0, 41.92) -> clip A (warehouse tour),    src_t = out_t - 16.0   (A_stab @ 25 fps, 648 frames, 25.92 s)
  out >= 41.92      -> hold the last A frame (outro background)
Clip B has usable handles up to src 16.55 s (for transitions that need B after 16.0).

Frames come from the Real-ESRGAN upscales (work/{A,B}_up/NNNNN.png, 1080x1920) when present,
otherwise from a Lanczos upscale of the stabilized low-res source (same geometry), so every
tool can run before the AI upscale has finished.
"""
import os, functools, cv2, numpy as np
S = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))   # scratchpad root
WORK = os.path.join(S, 'work')
FPS = 30
DURATION = 45.0
NFRAMES = int(round(DURATION * FPS))
W, H = 1080, 1920
A_OFF = 16.0
CLIPS = {'B': dict(fps=30, n=498), 'A': dict(fps=25, n=648)}

def src_for(t):
    """(clip, src_frame_index) shown at output time t (no transition logic)."""
    if t < A_OFF:
        return 'B', min(int(round(t * 30)), CLIPS['B']['n'] - 1)
    return 'A', min(int((t - A_OFF) * 25 + 1e-6), CLIPS['A']['n'] - 1)

def clip_frame_at(clip, src_t):
    fps, n = CLIPS[clip]['fps'], CLIPS[clip]['n']
    idx = int(round(src_t * fps)) if clip == 'B' else int(src_t * fps + 1e-6)
    return max(0, min(idx, n - 1))

@functools.lru_cache(maxsize=4)
def _lowres_all(clip):
    cap = cv2.VideoCapture(os.path.join(WORK, f'{clip}_stab.mkv')); fr = []
    while True:
        ok, f = cap.read()
        if not ok: break
        fr.append(f)
    return fr

@functools.lru_cache(maxsize=64)
def frame(clip, idx, allow_lanczos=True):
    """BGR uint8 1080x1920 frame `idx` of clip ('A'|'B'), ungraded."""
    p = os.path.join(WORK, f'{clip}_up', f'{idx:05d}.png')
    if os.path.exists(p):
        im = cv2.imread(p, cv2.IMREAD_COLOR)
        if im is not None: return im
    if not allow_lanczos: raise FileNotFoundError(p)
    return cv2.resize(_lowres_all(clip)[idx], (W, H), interpolation=cv2.INTER_LANCZOS4)

def base_at(t):
    clip, idx = src_for(t)
    return frame(clip, idx)

def upscaled_ready():
    return {c: len([f for f in os.listdir(os.path.join(WORK, f'{c}_up')) if f.endswith('.png') and 'tmp' not in f])
            if os.path.isdir(os.path.join(WORK, f'{c}_up')) else 0 for c in CLIPS}
