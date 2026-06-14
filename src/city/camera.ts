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
 * World orientation matches the original `direction()` (utils.cpp): **+y is
 * NORTH (up)**. Screen y grows downward, so the camera flips y in projection.
 *
 * We fit the ideal view to the canvas by HEIGHT with a uniform pixels-per-unit
 * (so sprites stay square on any window aspect; a 4:3 canvas reproduces the
 * original's 32000×24000 view exactly). Pure math — unit-tested against the
 * screen.cpp formulas.
 */
export const IDEAL_W = 32000; // constant.h ideal_screen_width
export const IDEAL_H = 24000; // constant.h ideal_screen_height
export const GROUND_SCALE = 100; // constant.h ground_scale (100% = on the ground)

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
