/**
 * The training thought bubble (robot.htm: "drop a box on him… you enter into
 * the robot's thoughts"). A soft cloud drawn around the box being demonstrated
 * on, with a trail of shrinking puffs rising toward the trainee robot — so the
 * box reads as "in his thoughts" while you teach. Purely cosmetic: main creates
 * it on train start (positioned at the box's world coords, behind it) and
 * removes it on finish/cancel.
 */
import * as PIXI from 'pixi.js';

const FILL = 0xeaf3ff; // pale thought-cloud blue
const LINE = 0x6f9fd8;

/**
 * @param boxW,boxH  the box's rendered size (the cloud sits a little larger).
 * @param dx,dy      vector from the box to the robot (the puffs trail that way).
 */
export function makeTrainingBubble(boxW: number, boxH: number, dx: number, dy: number): PIXI.Container {
  const c = new PIXI.Container();
  c.eventMode = 'none';

  const rx = boxW / 2 + 40;
  const ry = boxH / 2 + 34;

  // Body: a translucent cloud the box shows through, with a soft scalloped edge.
  const body = new PIXI.Graphics();
  body.lineStyle(3, LINE, 0.9);
  body.beginFill(FILL, 0.18);
  body.drawEllipse(0, 0, rx, ry);
  body.endFill();
  // Scalloped bumps around the rim (filled, so the rim reads as a cloud, not an
  // ellipse) — opaque to avoid alpha build-up where they overlap.
  const puffs = 16;
  for (let i = 0; i < puffs; i++) {
    const t = (i / puffs) * Math.PI * 2;
    const pr = 15 + (i % 2 === 0 ? 5 : 0);
    body.lineStyle(3, LINE, 0.9);
    body.beginFill(FILL, 1);
    body.drawCircle(Math.cos(t) * rx, Math.sin(t) * ry, pr);
    body.endFill();
  }
  c.addChild(body);

  // Trail: three shrinking puffs from the cloud edge toward the robot.
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  let dist = Math.max(rx, ry) + 8;
  let r = 14;
  const trail = new PIXI.Graphics();
  for (let i = 0; i < 3; i++) {
    trail.lineStyle(3, LINE, 0.9);
    trail.beginFill(FILL, 1);
    trail.drawCircle(ux * dist, uy * dist, r);
    trail.endFill();
    dist += r + 9;
    r *= 0.62;
  }
  c.addChild(trail);

  return c;
}
