/**
 * Thin wrapper around the PixiJS application. Owns the canvas, the stage,
 * and a dedicated layer for things (above the background).
 */

import * as PIXI from 'pixi.js';
import type { RenderTheme } from '../config/render-mode';

export class Renderer {
  readonly app: PIXI.Application;
  readonly background: PIXI.Container;
  readonly thingLayer: PIXI.Container;

  constructor(theme: RenderTheme) {
    this.app = new PIXI.Application({
      resizeTo: window,
      background: theme.background,
      antialias: theme.mode === 'modern',
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    this.background = new PIXI.Container();
    this.thingLayer = new PIXI.Container();
    this.thingLayer.sortableChildren = true;
    this.app.stage.addChild(this.background, this.thingLayer);
  }

  get view(): HTMLCanvasElement {
    return this.app.view as HTMLCanvasElement;
  }

  get width(): number {
    return this.app.renderer.width / (window.devicePixelRatio || 1);
  }

  get height(): number {
    return this.app.renderer.height / (window.devicePixelRatio || 1);
  }
}
