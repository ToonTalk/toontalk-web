import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { NumberThing } from '../src/model/number';
import { Box } from '../src/model/box';
import { Robot, applyAction } from '../src/model/robot';
import { Truck } from '../src/model/truck';
import { House, runHouse } from '../src/model/house';
import { Notebook } from '../src/model/notebook';
import { resolveDrop } from '../src/model/interactions';
import { serialize, loadWorld } from '../src/model/persistence';

describe('modules in trucks and houses', () => {
  it('a notebook dropped on a truck becomes the house module', () => {
    const w = new World();
    const truck = w.add(new Truck()) as Truck;
    const module = w.add(new Notebook({ pages: [new NumberThing({ value: 1 })] })) as Notebook;
    const robot = w.add(new Robot({ condition: ['number'], actions: [] })) as Robot;
    const box = w.add(new Box({ holes: [new NumberThing({ value: 0 })] })) as Box;

    expect(resolveDrop(w, module, truck)).toBe('loaded'); // module aboard, not full yet
    expect(resolveDrop(w, robot, truck)).toBe('loaded');
    expect(resolveDrop(w, box, truck)).toBe('built'); // robot + box → drives off

    const house = w.all().find((t) => t instanceof House) as House;
    expect(house.module).toBeInstanceOf(Notebook);
    expect(house.module!.count).toBe(1);
  });

  it('the house module round-trips through save/load', () => {
    const w = new World();
    w.add(
      new House({
        robot: new Robot({ condition: ['number', null], actions: [] }),
        box: new Box({ holes: [new NumberThing({ value: 0 }), null] }),
        module: new Notebook({ pages: [new NumberThing({ value: 1 })] }),
      }),
    );
    const w2 = new World();
    loadWorld(w2, serialize(w));
    const house = w2.all().find((t) => t instanceof House) as House;
    expect(house.module).toBeInstanceOf(Notebook);
    expect(house.module!.count).toBe(1);
  });
});

describe('fromModule action (module use / recursion primitive)', () => {
  it('copies a module page into an empty hole (a copy, not the original)', () => {
    const box = new Box({ holes: [new NumberThing({ value: 0 }), null] });
    const module = new Notebook({ pages: [new NumberThing({ value: 7 }), new NumberThing({ value: 9 })] });
    const ok = applyAction(box, { type: 'fromModule', page: 2, to: 1 }, { module });
    expect(ok).toBe(true);
    const placed = box.contentsAt(1) as NumberThing;
    expect(placed.value.toString()).toBe('9');
    expect(placed).not.toBe(module.pages[1]); // it's a copy
  });

  it('does nothing without a module or onto a full hole', () => {
    const box = new Box({ holes: [new NumberThing({ value: 0 }), new NumberThing({ value: 5 })] });
    expect(applyAction(box, { type: 'fromModule', page: 1, to: 1 }, {})).toBe(false); // no module
    const module = new Notebook({ pages: [new NumberThing({ value: 1 })] });
    expect(applyAction(box, { type: 'fromModule', page: 1, to: 1 }, { module })).toBe(false); // full
  });

  it('a house runs fromModule each step: the counter climbs from its module', () => {
    const w = new World();
    const house = new House({
      robot: new Robot({
        condition: ['number', null],
        actions: [
          { type: 'fromModule', page: 1, to: 1 },
          { type: 'combine', from: 1, to: 0 },
        ],
      }),
      box: new Box({ holes: [new NumberThing({ value: 0 }), null] }),
      module: new Notebook({ pages: [new NumberThing({ value: 1 })] }),
    });
    w.add(house);
    runHouse(w, house);
    runHouse(w, house);
    runHouse(w, house);
    expect((house.box.contentsAt(0) as NumberThing).value.toString()).toBe('3');
  });
});
