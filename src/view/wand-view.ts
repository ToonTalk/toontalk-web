/**
 * Draws the magic wand with a badge for its current mode (C copy · O original ·
 * S copy-self). Hover/hold the wand and press C/O/S (or space to cycle).
 */
import * as PIXI from 'pixi.js';
import { ThingView } from './thing-view';
import { Wand } from '../model/wand';

export class WandView extends ThingView {
  protected build(): void {
    const wand = this.thing as Wand;
    const tex = this.textures.get('wand') ?? PIXI.Texture.WHITE;

    if (this.theme.dropShadow) {
      const shadow = new PIXI.Sprite(tex);
      shadow.anchor.set(0.5);
      shadow.tint = 0x000000;
      shadow.alpha = 0.25;
      shadow.position.set(3, 4);
      this.container.addChild(shadow);
    }
    const sprite = new PIXI.Sprite(tex);
    sprite.anchor.set(0.5);
    this.container.addChild(sprite);

    const badge = new PIXI.Graphics();
    badge.beginFill(0x223040, 0.92);
    badge.drawRoundedRect(-12, sprite.height / 2 - 4, 24, 22, 5);
    badge.endFill();
    const label = new PIXI.Text(wand.mode, {
      fontFamily: this.theme.fontFamily,
      fontSize: 14,
      fill: 0xffffff,
      fontWeight: 'bold',
    });
    label.anchor.set(0.5);
    label.position.set(0, sprite.height / 2 + 7);
    this.container.addChild(badge, label);
  }
}
