# Art, assets & animation

## Source material (not in the git repo)

- Original art lives in sibling folders **`C:\Users\toont\dev\M25\`** (735
  `.BMP` + 44 `.TTS` sprite-definition files; the primary source —
  **present**) and **`M22/`** (a **low-res** version of M25 — but it contains
  **a few images that are MISSING from M25**, so check M22 when an M25 bitmap
  is absent).
- **`C:\Users\toont\dev\source\`** — the **original ToonTalk C++ source**
  (present): per-element files (`number.cpp`, `text.cpp`, `pad.cpp`,
  `cubby.cpp` = boxes, `bird.cpp`, `robot.cpp`, `bomb.cpp`, `truck.cpp`,
  `thought.cpp`), `sprite.cpp`/`animate.cpp` (animation + the selection
  **wiggle** — selection feedback IS a wiggle),
  `dragdrop.cpp`/`mouse.cpp`/`input.cpp` (interaction), plus 19 `.tt` world
  files (the original save format → importable later) and `.pzl` puzzles.
  **This is ground truth for exact behavior** — read it instead of guessing.
  `ASSET_GUIDE.md` was derived from `sprite.cpp`.
- A screen-capture video is at `C:\Users\toont\dev\*.mp4`; extract frames
  with the ffmpeg at `C:\Program Files\CEWE Creator\CEWE Creator\ffmpeg.exe`
  (PNG encoder disabled — output `.jpg`; crop frames with PIL for close
  study).

## Converted assets

- Converted PNGs live in `public/assets/sprites/`. Black is the transparency
  key (see `ASSET_GUIDE.md` for the `.TTS` format, offsets, and per-asset
  exceptions like the green/magenta-keyed number/text plates).
- Known M25 gaps already substituted: wand (`USEWAND1`), dusty (`SUCK0`),
  thought bubble (`BUBBL10`). Tooling: `tools/parse-tts.py` →
  `tools/tts-manifest.json`.
- City art: `tools/bake-city.py` bakes `HELIOFLY`/`HELIOLND`/`MANWALK8` .TTS
  into `public/assets/city/{heli-fly,heli-land,person}/<dir>/NN.png` +
  `house-*/tree`, black-keyed and aligned via each frame's (ox,oy); M22
  frames upscaled 2× to the M25 space (`city-sprites.json` carries
  sizes/anchors/frame counts).
- Room art is in `public/assets/room/`
  (`floor/toolbox/notebook/hand/wandbar/truck.png`), converted from M25
  (toolbox+wand came from **M22** — missing from M25).
- `room/toolbox-open.png` is the **open Tooly**, cropped from the reference
  capture (`ToonTalk … claude 1 ….mp4`, frame ~4s) with the tan-lego
  background flood-filled to transparent (PIL). There is **no** open-toolbox
  bitmap in M25/M22 — `TOOLBOXA.TTS` is Tooly's 8-direction *walking* frames —
  so the open box (drawn at runtime by the original) is reproduced from the
  photo. `room.ts` `makeToolboxImage` overlays invisible per-compartment hit
  areas (number/text/box/nest/scale/robot/truck/bomb) for picking; falls back
  to the drawn grey-lego `makeToolboxDrawn` if the png is missing.

## Render modes

(`config/render-mode.ts`, view-only): `?mode=faithful` (default) = square
corners, chunky borders, nearest-neighbor pixels, playful font, no shadows;
`?mode=modern` = rounded corners, soft drop shadows, drag glow, smoothed
textures, clean sans. Driven by theme fields (`cornerRadius`, `borderWidth`,
`fontFamily`, `dropShadow`, `scaleMode`, `dragHighlight`).

- ✅ **Authentic plates done:** numbers use `numplat.png` (NUMBPLAT, green
  lego plate) and text uses `textplat.png` (TEXTPLT1, pink) — nine-slice via
  `view/plate.ts` (`drawPlate`). Chroma keys (green/magenta) are NOT keyed
  out.
- ✅ **Boxes** (box-view.ts) follow cubby.cpp: tiled lego pieces —
  `cubby1.png` (CUBBY1, first hole = wall·hole·wall) + `cubbyr.png` (CUBBYR,
  each further hole = hole·wall) abutted, **no outer frame**; empty holes
  show the recessed hole, contents drawn on top. (`cubbyb.png` = CUBBYB
  blank, for erased boxes — not yet used.)
- ✅ **Scale** uses distinct tilt bitmaps (scale-view.ts), **centred, never
  rotated**: `scale-level` (SCALE01), `scale-left` (SCALE04, left pan down =
  left heavier), `scale-right` (SCALE02, right pan down). tottering → level,
  faded.

## Frame-based sprite animation

`view/animation.ts`: loads cycle frames (converted from M25 to
`public/assets/anim/<name>/NN.png`, timings from `tts-manifest.json`) and
builds PIXI `AnimatedSprite`s on the shared ticker. `makeIdleSprite(name)`
plays the cycle then rests on frame 0 for ~2.6s before fidgeting again
(periodic idle, more faithful than a constant loop). Wired: **robot** uses
`robot-wait` (ROBOT.TTS cycle 13, 12 frames @200ms). Add an element by
converting its frames + adding a spec to `ANIMATIONS`. **Frames are baked
pre-aligned** to a uniform canvas using each frame's registration offset
(`-ox,-oy` from the manifest) so the element doesn't shift/scale during the
cycle — the spec stores the resulting `anchor`. `playOnce(name, parent, x,
y)` plays a cycle once and self-removes — used for one-shot effects: **bomb
explosion** (`explode`, EXPLODE.TTS) on a detonation, and **Dusty suck**
(`dusty-suck`, SUCK0–7) on an erase, both fired from main's drop resolver by
`DropResult`.
- **Lego→clay morph** (`mouse`, MOUSEHAM cycle = MOUSE01–04, the mouse with the
  big red hammer; MOUSE01 from M22 upscaled): `morphFromToolbox` is a port of
  mouse.cpp `call_in_a_mouse` — pulling an element from Tooly drops a flat lego
  brick (CUBBYB) at the spot, the bam-mouse runs in from off-screen, "bams" it,
  and the clay element pops in as the mouse runs out. A `setTimeout` safety
  always reveals the element even if the ticker stalls.
▢ Remaining: bird flight on delivery, nest hatch.
