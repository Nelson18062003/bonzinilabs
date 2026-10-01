"""Queue runner for local illustrations (sd.cpp DreamShaper XL Lightning q8 + TAESD XL), then Real-ESRGAN ×2.
usage: gen_sd.py jobs.json   jobs = [{"id": "bg_x", "prompt": "...", "w": 640, "h": 1152, "seed": 1, "steps": 5}]  → gen/<id>.png and gen/<id>_2x.png"""
import sys, os, json, subprocess, time
SP = os.environ.get('BZ_GEN_ROOT', '.')
P = SP + '/douane/p2'
STYLE = ("2D comic book illustration, hand-drawn African bande dessinee, bold black ink outlines, flat cel-shaded gouache colours, "
         "simple shapes, light paper grain, warm light, ochre terracotta turquoise mustard yellow leaf green palette, stylized not realistic")
NEG = "text, letters, words, writing, watermark, signature, logo, brand, photo, photograph, photorealistic, realistic, 3d render, skyscraper, high-rise, blurry, deformed, lowres"
jobs = json.load(open(sys.argv[1]))
for j in jobs:
    out = f"{P}/gen/{j['id']}.png"
    if not os.path.exists(out) or j.get('force'):
        t = time.time()
        cmd = [SP + '/tools/sdcpp/build/bin/sd-cli', '-m', SP + '/models_sd/dsxl_q8.gguf', '--taesd', SP + '/models_sd/taesdxl/diffusion_pytorch_model.safetensors',
               '-p', (j.get('style', STYLE) + ', ' + j['prompt']), '-n', j.get('neg', NEG), '--sampling-method', 'euler', '--scheduler', 'sgm_uniform',
               '--steps', str(j.get('steps', 5)), '--cfg-scale', str(j.get('cfg', 1.5)), '-W', str(j.get('w', 640)), '-H', str(j.get('h', 1152)),
               '-s', str(j.get('seed', 1)), '-t', '4', '-o', out]
        if j.get('init'): cmd += ['-i', j['init'], '--strength', str(j.get('strength', .55))]
        r = subprocess.run(cmd, capture_output=True, text=True)
        print(j['id'], 'generated' if os.path.exists(out) else 'FAILED ' + r.stderr[-300:], f'{time.time() - t:.0f}s', flush=True)
    if j.get('refine') and os.path.exists(out) and not os.path.exists(f"{P}/gen/{j['id']}_r.png"):
        toon = f"{P}/gen/{j['id']}_toon.png"; subprocess.run(['python3', P + '/lib/toon.py', out, toon, str(j.get('toonK', .8))])
        t = time.time(); rj = dict(j, id=j['id'] + '_r', init=toon, strength=j['refine'], refine=None, seed=j.get('seed', 1) + 100)
        cmd = [SP + '/tools/sdcpp/build/bin/sd-cli', '-m', SP + '/models_sd/dsxl_q8.gguf', '--taesd', SP + '/models_sd/taesdxl/diffusion_pytorch_model.safetensors',
               '-p', (j.get('style', STYLE) + ', ' + j['prompt']), '-n', j.get('neg', NEG), '--sampling-method', 'euler', '--scheduler', 'sgm_uniform',
               '--steps', str(j.get('rsteps', 6)), '--cfg-scale', str(j.get('cfg', 1.5)), '-W', str(j.get('w', 640)), '-H', str(j.get('h', 1152)),
               '-s', str(rj['seed']), '-t', '4', '-o', f"{P}/gen/{j['id']}_r.png", '-i', toon, '--strength', str(j['refine'])]
        subprocess.run(cmd, capture_output=True); print('  refined', os.path.exists(f"{P}/gen/{j['id']}_r.png"), f'{time.time() - t:.0f}s', flush=True)
        out = f"{P}/gen/{j['id']}_r.png"
    elif j.get('refine'): out = f"{P}/gen/{j['id']}_r.png"
    up = f"{P}/gen/{j['id']}_2x.png"
    if os.path.exists(out) and not os.path.exists(up):
        subprocess.run(['python3', P + '/lib/upscale_img.py', out, up, '2'], capture_output=True)
        print('  upscaled', os.path.exists(up), flush=True)
