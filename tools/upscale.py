#!/usr/bin/env python3
"""
Upscale / enhance ToonTalk sprite PNGs.

The original M25/M22 art is low-resolution and a little noisy. This script
batch-upscales a folder of PNGs. It prefers AI super-resolution (Real-ESRGAN)
when available and falls back to high-quality Lanczos otherwise. Alpha is
preserved.

AI setup (run once, locally — needs a few hundred MB):
    pip install realesrgan basicsr

Usage:
    python3 upscale.py <in_dir> <out_dir> [scale=4]

Notes:
- Real-ESRGAN gives the best results on these claymation-style sprites; it both
  upscales and denoises. waifu2x is a good alternative for flat-shaded art.
- This can't run in the Cowork sandbox (no GPU / large model download), so run
  it on your machine, then point convert-assets at the enhanced source.
"""
import os, sys, glob

from PIL import Image

try:
    import numpy as np
    from realesrgan import RealESRGANer
    from basicsr.archs.rrdbnet_arch import RRDBNet
    HAVE_AI = True
except Exception:
    HAVE_AI = False


def ai_upscaler(scale):
    model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)
    return RealESRGANer(
        scale=4,
        model_path="https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
        model=model, half=False,
    )


def upscale_image(path, out_path, scale, ai):
    im = Image.open(path).convert("RGBA")
    rgb = im.convert("RGB")
    alpha = im.split()[3]
    if ai is not None:
        import numpy as np
        out, _ = ai.enhance(np.array(rgb), outscale=scale)
        rgb_up = Image.fromarray(out)
    else:
        rgb_up = rgb.resize((rgb.width * scale, rgb.height * scale), Image.LANCZOS)
    a_up = alpha.resize(rgb_up.size, Image.LANCZOS)
    rgb_up = rgb_up.convert("RGBA")
    rgb_up.putalpha(a_up)
    rgb_up.save(out_path)


def main():
    in_dir, out_dir = sys.argv[1], sys.argv[2]
    scale = int(sys.argv[3]) if len(sys.argv) > 3 else 4
    os.makedirs(out_dir, exist_ok=True)
    ai = ai_upscaler(scale) if HAVE_AI else None
    print("mode:", "Real-ESRGAN" if ai else "Lanczos (install realesrgan for AI)")
    for p in sorted(glob.glob(os.path.join(in_dir, "*.png"))):
        out = os.path.join(out_dir, os.path.basename(p))
        upscale_image(p, out, scale, ai)
        print("  upscaled", os.path.basename(p))


if __name__ == "__main__":
    main()
