import { describe, it, expect } from 'vitest';
import {
  makeSensor,
  isSensor,
  NumberSensor,
  TextSensor,
  SENSOR_TYPES,
} from '../src/model/sensor';
import { updateSensors } from '../src/model/sensor-runtime';
import type { InputState } from '../src/input/input-state';
import { World } from '../src/model/world';
import { Box } from '../src/model/box';
import { Robot } from '../src/model/robot';
import { NumberThing } from '../src/model/number';
import { deserialize, serialize } from '../src/model/persistence';
import { Rational } from '../src/model/rational';

function baseInput(over: Partial<InputState> = {}): InputState {
  return {
    mouseVX: 0,
    mouseVY: 0,
    downLeft: false,
    downMiddle: false,
    downRight: false,
    clickLeft: false,
    clickMiddle: false,
    clickRight: false,
    lastKey: '',
    justKey: '',
    shift: false,
    ctrl: false,
    dtMs: 16,
    random: 0,
    handVisible: true,
    addressRoad: 0,
    addressStreet: 0,
    ...over,
  };
}

describe('sensor catalog', () => {
  it('builds every catalog type as a sensor pad', () => {
    for (const type of SENSOR_TYPES) {
      const s = makeSensor(type);
      expect(isSensor(s)).toBe(true);
      expect(s.sensorType).toBe(type);
    }
  });
});

describe('numeric sensors', () => {
  it('mouse velocity / timer / random / address read the input', () => {
    const vx = makeSensor('mouse-vx') as NumberSensor;
    expect(vx.update(baseInput({ mouseVX: 500 }))).toBe(true);
    expect(vx.value.toString()).toBe('500');

    const vy = makeSensor('mouse-vy') as NumberSensor;
    vy.update(baseInput({ mouseVY: -250 }));
    expect(vy.value.toString()).toBe('-250');

    const ms = makeSensor('ms-per-frame') as NumberSensor;
    ms.update(baseInput({ dtMs: 33 }));
    expect(ms.value.toString()).toBe('33');

    const rnd = makeSensor('random') as NumberSensor;
    rnd.update(baseInput({ random: 742 }));
    expect(rnd.value.toString()).toBe('742');

    const road = makeSensor('address-road') as NumberSensor;
    road.update(baseInput({ addressRoad: 6 }));
    expect(road.value.toString()).toBe('6');
  });

  it('update returns false when the value is unchanged', () => {
    const ms = makeSensor('ms-per-frame') as NumberSensor;
    ms.update(baseInput({ dtMs: 16 }));
    expect(ms.update(baseInput({ dtMs: 16 }))).toBe(false);
  });
});

describe('text / yes-no sensors', () => {
  it('buttons, keys, modifiers, hand read as yes/no or key names', () => {
    const click = makeSensor('click-left') as TextSensor;
    click.update(baseInput({ clickLeft: true }));
    expect(click.value).toBe('yes');
    click.update(baseInput({ clickLeft: false }));
    expect(click.value).toBe('no'); // momentary: drops back next sample

    const down = makeSensor('down-right') as TextSensor;
    down.update(baseInput({ downRight: true }));
    expect(down.value).toBe('yes');

    const justKey = makeSensor('key-just') as TextSensor;
    justKey.update(baseInput({ justKey: 'a' }));
    expect(justKey.value).toBe('a');
    justKey.update(baseInput({ justKey: '' }));
    expect(justKey.value).toBe('');

    const last = makeSensor('key-last') as TextSensor;
    last.update(baseInput({ lastKey: 'Up arrow' }));
    expect(last.value).toBe('Up arrow');

    const shift = makeSensor('shift-down') as TextSensor;
    shift.update(baseInput({ shift: true }));
    expect(shift.value).toBe('yes');

    const hand = makeSensor('hand-visible') as TextSensor;
    hand.update(baseInput({ handVisible: false }));
    expect(hand.value).toBe('no');
  });
});

describe('sensor copy & persistence', () => {
  it('copy() yields a live sensor of the same type', () => {
    const r = makeSensor('random') as NumberSensor;
    const c = r.copy();
    expect(c).toBeInstanceOf(NumberSensor);
    expect(c.sensorType).toBe('random');
    expect(c.update(baseInput({ random: 9 }))).toBe(true);
    expect(c.value.toString()).toBe('9');
  });

  it('round-trips through serialize/deserialize as a live sensor', () => {
    const w = new World();
    w.add(makeSensor('random', { value: Rational.fromInt(5) }));
    w.add(makeSensor('shift-down', { value: 'yes' }));
    const things = deserialize(serialize(w));
    expect(things.filter(isSensor)).toHaveLength(2);
    const rnd = things.find((t) => isSensor(t) && t.sensorType === 'random') as NumberSensor;
    expect(rnd).toBeInstanceOf(NumberSensor);
    rnd.update(baseInput({ random: 123 }));
    expect(rnd.value.toString()).toBe('123');
  });
});

describe('sensors behave as their pad kind', () => {
  it('a numeric sensor (kind number) matches a number robot condition', () => {
    const robot = new Robot({ condition: ['number'], actions: [] });
    const box = new Box({ holes: [makeSensor('random')] });
    expect(robot.matches(box)).toBe(true);
  });

  it('a numeric sensor combines like a number', () => {
    const target = new NumberThing({ value: 10 });
    const sensor = makeSensor('random', { value: Rational.fromInt(5) }) as NumberSensor;
    sensor.applyTo(target); // target := target + sensor
    expect(target.value.toString()).toBe('15');
  });
});

describe('updateSensors', () => {
  it('updates every sensor in the world from one snapshot', () => {
    const w = new World();
    const rnd = makeSensor('random') as NumberSensor;
    const shift = makeSensor('shift-down') as TextSensor;
    w.add(rnd);
    w.add(shift);
    updateSensors(w, baseInput({ random: 808, shift: true }));
    expect(rnd.value.toString()).toBe('808');
    expect(shift.value).toBe('yes');
  });
});
