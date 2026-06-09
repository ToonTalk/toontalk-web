/**
 * Base visual representation of a single Thing. One ThingView per model Thing.
 * The view reads the render theme; the model never does.
 *
 * Subclasses (SpriteView, NumberView, TextView, BoxView) implement build() to
 * populate their own visuals. The base owns the shared interaction surface:
 * position sync, hit testing, drag highlight, and refresh-on-change.
 */

import * as PIXI from 'pixi.js';
import type { Thing } from '../model/thing';
import type { RenderTheme } from '../config/render-mode';

export abstract class ThingView {
  readonly thing: Thing;
  readonly container: PIXI.Container;
  protected readonly theme: RenderTheme;
  protected readonly textures: Map<string, PIXI.Texture>;
  private glow: PIXI.Graphics | null = null;

  constructor(thing: Thing, textures: Map<string, PIXI.Texture>, theme: RenderTheme) {
    this.thing = thing;
    this.textures = textures;
    this.theme = theme;
    this.container = new PIXI.Container();
    this.container.eventMode = 'static';
    this.container.cursor = 'grab';
    this.build();
    this.container.alpha = this.baseAlpha();
    this.container.scale.set(this.thing.scaleX, this.thing.scaleY); // Pumpy resize
    this.syncPosition();
  }

  /** Populate this.container with the visuals for this kind of thing. */
  protected abstract build(): void;

  /** Erased things (Dusty) render faded to signal they're wildcards. */
  protected baseAlpha(): number {
    return this.thing.erased ? 0.4 : 1;
  }

  /** Rebuild visuals after the underlying model changed. */
  refresh(): void {
    this.glow = null;
    this.container.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.build();
    this.container.alpha = this.baseAlpha();
    this.container.scale.set(this.thing.scaleX, this.thing.scaleY); // Pumpy resize
  }

  syncPosition(): void {
    this.container.position.set(this.thing.x, this.thing.y);
  }

  /** Hit test in world coordinates against the container's bounds. */
  containsPoint(x: number, y: number): boolean {
    const b = this.container.getBounds();
    return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
  }

  setDragging(dragging: boolean): void {
    this.container.cursor = dragging ? 'grabbing' : 'grab';
    this.container.alpha = dragging ? 0.9 : this.baseAlpha();
    if (this.theme.dragHighlight !== 'glow') return;

    if (dragging && !this.glow) {
      const b = this.container.getLocalBounds();
      this.glow = new PIXI.Graphics();
      this.glow.lineStyle(3, 0x66ccff, 0.9);
      this.glow.drawRoundedRect(b.x - 4, b.y - 4, b.width + 8, b.height + 8, 8);
      this.container.addChildAt(this.glow, 0);
    } else if (!dragging && this.glow) {
      this.glow.destroy();
      this.glow = null;
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
