"""Kokoro (ff_siwis, native French female) narration for every VO segment + a voice reference clip."""
import json, os, sys, numpy as np, soundfile as sf, torch
torch.set_num_threads(2)
from kokoro import KPipeline
E = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
p = KPipeline(lang_code='f')
def say(text, path, speed=0.98):
    y = np.concatenate([np.asarray(a) for _, _, a in p(text, voice='ff_siwis', speed=speed)])
    sf.write(path, y, 24000); return len(y) / 24000
segs = json.load(open(os.path.join(E, 'data', 'script.json')))['segments']
for s in segs:
    if s['kind'] != 'vo': continue
    d = say(s['text'], os.path.join(E, 'audio', 'vo_kokoro', s['id'] + '.wav'))
    print(s['id'], round(d, 2), flush=True)
say("Bonjour et bienvenue. Aujourd'hui, nous allons découvrir ensemble le parcours de vos marchandises, depuis la Chine jusqu'à notre entrepôt, en toute simplicité.",
    os.path.join(E, 'audio', 'voice_ref.wav'), speed=0.97)
