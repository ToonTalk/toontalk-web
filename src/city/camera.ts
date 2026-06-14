/**
 * A faithful port of ToonTalk's city camera (source/screen.cpp
 * update_viewing_region / screen_x / screen_y) and its coordinate system
 * (constant.h).
 *
 * Units are `city_coordinate`. `scale` is the original's zoom: GROUND_SCALE
 * (100) means one ideal-screen unit per city unit — i.e. the 32000×24000 ideal
 * screen exactly fills the view. `scale = 1000` (initial flying) shows 10× the
 * city. The view is centred on (cx, cy) and spans `IDEAL·scale/100` city units.
 *
 * World orientation matches the original `direction()` (utils.cpp:1 —
 * `delta_y > 0 → NORTH`): **+y is NORTH**. `screen.cpp` `screen_y` (1888) is a
 * **DIB coordinate** and Windows DIBs are bottom-up (row 0 = bottom — see the
 * "min_y → FG max_y" note, screen.cpp:1864), so city +y=NORTH displays at the
 * *top*. We render in Pixi's top-down space, so we flip y in projection
 * (`sy = h/2 − (y−cy)·pxPerUnit`); that flip *is* the DIB convention.
 *
 * Faithful to screen.cpp: `update_viewing_region` (1831 — `half_width =
 * ideal_w/200·scale`, `view.min = center − half`), `pixels_per_*_city_coordinate`
 * (182, 187), `screen_x/screen_y` (1869, 1888). We fit the ideal view to the
 * canvas by HEIGHT with a uniform pixels-per-unit (sprites stay square on any
 * aspect; a 4:3 canvas reproduces the 32000×24000 view exactly). Pure math —
 * unit-tested against those formulas. See `docs/port.md`.
 */
// Constants come from the faithful port of constant.h (src/port/constants.ts).
import {
  IDEAL_SCREEN_WIDTH,
  IDEAL_SCREEN_HEIGHT,
  GROUND_SCALE as GROUND_SCALE_CONST,
} from '../port/constants';
export const IDEAL_W = IDEAL_SCREEN_WIDTH; // constant.h:326
export const IDEAL_H = IDEAL_SCREEN_HEIGHT; // constant.h:327
export const GROUND_SCALE = GROUND_SCALE_CONST; // constant.h:337

export class Camera {
  cx = 0;
  cy = 0;
  scale = GROUND_SCALE;
  private w = 1;
  private h = 1;

  setViewport(w: number, h: number): void {
    this.w = w;
    this.h = h;
  }
  set(cx: number, cy: number, scale: number): void {
    this.cx = cx;
    this.cy = cy;
    this.scale = scale;
  }

  /** City units per screen pixel at the current scale (height-fit). At
   * GROUND_SCALE this maps the screen height onto IDEAL_H city units. */
  get unitsPerPixel(): number {
    return (IDEAL_H * this.scale) / (GROUND_SCALE * this.h);
  }
  get pxPerUnit(): number {
    return 1 / this.unitsPerPixel;
  }

  /** Project a world point to screen pixels. */
  sx(x: number): number {
    return this.w / 2 + (x - this.cx) * this.pxPerUnit;
  }
  sy(y: number): number {
    return this.h / 2 - (y - this.cy) * this.pxPerUnit; // +y north → up
  }
  /** A world length to a screen length. */
  s(len: number): number {
    return len * this.pxPerUnit;
  }

  /** Inverse projection (screen px → world), for input mapping. */
  ux(px: number): number {
    return this.cx + (px - this.w / 2) * this.unitsPerPixel;
  }
  uy(py: number): number {
    return this.cy - (py - this.h / 2) * this.unitsPerPixel;
  }

  /** Half the visible world extent (city units) in each axis. */
  get halfViewW(): number {
    return (this.w / 2) * this.unitsPerPixel;
  }
  get halfViewH(): number {
    return (this.h / 2) * this.unitsPerPixel;
  }
}
