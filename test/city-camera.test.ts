import { describe, it, expect } from 'vitest';
import { Camera, IDEAL_W, IDEAL_H, GROUND_SCALE } from '../src/city/camera';

describe('Camera (port of screen.cpp projection)', () => {
  it('at GROUND_SCALE a 4:3 canvas shows exactly the ideal screen', () => {
    const cam = new Camera();
    cam.setViewport(640, 480); // 4:3
    cam.set(0, 0, GROUND_SCALE);
    // the centre maps to the screen centre
    expect(cam.sx(0)).toBeCloseTo(320);
    expect(cam.sy(0)).toBeCloseTo(240);
    // half the ideal screen reaches the edges
    expect(cam.sx(IDEAL_W / 2)).toBeCloseTo(640);
    expect(cam.sx(-IDEAL_W / 2)).toBeCloseTo(0);
    // +y is NORTH → top of the screen
    expect(cam.sy(IDEAL_H / 2)).toBeCloseTo(0);
    expect(cam.sy(-IDEAL_H / 2)).toBeCloseTo(480);
  });

  it('scale sets how much city fits: 1000 shows 10× the height of 100', () => {
    const cam = new Camera();
    cam.setViewport(640, 480);
    cam.set(0, 0, 100);
    const u100 = cam.unitsPerPixel;
    cam.set(0, 0, 1000);
    expect(cam.unitsPerPixel).toBeCloseTo(u100 * 10, 6);
    // at scale 1000 the visible height is 10 ideal screens
    expect(cam.halfViewH * 2).toBeCloseTo((IDEAL_H * 1000) / GROUND_SCALE, 0);
  });

  it('projection round-trips through unproject', () => {
    const cam = new Camera();
    cam.setViewport(1280, 800);
    cam.set(50000, 30000, 600);
    for (const [x, y] of [[50000, 30000], [12345, 98765], [0, 0]] as const) {
      expect(cam.ux(cam.sx(x))).toBeCloseTo(x, 3);
      expect(cam.uy(cam.sy(y))).toBeCloseTo(y, 3);
    }
  });

  it('panning the centre scrolls the world under a fixed screen point', () => {
    const cam = new Camera();
    cam.setViewport(640, 480);
    cam.set(0, 0, 300);
    const before = cam.sx(10000);
    cam.set(5000, 0, 300); // camera moves east
    expect(cam.sx(10000)).toBeLessThan(before); // the point shifts west on screen
  });
});
