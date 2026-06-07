#!/usr/bin/env python3
"""
Parse the original ToonTalk .TTS sprite-definition files into a JSON manifest.

The .TTS format is defined by `load_sprite_file_from_stream` in the original
source (source/sprite.cpp). This parser follows that reader exactly:

  "SpriteVersion" 1
  <repeat_flag> <function_of_distance> <priority_function_of_lly>
  <sound_mode>                 ; if != 0, followed by <sound_file> <frequency>
  <file_count>
    <name> <resource_index> <rectangular_mask_flag>   x file_count
  <cycle_count>
    <ignore> <image_count>
      [<loop_back_index>]      ; only before the first frame, if not "BMP"
      BMP <mirror> <duration> <w> <h> <xoff> <yoff> <imgoff> <imgsize> <comp> <bmpIndex>
      ... x image_count
    ... x cycle_count

Each frame's bitmap is named by the file_count table; the on-disk file is that
name upper-cased + ".BMP" (e.g. scale01 -> SCALE01.BMP). Transparency: black
(0,0,0) is the colour key unless the bitmap's rectangular_mask_flag is set.

Usage:  python3 parse-tts.py <M25_dir> [out.json]
"""
import os, sys, json, glob


def parse_tts(path):
    toks = open(path, "r", errors="replace").read().split()
    i = 0

    def nxt():
        nonlocal i
        t = toks[i]
        i += 1
        return t

    assert nxt() == "SpriteVersion"
    int(nxt())  # version (must be 1)
    repeat = int(nxt()); int(nxt()); int(nxt())
    sound_mode = int(nxt())
    if sound_mode != 0:
        nxt(); nxt()  # sound file name, frequency
    file_count = int(nxt())
    bitmaps = []
    for _ in range(file_count):
        name = nxt(); res = int(nxt()); rect = int(nxt())
        bitmaps.append({"name": name, "res": res, "rect": rect})
    cycle_count = int(nxt())
    cycles = []
    for _ in range(cycle_count):
        int(nxt())  # ignore_ideal_parameters
        image_count = int(nxt())
        frames = []
        loop_back = None
        for j in range(image_count):
            t = nxt()
            if j == 0 and t != "BMP":
                loop_back = int(t)
                t = nxt()
            assert t == "BMP", f"{path}: expected BMP, got {t}"
            mirror = int(nxt()); dur = int(nxt())
            w = int(nxt()); h = int(nxt())
            ox = int(nxt()); oy = int(nxt())
            int(nxt()); int(nxt()); int(nxt())  # image offset, size, compression
            fidx = int(nxt())
            bm = bitmaps[fidx]
            frames.append({
                "bmp": bm["name"].upper() + ".BMP",
                "w": w, "h": h, "ox": ox, "oy": oy,
                "dur": dur, "rect": bm["rect"],
            })
        cycles.append({"loop_back": loop_back, "frames": frames})
    return {"repeat": repeat, "bitmaps": [b["name"] for b in bitmaps], "cycles": cycles}


def main():
    m25 = sys.argv[1] if len(sys.argv) > 1 else "M25"
    out = sys.argv[2] if len(sys.argv) > 2 else "tts-manifest.json"
    manifest, errors = {}, {}
    for p in sorted(glob.glob(os.path.join(m25, "*.TTS"))):
        name = os.path.splitext(os.path.basename(p))[0]
        try:
            manifest[name] = parse_tts(p)
        except Exception as e:  # noqa
            errors[name] = str(e)
    json.dump(manifest, open(out, "w"), indent=1)
    print(f"parsed {len(manifest)} sprites -> {out}")
    if errors:
        print("errors:", errors)


if __name__ == "__main__":
    main()
