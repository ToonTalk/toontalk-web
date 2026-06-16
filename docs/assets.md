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
- Known M25 gaps already substituted: thought bubble (`BUBBL10`). Tooling:
  `tools/parse-tts.py` → `tools/tts-manifest.json`.
- **Lego vs clay** — ToonTalk's data (numbers/text/boxes) and *resting* tools
  are studded **Lego**; **clay** is for the active/alive characters. Tools at
  rest now use their Lego forms, baked from EXT.ZIP via `convert-npics.py`:
  **wand** ← `LEGOWAND` (studded beam + star), **dusty** ← `DMRPH01` (the
  morph's frame 1 = the flat Lego brick), **pumpy** ← `PMRPH01` (Lego pump). The
  **robot** (`RB00`), number/text plates, box (`CUBBY*`) and truck (`TRKSIDE`)
  were already Lego. The **scale** (`SCALE01/02/04` balance) and **bomb**
  (`BOMB04` round) have **no Lego form in the original art** — they are clay
  sculptures even in the original's toolbox — so they stay clay. A tool's mode
  shows as a **1×1 Lego plate** (`view/lego-button.ts`, a yellow studded tile +
  letter) placed ON the tool per `MODE_BUTTON_FRAC` — Dusty's nose, the wand's
  tip, a little below centre on Pumpy. In Tooly the **robot is rendered static**
  (`renderThingDisplay({static:true})` freezes its idle cycle) until taken out.
- City art: `tools/bake-city.py` bakes `HELIOFLY`/`HELIOLND`/`MANWALK8` .TTS
  into `public/assets/city/{heli-fly,heli-land,person}/<dir>/NN.png` +
  `house-*/tree`, black-keyed and aligned via each frame's (ox,oy); M22
  frames upscaled 2× to the M25 space (`city-sprites.json` carries
  sizes/anchors/frame counts).
- Room art is in `public/assets/room/`
  (`floor/toolbox/notebook/hand/wandbar/truck.png`), converted from M25
  (toolbox+wand came from **M22** — missing from M25).
- **`NPICS/` (sibling of M25, not in the repo)** — a higher-quality original-art
  set: sprites as Apple **QuickDraw PICT** colour (`.PIC`, v2 DirectBits/PackBits)
  **plus a separate BMP/MIC mask** (a white silhouette → a *real* alpha channel,
  far cleaner than colour-keying). Covers the **toolbox** (`TBMORPH/TBMRPH09`),
  trucks, the side helicopter (`COPTER/FROMSIDE`), the flower, and room/title
  backgrounds (640×480). It does **not** include the hand, tools, or the data
  elements. Convert with `tools/convert-npics.py` (ImageMagick `PICT:` decoder +
  PIL to copy the mask into alpha and trim). Needs ImageMagick installed.
- `room/toolbox-open.png` is now the **open Tooly** from `NPICS TBMRPH09`
  (clean PICT colour + its BMP mask → crisp, fully transparent), replacing the
  earlier video crop. `room.ts` `makeToolboxImage` renders the real element icons
  (number/text/box/nest/scale/robot/truck/bomb) into the tray over the art with a
  hit area on each; the whole box is draggable; falls back to the drawn grey-lego
  `makeToolboxDrawn` if the png is missing. (M25/M22 have no open-toolbox bitmap —
  `TOOLBOXA.TTS` is Tooly's *walking* frames.)

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
  left heavier), `scale-right` (SCALE02, right pan down). tottering → level
  beam (fully opaque — a fresh scale is not faded).

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
- **Lego→clay morph** (`mouse`, the mouse with the big red hammer): the **full
  22-frame MOUSEHAM** is baked by `tools/bake-mouse.py` into one uniform
  273×299 canvas (all four .TTS cycles aligned by each frame's (ox,oy) origin so
  the body stays put while the hammer swings), in playback order: run-in
  `[0..3]` (MOUSE_RUNNING_NORTHEAST), smash `[4..17]` (USING_HAMMER_TO_SMASH +
  AFTER_SMASH — windup→slam→lift), run-out `[18..21]` (RUNNING_SOUTHEAST);
  MOUSE01 comes from M22 upscaled 2×. `runMouse` (animation.ts) ports mouse.cpp
  `call_in_a_mouse`: the bam-mouse runs in, **plants at the item and slams the
  hammer DOWN** (the smash cycle plays once; `onBam` fires at frame 9, the moment
  of impact, popping in the clay element), then runs out and removes itself. Used
  by main's drop resolver on a combine/join of pads/boxes.
- **Bird flight** (`bird-fly`, BIRD.TTS cycles 0–7 = the Direction enum
  E,SE,S,SW,W,NW,N,NE, 6 frames each, flight bitmaps `FLY*.BMP`): a **directional**
  cycle baked by `tools/bake-bird.py` into `anim/bird-fly/<d>/NN.png` (all eight
  directions centroid-aligned to ONE shared canvas/anchor, so swapping mid-flight
  doesn't jump). Specs with a `dirs` count load into `loaded` under `<name>:<d>`.
  `flyBird` ports bird.cpp `fly_to`, which sets the cycle to `direction(dx,dy)`:
  the bird **faces the way it flies** out to the target, then flips to the
  opposite octant for the return leg. Wired in main's resolver on `'delivered'`.
- **Nest hatch** (`nest-hatch`, NEST.TTS cycle 2 = HATCH02–14, baked by
  `tools/bake-nest.py`; static nest = HATCH01 = `nest.png`): `hatchNest`
  (animation.ts) ports bird.cpp `Nest::hatch_bird` → `bird_has_hatched` — the
  egg cracks open on the nest (the 13-frame overlay, anchored on the egg via the
  bake's `nestAnchor` so it sits exactly on the static nest), the bird emerges
  near the last frame and **flies up out of the nest** one-way to its resting
  spot, growing from tiny to full size and facing its flight direction. Once
  hatched, `Nest.hatched` is set and the nest renders the **empty nest**
  (`nest-empty.png` = `MKNEST25`, the woven bowl) instead of the egg
  (`nest.png` = HATCH01). The resting bird (`bird.png`) is scaled to about the
  nest's size. Wired in main's toolbox auto-hatch (a fresh nest is an egg that
  hatches a bird to feed it). The drag-controller hatch (pressing an empty nest)
  stays immediate — the user grabs the new bird, so no fly-up there.
▢ Remaining: bird t-shirt / nest label media; network birds.
