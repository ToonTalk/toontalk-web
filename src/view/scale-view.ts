/**
 * Draws the balance using the original's distinct tilt bitmaps (SCALE01 level,
 * SCALE02 left-heavier, SCALE04 right-heavier) — the beam art itself shows which
 * side is heavier, so the sprite is centred and never rotated. A tottering scale
 * (a missing neighbour, matches nothing) shows the level beam (fully opaque).
 */
import * as PIXI from 'pixi.js';
import { ThingView } from './thing-view';
import { Scale, type Tilt } from '../model/scale';

// The baked tilt sprites are named OPPOSITE to what they show: scale-left.png
// actually has the RIGHT pan down, and scale-right.png the LEFT pan down (the
// original SCALE02/SCALE04 were baked under swapped names). Map by what each one
// DISPLAYS: 'left' (left bigger → left pan down) → scale-right; 'right' (right
// bigger → right pan down) → scale-left.
const TILT_TEX: Record<Tilt, string> = {
  left: 'scale-right',
  right: 'scale-left',
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
    this.container.addChild(sprite);
  }
}
