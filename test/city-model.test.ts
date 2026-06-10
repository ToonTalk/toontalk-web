import { describe, it, expect } from 'vitest';
import {
  CityModel,
  directionFromDelta,
  nextScale,
  shouldLand,
  buildCity,
  nearestStreetY,
  MIN_FLYING_SCALE,
  MAX_FLYING_SCALE,
  GROUND_SCALE,
  START_SCALE,
  LIFTOFF_SCALE,
  BLOCK_W,
  BLOCK_H,
  CITY_W,
  CITY_H,
} from '../src/city/city-model';

describe('directionFromDelta', () => {
  it('maps the 8 compass headings in enum order E,SE,S,SW,W,NW,N,NE', () => {
    expect(directionFromDelta(1, 0)).toBe(0); // E
    expect(directionFromDelta(1, 1)).toBe(1); // SE (screen y-down)
    expect(directionFromDelta(0, 1)).toBe(2); // S
    expect(directionFromDelta(-1, 1)).toBe(3); // SW
    expect(directionFromDelta(-1, 0)).toBe(4); // W
    expect(directionFromDelta(-1, -1)).toBe(5); // NW
    expect(directionFromDelta(0, -1)).toBe(6); // N
    expect(directionFromDelta(1, -1)).toBe(7); // NE
  });
  it('returns null when not moving', () => {
    expect(directionFromDelta(0, 0)).toBeNull();
  });
});

describe('nextScale', () => {
  it('doubles in ~0.75s going up, halves going down', () => {
    expect(nextScale(1.8, 1, 750)).toBeCloseTo(3.6, 5);
    expect(nextScale(3.6, -1, 750)).toBeCloseTo(1.8, 5);
  });
  it('holds when altitude is 0', () => {
    expect(nextScale(3, 0, 750)).toBe(3);
  });
  it('clamps to [MIN, MAX]', () => {
    expect(nextScale(MAX_FLYING_SCALE, 1, 750)).toBe(MAX_FLYING_SCALE);
    expect(nextScale(MIN_FLYING_SCALE, -1, 750)).toBe(MIN_FLYING_SCALE);
  });
});

describe('shouldLand', () => {
  it('is true only at/below the minimum flying scale', () => {
    expect(shouldLand(MIN_FLYING_SCALE)).toBe(true);
    expect(shouldLand(MIN_FLYING_SCALE + 0.01)).toBe(false);
  });
});

describe('buildCity (faithful: city.cpp build_initial_houses)', () => {
  it('the city is rectangular (wider than tall)', () => {
    expect(CITY_W).toBeGreaterThan(CITY_H);
  });

  it('starts with exactly THREE houses, styles A, B, C', () => {
    const { houses } = buildCity();
    expect(houses).toHaveLength(3);
    expect(houses.map((h) => h.style)).toEqual(['a', 'b', 'c']);
  });

  it('the houses sit on consecutive lots of the centre block', () => {
    const { houses } = buildCity();
    for (const h of houses) {
      expect(h.x).toBeGreaterThan(BLOCK_W); // inside the middle column
      expect(h.x).toBeLessThan(2 * BLOCK_W);
      expect(h.y).toBeGreaterThan(BLOCK_H); // inside the middle row
      expect(h.y).toBeLessThan(2 * BLOCK_H);
    }
    // left-to-right order, distinct lots
    expect(houses[0]!.x).toBeLessThan(houses[1]!.x);
    expect(houses[1]!.x).toBeLessThan(houses[2]!.x);
  });

  it('is deterministic', () => {
    expect(buildCity()).toEqual(buildCity());
  });
});

describe('nearestStreetY', () => {
  it('snaps to the nearest horizontal block boundary, clamped to the city', () => {
    expect(nearestStreetY(0)).toBe(0);
    expect(nearestStreetY(BLOCK_H * 1.4)).toBe(BLOCK_H);
    expect(nearestStreetY(BLOCK_H * 1.6)).toBe(2 * BLOCK_H);
    expect(nearestStreetY(99999)).toBe(CITY_H);
  });
});

describe('CityModel state machine', () => {
  it('starts flying at START_SCALE, centred in the city', () => {
    const m = new CityModel();
    expect(m.mode).toBe('flying');
    expect(m.scale).toBe(START_SCALE);
    expect(m.cx).toBeCloseTo(CITY_W / 2);
    expect(m.cy).toBeCloseTo(CITY_H / 2);
  });

  it('pans (scaled by altitude) and faces the heading while flying', () => {
    const m = new CityModel();
    const x0 = m.cx;
    m.fly(1, 0, 0, 16);
    expect(m.cx).toBeCloseTo(x0 + 1 * START_SCALE);
    expect(m.dir).toBe(0); // East
    m.fly(0, -1, 0, 16);
    expect(m.dir).toBe(6); // North
  });

  it('descending to the minimum switches to the street view, snapped to a street', () => {
    const m = new CityModel();
    m.cy = BLOCK_H * 2.1; // near the y=1200 street
    let guard = 0;
    while (m.mode === 'flying' && guard++ < 1000) m.fly(0, 0, -1, 100);
    expect(m.mode).toBe('landing');
    expect(m.scale).toBe(GROUND_SCALE);
    expect(m.landY).toBe(1);
    expect(m.cy).toBe(m.streetY);
    expect(m.streetY % BLOCK_H).toBe(0);
    expect(m.landX).toBe(m.cx);
  });

  it('landing: touching the street parks the copter and steps out to walking', () => {
    const m = new CityModel();
    m.mode = 'landing';
    m.landY = 1;
    m.cx = 1234;
    let guard = 0;
    while (m.mode === 'landing' && guard++ < 1000) m.land(-1, 100);
    expect(m.mode).toBe('walking');
    expect(m.landY).toBe(0);
    expect(m.landX).toBe(1234); // the copter stays where it touched down
    expect(m.cx).toBeGreaterThan(m.landX); // the person stepped out beside it
  });

  it('landing: rising past the top returns to flying at liftoff altitude', () => {
    const m = new CityModel();
    m.mode = 'landing';
    m.landY = 0.9;
    let guard = 0;
    while (m.mode === 'landing' && guard++ < 1000) m.land(1, 100);
    expect(m.mode).toBe('flying');
    expect(m.scale).toBe(LIFTOFF_SCALE);
  });

  it('walking moves along the street (E/W) and clamps to the city extent', () => {
    const m = new CityModel();
    m.mode = 'walking';
    m.cx = 30;
    m.landX = 30;
    m.walk(-50);
    expect(m.cx).toBe(0); // clamped at the west edge
    expect(m.dir).toBe(4); // West
    m.walk(120);
    expect(m.cx).toBe(120);
    expect(m.dir).toBe(0); // East
    expect(m.landX).toBe(30); // the parked copter did not move
  });

  it('calling the helicopter while walking flies again', () => {
    const m = new CityModel();
    m.mode = 'walking';
    m.callHelicopter();
    expect(m.mode).toBe('flying');
    expect(m.scale).toBe(LIFTOFF_SCALE);
  });

  it('mode guards: walk/land/fly only act in their own mode', () => {
    const m = new CityModel(); // flying
    const x0 = m.cx;
    m.walk(100);
    expect(m.cx).toBe(x0); // walk ignored while flying
    m.land(-1, 100);
    expect(m.mode).toBe('flying'); // land ignored while flying
  });
});
