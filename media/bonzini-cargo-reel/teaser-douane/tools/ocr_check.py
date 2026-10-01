"""OCR every frame of a folder; report any recognised text containing a digit (teaser rule: no digits) and forbidden words."""
import sys, glob, os, re
from rapidocr_onnxruntime import RapidOCR
ocr = RapidOCR()
BAD = re.compile(r"(transf|envoy|gratuit|premier|seul|récup|rembours|économ|franc près|pas un franc|2026)", re.I)
hits = 0
for f in sorted(glob.glob(os.path.join(sys.argv[1], '*.jpg'))):
    res, _ = ocr(f)
    for box, txt, conf in (res or []):
        if conf < .5: continue
        if re.search(r'\d', txt) or BAD.search(txt):
            hits += 1; print(os.path.basename(f), round(int(os.path.basename(f)[:5]) / 30, 2), repr(txt), round(conf, 2))
print('HITS', hits)
