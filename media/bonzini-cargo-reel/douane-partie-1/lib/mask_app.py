"""Mask the real simulator screenshots (captured by cap_sim.mjs from branch claude/bonzini-cameroon-tariff-3b9uli) before they go on screen.
Nothing product-specific may be readable: no duty rate per product, no computed customs amount, no « 1 CNY = 80 » field,
no unverified claim. Coordinates are in screenshot pixels (1170 px wide, iPhone @3x).
usage: python3 mask_app.py <raw_dir> <assets/photos>"""
import sys, os
from PIL import Image, ImageFilter

def blur(im, box, r=16):
    reg = im.crop(box).filter(ImageFilter.GaussianBlur(r))
    reg = Image.blend(reg, Image.new('RGB', reg.size, (236, 236, 240)), .35)
    im.paste(reg, box[:2]); return im

def main(raw, out):
    J = lambda d, f: os.path.join(d, f)
    # home: keep the headline « Payez le juste droit. Ni plus, ni moins. », blur the intro paragraph (« 4 articles sur 10 » is not verified)
    im = Image.open(J(raw, 'app_home.jpg')).convert('RGB'); blur(im, (95, 455, 1110, 1085)); im.save(J(out, 'app_home.jpg'), quality=90)
    # search « mèches »: drop the excise/TEC tip block, blur the « 30 % » badges, white-out everything from the CNY rate field down
    im = Image.open(J(raw, 'app_sim_03_suggestions.jpg')).convert('RGB')
    new = Image.new('RGB', im.size, 'white'); new.paste(im.crop((0, 0, 1170, 832)), (0, 0)); new.paste(im.crop((0, 1198, 1170, im.size[1])), (0, 832))
    blur(new, (895, 610, 1085, 1370)); new.paste(Image.new('RGB', (1170, new.size[1] - 1990), 'white'), (0, 1990)); new.save(J(out, 'app_m_sugg.jpg'), quality=90)
    # product 6704.19: blur « Droit de douane 30 % » value, cut before the CNY rate field
    im = Image.open(J(raw, 'app_sim_04_product.jpg')).convert('RGB'); blur(im, (565, 1185, 800, 1280))
    new = Image.new('RGB', (1170, 2532), 'white'); new.paste(im.crop((0, 0, 1170, 1990)), (0, 0)); new.save(J(out, 'app_m_product.jpg'), quality=90)
    # result: blur the « À payer » block, the DAU amounts column and the two product-specific rate lines
    im = Image.open(J(raw, 'app_sim_06_full_1.jpg')).convert('RGB')
    blur(im, (100, 420, 1080, 1070), 20); blur(im, (720, 1950, 1090, im.size[1]), 18); blur(im, (150, 2020, 330, 2090)); blur(im, (150, 2210, 720, 2280))
    im.crop((0, 200, 1170, im.size[1])).save(J(out, 'app_m_result.jpg'), quality=90)
    # app_sim_05_filled.jpg (example inputs only: 1 000 000 XAF, FOB, fret 150 000) is used as captured

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
