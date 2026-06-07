# ToonTalk Asset Guide

How the original ToonTalk art (the `M25/` folder of `.BMP` + `.TTS` files) is
structured, and how to render each element authentically in the web version.
Derived by reading the original `source/sprite.cpp` and parsing all 44 `.TTS`
files.

## Where the art lives

- **`M25/`** — ~735 bitmaps (`.BMP`) plus 44 sprite-definition files (`.TTS`).
- A `.TTS` file defines one *animated sprite* (an element): which bitmaps it
  uses and how they're grouped into animation cycles with per-frame size and
  registration offset.
- Bitmap files are named after the frame: `scale01` → `SCALE01.BMP`,
  `hatch01` → `HATCH01.BMP`.

## The `.TTS` format

Defined by `load_sprite_file_from_stream` (source/sprite.cpp ~line 703). Tokens
are whitespace-separated:

```
"SpriteVersion" 1
<repeat> <function_of_distance> <priority_function_of_lly>
<sound_mode>                       ; if != 0: <sound_file> <frequency> follow
<file_count>
  <name> <resource_index> <rectangular_mask_flag>     × file_count
<cycle_count>
  <ignore> <image_count>
    [<loop_back_index>]            ; appears before frame 0 only, if not "BMP"
    BMP <mirror> <duration> <w> <h> <xoff> <yoff> <imgoff> <imgsize> <comp> <bmpIndex>
    ...                            × image_count
  ...                             × cycle_count
```

Per-frame `BMP` fields that matter for rendering:

- `duration` — frame time (ms-ish) for animation.
- `w`, `h` — bitmap pixel size.
- `xoff`, `yoff` — registration offset. The engine positions the frame using
  `(-xoff, -yoff)`, so frames in a cycle line up even when sizes differ (e.g.
  the scale tilting). Use this as the sprite's anchor offset.
- `bmpIndex` — index into the file table → which `.BMP`.

`repeat` (header) = whether the cycle loops; otherwise it stops on the last
frame. `rectangular_mask_flag` (per bitmap) — see transparency below.

## Transparency

The colour key is **black** — `blit.cpp` repeatedly notes "black is
transparent". So when converting a `.BMP` to PNG: pixels at (≈0,0,0) become
fully transparent **unless** that bitmap's `rectangular_mask_flag` is `1`
(then the whole rectangle is opaque, e.g. solid backgrounds/UI plates).

Conversion rule used here: `alpha = 0 where max(r,g,b) < 16`, for masked sprites.

**Exception found empirically:** the number/text *plates* (`NUMBPLAT.BMP`,
`TEXTPLT1.BMP`) are not black-keyed — they use a chroma key (bright green and
magenta respectively). Those need per-asset key colours when integrated; the
character sprites (robot, bird, nest, wand, …) are all black-keyed.

## Special offset cases

`sprite.cpp` zeroes the offset (keeps the lower-left corner stable) for:
`CUBBY_SPRITE`, `NUMBER_PAD_SPRITE`, `TOOLBOX_ABOVE_SPRITE`, and
`WAND_BUTTON_SPRITE`. Treat those as bottom-left anchored rather than
hotspot-anchored.

## Element → art map (the elements we render)

| Web element | `.TTS` / source | Primary (resting) bitmap | Notes |
|---|---|---|---|
| Box | `CUBBY.TTS` | `CUBBY0.BMP` (162×296) | 6 frames (open/close). Offset forced to bottom-left. |
| Number pad | `NUMBER_PAD_SPRITE` (composite) | `NUMBPLAT.BMP` | Platform bitmap + the value drawn on top; not a single TTS. |
| Text pad | `TEXT_PAD_SPRITE` (composite) | `TEXTPLT1.BMP` | Same idea as numbers. |
| Bird | `BIRD.TTS` | a `FLY*`/`MORP*` frame (103 frames) | Has flying + morph + confused cycles → real flight animation later. |
| Nest | `NEST.TTS` | `HATCH01.BMP` (184×156) | 15 frames incl. egg hatching (`HATCH01–14`, `MKNEST25`). |
| Robot | `ROBOT.TTS` | `RB00.BMP` (100×167) | 58 frames, 14 cycles (wait/walk/work). |
| Scale | `SCALE.TTS` | `SCALE01–05.BMP` (≈120×91) | 8 cycles for the balance tilting by comparison. |
| Bomb | `BOMB.TTS` | `BOMB01.BMP` (107×143) | Fuse + explosion frames. |
| Truck | `TRUCKA.TTS` (+ `TRUCKI`) | `TRKTOP1.BMP` | Spawns running processes. |
| Notebook | `NOTEBOOK.TTS` | `NBPAGE1.BMP` | Page-turn animation. |
| Cursor hand | `HAND.TTS` | `HAND01.BMP` | Bare hand (grab cursor). |

## Gaps in this M25 set (and substitutes)

- **Wand** — `COPIER.TTS` references `legowand.bmp`, which is **not present**
  anywhere in the repo. Substitute: `USEWAND1.BMP` (the hand visibly holding the
  wand) — now used as `wand.png`. (`WAND01.BMP` is just a bare hand.)
- **Dusty / vacuum** — `VACUUM_SPRITE` exists in code but has **no `.TTS`** in
  M25. Frames exist as `SUCK0–7.BMP` (Dusty's suck animation; `SUCK0` resting)
  plus `VACBTN.BMP` (toolbar button). `dusty.png` is staged from `SUCK0`.
- **Thought bubble** — `THOUGHT_BUBBLE_SPRITE` exists in code, no `.TTS` here.
  `BUBBL10.BMP` is a clean cloud-with-trailing-bubbles and is staged as
  `bubble.png`. (`BIGBUBBL.BMP` is a faint full-screen overlay that keys poorly —
  don't use it.)

## Staged art (converted, not yet wired)

Ready in `public/assets/sprites/` for upcoming features; wire into the texture
manager + views when those features land:

| File | Source | For |
|---|---|---|
| `dusty.png` | `SUCK0.BMP` | Dusty the vacuum (erasing) |
| `bubble.png` | `BUBBL10.BMP` | robot thought bubble (condition) |
| `scale.png` | `SCALE01.BMP` | scale / comparison |
| `bomb.png` | `BOMB04.BMP` | bomb (terminate) — ✅ wired |
| `cubby.png` | `CUBBY1.BMP` | authentic box art (needs 9-slice) |

## Tooling

- `tools/parse-tts.py <M25_dir> [out.json]` — parses every `.TTS` into a JSON
  manifest (named bitmaps + cycles + per-frame size/offset/duration/mask).
- `tools/tts-manifest.json` — generated manifest for all 44 sprites; the data
  source for authentic frame/offset-driven rendering.

## Rendering recipe (for a TTS-defined element)

1. Convert each referenced `.BMP` to PNG (black→transparent unless rectangular).
2. For a static look, use cycle 0, frame 0 of the element.
3. Anchor each frame at `(-xoff, -yoff)` so multi-frame cycles register.
4. To animate, step frames by `duration`, looping if `repeat` is set (else hold
   the last frame).
