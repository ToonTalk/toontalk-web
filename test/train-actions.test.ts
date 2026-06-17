import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { NumberThing } from '../src/model/number';
import { TextThing } from '../src/model/text';
import { Box } from '../src/model/box';
import { Robot, runRobot, applyAction } from '../src/model/robot';
import { Trainer } from '../src/model/trainer';
import { serialize, loadWorld } from '../src/model/persistence';

/** robot.htm: "take things out of, or put things into, a box… counting from the
 * left side." Beyond hole→hole combine/move, the trainer records `remove`
 * (take-out) and `insert` (put-in a carried copy). Holes are erased to
 * generalise (so the robot isn't value-fussy) — see erasing.test.ts. */

describe('applyAction: insert (put-in)', () => {
  it('fills an empty hole with an independent copy of the carried thing', () => {
    const box = new Box({ holes: [new NumberThing({ value: 1 }), null] });
    const template = new NumberThing({ value: 7 });
    expect(applyAction(box, { type: 'insert', to: 1, thing: template })).toBe(true);
    const placed = box.contentsAt(1) as NumberThing;
    expect(placed.value.toString()).toBe('7');
    expect(placed).not.toBe(template); // a copy, not the carried instance
  });

  it('combines into a filled number hole (an "add 10" robot)', () => {
    const box = new Box({ holes: [new NumberThing({ value: 3 })] });
    expect(applyAction(box, { type: 'insert', to: 0, thing: new NumberThing({ value: 10 }) })).toBe(true);
    expect((box.contentsAt(0) as NumberThing).value.toString()).toBe('13');
  });

  it('joins into a filled text hole', () => {
    const box = new Box({ holes: [new TextThing({ value: 'foo' })] });
    expect(applyAction(box, { type: 'insert', to: 0, thing: new TextThing({ value: 'bar' }) })).toBe(true);
    expect((box.contentsAt(0) as TextThing).value).toBe('foobar');
  });
});

describe('applyAction: copy (wand)', () => {
  it('duplicates a hole into an empty hole (source kept, copy independent)', () => {
    const box = new Box({ holes: [new NumberThing({ value: 6 }), null] });
    expect(applyAction(box, { type: 'copy', from: 0, to: 1 })).toBe(true);
    expect((box.contentsAt(0) as NumberThing).value.toString()).toBe('6');
    expect((box.contentsAt(1) as NumberThing).value.toString()).toBe('6');
    expect(box.contentsAt(0)).not.toBe(box.contentsAt(1));
  });

  it('copy onto itself doubles a number', () => {
    const box = new Box({ holes: [new NumberThing({ value: 5 })] });
    expect(applyAction(box, { type: 'copy', from: 0, to: 0 })).toBe(true);
    expect((box.contentsAt(0) as NumberThing).value.toString()).toBe('10');
  });
});

describe('applyAction: remove (take-out)', () => {
  it('empties the hole, and is a no-op on an already-empty hole', () => {
    const box = new Box({ holes: [new NumberThing({ value: 1 }), null] });
    expect(applyAction(box, { type: 'remove', hole: 0 })).toBe(true);
    expect(box.isHoleEmpty(0)).toBe(true);
    expect(applyAction(box, { type: 'remove', hole: 1 })).toBe(false);
  });
});

describe('Trainer records take-out and put-in', () => {
  it('trains an "empty hole 1" robot via recordRemove (generalised)', () => {
    const w = new World();
    const robot = w.add(new Robot({})) as Robot;
    const sample = w.add(new Box({ holes: [new NumberThing({ value: 5 }), new NumberThing({ value: 9 }) ] })) as Box;
    sample.contentsAt(0)!.erased = true; // generalise both holes → any [number, number]
    sample.contentsAt(1)!.erased = true;
    const t = new Trainer(w);
    t.start(robot, sample);
    expect(t.recordRemove(1)).toBe(true);
    t.finish();
    expect(robot.condition).toEqual(['number', 'number']);
    expect(sample.isHoleEmpty(1)).toBe(true); // applied live to the demo box

    const fresh = new Box({ holes: [new NumberThing({ value: 2 }), new NumberThing({ value: 3 }) ] });
    expect(runRobot(w, robot, fresh)).toBe(true);
    expect((fresh.contentsAt(0) as NumberThing).value.toString()).toBe('2');
    expect(fresh.isHoleEmpty(1)).toBe(true);
  });

  it('trains a "put a 0 into the empty hole" robot via recordInsert (generalised)', () => {
    const w = new World();
    const robot = w.add(new Robot({})) as Robot;
    const sample = w.add(new Box({ holes: [new NumberThing({ value: 5 }), null] })) as Box;
    sample.contentsAt(0)!.erased = true; // any number in hole 0, empty hole 1
    const t = new Trainer(w);
    t.start(robot, sample);
    expect(t.recordInsert(1, new NumberThing({ value: 0 }))).toBe(true);
    t.finish();
    expect(robot.condition).toEqual(['number', null]);
    expect((sample.contentsAt(1) as NumberThing).value.toString()).toBe('0'); // live demo

    const fresh = new Box({ holes: [new NumberThing({ value: 8 }), null] });
    expect(runRobot(w, robot, fresh)).toBe(true);
    expect((fresh.contentsAt(1) as NumberThing).value.toString()).toBe('0');

    // each run drops a fresh, independent copy
    const fresh2 = new Box({ holes: [new NumberThing({ value: 1 }), null] });
    runRobot(w, robot, fresh2);
    expect(fresh.contentsAt(1)).not.toBe(fresh2.contentsAt(1));
    expect((fresh2.contentsAt(1) as NumberThing).value.toString()).toBe('0');
  });

  it('Dusty in the bubble (eraseHole) generalises a hole, keeping others guarded', () => {
    const w = new World();
    const robot = w.add(new Robot({})) as Robot;
    const sample = w.add(new Box({ holes: [new NumberThing({ value: 4 }), new NumberThing({ value: 5 }) ] })) as Box;
    const t = new Trainer(w);
    t.start(robot, sample);
    expect(t.eraseHole(1)).toBe(true); // suck the value out of hole 1
    t.finish();
    // hole 0 still must equal 4; hole 1 matches any number
    expect(robot.matches(new Box({ holes: [new NumberThing({ value: 4 }), new NumberThing({ value: 99 }) ] }))).toBe(true);
    expect(robot.matches(new Box({ holes: [new NumberThing({ value: 7 }), new NumberThing({ value: 99 }) ] }))).toBe(false);
  });

  it('trains a "duplicate hole 0 into hole 1" robot via recordCopy (the wand)', () => {
    const w = new World();
    const robot = w.add(new Robot({})) as Robot;
    const sample = w.add(new Box({ holes: [new NumberThing({ value: 6 }), null] })) as Box;
    sample.contentsAt(0)!.erased = true; // generalise hole 0 → any number
    const t = new Trainer(w);
    t.start(robot, sample);
    expect(t.recordCopy(0, 1)).toBe(true);
    t.finish();
    expect((sample.contentsAt(1) as NumberThing).value.toString()).toBe('6'); // applied live

    const fresh = new Box({ holes: [new NumberThing({ value: 8 }), null] });
    expect(runRobot(w, robot, fresh)).toBe(true);
    expect((fresh.contentsAt(0) as NumberThing).value.toString()).toBe('8'); // source kept
    expect((fresh.contentsAt(1) as NumberThing).value.toString()).toBe('8'); // duplicated
  });

  it('an insert-trained robot survives a save/load round-trip and still runs', () => {
    const w = new World();
    const robot = w.add(new Robot({})) as Robot;
    const sample = w.add(new Box({ holes: [new NumberThing({ value: 5 }), null] })) as Box;
    sample.contentsAt(0)!.erased = true;
    const t = new Trainer(w);
    t.start(robot, sample);
    t.recordInsert(1, new NumberThing({ value: 0 }));
    t.finish();

    const w2 = new World();
    loadWorld(w2, serialize(w));
    const reloaded = w2.all().find((x) => x instanceof Robot) as Robot;
    expect(reloaded).toBeDefined();
    const fresh = new Box({ holes: [new NumberThing({ value: 8 }), null] });
    expect(runRobot(w2, reloaded, fresh)).toBe(true);
    expect((fresh.contentsAt(1) as NumberThing).value.toString()).toBe('0');
  });
});
