import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { NumberThing } from '../src/model/number';
import { TextThing } from '../src/model/text';
import { Box } from '../src/model/box';
import { Robot, runRobot, trainByExample, matchingRunner } from '../src/model/robot';
import { resolveDrop } from '../src/model/interactions';

function twoNumberBox(a: number, b: number): Box {
  return new Box({ holes: [new NumberThing({ value: a }), new NumberThing({ value: b })] });
}

describe('training gesture (robot.htm "drop a box on him")', () => {
  it('starts training when a box meets an untrained robot — either direction', () => {
    const w = new World();
    const r1 = w.add(new Robot({})); // fresh, untrained
    const r2 = w.add(new Robot({}));
    // Manual's canonical: drop a box ON the robot.
    expect(resolveDrop(w, twoNumberBox(3, 4), r1)).toBe('train');
    // The reverse (robot onto a box) also begins training, for convenience.
    expect(resolveDrop(w, r2, twoNumberBox(3, 4))).toBe('train');
  });

  it('a trained robot RUNS on a matching box and refuses (fussy) otherwise', () => {
    const w = new World();
    const adder = w.add(
      new Robot({ condition: ['number', 'number'], actions: [{ type: 'combine', from: 1, to: 0 }] }),
    );
    expect(resolveDrop(w, twoNumberBox(20, 22), adder)).toBe('ran'); // box on robot → runs
    const wrong = new Box({ holes: [new TextThing({ value: 'a' }), new TextThing({ value: 'b' })] });
    expect(resolveDrop(w, wrong, adder)).toBe('none'); // shape mismatch → fussy refusal
  });
});

describe('Robot.matches', () => {
  it('matches a box of the same shape', () => {
    const r = new Robot({ condition: ['number', 'number'], actions: [] });
    expect(r.matches(twoNumberBox(1, 2))).toBe(true);
  });

  it('rejects a different arity or different kinds', () => {
    const r = new Robot({ condition: ['number', 'number'], actions: [] });
    expect(r.matches(new Box({ size: 3 }))).toBe(false);
    expect(
      r.matches(new Box({ holes: [new NumberThing({ value: 1 }), new TextThing({ value: 'x' })] })),
    ).toBe(false);
  });

  it('honors empty-hole conditions', () => {
    const r = new Robot({ condition: ['number', null], actions: [] });
    expect(r.matches(new Box({ holes: [new NumberThing({ value: 1 }), null] }))).toBe(true);
    expect(r.matches(twoNumberBox(1, 2))).toBe(false);
  });
});

describe('runRobot', () => {
  it('adds two numbers (the canonical adder) and empties the source hole', () => {
    const w = new World();
    const adder = new Robot({ condition: ['number', 'number'], actions: [{ type: 'combine', from: 1, to: 0 }] });
    const box = twoNumberBox(4, 5);
    expect(runRobot(w, adder, box)).toBe(true);
    expect((box.contentsAt(0) as NumberThing).value.toString()).toBe('9');
    expect(box.isHoleEmpty(1)).toBe(true);
  });

  it('generalizes to any matching box', () => {
    const w = new World();
    const adder = new Robot({ condition: ['number', 'number'], actions: [{ type: 'combine', from: 1, to: 0 }] });
    const box = twoNumberBox(100, 23);
    runRobot(w, adder, box);
    expect((box.contentsAt(0) as NumberThing).value.toString()).toBe('123');
  });

  it('applies an operation override (multiplier robot)', () => {
    const w = new World();
    const mult = new Robot({ condition: ['number', 'number'], actions: [{ type: 'combine', from: 1, to: 0, op: '*' }] });
    const box = twoNumberBox(6, 7);
    runRobot(w, mult, box);
    expect((box.contentsAt(0) as NumberThing).value.toString()).toBe('42');
  });

  it('joins text', () => {
    const w = new World();
    const joiner = new Robot({ condition: ['text', 'text'], actions: [{ type: 'combine', from: 1, to: 0 }] });
    const box = new Box({ holes: [new TextThing({ value: 'foo' }), new TextThing({ value: 'bar' })] });
    runRobot(w, joiner, box);
    expect((box.contentsAt(0) as TextThing).value).toBe('foobar');
  });

  it('does not run on a non-matching box', () => {
    const w = new World();
    const adder = new Robot({ condition: ['number', 'number'], actions: [{ type: 'combine', from: 1, to: 0 }] });
    const box = new Box({ size: 2 }); // empty
    expect(runRobot(w, adder, box)).toBe(false);
  });
});

describe('matchingRunner (for animated replay)', () => {
  it('returns the trained robot that would run, or null', () => {
    const adder = new Robot({ condition: ['number', 'number'], actions: [{ type: 'combine', from: 1, to: 0 }] });
    expect(matchingRunner(adder, twoNumberBox(3, 4))).toBe(adder);
    expect(matchingRunner(adder, new Box({ size: 2 }))).toBe(null); // empty holes → no match
    expect(matchingRunner(new Robot({}), twoNumberBox(3, 4))).toBe(null); // untrained
  });
});

describe('trainByExample', () => {
  it('derives the condition from the sample box shape', () => {
    const sample = twoNumberBox(1, 1);
    const robot = trainByExample(sample, [{ type: 'combine', from: 1, to: 0 }]);
    expect(robot.condition).toEqual(['number', 'number']);
    expect(robot.matches(twoNumberBox(8, 9))).toBe(true);
  });
});
