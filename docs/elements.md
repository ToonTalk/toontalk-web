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
there (-1→0, N→N-1). The join (like number/text combining) **waits for Bammer**:
the boxes don't merge until the hammer strikes — `main.ts` shows Bammer first and
applies `resolveDrop` in its `onSlam` (guard `join-on-strike.mjs`). ✅ **blank box** (`cubby.cpp` `set_to_future_value`,
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
✅ **contents reshape to fill their hole** — a pad in a hole is stretched to the
hole opening, **width and height independently** (`renderThingDisplay` `stretch`,
cubby.cpp `set_size_and_location`); taken out, it returns to natural size (the
extracted thing gets its own un-stretched view). Toolbox compartments stretch the
same way.

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
    from Tooly (held), then a click on/near a hole records the `insert`
    (`applyHeldTool` → `BoxView.dropHole` is forgiving by ~32px so a small miss
    still lands; a clear miss is logged with its screen position). **The imagined
    box is hit-testable from the moment it appears**: `createThingView` re-runs
    `build()` after construction, because ES2022 class-field initializers run
    *after* `super()` and otherwise clobber the geometry (`holeCenters`/`spanLeft`/
    `spanW`) that `build()` — called from the base `ThingView` ctor — just stored.
    Floor boxes hid this (they self-heal on their first `changed` refresh); the
    bubble copy never gets one, so put-in/combine silently missed before the fix
    (guard: `tools/verify/bubble-train.mjs`). **Bammer the mouse** runs in
    on every combine (`bamMouseAt`), in the bubble as on the floor. ✅ **wand-copy
    as a recorded step**: hold the wand and drag a hole onto another → a `copy`
    action duplicates that hole's current content into the target each run (fills
    or combines; `to===from` doubles it) — robot.htm "use the magic wand to create
    a copy". ⚠ still ▢: **Pumpy-resize** as a recorded step.
  - ✅ **imagination** (pad.cpp:5085 "just the robot's imagination so don't make
    these changes stick"): training works on a **copy** of the box inside the
    bubble — the real box is hidden and **untouched after you exit** (verified).
    `Dusty` per mode: **erase (E)** wildcards a hole's value (`Trainer.eraseHole`,
    generalise), **suck (S)** removes it (`Trainer.removeHole`, hole → empty); the
    wand/Dusty/Pumpy chips stay available. Dusty in the bubble uses the **same
    forgiving snap as put-in** (`BoxView.dropHole`, ~30px) so a near-miss still
    hits the hole (it used the strict `holeIndexAt` before — that's why put-in
    worked but Dusty missed), plays the **dusty-suck animation** as feedback (the
    floor got it via `resolveDrop`; the training path didn't), and the held tool
    is drawn **see-through** there so it doesn't hide the small box (guard:
    `bubble-tool-aim.mjs`). A carried element/tool applies on the
    **drop (release)**, so dragging straight out of Tooly onto a hole works (not
    only a separate click). A held tool's **business end is the active point** —
    `DragController.heldVec` places it so `ThingView.activeOffset` (Dusty's nose,
    the wand's star, from `TOOL_TIP_FRAC` × texture size) lands on the cursor/
    reticle, on the floor and in the bubble alike, so aiming the tip is what gets
    clicked (guard: `tools/verify/tool-tip.mjs`). That active point is now **shown
    as a reticle on the floor** too — not just in the bubble — whenever a tool is
    held (`main.ts`, driven by `holdingTool` from `onGrab`), since an *invisible*
    floor active point was why held tools kept clicking empty space (guards:
    `tool-reticle.mjs`, and `floor-dusty.mjs` proves the floor tool path works
    when the point is on target). The **mode keys (E/S/R) stay live during
    training** (`onKeyDown` no longer bails on `trainer.active`), so you can
    switch Dusty to erase, not only suck (guard: `bubble-dusty.mjs`). (All were
    broken before: the tool sat ~`HELD_OFFSET` below an invisible active point so
    `holeIndexAt` missed, and the keys were dead, so Dusty could only ever suck.)
  - ✅ **"enter his thoughts"** (robot.cpp/prgrmmr.cpp: dropping a box on the
    robot runs `Programmer …ABOUT_TO_ENTER_THOUGHT_BUBBLE → enter_thought_bubble`
    with `screen->new_view(CAMERA_MOSTLY_ABOVE)`; the programmer's appearance is
    `ROBOT_IN_TRAINING`). Matched as a **full-screen view**: `BIGBUBBL` cloud over
    the floor (tools stay usable), the (copied) box brought in, and — there is
    **no hand cursor**: you control the **robot**, which follows the pointer (its
    arm is the cursor, scaled down so it doesn't hide the box) and holds the
    picked-up tool (`room.setHandHidden`); a yellow **reticle marks the action
    point at the robot's raised hand** (offset so the robot reaches in with its
    hand, not its eye) so it's clear where a click lands. The **content of the
    hole the active point is over wiggles** (`DragController.trainingHoverTarget`)
    — selection feedback on *what a tool/drop will act on*, not the robot (guard:
    `bubble-wiggle.mjs`). Esc/Backspace exits and restores
    the floor. Flat-box level (no nested sub-world). NB the toolbox is only
    clickable in the room scene — in the boot city scene the room `chrome` is
    `visible:false`, so harness real-click tests must switch scenes first.
  - ✅ **animated replay**: a trained robot meeting a matching box **replays its
    actions one step at a time** (`matchingRunner` + main `animateRun`), not the
    instant outcome. A combine's result lands **on the bam** — `bamMouseAt` takes
    an `onSlam` callback and the merge is applied when the hammer connects (~1.2 s
    in), with the step then waiting it out (~1.4 s), so you see the mouse run in
    and strike *before* the numbers change (was: result applied instantly, mouse
    arrived after). Non-merging steps apply at once (~700 ms). Guard:
    `tools/verify/bubble-replay.mjs`. Houses still run instantly via `runRobot`.
✅ **fussy matching** — `Robot.matches`: same hole count, each hole empty/of the
right kind, plus an optional per-hole exact-value guard. The **thought bubble**
shows each condition hole as the **exact value** it needs (a guard) or, if
generalised, a faded **erased thing of that kind** — a blank number/text pad, an
empty box (a box-in-box wildcard) — *not* the word "any". A robot can also carry a
**name**, shown on a pill below it (type while holding/pointing at it to set one),
so what it does is clear — the example library robots are named Add, Multiply,
Double, By size, … (`Robot.name`, `robot-view.ts`). ✅ **generalize with
Dusty** — erasing a hole **inside the bubble, while training** clears that hole's
value guard, so the trained robot then matches a box holding *any* number of that
kind (the manual's "suck things out of the thought bubble"). This is a
training-time edit to the robot's CONDITION. **To generalise an already-finished
robot, Dusty-erase the ROBOT itself** (on the floor) — `interactions.ts` clears
its `exactValues` (value guards), so it then matches any value; this is the
on-the-floor "remove the details" path (aim at the ROBOT, a big target — *not* at
the number, which only erases that pad). Proven by `tools/verify/
robot-generalize.mjs` (erase the example 1 in the bubble → adds 1 to a 5 → 6) and
`robot-erase-generalize.mjs` (erase the finished robot → it then matches any
number). Held tools on the floor also snap to the nearest thing within ~48px
(`DragController.nearestThing`, guard `tool-floor-aim.mjs`) so a near-miss still
lands. NB re-opening a finished robot's bubble to edit its *actions* isn't
supported yet (▢). ✅ **iteration / "keep counting"** — a robot is a guarded rule that
keeps firing while its condition holds. Drop a box on a trained robot and it
**iterates** (`animateRun` loops, re-running the matching team member each pass,
Bammer and all); a generalised "add 1" robot counts forever. It **stops on
mismatch** — e.g. a **scale** guard that tips the other way past a limit
(`robot-scale-stop.mjs`: [counter, scale, limit] climbs to the limit then
halts). You can always **stop it by hand**: grabbing the robot (or its box) mid-
run cancels the loop, freezing the box exactly (`runningLoop`/`cancelRunningLoop`
in main.ts; guard `robot-iterate.mjs`). A **house** is the same loop as a
persistent background process (`runHouse` + the 800 ms tick) — build one by
dropping a robot + box into a **truck** (`robot-counter.mjs`); bomb it to stop.
A run **re-enacts the training**: for an `insert` step the robot **walks to
Tooly** (top-right), picks up a **fresh copy**, carries it to the target hole and
drops it (combine → Bammer), then **walks home** (`walk` tween + `flyThing` +
`toolboxSource` in main.ts) — robot.htm's "new" element comes from the toolbox
each run. Guards: `robot-walk.mjs` (robot swings right to Tooly, left to the box,
back home; combines 5→6) and `robot-fetch.mjs` (the fresh element is in flight).
EVERY action step is re-enacted by the robot **physically WALKING to the source
hole and carrying the thing across** (`carryGesture` in main.ts), the effect
landing on arrival / the Bammer strike (never instantly): for **combine/move** the
robot walks over hole `from`, **picks the thing up with its hand** (the source
empties), carries it to hole `to` and drops it; for **copy** it re-enacts the full
**wand gesture** (robot.cpp: the robot holds the copier and moves it over the
subject) — it **walks to the wand wherever it actually sits on the floor** (the
nearest `Wand`, or Tooly if there is none — *not* always Tooly), picks it up,
carries it over hole `from`, the wand **makes a copy** (the original stays), carries
the copy to hole `to` and drops it, then puts the wand back and walks home before
the next pass (guard `robot-wand-source.mjs`); **remove** tosses the thing out of the
box (it shrinks away as the hole empties); **swap** flies a ghost of each thing to
the other's hole (crossing over); **self-copy** flies a copy of the robot itself
into the empty hole. **Bammer** hammers when something lands on a FILLED hole.
(`fromModule` is house-only — no module on the floor — so it applies at once.)
Guards: `team-run.mjs`, `robot-carry-anim.mjs` (copy 5→10 · move 0→1 · remove→∅ ·
swap 3↔8 · self-copy→robot, each landing on arrival). A house runs instantly.
✅ **three-way match / wait** (`Robot.matchState` → match | mismatch | wait;
team-level `teamMatch`): an INCOMPLETE box (a hole the rule needs is empty, or
holds an *empty nest*) makes the robot **wait, not stop** — the loop suspends
and resumes the instant the missing thing is added (the loop subscribes for the
next content change; a user fill *and* a bird delivery both `notifyChanged`).
Both matching AND **actions are transparent to a nest** — they act on what's on
TOP (`Nest.front`); an empty nest reads as "nothing yet" (wait). A robot's
combine/move/copy reads a hole through its nest via `holeContent`, **consuming
the delivery and leaving the nest** for the next bird (robot.cpp "if leader is
nest find topmost one"). So a `[nest, accumulator]` robot adds each bird delivery
to the accumulator and waits between them. Guards: `robot-matchstate.test.ts` +
`robot-nest-actions.test.ts` (unit: 0 → +3 → +4 → 7, then waits), `robot-wait.mjs`. ✅ **finish key**: Escape finishes training (Backspace
cancels as a web-only helper). ✅ **teams** (separate lined-up robots, like
`first_in_line`/next): drop robot on robot → the dragged robot becomes a SEPARATE
floor robot lined up **behind** the target (`teamPositions`), each keeping its own
view + thought bubble; the lead holds the order in `Robot.team` and each member a
transient `leader` back-ref. Dragging the lead drags the whole line; **grabbing a
teammate pulls it OFF** (`detachFromTeam`) so it's a solo robot again, and the
lead re-closes its line (`drag-controller.ts` grab branch; guard
`tools/verify/team-floor.mjs`). A box is offered front-to-back via
`runRobot`/`teamMatch`→`lineup()`, first matching robot runs (the manual's "front
robot… if it doesn't match, pass it along"). The run is **visible turn-taking**
(`animateRun`, robot.cpp `move_to_side`): the matching member is the actor that
walks/works, and members AHEAD of it that don't match **step aside** one by one to
let it forward — not just the lead animating (guard `tools/verify/team-run.mjs`).
Members **cooperate over the run cycle** — as the box changes, a different member
matches and runs next; the team **waits** if a member would suspend (tests
`robot-team.test.ts`: conditional pick + a `1→2→empty` cycle). A team moves as ONE unit across the floor↔storage
boundary (`expandTeam`/`gatherTeam` in robot.ts): **filing** a lead (drop on the
notebook, load into a truck, pour into a blank box) **gathers** its separate floor
teammates off the floor — they stay embedded in the lead's snapshot, so the whole
team files as one page; **unfiling** (pull the page out) or a wand **copy-self**
**expands** them back into separate, linked, lined-up floor robots (each with its
own view). Save/load round-trips the team (the lead's snapshot embeds its members).
Guards: `team.test.ts` (wand-S copy · file gathers · unfile expands), integration
`tools/verify/team-copy-file.mjs` (world + views). ✅
**copy** — the wand copies the lead robot (C/O) or, in **S** ("copy self") mode,
the whole team — "a copy of himself and his teammates" — which spreads onto the
floor as separate robots. ✅ **module recursion** — `fromModule`
drops a copy of a house-module page into a hole.
✅ **recursive matching**: a nested-box hole is matched **recursively** (robot.cpp
`same_type_match`) — same shape, each inner hole matched (value / wildcard via an
erased inner pad / deeper nesting), **suspending** on an incomplete inner box
(`guardMatch` in robot.ts; tests `robot-recursive-match.test.ts`). Comparison
guards (`<`/`>`) come via a `Scale` in the box (no general per-hole comparator —
faithful). ✅ **waiting**: a robot on an unfilled hole / empty nest *suspends*
and resumes when filled (see the three-way match above). ✅ **wand-'S' self-copy**:
a recorded `selfCopy` step drops a copy of the **running robot + its team** into
an empty hole each run (the running team lead is the source, `ActionContext.robot`;
`Trainer.recordSelfCopy`; train it with the wand in **S** mode clicked on an
empty hole) — the self-recursion primitive (e.g. for a bird to carry to a nested
call), alongside module-page recursion. Tests: `robot-selfcopy.test.ts`. ▢
negation via a team + marker (declined).

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
off → a copy** — from **EITHER open leaf** (left = current, right = next), the
notebook keeping its own (pad.cpp `Notebook::select`→`which_side`; not just the
current page — `pageIndexAt`/`leafScreenCenters` in `notebook-view.ts`, guard
`tools/verify/notebook-take.mjs`); **only Dusty removes** the current page. A
*tap* on a page takes nothing (a page is grabbed only on a real drag — else a tap
silently duplicated it). **Navigation matches the original** (pad.cpp
`respond_to_keyboard`), while holding/pointing at it: **SPACE** (or `+`, or
right-click) → next page, **rubout/Backspace** (or `-`) → previous, and typing a
**page number** jumps there (digits accumulate: "1" then "4" → page 14); dropping a
number also jumps. No on-screen page buttons. Guard `notebook-flip.mjs`.

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
