import { describe, it, expect } from 'vitest';
import { clampFloorCamera, FLOOR_W, FLOOR_H } from '../src/view/floor-camera';

// The floor is a large work area scrolled by sitting at different spots; the
// camera (top-left world point shown) is clamped to the floor's walls.
describe('clampFloorCamera', () => {
  it('clamps to the floor walls for the given view size', () => {
    const vw = 1280;
    const vh = 800;
    // a centred-ish target stays as-is
    expect(clampFloorCamera(500, 300, vw, vh)).toEqual({ x: 500, y: 300 });
    // past the left/top wall → 0
    expect(clampFloorCamera(-200, -50, vw, vh)).toEqual({ x: 0, y: 0 });
    // past the right/bottom wall → clamped to extent − view
    expect(clampFloorCamera(99999, 99999, vw, vh)).toEqual({
      x: FLOOR_W - vw,
      y: FLOOR_H - vh,
    });
  });

  it('never scrolls when the view is as large as the floor', () => {
    expect(clampFloorCamera(123, 456, FLOOR_W + 100, FLOOR_H + 100)).toEqual({ x: 0, y: 0 });
  });
});
