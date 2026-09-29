import sys, json
from faster_whisper import WhisperModel
name = sys.argv[1]
model = WhisperModel(name, device="cpu", compute_type="int8", cpu_threads=4)
out = {}
for f in sys.argv[2:]:
    segs, info = model.transcribe(f, word_timestamps=True, beam_size=5, vad_filter=False, condition_on_previous_text=False)
    segs = list(segs)
    out[f] = {"lang": info.language, "prob": info.language_probability,
              "segments": [{"start": s.start, "end": s.end, "text": s.text,
                            "words": [{"w": w.word, "s": w.start, "e": w.end, "p": w.probability} for w in (s.words or [])]} for s in segs]}
    print("==", f, info.language, round(info.language_probability,2), flush=True)
    for s in segs: print(f"[{s.start:6.2f}-{s.end:6.2f}] {s.text}", flush=True)
json.dump(out, open(f"transcript_{name.replace('/','_')}.json","w"), ensure_ascii=False, indent=1)
