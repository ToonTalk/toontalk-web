import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { Trainer } from '../src/model/trainer';
import { Robot } from '../src/model/robot';
import { Box } from '../src/model/box';
import { NumberThing } from '../src/model/number';

// Generalising in the bubble is PARTIAL: erasing/removing one hole drops just
// that hole's condition, keeping the box shape, the hole kinds, and the OTHER
// holes' value guards. It is not "completely unconditional".
describe('Trainer — partial generalisation', () => {
  it('erasing one hole drops only that hole\'s value guard', () => {
    const w = new World();
    const t = new Trainer(w);
    const robot = w.add(new Robot({}));
    const box = w.add(new Box({ holes: [new NumberThing({ value: 3 }), new NumberThing({ value: 7 })] }));
    t.start(robot, box); // condition [number,number], guards [3,7]
    t.eraseHole(0); // generalise hole 0's value
    t.finish();

    expect(robot.condition).toEqual(['number', 'number']); // shape + kinds kept
    expect(robot.exactValues[0]).toBeNull(); // hole 0 now matches any number
    expect((robot.exactValues[1] as NumberThing).value.toString()).toBe('7'); // hole 1 STILL guarded

    expect(robot.matches(new Box({ holes: [new NumberThing({ value: 99 }), new NumberThing({ value: 7 })] }))).toBe(true);
    expect(robot.matches(new Box({ holes: [new NumberThing({ value: 99 }), new NumberThing({ value: 8 })] }))).toBe(false);
    expect(robot.matches(new Box({ holes: [new NumberThing({ value: 99 })] }))).toBe(false); // wrong shape
  });

  it('removing a hole imposes "this hole is empty" as a condition', () => {
    const w = new World();
    const t = new Trainer(w);
    const robot = w.add(new Robot({}));
    const box = w.add(new Box({ holes: [new NumberThing({ value: 3 }), new NumberThing({ value: 7 })] }));
    t.start(robot, box);
    t.removeHole(0); // suck hole 0 out → that hole must be empty
    t.finish();

    expect(robot.condition).toEqual([null, 'number']); // hole 0 must be empty, hole 1 still a number
    expect(robot.matches(new Box({ holes: [null, new NumberThing({ value: 7 })] }))).toBe(true);
    expect(robot.matches(new Box({ holes: [new NumberThing({ value: 1 }), new NumberThing({ value: 7 })] }))).toBe(false);
  });
});
