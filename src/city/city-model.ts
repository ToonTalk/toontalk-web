/**
 * The ToonTalk city — pure model (no rendering).
 *
 * Faithful to the original C++ outdoor "programmer" state machine
 * (source/prgrmmr.cpp: Programmer_City_Flying / _Landing / _Walking) and the
 * city ground (source/city.cpp): a grid of blocks separated by streets, lawns
 * (green) with houses and trees, water beyond the city edge.
 *
 * You FLY a helicopter over the city (top-down, zoomed out by `scale`); pan with
 * the mouse, climb/descend to change altitude. Descend past the minimum and you
 * LAND (side view, the copter sinks to a street); step out and you WALK around
 * at ground level. Pressing the call-helicopter key while walking flies again.
 *
 * Units are abstract "city units"; the view maps them to pixels. `scale` is the
 * flying zoom: 1 = on the ground (1:1), higher = higher up / more zoomed out.
 */

/** 8 compass headings, in the original's Direction enum order (cycle index). */
export type Direction = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7; // E,SE,S,SW,W,NW,N,NE
export type CityMode = 'flying' | 'landing' | 'walking';
export type HouseStyle = 'a' | 'b' | 'c';

// --- city geometry --------------------------------------------------------
export const BLOCKS = 12; // blocks per axis
export const BLOCK = 600; // city units per block (lawn + its share of street)
export const STREET = 96; // street width between blocks
export const CITY_MIN = 0;
export const CITY_MAX = BLOCKS * BLOCK;

// --- flying altitude (scale) ---------------------------------------------
export const GROUND_SCALE = 1; // 1:1, on the ground
export const MIN_FLYING_SCALE = 1.25; // descend to here → land (source: min_flying_scale)
export const MAX_FLYING_SCALE = 16; // can't fly so high the city is sub-pixel
export const START_SCALE = 6; // initial altitude when flying begins
const SCALE_DOUBLE_MS = 750; // 3/4 second to double / halve (source)

// --- landing (normalized helicopter height: 1 = top of view, 0 = ground) --
const LAND_SPEED_PER_S = 0.9; // fraction of the descent per second under power

export interface House {
  bx: number;
  by: number;
  x: number; // city-unit centre
  y: number;
  style: HouseStyle;
}
export interface Tree {
  x: number;
  y: number;
}

/** Compass heading (0..7) for a movement delta, or null if not moving. */
export function directionFromDelta(dx: number, dy: number): Direction | null {
  if (dx === 0 && dy === 0) return null;
  // Screen coords: +x East, +y South. atan2 grows clockwise from East, matching
  // the enum order E,SE,S,SW,W,NW,N,NE.
  const a = Math.atan2(dy, dx); // -PI..PI
  const sector = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  return sector as Direction;
}

/** Grow (dir>0) or shrink (dir<0) the flying altitude over dt ms; clamped. */
export function nextScale(scale: number, dir: -1 | 0 | 1, dtMs: number): number {
  if (dir === 0) return scale;
  const ms = Math.min(dtMs, SCALE_DOUBLE_MS); // limit a single huge step
  const factor = Math.pow(2, (dir * ms) / SCALE_DOUBLE_MS);
  const next = scale * factor;
  return Math.max(MIN_FLYING_SCALE, Math.min(MAX_FLYING_SCALE, next));
}

/** Has the copter descended to the landing threshold? */
export function shouldLand(scale: number): boolean {
  return scale <= MIN_FLYING_SCALE;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Build the deterministic city: a checkerboard of houses with scattered trees. */
export function buildCity(): { houses: House[]; trees: Tree[] } {
  const houses: House[] = [];
  const trees: Tree[] = [];
  const styles: HouseStyle[] = ['a', 'b', 'c'];
  for (let bx = 0; bx < BLOCKS; bx++) {
    for (let by = 0; by < BLOCKS; by++) {
      const x = bx * BLOCK + BLOCK / 2;
      const y = by * BLOCK + BLOCK / 2;
      if ((bx + by) % 2 === 0) {
        houses.push({ bx, by, x, y, style: styles[(bx * 3 + by) % 3]! });
      } else {
        // a tree or two on the lawn blocks
        trees.push({ x: x - BLOCK * 0.18, y: y - BLOCK * 0.05 });
        if ((bx * by) % 3 === 0) trees.push({ x: x + BLOCK * 0.2, y: y + BLOCK * 0.18 });
      }
    }
  }
  return { houses, trees };
}

export class CityModel {
  mode: CityMode = 'flying';
  /** World centre the avatar is over (city units). */
  cx = CITY_MAX / 2;
  cy = CITY_MAX / 2;
  scale = START_SCALE;
  dir: Direction = 0;
  /** Normalized helicopter height while landing: 1 = top of view, 0 = ground. */
  landY = 1;
  readonly houses: House[];
  readonly trees: Tree[];

  constructor() {
    const c = buildCity();
    this.houses = c.houses;
    this.trees = c.trees;
  }

  /** Flying: pan by a screen delta (scaled by altitude) and climb/descend. */
  fly(panX: number, panY: number, altitude: -1 | 0 | 1, dtMs: number): void {
    if (this.mode !== 'flying') return;
    const d = directionFromDelta(panX, panY);
    if (d != null) this.dir = d;
    // pan distance grows with altitude (source: delta *= scale/ground_scale)
    this.cx = clamp(this.cx + panX * this.scale, CITY_MIN, CITY_MAX);
    this.cy = clamp(this.cy + panY * this.scale, CITY_MIN, CITY_MAX);
    this.scale = nextScale(this.scale, altitude, dtMs);
    if (shouldLand(this.scale)) {
      this.mode = 'landing';
      this.scale = GROUND_SCALE;
      this.landY = 1; // start near the top of the view
    }
  }

  /**
   * Landing: raise/lower the copter (dir +1 up, -1 down) over dt. Rising past
   * the top returns to flying; sinking to the ground steps out to walking.
   */
  land(dir: -1 | 0 | 1, dtMs: number): void {
    if (this.mode !== 'landing') return;
    this.landY = this.landY + dir * LAND_SPEED_PER_S * (dtMs / 1000);
    if (this.landY >= 1 && dir > 0) {
      this.mode = 'flying';
      this.scale = MIN_FLYING_SCALE; // just back up off the ground
      this.landY = 1;
    } else if (this.landY <= 0) {
      this.landY = 0;
      this.mode = 'walking';
    }
  }

  /** Walking: step by a screen delta at ground level; faces the heading. */
  walk(dx: number, dy: number): void {
    if (this.mode !== 'walking') return;
    const d = directionFromDelta(dx, dy);
    if (d != null) this.dir = d;
    this.cx = clamp(this.cx + dx, CITY_MIN, CITY_MAX);
    this.cy = clamp(this.cy + dy, CITY_MIN, CITY_MAX);
  }

  /** Walking → call the helicopter back and fly again (source: NEED_HELICOPTER). */
  callHelicopter(): void {
    if (this.mode !== 'walking') return;
    this.mode = 'flying';
    this.scale = MIN_FLYING_SCALE;
  }
}
