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
  maxSize: number,
): PIXI.Container {
  const view = createThingView(thing, textures, theme);
  const node = view.container;
  node.eventMode = 'none';
  const bounds = node.getLocalBounds();
  const largest = Math.max(bounds.width, bounds.height, 1);
  if (largest > maxSize) node.scale.set(maxSize / largest);
  return node;
}
