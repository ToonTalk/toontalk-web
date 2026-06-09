import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { NumberThing } from '../src/model/number';
import { Pumpy, resizeThing } from '../src/model/pumpy';
import { resolveDrop } from '../src/model/interactions';
import { serialize, loadWorld } from '../src/model/persistence';

describe('Pumpy resize', () => {
  it('bigger/smaller scale both dimensions; good resets', () => {
    const n = new NumberThing({ value: 1 });
    resizeThing(n, 'bigger');
    expect(n.scaleX).toBeCloseTo(1.25); expect(n.scaleY).toBeCloseTo(1.25);
    resizeThing(n, 'good');
    expect(n.scaleX).toBe(1); expect(n.scaleY).toBe(1);
  });

  it('wider/taller affect one axis; clamps to a max', () => {
    const n = new NumberThing({ value: 1 });
    resizeThing(n, 'wider');
    expect(n.scaleX).toBeCloseTo(1.25); expect(n.scaleY).toBe(1);
    for (let i = 0; i < 20; i++) resizeThing(n, 'taller');
    expect(n.scaleY).toBeLessThanOrEqual(3); // clamped
  });

  it('dropping Pumpy on a thing resizes it', () => {
    const w = new World();
    const pumpy = w.add(new Pumpy({ mode: 'bigger' })) as Pumpy;
    const n = w.add(new NumberThing({ value: 5 })) as NumberThing;
    expect(resolveDrop(w, pumpy, n)).toBe('resized');
    expect(n.scaleX).toBeCloseTo(1.25);
    expect(w.get(pumpy.id)).toBeDefined(); // not consumed
  });

  it('a resized thing round-trips through save/load', () => {
    const w = new World();
    const n = w.add(new NumberThing({ value: 3 })) as NumberThing;
    n.scaleX = 1.5; n.scaleY = 0.8;
    const w2 = new World();
    loadWorld(w2, serialize(w));
    const loaded = w2.all().find((t) => t instanceof NumberThing) as NumberThing;
    expect(loaded.scaleX).toBeCloseTo(1.5);
    expect(loaded.scaleY).toBeCloseTo(0.8);
  });
});
