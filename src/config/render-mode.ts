/**
 * Render mode lets us switch between a pixel-faithful recreation of the
 * original Desktop ToonTalk look and a cleaned-up modern presentation.
 *
 * The MODEL layer never reads this — only the VIEW layer does. That keeps
 * ToonTalk's semantics independent of how things are drawn.
 *
 * Selection order: ?mode=modern in the URL wins; otherwise the default.
 */
export type RenderMode = 'faithful' | 'modern';

export const DEFAULT_RENDER_MODE: RenderMode = 'faithful';

export function getRenderMode(): RenderMode {
  const param = new URLSearchParams(window.location.search).get('mode');
  return param === 'modern' || param === 'faithful' ? param : DEFAULT_RENDER_MODE;
}

/** Visual parameters that differ between the two modes. */
export interface RenderTheme {
  mode: RenderMode;
  /** Texture scaling: nearest keeps original pixels crisp; linear smooths them. */
  scaleMode: 'nearest' | 'linear';
  /** Soft drop shadow under things (modern only). */
  dropShadow: boolean;
  /** Highlight style when a thing is being dragged. */
  dragHighlight: 'none' | 'glow';
  background: number;
  /** Corner radius for pads/boxes: square & chunky (faithful) vs rounded (modern). */
  cornerRadius: number;
  /** Border thickness for pads/boxes (faithful uses chunkier outlines). */
  borderWidth: number;
  /** UI font: a blocky retro face (faithful) vs a clean sans (modern). */
  fontFamily: string;
}

export function themeFor(mode: RenderMode): RenderTheme {
  if (mode === 'modern') {
    return {
      mode,
      scaleMode: 'linear',
      dropShadow: true,
      dragHighlight: 'glow',
      background: 0x2a2d3a,
      cornerRadius: 12,
      borderWidth: 2,
      fontFamily: 'Tahoma, Verdana, system-ui, sans-serif',
    };
  }
  return {
    mode,
    scaleMode: 'nearest',
    dropShadow: false,
    dragHighlight: 'none',
    background: 0x000000,
    cornerRadius: 0,
    borderWidth: 3,
    fontFamily: '"Comic Sans MS", "Chalkboard SE", "Courier New", monospace',
  };
}
