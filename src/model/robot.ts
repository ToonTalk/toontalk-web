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
import type { Notebook } from './notebook';
import { NumberThing, type NumberOp } from './number';
import { TextThing } from './text';
import { recomputeScales } from './scale';

/** Extra context an action may need (the running house's module, for recursion). */
export interface ActionContext {
  module?: Notebook | null;
}

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
    }
  | {
      type: 'move';
      /** Hole whose thing relocates… */
      from: number;
      /** …to this (empty) hole. */
      to: number;
    }
  | {
      type: 'swap';
      /** Exchange the contents of these two holes. */
      a: number;
      b: number;
    }
  | {
      type: 'fromModule';
      /** Copy this 1-based page of the house's module… */
      page: number;
      /** …into this (empty) hole. The module-use / recursion primitive. */
      to: number;
    };

/** A condition hole: null = must be empty; a kind = must hold a thing of that kind. */
export type ConditionHole = ThingKind | null;

export interface RobotSnapshot extends ThingSnapshot {
  condition: ConditionHole[];
  actions: RobotAction[];
  exactValues?: (ThingSnapshot | null)[];
  team?: RobotSnapshot[];
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
  /**
   * Robots behind this one in a team (front-to-back order). A box given to the
   * team is tried by this robot first, then each teammate; the first whose
   * condition matches runs. Teammates are not separate world things.
   */
  team: Robot[];

  constructor(opts: {
    id?: string;
    x?: number;
    y?: number;
    condition?: ConditionHole[];
    actions?: RobotAction[];
    exactValues?: (Thing | null)[];
    team?: Robot[];
  } = {}) {
    super(opts);
    this.condition = opts.condition ?? [];
    this.actions = opts.actions ?? [];
    this.exactValues = opts.exactValues ?? [];
    this.team = opts.team ?? [];
  }

  /** This robot followed by its teammates, in the order a box is offered to them. */
  lineup(): Robot[] {
    return [this, ...this.team];
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
      team: this.team.map((r) => r.copy()),
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
      team: this.team.map((r) => r.snapshot()),
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
export function applyAction(box: Box, action: RobotAction, ctx?: ActionContext): boolean {
  if (action.type === 'remove') {
    if (box.isHoleEmpty(action.hole)) return false;
    box.take(action.hole);
    return true;
  }

  if (action.type === 'fromModule') {
    // Module use / recursion: drop a *copy* of a module page into an empty hole.
    const module = ctx?.module;
    if (!module || !box.isHoleEmpty(action.to)) return false;
    const page = module.pages[action.page - 1];
    if (!page) return false;
    box.put(action.to, page.copy());
    return true;
  }

  if (action.type === 'move') {
    const thing = box.contentsAt(action.from);
    if (!thing || !box.isHoleEmpty(action.to)) return false;
    box.take(action.from);
    box.put(action.to, thing);
    return true;
  }

  if (action.type === 'swap') {
    const thingA = box.take(action.a);
    const thingB = box.take(action.b);
    if (thingA) box.put(action.b, thingA);
    if (thingB) box.put(action.a, thingB);
    return thingA !== null || thingB !== null;
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

/**
 * Run a team on a box: the front robot is offered the box, then each teammate;
 * the first trained robot whose condition matches replays its actions. Returns
 * whether any robot ran (false = nothing matched, the box is left untouched).
 */
export function runRobot(world: World, robot: Robot, box: Box, ctx?: ActionContext): boolean {
  recomputeScales(box); // ensure any scale's tilt reflects the input before matching
  const runner = robot.lineup().find((r) => r.actions.length > 0 && r.matches(box));
  if (!runner) return false;
  for (const action of runner.actions) {
    applyAction(box, action, ctx);
  }
  recomputeScales(box);
  world.notifyChanged(box);
  return true;
}
