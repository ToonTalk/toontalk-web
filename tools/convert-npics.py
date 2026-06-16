#!/usr/bin/env python3
"""Convert ToonTalk NPICS art into clean RGBA PNGs with proper transparency —
far better than colour-keying the M25 BMPs.

Colour comes from one of: `.PIC` (Apple QuickDraw PICT, via ImageMagick `PICT:`),
`.EXT` (a "mhwanh" raw: 32-byte header with big-endian uint16 width@8/height@10,
then w*h*3 RGB), or `.TIF`/`.BMP`/`.PNG` (Pillow). Transparency is auto-detected:
  * a separate white-silhouette mask (if given), or
  * a flat saturated chroma background (green/blue screen) → fuzz key, or
  * a flat grey matte (rgb≈128) → alpha from chroma (clean for *chromatic*
    sprites like the hand; pass --flood for achromatic ones), or
  * else a plain black key.

Usage: python tools/convert-npics.py <in> <out.png> [mask] [--no-trim] [--flood]
Requires ImageMagick for `.PIC` (set MAGICK to override the path).
"""
import os
import struct
import subprocess
import sys
from collections import deque
from PIL import Image, ImageChops, ImageFilter

MAGICK = os.environ.get("MAGICK") or r"C:\Program Files\ImageMagick-7.1.2-Q16-HDRI\magick.exe"


def load_color(path: str) -> Image.Image:
    ext = os.path.splitext(path)[1].lower()
    if ext == ".pic":
        tmp = path + ".tmp.png"
        subprocess.run([MAGICK, "PICT:" + path, tmp], check=True)
        im = Image.open(tmp).convert("RGB")
        im.load()
        os.remove(tmp)
        return im
    if ext == ".ext":
        d = open(path, "rb").read()
        if d[:6] != b"mhwanh":
            raise ValueError("not a mhwanh .EXT: " + path)
        w = struct.unpack(">H", d[8:10])[0]
        h = struct.unpack(">H", d[10:12])[0]
        return Image.frombytes("RGB", (w, h), d[32:32 + w * h * 3])
    return Image.open(path).convert("RGB")


def _corners(im):
    w, h = im.size
    return [im.getpixel(p) for p in ((1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2))]


def _chroma_key(corners):
    c0 = corners[0][:3]
    if any(abs(c[i] - c0[i]) > 30 for c in corners for i in range(3)):
        return None
    if max(c0) - min(c0) < 60:
        return None
    return c0


def _is_grey_matte(corners) -> bool:
    return all(max(c[:3]) - min(c[:3]) < 22 and 90 < sum(c[:3]) / 3 < 170 for c in corners)


def _sat_alpha(rgb):
    """Alpha from chroma: chromatic pixels opaque, grey transparent, edges soft."""
    r, g, b = rgb.split()
    mx = ImageChops.lighter(ImageChops.lighter(r, g), b)
    mn = ImageChops.darker(ImageChops.darker(r, g), b)
    sat = ImageChops.subtract(mx, mn)
    a = sat.point(lambda v: 0 if v < 18 else min(255, (v - 18) * 9))
    return a.filter(ImageFilter.MedianFilter(5))  # despeckle the keyed edges


def _matte_exact_alpha(rgb, matte, tol=6):
    """Key a flat matte of (near-)exact colour `matte` everywhere — edge AND
    enclosed — by a TIGHT match (manhattan distance ≤ `tol`). The EXT mattes are
    a perfectly flat grey (128,128,128), and the engine keyed it exactly, so a
    tight match lifts the whole background (including pockets the edge flood can't
    reach, e.g. inside Pumpy's frame) while keeping sprite pixels that merely look
    grey-ish — e.g. Dusty's neutral lower face at (127,120,127), manhattan 10 from
    the matte, which a looser neutral/brightness heuristic wrongly erased."""
    px = rgb.load()
    w, h = rgb.size
    alpha = Image.new("L", (w, h), 255)
    ap = alpha.load()
    mr, mg, mb = matte[:3]
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y][:3]
            if abs(r - mr) + abs(g - mg) + abs(b - mb) <= tol:
                ap[x, y] = 0
    return alpha.filter(ImageFilter.MedianFilter(3))  # knock off 1px speckle


def _flood_alpha(rgb, key, tol=26):
    """Flood-fill the background colour from the edges → transparent; keeps
    interior pixels of that colour (for achromatic sprites on a grey matte)."""
    w, h = rgb.size
    px = rgb.load()
    alpha = Image.new("L", (w, h), 255)
    ap = alpha.load()
    seen = [[False] * w for _ in range(h)]
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            dq.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            dq.append((x, y))
    while dq:
        x, y = dq.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y][x]:
            continue
        seen[y][x] = True
        r, g, b = px[x, y][:3]
        if abs(r - key[0]) + abs(g - key[1]) + abs(b - key[2]) > tol * 3:
            continue
        ap[x, y] = 0
        dq.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    return alpha


def convert(inp: str, out: str, mask=None, trim=True, flood=False, matte=False) -> None:
    color = load_color(inp)
    corners = _corners(color)
    chroma = _chroma_key(corners)
    if matte:  # key the flat matte colour everywhere (edge + enclosed)
        rgba = color.convert("RGBA")
        rgba.putalpha(_matte_exact_alpha(color, corners[0]))
    elif mask and os.path.exists(mask):
        m = Image.open(mask).convert("L")
        if m.size != color.size:
            m = m.resize(color.size, Image.NEAREST)
        rgba = color.copy(); rgba.putalpha(m)
    elif chroma is not None:
        rgba = color.convert("RGBA")
        px = rgba.load(); w, h = rgba.size
        for y in range(h):
            for x in range(w):
                r, g, b, _ = px[x, y]
                if abs(r - chroma[0]) + abs(g - chroma[1]) + abs(b - chroma[2]) < 110:
                    px[x, y] = (r, g, b, 0)
    elif _is_grey_matte(corners):
        rgba = color.convert("RGBA")
        rgba.putalpha(_flood_alpha(color, corners[0][:3]) if flood else _sat_alpha(color))
    else:  # black key
        rgba = color.convert("RGBA")
        px = rgba.load(); w, h = rgba.size
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
    print(f"wrote {out} {rgba.size}")


if __name__ == "__main__":
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    convert(a[0], a[1], a[2] if len(a) > 2 else None,
            trim="--no-trim" not in sys.argv, flood="--flood" in sys.argv,
            matte="--matte" in sys.argv)
