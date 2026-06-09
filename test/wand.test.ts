import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { NumberThing } from '../src/model/number';
import { Robot } from '../src/model/robot';
import { Wand } from '../src/model/wand';
import { resolveDrop } from '../src/model/interactions';

describe('wand modes', () => {
  it('C copies and restores (the copy is un-erased)', () => {
    const w = new World();
    const wand = w.add(new Wand({ mode: 'C' })) as Wand;
    const n = w.add(new NumberThing({ value: 5 })); n.erased = true;
    resolveDrop(w, wand, n);
    const copy = w.all().find((t) => t instanceof NumberThing && t !== n) as NumberThing;
    expect(copy.erased).toBe(false); // restored
  });

  it('O copies preserving the erased (wildcard) state', () => {
    const w = new World();
    const wand = w.add(new Wand({ mode: 'O' })) as Wand;
    const n = w.add(new NumberThing({ value: 5 })); n.erased = true;
    resolveDrop(w, wand, n);
    const copy = w.all().find((t) => t instanceof NumberThing && t !== n) as NumberThing;
    expect(copy.erased).toBe(true); // preserved
  });

  it('C copies a robot without its team; S copies the whole team', () => {
    const w = new World();
    const robot = () => { const r = new Robot(); r.team = [new Robot()]; return r; };

    const wandC = w.add(new Wand({ mode: 'C' })) as Wand;
    const r1 = w.add(robot());
    resolveDrop(w, wandC, r1);
    const copyC = w.all().find((t) => t instanceof Robot && t !== r1) as Robot;
    expect(copyC.team).toHaveLength(0);

    const wandS = w.add(new Wand({ mode: 'S' })) as Wand;
    const r2 = w.add(robot());
    resolveDrop(w, wandS, r2);
    const copyS = w.all().find((t) => t instanceof Robot && t !== r1 && t !== r2 && t !== copyC) as Robot;
    expect(copyS.team).toHaveLength(1);
  });
});
