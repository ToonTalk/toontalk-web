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
import { NotebookView } from './notebook-view';
import { DustyView } from './dusty-view';
import { WandView } from './wand-view';
import { PumpyView } from './pumpy-view';

export function createThingView(
  thing: Thing,
  textures: Map<string, PIXI.Texture>,
  theme: RenderTheme,
  opts: { static?: boolean } = {},
): ThingView {
  const view = instantiateView(thing, textures, theme, opts);
  // ThingView's constructor calls build() — but with ES2022 class fields, a
  // subclass's field initializers run *after* super() returns and overwrite
  // anything build() stored in instance fields (e.g. BoxView's hole geometry:
  // holeCenters/spanLeft/spanW), leaving it degenerate. The display children
  // survive (so it renders), but hit-testing reads those fields. Re-running
  // build() now, after the instance is fully constructed, makes them stick.
  // (Floor things self-heal on their first 'changed' refresh; things created
  // and immediately hit-tested without a refresh — e.g. a robot's imagined box
  // in its thought bubble — did not, which broke put-in/combine training.)
  view.refresh();
  return view;
}

function instantiateView(
  thing: Thing,
  textures: Map<string, PIXI.Texture>,
  theme: RenderTheme,
  opts: { static?: boolean } = {},
): ThingView {
  switch (thing.kind) {
    case 'number':
      return new NumberView(thing, textures, theme, opts);
    case 'text':
      return new TextView(thing, textures, theme);
    case 'box':
      return new BoxView(thing, textures, theme);
    case 'nest':
      return new NestView(thing, textures, theme);
    case 'robot':
      return new RobotView(thing, textures, theme, opts);
    case 'scale':
      return new ScaleView(thing, textures, theme);
    case 'truck':
      return new TruckView(thing, textures, theme);
    case 'house':
      return new HouseView(thing, textures, theme);
    case 'notebook':
      return new NotebookView(thing, textures, theme);
    case 'dusty':
      return new DustyView(thing, textures, theme);
    case 'wand':
      return new WandView(thing, textures, theme);
    case 'pumpy':
      return new PumpyView(thing, textures, theme);
    default:
      return new SpriteView(thing, textures, theme);
  }
}
