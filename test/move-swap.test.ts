import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { NumberThing } from '../src/model/number';
import { Box } from '../src/model/box';
import { Scale } from '../src/model/scale';
import { Robot, applyAction, runRobot } from '../src/model/robot';
import { Trainer } from '../src/model/trainer';

describe('move + swap robot actions', () => {
  it('move relocates a thing into an empty hole', () => {
    const box = new Box({ holes: [new NumberThing({ value: 7 }), null] });
    expect(applyAction(box, { type: 'move', from: 0, to: 1 })).toBe(true);
    expect(box.isHoleEmpty(0)).toBe(true);
    expect((box.contentsAt(1) as NumberThing).value.toString()).toBe('7');
  });

  it('move fails if the target hole is occupied', () => {
    const box = new Box({ holes: [new NumberThing({ value: 1 }), new NumberThing({ value: 2 })] });
    expect(applyAction(box, { type: 'move', from: 0, to: 1 })).toBe(false);
  });

  it('swap exchanges two holes', () => {
    const box = new Box({ holes: [new NumberThing({ value: 1 }), new NumberThing({ value: 2 })] });
    expect(applyAction(box, { type: 'swap', a: 0, b: 1 })).toBe(true);
    expect((box.contentsAt(0) as NumberThing).value.toString()).toBe('2');
    expect((box.contentsAt(1) as NumberThing).value.toString()).toBe('1');
  });

  it('training records a move when dragging onto an empty hole', () => {
    const w = new World();
    const robot = new Robot();
    const box = new Box({ holes: [new NumberThing({ value: 9 }), null] });
    const t = new Trainer(w);
    t.start(robot, box);
    t.recordCombine(0, 1); // empty target → move
    t.finish();
    expect(robot.actions).toEqual([{ type: 'move', from: 0, to: 1 }]);
  });

  it('end-to-end: "swap if first < second" via a scale-guarded robot', () => {
    const w = new World();
    const robot = new Robot({
      condition: ['number', 'scale', 'number'],
      exactValues: [null, new Scale({ tilt: 'right' }), null], // first < second
      actions: [{ type: 'swap', a: 0, b: 2 }],
    });
    const make = (a: number, b: number) =>
      new Box({ holes: [new NumberThing({ value: a }), new Scale(), new NumberThing({ value: b })] });

    const ascendingNeeded = make(3, 8); // 3 < 8 → tilts right → should swap
    expect(runRobot(w, robot, ascendingNeeded)).toBe(true);
    expect((ascendingNeeded.contentsAt(0) as NumberThing).value.toString()).toBe('8');
    expect((ascendingNeeded.contentsAt(2) as NumberThing).value.toString()).toBe('3');

    const alreadyOrdered = make(8, 3); // 8 > 3 → tilts left → no match, untouched
    expect(runRobot(w, robot, alreadyOrdered)).toBe(false);
    expect((alreadyOrdered.contentsAt(0) as NumberThing).value.toString()).toBe('8');
  });
});
