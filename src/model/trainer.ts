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
import { recomputeScales } from './scale';

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
   * Non-erased holes also capture an exact-value guard; erased holes (Dusty)
   * stay wildcards. So erase the things you want generalized before starting.
   */
  start(robot: Robot, box: Box): void {
    recomputeScales(box); // capture each scale's current tilt as the guard
    this.session = {
      robot,
      box,
      condition: box.holes.map((h) => (h ? h.kind : null)),
      exactValues: box.holes.map((h) => (h && !h.erased ? h.copy() : null)),
      actions: [],
    };
  }

  /** Demonstrate a combine; applies it live and records it. Returns success. */
  recordCombine(from: number, to: number): boolean {
    if (!this.session) return false;
    const action: RobotAction = { type: 'combine', from, to };
    if (!applyAction(this.session.box, action)) return false;
    this.session.actions.push(action);
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
