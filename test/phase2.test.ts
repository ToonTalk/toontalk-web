import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { NumberThing } from '../src/model/number';
import { TextThing } from '../src/model/text';
import { Nest } from '../src/model/nest';
import { Bird } from '../src/model/bird';
import { Wand } from '../src/model/wand';
import { resolveDrop } from '../src/model/interactions';

describe('wand', () => {
  it('copies the target and leaves both the wand and original in place', () => {
    const w = new World();
    const num = w.add(new NumberThing({ value: 9 })) as NumberThing;
    const wand = w.add(new Wand()) as Wand;
    const before = w.size;
    const result = resolveDrop(w, wand, num);
    expect(result).toBe('copied');
    expect(w.size).toBe(before + 1);
    expect(w.get(wand.id)).toBeDefined();
    expect(w.get(num.id)).toBeDefined();
    const copies = w.all().filter((t) => t instanceof NumberThing) as NumberThing[];
    expect(copies).toHaveLength(2);
    expect(copies[0]!.value.toString()).toBe('9');
    expect(copies[1]!.value.toString()).toBe('9');
  });

  it('produces an independent copy (mutating one does not change the other)', () => {
    const w = new World();
    const text = w.add(new TextThing({ value: 'cat' })) as TextThing;
    const wand = w.add(new Wand()) as Wand;
    resolveDrop(w, wand, text);
    const copy = w.all().find((t) => t instanceof TextThing && t.id !== text.id) as TextThing;
    copy.value = 'dog';
    expect(text.value).toBe('cat');
  });
});

describe('bird + nest', () => {
  it('delivers a thing dropped on a bird to its nest', () => {
    const w = new World();
    const nest = w.add(new Nest()) as Nest;
    const bird = w.add(new Bird({ nest })) as Bird;
    const gift = w.add(new NumberThing({ value: 1 })) as NumberThing;
    const result = resolveDrop(w, gift, bird);
    expect(result).toBe('delivered');
    expect(nest.contents).toHaveLength(1);
    expect(nest.latest()).toBe(gift);
    expect(w.get(gift.id)).toBeUndefined();
  });

  it('accepts things dropped directly on a nest and stacks them', () => {
    const w = new World();
    const nest = w.add(new Nest()) as Nest;
    resolveDrop(w, w.add(new TextThing({ value: 'a' })), nest);
    resolveDrop(w, w.add(new TextThing({ value: 'b' })), nest);
    expect(nest.contents).toHaveLength(2);
    expect((nest.latest() as TextThing).value).toBe('b');
  });

  it('does nothing when a bird has no nest', () => {
    const w = new World();
    const bird = w.add(new Bird()) as Bird;
    const gift = w.add(new NumberThing({ value: 1 })) as NumberThing;
    expect(resolveDrop(w, gift, bird)).toBe('none');
    expect(w.get(gift.id)).toBeDefined();
  });
});
