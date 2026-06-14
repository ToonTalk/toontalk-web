import { describe, it, expect } from 'vitest';
import {
  CityModel,
  directionFromDelta,
  dampenTurn,
  growValue,
  shrinkValue,
  buildCity,
  lotX,
  lotY,
  type Direction,
  MAX_FLYING_SCALE,
  GROUND_SCALE,
  INITIAL_SCALE,
  LIFTOFF_SCALE,
  BLOCK_W,
  BLOCK_H,
  BLOCKS_X,
  BLOCKS_Y,
  CITY_W,
  CITY_H,
  DOOR_REACH,
  DOOR_DEPTH,
  roadYFor,
} from '../src/city/city-model';

describe('directionFromDelta (utils.cpp direction, +y = NORTH)', () => {
  it('maps the 8 headings in enum order E,SE,S,SW,W,NW,N,NE', () => {
    expect(directionFromDelta(1, 0)).toBe(0); // E
    expect(directionFromDelta(1, -1)).toBe(1); // SE (south = −y)
    expect(directionFromDelta(0, -1)).toBe(2); // S
    expect(directionFromDelta(-1, -1)).toBe(3); // SW
    expect(directionFromDelta(-1, 0)).toBe(4); // W
    expect(directionFromDelta(-1, 1)).toBe(5); // NW
    expect(directionFromDelta(0, 1)).toBe(6); // N (north = +y)
    expect(directionFromDelta(1, 1)).toBe(7); // NE
  });
  it('returns null when not moving', () => {
    expect(directionFromDelta(0, 0)).toBeNull();
  });
});

describe('dampenTurn (utils.cpp): steps one of 8 the short way', () => {
  it('turns gradually toward the target, never snapping', () => {
    expect(dampenTurn(2, 0)).toBe(1); // E→S goes via SE
    expect(dampenTurn(6, 0)).toBe(7); // E→N goes the short way via NE
    expect(dampenTurn(0, 0)).toBe(0); // already there
  });
});

describe('grow/shrink value (¾ s to double/halve)', () => {
  it('doubles up, halves down over 750 ms', () => {
    expect(growValue(100, 750)).toBeCloseTo(200, 5);
    expect(shrinkValue(200, 750)).toBeCloseTo(100, 5);
    expect(growValue(100, 0)).toBe(100);
  });
});

describe('buildCity (city.cpp build_initial_houses)', () => {
  it('the city is rectangular (3×3 wide-short blocks)', () => {
    expect(CITY_W).toBe(BLOCKS_X * BLOCK_W);
    expect(CITY_H).toBe(BLOCKS_Y * BLOCK_H);
    expect(CITY_W).toBeGreaterThan(CITY_H);
  });
  it('starts with exactly THREE houses, styles A,B,C, on centre-block lots', () => {
    const { houses } = buildCity();
    expect(houses).toHaveLength(3);
    expect(houses.map((h) => h.style)).toEqual(['a', 'b', 'c']);
    const bx = Math.floor(BLOCKS_X / 2);
    houses.forEach((h, i) => {
      expect(h.x).toBeCloseTo(lotX(bx, i));
      expect(h.y).toBeCloseTo(lotY(Math.floor(BLOCKS_Y / 2)));
    });
    expect(houses[0]!.x).toBeLessThan(houses[1]!.x);
  });
  it('has no trees by default; opt-in adds them', () => {
    expect(buildCity().trees).toHaveLength(0);
    expect(buildCity(true).trees.length).toBeGreaterThan(0);
  });
});

describe('CityModel flying (Programmer_City_Flying::react)', () => {
  it('boots flying at INITIAL_SCALE, centred', () => {
    const m = new CityModel();
    expect(m.mode).toBe('flying');
    expect(m.scale).toBe(INITIAL_SCALE);
    expect(m.cx).toBeCloseTo(CITY_W / 2);
  });

  it('climbs (scale grows) and descends (scale shrinks), clamped', () => {
    const m = new CityModel();
    m.scale = 400;
    m.fly(0, 0, 1, 750);
    expect(m.scale).toBeCloseTo(800, 0);
    m.fly(0, 0, -1, 750);
    expect(m.scale).toBeCloseTo(400, 0);
    m.scale = MAX_FLYING_SCALE;
    m.fly(0, 0, 1, 750);
    expect(m.scale).toBe(MAX_FLYING_SCALE); // clamped
  });

  it('pans by world deltas and eases the heading', () => {
    const m = new CityModel();
    const x0 = m.cx;
    m.fly(BLOCK_W, 0, 0, 16); // a big eastward world step
    expect(m.cx).toBeCloseTo(x0 + BLOCK_W);
    expect(m.dir).toBe(0); // East (eased one step from East = East)
  });

  it('descending to the minimum switches to landing on a street', () => {
    const m = new CityModel();
    m.scale = GROUND_SCALE * 1.1;
    let guard = 0;
    while (m.mode === 'flying' && guard++ < 100) m.fly(0, 0, -1, 200);
    expect(m.mode).toBe('landing');
    expect(m.scale).toBe(GROUND_SCALE);
    expect(m.streetY % BLOCK_H).toBe(0);
    expect(m.cy).toBe(m.streetY);
  });
});

describe('CityModel landing / walking / room', () => {
  it('landing: touching the street parks the copter and steps out walking', () => {
    const m = new CityModel();
    m.mode = 'landing';
    m.landY = 1;
    m.cx = 123456;
    let guard = 0;
    while (m.mode === 'landing' && guard++ < 1000) m.land(-1, 100);
    expect(m.mode).toBe('walking');
    expect(m.landX).toBe(123456);
    expect(m.cx).toBeGreaterThan(m.landX);
  });

  it('walking roams the whole city north–south; nearby copter / H flies again', () => {
    const m = new CityModel();
    m.mode = 'walking';
    m.cy = BLOCK_H;
    m.streetY = roadYFor(m.cy);
    m.walk(0, 9_999_999); // far north
    expect(m.cy).toBe(CITY_H); // roams clear to the city's north edge
    expect((m.dir as Direction)).toBe(6); // North
    expect(m.streetY % BLOCK_H).toBe(0); // current road tracks the block we're in
    m.callHelicopter();
    expect(m.mode).toBe('flying');
    expect(m.scale).toBe(LIFTOFF_SCALE);
  });

  it('walking back into the parked copter takes off', () => {
    const m = new CityModel();
    m.mode = 'landing';
    m.cx = 300000;
    m.cy = 224000;
    let guard = 0;
    while (m.mode === 'landing' && guard++ < 1000) m.land(-1, 100);
    expect(m.mode).toBe('walking');
    expect(m.nearHelicopter()).toBe(false); // stepped out clear of it
    m.cx = m.parkedX; // walk back to it
    m.cy = m.parkedY;
    expect(m.nearHelicopter()).toBe(true);
  });

  it('enterHouse at a door → room standing; walkInside leaves or sits', () => {
    const m = new CityModel();
    m.mode = 'walking';
    const h = m.houses[1]!;
    m.cx = h.x; // standing at the house's door
    m.cy = h.y;
    expect(m.enterHouse()).toBe(true);
    expect(m.mode).toBe('inside');
    expect(m.walkInside(0, 0.6)).toBe('sit'); // to the floor front
    m.mode = 'inside';
    m.insideHouse = h;
    m.ix = 0.5;
    expect(m.walkInside(-1, 0)).toBe('leave'); // out a side wall
    expect(m.mode).toBe('walking');
  });

  it('enter only at the narrow door (gated in BOTH x and y)', () => {
    const m = new CityModel();
    m.mode = 'walking';
    const h = m.houses[1]!;
    m.cx = h.x;
    m.cy = h.y; // at the door
    expect(m.enterableHouse()).toBe(h);
    m.cx = h.x + DOOR_REACH + 1; // beside the door → no entry
    expect(m.enterableHouse()).toBeNull();
    m.cx = h.x;
    m.cy = h.y + DOOR_DEPTH + 1; // not standing at the front → no entry
    expect(m.enterableHouse()).toBeNull();
  });
});
