/**
 * The tool mode shown as the real 1×1 Lego plate button from the original art —
 * VACBTN (Dusty), PUMPBTN (Pumpy), WANDBTN (wand) — with the mode letter on top.
 * Placed ON the tool at a per-tool spot (`MODE_BUTTON_FRAC`): Dusty's nose, the
 * wand's handle end, a little below centre on Pumpy. A drawn plate is the
 * fallback if the button bitmap is missing.
 */
import * as PIXI from 'pixi.js';
import type { RenderTheme } from '../config/render-mode';

/** Tool kind → its button-plate texture key. */
const BUTTON_TEX: Record<string, string> = {
  dusty: 'vacbtn',
  pumpy: 'pumpbtn',
  wand: 'wandbtn',
};

/** Where the mode plate sits on each tool, as a fraction of the sprite (the
 * sprite is anchored at its centre, so 0.5,0.5 is dead centre). */
export const MODE_BUTTON_FRAC: Record<string, [number, number]> = {
  dusty: [0.531, 0.18], // on Dusty's nose (the red blob — measured centroid)
  wand: [0.06, 0.4], // at the wand's handle end (the original shows it there)
  pumpy: [0.5, 0.62], // a little below centre, on the barrel
};

/** A tool's BUSINESS END as a fraction of its sprite — the point that should sit
 * under the cursor / on the action reticle when the tool is held, so aiming the
 * tip is what gets clicked: Dusty's nose, the wand's star, Pumpy's centre. */
export const TOOL_TIP_FRAC: Record<string, [number, number]> = {
  dusty: [0.531, 0.18], // the nose (same red blob the mode plate marks)
  wand: [0.82, 0.45], // the star at the wand's far end
  pumpy: [0.5, 0.5], // centred (no distinct nozzle in the art)
};

/** The HELD (clay) form's business end, as a fraction of the clay sprite. The
 * Lego art has no nozzle, so a held Pumpy/Dusty takes its active point from the
 * clay it morphs into: Pumpy's hose nozzle, Dusty's nose tip (both far-left). */
export const CLAY_TIP_FRAC: Record<string, [number, number]> = {
  pumpy: [0.04, 0.62],
  dusty: [0.05, 0.34],
};

/** The tool's business end in its held view's LOCAL space (relative to the
 * container origin = the centre-anchored sprite's centre). Derived from the
 * texture's natural size (deterministic — unlike getLocalBounds, which also
 * counts the drop shadow and the mode-letter text) and TOOL_TIP_FRAC. The tool
 * `kind` is also its texture key (dusty/wand/pumpy). */
export function toolTipOffset(textures: Map<string, PIXI.Texture>, kind: string): { x: number; y: number } {
  const tex = textures.get(kind);
  const [fx, fy] = TOOL_TIP_FRAC[kind] ?? [0.5, 0.5];
  if (!tex || tex === PIXI.Texture.WHITE) return { x: 0, y: 0 };
  return { x: (fx - 0.5) * tex.width, y: (fy - 0.5) * tex.height };
}

const BUTTON_PX = 30; // on-screen size of the mode plate

/** The mode letter, drawn to read on any plate colour (white + dark outline). */
function modeLabel(label: string, theme: RenderTheme): PIXI.Text {
  const t = new PIXI.Text(label, {
    fontFamily: theme.fontFamily,
    fontSize: 15,
    fill: 0xffffff,
    fontWeight: 'bold',
    stroke: 0x1a1a1a,
    strokeThickness: 3,
  });
  t.anchor.set(0.5);
  return t;
}

/** A drawn fallback 1×1 plate (yellow studded tile) when the bitmap is missing. */
export function legoButton(label: string, theme: RenderTheme, size = 24): PIXI.Container {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  const r = size / 2;
  g.beginFill(0xc99a06, 1);
  g.drawRoundedRect(-r, -r, size, size, 3);
  g.endFill();
  g.beginFill(0xf4c20a, 1);
  g.drawRoundedRect(-r, -r, size, size - 2, 3);
  g.endFill();
  g.beginFill(0xd9aa08, 1);
  g.drawCircle(0, -1, r * 0.66);
  g.endFill();
  g.beginFill(0xffe25a, 1);
  g.drawCircle(-r * 0.12, -r * 0.14 - 1, r * 0.5);
  g.endFill();
  c.addChild(g);
  const t = modeLabel(label, theme);
  t.style.fill = 0x3a2a00;
  t.style.stroke = 0xffe25a;
  c.addChild(t);
  return c;
}

/** Add the mode plate (the real tool button + letter) to `parent`, placed on the
 * tool `kind`'s sprite (w×h). Falls back to a drawn plate if the bitmap is missing. */
export function addModeButton(
  parent: PIXI.Container,
  label: string,
  theme: RenderTheme,
  kind: string,
  w: number,
  h: number,
  textures: Map<string, PIXI.Texture>,
): void {
  const tex = textures.get(BUTTON_TEX[kind] ?? '');
  let node: PIXI.Container;
  if (tex && tex !== PIXI.Texture.WHITE) {
    node = new PIXI.Container();
    const plate = new PIXI.Sprite(tex);
    plate.anchor.set(0.5);
    plate.scale.set(BUTTON_PX / Math.max(plate.width, plate.height, 1));
    node.addChild(plate, modeLabel(label, theme));
  } else {
    node = legoButton(label, theme); // drawn fallback
  }
  const [fx, fy] = MODE_BUTTON_FRAC[kind] ?? [0.5, 0.5];
  node.position.set((fx - 0.5) * w, (fy - 0.5) * h);
  parent.addChild(node);
}
