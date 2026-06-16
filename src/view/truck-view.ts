/**
 * Draws a truck (scaled down from the big TRUCK2 art). Drop a robot and a box
 * into it and it drives off to build a house.
 */
import * as PIXI from 'pixi.js';
import { ThingView } from './thing-view';

export class TruckView extends ThingView {
  protected build(): void {
    const tex = this.textures.get('truck') ?? PIXI.Texture.WHITE;
    const s = 150 / Math.max(tex.width, 1); // fit to ~150px wide, whatever the art's size
    if (this.theme.dropShadow) {
      const shadow = new PIXI.Sprite(tex);
      shadow.anchor.set(0.5);
      shadow.scale.set(s);
      shadow.tint = 0x000000;
      shadow.alpha = 0.25;
      shadow.position.set(3, 4);
      this.container.addChild(shadow);
    }
    const sprite = new PIXI.Sprite(tex);
    sprite.anchor.set(0.5);
    sprite.scale.set(s);
    this.container.addChild(sprite);
  }
}
