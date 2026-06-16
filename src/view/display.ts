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
  opts: { scaleUp?: boolean; static?: boolean; maxHeight?: number } = {},
): PIXI.Container {
  const view = createThingView(thing, textures, theme, { static: opts.static });
  const node = view.container;
  node.eventMode = 'none';
  node.position.set(0, 0); // createThingView places it at the thing's world coords; centre it
  if (opts.static) freezeAnimations(node); // e.g. the robot stays still in Tooly until taken out
  const bounds = node.getLocalBounds();
  // Fit INSIDE a `size` × `maxHeight` box (the original's TO_FIT_INSIDE). When
  // maxHeight is omitted this is a `size`×`size` square = fit-largest-dim-to-size
  // (back-compatible). Toolbox compartments are wider than tall, so passing both
  // lets a tall plate and a wide truck each fill their cell without overflowing.
  const maxH = opts.maxHeight ?? size;
  const fit = Math.min(size / Math.max(bounds.width, 1), maxH / Math.max(bounds.height, 1));
  // Shrink to fit by default; with scaleUp, also enlarge small things to fill
  // the cell (used so a delivered thing fully covers its nest).
  if (fit < 1 || opts.scaleUp) node.scale.set(fit);
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
