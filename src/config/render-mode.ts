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
}

export function themeFor(mode: RenderMode): RenderTheme {
  if (mode === 'modern') {
    return {
      mode,
      scaleMode: 'linear',
      dropShadow: true,
      dragHighlight: 'glow',
      background: 0x2a2d3a,
    };
  }
  return {
    mode,
    scaleMode: 'nearest',
    dropShadow: false,
    dragHighlight: 'none',
    background: 0x000000,
  };
}
