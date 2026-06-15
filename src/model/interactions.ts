/**
 * Drop resolution — the universal "drop one thing on another" interaction that
 * drives ToonTalk. Given the dragged thing, the thing under the cursor, and a
 * little context (which box hole, which side of a text pad), it decides what
 * happens and mutates the world accordingly.
 *
 * Pure logic: it takes already-resolved discrete context (holeIndex / side)
 * from the caller so this module needs no knowledge of pixels or geometry.
 */
import type { World } from './world';
import type { Thing } from './thing';
import { NumberThing } from './number';
import { TextThing, type Side } from './text';
import { shiftEdgeChar } from './alphabet';
import { Box } from './box';
import { Wand } from './wand';
import { Bird } from './bird';
import { Nest } from './nest';
import { Robot, runRobot } from './robot';
import { Dusty } from './dusty';
import { Bomb } from './bomb';
import { Truck } from './truck';
import { House } from './house';
import { Notebook } from './notebook';
import { Pumpy, resizeThing } from './pumpy';
import { recomputeScales } from './scale';

/** Cap on holes a blank box can be sized to (cubby.cpp tt_max_number_of_holes). */
const MAX_BOX_HOLES = 100;

export interface DropContext {
  /** When dropping onto a box, the hole the cursor is over. */
  holeIndex?: number;
  /** When concatenating text, which side of the target the cursor is over. */
  side?: Side;
}

export type DropResult =
  | 'combined'
  | 'filled'
  | 'copied'
  | 'delivered'
  | 'ran'
  | 'train'
  | 'erased'
  | 'exploded'
  | 'joined'
  | 'teamed'
  | 'loaded'
  | 'built'
  | 'stored'
  | 'flipped'
  | 'sucked'
  | 'spat'
  | 'resized'
  | 'none';

export function resolveDrop(
  world: World,
  dragged: Thing,
  target: Thing | undefined,
  ctx: DropContext = {},
): DropResult {
  if (!target || target.id === dragged.id) return 'none';

  // Magic wand: drop it on a thing to copy that thing. Wand is not consumed.
  if (dragged instanceof Wand) {
    const copy = target.copy();
    // C/O copy just the lead robot; S ("copy self") keeps the whole team.
    if (copy instanceof Robot && dragged.mode !== 'S') copy.team = [];
    // O ("original") preserves the erased/wildcard state; C/S restore (un-erase).
    if (dragged.mode === 'O') copy.erased = target.erased;
    copy.moveTo({ x: target.x + 36, y: target.y + 28 });
    world.add(copy);
    // Copying a nest makes its bird feed the copy too, so both stay in sync.
    if (target instanceof Nest && copy instanceof Nest) {
      for (const t of world.all()) {
        if (t instanceof Bird && t.nests.includes(target)) t.nests.push(copy);
      }
    }
    return 'copied';
  }

  // Dusty the vacuum (not consumed). Behaviour depends on its mode.
  if (dragged instanceof Dusty) {
    const dusty = dragged;

    // A notebook only lets things be removed with Dusty: take the current page
    // (kept in the stomach when sucking, so reverse can spit it back out).
    if (target instanceof Notebook) {
      const page = target.removeCurrent();
      if (!page) return 'none';
      if (dusty.mode === 'suck') dusty.stomach.push(page);
      world.notifyChanged(target);
      return dusty.mode === 'suck' ? 'sucked' : 'erased';
    }

    // SUCK: vacuum the target (or a box hole's contents) into the stomach.
    if (dusty.mode === 'suck') {
      if (target instanceof Box && ctx.holeIndex != null) {
        const v = target.contentsAt(ctx.holeIndex);
        if (!v) return 'none';
        target.take(ctx.holeIndex);
        recomputeScales(target);
        world.notifyChanged(target);
        dusty.stomach.push(v);
      } else {
        dusty.stomach.push(target);
        world.remove(target.id);
      }
      return 'sucked';
    }

    // REVERSE: spit the last sucked thing back out (into an empty hole, or by Dusty).
    if (dusty.mode === 'reverse') {
      const spat = dusty.stomach.pop();
      if (!spat) return 'none';
      if (target instanceof Box && ctx.holeIndex != null && target.isHoleEmpty(ctx.holeIndex)) {
        target.put(ctx.holeIndex, spat);
        recomputeScales(target);
        world.notifyChanged(target);
      } else {
        spat.moveTo({ x: dusty.x + 30, y: dusty.y - 30 });
        world.add(spat);
      }
      return 'spat';
    }

    // ERASE (default): on a trained robot, clear its value guards (generalize);
    // otherwise toggle the touched thing's erased flag (a wildcard).
    if (target instanceof Robot) {
      target.exactValues = target.condition.map(() => null);
      world.notifyChanged(target);
      return 'erased';
    }
    let victim: Thing | null = target;
    if (target instanceof Box && ctx.holeIndex != null) {
      victim = target.contentsAt(ctx.holeIndex);
    }
    if (!victim) return 'none';
    victim.erased = !victim.erased;
    if (target instanceof Box) recomputeScales(target);
    world.notifyChanged(target);
    return 'erased';
  }

  // Pumpy the resize tool: drop it on a thing to change its size by its current
  // mode (bigger/smaller/wider/narrower/taller/shorter/good). Not consumed.
  if (dragged instanceof Pumpy) {
    resizeThing(target, dragged.mode);
    world.notifyChanged(target);
    return 'resized';
  }

  // The bomb: detonate on the target, destroying it. If it lands on a filled
  // box hole, just that hole's contents are blown up and the box survives;
  // otherwise the whole target thing is destroyed. The bomb is consumed.
  if (dragged instanceof Bomb) {
    if (target instanceof Box && ctx.holeIndex != null && !target.isHoleEmpty(ctx.holeIndex)) {
      target.take(ctx.holeIndex);
      recomputeScales(target);
      world.notifyChanged(target);
    } else {
      world.remove(target.id);
    }
    world.remove(dragged.id);
    return 'exploded';
  }

  // Load a truck: drop a robot (team) or a box into it. With both aboard, its
  // crew drives off and builds a house — a running process where the robot
  // works on the box (truck.cpp fill_house / initial_contents).
  if (
    target instanceof Truck &&
    (dragged instanceof Robot || dragged instanceof Box || dragged instanceof Notebook)
  ) {
    if (dragged instanceof Robot) target.robot = dragged;
    else if (dragged instanceof Box) target.box = dragged;
    else target.module = dragged; // a notebook is the house's module
    world.remove(dragged.id);
    if (target.robot && target.box) {
      world.add(
        new House({
          x: target.x,
          y: target.y,
          robot: target.robot,
          box: target.box,
          module: target.module,
        }),
      );
      world.remove(target.id); // the truck drives off
      return 'built';
    }
    world.notifyChanged(target);
    return 'loaded';
  }

  // Drop a robot on a robot → they form a team: the dragged robot (and its own
  // teammates) line up behind the target, which leads. A box given to the team
  // is offered front-to-back; the first matching robot runs.
  if (dragged instanceof Robot && target instanceof Robot) {
    target.team.push(dragged, ...dragged.team);
    dragged.team = [];
    world.remove(dragged.id);
    world.notifyChanged(target);
    return 'teamed';
  }

  // A BLANK box sizes & fills itself from whatever is dropped on it (cubby.cpp
  // set_to_future_value): a number → that many holes, text → a hole per character
  // (explode), a robot team → a hole per robot, a notebook → a hole per page. A
  // box → join (handled below). Must precede the robot-runs-on-box rule.
  if (target instanceof Box && target.blank && !(dragged instanceof Box)) {
    let holes: (Thing | null)[] | null = null;
    if (dragged instanceof NumberThing) {
      const n = Math.max(0, Math.min(MAX_BOX_HOLES, Math.floor(dragged.value.toNumber())));
      holes = new Array<Thing | null>(n).fill(null);
    } else if (dragged instanceof TextThing) {
      holes = [...dragged.value].map((c) => new TextThing({ value: c }));
    } else if (dragged instanceof Robot) {
      holes = dragged.lineup().map((r) => r.copy());
    } else if (dragged instanceof Notebook) {
      holes = dragged.pages.map((p) => p.copy());
    }
    if (holes) {
      target.fill(holes);
      recomputeScales(target);
      world.remove(dragged.id);
      world.notifyChanged(target);
      return 'combined';
    }
  }

  // A robot (team) meets a box (either direction) → run on the box.
  {
    const robot = dragged instanceof Robot ? dragged : target instanceof Robot ? target : null;
    const box = dragged instanceof Box ? dragged : target instanceof Box ? target : null;
    if (robot && box) {
      // A lone untrained robot learns from the box; otherwise the team runs.
      if (robot.actions.length === 0 && robot.team.length === 0) return 'train';
      return runRobot(world, robot, box) ? 'ran' : 'none';
    }
  }

  // Two boxes dropped edge-to-edge (not into a specific hole) join into one,
  // like text pads: the drop side decides which end the holes are added to.
  if (dragged instanceof Box && target instanceof Box && ctx.holeIndex == null) {
    target.join(dragged, ctx.side ?? 'right');
    recomputeScales(target);
    world.remove(dragged.id);
    world.notifyChanged(target);
    return 'joined';
  }

  // Drop on a notebook (notebook.htm): a number flips to that page; a text card
  // flips to the page whose text starts with it ("ma" finds "mat"), filing it if
  // there's no match; anything else is filed as a new page (= saving).
  if (target instanceof Notebook) {
    if (dragged instanceof NumberThing) {
      target.goTo(dragged.value.toNumber());
      world.remove(dragged.id);
      world.notifyChanged(target);
      return 'flipped';
    }
    if (dragged instanceof TextThing && target.findText(dragged.value)) {
      world.remove(dragged.id);
      world.notifyChanged(target);
      return 'flipped';
    }
    target.store(dragged);
    world.remove(dragged.id);
    world.notifyChanged(target);
    return 'stored';
  }

  // Give a thing to a bird → it carries a copy to each of its nests.
  if (target instanceof Bird && target.nests.length > 0) {
    for (const nest of target.nests) nest.receive(dragged.copy());
    world.remove(dragged.id);
    for (const nest of target.nests) world.notifyChanged(nest);
    return 'delivered';
  }

  // Combine two nests: dropping one nest on another merges them into one
  // channel — the target gets the dragged nest's deliveries, and any bird that
  // fed the dragged nest is re-pointed to feed the target. The dragged nest goes.
  if (dragged instanceof Nest && target instanceof Nest) {
    for (const c of dragged.contents) target.receive(c);
    for (const t of world.all()) {
      if (t instanceof Bird) {
        const i = t.nests.indexOf(dragged);
        if (i >= 0) {
          t.nests.splice(i, 1);
          if (!t.nests.includes(target)) t.nests.push(target);
        }
      }
    }
    world.remove(dragged.id);
    world.notifyChanged(target);
    return 'combined';
  }

  // Drop a thing directly onto a nest → it lands there too.
  if (target instanceof Nest) {
    target.receive(dragged);
    world.remove(dragged.id);
    world.notifyChanged(target);
    return 'delivered';
  }

  // Drop into a box hole.
  if (target instanceof Box && ctx.holeIndex != null) {
    const i = ctx.holeIndex;
    if (i < 0 || i >= target.size) return 'none';

    if (target.isHoleEmpty(i)) {
      target.put(i, dragged);
      recomputeScales(target);
      world.remove(dragged.id);
      world.notifyChanged(target);
      return 'filled';
    }

    const occupant = target.contentsAt(i);
    if (occupant && combineInPlace(occupant, dragged, ctx)) {
      recomputeScales(target);
      world.remove(dragged.id);
      world.notifyChanged(target);
      return 'combined';
    }
    return 'none';
  }

  // Number on a blank text pad → the pad shows the number's digits as text.
  if (dragged instanceof NumberThing && target instanceof TextThing && target.value === '') {
    target.value = dragged.value.toString();
    world.remove(dragged.id);
    world.notifyChanged(target);
    return 'combined';
  }

  // Number on a NON-blank text pad → advance the edge character through the
  // alphabet by the integer's value (text.cpp compute_new_text:1043-1075 via
  // next_in_alphabet). The drop side picks the edge: right→last char, left→
  // first. Only a plain integer that fits a machine word qualifies; fractions
  // and out-of-range values are refused (current_long_value fails → ignored).
  if (dragged instanceof NumberThing && target instanceof TextThing) {
    const shift = integerShift(dragged);
    if (shift == null) return 'none';
    target.value = shiftEdgeChar(target.value, ctx.side ?? 'right', shift);
    world.remove(dragged.id);
    world.notifyChanged(target);
    return 'combined';
  }

  // Number on number → arithmetic.
  if (target instanceof NumberThing && dragged instanceof NumberThing) {
    dragged.applyTo(target);
    world.remove(dragged.id);
    world.notifyChanged(target);
    return 'combined';
  }

  // Text on text → concatenation.
  if (target instanceof TextThing && dragged instanceof TextThing) {
    target.concat(dragged, ctx.side ?? 'right');
    world.remove(dragged.id);
    world.notifyChanged(target);
    return 'combined';
  }

  return 'none';
}

/** Combine `dragged` into a thing already sitting in a box hole, in place. */
function combineInPlace(occupant: Thing, dragged: Thing, ctx: DropContext): boolean {
  if (occupant instanceof NumberThing && dragged instanceof NumberThing) {
    dragged.applyTo(occupant);
    return true;
  }
  if (occupant instanceof TextThing && dragged instanceof TextThing) {
    occupant.concat(dragged, ctx.side ?? 'right');
    return true;
  }
  // A number dropped on a blank text pad in a hole → digits become text.
  if (occupant instanceof TextThing && dragged instanceof NumberThing && occupant.value === '') {
    occupant.value = dragged.value.toString();
    return true;
  }
  // A number on a non-blank text pad in a hole → advance the edge char.
  if (occupant instanceof TextThing && dragged instanceof NumberThing) {
    const shift = integerShift(dragged);
    if (shift == null) return false;
    occupant.value = shiftEdgeChar(occupant.value, ctx.side ?? 'right', shift);
    return true;
  }
  return false;
}

/**
 * The shift amount a number contributes when dropped on a text pad, or null if
 * it can't (a fraction, or beyond a safe integer — text.cpp rejects when
 * `current_long_value` fails). next_in_alphabet wraps mod the ring, so the exact
 * magnitude past the ring size doesn't matter, only that it's a whole number.
 */
function integerShift(n: NumberThing): number | null {
  if (!n.value.isInteger()) return null;
  const num = n.value.num;
  if (num > BigInt(Number.MAX_SAFE_INTEGER) || num < BigInt(Number.MIN_SAFE_INTEGER)) return null;
  return Number(num);
}
