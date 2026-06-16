#!/usr/bin/env python3
"""Bake the full 22-frame "bam mouse" (MOUSEHAM.TTS) into one flat web frame set.

The mouse with the big red hammer (mouse.cpp `call_in_a_mouse`) runs in, swings
the hammer DOWN to smash a lego brick into its clay form, then runs out. Our old
4-frame mouse only had the run cycle, so the hammer never came down. This bakes
all four .TTS cycles, ALL aligned to a single union canvas (via each frame's
(ox,oy) origin) so the body stays registered while the hammer swings, in playback
order so view/animation.ts can play sub-ranges:

  [0..3]   run in     (cycle 0, MOUSE_RUNNING_NORTHEAST,  MOUSE01-04)
  [4..17]  smash      (cycle 2 USING_HAMMER_TO_SMASH 05-12 + cycle 3 AFTER_SMASH 13-18)
  [18..21] run out    (cycle 1, MOUSE_RUNNING_SOUTHEAST,  MOUSE22-19)

Output: public/assets/anim/mouse/NN.png + a printed {w,h,anchor,runIn,smash,runOut}.

Usage: python3 tools/bake-mouse.py [M25_dir] [out_dir]
"""
import os, sys, json
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from importlib import import_module
_bc = import_module("bake-city")
parse_tts, key_black, load_bmp_2x_space = _bc.parse_tts, _bc.key_black, _bc.load_bmp_2x_space


def main():
    m25 = sys.argv[1] if len(sys.argv) > 1 else "/c/Users/toont/dev/M25"
    m22 = sys.argv[2] if len(sys.argv) > 2 else "/c/Users/toont/dev/M22"
    out = sys.argv[3] if len(sys.argv) > 3 else "public/assets/anim/mouse"
    os.makedirs(out, exist_ok=True)

    geom = parse_tts(os.path.join(m25, "MOUSEHAM.TTS"))
    cy = geom["cycles"]
    # Playback order: run-in, smash (swing + after), run-out.
    order = cy[0]["frames"] + cy[2]["frames"] + cy[3]["frames"] + cy[1]["frames"]
    run_in, smash, run_out = len(cy[0]["frames"]), len(cy[2]["frames"]) + len(cy[3]["frames"]), len(cy[1]["frames"])

    for f in order:  # M25 (2x) bitmap, falling back to M22 upscaled 2x (MOUSE01)
        f["img"], _ = load_bmp_2x_space(f["bmp"], m25, m22)

    # Union bbox over ALL frames, placed by the (ox,oy) logical origin (y-up).
    minL = minB = 10**9
    maxR = maxT = -(10**9)
    for f in order:
        minL = min(minL, f["ox"]); maxR = max(maxR, f["ox"] + f["w"])
        minB = min(minB, f["oy"]); maxT = max(maxT, f["oy"] + f["h"])
    W, H = maxR - minL, maxT - minB
    anchor = [(0 - minL) / W, (maxT - 0) / H]  # where the sprite origin lands

    for i, f in enumerate(order):
        canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        x = f["ox"] - minL
        y = maxT - (f["oy"] + f["h"])  # y-up -> top-down
        canvas.alpha_composite(f["img"], (x, y))
        canvas.save(os.path.join(out, f"{i:02d}.png"))

    info = {"frames": len(order), "w": W, "h": H, "anchor": anchor,
            "runIn": run_in, "smash": smash, "runOut": run_out}
    print(json.dumps(info))

    # Contact sheet for QA.
    n = len(order)
    cell = 130
    sheet = Image.new("RGB", (n * cell, cell + 18), (60, 64, 76))
    draw = ImageDraw.Draw(sheet)
    for i in range(n):
        im = Image.open(os.path.join(out, f"{i:02d}.png")).copy()
        im.thumbnail((cell - 8, cell - 8))
        sheet.paste(im, (i * cell + (cell - im.width) // 2, 8), im)
        draw.text((i * cell + 4, cell + 4), str(i), fill=(255, 255, 0))
    sheet.save(os.path.join(out, "_contact_sheet.png"))
    print(f"contact sheet -> {out}/_contact_sheet.png")


if __name__ == "__main__":
    main()
