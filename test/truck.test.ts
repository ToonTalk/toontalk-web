import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { NumberThing } from '../src/model/number';
import { Box } from '../src/model/box';
import { Robot } from '../src/model/robot';
import { Truck } from '../src/model/truck';
import { House, runHouse } from '../src/model/house';
import { Bomb } from '../src/model/bomb';
import { resolveDrop } from '../src/model/interactions';
import { serialize, loadWorld } from '../src/model/persistence';

const adder = () =>
  new Robot({ condition: ['number', 'number'], actions: [{ type: 'combine', from: 1, to: 0 }] });
const numBox = (a: number, b: number) =>
  new Box({ holes: [new NumberThing({ value: a }), new NumberThing({ value: b })] });

describe('trucks build houses', () => {
  it('loading a robot then a box drives off and builds a house', () => {
    const w = new World();
    const truck = w.add(new Truck()) as Truck;
    const robot = w.add(adder());
    const box = w.add(numBox(4, 5));

    expect(resolveDrop(w, robot, truck)).toBe('loaded'); // robot aboard, still loading
    expect(w.get(truck.id)).toBeDefined();
    expect(resolveDrop(w, box, truck)).toBe('built'); // box completes it → drives off

    expect(w.get(truck.id)).toBeUndefined(); // truck drove off
    const house = w.all().find((t) => t instanceof House) as House;
    expect(house).toBeDefined();
    expect(house.robot.actions).toHaveLength(1);
  });

  it('a running house works on its box', () => {
    const w = new World();
    const house = new House({ robot: adder(), box: numBox(4, 5) });
    expect(runHouse(w, house)).toBe(true);
    expect((house.box.contentsAt(0) as NumberThing).value.toString()).toBe('9'); // 4+5
  });

  it('a bomb terminates a house', () => {
    const w = new World();
    const house = w.add(new House({ robot: adder(), box: numBox(1, 2) }));
    const bomb = w.add(new Bomb()) as Bomb;
    expect(resolveDrop(w, bomb, house)).toBe('exploded');
    expect(w.get(house.id)).toBeUndefined();
    expect(w.get(bomb.id)).toBeUndefined();
  });

  it('a house round-trips through save/load and still runs', () => {
    const w = new World();
    w.add(new House({ robot: adder(), box: numBox(6, 7) }));
    const w2 = new World();
    loadWorld(w2, serialize(w));
    const house = w2.all().find((t) => t instanceof House) as House;
    expect(house).toBeDefined();
    expect(runHouse(w2, house)).toBe(true);
    expect((house.box.contentsAt(0) as NumberThing).value.toString()).toBe('13');
  });
});
