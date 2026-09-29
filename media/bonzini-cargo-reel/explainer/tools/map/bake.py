"""Bake Natural Earth coastlines into a compact JS data file for the s3 transport map.

Projection: Mercator in "degree units": X = lon, Y = -ln(tan(pi/4 + lat/2)) * 180/pi  (north up on screen).
Outputs overlay/scenes/12_map_data.js defining window.BZ_MAP = {
  land:  [[x0,y0,x1,y1,...] per ring]   (ints, 1/10 degree units, simplified + clipped to bbox)
  china: [...rings...]                   (China outline, same units)
  dots:  [[j, i0, i1, i0, i1, ...], ...] runs of land grid cells (row j, cols i0..i1 inclusive)
  cdots: same for China cells
  grid:  {x0, y0, step}                  cell (i,j) centre = (x0 + i*step, y0 + j*step)
  route: [x,y,...]                       sea route, 1/100 degree units (dense, smoothed)
  pts:   {origin:[x,y], port:[x,y], dest:[x,y]}
}
"""
import json, math, os
import numpy as np
from matplotlib.path import Path

HERE = os.path.dirname(os.path.abspath(__file__))
E = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(E, 'overlay', 'scenes', '12_map_data.js')

LON0, LON1, LAT0, LAT1 = -40.0, 170.0, -62.0, 70.0
MERC = lambda lat: -math.degrees(math.log(math.tan(math.pi / 4 + math.radians(max(-85, min(85, lat))) / 2)))
Y0, Y1 = MERC(LAT1), MERC(LAT0)   # Y0 < Y1 (north is negative)


def proj(lon, lat):
    return (lon, MERC(lat))


def rings_of(geom):
    polys = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
    for p in polys:
        for k, r in enumerate(p):
            yield k, r


def clip_rect(pts, x0, y0, x1, y1):
    """Sutherland-Hodgman clip of a closed ring to an axis aligned rectangle."""
    def clip(pts, inside, inter):
        out = []
        if not pts: return out
        prev = pts[-1]
        for cur in pts:
            if inside(cur):
                if not inside(prev): out.append(inter(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(inter(prev, cur))
            prev = cur
        return out
    def ix(a, b, x):
        k = (x - a[0]) / (b[0] - a[0]); return (x, a[1] + k * (b[1] - a[1]))
    def iy(a, b, y):
        k = (y - a[1]) / (b[1] - a[1]); return (a[0] + k * (b[0] - a[0]), y)
    pts = clip(pts, lambda p: p[0] >= x0, lambda a, b: ix(a, b, x0))
    pts = clip(pts, lambda p: p[0] <= x1, lambda a, b: ix(a, b, x1))
    pts = clip(pts, lambda p: p[1] >= y0, lambda a, b: iy(a, b, y0))
    pts = clip(pts, lambda p: p[1] <= y1, lambda a, b: iy(a, b, y1))
    return pts


def dp(pts, eps):
    """Douglas-Peucker on an open polyline (list of tuples)."""
    if len(pts) < 3: return pts
    a = np.array(pts)
    keep = np.zeros(len(a), bool); keep[0] = keep[-1] = True
    stack = [(0, len(a) - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1: continue
        p, q = a[i], a[j]; seg = a[i + 1:j]
        d = q - p; L = math.hypot(*d)
        if L < 1e-12: dist = np.hypot(*(seg - p).T)
        else: dist = np.abs(d[0] * (seg[:, 1] - p[1]) - d[1] * (seg[:, 0] - p[0])) / L
        k = int(np.argmax(dist))
        if dist[k] > eps:
            keep[i + 1 + k] = True; stack += [(i, i + 1 + k), (i + 1 + k, j)]
    return [tuple(x) for x in a[keep]]


def simplify_ring(ring, eps):
    # split closed ring into two halves so DP keeps shape
    n = len(ring)
    if n < 8: return ring
    h = n // 2
    s = dp(ring[:h + 1], eps)[:-1] + dp(ring[h:] + [ring[0]], eps)[:-1]
    return s


def area(r):
    a = 0
    for i in range(len(r)):
        x0, y0 = r[i]; x1, y1 = r[(i + 1) % len(r)]; a += x0 * y1 - x1 * y0
    return abs(a) / 2


def load_rings(fn, filt=None):
    d = json.load(open(os.path.join(HERE, fn)))
    out = []
    for f in d['features']:
        if filt and not filt(f['properties']): continue
        for k, r in rings_of(f['geometry']):
            out.append([proj(lon, lat) for lon, lat in r[:-1]])
    return out


def build(rings, eps, min_area):
    res = []
    for r in rings:
        xs = [p[0] for p in r]; ys = [p[1] for p in r]
        if max(xs) < LON0 or min(xs) > LON1 or max(ys) < Y0 or min(ys) > Y1: continue
        c = clip_rect(r, LON0, Y0, LON1, Y1)
        if len(c) < 3 or area(c) < min_area: continue
        s = simplify_ring(c, eps)
        if len(s) < 3 or area(s) < min_area * .5: continue
        res.append(s)
    return res


def inside_mask(rings, P):
    m = np.zeros(len(P), bool)
    for r in rings:
        m ^= Path(np.array(r)).contains_points(P)
    return m


def runs_of(mask2d):
    rows = []
    for j in range(mask2d.shape[0]):
        row = mask2d[j]; if_any = row.any()
        if not if_any: continue
        r = [j]; i = 0; n = len(row)
        while i < n:
            if row[i]:
                k = i
                while k + 1 < n and row[k + 1]: k += 1
                r += [i, k]; i = k + 1
            else: i += 1
        rows.append(r)
    return rows


def catmull(pts, n_per=14):
    P = [pts[0]] + pts + [pts[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = map(np.array, (P[i - 1], P[i], P[i + 1], P[i + 2]))
        for k in range(n_per):
            t = k / n_per
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(np.array(P[-2]))
    return out


def main():
    land_full = load_rings('ne_50m_land.geojson')
    land = build(land_full, eps=0.10, min_area=0.12)
    china_full = load_rings('ne_50m_admin_0_countries.geojson', lambda p: p.get('ADM0_A3') == 'CHN')
    china = build(china_full, eps=0.10, min_area=0.3)
    print('land rings', len(land), 'pts', sum(map(len, land)), '| china rings', len(china), 'pts', sum(map(len, china)))

    # dot grid (regular in projected space)
    step = 1.0
    gx = np.arange(LON0 + step / 2, LON1, step); gy = np.arange(Y0 + step / 2, Y1, step)
    XX, YY = np.meshgrid(gx, gy); P = np.c_[XX.ravel(), YY.ravel()]
    full_land = [r for r in land_full]  # test against unsimplified land for accurate dots
    lm = inside_mask(full_land, P).reshape(XX.shape)
    cm = inside_mask(china_full, P).reshape(XX.shape) & lm
    print('dots', int(lm.sum()), 'china dots', int(cm.sum()))

    # sea route (lon, lat) -> keep off land
    WP = [(114.2, 21.7), (113.2, 18.2), (110.6, 12.5), (107.8, 7.2), (105.4, 2.7), (104.5, 1.36), (103.95, 1.23), (103.4, 1.32), (102.4, 2.0),
          (100.6, 3.3), (98.6, 5.1), (95.4, 6.0), (88.0, 4.6), (80.8, 3.6), (72.0, -2.5), (61.0, -13.5),
          (53.5, -24.5), (45.0, -32.0), (33.0, -36.2), (24.0, -37.2), (17.6, -35.6), (13.6, -30.0),
          (11.4, -21.0), (10.2, -12.0), (8.4, -4.0), (7.3, -0.4), (7.2, 1.0), (7.75, 1.95)]
    wp = [proj(*p) for p in WP]
    route = catmull(wp, 16)
    R = np.array(route)
    on = inside_mask(land_full, R)
    bad = [(i, R[i]) for i in range(len(R)) if on[i]]
    print('route pts', len(R), 'on land', len(bad))
    for i, p in bad[:30]: print('   on land', i, round(p[0], 2), round(-p[1], 2))
    # fine check between samples
    L = np.hypot(*np.diff(R, axis=0).T).sum(); print('route length (deg units)', round(L, 1))

    # compact
    q = lambda v: int(round(v * 10))
    js = {
        'land': [[c for p in r for c in (q(p[0]), q(p[1]))] for r in land],
        'china': [[c for p in r for c in (q(p[0]), q(p[1]))] for r in china],
        'dots': runs_of(lm), 'cdots': runs_of(cm),
        'grid': {'x0': round(gx[0], 4), 'y0': round(gy[0], 4), 'step': step},
        'route': [c for p in route for c in (int(round(p[0] * 100)), int(round(p[1] * 100)))],
        'pts': {'origin': [q(v) for v in proj(113.6, 22.6)], 'dest': [q(v) for v in proj(9.8, 4.2)]},
        'bbox': [LON0, Y0, LON1, Y1],
    }
    s = json.dumps(js, separators=(',', ':'))
    open(OUT, 'w').write('// generated by tools/map/bake.py from Natural Earth 1:50m (public domain). Mercator, 1/10 degree units.\n'
                         'window.BZ_MAP = ' + s + ';\n')
    print('wrote', OUT, len(s) // 1024, 'KB')

    # debug plot
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(14, 10))
    for r in land:
        a = np.array(r); ax.fill(a[:, 0], -a[:, 1], color='#ddd', ec='k', lw=.4)
    for r in china:
        a = np.array(r); ax.fill(a[:, 0], -a[:, 1], color='#fc8', ec='orange', lw=.6)
    ax.plot(R[:, 0], -R[:, 1], 'b-', lw=1); ax.plot(np.array(wp)[:, 0], -np.array(wp)[:, 1], 'r.', ms=5)
    if bad: ax.plot([p[0] for _, p in bad], [-p[1] for _, p in bad], 'rx')
    ax.set_xlim(-5, 125); ax.set_ylim(-45, 55); ax.set_aspect('equal'); ax.grid(True, lw=.3)
    plt.savefig(os.path.join(HERE, 'bake_debug.png'), dpi=70, bbox_inches='tight')
    fig, ax = plt.subplots(1, 3, figsize=(18, 7))
    for a_, box in zip(ax, [(95, 120, -5, 25), (0, 30, -40, 8), (4, 14, -2, 7)]):
        for r in land_full:
            a = np.array(r)
            if a[:, 0].max() < box[0] or a[:, 0].min() > box[1]: continue
            a_.fill(a[:, 0], -a[:, 1], color='#ddd', ec='k', lw=.4)
        a_.plot(R[:, 0], -R[:, 1], 'b.-', lw=1, ms=2)
        a_.set_xlim(box[0], box[1]); a_.set_ylim(-MERC(box[2]) if False else box[2] * 1.05, box[3] * 1.05); a_.set_aspect('equal'); a_.grid(True, lw=.3)
    plt.savefig(os.path.join(HERE, 'bake_route.png'), dpi=60, bbox_inches='tight')


if __name__ == '__main__':
    main()
