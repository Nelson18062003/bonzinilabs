"""Remove people from a Canva scene: sd.cpp masked img2img at ~704 px wide, then composite the repainted area back at full size.
usage: inpaint.py in.png mask.png out.png "prompt" [seed] [strength]"""
import sys, subprocess, os, cv2, numpy as np
SP = os.environ.get('BZ_GEN_ROOT', '.')
src, msk, dst, prompt = sys.argv[1:5]; seed = sys.argv[5] if len(sys.argv) > 5 else '5'; st = sys.argv[6] if len(sys.argv) > 6 else '.95'
im = cv2.imread(src); m = cv2.imread(msk, 0); H, W = im.shape[:2]
w = 704; h = int(round(H * w / W / 8) * 8)
tmp = dst + '.tmp'; os.makedirs(tmp, exist_ok=True)
cv2.imwrite(tmp + '/init.png', cv2.resize(im, (w, h), interpolation=cv2.INTER_AREA)); cv2.imwrite(tmp + '/mask.png', cv2.resize(m, (w, h)))
style = "2D comic book illustration, hand-drawn bande dessinee, black ink outlines, gouache colours, warm light"
cmd = [SP + '/tools/sdcpp/build/bin/sd-cli', '-m', SP + '/models_sd/dsxl_q8.gguf', '--taesd', SP + '/models_sd/taesdxl/diffusion_pytorch_model.safetensors',
       '-p', style + ', ' + prompt, '-n', 'people, person, man, woman, face, text, letters, logo, photo, blurry', '--sampling-method', 'euler', '--scheduler', 'sgm_uniform',
       '--steps', '8', '--cfg-scale', '1.8', '-W', str(w), '-H', str(h), '-s', seed, '-t', '4', '-i', tmp + '/init.png', '--mask', tmp + '/mask.png', '--strength', st, '-o', tmp + '/out.png']
r = subprocess.run(cmd, capture_output=True, text=True)
if not os.path.exists(tmp + '/out.png'): print('FAILED', r.stderr[-400:]); sys.exit(1)
rep = cv2.resize(cv2.imread(tmp + '/out.png'), (W, H), interpolation=cv2.INTER_CUBIC)
a = cv2.GaussianBlur((m > 0).astype(np.float32), (41, 41), 0)[..., None]
cv2.imwrite(dst, (im * (1 - a) + rep * a).astype(np.uint8)); print('ok', dst)
