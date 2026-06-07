import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { NumberThing } from '../src/model/number';
import { TextThing } from '../src/model/text';
import { Box } from '../src/model/box';
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
    const dragged = w.add(new NumberThing({ value: 4, operation: '-' })) as NumberThing;
    resolveDrop(w, dragged, target);
    expect(target.value.toString()).toBe('6');
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
