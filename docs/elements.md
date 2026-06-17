# Element behavior digest (manual + original C++ vs. our implementation)

This is the **fidelity ledger**. Read the relevant entry before changing an
element; update it (honestly) after. Legend: ✅ matches our impl · ⚠
divergence/simplification in our current code · ▢ not yet implemented.
Read 2026-06 from the per-element manual pages (player's guide at
https://toontalk.com/English/doc.htm). Note the first 7 menu items — puzzle
game, demos, free play, options, help, WebLabs, Playground — are app-launcher
options, not element behavior.

## Pad editing (`pad.cpp`)

✅ select a pad (hover it / hold it) and **type to edit** — numbers: digits
append (sign preserved), Backspace drops a digit; text: characters append,
Backspace deletes. Handled in `drag-controller` `onKeyDown` →
`editNumber`/`editText` against the hovered/held thing. (`window.__ttWorld`
exposes the world for debugging, like `__ttApp`.)
✅ **decimal-point typing** for numbers — typing goes through a string edit
buffer (`number.ts` `rationalToEditBuffer`/`applyNumberKeyToBuffer`/
`editBufferToRational`), so `1` `.` `2` `5` → exactly `5/4` and Backspace is
exact; the buffer resets when you move off the pad or after a drop.
▢ no insertion-point/cursor editing yet; ▢ fraction typing (`/` is the
divide-op key, so fractions come from the ÷ operation, exactly).

## Numbers (`newnum.htm`)

✅ **op set by a keypress while holding the pad**, default `+` — `+` add,
`x`/`*` multiply, `/` divide, `%` remainder, `^` power, `=` replace; `-`
**negates** the pad (the manual has no binary minus — subtraction is
negate-then-add). ✅ dropping a number on a **blank** text pad converts it to
its digits as text. ✅ exact BigInt rationals (division → exact fractions;
integer powers exact, non-integer powers approximated). Keyboard handling
lives in `input/drag-controller.ts`.

**Audit vs number.cpp (`NumberOperation`, defs.h:450; `result_of_operation_once`,
number.cpp:2910):** a number's operation transforms the target on drop
(`B op A`, `do_operation`); a plain number defaults to add (INCREASE_BY,
number.cpp:2921); exactness propagates (`and_exact`). Our `+ * / % ^ =` map
1:1 to INCREASE_BY/MULTIPLY_BY/DIVIDE_BY/MODULUS_BY/TO_THE_POWER/MAKE_EQUAL —
**faithful for the common ops**. ▢ the original's advanced ops
(INTEGER_PART/FRACTION_PART/NUMERATOR/DENOMINATOR, SINE…ARCTAN, NATURAL_LOG/
LOG10, BITWISE_*) are set via a menu we don't have; ▢ operation *chaining*
(`following_operation`, number.cpp:2884). All niche for a children's tool.

## Text (`text.htm`)

✅ concatenation — drop side decides order (left=prepend, right=append), via
`on_right_side` geometry (text.cpp:991). ✅ dropping a number on a **blank** text
pad converts it to its digits as text (`interactions.ts`, loose pads and in box
holes). ✅ dropping a number on a **non-blank** pad **advances the edge character
through the alphabet** by the integer's value (text.cpp `compute_new_text`:
1043-1075 → `next_in_alphabet`): right-side shifts the last char, left-side the
first, wrapping around the 89-char ring `A-Z a-z <space..@> {|}~` (`model/
alphabet.ts`, a port of utils.cpp `initialize_alphabet`:5294). Only a plain
integer qualifies — a fraction or an out-of-range value is refused, exactly like
the original (`current_long_value` fails → ignored). ✅ **editing** — select a
pad and type (chars append, Backspace deletes; `pad.cpp` via `editText`). ✅ a
**blank (empty) text pad is a wildcard** in a robot condition, like an erased
pad — training captures no exact-value guard for it (`trainer.ts`
`isWildcardPad`), so it matches any text (still text-kind).
▢ blank-pad wildcard across *kinds* (matches only text, not anything).

## Boxes (`box.htm`)

✅ holes fill / combine-in-place. ✅ **join** — faithfully gated by the drop
geometry of `cubby.cpp` `item_released_on_top`:462-491 + `closest_hole`:2605,
ported as `resolveDropSlot`/`BoxView.dropSlot` (drag-controller `contextFor`):
the dragged thing's **centre** is mapped across the box — left of the left edge
→ -1, past the right edge → N, else `floor((x-llx)·N/width)`. Landing over a
hole → that hole (fill / combine / **nest**, including a box dropped squarely on
a hole). Falling off an end: **only a box concatenates** (`add_to_side` requires
`kind_of()==CUBBY` and a non-blank target, side = which end), exactly as the
original — anything else "must have meant" the nearest end hole and is clamped
there (-1→0, N→N-1). ✅ **blank box** (`cubby.cpp` `set_to_future_value`,
`Box.blank` + `Box.fill`): the toolbox hands out a blank box that sizes/fills
itself from what you drop on it — a **number → that many empty holes** (clamped
to `MAX_BOX_HOLES` 100), **text → one single-character pad per letter**
(explode), a **robot team → a hole per robot** (`lineup`), a **notebook → a hole
per page**. A non-blank box just fills the targeted hole.
No box **split** exists in `cubby.cpp` — boxes only concatenate; the inverse is
destruction (bomb/Dusty), not a box operation, so there is no gap here. Robots
ignore hole labels — only hole count + contents matter (we have no labels, fine).
✅ **grab vs. extract** (topmost-sprite rule): pressing **directly on a hole's
item** pulls *that item* out (`BoxView.contentIndexAt` tests the item's rendered
bounds); pressing the **box frame/walls/gaps or an empty hole** grabs the *whole
box*. Earlier we extracted on the *nearest* hole, so a full box could never be
picked up — fixed. The hover wiggle matches (item wiggles when you'd pull it, the
box when you'd grab it).
✅ **contents fill their hole** — a number/text (or other) pad in a hole is sized
to fill the hole opening (`renderThingDisplay` with `scaleUp` + the hole's w×h),
so it sits snugly like the original, not as a small centred icon.

## Birds & nests (`bird.cpp`)

Audited against `bird.htm` + `bird.cpp` (2026-06-15) — see the audit table in
the commit; the one real divergence (birds accepting anything) is now fixed.
✅ a nest is a **FIFO queue** — confirmed faithful: the original inserts at the
end (`insert_at_end_of_contents`:3455 → `contents_stack->insert_at_end`) and
reads/shows `first()` (3276), i.e. oldest first; the manual's "puts the new thing
on the bottom of the stack" describes the same order. We deliver to the back
(`receive`) and read the **front** (`front`/`takeFront`). ✅ a delivered thing
**fully covers** the nest (`renderThingDisplay(..., { scaleUp: true })`). ✅
resting bird is **MORP01** (standing); FLY* frames are flight only. ✅ **a bird
only accepts pads, pictures, sounds and boxes** (`acceptable`:5615 — INTEGER /
TEXT / SOUND / PICTURE / CUBBY; NEST, BIRD and everything else refused): a robot,
bomb, tool, bird or nest given to a bird is now a no-op (`birdAccepts`), where we
previously delivered anything. ✅ **a bird feeds multiple nests** (`Bird.nests`):
**copying a nest** (wand) adds the copy to its bird's nests, so giving to the
bird delivers a copy to **every** nest — keeping copied channels in sync (`all_
nests` broadcast, 5733; the manual's "deliver to both"). ✅ **combine** — drop a
nest on a nest: deliveries merge into the target and any feeding bird is
re-pointed to it (one channel; the original's `merge`/`forwarding_to`, 3341,
simplified). ✅ **hatch** — `hatchFromNest`: pressing an empty nest with no bird
gives a fresh bird that feeds it (an egg hatching, `hatch_bird`:3831), wired into
the drag controller's `tryExtract`. ✅ **hatch animation** — a fresh nest from
the toolbox is an egg that hatches: `hatchNest` (animation.ts, NEST.TTS cycle 2
= HATCH02–14 via `tools/bake-nest.py`) plays the egg cracking open and the bird
**flying up out of the nest**, growing to size (bird.cpp `Nest::hatch_bird` →
`bird_has_hatched`). The press-to-grab hatch stays immediate (no fly-up).
✅ bird **flight animation** + return-to-origin: `flyBird` (animation.ts) flies
the bird to the nest and back on a delivery, **facing its flight direction** (8
directional BIRD.TTS cycles, `tools/bake-bird.py`; bird.cpp `fly_to` →
`direction(dx,dy)`), wired in main's `'delivered'` resolver. ▢ **t-shirt** (drop a
picture / type text while holding) and **nest label** (type while holding) — both
need media/labels we don't have. ▢ **network** birds (DirectPlay). ▢ recursion
guard (`IDS_BIRD_RECUR_ABORT`:5716 — giving a bird a box containing its own
nest). ▢ a nest saved without its bird reloads as a fresh egg → new bird.
Birds/nests are ToonTalk's inter-process channel (a robot waits for a bird to
fill a nest).

## Robots (`robot.htm`)

Audited against `robot.htm` + `robot.cpp`/`prgrmmr.cpp` (re-audited 2026-06-17
against the source + a training screen-capture): the core is faithful at the
modelled (flat-box) level. The manual's loop is
"drop a box on him → you enter his thoughts and control him → he'll remember
everything → press Esc → he's fussy and only works on a box like the one in his
thought bubble; use Dusty to suck things out of that box to generalise."
✅ **train by example** — the manual's gesture is **drop a box on the robot**
(we also accept robot-onto-box for convenience); `interactions` returns `train`
for a box meeting an *untrained* robot (locked by a test). Condition = the box's
shape, **counting holes from the left** (actions index holes). Grabbing an
untrained robot HUD-prompts the whole loop; the in-session HUD names demonstrate
/ generalise (Dusty) / Esc.
  - ✅ **what's demonstrable** (robot.htm "take things out of, or put things into,
    a box"): the trainer records **hole→hole** (`combine` onto a filled hole,
    `move` onto an empty one), **take-out** (drag a hole's thing *out of the box*
    → `remove`), and **put-in** (drag a floor thing *into a hole* → `insert`, the
    robot carrying a copy it drops in each run; fills an empty hole or combines
    into a filled one). The gesture is read by `BoxView.withinBox` +
    `holeIndexAt`; the `insert` template is serialised in the snapshot and rebuilt
    on load (round-trip tested). Put-in inside the thought bubble pulls the thing
    from Tooly (held), then a click on a hole records the `insert`
    (`applyHeldTool` special-cases the training box). **Bammer the mouse** runs in
    on every combine (`bamMouseAt`), in the bubble as on the floor. ⚠ still ▢:
    using a **tool as a *recorded* step** (e.g. wand-copy during the demo).
  - ✅ **imagination** (pad.cpp:5085 "just the robot's imagination so don't make
    these changes stick"): training works on a **copy** of the box inside the
    bubble — the real box is hidden and **untouched after you exit** (verified).
    `Dusty` inside the bubble erases a hole's value → **generalises** it
    (`Trainer.eraseHole` clears the guard); the wand/Dusty/Pumpy chips stay
    available in the thoughts.
  - ✅ **"enter his thoughts"** (robot.cpp/prgrmmr.cpp: dropping a box on the
    robot runs `Programmer …ABOUT_TO_ENTER_THOUGHT_BUBBLE → enter_thought_bubble`
    with `screen->new_view(CAMERA_MOSTLY_ABOVE)`). Matched as a **full-screen
    view**: `Room.enterThoughtBubble()` lays the real `BIGBUBBL` cloud over the
    floor (between floor and chrome, so the tools stay usable), main hides the
    other floor things and brings the (copied) box + robot into the bubble;
    Esc/Backspace exits and restores the floor. Flat-box level (no nested sub-world).
  - ✅ **animated replay**: a trained robot meeting a matching box **replays its
    actions one step at a time** (`matchingRunner` + main `animateRun`, ~700 ms a
    step, Bammer on each combine), not the instant outcome. Houses still run
    instantly via `runRobot`.
✅ **fussy matching** — `Robot.matches`: same hole count, each hole empty/of the
right kind, plus an optional per-hole exact-value guard. ✅ **generalize with
Dusty** — erasing a hole clears its value guard (the manual's "suck things out of
the thought bubble"). ✅ **finish key**: Escape finishes training (Backspace
cancels as a web-only helper). ✅ **teams**: drop robot on robot → the dragged
robot (+ its team) lines up behind the target (`Robot.team`, front-to-back); a
box is offered front-to-back via `runRobot`→`lineup()`, first trained matching
robot runs (the manual's "front robot… if it doesn't match, pass it along"). ✅
**copy** — the wand copies the lead robot (C/O) or the whole team (S), matching
"a copy of himself and his teammates". ✅ **module recursion** — `fromModule`
drops a copy of a house-module page into a hole.
⚠ **matching is non-recursive**: a `box`/`number` hole matches by kind (+ exact
value), but a nested box isn't matched recursively against an inner thought-
bubble shape; comparison guards (`<`/`>`) come only via a `Scale` in the box, not
a general per-hole comparator. ▢ **waiting**: the original *suspends* a robot on
an unfilled nest and resumes it when a bird delivers (`suspend`:1969 /
`no_longer_suspended`:2128 — the manual's "he'll wait around"); we run
synchronously and just decline if nothing matches. ▢ negation via a team +
marker. ▢ wand-'S' *self-copy during a run* (recursion by copying the running
robot+team, vs. our module-page recursion).

## Scale (`scale.htm`)

✅ a `Scale` (model/scale.ts) sits in a box hole and weighs its two
neighbours: tilts `left`/`right` toward the bigger number or
later-alphabetical text, `balanced` when equal, `tottering` when a neighbour
is missing (matches nothing). An **erased** neighbour keeps the previous tilt
(so erasing operands generalises). Tilt is a robot guard (`Scale.equals`
compares tilt) → real `<`, `>`, `=` conditions. `recomputeScales(box)` is
called at every box-mutation point (interactions/extraction/robot
actions/trainer/load/seed) and before robot matching. View tips the sprite by
tilt. ✅ the classic "swap if first<second" demo runs (a scale-guarded robot
with a `swap` action; seeded).

## Dusty / vacuum (`dusty.htm`, `dusty.ts`) ✅

**Held tool** (see *Tools are held* below). Has the **three modes** (set with
the nose button — **E/S/R** keys; **Tab** cycles): **suck** (vacuum a thing or a
box hole's contents into its `stomach` — the **default**), **reverse** (spit the
last sucked thing back out, into an empty hole or beside Dusty), **erase** (toggle
erased / generalize a robot). `DustyView` shows the mode badge + stomach count.
✅ **Audited 2026-06-15** and corrected to start in **suck**, faithful to the
original — `tools.cpp` Vacuum ctor `state = VACUUM_SUCK`:1458, button label `'S'`,
and the cycle order follows `VacuumState` (`{VACUUM_SUCK, VACUUM_SPIT(=reverse),
VACUUM_BLANK(=erase)}`, tools.h:249). This also matches the `'S'` toolbox-chip
badge the room already drew. (Previously we defaulted to erase as a deliberate
deviation; Ken chose to match the manual.)
Manual note: erase is a mode and restore is via Dusty-reverse or the wand's 'O'
mode, not a toggle. **Suck (remove, restorable) is distinct from the Bomb
(destroy, permanent)**.

## Wand (`wand.ts`) ✅

**Held tool** (see *Tools are held* below); copies via the **tip**, not
consumed, with **three modes** (press C/O/S to set, Tab cycles; `WandView`
shows the badge): **C** copy + restore (un-erased — default); **O**
"original" copies preserving the erased/wildcard state (per `picture.cpp`:
original mode doesn't restore); **S** copy-self copies a robot *with its
team* (C/O copy just the lead). Mode persists. ✅ **Audited 2026-06-15**: the
default **C** matches `tools.cpp` Copier ctor `state = COPIER_NORMAL`:3057, button
`'C'`:3063 (`CopierState {COPIER_NORMAL, COPIER_ORIGINAL, …}`).

## Pumpy (`pumpy.ts`) ✅

The resize **held tool** (see *Tools are held* below). `Thing` has
`scaleX`/`scaleY` (applied by ThingView, persisted, omitted from snapshots
when 1); applying Pumpy to the thing under its hose tip resizes it by its
mode (bigger/smaller/wider/narrower/taller/shorter/good; clamp 0.4–3×). Mode
keys: `+`/`b` bigger · `-` smaller · `w` wider · `n` narrower · `t` taller ·
`s` shorter · `g` good (revert); **Tab** cycles. `PumpyView` shows a badge
and draws the baked PUMP00 art (`pumpy.png`, 208×174) at native tool size.
▢ in-hole things ignore Pumpy size (the cubby fit-scale dominates); copies
and box-fit don't carry Pumpy size.
✅ **Audited 2026-06-15**: the resize-mode set matches the original Expander
(`tools.cpp` `ExpanderState` — bigger/smaller/wider/narrower/taller/shorter/
good-size); only the niche in-hole sizing remains ▢.

## Tools are held, not dropped

Pumpy, Dusty and the wand are **not** drag-and-drop. You pick a tool up (it
rides the cursor with its tip/hose at the pointer, offset up-and-right), move
the tip over a thing, then **click or press space** to apply the tool's
*current default* to that thing — the tool **stays in hand**. A click/space
over empty floor **puts the tool down**. Mode keys (above) change the current
default while held. Implemented in `drag-controller.ts`: `heldTool` field,
`onPointerDown` picks a tool into hand (vs. normal drag for everything else),
`applyHeldTool` runs the normal `resolveDrop` rules against the thing under
the tip, `onKeyDown` routes space→apply and letters→`setToolMode`. This
matches the original (`pumpy.htm` etc.): "move the end of the hose over the
thing, then click/space".

## Notebook (`notebook.ts`/`notebook-view.ts`) ✅

A page store + the **real save model**. Drop a thing → filed as a new page;
drop a **number** → flip to that 1-based page; drop a **text** → flip to the
first page whose text *starts with* it ("ma"→"mat"), else file; **drag a page
off → a copy**; **only Dusty removes** the current page. Page-turn arrow cues;
←/→ (and Backspace→last) turn pages while pointing at it.

**Look (matched to the original, `notebook-view.ts`):** an OPEN two-page spread
(spiral down the middle) — the current page on the LEFT leaf, the next page
previewing on the RIGHT, each in a **pink-bordered card** (the original's page
cards), with a page number per leaf and the notebook's **name** on a pill along
the bottom centre (`Notebook.name`; the main notebook is seeded "claude 1",
matching the reference). ▢ pages are still single *things*, not thumbnails of a
saved scene (page-as-snapshot is a larger model change).

**Main notebook = persistence (strictly faithful):** `Notebook.isMain` marks
the one toolbox notebook that survives between sessions (`notebook-store.ts` ↔
`localStorage`, via `thingToJson`/`thingFromJson`); the **floor is
transient**, reseeded each load. Saving = filing onto the main notebook (saved
on its change, identity-checked so sensor ticks don't thrash it). Secondary
notebooks are transient unless filed onto a main page. (`★` marks the main
notebook.)

**Modules:** a notebook dropped on a **truck** → `Truck.module`, carried into
`House.module` (persisted). Robot action `fromModule {page,to}` copies a
module page into an empty hole (threaded via `applyAction(ctx)`/`runHouse`) —
the runtime module-use / **recursion primitive**; demo house counts up by
pulling a copy of its module's page each tick.

▢ not yet: training-by-example of `fromModule`; full self-replicating-house
recursion + result-return via birds/nests; per-user named notebooks; the
picture/sound/options sub-notebooks (media deferred); dropping a notebook on
an erased box → a box with one hole per page; page-turn animation.

## Bomb ✅

A bomb blows up the **house/room you're in** — it terminates a whole running
process (a robot team working in a house); its stated purpose is *recycling*
(deallocating finished houses), and it is consumed when it detonates
(`bomb.cpp Bomb::used`). ✅ **only works on a house**: dropped on a `House` it
removes that running process and the bomb is consumed (`'exploded'` → the
explosion plays); dropped on a loose thing or a box it is **refused** and stays
put — `Bomb::used` aborts with *"bombs only work inside houses"* (bomb.cpp:105),
and main shows that hint. Deleting a loose object is **Dusty's** job, not the
bomb's. (Verified against `bomb.cpp` 2026-06-16; the earlier "destroy any
target" was a divergence, now removed.) ▢ the original also blows up the
**picture** you're on the back of — deferred with media.

## Truck / House ✅

(`truck.cpp` fill_house/initial_contents; `truck.ts`, `house.ts`): drop a
**robot (team) + a box** into a `Truck` (the truck is the target) — with both
aboard it drives off (truck removed) and builds a **House**, a running
process. A periodic step in main.ts (`setInterval` 800ms → `runHouse`) offers
the house's box to its team front-to-back; the first matching robot runs, so
the house keeps reacting (e.g. to a bird feeding a nest in its box). The
house is also shown in place on the floor (drawn house + its box + the lead
robot peeking; `house-view.ts`). A **notebook dropped on the truck** becomes
the house's **module** (see Notebook above). ▢ later: truck extras (house
picture, address); dropping an **address** on a truck → build near there.
NOTE: houses run on a real 800ms interval — verify them with the verify-app
skill (`tools/verify/snap.mjs --settle 3000 …`) or tests, not the preview
screenshot tool.

## Sensors ✅ (live pads)

Sensors are pads that report **live system state** (the original ships a
notebook full of them; `source/.../doc/sensor.htm`, `sensors.rc`). The manual
says a sensor "works much like a control for a picture" and *is* a number or
text/yes-no pad whose value refreshes every frame — so we model it exactly
that way and reuse the whole interaction engine with zero special cases.

- **`src/model/sensor.ts`** — `NumberSensor extends NumberThing` and
  `TextSensor extends TextThing` (same `kind`, so robots match them, numbers
  combine with them, they sit on scales). Each adds `sensorType` +
  `update(input)` / `copy()` / `snapshot()`. `SENSORS` catalog +
  `makeSensor(type)` factory. Implemented (non-media): `mouse-vx`/`mouse-vy`
  (velocity, 1000 = screen/sec), `ms-per-frame` (clock/timer), `random`
  (0–1000), `address-road`/`-street` (from the city block),
  `click-left|middle|right` (momentary), `down-…` (held), `key-just`
  (momentary) / `key-last` (held), `shift-down`, `ctrl-down`, `hand-visible`.
- **`src/input/input-state.ts`** — `InputState` + `InputTracker`:
  mouse/keyboard listeners; `sample(dt)` builds a per-frame snapshot
  (velocity from accumulated pointer movement; momentary click/key **edges**
  true for one sample) then clears the edges. Pluggable `handVisible` +
  `address` providers.
- **`src/model/sensor-runtime.ts`** — `updateSensors(world, input)` each
  frame (on the render ticker in `main.ts`), notifying the view only on
  change.
- **Views**: number/text pads draw a sensor tag (antenna + label;
  `src/view/sensor-tag.ts`). **Persistence**: sensors round-trip via
  `sensorType` on the number/text snapshot. Seeded: a 17-page **sensor
  notebook** + two loose sensors in the demo room.
- ▢ **Media sensors deferred** (with the rest of media): file→picture/sound,
  MCI, text→speech, wall/house/roof decorations, clipboard. ▢ joystick; the
  sensor "remote control" state-cycling UI.
- Sensors update on the render ticker, so the verify-app harness's manual
  ticker pump drives them; `__ttInput.sample()` + manual `sensor.update()`
  also work in `--eval` snippets.
