#!/usr/bin/env python3
"""
Bake the ToonTalk city sprites (helicopter flying, helicopter landing, the
walking person) and the city decor (house tops, tree) into web PNG frame sets.

Follows the original .TTS geometry (see tools/parse-tts.py). Frames are baked
black-keyed to transparency and aligned to a single uniform canvas per sprite,
using each frame's (ox, oy) lower-left offset, so the figure does not jiggle as
it animates or changes direction.

Resolution: M25 art is exactly 2x M22. The flying helicopter uses M25 where the
bitmap exists, falling back to M22 upscaled 2x for the few frames M25 is missing.
The landing helicopter and the walking person have no M25 .TTS, so they come from
M22 upscaled 2x. Everything therefore lives in the M25 (2x) coordinate space.

Output (under public/assets/city/):
  heli-fly/<d>/NN.png   8 directions (cycle = Direction enum: E,SE,S,SW,W,NW,N,NE)
  heli-land/NN.png      the descending/hovering helicopter (HELIOLND cycle 0)
  person/<d>/NN.png     8 directions of the walking person
  house-b.png house-a.png house-c.png tree.png   static decor tops
  _contact_sheet.png    QA

Also prints a JS-ready summary (canvas size + anchor + per-dir frame counts).

Usage:  python3 tools/bake-city.py [M25_dir] [M22_dir] [out_dir]
"""
import os, sys, json
from PIL import Image, ImageDraw

BLACK_THRESHOLD = 16


def parse_tts(path):
    toks = open(path, "r", errors="replace").read().split()
    i = 0

    def nxt():
        nonlocal i
        t = toks[i]; i += 1; return t

    assert nxt() == "SpriteVersion"
    int(nxt())
    int(nxt()); int(nxt()); int(nxt())
    sound_mode = int(nxt())
    if sound_mode != 0:
        nxt(); nxt()
    file_count = int(nxt())
    bitmaps = []
    for _ in range(file_count):
        name = nxt(); int(nxt()); rect = int(nxt())
        bitmaps.append({"name": name, "rect": rect})
    cycle_count = int(nxt())
    cycles = []
    for _ in range(cycle_count):
        int(nxt())
        image_count = int(nxt())
        frames = []
        for j in range(image_count):
            t = nxt()
            if j == 0 and t != "BMP":
                int(t); t = nxt()
            assert t == "BMP", f"{path}: expected BMP, got {t}"
            int(nxt()); int(nxt())
            w = int(nxt()); h = int(nxt())
            ox = int(nxt()); oy = int(nxt())
            int(nxt()); int(nxt()); int(nxt())
            fidx = int(nxt())
            bm = bitmaps[fidx]
            frames.append({"bmp": bm["name"].upper() + ".BMP", "w": w, "h": h,
                           "ox": ox, "oy": oy, "rect": bm["rect"]})
        cycles.append({"frames": frames})
    return {"cycles": cycles}


def key_black(im):
    """Make the background transparent by removing the art's RESERVED transparent
    palette index (the most common index among the four corners — index 0/black in
    this 8-bit art). This removes the background EVERYWHERE — the border AND
    enclosed pockets (under an arm, helicopter windows, between robot legs) — while
    keeping every figure pixel, including dark ones (hair, robot seams) that use
    OTHER indices. (A brightness threshold wrongly removed those dark figure pixels
    — 'moth-eaten'; a flood-fill kept the enclosed pockets as solid black.)"""
    if im.mode == "P":
        from collections import Counter
        idx = im.load()
        w, h = im.size
        bg = Counter([idx[0, 0], idx[w - 1, 0], idx[0, h - 1], idx[w - 1, h - 1]]).most_common(1)[0][0]
        rgba = im.convert("RGBA")
        px = rgba.load()
        for y in range(h):
            for x in range(w):
                if idx[x, y] == bg:
                    px[x, y] = (0, 0, 0, 0)
        return rgba
    # non-palettized fallback: per-pixel black threshold
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            if max(r, g, b) < BLACK_THRESHOLD:
                px[x, y] = (0, 0, 0, 0)
    return im


def load_bmp_2x_space(bmp, m25_dir, m22_dir):
    """Return an RGBA bitmap in M25 (2x) pixel space, plus a flag whether it was
    sourced from M25. M22 bitmaps are nearest-upscaled 2x to match."""
    p25 = os.path.join(m25_dir, bmp)
    if os.path.exists(p25):
        return key_black(Image.open(p25)), True
    p22 = os.path.join(m22_dir, bmp)
    if os.path.exists(p22):
        im = key_black(Image.open(p22))
        im = im.resize((im.width * 2, im.height * 2), Image.NEAREST)
        return im, False
    return None, False


def opaque_centroid(img):
    """Centroid of the opaque pixels — a stable anchor for animation frames
    whose bounding box wobbles (e.g. spinning rotor blades)."""
    px = img.load()
    w, h = img.size
    sx = sy = n = 0
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 24:
                sx += x
                sy += y
                n += 1
    return (sx / n, sy / n) if n else (w / 2.0, h / 2.0)


def bake_directional(sprite_geom, out_root, name, m25_dir, m22_dir, use_cycles=None, align="origin"):
    """Bake a multi-cycle (directional) sprite. align="origin" places frames by
    the .TTS (ox,oy) logical origin; align="centroid" places them by their
    opaque-pixel centroid so the body stays put while the rotor spins (fixes the
    helicopter "jump")."""
    cycles = sprite_geom["cycles"]
    sel = use_cycles if use_cycles is not None else list(range(len(cycles)))

    if align == "centroid":
        cents = {}
        hl = hr = ht = hb = 0.0
        for ci in sel:
            for fi, f in enumerate(cycles[ci]["frames"]):
                im = f["img"]
                cx, cy = opaque_centroid(im) if im is not None else (0, 0)
                cents[(ci, fi)] = (cx, cy)
                if im is not None:
                    hl = max(hl, cx); hr = max(hr, im.width - cx)
                    ht = max(ht, cy); hb = max(hb, im.height - cy)
        W = int(round(hl + hr)); H = int(round(ht + hb))
        anchor = [hl / W, ht / H]
        counts = []
        for out_i, ci in enumerate(sel):
            cdir = os.path.join(out_root, name, str(out_i))
            os.makedirs(cdir, exist_ok=True)
            frames = cycles[ci]["frames"]
            for fi, f in enumerate(frames):
                canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                if f["img"] is not None:
                    cx, cy = cents[(ci, fi)]
                    canvas.alpha_composite(f["img"], (int(round(hl - cx)), int(round(ht - cy))))
                canvas.save(os.path.join(cdir, f"{fi:02d}.png"))
            counts.append(len(frames))
        return {"name": name, "w": W, "h": H, "anchor": anchor, "frameCounts": counts}

    # align == "origin": union bounding box, placed by the (ox,oy) logical origin.
    minL = minB = 10**9
    maxR = maxT = -(10**9)
    for ci in sel:
        for f in cycles[ci]["frames"]:
            ox, oy, w, h = f["ox2"], f["oy2"], f["w2"], f["h2"]
            minL = min(minL, ox); maxR = max(maxR, ox + w)
            minB = min(minB, oy); maxT = max(maxT, oy + h)
    W = maxR - minL
    H = maxT - minB
    anchor = [(0 - minL) / W, (maxT - 0) / H]

    counts = []
    for out_i, ci in enumerate(sel):
        cdir = os.path.join(out_root, name, str(out_i))
        os.makedirs(cdir, exist_ok=True)
        frames = cycles[ci]["frames"]
        for fi, f in enumerate(frames):
            canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            if f["img"] is not None:
                x = f["ox2"] - minL
                y = maxT - (f["oy2"] + f["h2"])  # y-up -> top-down
                canvas.alpha_composite(f["img"], (x, y))
            canvas.save(os.path.join(cdir, f"{fi:02d}.png"))
        counts.append(len(frames))
    return {"name": name, "w": W, "h": H, "anchor": anchor, "frameCounts": counts}


def _centroid(img, top_frac=1.0):
    """Centroid of opaque pixels within the top `top_frac` of the image's opaque
    bbox (top_frac<1 → the head region of a standing figure)."""
    bbox = img.getbbox()
    if not bbox:
        return None
    x0, y0, x1, y1 = bbox
    yb = y0 + max(1, int((y1 - y0) * top_frac))
    px = img.load(); sx = sy = n = 0
    for yy in range(y0, yb):
        for xx in range(x0, x1):
            if px[xx, yy][3] > 40:
                sx += xx; sy += yy; n += 1
    return (sx / n, sy / n) if n else None


def _place_head(canvas, pimg, ppx, ppy, himg, neck_frac=0.18):
    """Composite an overlay head `himg` (a full replacement head) onto a person
    image `pimg` already placed at (ppx,ppy) on `canvas`, by aligning the
    overlay's centroid to the person's HEAD centroid (top of the figure). The
    head bobs per walk frame, so this is computed per frame. `neck_frac` raises
    the head by that fraction of its height so the NECK stays visible below it."""
    hc = _centroid(pimg, 0.22)   # person head centre (figure-local)
    oc = _centroid(himg, 1.0)    # overlay head centre
    if hc is None or oc is None:
        return
    obbox = himg.getbbox()
    nudge = int(round((obbox[3] - obbox[1]) * neck_frac)) if obbox else 0
    hx = int(round(ppx + hc[0] - oc[0]))
    hy = int(round(ppy + hc[1] - oc[1] - nudge))  # raise so the neck shows
    canvas.alpha_composite(himg, (hx, hy))


def bake_person_with_overlay(person_geom, overlay_geom, remap_start, out_root, name):
    """Composite a head overlay (HAIR/HAT — a single 64-frame cycle ordered
    E,N,NE,S,SE,W,NW,SW, each a full replacement head) onto the 8-cycle walking
    person (enum order E,SE,S,SW,W,NW,N,NE), per direction/frame — aligning the
    overlay onto the person's detected head so it tracks the bob. The figure is
    placed by the person's (ox,oy) origin so the feet stay planted (no jiggle);
    a top margin leaves room for hair that pokes above the head."""
    pcyc = person_geom["cycles"]
    ov = overlay_geom["cycles"][0]["frames"]
    NDIR, NF = 8, 8
    minL = minB = 10**9
    maxR = maxT = -(10**9)
    for d in range(NDIR):
        for f in range(NF):
            fr = pcyc[d]["frames"][f]
            minL = min(minL, fr["ox2"]); maxR = max(maxR, fr["ox2"] + fr["w2"])
            minB = min(minB, fr["oy2"]); maxT = max(maxT, fr["oy2"] + fr["h2"])
    MT = 28  # top margin so an overlay that pokes above the head isn't clipped
    W, H = maxR - minL, (maxT - minB) + MT
    top = maxT + MT  # canvas top edge, in y-up coords
    anchor = [(0 - minL) / W, top / H]
    for d in range(NDIR):
        cdir = os.path.join(out_root, name, str(d))
        os.makedirs(cdir, exist_ok=True)
        for f in range(NF):
            pf = pcyc[d]["frames"][f]; hf = ov[remap_start[d] + f]
            canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            if pf["img"] is not None:
                ppx = pf["ox2"] - minL; ppy = top - (pf["oy2"] + pf["h2"])
                canvas.alpha_composite(pf["img"], (ppx, ppy))
                if hf["img"] is not None:
                    _place_head(canvas, pf["img"], ppx, ppy, hf["img"])
            canvas.save(os.path.join(cdir, f"{f:02d}.png"))
    return {"name": name, "w": W, "h": H, "anchor": anchor, "frameCounts": [NF] * NDIR}


def bake_head_icon(person_geom, overlay_geom, remap_start, out_path):
    """A front-facing (SOUTH) head icon for the settings panel: the person's south
    frame with the chosen head placed on it, cropped to the head, squared."""
    d = 2  # SOUTH, toward the viewer
    pf = person_geom["cycles"][d]["frames"][0]
    pimg = pf["img"]
    W, H = pimg.width, pimg.height + 40
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(pimg, (0, 40))
    if overlay_geom is not None:
        hf = overlay_geom["cycles"][0]["frames"][remap_start[d]]
        if hf["img"] is not None:
            _place_head(canvas, pimg, 0, 40, hf["img"])
    hc = _centroid(canvas, 1.0)
    bbox = canvas.getbbox()
    x0, y0, x1, y1 = bbox
    # crop a square around the head: from the top of opaque content down ~head height
    head_h = int((x1 - x0) * 1.15)
    head = canvas.crop((x0, y0, x1, min(y1, y0 + head_h)))
    side = max(head.width, head.height)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.alpha_composite(head, ((side - head.width) // 2, 0))
    sq.thumbnail((84, 84))
    sq.save(out_path)


def prep_geom(geom, m25_dir, m22_dir, from_m25):
    """Attach 2x-space geometry + loaded image to every frame in place."""
    for cyc in geom["cycles"]:
        for f in cyc["frames"]:
            img, _ = load_bmp_2x_space(f["bmp"], m25_dir, m22_dir)
            f["img"] = img
            if from_m25:
                # geometry already in M25 (2x) units
                f["w2"], f["h2"], f["ox2"], f["oy2"] = f["w"], f["h"], f["ox"], f["oy"]
            else:
                f["w2"], f["h2"], f["ox2"], f["oy2"] = f["w"] * 2, f["h"] * 2, f["ox"] * 2, f["oy"] * 2


def bake_brushes(source_dir, m25_dir, out_dir):
    """Decode the original ground 'brushes' (source/BRUSH<i>.BRH).

    Each is a 64-byte 8x8 8-bit DIB pattern (bottom-up rows) using the shared
    ToonTalk 256-colour palette — sprite.cpp reads 64 bytes per brush into
    create_DIB_brush. Index order is the BrushId enum (constant.h:318):
      0-2 LAWN1/2/4, 3 LAWN_SIDE, 4-6 ROOF_A/B/C,
      7-9 STREET1/2/4, 10 STREET_SIDE, 11-13 WATER1/2/4.
    The numeric tiers are zoom levels (city.cpp: scale<3 -> 1, <6 -> 2, else 4;
    the front/side view uses the 4-tier per street_brush_id/lawn_brush_id).
    """
    # the global palette, from any 8-bit M25 bitmap
    pal_im = Image.open(os.path.join(m25_dir, "HELI07.BMP"))
    palette = pal_im.getpalette()
    names = {
        0: "brush-lawn1", 1: "brush-lawn2", 2: "brush-lawn4", 3: "brush-lawn-side",
        7: "brush-street1", 8: "brush-street2", 9: "brush-street4", 10: "brush-street-side",
        11: "brush-water1", 12: "brush-water2", 13: "brush-water4",
    }
    for idx, name in names.items():
        path = os.path.join(source_dir, f"BRUSH{idx}.BRH")
        if not os.path.exists(path):
            print(f"  MISSING {path}")
            continue
        data = open(path, "rb").read()
        im = Image.new("P", (8, 8))
        im.putpalette(palette)
        for y in range(8):  # DIB rows are bottom-up
            for x in range(8):
                im.putpixel((x, 7 - y), data[y * 8 + x])
        im.convert("RGB").save(os.path.join(out_dir, f"{name}.png"))


def bake_static(bmp, out_path, m25_dir, m22_dir, max_dim=None, key=True):
    """Bake one bitmap to a PNG. key=True applies the black transparency key
    (sprites); key=False keeps it opaque (room floors / wall backdrops)."""
    p = os.path.join(m25_dir, bmp)
    if not os.path.exists(p):
        p = os.path.join(m22_dir, bmp)
    if not os.path.exists(p):
        print(f"  MISSING static {bmp}")
        return None
    img = key_black(Image.open(p)) if key else Image.open(p).convert("RGBA")
    if max_dim:
        img.thumbnail((max_dim, max_dim))
    img.save(out_path)
    return img


def main():
    m25 = sys.argv[1] if len(sys.argv) > 1 else "/c/Users/toont/dev/M25"
    m22 = sys.argv[2] if len(sys.argv) > 2 else "/c/Users/toont/dev/M22"
    out = sys.argv[3] if len(sys.argv) > 3 else "public/assets/city"
    os.makedirs(out, exist_ok=True)
    summary = {}

    # Flying helicopter: M25 geometry (2x), M22 fallback for missing BMPs.
    fly = parse_tts(os.path.join(m25, "HELIOFLY.TTS"))
    prep_geom(fly, m25, m22, from_m25=True)
    # centroid-align so the body stays put while the rotor spins (no "jump")
    summary["heli-fly"] = bake_directional(fly, out, "heli-fly", m25, m22, align="centroid")

    # Landing helicopter: M22 only (no M25 TTS). Cycle 0 = hover (3 frames).
    land = parse_tts(os.path.join(m22, "HELIOLND.TTS"))
    prep_geom(land, m25, m22, from_m25=False)
    sland = bake_directional(land, out, "heli-land", m25, m22, use_cycles=[0], align="centroid")
    # collapse the single-"direction" output dir up one level (heli-land/0 -> heli-land)
    summary["heli-land"] = sland

    # Walking person: M22 only.
    walk = parse_tts(os.path.join(m22, "MANWALK8.TTS"))
    prep_geom(walk, m25, m22, from_m25=False)
    summary["person"] = bake_directional(walk, out, "person", m25, m22)

    # Head overlays composited on the walking person (the "choice of heads"):
    # HAIR = purple-hair girl, HAT = red-cap boy. Same 8-dir x 8-frame structure
    # as MANWALK8, sharing the logical origin, so align="origin" lines them up on
    # the head per direction/frame. (The third choice, plain, is no overlay.)
    # The hair/hat are a single 64-frame cycle ordered E,N,NE,S,SE,W,NW,SW; remap
    # to the person's Direction-enum cycle order and composite onto each frame.
    HEAD_REMAP = [0, 32, 24, 56, 40, 48, 8, 16]  # enum dir -> start frame in the 64-cycle
    hair = parse_tts(os.path.join(m22, "HAIR.TTS"))
    prep_geom(hair, m25, m22, from_m25=False)
    summary["person-hair"] = bake_person_with_overlay(walk, hair, HEAD_REMAP, out, "person-hair")
    hat = parse_tts(os.path.join(m22, "HAT.TTS"))
    prep_geom(hat, m25, m22, from_m25=False)
    summary["person-hat"] = bake_person_with_overlay(walk, hat, HEAD_REMAP, out, "person-hat")
    # Head-choice icons for the settings panel (front-facing heads).
    bake_head_icon(walk, None, HEAD_REMAP, os.path.join(out, "head-none.png"))
    bake_head_icon(walk, hair, HEAD_REMAP, os.path.join(out, "head-hair.png"))
    bake_head_icon(walk, hat, HEAD_REMAP, os.path.join(out, "head-hat.png"))

    # Tooly the toolbox (side view, follows the walker): 8 directions x 4 frames.
    tooly = parse_tts(os.path.join(m25, "TOOLBOXS.TTS"))
    prep_geom(tooly, m25, m22, from_m25=True)
    summary["tooly"] = bake_directional(tooly, out, "tooly", m25, m22)

    # Static decor tops (flyover).
    bake_static("HSBTOP20.BMP", os.path.join(out, "house-b.png"), m25, m22)
    bake_static("HSCTOP20.BMP", os.path.join(out, "house-c.png"), m25, m22)
    bake_static("TREE04.BMP", os.path.join(out, "tree.png"), m25, m22)

    # Side-view houses (landing/walking street view) + the parked helicopter.
    bake_static("HSA18.BMP", os.path.join(out, "house-a-side.png"), m25, m22)
    bake_static("HSB20.BMP", os.path.join(out, "house-b-side.png"), m25, m22)
    bake_static("HSC20.BMP", os.path.join(out, "house-c-side.png"), m25, m22)
    # The parked copter must be EMPTY (you've climbed out and walked off). The
    # HELIOLND cycles are: 0 LANDING (HLM1-3, canopy down, no one visible),
    # 1 PERSON_LEAVING (HLM4-7, pilot climbing out — pilot VISIBLE), 3 EMPTY
    # (HLM7). HLM7's BMP still shows the pilot mid-exit, so for the parked-and-
    # left copter we use HLM1 (no visible pilot). M22-only, so upscale 2x to the
    # M25 bake space.
    _hlm1 = os.path.join(m22, "HELIHLM1.BMP")
    _im = key_black(Image.open(_hlm1))
    _im = _im.resize((_im.width * 2, _im.height * 2), Image.NEAREST)
    _im.save(os.path.join(out, "heli-parked.png"))

    # Room interior (you stand here after entering a house, before sitting):
    # the floor baseplate per house style, a back-wall strip, and the door.
    bake_static("FLOORC.BMP", os.path.join(out, "floor-a.png"), m25, m22, key=False)  # tan
    bake_static("FLOORB.BMP", os.path.join(out, "floor-b.png"), m25, m22, key=False)  # blue
    bake_static("FLOORD.BMP", os.path.join(out, "floor-c.png"), m25, m22, key=False)  # green
    bake_static("BACKWALL.BMP", os.path.join(out, "backwall.png"), m25, m22, key=False)
    bake_static("WALL.BMP", os.path.join(out, "wall.png"), m25, m22, key=False)  # white brick
    bake_static("ROOMDOOR.BMP", os.path.join(out, "roomdoor.png"), m25, m22)

    # The Lego ground brushes (lawn/street/water patterns).
    source_dir = os.path.join(os.path.dirname(os.path.abspath(m25)), "source")
    bake_brushes(source_dir, m25, out)

    json.dump(summary, open(os.path.join(out, "city-sprites.json"), "w"), indent=1)
    print(json.dumps(summary, indent=1))

    # Contact sheet: first frame of each direction for the three animated sprites.
    rows = []
    for name in ["heli-fly", "heli-land", "person"]:
        s = summary[name]
        dirs = len(s["frameCounts"])
        rows.append((name, dirs))
    cell = 160
    cols = 8
    sheet = Image.new("RGB", (cols * cell, len(rows) * cell), (60, 64, 76))
    draw = ImageDraw.Draw(sheet)
    for ri, (name, dirs) in enumerate(rows):
        for d in range(dirs):
            fp = os.path.join(out, name, str(d), "00.png")
            if not os.path.exists(fp):
                continue
            im = Image.open(fp).copy()
            im.thumbnail((cell - 16, cell - 24))
            sheet.paste(im, (d * cell + (cell - im.width) // 2, ri * cell + 8), im)
        draw.text((4, ri * cell + cell - 14), name, fill=(255, 255, 255))
    sheet.save(os.path.join(out, "_contact_sheet.png"))
    print(f"contact sheet -> {out}/_contact_sheet.png")


if __name__ == "__main__":
    main()
