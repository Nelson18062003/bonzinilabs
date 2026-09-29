import sys, os, time, json
import numpy as np, torch, soundfile as sf
torch.set_num_threads(int(os.environ.get("NT", "4")))
from moshi.models.loaders import CheckpointInfo
from moshi.models.tts import DEFAULT_DSM_TTS_REPO, TTSModel

here = os.path.dirname(os.path.abspath(__file__))
text = open(os.path.join(here, "test_text.txt")).read().strip()
t0 = time.time()
ci = CheckpointInfo.from_hf_repo(DEFAULT_DSM_TTS_REPO)
tts = TTSModel.from_checkpoint_info(ci, n_q=int(os.environ.get("NQ", "32")), temp=0.6, device="cpu",
                                    dtype=torch.bfloat16)
print("load", round(time.time() - t0, 1), flush=True)
log = {}
for spec in sys.argv[1:]:
    name, voice = spec.split("=", 1)
    entries = tts.prepare_script([text], padding_between=1)
    vp = tts.get_voice_path(voice)
    cond = tts.make_condition_attributes([vp], cfg_coef=2.0)
    torch.manual_seed(1234)
    t0 = time.time()
    with torch.no_grad():
        res = tts.generate([entries], [cond])
        with tts.mimi.streaming(1):
            pcms = [np.clip(tts.mimi.decode(fr[:, 1:, :]).float().cpu().numpy()[0, 0], -1, 1)
                    for fr in res.frames[tts.delay_steps:]]
    dt = time.time() - t0
    y = np.concatenate(pcms, axis=-1)
    sr = tts.mimi.sample_rate
    sf.write(os.path.join(here, "raw", f"kyutai_{name}.wav"), y, sr)
    log[name] = {"gen_s": round(dt, 1), "audio_s": round(len(y) / sr, 2), "rtf": round(dt / (len(y) / sr), 2)}
    print(name, log[name], flush=True)
json.dump(log, open(os.path.join(here, "raw", "kyutai_timing.json"), "w"), indent=1)
