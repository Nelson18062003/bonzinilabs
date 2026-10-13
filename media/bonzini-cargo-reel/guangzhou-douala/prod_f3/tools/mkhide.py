"""mkhide.py — a hide box glued to a tracked feature: track a small TEMPLATE (track_box.py), then place the HIDE box at a
fixed offset from it; write the keys (every 3 frames) and a check sheet (every 3rd frame, box drawn, crop window drawn).

usage:  python3 tools/mkhide.py NAME CLIP T0 T1 TX TY TW TH --rel DX DY W H [--back] [--search 50] [--hold A B]
                                [--rect x0,y0,x1,y1] [--crop x0,y0,x1,y1] [--zoom 1] [--clip-src]
        T0 / T1 = SOURCE seconds; the template (TX TY TW TH, SOURCE px) is given at T0 (or at T1 with --back);
        --rel = the hide box relative to the template's top-left corner; --hold A B: keys outside [A, B] repeat the
        nearest key inside (where the tracker lost the feature); --clip-src: clamp the box to the source frame.
writes  work/h_NAME.json  = {clip, t0, t1, keys: [[s, [x, y, w, h]]…], why}  (read by 01_score.js HIDE_FILES)
        out/hide_NAME.jpg = the check sheet (every 3rd frame of [T0, T1])"""
import json, os, sys, subprocess, argparse
HERE = os.path.dirname(os.path.abspath(__file__)); P = os.path.abspath(os.path.join(HERE, '..'))
ap = argparse.ArgumentParser()
ap.add_argument('name'); ap.add_argument('clip'); ap.add_argument('t0', type=float); ap.add_argument('t1', type=float)
ap.add_argument('tpl', type=float, nargs=4); ap.add_argument('--rel', type=float, nargs=4, required=True)
ap.add_argument('--back', action='store_true'); ap.add_argument('--search', type=int, default=50)
ap.add_argument('--hold', type=float, nargs=2); ap.add_argument('--rect', action='append', default=[])
ap.add_argument('--crop'); ap.add_argument('--zoom', type=float, default=1.0); ap.add_argument('--clip-src', action='store_true')
ap.add_argument('--why', default=''); ap.add_argument('--at', type=float, help='template time inside [T0, T1]: track both ways from it'); ap.add_argument('--no-sheet', action='store_true')
a = ap.parse_args()
def track(t0, t1, back):
    cmd = ['python3', os.path.join(HERE, 'track_box.py'), a.clip, str(t0), str(t1), *map(str, a.tpl), '--every', '1', '--pad', '0', '--search', str(a.search)]
    if back: cmd.append('--back')
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode: sys.exit(r.stderr)
    sys.stderr.write(r.stderr)
    return json.loads(r.stdout.strip().splitlines()[0])
if a.at is not None:
    tk = (track(a.t0, a.at, True)[:-1] if a.at > a.t0 + 1e-6 else []) + (track(a.at, a.t1, False) if a.t1 > a.at + 1e-6 else [])
else:
    tk = track(a.t0, a.t1, a.back)
dims = json.load(open(os.path.join(P, 'data', 'clips.json')))[a.clip]
out = []
for i, (s, b) in enumerate(tk):
    if i % 3 and i != len(tk) - 1: continue
    if a.hold:
        A, B = a.hold
        if s < A: b = min(tk, key=lambda k: abs(k[0] - A))[1]
        if s > B: b = min(tk, key=lambda k: abs(k[0] - B))[1]
    x, y, w, h = b[0] + a.rel[0], b[1] + a.rel[1], a.rel[2], a.rel[3]
    if a.clip_src:
        x0, y0 = max(0, x), max(0, y); x1, y1 = min(dims['w'], x + w), min(dims['h'], y + h); x, y, w, h = x0, y0, x1 - x0, y1 - y0
    out.append([round(s, 4), [round(x, 1), round(y, 1), round(w, 1), round(h, 1)]])
os.makedirs(os.path.join(P, 'work'), exist_ok=True)
J = os.path.join(P, 'work', f'h_{a.name}.json')
json.dump({'clip': a.clip, 't0': out[0][0], 't1': out[-1][0], 'keys': out, 'why': a.why}, open(J, 'w'))
print(J, len(out), 'keys', out[0][0], '→', out[-1][0])
if not a.no_sheet:
    f0, f1 = int(round(a.t0 * 30)), int(round(a.t1 * 30))
    ts = [f'{f / 30:.4f}' for f in range(f0, f1 + 1, 3)]
    cmd = ['python3', os.path.join(HERE, 'peek.py'), a.clip, *ts, '--keys', json.dumps([{'keys': out, 't0': out[0][0], 't1': out[-1][0]}]),
           '--cols', '8', '--zoom', str(a.zoom), '--out', os.path.join(P, 'out', f'hide_{a.name}.jpg')]
    for q in a.rect: cmd += ['--rect', q]
    if a.crop: cmd += ['--crop', a.crop]
    print(subprocess.run(cmd, capture_output=True, text=True).stdout.strip())
