#!/usr/bin/env python3
"""Bake the bird's 8 directional flight cycles (BIRD.TTS cycles 0-7) into web
frame sets, so a delivering bird faces the direction it flies — bird.cpp
`fly_to` sets the sprite cycle to `direction(dx,dy)` (the Direction enum:
E,SE,S,SW,W,NW,N,NE). Flight frames are FLY*.BMP (M25, M22 fallback upscaled 2x).

Reuses bake-city's parser/prep/directional baker. Centroid-aligned so the body
stays put while the wings flap (like the helicopter rotor).

Output: public/assets/anim/bird-fly/<d>/NN.png + a printed {w,h,anchor,frameCounts}.
Usage: python3 tools/bake-bird.py [M25_dir] [M22_dir] [out_dir]
"""
import os, sys, json
from importlib import import_module

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
_bc = import_module("bake-city")


def main():
    m25 = sys.argv[1] if len(sys.argv) > 1 else "C:/Users/toont/dev/M25"
    m22 = sys.argv[2] if len(sys.argv) > 2 else "C:/Users/toont/dev/M22"
    out = sys.argv[3] if len(sys.argv) > 3 else "public/assets/anim"

    geom = _bc.parse_tts(os.path.join(m25, "BIRD.TTS"))
    _bc.prep_geom(geom, m25, m22, from_m25=True)
    info = _bc.bake_directional(geom, out, "bird-fly", m25, m22,
                                use_cycles=[0, 1, 2, 3, 4, 5, 6, 7], align="centroid")
    print(json.dumps(info))


if __name__ == "__main__":
    main()
