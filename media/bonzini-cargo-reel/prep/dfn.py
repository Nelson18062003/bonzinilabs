import sys, torch, soundfile as sf, numpy as np
from df.enhance import enhance, init_df
model, state, _ = init_df()
for src, dst, atten in zip(sys.argv[1::3], sys.argv[2::3], sys.argv[3::3]):
    x, sr = sf.read(src, dtype='float32'); assert sr == state.sr(), sr
    t = torch.from_numpy(x[None, :])
    lim = None if atten == 'none' else float(atten)
    y = enhance(model, state, t, atten_lim_db=lim).numpy()[0]
    sf.write(dst, y, sr, subtype='FLOAT'); print('wrote', dst, flush=True)
