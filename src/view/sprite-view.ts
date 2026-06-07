/**
 * Fallback view that draws a Thing as its bitmap sprite. Used for kinds that
 * don't yet have bespoke visuals (bird, robot, wand…) and for placeholders.
 */
import * as PIXI from 'pixi.js';
import { ThingView } from './thing-view';
import { Placeholder } from '../model/thing';

export class SpriteView extends ThingView {
  protected build(): void {
    const key = this.thing instanceof Placeholder ? this.thing.sprite : this.thing.kind;
    const texture = this.textures.get(key) ?? PIXI.Texture.WHITE;

    if (this.theme.dropShadow) {
      const shadow = new PIXI.Sprite(texture);
      shadow.anchor.set(0.5);
      shadow.tint = 0x000000;
      shadow.alpha = 0.25;
      shadow.position.set(3, 4);
      this.container.addChild(shadow);
    }

    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    this.container.addChild(sprite);
  }
}
