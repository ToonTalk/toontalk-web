#!/usr/bin/env python3
"""Convert ToonTalk NPICS art (Apple QuickDraw PICT colour) into clean RGBA PNGs
with proper transparency — far better than colour-keying the M25 BMPs.

The colour lives in the `.PIC` (PICT v2, DirectBits/PackBits true-colour), which
ImageMagick reads via the `PICT:` prefix. Transparency comes from one of three
sources, auto-detected from the corners (or forced with a mask argument):
  * green chroma key (e.g. the COPTER side frames, corner ≈ rgb(0,139,12)),
  * a separate white-silhouette mask BMP/MIC (e.g. TBMORPH, some trucks),
  * else a plain black key.

Usage:
  python tools/convert-npics.py <in.PIC> <out.png> [mask.BMP] [--no-trim]
Requires ImageMagick (set MAGICK env var to override the path).
"""
import os
import subprocess
import sys
from PIL import Image

MAGICK = os.environ.get("MAGICK") or r"C:\Program Files\ImageMagick-7.1.2-Q16-HDRI\magick.exe"


def _greenish(c) -> bool:
    r, g, b = c[:3]
    return g > 80 and g > r + 30 and g > b + 30


def convert(pic: str, out: str, mask: str | None = None, trim: bool = True) -> None:
    tmp = out + ".color.png"
    subprocess.run([MAGICK, "PICT:" + pic, tmp], check=True)
    color = Image.open(tmp).convert("RGB")
    w, h = color.size
    corners = [color.getpixel(p) for p in ((1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2))]

    if mask and os.path.exists(mask):
        m = Image.open(mask).convert("L")
        if m.size != color.size:
            m = m.resize(color.size, Image.NEAREST)
        rgba = color.copy()
        rgba.putalpha(m)  # white → opaque
    elif sum(_greenish(c) for c in corners) >= 3:
        key = "rgb(%d,%d,%d)" % corners[0][:3]
        subprocess.run([MAGICK, "PICT:" + pic, "-fuzz", "22%", "-transparent", key, tmp], check=True)
        rgba = Image.open(tmp).convert("RGBA")
    else:
        rgba = color.convert("RGBA")  # black key
        px = rgba.load()
        for y in range(h):
            for x in range(w):
                r, g, b, _ = px[x, y]
                if r < 24 and g < 24 and b < 24:
                    px[x, y] = (0, 0, 0, 0)

    if trim:
        bbox = rgba.getbbox()
        if bbox:
            rgba = rgba.crop(bbox)
    rgba.save(out)
    if os.path.exists(tmp):
        os.remove(tmp)
    print(f"wrote {out} {rgba.size}")


if __name__ == "__main__":
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    pic, out = a[0], a[1]
    mask = a[2] if len(a) > 2 else None
    convert(pic, out, mask, trim="--no-trim" not in sys.argv)
