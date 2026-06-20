import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { NumberThing } from '../src/model/number';
import { Box } from '../src/model/box';
import { Robot } from '../src/model/robot';
import { Trainer } from '../src/model/trainer';
import { Wand } from '../src/model/wand';
import { resolveDrop } from '../src/model/interactions';

describe('wand modes', () => {
  it('C is an exact copy — it preserves the erased (wildcard) state', () => {
    const w = new World();
    const wand = w.add(new Wand({ mode: 'C' })) as Wand;
    const n = w.add(new NumberThing({ value: 5 })); n.erased = true;
    resolveDrop(w, wand, n);
    const copy = w.all().find((t) => t instanceof NumberThing && t !== n) as NumberThing;
    expect(copy.erased).toBe(true); // preserved
  });

  it('O restores — the copy is un-erased (concrete)', () => {
    const w = new World();
    const wand = w.add(new Wand({ mode: 'O' })) as Wand;
    const n = w.add(new NumberThing({ value: 5 })); n.erased = true;
    resolveDrop(w, wand, n);
    const copy = w.all().find((t) => t instanceof NumberThing && t !== n) as NumberThing;
    expect(copy.erased).toBe(false); // restored
  });

  it('O on a robot yields a concrete, matching test box (erased holes restored)', () => {
    const w = new World();
    // Train an adder on [5,3], then GENERALIZE the first hole (erase it).
    const robot = w.add(new Robot()) as Robot;
    const trainer = new Trainer(w);
    trainer.start(robot, new Box({ holes: [new NumberThing({ value: 5 }), new NumberThing({ value: 3 })] }));
    trainer.eraseHole(0); // first hole becomes "any number"
    trainer.recordCombine(1, 0);
    trainer.finish();
    expect(robot.exactValues[0]).toBeNull(); // generalized
    expect(robot.originalValues[0]).not.toBeNull(); // but the 5 is remembered

    const wand = w.add(new Wand({ mode: 'O' })) as Wand;
    resolveDrop(w, wand, robot);
    const box = w.all().find((t) => t instanceof Box) as Box;
    expect(box.size).toBe(2);
    expect((box.contentsAt(0) as NumberThing).value.toString()).toBe('5'); // restored original
    expect((box.contentsAt(0) as NumberThing).erased).toBe(false); // concrete
    expect(robot.matches(box)).toBe(true); // ready to drop on the robot to test
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
