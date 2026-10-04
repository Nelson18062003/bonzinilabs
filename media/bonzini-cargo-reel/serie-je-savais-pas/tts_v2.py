"""Clear-diction voices for « JE SAVAIS PAS. » (Kyutai TTS 1.6B, CC-BY 4.0) — loads the model ONCE for several episodes.
usage: python tts_v2.py EP_DIR [EP_DIR...] [--takes 3] [--run 1] [--only N1,T2] [--voices voice_cfg.json]
Reads  E/data/script_v2.json (segments in speaking order: id, text, tts?, voice?)
Writes E/audio/vo/<id>_s<k>.wav, k = (run-1)*takes + 1 … run*takes: the takes of one line are generated as ONE batch
(independent samples, ~the cost of one on CPU). Skips a line whose takes of this run all exist.
Clarity knobs (measured in lab/, see voice_cfg.json): low temperature, strong CFG, `padding_bonus` (> 0 = slower speech),
`padding_between` (forced pad between words = better articulation), and a short <break> between two sentences."""
import sys, os, re, json, time
import numpy as np, torch, soundfile as sf
torch.set_num_threads(4)
from moshi.models.loaders import CheckpointInfo
from moshi.models.tts import DEFAULT_DSM_TTS_REPO, TTSModel
H = os.path.dirname(os.path.abspath(__file__))
a = sys.argv[1:]
def opt(k, d=None):
    global a
    if k not in a: return d
    i = a.index(k); v = a[i + 1]; a = a[:i] + a[i + 2:]; return v
NT = int(opt('--takes', '3')); RUN = int(opt('--run', '1'))
only = set(opt('--only', '').split(',')) - {''}
VC = json.load(open(opt('--voices', os.path.join(H, 'voice_cfg.json'))))
eps = [os.path.abspath(x) for x in a]
NARR = VC['narratrice']['voice']
def cfg_for(seg):
    v = seg.get('voice', NARR)
    return next((c for c in VC.values() if c['voice'] == v), dict(VC['narratrice'], voice=v))
def with_breaks(t, brk):
    """a short silence between two sentences (the model otherwise runs them together)"""
    if not brk: return t
    return re.sub(r'([.?!])\s+(?=\S)', lambda m: f'{m.group(1)} <break time="{brk}s"/> ', t.strip())
tts = TTSModel.from_checkpoint_info(CheckpointInfo.from_hf_repo(DEFAULT_DSM_TTS_REPO), n_q=32, temp=0.6, device='cpu', dtype=torch.bfloat16)
_conds = {}
def cond(c):
    k = (c['voice'], c['cfg'])
    if k not in _conds: _conds[k] = tts.make_condition_attributes([tts.get_voice_path(c['voice'])], cfg_coef=c['cfg'])
    return _conds[k]
for E in eps:
    os.makedirs(os.path.join(E, 'audio', 'vo'), exist_ok=True)
    for s in json.load(open(os.path.join(E, 'data', 'script_v2.json')))['segments']:
        if only and s['id'] not in only: continue
        ks = [(RUN - 1) * NT + b + 1 for b in range(NT)]
        outs = [os.path.join(E, 'audio', 'vo', f"{s['id']}_s{k}.wav") for k in ks]
        if all(os.path.exists(o) for o in outs): continue
        c = cfg_for(s); tts.temp = c['temp']; tts.padding_bonus = c.get('pb', 0.)
        txt = with_breaks(s.get('tts', s['text']).replace('…', ','), c.get('break', 0))
        torch.manual_seed(RUN * 100 + sum(ord(ch) for ch in s['id'])); t0 = time.time()
        with torch.no_grad():
            ent = tts.prepare_script([txt], padding_between=c.get('pbw', 1))
            res = tts.generate([ent] * NT, [cond(c)] * NT)
            with tts.mimi.streaming(NT):
                pcm = [np.clip(tts.mimi.decode(fr[:, 1:, :]).float().cpu().numpy()[:, 0], -1, 1) for fr in res.frames[tts.delay_steps:]]
        Y = np.concatenate(pcm, -1); sr = tts.mimi.sample_rate
        for b, o in enumerate(outs):
            es = res.end_steps[b]
            y = Y[b] if es is None else Y[b, :int(sr * (es + tts.final_padding) / tts.mimi.frame_rate)]
            sf.write(o, y, sr)
        print(os.path.basename(E), s['id'], ks, [round(len(Y[b]) / sr, 2) if res.end_steps[b] is None else round((res.end_steps[b] + tts.final_padding) / tts.mimi.frame_rate, 2) for b in range(NT)],
              f"in {time.time() - t0:.0f}s  « {txt} »", flush=True)
