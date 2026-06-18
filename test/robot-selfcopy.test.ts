import { describe, it, expect } from 'vitest';
import { applyAction, Robot, runRobot } from '../src/model/robot';
import { Box } from '../src/model/box';
import { NumberThing } from '../src/model/number';
import { World } from '../src/model/world';

// robot.htm: the magic wand's self-copy makes "a copy of himself and his
// teammates" — the self-recursion primitive. As a recorded `selfCopy` step, a
// running robot drops a fresh copy of itself (and its team) into an empty hole.
describe('wand self-copy (selfCopy action)', () => {
  it('drops a COPY of the running robot into an empty hole', () => {
    const w = new World();
    const robot = new Robot({ condition: ['number', null], actions: [{ type: 'selfCopy', to: 1 }] });
    const box = new Box({ holes: [new NumberThing({ value: 5 }), null] });
    w.add(box);
    expect(runRobot(w, robot, box)).toBe(true);
    const dropped = box.contentsAt(1);
    expect(dropped).toBeInstanceOf(Robot);
    expect(dropped).not.toBe(robot); // a copy, not the same instance
    expect((dropped as Robot).actions[0]?.type).toBe('selfCopy'); // same program
  });

  it('the copy includes the team', () => {
    const w = new World();
    const mate = new Robot({ condition: ['number'], actions: [{ type: 'remove', hole: 0 }] });
    const robot = new Robot({ condition: ['number', null], actions: [{ type: 'selfCopy', to: 1 }], team: [mate] });
    const box = new Box({ holes: [new NumberThing({ value: 5 }), null] });
    w.add(box);
    runRobot(w, robot, box);
    expect((box.contentsAt(1) as Robot).team.length).toBe(1);
  });

  it('needs a runner context and an empty target hole', () => {
    const box = new Box({ holes: [new NumberThing({ value: 1 })] });
    expect(applyAction(box, { type: 'selfCopy', to: 0 })).toBe(false); // no ctx.robot
    expect(applyAction(box, { type: 'selfCopy', to: 0 }, { robot: new Robot({}) })).toBe(false); // hole filled
  });
});
