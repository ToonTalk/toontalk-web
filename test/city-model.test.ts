import { describe, it, expect } from 'vitest';
import {
  CityModel,
  directionFromDelta,
  nextScale,
  shouldLand,
  buildCity,
  MIN_FLYING_SCALE,
  MAX_FLYING_SCALE,
  GROUND_SCALE,
  START_SCALE,
  CITY_MIN,
  CITY_MAX,
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
    expect(nextScale(2, 1, 750)).toBeCloseTo(4, 5);
    expect(nextScale(4, -1, 750)).toBeCloseTo(2, 5);
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

describe('buildCity', () => {
  it('produces a deterministic non-empty city of houses and trees', () => {
    const a = buildCity();
    const b = buildCity();
    expect(a.houses.length).toBeGreaterThan(0);
    expect(a.trees.length).toBeGreaterThan(0);
    expect(a.houses.length).toBe(b.houses.length); // deterministic
    for (const h of a.houses) {
      expect(h.x).toBeGreaterThan(CITY_MIN);
      expect(h.x).toBeLessThan(CITY_MAX);
    }
  });
});

describe('CityModel state machine', () => {
  it('starts flying at START_SCALE, centred in the city', () => {
    const m = new CityModel();
    expect(m.mode).toBe('flying');
    expect(m.scale).toBe(START_SCALE);
    expect(m.cx).toBeCloseTo(CITY_MAX / 2);
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

  it('descending to the minimum switches to landing at ground scale', () => {
    const m = new CityModel();
    let guard = 0;
    while (m.mode === 'flying' && guard++ < 1000) m.fly(0, 0, -1, 100);
    expect(m.mode).toBe('landing');
    expect(m.scale).toBe(GROUND_SCALE);
    expect(m.landY).toBe(1);
  });

  it('landing: sinking to the ground steps out to walking', () => {
    const m = new CityModel();
    m.mode = 'landing';
    m.landY = 1;
    let guard = 0;
    while (m.mode === 'landing' && guard++ < 1000) m.land(-1, 100);
    expect(m.mode).toBe('walking');
    expect(m.landY).toBe(0);
  });

  it('landing: rising past the top returns to flying', () => {
    const m = new CityModel();
    m.mode = 'landing';
    m.landY = 0.9;
    let guard = 0;
    while (m.mode === 'landing' && guard++ < 1000) m.land(1, 100);
    expect(m.mode).toBe('flying');
    expect(m.scale).toBe(MIN_FLYING_SCALE);
  });

  it('walking moves 1:1, faces heading, and clamps to the city extent', () => {
    const m = new CityModel();
    m.mode = 'walking';
    m.cx = CITY_MIN + 1;
    m.cy = 5000;
    m.walk(-50, 0);
    expect(m.cx).toBe(CITY_MIN); // clamped
    expect(m.dir).toBe(4); // West
  });

  it('calling the helicopter while walking flies again', () => {
    const m = new CityModel();
    m.mode = 'walking';
    m.callHelicopter();
    expect(m.mode).toBe('flying');
    expect(m.scale).toBe(MIN_FLYING_SCALE);
  });

  it('mode guards: walk/land/fly only act in their own mode', () => {
    const m = new CityModel(); // flying
    const x0 = m.cx;
    m.walk(100, 0);
    expect(m.cx).toBe(x0); // walk ignored while flying
    m.land(-1, 100);
    expect(m.mode).toBe('flying'); // land ignored while flying
  });
});
