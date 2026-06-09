/**
 * Sensors — pads that report *live* system state. Faithful to the original,
 * where a sensor "works much like a control for a picture" and simply *is* a
 * number or text/yes-no pad whose value refreshes every frame (see the sensor
 * notebook in source/.../doc/sensor.htm).
 *
 * Because a sensor IS a NumberThing / TextThing (same `kind`), the whole
 * interaction engine treats it as that pad with no special cases: robots match
 * it, numbers combine with it, it sits on scales, etc. The only extra is
 * `update(input)`, called once per frame by sensor-runtime, which recomputes the
 * displayed value from the InputState.
 *
 * Media sensors (file→picture/sound, MCI, text→speech, wall/house/roof
 * decorations, clipboard) and joystick sensors are intentionally not here yet.
 */
import { NumberThing, type NumberOp } from './number';
import { TextThing } from './text';
import { Rational } from './rational';
import type { InputState } from '../input/input-state';

export type SensorType =
  // numeric
  | 'mouse-vx'
  | 'mouse-vy'
  | 'ms-per-frame'
  | 'random'
  | 'address-road'
  | 'address-street'
  // yes/no + key (text)
  | 'click-left'
  | 'click-middle'
  | 'click-right'
  | 'down-left'
  | 'down-middle'
  | 'down-right'
  | 'key-just'
  | 'key-last'
  | 'shift-down'
  | 'ctrl-down'
  | 'hand-visible';

export type SensorValueKind = 'number' | 'text';
export interface SensorInfo {
  label: string;
  valueKind: SensorValueKind;
}

/** The sensor catalog (the notebook pages), in display order. */
export const SENSORS: Record<SensorType, SensorInfo> = {
  'mouse-vx': { label: 'mouse →', valueKind: 'number' },
  'mouse-vy': { label: 'mouse ↑', valueKind: 'number' },
  'ms-per-frame': { label: 'ms/frame', valueKind: 'number' },
  random: { label: 'random', valueKind: 'number' },
  'address-road': { label: 'road #', valueKind: 'number' },
  'address-street': { label: 'street #', valueKind: 'number' },
  'click-left': { label: 'L click', valueKind: 'text' },
  'click-middle': { label: 'M click', valueKind: 'text' },
  'click-right': { label: 'R click', valueKind: 'text' },
  'down-left': { label: 'L down', valueKind: 'text' },
  'down-middle': { label: 'M down', valueKind: 'text' },
  'down-right': { label: 'R down', valueKind: 'text' },
  'key-just': { label: 'key!', valueKind: 'text' },
  'key-last': { label: 'last key', valueKind: 'text' },
  'shift-down': { label: 'shift', valueKind: 'text' },
  'ctrl-down': { label: 'control', valueKind: 'text' },
  'hand-visible': { label: 'hand?', valueKind: 'text' },
};

export const SENSOR_TYPES = Object.keys(SENSORS) as SensorType[];

const yn = (b: boolean): string => (b ? 'yes' : 'no');

/** The current numeric reading for a numeric sensor. */
export function sensorNumber(type: SensorType, i: InputState): number {
  switch (type) {
    case 'mouse-vx':
      return Math.round(i.mouseVX);
    case 'mouse-vy':
      return Math.round(i.mouseVY);
    case 'ms-per-frame':
      return i.dtMs;
    case 'random':
      return i.random;
    case 'address-road':
      return i.addressRoad;
    case 'address-street':
      return i.addressStreet;
    default:
      return 0;
  }
}

/** The current text reading for a text/yes-no sensor. */
export function sensorText(type: SensorType, i: InputState): string {
  switch (type) {
    case 'click-left':
      return yn(i.clickLeft);
    case 'click-middle':
      return yn(i.clickMiddle);
    case 'click-right':
      return yn(i.clickRight);
    case 'down-left':
      return yn(i.downLeft);
    case 'down-middle':
      return yn(i.downMiddle);
    case 'down-right':
      return yn(i.downRight);
    case 'key-just':
      return i.justKey;
    case 'key-last':
      return i.lastKey;
    case 'shift-down':
      return yn(i.shift);
    case 'ctrl-down':
      return yn(i.ctrl);
    case 'hand-visible':
      return yn(i.handVisible);
    default:
      return '';
  }
}

/** A numeric pad that refreshes from the live input each frame. */
export class NumberSensor extends NumberThing {
  readonly sensorType: SensorType;

  constructor(opts: {
    id?: string;
    x?: number;
    y?: number;
    sensorType: SensorType;
    value?: Rational | number;
    operation?: NumberOp;
  }) {
    super({ ...opts, value: opts.value ?? 0 });
    this.sensorType = opts.sensorType;
  }

  /** Recompute the displayed value; returns whether it changed. */
  update(input: InputState): boolean {
    const v = Rational.fromInt(sensorNumber(this.sensorType, input));
    if (this.value.equals(v)) return false;
    this.value = v;
    return true;
  }

  override copy(): NumberSensor {
    return new NumberSensor({
      x: this.x,
      y: this.y,
      sensorType: this.sensorType,
      value: this.value,
      operation: this.operation,
    });
  }

  override snapshot() {
    return { ...super.snapshot(), sensorType: this.sensorType };
  }
}

/** A text/yes-no pad that refreshes from the live input each frame. */
export class TextSensor extends TextThing {
  readonly sensorType: SensorType;

  constructor(opts: { id?: string; x?: number; y?: number; sensorType: SensorType; value?: string }) {
    super({ ...opts, value: opts.value ?? '' });
    this.sensorType = opts.sensorType;
  }

  update(input: InputState): boolean {
    const v = sensorText(this.sensorType, input);
    if (this.value === v) return false;
    this.value = v;
    return true;
  }

  override copy(): TextSensor {
    return new TextSensor({ x: this.x, y: this.y, sensorType: this.sensorType, value: this.value });
  }

  override snapshot() {
    return { ...super.snapshot(), sensorType: this.sensorType };
  }
}

export type Sensor = NumberSensor | TextSensor;

export function isSensor(thing: unknown): thing is Sensor {
  return thing instanceof NumberSensor || thing instanceof TextSensor;
}

/** Build a sensor of the given type (numeric or text per the catalog). */
export function makeSensor(
  type: SensorType,
  opts: { x?: number; y?: number; value?: Rational | number | string } = {},
): Sensor {
  if (SENSORS[type].valueKind === 'number') {
    return new NumberSensor({
      x: opts.x,
      y: opts.y,
      sensorType: type,
      value: typeof opts.value === 'string' ? undefined : opts.value,
    });
  }
  return new TextSensor({
    x: opts.x,
    y: opts.y,
    sensorType: type,
    value: typeof opts.value === 'string' ? opts.value : undefined,
  });
}
