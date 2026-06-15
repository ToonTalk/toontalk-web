# Faithful C++ → TypeScript port

The way we close the gap with the original: **port the C++ in
`C:\Users\toont\dev\source` faithfully, one logic slice at a time**, instead of
reconstructing behavior. Approximation drifts; the source is ground truth.

## Method: port the *logic*, shim the *platform*

The logic files transitively `#include` ~33 platform headers (DirectX / Win32 /
GMP), so a whole file can't be translated in isolation. Split every file:

### Platform — reimplement once, never translate
PixiJS + DOM events + our `Rational` **are** this layer. Do not port:

| C++ | our substitute |
|---|---|
| `blit/blitbody/dispdib/genpalet` (palette DIB blitter) | PixiJS draws sprites |
| `dirty/region/quadtree/cache` (dirty-rect + spatial index) | PixiJS scene graph |
| `dsutil/sounds` (DirectSound) | (WebAudio later / stub) |
| `input` (DirectInput) | DOM events → the react() input shape |
| `winmain/main` (Win32 message loop) | the Pixi ticker + `main.ts` |
| `gmp` (bignum) | `src/model/rational.ts` |

### Logic — port faithfully, function-by-function
Same class/method names, constants, and control flow; idiomatic TS; every ported
function carries a `// prgrmmr.cpp:3988`-style cross-ref. Even inside a logic
file, port the rule/geometry/state methods and route `display()`/blit to Pixi.

Files: `constant.h/globals.cpp` (constants), `screen.cpp` (camera), `block.cpp`
`city.cpp` (city geometry), `prgrmmr.cpp` (the Programmer state machine),
`sprite.cpp` (DATA + behavior virtuals only — `react/receive_item/copy/used`,
position/size/priority/relationships; rendering → Pixi), `cubby/number/text/
bird/robot/tools/dragdrop`, `room.cpp/floor.cpp`.

## The shim (replaces the 33 includes)
- **`Screen`** — camera/projection. **Done:** `src/city/camera.ts` is a literal
  port of `screen.cpp` `update_viewing_region`/`screen_x`/`screen_y`/`set_scale`
  (lines 182–189, 1831–1889). NB: `screen.cpp screen_y` is **DIB bottom-up**
  (Windows DIBs store row 0 at the bottom — "min_y → FG max_y", screen.cpp:1864),
  so city +y = NORTH shows at the *top*. We render in Pixi's top-down space, so we
  **flip y** (`sy = h/2 − (y−cy)·pxPerUnit`) — that flip *is* the DIB convention.
- **`Sprite`** — base for every element (city coords `llx/lly`, `width/height`,
  `kind_of`, priority, the `react/receive_item/copy/used` virtuals), backed by a
  Pixi container for `display`. *TODO (next).*
- **globals** — `tt_screen / tt_city / tt_programmer` singletons. *TODO.*
- **input** — DOM → `(key, delta_x, delta_y, button_status)` exactly as the
  `react()` functions expect. (Partly in `city-scene.ts`.)

## Order (by testability) & status
1. **Flying — ✅ done (faithfully sourced).** constants (`src/port/constants.ts`
   ← constant.h/globals.cpp/block.cpp) · Screen (`camera.ts` ← screen.cpp) ·
   geometry (`city-model.ts` ← block.cpp:205 `city_location`, city.cpp:172
   `build_initial_houses`, free-play **10×10** blocks) · `fly()` ← `Programmer_
   City_Flying::react` (prgrmmr.cpp:3988), anchored with line refs.
2. **Landing — ✅ done.** `Programmer_City_Landing::react` (prgrmmr.cpp:4296):
   `land()` descends at `button_speed = 5·tile` (4237) over `min_y..max_y`
   (−13..+10 tile, ctor) starting at +6 tile; `y>max_y → FLYING_AGAIN` (4339),
   `y<min_y → LEAVE_HELICOPTER` (4345); horizontal pans the city, copter centred
   (4350-4368 ↔ streetCamCx). `landY` kept normalised for the Pixi side view.
3. **Walking — ✅ done.** `Programmer_City_Walking::react` (prgrmmr.cpp:5000):
   real-coord move clamped to city bounds (5028-5056), heading eased via
   dampen_turn after a tile (5031-5036), camera-follow band (5057-5076 ↔
   renderStreet), house collisions (`blockedByHouse` ↔ handle_collisions 5082),
   'h' → copter / click → sit.
4. **Rooms — ✅ done.** `Programmer_Room_Walking::react` (prgrmmr.cpp:5260): only
   the left wall (door) leaves (5296), other walls clamp (5300-5324), click sits
   (5337-5365), heading eased via dampen_turn (5286-5292). `AT_FLOOR` /
   `set_sit_corner` → the floor camera (`view/floor-camera.ts`); the perspective
   room + floor miniatures render in Pixi (room.cpp display is platform).
5. **Elements — ✅ audited (2026-06-15).** Each element file was checked against
   its manual page + the C++ and brought faithful, with line-ref anchors and
   tests; per-element detail + remaining ▢ gaps live in `docs/elements.md`:
   - `number.cpp` — common ops (`+ * / % ^ =`) map 1:1 (d43c454); advanced
     menu-set ops ▢.
   - `cubby.cpp` — box drop geometry ported from `closest_hole`/`item_released_
     on_top` so a box dropped clear of an end **joins** (was nesting); no `split`
     exists in the original.
   - `text.cpp` — a number on a non-blank pad **advances the edge char**
     (`next_in_alphabet`, the 89-char ring); was a no-op.
   - `bird.cpp` — FIFO confirmed faithful; birds now accept only pads/pictures/
     sound/boxes (`acceptable`).
   - `robot.cpp` — train/match/teams/copy/module-recursion faithful; non-
     recursive matching ⚠ and async **wait-on-nest** (`suspend`) ▢.
   - `tools.cpp` — Dusty now defaults to **suck** (`VACUUM_SUCK`); wand (`COPIER_
     NORMAL`) + Pumpy faithful.

A formal **`Sprite` base shim** (city coords / size / priority / `react·receive_
item·copy·used`, Pixi-backed display) was *not* needed: our pure `model/` already
captures each element's logic, so the audits ported behavior directly onto it.
Building the explicit Sprite base remains optional ▢ (only if a future element
needs the full city-coordinate/priority machinery). The navigation slices (1-4)
needed only the Programmer state machine, which is faithfully ported.

Keep the app working after each slice; per-element fidelity detail stays in
`docs/elements.md`.
