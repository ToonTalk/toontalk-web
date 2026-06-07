import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { NumberThing } from '../src/model/number';
import { Box } from '../src/model/box';
import { Robot, runRobot } from '../src/model/robot';
import { Trainer } from '../src/model/trainer';

function twoNumberBox(a: number, b: number): Box {
  return new Box({ holes: [new NumberThing({ value: a }), new NumberThing({ value: b })] });
}

describe('Trainer', () => {
  it('captures the box shape as the condition on start', () => {
    const w = new World();
    const robot = new Robot();
    const t = new Trainer(w);
    t.start(robot, twoNumberBox(4, 5));
    expect(t.active).toBe(true);
    expect(t.stepCount).toBe(0);
  });

  it('records a demonstrated combine and applies it live', () => {
    const w = new World();
    const robot = new Robot();
    const box = twoNumberBox(4, 5);
    const t = new Trainer(w);
    t.start(robot, box);
    expect(t.recordCombine(1, 0)).toBe(true);
    expect((box.contentsAt(0) as NumberThing).value.toString()).toBe('9');
    expect(box.isHoleEmpty(1)).toBe(true);
    expect(t.stepCount).toBe(1);
  });

  it('finishes into a robot that generalizes to new boxes', () => {
    const w = new World();
    const robot = new Robot();
    const t = new Trainer(w);
    // Erase both inputs so the robot generalizes (otherwise it captures exact
    // values — the faithful default, covered in erasing.test.ts).
    const sample = twoNumberBox(4, 5);
    sample.contentsAt(0)!.erased = true;
    sample.contentsAt(1)!.erased = true;
    t.start(robot, sample);
    t.recordCombine(1, 0);
    const trained = t.finish();
    expect(trained).toBe(robot);
    expect(t.active).toBe(false);
    expect(robot.condition).toEqual(['number', 'number']);
    expect(robot.actions).toHaveLength(1);

    // The freshly trained (erased) robot runs on a brand-new box.
    const fresh = twoNumberBox(100, 23);
    expect(runRobot(w, robot, fresh)).toBe(true);
    expect((fresh.contentsAt(0) as NumberThing).value.toString()).toBe('123');
  });

  it('cancel discards the session without touching the robot', () => {
    const w = new World();
    const robot = new Robot();
    const t = new Trainer(w);
    t.start(robot, twoNumberBox(1, 2));
    t.recordCombine(1, 0);
    t.cancel();
    expect(t.active).toBe(false);
    expect(robot.actions).toHaveLength(0);
  });

  it('rejects a combine of incompatible/empty holes', () => {
    const w = new World();
    const robot = new Robot();
    const box = new Box({ holes: [new NumberThing({ value: 1 }), null] });
    const t = new Trainer(w);
    t.start(robot, box);
    expect(t.recordCombine(1, 0)).toBe(false);
    expect(t.stepCount).toBe(0);
  });
});
