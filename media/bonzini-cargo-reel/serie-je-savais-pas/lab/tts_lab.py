"""Voice lab: same test sentences through several (voice, temperature, cfg) configs. Loads Kyutai TTS once.
usage: python tts_lab.py  -> out/<cfg>_<sid>_s<seed>.wav"""
import os, json, time, torch, numpy as np, soundfile as sf
torch.set_num_threads(4)
from moshi.models.loaders import CheckpointInfo
from moshi.models.tts import DEFAULT_DSM_TTS_REPO, TTSModel
H = os.path.dirname(os.path.abspath(__file__))
SENT = json.load(open(os.path.join(H, 'sentences.json')))
import sys
CFGS = json.load(open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(H, 'configs.json')))
ONLY = set(sys.argv[2].split(',')) if len(sys.argv) > 2 else None
tts = TTSModel.from_checkpoint_info(CheckpointInfo.from_hf_repo(DEFAULT_DSM_TTS_REPO), n_q=32, temp=0.6, device='cpu', dtype=torch.bfloat16)
for c in CFGS:
    tts.temp = c['temp']; tts.padding_bonus = c.get('pb', 0.)
    cond = tts.make_condition_attributes([tts.get_voice_path(c['voice'])], cfg_coef=c['cfg'])
    for sid, txt in SENT.items():
        if ONLY and sid not in ONLY: continue
        for seed in c.get('seeds', [1]):
            out = os.path.join(H, 'out', f"{c['id']}_{sid}_s{seed}.wav")
            if os.path.exists(out): continue
            torch.manual_seed(seed * 1000 + sum(ord(ch) for ch in sid)); t0 = time.time()
            with torch.no_grad():
                res = tts.generate([tts.prepare_script([txt], padding_between=c.get('pbw', 1))], [cond])
                with tts.mimi.streaming(1):
                    pcm = [np.clip(tts.mimi.decode(fr[:, 1:, :]).float().cpu().numpy()[0, 0], -1, 1) for fr in res.frames[tts.delay_steps:]]
            y = np.concatenate(pcm, -1); sf.write(out, y, tts.mimi.sample_rate)
            print(c['id'], sid, seed, f"{len(y) / tts.mimi.sample_rate:.2f}s in {time.time() - t0:.0f}s", flush=True)
