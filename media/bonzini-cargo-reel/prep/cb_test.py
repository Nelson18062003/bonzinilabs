import time, sys, torch, torchaudio as ta
torch.set_num_threads(3)
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
t0 = time.time()
m = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
print("load", round(time.time() - t0, 1), flush=True)
txt = "Étape trois : le transport. Le conteneur traverse l'océan par bateau, puis il continue sa route par camion jusqu'à notre entrepôt."
ref = sys.argv[1] if len(sys.argv) > 1 else None
t0 = time.time()
wav = m.generate(txt, language_id="fr", audio_prompt_path=ref, exaggeration=0.5, cfg_weight=0.5, temperature=0.7)
dt = time.time() - t0
ta.save(sys.argv[2] if len(sys.argv) > 2 else "test/cb_default.wav", wav, m.sr)
print("gen", round(dt, 1), "s for", round(wav.shape[-1] / m.sr, 2), "s audio", flush=True)
