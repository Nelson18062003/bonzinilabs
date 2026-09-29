"""Narration with Kyutai TTS 1.6B (CC-BY 4.0), voice unmute-prod-website/developpeuse-3 (CC0).
usage: python tts_kyutai.py [--only S2,S4] [--seed N]   -> audio/vo/<id>_s<seed>.wav"""
import sys, os, json, time
import numpy as np, torch, soundfile as sf
torch.set_num_threads(4)
from moshi.models.loaders import CheckpointInfo
from moshi.models.tts import DEFAULT_DSM_TTS_REPO, TTSModel
F = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
a = sys.argv[1:]
only = a[a.index('--only') + 1].split(',') if '--only' in a else None
seed = int(a[a.index('--seed') + 1]) if '--seed' in a else 1
tts = TTSModel.from_checkpoint_info(CheckpointInfo.from_hf_repo(DEFAULT_DSM_TTS_REPO), n_q=32, temp=0.6, device='cpu', dtype=torch.bfloat16)
cond = tts.make_condition_attributes([tts.get_voice_path('unmute-prod-website/developpeuse-3.wav')], cfg_coef=2.0)
for s in json.load(open(os.path.join(F, 'data', 'script.json')))['segments']:
    if only and s['id'] not in only: continue
    torch.manual_seed(seed * 100 + int(s['id'][1:]))
    t0 = time.time()
    with torch.no_grad():
        res = tts.generate([tts.prepare_script([s.get('tts', s['text'])], padding_between=1)], [cond])
        with tts.mimi.streaming(1):
            pcm = [np.clip(tts.mimi.decode(fr[:, 1:, :]).float().cpu().numpy()[0, 0], -1, 1) for fr in res.frames[tts.delay_steps:]]
    y = np.concatenate(pcm, -1)
    sf.write(os.path.join(F, 'audio', 'vo', f"{s['id']}_s{seed}.wav"), y, tts.mimi.sample_rate)
    print(s['id'], f"{len(y) / tts.mimi.sample_rate:.2f}s audio in {time.time() - t0:.0f}s", flush=True)
