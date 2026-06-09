/**
 * The little "this is a live sensor" decoration shared by the number and text
 * pad views: a stubby antenna with a glowing tip above the pad, plus a small
 * caption naming what it senses.
 */
import * as PIXI from 'pixi.js';
import type { RenderTheme } from '../config/render-mode';

export function addSensorTag(
  container: PIXI.Container,
  label: string,
  width: number,
  height: number,
  theme: RenderTheme,
): void {
  const antenna = new PIXI.Graphics();
  antenna.lineStyle(2, 0x33414f, 1);
  antenna.moveTo(width / 2 - 12, -height / 2 + 4);
  antenna.lineTo(width / 2 - 4, -height / 2 - 10);
  antenna.lineStyle(0);
  antenna.beginFill(0x6fd3ff, 1);
  antenna.drawCircle(width / 2 - 4, -height / 2 - 12, 4);
  antenna.endFill();
  antenna.beginFill(0xffffff, 0.85);
  antenna.drawCircle(width / 2 - 5, -height / 2 - 13, 1.6);
  antenna.endFill();
  container.addChild(antenna);

  const caption = new PIXI.Text(label, {
    fontFamily: theme.fontFamily,
    fontSize: 11,
    fill: 0xffffff,
    fontWeight: 'bold',
  });
  caption.anchor.set(0.5);
  const tag = new PIXI.Graphics();
  const w = caption.width + 10;
  tag.beginFill(0x223040, 0.92);
  tag.drawRoundedRect(-w / 2, height / 2 - 2, w, 16, 4);
  tag.endFill();
  caption.position.set(0, height / 2 + 6);
  container.addChild(tag, caption);
}
