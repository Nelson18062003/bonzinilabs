"""sticker_sheet.py — the burned-in stickers of v1–v3 against their static masks over the used ranges: source frames
(ffmpeg, as prep extracts them) with the 8-px-dilated mask contour (green) and the crop extent of the shot (yellow).
A sticker that moved would show outside its green contour. usage: python3 tools/sticker_sheet.py → out/stickers_vN.jpg"""
import os, json, subprocess
import numpy as np, cv2
HERE = os.path.dirname(os.path.abspath(__file__)); P = os.path.abspath(os.path.join(HERE, '..'))
SHOTS = {'v1': [('G1', 75.40, 78.15, (188, 319, 464, 541)), ('G2', 16.0, 19.35, (188, 395, 464, 545)), ('CG', 83.9, 86.5, (188, 287, 464, 570)),
                ('G7', 9.1, 11.25, (188, 306, 464, 594)), ('G8', 13.9, 15.45, (188, 328, 464, 612)), ('G9', 90.0, 91.2, (188, 395, 464, 545)),
                ('G10', 19.4, 21.65, (188, 326, 464, 614))],
         'v2': [('G3', 0.1, 2.35, (0, 212, 464, 688)), ('G4', 6.55, 7.53, (0, 192, 464, 668))],
         'v3': [('PN', 0.3, 2.4, (0, 25, 464, 262))]}
for clip, shots in SHOTS.items():
    m = cv2.imread(os.path.join(P, '..', 'work', f'static_mask_{clip}.png'), 0) > 127
    m = cv2.dilate(m.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17)))
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    tiles = []
    for sid, a, b, (x0, y0, x1, y1) in shots:
        for t in np.linspace(a, b, 4):
            raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t:.3f}', '-i', os.path.join(P, '..', 'src', f'{clip}.mp4'), '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], capture_output=True).stdout
            im = np.frombuffer(raw, np.uint8).reshape(832, 464, 3).copy()
            cv2.drawContours(im, cs, -1, (0, 255, 0), 1); cv2.rectangle(im, (x0, y0), (x1 - 1, y1), (0, 255, 255), 2)
            cv2.putText(im, f'{sid} r {t:.2f}', (6, 20), cv2.FONT_HERSHEY_SIMPLEX, .55, (0, 255, 255), 2); tiles.append(cv2.resize(im, (232, 416)))
    rows = [np.hstack(tiles[i:i + 8] + [np.zeros_like(tiles[0])] * (8 - len(tiles[i:i + 8]))) for i in range(0, len(tiles), 8)]
    out = os.path.join(P, 'out', f'stickers_{clip}.jpg'); cv2.imwrite(out, np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 85]); print(out)
