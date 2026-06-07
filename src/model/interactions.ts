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
import { Box } from './box';
import { Wand } from './wand';
import { Bird } from './bird';
import { Nest } from './nest';
import { Robot, runRobot } from './robot';
import { Dusty } from './dusty';

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
    copy.moveTo({ x: target.x + 36, y: target.y + 28 });
    world.add(copy);
    return 'copied';
  }

  // Dusty the vacuum: touch a thing to erase it (toggle). Erased things act as
  // wildcards in a robot's condition. Dusty is not consumed.
  if (dragged instanceof Dusty) {
    // On a trained robot, Dusty generalizes it: clear its exact-value guards so
    // it accepts any values of the right shape.
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
    // Refresh the box (so an erased occupant re-renders) or the loose thing.
    world.notifyChanged(target);
    return 'erased';
  }

  // A robot meets a box (either direction) → run the robot on the box.
  {
    const robot = dragged instanceof Robot ? dragged : target instanceof Robot ? target : null;
    const box = dragged instanceof Box ? dragged : target instanceof Box ? target : null;
    if (robot && box) {
      // An untrained robot learns from the box; a trained one runs on it.
      if (robot.actions.length === 0) return 'train';
      return runRobot(world, robot, box) ? 'ran' : 'none';
    }
  }

  // Give a thing to a bird → it delivers to its nest.
  if (target instanceof Bird && target.nest) {
    target.nest.receive(dragged);
    world.remove(dragged.id);
    world.notifyChanged(target.nest);
    return 'delivered';
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
      world.remove(dragged.id);
      world.notifyChanged(target);
      return 'filled';
    }

    const occupant = target.contentsAt(i);
    if (occupant && combineInPlace(occupant, dragged, ctx)) {
      world.remove(dragged.id);
      world.notifyChanged(target);
      return 'combined';
    }
    return 'none';
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
  return false;
}
