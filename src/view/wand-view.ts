/**
 * Draws the magic wand with a badge for its current mode (C copy · O original ·
 * S copy-self). Hover/hold the wand and press C/O/S (or space to cycle).
 */
import * as PIXI from 'pixi.js';
import { ThingView } from './thing-view';
import { Wand } from '../model/wand';
import { legoButton } from './lego-button';

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

    // Mode shown as a tiny Lego button sitting ON the wand.
    this.container.addChild(legoButton(wand.mode, this.theme));
  }
}
