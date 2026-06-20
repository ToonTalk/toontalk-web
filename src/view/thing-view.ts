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
import { floorCamera } from './floor-camera';

export abstract class ThingView {
  readonly thing: Thing;
  readonly container: PIXI.Container;
  protected readonly theme: RenderTheme;
  protected readonly textures: Map<string, PIXI.Texture>;
  /** True when rendered as an inert display icon (e.g. resting in Tooly): the
   * robot shows its still Lego form (RB00) rather than its clay "alive" fidget. */
  protected readonly staticDisplay: boolean;
  /** True while the thing is "alive": a held tool morphs from its Lego form to
   * its clay form (Dusty/Pumpy). Subclasses read it in build(); the base just
   * rebuilds when it flips. */
  protected alive = false;
  private glow: PIXI.Graphics | null = null;

  constructor(
    thing: Thing,
    textures: Map<string, PIXI.Texture>,
    theme: RenderTheme,
    opts: { static?: boolean } = {},
  ) {
    this.thing = thing;
    this.textures = textures;
    this.theme = theme;
    this.staticDisplay = opts.static ?? false;
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

  /** Erased things (Dusty) are shown by *blank* art (a blank box/plate), not by
   * transparency, so they read as solid "any value of this kind" wildcards. */
  protected baseAlpha(): number {
    return 1;
  }

  /** Morph between Lego (at rest) and clay (alive/held). Default rebuilds so a
   * subclass's build() can pick the form; tools override build() to use it. */
  setAlive(alive: boolean): void {
    if (this.alive === alive) return;
    this.alive = alive;
    this.refresh();
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

  /** The point on this view (in its LOCAL space, relative to the container
   * origin) that acts as the cursor hot point when the thing is HELD — the
   * centre by default. Tools override it to their business end (Dusty's nose,
   * the wand's tip) so aiming the tip is exactly what gets clicked. */
  activeOffset(): { x: number; y: number } {
    return { x: 0, y: 0 };
  }

  /** Hit test in world coordinates against the container's bounds. */
  containsPoint(x: number, y: number): boolean {
    // (x, y) are WORLD coords; getBounds is screen (thingLayer is panned by the
    // floor camera), so shift the bounds into world space before testing.
    const b = this.container.getBounds();
    return (
      x >= b.x + floorCamera.x &&
      x <= b.x + b.width + floorCamera.x &&
      y >= b.y + floorCamera.y &&
      y <= b.y + b.height + floorCamera.y
    );
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
