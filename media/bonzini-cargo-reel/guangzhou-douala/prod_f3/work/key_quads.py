import json, numpy as np
K = {  # hand keys: TL, TR, BR (source px, v7 display); BL = TL + (BR - TR)
 552: [(153.5,526),(224.25,544.75),(191,669.75)],
 553: [(165.5,527.25),(233.5,546),(200.5,672.25)],
 554: [(173.5,530.5),(242.25,550.5),(211,673)],
 555: [(183,531.75),(251.75,550),(216.75,674.25)],
 556: [(194,533),(262.25,551.5),(232.25,675.5)],
 557: [(204.25,534.25),(273,553),(243,676.5)],
 558: [(216,536.75),(284.75,554.25),(254.75,678)],
 559: [(228,538.5),(296.75,556.25),(266.75,679.25)],
 560: [(241,540.5),(309,557.25),(279.75,681)],
 561: [(252.4,543),(322.4,560.5),(293,682)],
}
fs = sorted(K); A = np.array([[*K[f][0], *K[f][1], *K[f][2]] for f in fs], float)
P = 3; pre = [A[0] + (A[0] - A[2]) * (k + 1) / 2 for k in range(P)][::-1]; post = [A[-1] + (A[-1] - A[-3]) * (k + 1) / 2 for k in range(P)]
X = np.vstack([pre, A, post]); n = len(X); s = .8
S = np.array([(np.exp(-.5 * ((np.arange(n) - i) / s) ** 2)[:, None] * X).sum(0) / np.exp(-.5 * ((np.arange(n) - i) / s) ** 2).sum() for i in range(n)])[P:-P]
out = {}
for f, r, a in zip(fs, S, A):
    TL, TR, BR = r[0:2], r[2:4], r[4:6]; BL = TL + (BR - TR)
    out[f'{f/30:.4f}'] = [[round(float(v), 2) for v in p] for p in (TL, TR, BR, BL)]
    print(f, out[f'{f/30:.4f}'], 'dev', np.abs(r - a).max().round(2))
json.dump({'clip': 'v7', 'note': 'phone screen (front face) corners TL TR BR BL, source display px, keyed by hand on every frame r 18.40–18.70 (BL = TL + BR − TR: hidden behind the bald head / out of view), gaussian-smoothed σ 0.8 frame (ends padded linearly)', 'quads': out}, open('work/phone_quad.json', 'w'), indent=1)
