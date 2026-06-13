/**
 * The ToonTalk city — pure model (no rendering).
 *
 * Faithful to the original C++ outdoor "programmer" state machine
 * (source/prgrmmr.cpp: Programmer_City_Flying / _Landing / _Walking) and the
 * city itself (source/city.cpp):
 *  - the default city is 3×3 blocks ("small enough that it's hard to get lost
 *    exploring", city.cpp:91), each block wider than tall, so the city reads
 *    as a rectangle;
 *  - `build_initial_houses` builds exactly THREE houses, on consecutive lots
 *    of the centre block, styles cycling A, B, C (city.cpp:178-216).
 *
 * You FLY the helicopter top-down (zoomed out by `scale`); descend to the
 * minimum and the view switches to the HORIZONTAL street view: the helicopter
 * (side-view art) sinks toward the street. On touchdown the copter parks and
 * you WALK the street — still in the side view — with Tooly the toolbox
 * following. Pressing the call-helicopter key flies again.
 *
 * Units are abstract "city units"; the view maps them to pixels. `scale` is the
 * flying zoom: 1 = on the ground, higher = higher up / more zoomed out.
 */

/** 8 compass headings, in the original's Direction enum order (cycle index). */
export type Direction = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7; // E,SE,S,SW,W,NW,N,NE
export type CityMode = 'flying' | 'landing' | 'walking';
export type HouseStyle = 'a' | 'b' | 'c';

// --- city geometry (rectangular: 4:3 blocks, 3×3 of them) -----------------
export const BLOCKS_X = 3;
export const BLOCKS_Y = 3;
export const BLOCK_W = 800; // city units
export const BLOCK_H = 600;
export const STREET = 80; // street width drawn on block boundaries
export const CITY_W = BLOCKS_X * BLOCK_W; // 2400
export const CITY_H = BLOCKS_Y * BLOCK_H; // 1800

// --- flying altitude (scale) ----------------------------------------------
export const GROUND_SCALE = 1; // 1:1, on the ground
export const MIN_FLYING_SCALE = 1.25; // descend to here → switch to the street view
export const MAX_FLYING_SCALE = 4; // high enough to see the whole city
export const START_SCALE = 2.5; // initial altitude when flying begins
export const LIFTOFF_SCALE = 2; // altitude on takeoff (clear of the landing threshold)
const SCALE_DOUBLE_MS = 750; // 3/4 second to double / halve (source)

// --- landing (normalized helicopter height: 1 = top of view, 0 = street) --
const LAND_SPEED_PER_S = 0.9; // fraction of the descent per second under power

// --- walking (the street view is walkable in BOTH axes) ---------------------
/** How far north of the street centre you can walk (up to the house fronts). */
export const WALK_BAND_N = 95;
/** How far south (down the street, toward the viewer). */
export const WALK_BAND_S = 45;
/** Walking this far north while in front of a house door enters it. */
export const ENTER_DEPTH = 80;
/** Horizontal reach of a house's door / of the parked copter's cabin. */
export const DOOR_REACH = 60;

export interface House {
  x: number; // city-unit centre of the lot
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

/** Has the copter descended to the street-view threshold? */
export function shouldLand(scale: number): boolean {
  return scale <= MIN_FLYING_SCALE;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** The horizontal street (block boundary y) nearest to a city y. */
export function nearestStreetY(cy: number): number {
  return clamp(Math.round(cy / BLOCK_H), 0, BLOCKS_Y) * BLOCK_H;
}

/**
 * Build the city the original starts with: THREE houses on consecutive lots of
 * the centre block (styles A, B, C — build_initial_houses), facing the street
 * below them. Trees are a web extra (not in the original city) — off by
 * default, opt in with `withTrees`.
 */
export function buildCity(withTrees = false): { houses: House[]; trees: Tree[] } {
  const styles: HouseStyle[] = ['a', 'b', 'c'];
  const bx = Math.floor(BLOCKS_X / 2); // centre block
  const by = Math.floor(BLOCKS_Y / 2);
  const houses: House[] = styles.map((style, i) => ({
    x: bx * BLOCK_W + ((i + 0.5) * BLOCK_W) / 3,
    y: by * BLOCK_H + BLOCK_H * 0.62, // near the block's south edge → front street
    style,
  }));
  const trees: Tree[] = withTrees
    ? [
        { x: 0.4 * BLOCK_W, y: 0.5 * BLOCK_H },
        { x: 2.5 * BLOCK_W, y: 0.4 * BLOCK_H },
        { x: 0.55 * BLOCK_W, y: 2.45 * BLOCK_H },
        { x: 2.4 * BLOCK_W, y: 2.6 * BLOCK_H },
        { x: 1.2 * BLOCK_W, y: 2.5 * BLOCK_H },
      ]
    : [];
  return { houses, trees };
}

export class CityModel {
  mode: CityMode = 'flying';
  /** World position the avatar is over / at (city units). */
  cx = CITY_W / 2;
  cy = CITY_H / 2;
  scale = START_SCALE;
  dir: Direction = 0;
  /** Normalized helicopter height while landing: 1 = top of view, 0 = street. */
  landY = 1;
  /** The horizontal street the copter is landing on / the walker stands on. */
  streetY = nearestStreetY(CITY_H / 2);
  /** Where the helicopter parked (world x) — it stays there while you walk. */
  landX = CITY_W / 2;
  readonly houses: House[];
  readonly trees: Tree[];

  constructor(opts: { trees?: boolean } = {}) {
    const c = buildCity(opts.trees ?? false);
    this.houses = c.houses;
    this.trees = c.trees;
  }

  /** Flying: pan by a screen delta (scaled by altitude) and climb/descend. */
  fly(panX: number, panY: number, altitude: -1 | 0 | 1, dtMs: number): void {
    if (this.mode !== 'flying') return;
    const d = directionFromDelta(panX, panY);
    if (d != null) this.dir = d;
    // pan distance grows with altitude (source: delta *= scale/ground_scale)
    this.cx = clamp(this.cx + panX * this.scale, 0, CITY_W);
    this.cy = clamp(this.cy + panY * this.scale, 0, CITY_H);
    this.scale = nextScale(this.scale, altitude, dtMs);
    if (shouldLand(this.scale)) {
      // Switch to the horizontal street view: snap to the nearest street and
      // start the copter near the top of the view (Programmer_City_Landing).
      this.mode = 'landing';
      this.scale = GROUND_SCALE;
      this.landY = 1;
      this.streetY = nearestStreetY(this.cy);
      this.cy = this.streetY;
      this.landX = this.cx;
    }
  }

  /**
   * Landing (side view): raise/lower the copter (dir +1 up, -1 down) over dt,
   * optionally drifting along the street (`driftX`, city units — the original
   * scrolls its min_x/max_x window as you drift, prgrmmr.cpp:4350). `dLandY`
   * adds direct height change (mouse-driven, on top of the held direction).
   * Rising past the top returns to flying; touching the street parks the
   * copter (at landX) and steps out to walking.
   */
  land(dir: -1 | 0 | 1, dtMs: number, driftX = 0, dLandY = 0): void {
    if (this.mode !== 'landing') return;
    if (driftX !== 0) this.cx = clamp(this.cx + driftX, 0, CITY_W);
    this.landY = this.landY + dir * LAND_SPEED_PER_S * (dtMs / 1000) + dLandY;
    if (this.landY > 1 && dir >= 0 && dLandY > 0) {
      // mouse-flown past the top → airborne again
      this.mode = 'flying';
      this.scale = LIFTOFF_SCALE;
      this.landY = 1;
      return;
    }
    this.landY = Math.min(this.landY, 1.05);
    if (this.landY >= 1 && dir > 0) {
      this.mode = 'flying';
      this.scale = LIFTOFF_SCALE; // climb clear of the landing threshold
      this.landY = 1;
    } else if (this.landY <= 0) {
      this.landY = 0;
      this.landX = this.cx; // the copter parks here
      this.cx = clamp(this.landX + 70, 0, CITY_W); // step out beside the door
      this.mode = 'walking';
    }
  }

  /**
   * Walking (street view): step in BOTH axes (the original walker is fully
   * 8-directional — Programmer_City_Walking). `dy` > 0 is south (toward the
   * viewer); north is clamped at the house fronts, south at the street edge.
   */
  walk(dx: number, dy = 0): void {
    if (this.mode !== 'walking' || (dx === 0 && dy === 0)) return;
    const d = directionFromDelta(dx, dy);
    if (d != null) this.dir = d;
    this.cx = clamp(this.cx + dx, 0, CITY_W);
    this.cy = clamp(this.cy + dy, this.streetY - WALK_BAND_N, this.streetY + WALK_BAND_S);
  }

  /**
   * The house whose door the walker has walked up to (deep enough north and
   * within the door's reach), or null. The scene enters it.
   */
  enterableHouse(): House | null {
    if (this.mode !== 'walking') return null;
    if (this.cy > this.streetY - ENTER_DEPTH) return null;
    return this.houses.find((h) => Math.abs(this.cx - h.x) <= DOOR_REACH) ?? null;
  }

  /**
   * Walking into the parked copter boards it and starts the take-off: back to
   * the landing state, just off the ground (the scene auto-rises briefly).
   * Returns whether boarding happened.
   */
  boardHelicopter(): boolean {
    if (this.mode !== 'walking') return false;
    if (Math.abs(this.cx - this.landX) > DOOR_REACH) return false;
    if (this.cy < this.streetY - 40) return false; // up at the houses, not at the copter
    this.cx = this.landX;
    this.cy = this.streetY;
    this.landY = 0.05;
    this.mode = 'landing';
    return true;
  }

  /** Return to the street after a sit / house visit, clear of any doorway. */
  standUp(): void {
    if (this.mode !== 'walking') return;
    this.cy = this.streetY; // back on the street centreline
  }

  /** Walking → call the helicopter back and fly again (source: NEED_HELICOPTER). */
  callHelicopter(): void {
    if (this.mode !== 'walking') return;
    this.mode = 'flying';
    this.scale = LIFTOFF_SCALE;
  }
}
