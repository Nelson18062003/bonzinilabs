"""ASR every available take (cache shared with build_timeline) and score it against the script text."""
import sys, os, glob, difflib, re
sys.path.insert(0, os.path.dirname(__file__)); import build_timeline as B
for p in sorted(glob.glob(os.path.join(B.E, 'audio', 'vo', 'V*_s*.wav'))):
    sid = os.path.basename(p).split('_')[0]; ws = B.words(p); hyp = ' '.join(w['w'] for w in ws)
    a = [B.norm(x) for x in B.TXT[sid].split()]; b = [B.norm(x) for x in hyp.split()]
    r = difflib.SequenceMatcher(None, a, b).ratio()
    print(f"{os.path.basename(p):12s} {r:.2f} {ws[-1]['e']:5.2f}s :: {hyp}", flush=True)
