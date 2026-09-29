"""Chatterbox multilingual (MIT) narration, voice-conditioned on the Kokoro French reference clip.
Each segment is checked with Whisper afterwards (lib/check_vo.py); re-run with --only V05,V07 --seed N to redo takes."""
import json, os, sys, time, torch, torchaudio as ta
torch.set_num_threads(int(os.environ.get('THREADS', '3')))
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
E = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
args = sys.argv[1:]
only = args[args.index('--only') + 1].split(',') if '--only' in args else None
seed = int(args[args.index('--seed') + 1]) if '--seed' in args else 1
m = ChatterboxMultilingualTTS.from_pretrained(device='cpu')
ref = os.path.join(E, 'audio', 'voice_ref.wav')
segs = json.load(open(os.path.join(E, 'data', 'script.json')))['segments']
for s in segs:
    if s['kind'] != 'vo' or (only and s['id'] not in only): continue
    torch.manual_seed(seed * 1000 + int(s['id'][1:]))
    t0 = time.time()
    wav = m.generate(s['text'], language_id='fr', audio_prompt_path=ref, exaggeration=0.55, cfg_weight=0.5, temperature=0.7)
    out = os.path.join(E, 'audio', 'vo_cb', f"{s['id']}_s{seed}.wav")
    ta.save(out, wav, m.sr)
    print(s['id'], 'seed', seed, round(wav.shape[-1] / m.sr, 2), 's audio in', round(time.time() - t0), 's', flush=True)
