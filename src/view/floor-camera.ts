/**
 * The floor "camera" for the working-floor view.
 *
 * The floor is a large work area (FLOOR_W × FLOOR_H) — bigger than the window —
 * that you scroll by sitting down at different spots (faithful to prgrmmr.cpp
 * `set_sit_corner`: sitting re-centres the floor on where you stood). `floorCamera`
 * is the world point shown at the top-left of the view: things render at
 * `world − camera` (thingLayer is panned by `−camera`), so things you leave on the
 * floor stay put in world coordinates, while the toolbox chrome stays on screen
 * (it "follows" you). All pointer↔world hit-testing adds `floorCamera`, so drag &
 * drop keeps working while scrolled.
 */
export const floorCamera = { x: 0, y: 0 };

/** The whole floor's extent in world units (larger than a typical window). */
export const FLOOR_W = 2400;
export const FLOOR_H = 1600;

/** Clamp a desired top-left camera to the floor's walls given the view size. */
export function clampFloorCamera(
  x: number,
  y: number,
  viewW: number,
  viewH: number,
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(Math.max(0, FLOOR_W - viewW), x)),
    y: Math.max(0, Math.min(Math.max(0, FLOOR_H - viewH), y)),
  };
}
