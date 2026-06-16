/**
 * Loads the original ToonTalk sprite/background bitmaps (converted to PNG) and
 * applies the render theme's scaling mode so the "faithful" mode stays crisp.
 */

import * as PIXI from 'pixi.js';
import type { RenderTheme } from '../config/render-mode';

const SPRITE_KEYS = [
  'number', 'text', 'box', 'bird', 'nest', 'nest-empty', 'robot', 'scale', 'wand', 'pumpy',
  'dusty', 'bubble', 'bomb', 'truck', 'notebook',
  // Authentic lego plates / cubby pieces:
  'numplat', 'textplat', 'cubby', 'cubby1', 'cubbyr', 'cubbyb',
  // Tool mode-button plates (VACBTN / PUMPBTN / WANDBTN):
  'vacbtn', 'pumpbtn', 'wandbtn',
  // Scale tilt images (level / left-heavier / right-heavier):
  'scale-level', 'scale-left', 'scale-right',
] as const;

export interface LoadedAssets {
  textures: Map<string, PIXI.Texture>;
  background: PIXI.Texture;
}

export async function loadAssets(theme: RenderTheme): Promise<LoadedAssets> {
  const scaleMode =
    theme.scaleMode === 'nearest' ? PIXI.SCALE_MODES.NEAREST : PIXI.SCALE_MODES.LINEAR;

  const textures = new Map<string, PIXI.Texture>();
  await Promise.all(
    SPRITE_KEYS.map(async (key) => {
      try {
        const tex = await PIXI.Assets.load(`/assets/sprites/${key}.png`);
        tex.baseTexture.scaleMode = scaleMode;
        textures.set(key, tex);
      } catch {
        // Missing asset: fall back to a visible swatch so the app still runs.
        textures.set(key, PIXI.Texture.WHITE);
      }
    }),
  );

  let background: PIXI.Texture;
  try {
    background = await PIXI.Assets.load('/assets/backgrounds/city.png');
    background.baseTexture.scaleMode = scaleMode;
  } catch {
    background = PIXI.Texture.WHITE;
  }

  return { textures, background };
}
