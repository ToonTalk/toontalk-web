/**
 * Builds an authentic ToonTalk "plate" (the lego-stud pad behind a number or
 * text value) from the original bitmap, stretched with a nine-slice so the
 * studded border stays crisp while the centre grows to fit the label.
 */
import * as PIXI from 'pixi.js';
import type { RenderTheme } from '../config/render-mode';

export interface PlateInsets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Plate {
  node: PIXI.Container;
  width: number;
  height: number;
}

/** A nine-slice plate sized to its label, with the value drawn centred on top. */
export function drawPlate(
  label: string,
  texture: PIXI.Texture,
  insets: PlateInsets,
  theme: RenderTheme,
  opts: { textColor?: number; minWidth?: number } = {},
): Plate {
  const node = new PIXI.Container();

  const text = new PIXI.Text(label, {
    fontFamily: theme.fontFamily,
    fontSize: 22,
    fill: opts.textColor ?? 0x102030,
    fontWeight: 'bold',
    align: 'center',
  });
  text.anchor.set(0.5);

  const padX = 12;
  const padY = 6;
  const w = Math.max(opts.minWidth ?? 0, insets.left + insets.right + text.width + padX * 2);
  const h = Math.max(insets.top + insets.bottom + text.height + padY * 2, insets.top + insets.bottom + 10);

  const plane = new PIXI.NineSlicePlane(texture, insets.left, insets.top, insets.right, insets.bottom);
  plane.width = w;
  plane.height = h;
  plane.position.set(-w / 2, -h / 2);

  node.addChild(plane, text);
  return { node, width: w, height: h };
}
