/**
 * Renders a Thing as a non-interactive, scaled-to-fit display node, so a thing
 * contained in a box hole or sitting on a nest looks like itself (a box looks
 * like a box, a number like a number) instead of a text description.
 */
import * as PIXI from 'pixi.js';
import type { Thing } from '../model/thing';
import type { RenderTheme } from '../config/render-mode';
import { createThingView } from './view-factory';

export function renderThingDisplay(
  thing: Thing,
  textures: Map<string, PIXI.Texture>,
  theme: RenderTheme,
  size: number,
  opts: { scaleUp?: boolean; static?: boolean } = {},
): PIXI.Container {
  const view = createThingView(thing, textures, theme);
  const node = view.container;
  node.eventMode = 'none';
  node.position.set(0, 0); // createThingView places it at the thing's world coords; centre it
  if (opts.static) freezeAnimations(node); // e.g. the robot stays still in Tooly until taken out
  const bounds = node.getLocalBounds();
  const largest = Math.max(bounds.width, bounds.height, 1);
  // Shrink to fit by default; with scaleUp, also enlarge small things to fill
  // `size` (used so a delivered thing fully covers its nest).
  if (largest > size || opts.scaleUp) node.scale.set(size / largest);
  return node;
}

/** Freeze any AnimatedSprite in the tree on its first frame (a static icon). */
function freezeAnimations(node: PIXI.Container): void {
  if (node instanceof PIXI.AnimatedSprite) {
    node.gotoAndStop(0);
    node.autoUpdate = false;
  }
  for (const child of node.children) freezeAnimations(child as PIXI.Container);
}
