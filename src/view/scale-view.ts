/**
 * Draws the balance, rotated to show which way it leans: left-heavier dips to
 * the left, right-heavier dips to the right, balanced sits level, and a
 * tottering scale (a missing neighbour) is shown level but faded.
 */
import * as PIXI from 'pixi.js';
import { ThingView } from './thing-view';
import { Scale, type Tilt } from '../model/scale';

const TILT_ANGLE: Record<Tilt, number> = {
  left: -0.2,
  right: 0.2,
  balanced: 0,
  tottering: 0,
};

export class ScaleView extends ThingView {
  protected build(): void {
    const scale = this.thing as Scale;
    const tex = this.textures.get('scale') ?? PIXI.Texture.WHITE;

    if (this.theme.dropShadow) {
      const shadow = new PIXI.Sprite(tex);
      shadow.anchor.set(0.5, 1);
      shadow.tint = 0x000000;
      shadow.alpha = 0.25;
      shadow.position.set(3, 4);
      this.container.addChild(shadow);
    }

    const sprite = new PIXI.Sprite(tex);
    // Anchor at the bottom-centre (the pivot) so it tips about its base.
    sprite.anchor.set(0.5, 1);
    sprite.rotation = TILT_ANGLE[scale.tilt];
    if (scale.tilt === 'tottering') sprite.alpha = 0.5;
    this.container.addChild(sprite);
  }
}
