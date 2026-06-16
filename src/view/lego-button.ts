/**
 * The tool mode shown as a tiny 1×1 Lego plate (a single studded tile) carrying
 * the one-character mode label — a real Lego piece look, not a flat circle. It
 * sits ON the tool at a per-tool spot (Dusty's nose, the wand's tip, a little
 * below centre on Pumpy) via `addModeButton`.
 */
import * as PIXI from 'pixi.js';
import type { RenderTheme } from '../config/render-mode';

/** Where the mode plate sits on each tool, as a fraction of the sprite (the
 * sprite is anchored at its centre, so 0.5,0.5 is dead centre). */
export const MODE_BUTTON_FRAC: Record<string, [number, number]> = {
  dusty: [0.53, 0.16], // on Dusty's nose (the red 1×1 plate)
  wand: [0.78, 0.35], // at the wand's tip (the white knob/star)
  pumpy: [0.5, 0.62], // a little below centre, on the barrel
};

/** A 1×1 Lego plate (square tile + one stud) with the mode letter. */
export function legoButton(label: string, theme: RenderTheme, size = 24): PIXI.Container {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  const r = size / 2;
  g.beginFill(0xc99a06, 1); // darker edge
  g.drawRoundedRect(-r, -r, size, size, 3);
  g.endFill();
  g.beginFill(0xf4c20a, 1); // yellow plate top
  g.drawRoundedRect(-r, -r, size, size - 2, 3);
  g.endFill();
  g.beginFill(0xd9aa08, 1); // stud base
  g.drawCircle(0, -1, r * 0.66);
  g.endFill();
  g.beginFill(0xffe25a, 1); // stud top + highlight
  g.drawCircle(-r * 0.12, -r * 0.14 - 1, r * 0.5);
  g.endFill();
  c.addChild(g);
  const t = new PIXI.Text(label, {
    fontFamily: theme.fontFamily,
    fontSize: Math.round(size * 0.56),
    fill: 0x3a2a00,
    fontWeight: 'bold',
  });
  t.anchor.set(0.5);
  t.position.set(0, -1);
  c.addChild(t);
  return c;
}

/** Add the mode plate to `parent`, placed on the tool `kind`'s sprite (w×h). */
export function addModeButton(
  parent: PIXI.Container,
  label: string,
  theme: RenderTheme,
  kind: string,
  w: number,
  h: number,
): void {
  const b = legoButton(label, theme);
  const [fx, fy] = MODE_BUTTON_FRAC[kind] ?? [0.5, 0.5];
  b.position.set((fx - 0.5) * w, (fy - 0.5) * h);
  parent.addChild(b);
}
