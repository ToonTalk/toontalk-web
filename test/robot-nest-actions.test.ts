import { describe, it, expect } from 'vitest';
import { applyAction, Robot, runRobot } from '../src/model/robot';
import { Box } from '../src/model/box';
import { NumberThing } from '../src/model/number';
import { Nest } from '../src/model/nest';
import { World } from '../src/model/world';

// robot.cpp: a robot's ACTIONS see THROUGH a nest to the delivery on top (like
// matching). The nest stays in place so the next bird can deliver.
describe('nest-transparent actions', () => {
  it('combine reads the FROM hole through a nest and consumes only the delivery', () => {
    const box = new Box({ holes: [new Nest({ contents: [new NumberThing({ value: 7 })] }), new NumberThing({ value: 5 })] });
    expect(applyAction(box, { type: 'combine', from: 0, to: 1 })).toBe(true);
    expect((box.contentsAt(1) as NumberThing).value.toString()).toBe('12'); // 5 + 7
    const nest = box.contentsAt(0) as Nest;
    expect(nest).toBeInstanceOf(Nest); // the nest stays
    expect(nest.front()).toBeNull(); // its delivery was consumed
  });

  it('combine reads the TO hole (accumulator) through a nest', () => {
    const box = new Box({ holes: [new NumberThing({ value: 4 }), new Nest({ contents: [new NumberThing({ value: 10 })] })] });
    expect(applyAction(box, { type: 'combine', from: 0, to: 1 })).toBe(true);
    expect(((box.contentsAt(1) as Nest).front() as NumberThing).value.toString()).toBe('14'); // 10 + 4, in the nest
  });

  it('a robot accumulates successive nest deliveries (bird-driven loop)', () => {
    const w = new World();
    const nest = new Nest();
    const box = w.add(new Box({ holes: [nest, new NumberThing({ value: 0 })] }));
    // condition [number, number] (the nest's top is a number); add the delivery to hole 1.
    const robot = new Robot({ condition: ['number', 'number'], actions: [{ type: 'combine', from: 0, to: 1 }] });
    nest.receive(new NumberThing({ value: 3 }));
    expect(runRobot(w, robot, box)).toBe(true);
    expect((box.contentsAt(1) as NumberThing).value.toString()).toBe('3');
    nest.receive(new NumberThing({ value: 4 }));
    expect(runRobot(w, robot, box)).toBe(true);
    expect((box.contentsAt(1) as NumberThing).value.toString()).toBe('7'); // 3 + 4
    expect(runRobot(w, robot, box)).toBe(false); // nest empty → nothing on top → won't run
  });
});
