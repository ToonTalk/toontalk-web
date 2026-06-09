/**
 * Draws the balance using the original's distinct tilt bitmaps (SCALE01 level,
 * SCALE02 left-heavier, SCALE04 right-heavier) — the beam art itself shows which
 * side is heavier, so the sprite is centred and never rotated. A tottering scale
 * (a missing neighbour, matches nothing) shows the level beam, faded.
 */
import * as PIXI from 'pixi.js';
import { ThingView } from './thing-view';
import { Scale, type Tilt } from '../model/scale';

const TILT_TEX: Record<Tilt, string> = {
  left: 'scale-left',
  right: 'scale-right',
  balanced: 'scale-level',
  tottering: 'scale-level',
};

export class ScaleView extends ThingView {
  protected build(): void {
    const scale = this.thing as Scale;
    const tex = this.textures.get(TILT_TEX[scale.tilt]) ?? PIXI.Texture.WHITE;

    if (this.theme.dropShadow) {
      const shadow = new PIXI.Sprite(tex);
      shadow.anchor.set(0.5, 0.85);
      shadow.tint = 0x000000;
      shadow.alpha = 0.25;
      shadow.position.set(3, 4);
      this.container.addChild(shadow);
    }

    const sprite = new PIXI.Sprite(tex);
    // Anchor near the base (the pivot) so different tilt frames sit on the floor.
    sprite.anchor.set(0.5, 0.85);
    if (scale.tilt === 'tottering') sprite.alpha = 0.5;
    this.container.addChild(sprite);
  }
}
