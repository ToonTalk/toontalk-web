#!/usr/bin/env python3
"""Convert ToonTalk NPICS art (Apple QuickDraw PICT color + a BMP/MIC mask) into
clean RGBA PNGs with proper transparency — far better than colour-keying the M25
BMPs. The colour lives in the `.PIC` (PICT v2, DirectBits/PackBits true-colour),
which ImageMagick reads via the `PICT:` prefix; the matching `.BMP` is a white
silhouette mask we copy into the alpha channel.

Usage: python tools/convert-npics.py <name.PIC> <mask.BMP> <out.png> [--no-trim]
Requires ImageMagick (magick.exe). Set MAGICK env var to override the path.
"""
import os
import subprocess
import sys
from PIL import Image

MAGICK = os.environ.get("MAGICK") or r"C:\Program Files\ImageMagick-7.1.2-Q16-HDRI\magick.exe"


def convert(pic: str, mask: str, out: str, trim: bool = True) -> None:
    tmp = out + ".color.png"
    # `.PIC` would map to the SoftImage coder; PICT: forces the QuickDraw decoder.
    subprocess.run([MAGICK, "PICT:" + pic, tmp], check=True)
    color = Image.open(tmp).convert("RGB")
    m = Image.open(mask).convert("L")
    if m.size != color.size:
        m = m.resize(color.size, Image.NEAREST)
    rgba = color.copy()
    rgba.putalpha(m)  # white mask → opaque, black → transparent (clean alpha)
    if trim:
        bbox = rgba.getbbox()
        if bbox:
            rgba = rgba.crop(bbox)
    rgba.save(out)
    os.remove(tmp)
    print(f"wrote {out} {rgba.size}")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--no-trim"]
    convert(args[0], args[1], args[2], trim="--no-trim" not in sys.argv)
