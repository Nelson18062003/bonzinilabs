"""Ingest every WhatsApp video uploaded for the rush2 project into rush2/src/vN.mp4 (idempotent).
Existing ids keep their file; new uploads get the next ids in chronological order of the timestamp in their name.
Writes rush2/src/index.json: [{id, file, ts, dur, w, h, rot, display}] and, for new clips, work/gN/ (2 fps thumbs),
work/sheet_vN.jpg, work/vN_16.wav, work/vN_48.wav."""
import os, re, json, glob, shutil, subprocess, hashlib
from PIL import Image, ImageDraw
U = '/root/.claude/uploads/5fd5d24c-f443-5c7d-8c0d-137b9d5733f0'
R = os.path.dirname(os.path.abspath(__file__)); S = os.path.join(R, 'src'); W = os.path.join(R, 'work')
idx_p = os.path.join(S, 'index.json')
idx = json.load(open(idx_p)) if os.path.exists(idx_p) else []
known = {e['file'] for e in idx}
# seed with the 18 already copied (same order as copied by hand)
SEED = ['923c9793-WhatsApp_Video_2026-10-11_at_10.16.54.mp4', 'd3e5f08b-WhatsApp_Video_2026-10-11_at_10.32.44.mp4', 'b6f3031b-WhatsApp_Video_2026-10-11_at_10.37.12.mp4',
        '96729634-WhatsApp_Video_2026-09-29_at_14.57.31.mp4', '92f68926-WhatsApp_Video_2026-09-29_at_14.57.34.mp4', 'f0cf30cb-WhatsApp_Video_2026-09-29_at_14.57.37.mp4',
        'c8bbafcf-WhatsApp_Video_2026-09-29_at_14.57.42.mp4', '297e908c-WhatsApp_Video_2026-09-29_at_14.57.45.mp4', 'a3524d9c-WhatsApp_Video_2026-09-29_at_14.25.49.mp4',
        '18bab135-WhatsApp_Video_2026-09-29_at_14.26.20.mp4', '3fb70f95-WhatsApp_Video_2026-09-29_at_14.31.49.mp4', '052c9a00-WhatsApp_Video_2026-09-29_at_14.32.27.mp4',
        '373611a4-WhatsApp_Video_2026-09-29_at_14.32.46.mp4', '49a6a1a3-WhatsApp_Video_2026-09-29_at_14.33.03.mp4', '10bc5533-WhatsApp_Video_2026-09-29_at_14.33.11.mp4',
        'ace5cd7f-WhatsApp_Video_2026-09-29_at_14.33.15.mp4', '5b7bad6e-WhatsApp_Video_2026-09-29_at_14.33.20.mp4', 'bc9ab871-WhatsApp_Video_2026-09-29_at_14.33.22.mp4']
def ts(f):
    m = re.search(r'(\d{4}-\d{2}-\d{2})_at_(\d{2})\.(\d{2})\.(\d{2})', f); return f'{m.group(1)} {m.group(2)}:{m.group(3)}:{m.group(4)}' if m else ''
def probe(p):
    o = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height:stream_side_data=rotation', '-of', 'json', p], capture_output=True, text=True).stdout
    j = json.loads(o); v = next(s for s in j['streams'] if s.get('codec_type') == 'video')
    rot = next((int(sd.get('rotation', 0)) for sd in v.get('side_data_list', []) if 'rotation' in sd), 0)
    w, h = v['width'], v['height']; dw, dh = (h, w) if abs(rot) == 90 else (w, h)
    return float(j['format']['duration']), w, h, rot, f'{dw}x{dh}', any(s.get('codec_type') == 'audio' for s in j['streams'])
if not idx:
    for k, f in enumerate(SEED, 1):
        d, w, h, rot, disp, au = probe(os.path.join(S, f'v{k}.mp4'))
        idx.append(dict(id=f'v{k}', file=f, ts=ts(f), dur=round(d, 2), w=w, h=h, rot=rot, display=disp, audio=au)); known.add(f)
EXCLUDE = {'cb57b3cf-WhatsApp_Video_2026-10-12_at_13.38.11.mp4'}   # the rush1 clip (« Bonsoir bonsoir »), not this project
md5 = lambda p: hashlib.md5(open(p, 'rb').read()).hexdigest()
seen = {md5(os.path.join(S, e['id'] + '.mp4')) for e in idx}       # the same video is sometimes uploaded twice under a new prefix
new = sorted([os.path.basename(p) for p in glob.glob(os.path.join(U, '*WhatsApp_Video_*.mp4')) if os.path.basename(p) not in known | EXCLUDE], key=lambda f: (ts(f), f))
dups = []
for f in new:
    h = md5(os.path.join(U, f))
    if h in seen: dups.append(f); continue
    seen.add(h)
    k = len(idx) + 1; dst = os.path.join(S, f'v{k}.mp4'); shutil.copy(os.path.join(U, f), dst)
    d, w, h, rot, disp, au = probe(dst)
    idx.append(dict(id=f'v{k}', file=f, ts=ts(f), dur=round(d, 2), w=w, h=h, rot=rot, display=disp, audio=au))
    g = os.path.join(W, f'g{k}'); os.makedirs(g, exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', dst, '-vf', 'fps=2,scale=-2:320', os.path.join(g, '%03d.jpg')])
    if au:
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', dst, '-vn', '-ac', '1', '-ar', '16000', os.path.join(W, f'v{k}_16.wav')])
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', dst, '-vn', '-ar', '48000', os.path.join(W, f'v{k}_48.wav')])
    fs = sorted(glob.glob(os.path.join(g, '*.jpg'))); im0 = Image.open(fs[0]); Wd, Hd = im0.size; cols = 8 if Wd < Hd else 5; rows = (len(fs) + cols - 1) // cols
    sh = Image.new('RGB', (Wd * cols, Hd * rows), 'black'); dr = ImageDraw.Draw(sh)
    for j, ff in enumerate(fs):
        x, y = (j % cols) * Wd, (j // cols) * Hd; sh.paste(Image.open(ff), (x, y)); dr.text((x + 4, y + 4), f'{j / 2:.1f}s', fill='yellow')
    sh.save(os.path.join(W, f'sheet_v{k}.jpg'), quality=85)
    print(f'v{k} {f} {d:.1f}s {disp} audio={au}', flush=True)
json.dump(idx, open(idx_p, 'w'), indent=1)
print(len(idx), 'clips;', len(new) - len(dups), 'new;', len(dups), 'duplicate uploads skipped')
