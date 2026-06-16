#!/usr/bin/env python3
"""Bake the nest's hatch animation (NEST.TTS cycle 2 = HATCH02-14, the egg
cracking open as the bird emerges) into a flat web frame set.

bird.cpp `Nest::hatch_bird` sets the nest sprite to the BIRD_HATCH cycle, then
`bird_has_hatched` flies the new bird up out of the nest. The static nest is
HATCH01 (`nest.png`); this is the 13-frame crack that follows. Frames are
origin-aligned to one uniform canvas (each frame's (ox,oy)) so the nest doesn't
shift, M25 with M22 (upscaled 2x) fallback — same pipeline as the bird.

Output: public/assets/anim/nest-hatch/NN.png + a printed {frames,w,h,anchor}.
Usage: python3 tools/bake-nest.py [M25_dir] [M22_dir] [out_dir]
"""
import os, sys, json
from importlib import import_module
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
_bc = import_module("bake-city")


def main():
    m25 = sys.argv[1] if len(sys.argv) > 1 else "C:/Users/toont/dev/M25"
    m22 = sys.argv[2] if len(sys.argv) > 2 else "C:/Users/toont/dev/M22"
    out = sys.argv[3] if len(sys.argv) > 3 else "public/assets/anim/nest-hatch"
    os.makedirs(out, exist_ok=True)

    geom = _bc.parse_tts(os.path.join(m25, "NEST.TTS"))
    _bc.prep_geom(geom, m25, m22, from_m25=True)
    frames = geom["cycles"][2]["frames"]  # HATCH02-14

    # Union bbox over the cycle, placed by each frame's (ox,oy) origin (y-up).
    minL = minB = 10**9
    maxR = maxT = -(10**9)
    for f in frames:
        minL = min(minL, f["ox2"]); maxR = max(maxR, f["ox2"] + f["w2"])
        minB = min(minB, f["oy2"]); maxT = max(maxT, f["oy2"] + f["h2"])
    W, H = maxR - minL, maxT - minB
    anchor = [(0 - minL) / W, (maxT - 0) / H]

    for i, f in enumerate(frames):
        canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        if f["img"] is not None:
            x = f["ox2"] - minL
            y = maxT - (f["oy2"] + f["h2"])  # y-up -> top-down
            canvas.alpha_composite(f["img"], (x, y))
        canvas.save(os.path.join(out, f"{i:02d}.png"))

    # Where the egg (static nest = HATCH01) sits in this canvas, as an anchor —
    # so the view can overlay the hatch with the egg landing on the nest centre.
    h1 = geom["cycles"][0]["frames"][0]  # HATCH01
    bb = h1["img"].getbbox() if h1["img"] is not None else None
    if bb:
        cx = (h1["ox2"] - minL) + (bb[0] + bb[2]) / 2
        cy = (maxT - (h1["oy2"] + h1["h2"])) + (bb[1] + bb[3]) / 2
        nest_anchor = [cx / W, cy / H]
    else:
        nest_anchor = anchor
    print(json.dumps({"frames": len(frames), "w": W, "h": H,
                      "anchor": anchor, "nestAnchor": nest_anchor}))

    # Contact sheet for QA.
    n = len(frames)
    cell = 130
    sheet = Image.new("RGB", (n * cell, cell + 18), (60, 64, 76))
    d = ImageDraw.Draw(sheet)
    for i in range(n):
        im = Image.open(os.path.join(out, f"{i:02d}.png")).convert("RGBA")
        bg = Image.new("RGBA", im.size, (60, 64, 76, 255)); bg.alpha_composite(im); im = bg.convert("RGB")
        im.thumbnail((cell - 8, cell - 8))
        sheet.paste(im, (i * cell + (cell - im.width) // 2, 8))
        d.text((i * cell + 4, cell + 4), str(i), fill=(255, 255, 0))
    sheet.save(os.path.join(out, "_contact_sheet.png"))
    print(f"contact sheet -> {out}/_contact_sheet.png")


if __name__ == "__main__":
    main()
