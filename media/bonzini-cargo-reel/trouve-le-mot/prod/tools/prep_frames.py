"""prep_frames.py — storyboard § 5.1 (frames) + § 5.3 (zoom layer) for « TROUVE LE MOT. ».

usage:  nice -n 5 python3 -P tools/prep_frames.py PROD_DIR [--only frames|zoom|shade] [--frames A-B] [--workers N]

Reads  ../src_frames/0000…0298.png (464×832, frame i = r i/30) and ../work/label_track.json (relative to PROD_DIR).
Writes PROD_DIR/assets/rush/f_0000…0298.jpg   1080×1920, JPEG q92 4:4:4
       PROD_DIR/assets/rush/shade_bag_f0060.png, shade_bag_f0228.png   (bag darkening for the freezes, see below)
       PROD_DIR/assets/rush/masks.json        (what was baked, in source and screen px)
       PROD_DIR/assets/zoom/r100_x4.png       RGBA, single bicubic pass ×(4·1080/464) of frame 30, graded, mosaic, feathered
       PROD_DIR/assets/zoom/r100_x4.json      its exact geometry

Geometry (exact, isotropic): S = 1080/464 = 2.327586…  screen = source·S − (0, 8)   (edge convention, both axes;
the bottom loses 8.55 px). The ×1 frame and the zoom layer share this map, so the layer drops exactly on the frame.

Per frame: Lanczos (PIL, a=3, one pass with a sub-pixel box) → soft sharpen (gaussian σ 1.0 screen px, amount .35,
never on the red polo / saturated reds) → baked blurs (feathered rectangles, keyframed every 3 frames, linearly
interpolated; normalised convolution that leaves the employee — red polo, his text, hair — untouched) → grade
(shadows +6 %, warm, saturation +5 %, no highlight change: the red tail light stays red) → JPEG.
No Real-ESRGAN, no AI, no stabilisation, nothing redrawn. Deterministic (no randomness)."""
import json, os, sys, math, argparse
import numpy as np, cv2
from PIL import Image

S = 1080 / 464          # source → screen
TOP = 8.0               # rows cropped at the top (screen px)
W1, H1 = 1080, 1920
N_FRAMES = 299
SHARP_SIGMA, SHARP_AMT = 1.0, 0.35
LIFT, SAT, WARM = 0.06, 1.05, (1.02, 1.0, 0.965)

# ---------------------------------------------------------------------------------------------------------------
# Baked soft blurs, rush r 2.9–5.6 (frames 87–168). Rectangles in SOURCE px (x0, y0, x1, y1), keyframes every 3
# frames (placed by eye, seeded by template tracking of each object, then widened until the linear interpolation
# covers the object on every frame), feathered (gaussian σ FEATHER source px). sigma = blur σ in source px.
# protect = keep the employee (red polo + its print, hair, dark trousers) sharp inside the rectangle.
# S0a/S0b  yellow light-box shop sign above the street (both whip pans)
# S1       hanging dark-blue « 5G SIM CARD 719 » sign            S2  blue « SIM CARD » sign + Chinese text at the door
# PO       small blue operator-logo plate left of the door       TL  operator-logo column (blue disc, red crosses)
# DL       « 5G SIM CARD » lettering on the glass door           L   green leaf sticker on the white scooter
FEATHER = 5.0
OBJ = {
    'S0a': dict(sigma=6.0, protect=False, kf={84: (470, 112, 560, 292), 87: (370, 72, 478, 292), 90: (247, 76, 478, 295), 93: (94, 74, 346, 297), 96: (-14, 56, 198, 283), 99: (-14, 82, 60, 266)}),
    'S0b': dict(sigma=6.0, protect=False, kf={147: (-14, 64, 65, 267), 150: (-14, 28, 187, 264), 153: (103, 11, 306, 251), 156: (216, -11, 405, 228), 159: (308, -24, 478, 227), 162: (374, 5, 478, 230), 165: (424, 71, 478, 216)}),
    'S1': dict(sigma=5.0, protect=False, kf={96: (379, 92, 592, 232), 99: (297, 64, 486, 204), 102: (227, 40, 387, 187), 105: (175, 14, 317, 161), 108: (148, -6, 264, 132), 111: (118, -20, 238, 117), 114: (98, -30, 209, 104), 117: (82, -36, 189, 96), 120: (74, -39, 173, 90), 123: (71, -42, 164, 89), 126: (72, -48, 167, 84), 129: (76, -48, 170, 80), 132: (79, -48, 180, 86), 135: (89, -38, 199, 100), 138: (108, -22, 235, 116), 141: (146, -4, 309, 137), 144: (218, 13, 386, 150), 147: (295, 17, 494, 152), 150: (422, 19, 560, 152)}),
    'S2': dict(sigma=5.0, protect=True, kf={99: (437, 61, 600, 228), 102: (354, 41, 484, 215), 105: (302, 17, 414, 192), 108: (276, -1, 362, 166), 111: (248, -14, 337, 152), 114: (231, -26, 310, 139), 117: (217, -35, 293, 128), 120: (211, -42, 279, 119), 123: (210, -45, 273, 113), 126: (212, -51, 277, 110), 129: (216, -51, 280, 106), 132: (219, -51, 290, 112), 135: (229, -41, 309, 126), 138: (248, -25, 345, 142), 141: (286, -7, 419, 163), 144: (358, 10, 496, 176), 147: (435, 16, 598, 178)}),
    'PO': dict(sigma=5.0, protect=True, kf={99: (403, 210, 540, 266), 102: (320, 190, 424, 253), 105: (268, 166, 354, 230), 108: (242, 148, 302, 204), 111: (214, 135, 277, 190), 114: (197, 123, 250, 177), 117: (183, 114, 233, 166), 120: (177, 107, 219, 157), 123: (176, 104, 213, 151), 126: (178, 98, 217, 148), 129: (182, 98, 220, 144), 132: (185, 98, 230, 150), 135: (195, 108, 249, 164), 138: (214, 124, 285, 180), 141: (252, 142, 359, 201), 144: (324, 159, 436, 214), 147: (401, 165, 538, 216)}),
    'TL': dict(sigma=5.0, protect=True, kf={111: (338, 135, 405, 242), 114: (318, 125, 376, 229), 117: (302, 120, 356, 222), 120: (296, 112, 340, 215), 123: (295, 105, 335, 208), 126: (297, 97, 340, 200), 129: (304, 90, 346, 192), 132: (308, 90, 354, 192), 135: (316, 96, 371, 202), 138: (333, 108, 404, 214), 141: (368, 118, 478, 238), 144: (438, 164, 553, 280), 147: (515, 174, 655, 276)}),
    'DL': dict(sigma=5.0, protect=True, kf={114: (332, 195, 445, 279), 117: (316, 190, 425, 272), 120: (310, 182, 409, 265), 123: (309, 175, 404, 258), 126: (311, 167, 409, 250), 129: (318, 160, 415, 242), 132: (322, 160, 423, 242), 135: (330, 166, 440, 252), 138: (347, 178, 473, 264), 141: (382, 188, 547, 288), 144: (452, 234, 622, 330), 147: (529, 244, 724, 326)}),
    'L': dict(sigma=3.5, protect=False, kf={96: (411, 449, 551, 517), 99: (316, 423, 454, 481), 102: (256, 401, 355, 463), 105: (207, 380, 294, 439), 108: (183, 363, 246, 417), 111: (157, 354, 221, 404), 114: (144, 348, 196, 396), 117: (134, 345, 183, 391), 120: (128, 344, 173, 388), 123: (127, 343, 168, 388), 126: (128, 341, 169, 386), 129: (130, 339, 172, 384), 132: (134, 339, 181, 387), 135: (142, 346, 199, 396), 138: (160, 355, 231, 405), 141: (194, 366, 297, 418), 144: (258, 377, 367, 428), 147: (328, 386, 462, 433), 150: (435, 396, 531, 454)}),
    # added by the integration pass (12/10): the red slogan banner with white Chinese characters (it names a province
    # programme, maybe the city: never shown legible, STORYBOARD § 4.1) — colour-tracked, r 6.17–9.93, rows bottom-padded
    # for the parts the car roof hides; and the small white sign with Latin letters in the window right of it (template
    # tracked from frame 270, r 8.9–9.93; behind the van door before that)
    'BN': dict(sigma=4.0, protect=False, kf={185: (-14, 218, 23, 314), 188: (-14, 218, 37, 314), 191: (-14, 216, 47, 312), 194: (-14, 210, 60, 306), 197: (-14, 202, 70, 298), 200: (-14, 199, 82, 295), 203: (-14, 199, 98, 295), 206: (-14, 200, 114, 296), 209: (-14, 202, 122, 298), 212: (-14, 205, 134, 301), 215: (-14, 210, 144, 306), 218: (-14, 216, 148, 312), 221: (-14, 220, 142, 316), 224: (-14, 224, 135, 320), 227: (-14, 230, 129, 326), 230: (-14, 236, 122, 332), 233: (-14, 242, 116, 338), 236: (-14, 248, 110, 344), 239: (-14, 252, 105, 348), 242: (-14, 256, 100, 352), 245: (-14, 258, 96, 354), 248: (-14, 260, 96, 356), 251: (-14, 258, 99, 354), 254: (-14, 258, 106, 354), 257: (-14, 253, 112, 349), 260: (-14, 251, 118, 347), 263: (-14, 250, 121, 346), 266: (-14, 248, 120, 344), 269: (-14, 248, 118, 344), 272: (-14, 239, 114, 335), 275: (-14, 230, 109, 326), 278: (-14, 220, 105, 316), 281: (-14, 210, 101, 306), 284: (-14, 206, 97, 302), 287: (-14, 199, 91, 295), 290: (-14, 191, 84, 287), 293: (-14, 186, 77, 282), 296: (-14, 182, 66, 278), 298: (-14, 179, 59, 275)}),
    'WS': dict(sigma=4.0, protect=False, kf={267: (97, 264, 168, 340), 270: (104, 262, 175, 338), 273: (100, 253, 171, 329), 276: (95, 244, 166, 320), 279: (91, 235, 162, 311), 282: (87, 228, 158, 304), 285: (82, 221, 153, 297), 288: (76, 214, 147, 290), 291: (69, 206, 140, 282), 294: (62, 202, 133, 278), 297: (51, 195, 122, 271), 298: (48, 194, 119, 270)}),
}
# Employee keep-out for the blurs (r 3.4–4.9): his head is lit blue by the shop like the signs, so colour cannot
# separate it — an ellipse per keyframe (cx, cy, rx, ry, source px, placed by eye every 3 frames, interpolated) is
# added to the protection mask, with the polo and the darker pixels hugging it (arms). He is never blurred.
HEAD = {100: (500, 213, 24, 26), 103: (452, 200, 24, 26), 106: (396, 180, 24, 26), 109: (370, 166, 24, 26),
        112: (350, 164, 24, 26), 115: (324, 164, 24, 26), 118: (308, 168, 24, 26), 121: (300, 171, 24, 26),
        124: (288, 178, 24, 26), 127: (280, 176, 24, 26), 130: (277, 175, 24, 26), 133: (272, 191, 24, 26),
        136: (277, 208, 24, 26), 139: (296, 223, 24, 26), 142: (365, 238, 24, 26), 145: (438, 247, 24, 26),
        148: (500, 250, 24, 26)}
# Car plates r 5.6–9.9: checked at 1:1 and ×4 — none visible (the neighbouring car shows only its flank/grille,
# the van's bumper carries a latch, not a plate) → no plate mask.

# Bag darkening for the freezes (§ 5.1: « sac marron assombri de 25 % sur r 2,00 et r 7,60 »). Delivered as shade
# PNGs (black, alpha ≤ .25, feathered INSIDE the polygon, ≥ 4 px clear of the label) so the engine can ramp it in
# at the freeze instead of baking it into a frame that also plays at speed. Polygons in SOURCE px.
BAG = {
    60: [(25, 520), (40, 500), (62, 488), (95, 486), (118, 492), (138, 504), (150, 512), (155, 530), (151, 552),
         (140, 580), (120, 592), (60, 594), (35, 585), (25, 560)],
    228: [(180, 520), (190, 500), (215, 488), (245, 484), (270, 488), (291, 495), (293, 530), (289, 565), (275, 585),
          (240, 590), (205, 588), (185, 575), (178, 550)],
}
BAG_DARK = 0.25

# Zoom layer (§ 5.3). Source rect chosen so that width·k and height·k are integers (k = 4S = 270/29).
ZOOM_FRAME = 30
ZOOM_RECT = (90, 385, 174, 261)          # x, y, w, h (source px) → 1620 × 2430 layer px
ZOOM_FEATHER = 6.0                       # source px of alpha ramp inside the rect border
MOSAIC_BLOCK = 22                        # layer px (= screen px at ×4)
# « BONZINI » ink occupies source rows 509–513 (edge coords 509–514; on the right 508.5–512), row 514 is the light gap,
# « TRADING » starts on row 515 (measured on the raw grey values of frame 30). The mosaic polygon starts at the bottom
# of that gap (y 515.0 at x 155 → 514.6 at x 204) and follows the white card's right/bottom edge with ≈ 1.5 px margin:
# TRADING + the 3rd line + the card's lower edge are mosaicked; nothing above the line is touched. Block colours are
# averaged ONLY over pixels inside the polygon, so the BONZINI letters do not bleed into the blocks.
MOSAIC_POLY = [(155, 515.0), (204, 514.6), (203.5, 517), (201.5, 520), (198.5, 522.5), (194, 524.5), (188, 525.5),
               (155, 526.5)]


def to_screen(x, y):
    return x * S, y * S - TOP


def load_src(root, i):
    return Image.open(os.path.join(root, 'src_frames', '%04d.png' % i)).convert('RGB')


def upscale(im):
    """One Lanczos pass, exact sub-pixel crop: screen = src·S − (0, 8)."""
    y0 = TOP / S
    return im.resize((W1, H1), Image.LANCZOS, box=(0.0, y0, 464.0, y0 + H1 / S))


def grade(x):
    """x float32 RGB 0..1 (sRGB-encoded). Shadows +6 % (peak at 25 % grey, 0 at black and white), warm, sat +5 %."""
    x = x + LIFT * (256 / 27) * x * (1 - x) ** 3
    x = x * np.array(WARM, np.float32)
    y = x @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    x = y[..., None] + SAT * (x - y[..., None])
    return np.clip(x, 0, 1)


def person_masks(src_rgb, i):
    """(polo, protect) at source res, float 0..1. polo = saturated red regions with their print filled in (closing);
    protect = polo ∪ very dark pixels ∪ non-bright pixels within 14 px of the polo (arms, neck) ∪ head ellipse."""
    bgr = cv2.cvtColor(src_rgb, cv2.COLOR_RGB2BGR)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    red = (((h <= 8) | (h >= 172)) & (s >= 110) & (v >= 60)).astype(np.uint8)
    red = cv2.morphologyEx(red, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    n, lab, st, _ = cv2.connectedComponentsWithStats(red)
    keep = np.zeros(n, np.uint8); keep[1:] = st[1:, 4] >= 120
    polo = keep[lab]
    near = cv2.dilate(polo, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (29, 29)))
    prot = polo | (v < 70).astype(np.uint8) | (near & (v < 140)).astype(np.uint8)
    e = rect_at(HEAD, i)
    if e is not None:
        cv2.ellipse(prot, (int(round(e[0])), int(round(e[1]))), (int(round(e[2])), int(round(e[3]))), 0, 0, 360, 1, -1)
    prot = cv2.morphologyEx(prot, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    prot = cv2.dilate(prot, np.ones((3, 3), np.uint8)).astype(np.float32)
    polo = cv2.dilate(polo, np.ones((3, 3), np.uint8)).astype(np.float32)
    return cv2.GaussianBlur(polo, (0, 0), 1.0), cv2.GaussianBlur(prot, (0, 0), 1.0)


def up_mask(m):
    """source-res mask → screen-res, same geometry as upscale()."""
    M = np.float32([[S, 0, 0.5 * S - 0.5], [0, S, 0.5 * S - 0.5 - TOP]])
    return cv2.warpAffine(m, M, (W1, H1), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def rect_at(kf, i):
    ks = sorted(kf)
    if i < ks[0] or i > ks[-1]:
        return None
    for k0, k1 in zip(ks, ks[1:]):
        if k0 <= i <= k1:
            w = (i - k0) / (k1 - k0)
            return tuple(a * (1 - w) + b * w for a, b in zip(kf[k0], kf[k1]))
    return tuple(kf[ks[-1]])


def _erf_ramp(n, a, b, sig):
    t = np.arange(n, dtype=np.float64) + 0.5
    e = np.vectorize(math.erf)
    return (0.5 * (e((t - a) / (math.sqrt(2) * sig)) - e((t - b) / (math.sqrt(2) * sig)))).astype(np.float32)


def apply_blur(img, prot, rect_src, sigma_src, protect):
    """Feathered gaussian-blur rectangle, in place on img (float32 H×W×3, screen res)."""
    x0, y0 = to_screen(rect_src[0], rect_src[1]); x1, y1 = to_screen(rect_src[2], rect_src[3])
    fs, bs = FEATHER * S, sigma_src * S
    pad = int(3 * fs + 3 * bs) + 2
    X0, Y0 = max(0, int(x0) - pad), max(0, int(y0) - pad)
    X1, Y1 = min(W1, int(math.ceil(x1)) + pad), min(H1, int(math.ceil(y1)) + pad)
    if X1 <= X0 or Y1 <= Y0:
        return
    sub = img[Y0:Y1, X0:X1]
    ax = _erf_ramp(X1 - X0, x0 - X0, x1 - X0, fs); ay = _erf_ramp(Y1 - Y0, y0 - Y0, y1 - Y0, fs)
    a = ay[:, None] * ax[None, :]
    if a.max() < 1e-3:
        return
    if protect:
        w = 1.0 - prot[Y0:Y1, X0:X1]
        num = cv2.GaussianBlur(sub * w[..., None], (0, 0), bs, borderType=cv2.BORDER_REFLECT)
        den = cv2.GaussianBlur(w, (0, 0), bs, borderType=cv2.BORDER_REFLECT)
        bl = num / np.maximum(den, 1e-4)[..., None]
        a = a * w * np.clip(den * 4, 0, 1)      # no blur where the window has no unprotected pixel to draw from
    else:
        bl = cv2.GaussianBlur(sub, (0, 0), bs, borderType=cv2.BORDER_REFLECT)
    img[Y0:Y1, X0:X1] = sub * (1 - a[..., None]) + bl * a[..., None]


def process_frame(root, out_dir, i):
    im = load_src(root, i)
    src = np.asarray(im)
    img = np.asarray(upscale(im), np.float32) / 255.0
    polo, prot = person_masks(src, i)
    polo_s, prot_s = up_mask(polo), up_mask(prot)
    # soft sharpen, never on the polo / saturated reds
    hp = img - cv2.GaussianBlur(img, (0, 0), SHARP_SIGMA)
    img = img + (SHARP_AMT * (1 - polo_s))[..., None] * hp
    img = np.clip(img, 0, 1)
    used = []
    for name, o in OBJ.items():
        r = rect_at(o['kf'], i)
        if r is None:
            continue
        apply_blur(img, prot_s, r, o['sigma'], o['protect'])
        used.append(name)
    img = grade(img)
    out = Image.fromarray((img * 255 + 0.5).astype(np.uint8))
    out.save(os.path.join(out_dir, 'f_%04d.jpg' % i), quality=92, subsampling=0, optimize=True)
    return i, used


def poly_mask(shape, pts, scale, off):
    """anti-aliased filled polygon (×8 supersampling via cv2 shift)."""
    m = np.zeros(shape, np.uint8)
    p = np.array([[(x - off[0]) * scale * 256, (y - off[1]) * scale * 256] for x, y in pts], np.int64)
    cv2.fillPoly(m, [p.astype(np.int32)], 255, lineType=cv2.LINE_AA, shift=8)
    return m.astype(np.float32) / 255.0


def make_shades(root, out_dir):
    info = {}
    for f, poly in BAG.items():
        pts = [to_screen(x, y) for x, y in poly]
        m = poly_mask((H1, W1), pts, 1.0, (0, 0))
        # feather INSIDE the polygon: erode by ~2σ then blur
        sig = 3.0 * S
        m = cv2.erode((m > .5).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(4 * sig) | 1,) * 2)).astype(np.float32)
        m = cv2.GaussianBlur(m, (0, 0), sig)
        rgba = np.zeros((H1, W1, 4), np.uint8)
        rgba[..., 3] = np.round(m * BAG_DARK * 255).astype(np.uint8)
        name = 'shade_bag_f%04d.png' % f
        Image.fromarray(rgba, 'RGBA').save(os.path.join(out_dir, name), optimize=True)
        info[name] = dict(frame=f, r=round(f / 30, 3), darken=BAG_DARK, polygon_src=poly,
                          polygon_screen=[[round(a, 1), round(b, 1)] for a, b in pts])
    return info


def make_zoom(root, zdir, label_track):
    k = 4 * S
    x, y, w, h = ZOOM_RECT
    Wl, Hl = round(w * k), round(h * k)
    assert abs(w * k - Wl) < 1e-6 and abs(h * k - Hl) < 1e-6
    im = load_src(root, ZOOM_FRAME)
    lay = im.resize((Wl, Hl), Image.BICUBIC, box=(float(x), float(y), float(x + w), float(y + h)))  # ONE pass
    a = grade(np.asarray(lay, np.float32) / 255.0)
    # mosaic below the BONZINI line
    mm = poly_mask((Hl, Wl), MOSAIC_POLY, k, (x, y))
    B = MOSAIC_BLOCK
    gh, gw = math.ceil(Hl / B), math.ceil(Wl / B)
    ph, pw = gh * B - Hl, gw * B - Wl
    ap_ = np.pad(a * mm[..., None], ((0, ph), (0, pw), (0, 0)))
    mp_ = np.pad(mm, ((0, ph), (0, pw)))
    num = ap_.reshape(gh, B, gw, B, 3).sum(axis=(1, 3)); den = mp_.reshape(gh, B, gw, B).sum(axis=(1, 3))
    blocks = num / np.maximum(den, 1e-6)[..., None]
    mos = np.repeat(np.repeat(blocks, B, 0), B, 1)[:Hl, :Wl]
    a = a * (1 - mm[..., None]) + mos * mm[..., None]
    # alpha: opaque inside, smooth ramp over the outer ZOOM_FEATHER source px
    fz = ZOOM_FEATHER * k
    def ramp(n):
        t = np.arange(n, dtype=np.float32) + 0.5
        d = np.minimum(t, n - t) / fz
        d = np.clip(d, 0, 1)
        return d * d * (3 - 2 * d)
    alpha = ramp(Hl)[:, None] * ramp(Wl)[None, :]
    rgba = np.dstack([np.round(a * 255).astype(np.uint8), np.round(alpha * 255).astype(np.uint8)])
    Image.fromarray(rgba, 'RGBA').save(os.path.join(zdir, 'r100_x4.png'), optimize=True)
    # geometry
    lt = next(f for f in label_track['frames'] if f['f'] == ZOOM_FRAME)
    lab_trk = [lt['x'], lt['y'], lt['w'], lt['h']]
    lab_white = [157.0, 502.5, 49.0, 23.5]        # white card measured on frame 30 (x 157–206, y 502.5–526)
    cx, cy = lab_white[0] + lab_white[2] / 2, lab_white[1] + lab_white[3] / 2
    s1 = lambda r: [round(r[0] * S, 2), round(r[1] * S - TOP, 2), round(r[2] * S, 2), round(r[3] * S, 2)]
    L = lambda r: [round((r[0] - x) * k, 2), round((r[1] - y) * k, 2), round(r[2] * k, 2), round(r[3] * k, 2)]
    fsrc = ZOOM_FEATHER
    geo = {
        'image': 'r100_x4.png', 'size': [Wl, Hl], 'frame': ZOOM_FRAME, 'r': ZOOM_FRAME / 30,
        'how': 'src_frames/%04d.png → ONE bicubic pass (PIL BICUBIC, a=-0.5) ×%.6f, same grade as the frames, no sharpen, '
               'no AI; mosaic %d-px blocks below the BONZINI line; RGBA (alpha ramps to 0 over the outer %.0f source px)'
               % (ZOOM_FRAME, k, MOSAIC_BLOCK, ZOOM_FEATHER),
        'S': S, 'top_crop': TOP, 'k_src_to_layer': k, 'layer_px_per_screen1_px': 4.0,
        'src_rect': [x, y, w, h],
        'screen1_rect': s1(ZOOM_RECT),
        'screen1_rect_opaque': s1([x + fsrc, y + fsrc, w - 2 * fsrc, h - 2 * fsrc]),
        'draw': 'in the coordinate system of the ×1 frame (the 1080×1920 f_0030.jpg drawn at 0,0), '
                'drawImage(layer, 0, 0, %d, %d, %s) — i.e. same transform as the frame, layer = exactly 4× the frame '
                'pixels. Keep drawing the ×1 frame underneath: the layer only covers screen1_rect.' % (Wl, Hl, ', '.join(str(v) for v in s1(ZOOM_RECT))),
        'label': {
            'track_src': lab_trk, 'track_screen1': s1(lab_trk), 'track_layer': L(lab_trk),
            'white_card_src': lab_white, 'white_card_screen1': s1(lab_white), 'white_card_layer': L(lab_white),
            'centre_src': [cx, cy], 'centre_screen1': [round(cx * S, 2), round(cy * S - TOP, 2)],
            'centre_layer': [round((cx - x) * k, 2), round((cy - y) * k, 2)],
            'bonzini_line_src': 'ink x 158–198, rows 509–513 at left, 508.5–512 at right (edge coords); light gap row 514; TRADING from row 515',
        },
        'x4_placement': {
            'note': 'white-card centre at screen (540, 1020), scale 4 → layer top-left on screen (screen px = layer px):',
            'layer_topleft_screen': [round(540 - (cx - x) * k, 2), round(1020 - (cy - y) * k, 2)],
            'visible_src_at_x4': [round(cx - 540 / k, 1), round(cy - 1020 / k, 1), round(cx + 540 / k, 1), round(cy + 900 / k, 1)],
            'inside_opaque': True,
        },
        'mosaic': {'block_layer_px': MOSAIC_BLOCK, 'block_screen_px_at_x4': MOSAIC_BLOCK,
                   'polygon_src': MOSAIC_POLY,
                   'polygon_screen1': [[round(px * S, 2), round(py * S - TOP, 2)] for px, py in MOSAIC_POLY],
                   'polygon_layer': [[round((px - x) * k, 2), round((py - y) * k, 2)] for px, py in MOSAIC_POLY],
                   'note': 'baked: visible as soon as the layer shows (fade ×1.4→×1.6), i.e. stricter than « dès ×2 ». '
                           'The ×1 frames are NOT mosaicked (lines unreadable at ×1).'},
    }
    json.dump(geo, open(os.path.join(zdir, 'r100_x4.json'), 'w'), indent=1, ensure_ascii=False)
    return geo


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('prod')
    ap.add_argument('--only', choices=['frames', 'zoom', 'shade'], default=None)
    ap.add_argument('--frames', default=None, help='A-B (inclusive)')
    ap.add_argument('--workers', type=int, default=2)
    a = ap.parse_args()
    P = os.path.abspath(a.prod); root = os.path.dirname(P)
    rdir = os.path.join(P, 'assets', 'rush'); zdir = os.path.join(P, 'assets', 'zoom')
    os.makedirs(rdir, exist_ok=True); os.makedirs(zdir, exist_ok=True)
    track = json.load(open(os.path.join(root, 'work', 'label_track.json')))
    if a.only in (None, 'frames'):
        f0, f1 = (0, N_FRAMES - 1) if not a.frames else map(int, a.frames.split('-'))
        idx = list(range(f0, f1 + 1))
        if a.workers > 1:
            from multiprocessing import Pool
            with Pool(a.workers) as pool:
                res = pool.starmap(process_frame, [(root, rdir, i) for i in idx], chunksize=4)
        else:
            res = [process_frame(root, rdir, i) for i in idx]
        print('frames %d-%d written; blurred frames: %d' % (f0, f1, sum(1 for _, u in res if u)))
        man = {'S': S, 'top_crop': TOP, 'feather_src': FEATHER, 'grade': dict(lift=LIFT, sat=SAT, warm=WARM),
               'sharpen': dict(sigma_screen=SHARP_SIGMA, amount=SHARP_AMT, excluded='saturated reds (polo, tail light)'),
               'objects': {n: dict(sigma_src=o['sigma'], protect=o['protect'],
                                   frames=[min(o['kf']), max(o['kf'])],
                                   keyframes_src={str(k_): list(v) for k_, v in o['kf'].items()}) for n, o in OBJ.items()},
               'plates': 'none readable r 5.6–9.9 → no mask'}
        json.dump(man, open(os.path.join(rdir, 'masks.json'), 'w'), indent=1)
    if a.only in (None, 'shade'):
        info = make_shades(root, rdir)
        json.dump(info, open(os.path.join(rdir, 'shade_bag.json'), 'w'), indent=1)
        print('shades:', ', '.join(info))
    if a.only in (None, 'zoom'):
        g = make_zoom(root, zdir, track)
        print('zoom layer', g['size'], 'placement', g['x4_placement']['layer_topleft_screen'])


if __name__ == '__main__':
    main()
