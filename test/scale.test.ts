import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { NumberThing } from '../src/model/number';
import { TextThing } from '../src/model/text';
import { Box } from '../src/model/box';
import { Scale, compareTilt, recomputeScales } from '../src/model/scale';
import { Robot, runRobot } from '../src/model/robot';
import { serialize, loadWorld } from '../src/model/persistence';

describe('compareTilt', () => {
  it('tips toward the bigger number / level when equal', () => {
    expect(compareTilt(new NumberThing({ value: 3 }), new NumberThing({ value: 5 }))).toBe('right');
    expect(compareTilt(new NumberThing({ value: 9 }), new NumberThing({ value: 2 }))).toBe('left');
    expect(compareTilt(new NumberThing({ value: 4 }), new NumberThing({ value: 4 }))).toBe('balanced');
  });

  it('tips toward the text later in alphabetical order', () => {
    expect(compareTilt(new TextThing({ value: 'apple' }), new TextThing({ value: 'banana' }))).toBe('right');
    expect(compareTilt(new TextThing({ value: 'zebra' }), new TextThing({ value: 'apple' }))).toBe('left');
  });

  it('totters on incomparable kinds', () => {
    expect(compareTilt(new NumberThing({ value: 1 }), new TextThing({ value: 'x' }))).toBe('tottering');
  });
});

describe('recomputeScales', () => {
  function scaleBox(a: number, b: number): Box {
    return new Box({
      holes: [new NumberThing({ value: a }), new Scale(), new NumberThing({ value: b })],
    });
  }

  it('settles a scale between two numbers', () => {
    const box = scaleBox(3, 5);
    recomputeScales(box);
    expect((box.contentsAt(1) as Scale).tilt).toBe('right');
  });

  it('totters when a neighbour is missing', () => {
    const box = new Box({ holes: [new Scale(), new NumberThing({ value: 5 })] });
    recomputeScales(box);
    expect((box.contentsAt(0) as Scale).tilt).toBe('tottering');
  });

  it('keeps its previous tilt when a neighbour is erased', () => {
    const box = scaleBox(3, 5);
    recomputeScales(box); // → 'right'
    box.contentsAt(0)!.erased = true;
    box.contentsAt(2)!.erased = true;
    recomputeScales(box);
    expect((box.contentsAt(1) as Scale).tilt).toBe('right'); // frozen, not tottering
  });
});

describe('robots condition on a scale tilt', () => {
  function scaleBox(a: number, b: number): Box {
    return new Box({
      holes: [new NumberThing({ value: a }), new Scale(), new NumberThing({ value: b })],
    });
  }

  it('matches only boxes whose scale tilts the trained way', () => {
    const w = new World();
    // Guard: scale must tilt right (first < second).
    const robot = new Robot({
      condition: ['number', 'scale', 'number'],
      exactValues: [null, new Scale({ tilt: 'right' }), null],
      actions: [{ type: 'combine', from: 2, to: 0 }],
    });
    expect(runRobot(w, robot, scaleBox(3, 5))).toBe(true); // 3 < 5 → tilts right → runs
    expect(runRobot(w, robot, scaleBox(9, 2))).toBe(false); // tilts left → no match
  });
});

describe('scale persistence', () => {
  it('round-trips a scale and re-settles its tilt on load', () => {
    const w = new World();
    const box = new Box({
      holes: [new NumberThing({ value: 3 }), new Scale(), new NumberThing({ value: 5 })],
    });
    recomputeScales(box);
    w.add(box);

    const w2 = new World();
    loadWorld(w2, serialize(w));
    const loaded = w2.all().find((t) => t instanceof Box) as Box;
    expect((loaded.contentsAt(1) as Scale).tilt).toBe('right');
  });
});
