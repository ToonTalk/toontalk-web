/**
 * A tiny Lego "button" (a single stud) carrying a one-character mode label,
 * meant to sit ON a tool (wand / Dusty / Pumpy) rather than as a badge beneath
 * it. A small dark base ring + a bright blue stud top with a soft highlight, so
 * it reads as a raised Lego button.
 */
import * as PIXI from 'pixi.js';
import type { RenderTheme } from '../config/render-mode';

export function legoButton(label: string, theme: RenderTheme, radius = 12): PIXI.Container {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(0x16212b, 0.92); // dark base ring (seats the stud)
  g.drawCircle(0, 0, radius + 1.5);
  g.endFill();
  g.beginFill(0x2f7fd6, 1); // blue stud top
  g.drawCircle(0, 0, radius);
  g.endFill();
  g.beginFill(0xffffff, 0.4); // top-left highlight → raised look
  g.drawCircle(-radius * 0.32, -radius * 0.32, radius * 0.42);
  g.endFill();
  c.addChild(g);
  const t = new PIXI.Text(label, {
    fontFamily: theme.fontFamily,
    fontSize: radius + 2,
    fill: 0xffffff,
    fontWeight: 'bold',
  });
  t.anchor.set(0.5);
  c.addChild(t);
  return c;
}
