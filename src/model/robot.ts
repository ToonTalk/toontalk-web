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
import { Nest } from './nest';
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
    }
  | {
      type: 'insert';
      /** Hole that receives a fresh copy of the carried thing each run. */
      to: number;
      /** The thing the robot carries and drops in — demonstrated by putting an
       * external thing into the box (robot.htm "put things into a box"). Copied
       * on every run so the box owns its own instance. */
      thing: Thing;
    }
  | {
      type: 'copy';
      /** Hole whose CURRENT content is duplicated (with the magic wand)… */
      from: number;
      /** …a fresh copy dropped into this hole (fills it, or combines if full).
       * `to === from` doubles the value. The wand "creates a copy" (robot.htm). */
      to: number;
    };

/** A condition hole: null = must be empty; a kind = must hold a thing of that kind. */
export type ConditionHole = ThingKind | null;

/** Serializable form of an action: `insert` carries a thing *snapshot*, not a
 * live Thing. All other actions are already plain data. */
export type RobotActionSnapshot =
  | Exclude<RobotAction, { type: 'insert' }>
  | { type: 'insert'; to: number; thing: ThingSnapshot };

export interface RobotSnapshot extends ThingSnapshot {
  condition: ConditionHole[];
  actions: RobotActionSnapshot[];
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

  /**
   * Three-way match (robot.cpp): how the box stands against this condition.
   *  - 'match'    — every hole fits → the robot runs.
   *  - 'wait'     — the box is INCOMPLETE: a hole the condition needs is empty,
   *                 or holds an *empty nest* (awaiting a bird). The robot doesn't
   *                 fail — it suspends and resumes when the missing thing arrives.
   *  - 'mismatch' — a hole holds the wrong thing, or the box is the wrong size →
   *                 the robot can't run (stop / pass to the next teammate).
   * Matching is transparent to a NEST: it tests what sits ON TOP (the nest's
   * front delivery), not the nest itself; an empty nest reads as "nothing yet".
   */
  matchState(box: Box): 'match' | 'mismatch' | 'wait' {
    if (box.size !== this.condition.length) return 'mismatch';
    let waiting = false;
    for (let i = 0; i < this.condition.length; i++) {
      const c = this.condition[i];
      let occ = box.contentsAt(i);
      if (occ instanceof Nest) {
        const top = occ.front();
        if (top === null) {
          if (c !== null) waiting = true; // empty nest where content is needed → wait for a bird
          continue;
        }
        occ = top; // otherwise match against what's on the nest
      }
      if (c === null) {
        if (occ !== null) return 'mismatch'; // this hole must be empty
        continue;
      }
      if (occ === null) {
        waiting = true; // the thing isn't here yet → wait for the user to add it
        continue;
      }
      if (occ.kind !== c) return 'mismatch';
      const guard = this.exactValues[i];
      if (guard != null && !occ.equals(guard)) return 'mismatch';
    }
    return waiting ? 'wait' : 'match';
  }

  /** True if this robot's condition fully fits the box (it can run right now). */
  matches(box: Box): boolean {
    return this.matchState(box) === 'match';
  }

  copy(): Robot {
    return new Robot({
      x: this.x,
      y: this.y,
      condition: [...this.condition],
      actions: this.actions.map((a) => (a.type === 'insert' ? { ...a, thing: a.thing.copy() } : { ...a })),
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
      actions: this.actions.map((a): RobotActionSnapshot =>
        a.type === 'insert' ? { type: 'insert', to: a.to, thing: a.thing.snapshot() } : { ...a },
      ),
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

/** Drop `thing` into hole `to`: fill it if empty, else combine into it (numbers
 * add, text joins). Shared by `insert` (a carried copy) and `copy` (a hole's
 * duplicate). Returns whether it did anything. */
function placeOrCombine(box: Box, to: number, thing: Thing): boolean {
  const dest = box.contentsAt(to);
  if (!dest) {
    box.put(to, thing);
    return true;
  }
  if (dest instanceof NumberThing && thing instanceof NumberThing) {
    dest.value = NumberThing.combine(dest.value, thing.value, thing.operation);
    return true;
  }
  if (dest instanceof TextThing && thing instanceof TextThing) {
    dest.concat(thing, 'right');
    return true;
  }
  return false;
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

  if (action.type === 'insert') {
    // Put-in: the robot carries a copy of the demonstrated thing and drops it in.
    return placeOrCombine(box, action.to, action.thing.copy());
  }

  if (action.type === 'copy') {
    // Wand-copy: duplicate the CURRENT content of `from` into `to`.
    const src = box.contentsAt(action.from);
    if (!src) return false;
    return placeOrCombine(box, action.to, src.copy());
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
 * The robot in the team that would run on this box (the first trained one whose
 * condition matches), or null. Lets the UI replay its actions step-by-step
 * without applying them instantly.
 */
export function matchingRunner(robot: Robot, box: Box): Robot | null {
  recomputeScales(box);
  return robot.lineup().find((r) => r.actions.length > 0 && r.matches(box)) ?? null;
}

/**
 * Offer the box to the team front-to-back: the first member that MATCHES runs;
 * if none matches but some would WAIT (the box is incomplete — a missing thing
 * or an empty nest), the team waits; otherwise the box is a mismatch. Drives the
 * floor run-loop's three outcomes (run / suspend / stop).
 */
export function teamMatch(robot: Robot, box: Box): { runner: Robot | null; state: 'match' | 'wait' | 'mismatch' } {
  recomputeScales(box);
  let waiting = false;
  for (const r of robot.lineup()) {
    if (r.actions.length === 0) continue;
    const s = r.matchState(box);
    if (s === 'match') return { runner: r, state: 'match' };
    if (s === 'wait') waiting = true;
  }
  return { runner: null, state: waiting ? 'wait' : 'mismatch' };
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
