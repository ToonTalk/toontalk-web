import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { NumberThing } from '../src/model/number';
import { Box } from '../src/model/box';
import { Dusty } from '../src/model/dusty';
import { Robot } from '../src/model/robot';
import { TextThing } from '../src/model/text';
import { Trainer } from '../src/model/trainer';
import { resolveDrop } from '../src/model/interactions';

function numBox(a: number, b: number): Box {
  return new Box({ holes: [new NumberThing({ value: a }), new NumberThing({ value: b })] });
}

describe('value-guard matching', () => {
  it('exact-value guard only matches equal values', () => {
    const r = new Robot({
      condition: ['number', 'number'],
      exactValues: [new NumberThing({ value: 0 }), null],
    });
    expect(r.matches(numBox(0, 9))).toBe(true);
    expect(r.matches(numBox(1, 9))).toBe(false); // hole 0 must equal 0
  });

  it('wildcard hole (no exact / erased) matches any same-kind thing', () => {
    const r = new Robot({ condition: ['number', 'number'], exactValues: [null, null] });
    expect(r.matches(numBox(5, 5))).toBe(true);
    expect(r.matches(numBox(123, -4))).toBe(true);
  });
});

describe('Dusty erasing', () => {
  it('toggles erased on a loose thing', () => {
    const w = new World();
    const n = w.add(new NumberThing({ value: 7 })) as NumberThing;
    const dusty = w.add(new Dusty()) as Dusty;
    expect(resolveDrop(w, dusty, n)).toBe('erased');
    expect(n.erased).toBe(true);
    resolveDrop(w, dusty, n);
    expect(n.erased).toBe(false);
    expect(w.get(dusty.id)).toBeDefined(); // Dusty is not consumed
  });

  it('erases a thing inside a box hole', () => {
    const w = new World();
    const box = w.add(numBox(4, 5)) as Box;
    const dusty = w.add(new Dusty()) as Dusty;
    resolveDrop(w, dusty, box, { holeIndex: 1 });
    expect(box.contentsAt(1)!.erased).toBe(true);
    expect(box.contentsAt(0)!.erased).toBe(false);
  });
});

describe('training with erasing → generalization', () => {
  it('erased holes become wildcards; non-erased holes become exact guards', () => {
    const w = new World();
    const robot = new Robot();
    const box = numBox(4, 5);
    box.contentsAt(1)!.erased = true; // generalize the second number
    const t = new Trainer(w);
    t.start(robot, box);
    t.recordCombine(1, 0);
    t.finish();

    // Hole 0 was NOT erased → must equal 4; hole 1 was erased → any number.
    expect(robot.matches(numBox(4, 99))).toBe(true);
    expect(robot.matches(numBox(7, 99))).toBe(false);
  });

  it('a BLANK text pad is a wildcard, like an erased one (text.htm)', () => {
    const w = new World();
    const robot = new Robot();
    // A box whose second hole holds a blank (empty) text pad = "any text here".
    const box = new Box({ holes: [new NumberThing({ value: 4 }), new TextThing({ value: '' })] });
    const t = new Trainer(w);
    t.start(robot, box);
    t.finish();
    // Hole 1 matches any text (no exact-'' guard), hole 0 must equal 4.
    expect(robot.matches(new Box({ holes: [new NumberThing({ value: 4 }), new TextThing({ value: 'hi' })] }))).toBe(true);
    expect(robot.matches(new Box({ holes: [new NumberThing({ value: 9 }), new TextThing({ value: 'hi' })] }))).toBe(false);
    // still text-kind: a number in hole 1 does not match
    expect(robot.matches(numBox(4, 5))).toBe(false);
  });
});

describe('Dusty generalizes a trained robot', () => {
  it('clears value guards so it accepts other values', () => {
    const w = new World();
    const robot = w.add(
      new Robot({
        condition: ['number', 'number'],
        exactValues: [new NumberThing({ value: 6 }), new NumberThing({ value: 7 })],
      }),
    ) as Robot;
    const dusty = w.add(new Dusty()) as Dusty;
    expect(robot.matches(numBox(1, 2))).toBe(false);
    expect(resolveDrop(w, dusty, robot)).toBe('erased');
    expect(robot.matches(numBox(1, 2))).toBe(true);
  });
});
