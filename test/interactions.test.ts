import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { NumberThing } from '../src/model/number';
import { TextThing } from '../src/model/text';
import { Box } from '../src/model/box';
import { Robot } from '../src/model/robot';
import { Notebook } from '../src/model/notebook';
import { resolveDrop } from '../src/model/interactions';

describe('resolveDrop: numbers', () => {
  it('adds a number dropped on a number and consumes the dragged one', () => {
    const w = new World();
    const target = w.add(new NumberThing({ value: 5 })) as NumberThing;
    const dragged = w.add(new NumberThing({ value: 3 })) as NumberThing;
    const result = resolveDrop(w, dragged, target);
    expect(result).toBe('combined');
    expect(target.value.toString()).toBe('8');
    expect(w.get(dragged.id)).toBeUndefined();
    expect(w.size).toBe(1);
  });

  it('applies the dragged number operation (target op dragged)', () => {
    const w = new World();
    const target = w.add(new NumberThing({ value: 10 })) as NumberThing;
    const dragged = w.add(new NumberThing({ value: 4, operation: '*' })) as NumberThing;
    resolveDrop(w, dragged, target);
    expect(target.value.toString()).toBe('40');
  });

  it('subtracts via negate-then-add (the manual has no binary minus)', () => {
    const w = new World();
    const target = w.add(new NumberThing({ value: 10 })) as NumberThing;
    const dragged = w.add(new NumberThing({ value: 4 })) as NumberThing; // op '+'
    dragged.negate(); // the '-' key flips the sign → -4
    resolveDrop(w, dragged, target);
    expect(target.value.toString()).toBe('6'); // 10 + (-4)
  });

  it('supports remainder, power, divide (exact), and replace ops', () => {
    const run = (a: number, b: number, op: '%' | '^' | '/' | '=') => {
      const w = new World();
      const target = w.add(new NumberThing({ value: a })) as NumberThing;
      const dragged = w.add(new NumberThing({ value: b, operation: op })) as NumberThing;
      resolveDrop(w, dragged, target);
      return (target.value as { toString(): string }).toString();
    };
    expect(run(7, 2, '%')).toBe('1');
    expect(run(7, 2, '^')).toBe('49');
    expect(run(4, 3, '/')).toBe('4/3'); // exact fraction
    expect(run(7, 2, '=')).toBe('2'); // replacement
  });

  it('drops a number on a blank text pad → digits become text', () => {
    const w = new World();
    const pad = w.add(new TextThing({ value: '' })) as TextThing;
    const num = w.add(new NumberThing({ value: 42 })) as NumberThing;
    expect(resolveDrop(w, num, pad)).toBe('combined');
    expect(pad.value).toBe('42');
    expect(w.get(num.id)).toBeUndefined();
  });

  it('leaves a NON-blank text pad alone when a number is dropped', () => {
    const w = new World();
    const pad = w.add(new TextThing({ value: 'x' })) as TextThing;
    const num = w.add(new NumberThing({ value: 42 })) as NumberThing;
    expect(resolveDrop(w, num, pad)).toBe('none');
    expect(pad.value).toBe('x');
  });
});

describe('resolveDrop: text', () => {
  it('concatenates on the right by default', () => {
    const w = new World();
    const target = w.add(new TextThing({ value: 'Hello ' })) as TextThing;
    const dragged = w.add(new TextThing({ value: 'World' })) as TextThing;
    resolveDrop(w, dragged, target, { side: 'right' });
    expect(target.value).toBe('Hello World');
  });

  it('concatenates on the left when cursor is on the left half', () => {
    const w = new World();
    const target = w.add(new TextThing({ value: 'World' })) as TextThing;
    const dragged = w.add(new TextThing({ value: 'Hello ' })) as TextThing;
    resolveDrop(w, dragged, target, { side: 'left' });
    expect(target.value).toBe('Hello World');
  });
});

describe('resolveDrop: boxes', () => {
  it('fills an empty hole and removes the thing from the top level', () => {
    const w = new World();
    const box = w.add(new Box({ size: 2 })) as Box;
    const n = w.add(new NumberThing({ value: 7 })) as NumberThing;
    const result = resolveDrop(w, n, box, { holeIndex: 0 });
    expect(result).toBe('filled');
    expect(box.contentsAt(0)).toBe(n);
    expect(w.get(n.id)).toBeUndefined();
  });

  it('combines with an occupied hole of the same type', () => {
    const w = new World();
    const box = w.add(new Box({ size: 1 })) as Box;
    const first = w.add(new NumberThing({ value: 2 })) as NumberThing;
    resolveDrop(w, first, box, { holeIndex: 0 });
    const second = w.add(new NumberThing({ value: 40 })) as NumberThing;
    const result = resolveDrop(w, second, box, { holeIndex: 0 });
    expect(result).toBe('combined');
    expect((box.contentsAt(0) as NumberThing).value.toString()).toBe('42');
  });
});

describe('resolveDrop: box joining', () => {
  it('joins two boxes on the right by default (holes appended)', () => {
    const w = new World();
    const target = w.add(new Box({ holes: [new NumberThing({ value: 1 })] })) as Box;
    const dragged = w.add(new Box({ holes: [new NumberThing({ value: 2 }), null] })) as Box;
    const result = resolveDrop(w, dragged, target, { side: 'right' });
    expect(result).toBe('joined');
    expect(target.size).toBe(3);
    expect((target.contentsAt(0) as NumberThing).value.toString()).toBe('1');
    expect((target.contentsAt(1) as NumberThing).value.toString()).toBe('2');
    expect(target.isHoleEmpty(2)).toBe(true);
    expect(w.get(dragged.id)).toBeUndefined();
  });

  it('joins on the left (holes prepended)', () => {
    const w = new World();
    const target = w.add(new Box({ holes: [new NumberThing({ value: 1 })] })) as Box;
    const dragged = w.add(new Box({ holes: [new NumberThing({ value: 2 })] })) as Box;
    resolveDrop(w, dragged, target, { side: 'left' });
    expect(target.size).toBe(2);
    expect((target.contentsAt(0) as NumberThing).value.toString()).toBe('2');
    expect((target.contentsAt(1) as NumberThing).value.toString()).toBe('1');
  });

  it('nests (fills a hole) rather than joining when dropped onto a hole', () => {
    const w = new World();
    const target = w.add(new Box({ size: 1 })) as Box;
    const dragged = w.add(new Box({ size: 1 })) as Box;
    const result = resolveDrop(w, dragged, target, { holeIndex: 0 });
    expect(result).toBe('filled');
    expect(target.size).toBe(1);
    expect(target.contentsAt(0)).toBe(dragged);
  });
});

// cubby.cpp set_to_future_value: a BLANK box is sized/filled by what you drop.
describe('resolveDrop: blank box (set_to_future_value)', () => {
  it('a number gives the box that many empty holes, and it is no longer blank', () => {
    const w = new World();
    const box = w.add(new Box({ blank: true })) as Box;
    const n = w.add(new NumberThing({ value: 3 })) as NumberThing;
    expect(resolveDrop(w, n, box)).toBe('combined');
    expect(box.blank).toBe(false);
    expect(box.size).toBe(3);
    expect(box.holes.every((h) => h == null)).toBe(true);
    expect(w.get(n.id)).toBeUndefined();
    // now ordinary: a number dropped in a hole fills that hole (not re-sizing)
    const five = w.add(new NumberThing({ value: 5 })) as NumberThing;
    expect(resolveDrop(w, five, box, { holeIndex: 1 })).toBe('filled');
    expect((box.contentsAt(1) as NumberThing).value.toString()).toBe('5');
  });

  it('text explodes into one single-character pad per letter', () => {
    const w = new World();
    const box = w.add(new Box({ blank: true })) as Box;
    const t = w.add(new TextThing({ value: 'cat' })) as TextThing;
    expect(resolveDrop(w, t, box)).toBe('combined');
    expect(box.size).toBe(3);
    expect((box.contentsAt(0) as TextThing).value).toBe('c');
    expect((box.contentsAt(1) as TextThing).value).toBe('a');
    expect((box.contentsAt(2) as TextThing).value).toBe('t');
  });

  it('a robot team gives a hole per robot in the line-up', () => {
    const w = new World();
    const box = w.add(new Box({ blank: true })) as Box;
    const lead = new Robot();
    lead.team = [new Robot(), new Robot()]; // a team of 3 with the leader
    w.add(lead);
    expect(resolveDrop(w, lead, box)).toBe('combined');
    expect(box.size).toBe(3);
    expect(box.holes.every((h) => h instanceof Robot)).toBe(true);
  });

  it('a notebook gives a hole per page', () => {
    const w = new World();
    const box = w.add(new Box({ blank: true })) as Box;
    const nb = new Notebook({ pages: [new NumberThing({ value: 1 }), new TextThing({ value: 'p' })] });
    w.add(nb);
    expect(resolveDrop(w, nb, box)).toBe('combined');
    expect(box.size).toBe(2);
  });

  it('clamps a negative or huge number (no negative or runaway holes)', () => {
    const w = new World();
    const neg = w.add(new Box({ blank: true })) as Box;
    resolveDrop(w, w.add(new NumberThing({ value: -4 })), neg);
    expect(neg.size).toBe(0);
    const big = w.add(new Box({ blank: true })) as Box;
    resolveDrop(w, w.add(new NumberThing({ value: 100000 })), big);
    expect(big.size).toBe(100); // MAX_BOX_HOLES
  });
});

describe('resolveDrop: no-ops', () => {
  it('does nothing for incompatible types', () => {
    const w = new World();
    const text = w.add(new TextThing({ value: 'x' })) as TextThing;
    const num = w.add(new NumberThing({ value: 1 })) as NumberThing;
    expect(resolveDrop(w, num, text)).toBe('none');
    expect(w.size).toBe(2);
  });

  it('does nothing when dropped on itself or empty space', () => {
    const w = new World();
    const num = w.add(new NumberThing({ value: 1 })) as NumberThing;
    expect(resolveDrop(w, num, num)).toBe('none');
    expect(resolveDrop(w, num, undefined)).toBe('none');
  });
});
