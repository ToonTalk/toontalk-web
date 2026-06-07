import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { NumberThing } from '../src/model/number';
import { Box } from '../src/model/box';
import { Nest } from '../src/model/nest';
import { Robot, runRobot } from '../src/model/robot';

describe('removing things from containers', () => {
  it('Box.take empties a hole and returns the thing', () => {
    const n = new NumberThing({ value: 7 });
    const box = new Box({ holes: [n, null] });
    const taken = box.take(0);
    expect(taken).toBe(n);
    expect(box.isHoleEmpty(0)).toBe(true);
  });

  it('Nest.takeLatest pops the most recent delivery', () => {
    const nest = new Nest();
    const a = new NumberThing({ value: 1 });
    const b = new NumberThing({ value: 2 });
    nest.receive(a);
    nest.receive(b);
    expect(nest.takeLatest()).toBe(b);
    expect(nest.takeLatest()).toBe(a);
    expect(nest.takeLatest()).toBeNull();
  });
});

describe('robot remove action', () => {
  it('empties the specified hole when run', () => {
    const w = new World();
    const robot = new Robot({
      condition: ['number', 'number'],
      actions: [{ type: 'remove', hole: 1 }],
    });
    const box = new Box({ holes: [new NumberThing({ value: 4 }), new NumberThing({ value: 5 })] });
    expect(runRobot(w, robot, box)).toBe(true);
    expect((box.contentsAt(0) as NumberThing).value.toString()).toBe('4');
    expect(box.isHoleEmpty(1)).toBe(true);
  });

  it('combine then remove run in order', () => {
    const w = new World();
    const robot = new Robot({
      condition: ['number', 'number'],
      actions: [
        { type: 'combine', from: 1, to: 0 },
        { type: 'remove', hole: 0 },
      ],
    });
    const box = new Box({ holes: [new NumberThing({ value: 4 }), new NumberThing({ value: 5 })] });
    runRobot(w, robot, box);
    expect(box.isHoleEmpty(0)).toBe(true);
    expect(box.isHoleEmpty(1)).toBe(true);
  });
});
