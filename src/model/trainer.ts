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
