#!/usr/bin/env python3
"""Bake Natural Earth 1:110 m land (public domain, assets/map/ne_110m_land.geojson) into 40_map.js.

Projection of SERIE §5.1 B (screen px, before the slow push): x = 60 + 7.833·lon, y = 600 + 7.833·(40 − lat).
- every ring is clipped (Sutherland-Hodgman) to the box x −120…1200, y −120…2040: the push only zooms IN about
  (540, 800), so the clip edges never show;
- Antarctica (every point south of 55° S) is dropped: it would lie under the text block (y 1360–1500);
- coordinates are written as integers in 1/4 px (x·4, y·4), one flat array per ring, into the line
  `const LAND = [...];` of overlay/scenes/40_map.js (replaced in place).
Checks: Douala (9.70 E, 4.05 N) and Guangzhou (113.26 E, 23.13 N) must fall on land.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.abspath(os.path.join(HERE, '..'))
SRC = os.path.join(P, 'assets', 'map', 'ne_110m_land.geojson')
DST = os.path.join(P, 'overlay', 'scenes', '40_map.js')
K, X0, Y0, LAT0 = 7.833, 60.0, 600.0, 40.0
BX0, BY0, BX1, BY1 = -120.0, -120.0, 1200.0, 2040.0
Q = 4


def proj(lon, lat):
    return (X0 + K * lon, Y0 + K * (LAT0 - lat))


def clip(pts):
    def run(pts, inside, inter):
        out = []
        if not pts:
            return out
        prev = pts[-1]
        for cur in pts:
            if inside(cur):
                if not inside(prev):
                    out.append(inter(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(inter(prev, cur))
            prev = cur
        return out
    ix = lambda a, b, x: (x, a[1] + (x - a[0]) / (b[0] - a[0]) * (b[1] - a[1]))
    iy = lambda a, b, y: (a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]), y)
    pts = run(pts, lambda p: p[0] >= BX0, lambda a, b: ix(a, b, BX0))
    pts = run(pts, lambda p: p[0] <= BX1, lambda a, b: ix(a, b, BX1))
    pts = run(pts, lambda p: p[1] >= BY0, lambda a, b: iy(a, b, BY0))
    pts = run(pts, lambda p: p[1] <= BY1, lambda a, b: iy(a, b, BY1))
    return pts


def inside(pt, ring):
    x, y, c = pt[0], pt[1], False
    for i in range(len(ring)):
        x1, y1 = ring[i]; x2, y2 = ring[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def main():
    d = json.load(open(SRC))
    rings, npt = [], 0
    for f in d['features']:
        g = f['geometry']
        polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        for poly in polys:
            for r in poly[:1]:                                  # 110 m land has no holes worth drawing
                if max(p[1] for p in r) < -55:
                    continue                                    # Antarctica
                pts = clip([proj(*p[:2]) for p in r])
                if len(pts) < 3:
                    continue
                q = []
                for x, y in pts:
                    v = (int(round(x * Q)), int(round(y * Q)))
                    if not q or v != q[-1]:
                        q.append(v)
                if len(q) >= 3:
                    rings.append(q); npt += len(q)
    for name, ll in (('Douala', (9.70, 4.05)), ('Guangzhou', (113.26, 23.13))):
        p = proj(*ll); pq = (p[0] * Q, p[1] * Q)
        on = any(inside(pq, r) for r in rings)
        print(f'{name}: ({p[0]:.1f}, {p[1]:.1f}) on land: {on}')
        if not on:
            sys.exit(f'{name} is not on land')
    flat = '[' + ','.join('[' + ','.join(f'{x},{y}' for x, y in r) + ']' for r in rings) + ']'
    src = open(DST).read()
    line = f'const LAND = {flat};   // tools/bake_land.py: {len(rings)} rings, {npt} points, 1/{Q} px'
    new, n = re.subn(r'^  const LAND = .*$', lambda m: '  ' + line, src, count=1, flags=re.M)
    if n != 1:
        sys.exit('marker line `  const LAND = …` not found in 40_map.js')
    open(DST, 'w').write(new)
    print(f'{len(rings)} rings, {npt} points, {len(flat) / 1024:.1f} KiB → {os.path.relpath(DST, P)}')


if __name__ == '__main__':
    main()
