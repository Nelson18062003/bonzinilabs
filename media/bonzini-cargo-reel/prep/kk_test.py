import time, sys, numpy as np, soundfile as sf, torch
torch.set_num_threads(2)
from kokoro import KPipeline
t0 = time.time()
p = KPipeline(lang_code='f')
print('load', round(time.time() - t0, 1), flush=True)
txt = "Étape trois : le transport. Le conteneur traverse l'océan par bateau, puis il continue sa route par camion jusqu'à notre entrepôt."
for speed in (0.95, 1.05):
    t0 = time.time()
    chunks = [a for _, _, a in p(txt, voice='ff_siwis', speed=speed)]
    y = np.concatenate([c.numpy() if hasattr(c, 'numpy') else c for c in chunks])
    sf.write(f'test/kk_{speed}.wav', y, 24000)
    print('speed', speed, 'gen', round(time.time() - t0, 1), 's for', round(len(y) / 24000, 2), 's', flush=True)
