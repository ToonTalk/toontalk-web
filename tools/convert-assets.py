#!/usr/bin/env python3
"""
Convert curated original ToonTalk bitmaps (M25) into transparent PNGs for the
web build, following the engine's rule that black is the transparency key.

Usage:  python3 convert-assets.py <M25_dir> <out_dir>

Edit ASSETS below to choose which source bitmap backs each web sprite. Also
writes <out_dir>/_contact_sheet.png for quick visual QA.
"""
import os, sys
from PIL import Image, ImageDraw

# web sprite name -> source .BMP (resting / primary frame)
# NOTE: this M25 set is missing some frames the TTS reference (e.g. SCALE03,
# BOMB01, CUBBY0). Those come from the supplemental Drive folder and will be
# added when we build the scale/bomb/box-art elements.
ASSETS = {
    # In use now (black-keyed character sprites):
    "robot": "RB00.BMP",        # the Lego robot (RB* = blocky, already Lego)
    "nest": "HATCH01.BMP",
    "bird": "FLY37.BMP",
    # Tools at REST are Lego (clay only while actively used). The Lego forms are
    # baked from EXT.ZIP via tools/convert-npics.py and are NOT managed here, so
    # this dict does NOT clobber them: wand <- LEGOWAND.EXT, dusty <- DMRPH01.EXT
    # (morph frame 1 = the Lego brick), pumpy <- PMRPH01.EXT. (The clay sources
    # were USEWAND1 / SUCK0 / PUMP00.)
    "bubble": "BUBBL10.BMP",    # thought bubble cloud (BIGBUBBL.BMP keys poorly)
    # No Lego form exists in the original art — both are clay sculptures even in
    # the original toolbox (the floor "S"/"C" bricks are a sensor and the Lego
    # wand, not the scale/bomb):
    "scale": "SCALE01.BMP",     # balance scale (SCALE01/02/04 = the tilts)
    "bomb": "BOMB04.BMP",       # round bomb with fuse
    # Plates carry M25's lego-stud background; need chroma keys + 9-slice:
    "numplat": "NUMBPLAT.BMP",  # green chroma key
    "textplat": "TEXTPLT1.BMP", # magenta chroma key
}

BLACK_THRESHOLD = 16


def key_black(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if max(r, g, b) < BLACK_THRESHOLD:
                px[x, y] = (0, 0, 0, 0)
    return im


def main():
    m25, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    converted = {}
    for name, bmp in ASSETS.items():
        src = os.path.join(m25, bmp)
        if not os.path.exists(src):
            print(f"  MISSING {bmp} (for {name})")
            continue
        im = key_black(Image.open(src))
        im.save(os.path.join(out, f"{name}.png"))
        converted[name] = im
        print(f"  {name}.png <- {bmp} ({im.size[0]}x{im.size[1]})")

    # Contact sheet on a grey checker so transparency is visible.
    if converted:
        cols = 3
        cell = 220
        rows = (len(converted) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * cell, rows * cell), (60, 64, 76))
        draw = ImageDraw.Draw(sheet)
        for i, (name, im) in enumerate(converted.items()):
            cx = (i % cols) * cell
            cy = (i // cols) * cell
            thumb = im.copy()
            thumb.thumbnail((cell - 20, cell - 36))
            sheet.paste(thumb, (cx + (cell - thumb.width) // 2, cy + 10), thumb)
            draw.text((cx + 6, cy + cell - 18), f"{name}  {im.size[0]}x{im.size[1]}", fill=(255, 255, 255))
        sheet.save(os.path.join(out, "_contact_sheet.png"))
        print(f"  contact sheet -> {out}/_contact_sheet.png")


if __name__ == "__main__":
    main()
