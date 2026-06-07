/**
 * Shared drawing helper for "pad"-style things (numbers, text): a rounded
 * rectangle sized to its label, themed for faithful vs modern rendering.
 */
import * as PIXI from 'pixi.js';
import type { RenderTheme } from '../config/render-mode';

export interface Pad {
  /** Centered container holding background + label. */
  node: PIXI.Container;
  width: number;
  height: number;
}

export function drawPad(
  label: string,
  fill: number,
  theme: RenderTheme,
  opts: { textColor?: number; borderColor?: number } = {},
): Pad {
  const node = new PIXI.Container();
  const padX = 14;
  const padY = 8;

  const text = new PIXI.Text(label, {
    fontFamily: 'Tahoma, Verdana, system-ui, sans-serif',
    fontSize: 22,
    fill: opts.textColor ?? 0x102030,
    align: 'center',
  });
  text.anchor.set(0.5);

  const w = Math.max(40, text.width + padX * 2);
  const h = Math.max(34, text.height + padY * 2);

  const bg = new PIXI.Graphics();
  if (theme.dropShadow) {
    bg.beginFill(0x000000, 0.2);
    bg.drawRoundedRect(-w / 2 + 3, -h / 2 + 4, w, h, 10);
    bg.endFill();
  }
  bg.lineStyle(2, opts.borderColor ?? 0x3a4a5a, 1);
  bg.beginFill(fill, 1);
  bg.drawRoundedRect(-w / 2, -h / 2, w, h, theme.mode === 'modern' ? 10 : 4);
  bg.endFill();

  node.addChild(bg, text);
  return { node, width: w, height: h };
}
