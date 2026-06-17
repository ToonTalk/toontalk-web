/**
 * Train-by-example session.
 *
 * Starting a session captures the box's current shape as the robot's condition.
 * Each demonstrated combine is applied to the box (so the learner sees it
 * happen) and recorded. Finishing writes the captured condition + recorded
 * actions onto the robot, which can then run on any matching box.
 */
import type { World } from './world';
import type { Box } from './box';
import type { Thing } from './thing';
import { Robot, applyAction, type ConditionHole, type RobotAction } from './robot';
import { TextThing } from './text';
import { recomputeScales } from './scale';

/** A blank (empty) text pad is a wildcard in a condition, like an erased pad —
 * it matches any text rather than guarding an exact value (text.htm). */
function isWildcardPad(t: Thing): boolean {
  return t.erased || (t instanceof TextThing && t.value === '');
}

interface Session {
  robot: Robot;
  box: Box;
  condition: ConditionHole[];
  exactValues: (Thing | null)[];
  actions: RobotAction[];
}

export class Trainer {
  private session: Session | null = null;

  constructor(private readonly world: World) {}

  get active(): boolean {
    return this.session !== null;
  }

  get box(): Box | null {
    return this.session?.box ?? null;
  }

  /** The robot being trained (so the UI can exclude it as an insert source). */
  get robot(): Robot | null {
    return this.session?.robot ?? null;
  }

  get stepCount(): number {
    return this.session?.actions.length ?? 0;
  }

  /**
   * Begin training: capture the box's shape as the (future) robot condition.
   * Non-erased holes also capture an exact-value guard; erased holes (Dusty) and
   * blank text pads stay wildcards. So erase (or blank) the things you want
   * generalized before starting.
   */
  start(robot: Robot, box: Box): void {
    recomputeScales(box); // capture each scale's current tilt as the guard
    this.session = {
      robot,
      box,
      condition: box.holes.map((h) => (h ? h.kind : null)),
      exactValues: box.holes.map((h) => (h && !isWildcardPad(h) ? h.copy() : null)),
      actions: [],
    };
  }

  /**
   * Demonstrate dragging a hole's thing onto another hole; applies it live and
   * records it. Dropping onto an *empty* hole is a **move**; onto a *filled*
   * hole it **combines** (numbers add, text joins, …). Returns success.
   */
  recordCombine(from: number, to: number): boolean {
    if (!this.session) return false;
    const box = this.session.box;
    const action: RobotAction = box.isHoleEmpty(to)
      ? { type: 'move', from, to }
      : { type: 'combine', from, to };
    if (!applyAction(box, action)) return false;
    this.session.actions.push(action);
    this.world.notifyChanged(box);
    return true;
  }

  /**
   * Demonstrate **taking a thing out of** the box (robot.htm): empties hole
   * `hole`. The robot remembers the hole by position; on a run it empties that
   * hole. Returns success (false if the hole was already empty).
   */
  recordRemove(hole: number): boolean {
    if (!this.session) return false;
    const action: RobotAction = { type: 'remove', hole };
    if (!applyAction(this.session.box, action)) return false;
    this.session.actions.push(action);
    this.world.notifyChanged(this.session.box);
    return true;
  }

  /**
   * Demonstrate **putting a thing into** the box (robot.htm): the robot carries
   * a copy of `source` and drops it into hole `to` — filling an empty hole or
   * combining into a filled one. On every run it puts a *fresh copy* in, so one
   * demo (e.g. "put a 0 in hole 2") generalises. Returns success.
   */
  recordInsert(to: number, source: Thing): boolean {
    if (!this.session) return false;
    const action: RobotAction = { type: 'insert', to, thing: source.copy() };
    if (!applyAction(this.session.box, action)) return false;
    this.session.actions.push(action);
    this.world.notifyChanged(this.session.box);
    return true;
  }

  /**
   * Demonstrate **copying with the magic wand** (robot.htm "use the magic wand
   * to create a copy"): duplicate hole `from`'s current content into hole `to`
   * (fills it, or combines if full; `to === from` doubles it). Returns success.
   */
  recordCopy(from: number, to: number): boolean {
    if (!this.session) return false;
    const action: RobotAction = { type: 'copy', from, to };
    if (!applyAction(this.session.box, action)) return false;
    this.session.actions.push(action);
    this.world.notifyChanged(this.session.box);
    return true;
  }

  /**
   * Generalize a hole with Dusty *inside the thought bubble* (robot.htm "suck
   * things out of the box… to make the robot work when you want"): erase the
   * imagined hole's value and drop its exact-value guard, so the robot matches
   * any value of that kind there. Returns success.
   */
  eraseHole(i: number): boolean {
    if (!this.session) return false;
    const content = this.session.box.contentsAt(i);
    if (!content) return false;
    content.erased = true; // show the blank/"any" form in the bubble
    this.session.exactValues[i] = null; // drop the value guard → wildcard
    this.world.notifyChanged(this.session.box);
    return true;
  }

  /** Finish: write the condition + actions onto the robot. Returns it. */
  finish(): Robot | null {
    if (!this.session) return null;
    const { robot, condition, exactValues, actions } = this.session;
    robot.condition = condition;
    robot.exactValues = exactValues;
    robot.actions = actions;
    this.world.notifyChanged(robot);
    this.session = null;
    return robot;
  }

  cancel(): void {
    this.session = null;
  }
}
