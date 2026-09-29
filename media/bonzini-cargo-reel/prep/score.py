import torch, soundfile as sf, numpy as np, sys
from transformers import WhisperProcessor, WhisperForConditionalGeneration
torch.set_num_threads(4)
name = "openai/whisper-large-v3"
proc = WhisperProcessor.from_pretrained(name)
model = WhisperForConditionalGeneration.from_pretrained(name, torch_dtype=torch.float32).eval()
tok = proc.tokenizer
def load(f):
    x, sr = sf.read(f, dtype='float32'); assert sr == 16000; return x
tests = {
 "A_loc.wav": ["Et nous vous attendons dans notre entrepôt ici à Ngousso, au niveau du foyer Balengou.",
               "Et nous vous attendons dans notre entrepôt ici en Gonçois, au niveau du foyer Balengou.",
               "Et nous vous attendons dans notre entrepôt ici à Ngoussou, au niveau du foyer Balengou.",
               "Et nous vous attendons dans notre entrepôt ici à Nkolbisson, au niveau du foyer Balengou.",
               "Et nous vous attendons dans notre entrepôt ici à Ngousso, au niveau du foyer Baleng.",
               "Et nous vous attendons dans notre entrepôt ici à Ngousso, au niveau du foyer Balengou."],
 "B_loc.wav": ["Et vous pouvez passer chercher vos colis dans notre entrepôt situé à Ngousso, au niveau du foyer Balengou.",
               "Et vous pouvez passer chercher vos colis dans notre entrepôt situé en Gonçois, au niveau du foyer Balengou.",
               "Et vous pouvez passer chercher vos colis dans notre entrepôt situé à Ngoussou, au niveau du foyer Balengou."],
 "B_intro.wav": ["Voilà, chers clients de Bonzini Trading Cargo.",
                 "Voilà, c'est le client de Bonjimit 13-1-Pago.",
                 "Voilà, très chers clients de Bonzini Trading Cargo.",
                 "Voilà, chers clients de Bonzini Cargo.",
                 "Bonjour chers clients de Bonzini Trading Cargo."],
}
prefix = tok.convert_tokens_to_ids(["<|startoftranscript|>", "<|fr|>", "<|transcribe|>", "<|notimestamps|>"])
for f, cands in tests.items():
    feats = proc(load(f), sampling_rate=16000, return_tensors="pt").input_features
    with torch.no_grad():
        enc = model.model.encoder(feats)
    for c in cands:
        ids = tok(" " + c, add_special_tokens=False).input_ids + [tok.eos_token_id]
        full = torch.tensor([prefix + ids])
        with torch.no_grad():
            logits = model(encoder_outputs=enc, decoder_input_ids=full[:, :-1]).logits
        lp = torch.log_softmax(logits, -1)[0, len(prefix)-1:, :]
        tgt = full[0, len(prefix):]
        tl = lp[torch.arange(len(tgt)), tgt]
        print(f"{f} | total={tl.sum().item():8.2f} | mean={tl.mean().item():6.3f} | {c}", flush=True)
