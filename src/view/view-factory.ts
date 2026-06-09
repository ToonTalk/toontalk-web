/**
 * Builds the right ThingView subclass for a given model Thing.
 */
import * as PIXI from 'pixi.js';
import type { Thing } from '../model/thing';
import type { RenderTheme } from '../config/render-mode';
import { ThingView } from './thing-view';
import { SpriteView } from './sprite-view';
import { NumberView } from './number-view';
import { TextView } from './text-view';
import { BoxView } from './box-view';
import { NestView } from './nest-view';
import { RobotView } from './robot-view';
import { ScaleView } from './scale-view';
import { TruckView } from './truck-view';
import { HouseView } from './house-view';

export function createThingView(
  thing: Thing,
  textures: Map<string, PIXI.Texture>,
  theme: RenderTheme,
): ThingView {
  switch (thing.kind) {
    case 'number':
      return new NumberView(thing, textures, theme);
    case 'text':
      return new TextView(thing, textures, theme);
    case 'box':
      return new BoxView(thing, textures, theme);
    case 'nest':
      return new NestView(thing, textures, theme);
    case 'robot':
      return new RobotView(thing, textures, theme);
    case 'scale':
      return new ScaleView(thing, textures, theme);
    case 'truck':
      return new TruckView(thing, textures, theme);
    case 'house':
      return new HouseView(thing, textures, theme);
    default:
      return new SpriteView(thing, textures, theme);
  }
}
