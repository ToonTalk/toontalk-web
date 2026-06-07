/**
 * Robots — the heart of ToonTalk.
 *
 * A robot is trained by example: it remembers the *shape* of the box it was
 * shown (its condition) and the *actions* it was demonstrated. Later, given a
 * new box, it runs only if the box matches its condition, then replays the
 * recorded actions on that box's contents — so one demonstration generalizes to
 * any matching input.
 *
 * Phase 3 models condition matching by hole shape (a hole must be empty, or hold
 * a thing of a given kind) and a `combine` action (drop one hole's thing onto
 * another's). Value guards, erasing/wildcards via the vacuum, and richer actions
 * come in later phases. Pure logic — no rendering.
 */
import { Thing, type ThingKind, type ThingSnapshot } from './thing';
import type { Box } from './box';
import type { World } from './world';
import { NumberThing, type NumberOp } from './number';
import { TextThing } from './text';

/** A demonstrated action, expressed in terms of hole positions so it generalizes. */
export type RobotAction =
  | {
      type: 'combine';
      /** Hole whose thing is dropped (and consumed). */
      from: number;
      /** Hole whose thing receives the combination. */
      to: number;
      /** Optional operation override for numbers (else the dropped number's own op). */
      op?: NumberOp;
    }
  | {
      type: 'remove';
      /** Hole to empty. */
      hole: number;
    };

/** A condition hole: null = must be empty; a kind = must hold a thing of that kind. */
export type ConditionHole = ThingKind | null;

export interface RobotSnapshot extends ThingSnapshot {
  condition: ConditionHole[];
  actions: RobotAction[];
  exactValues?: (ThingSnapshot | null)[];
}

export class Robot extends Thing {
  readonly kind = 'robot' as const;
  condition: ConditionHole[];
  actions: RobotAction[];
  /**
   * Optional per-hole exact-value guard, parallel to `condition`. If
   * exactValues[i] is set, the hole must hold a thing that *equals* it (a real
   * conditional); if null/absent, any thing of condition[i]'s kind matches
   * (i.e. the hole was erased by Dusty, or never value-guarded).
   */
  exactValues: (Thing | null)[];

  constructor(opts: {
    id?: string;
    x?: number;
    y?: number;
    condition?: ConditionHole[];
    actions?: RobotAction[];
    exactValues?: (Thing | null)[];
  } = {}) {
    super(opts);
    this.condition = opts.condition ?? [];
    this.actions = opts.actions ?? [];
    this.exactValues = opts.exactValues ?? [];
  }

  protected override kindForId(): ThingKind {
    return 'robot';
  }

  /** True if this robot's condition fits the given box (shape + any value guards). */
  matches(box: Box): boolean {
    if (box.size !== this.condition.length) return false;
    return this.condition.every((c, i) => {
      const occupant = box.contentsAt(i);
      if (c === null) return occupant === null;
      if (occupant === null || occupant.kind !== c) return false;
      const guard = this.exactValues[i];
      return guard == null || occupant.equals(guard);
    });
  }

  copy(): Robot {
    return new Robot({
      x: this.x,
      y: this.y,
      condition: [...this.condition],
      actions: this.actions.map((a) => ({ ...a })),
      exactValues: this.exactValues.map((v) => (v ? v.copy() : null)),
    });
  }

  equals(other: Thing): boolean {
    return other instanceof Robot;
  }

  describe(): string {
    return `robot(${this.actions.length})`;
  }

  override snapshot(): RobotSnapshot {
    return {
      ...super.snapshot(),
      condition: [...this.condition],
      actions: this.actions.map((a) => ({ ...a })),
      exactValues: this.exactValues.map((v) => (v ? v.snapshot() : null)),
    };
  }
}

/** Build a robot from a sample box plus a demonstrated action list. */
export function trainByExample(sample: Box, actions: RobotAction[]): Robot {
  const condition: ConditionHole[] = sample.holes.map((h) => (h ? h.kind : null));
  return new Robot({ condition, actions });
}

/**
 * Apply a single action to a box in place. Returns whether it did anything.
 * Shared by running and training.
 */
export function applyAction(box: Box, action: RobotAction): boolean {
  if (action.type === 'remove') {
    if (box.isHoleEmpty(action.hole)) return false;
    box.take(action.hole);
    return true;
  }

  const from = box.contentsAt(action.from);
  const to = box.contentsAt(action.to);
  if (!from || !to) return false;

  if (to instanceof NumberThing && from instanceof NumberThing) {
    to.value = NumberThing.combine(to.value, from.value, action.op ?? from.operation);
    box.take(action.from);
    return true;
  }
  if (to instanceof TextThing && from instanceof TextThing) {
    to.concat(from, 'right');
    box.take(action.from);
    return true;
  }
  return false;
}

/** Run a robot on a box: if it matches, replay the actions. Returns whether it ran. */
export function runRobot(world: World, robot: Robot, box: Box): boolean {
  if (!robot.matches(box)) return false;
  for (const action of robot.actions) {
    applyAction(box, action);
  }
  world.notifyChanged(box);
  return true;
}
