import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { NumberThing } from '../src/model/number';
import { Box } from '../src/model/box';
import { Dusty } from '../src/model/dusty';
import { resolveDrop } from '../src/model/interactions';

describe('Dusty modes', () => {
  it('cycles erase → suck → reverse → erase', () => {
    const d = new Dusty();
    expect(d.mode).toBe('erase');
    d.cycleMode(); expect(d.mode).toBe('suck');
    d.cycleMode(); expect(d.mode).toBe('reverse');
    d.cycleMode(); expect(d.mode).toBe('erase');
  });

  it('suck removes a loose thing into the stomach', () => {
    const w = new World();
    const dusty = w.add(new Dusty({ mode: 'suck' })) as Dusty;
    const n = w.add(new NumberThing({ value: 7 }));
    expect(resolveDrop(w, dusty, n)).toBe('sucked');
    expect(w.get(n.id)).toBeUndefined();
    expect(dusty.stomach).toHaveLength(1);
  });

  it('suck empties a box hole; reverse spits it back into an empty hole', () => {
    const w = new World();
    const box = w.add(new Box({ holes: [new NumberThing({ value: 4 }), null] })) as Box;
    const dusty = w.add(new Dusty({ mode: 'suck' })) as Dusty;
    resolveDrop(w, dusty, box, { holeIndex: 0 });
    expect(box.isHoleEmpty(0)).toBe(true);
    expect(dusty.stomach).toHaveLength(1);

    dusty.mode = 'reverse';
    expect(resolveDrop(w, dusty, box, { holeIndex: 1 })).toBe('spat');
    expect((box.contentsAt(1) as NumberThing).value.toString()).toBe('4');
    expect(dusty.stomach).toHaveLength(0);
  });

  it('reverse with an empty stomach does nothing', () => {
    const w = new World();
    const dusty = w.add(new Dusty({ mode: 'reverse' })) as Dusty;
    const n = w.add(new NumberThing({ value: 1 }));
    expect(resolveDrop(w, dusty, n)).toBe('none');
    expect(w.get(n.id)).toBeDefined();
  });
});
