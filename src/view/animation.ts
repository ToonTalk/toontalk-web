/**
 * Frame-based sprite animation: loads the original cycle frames (converted from
 * M25, with per-frame timings taken from tts-manifest.json) and builds looping
 * PIXI AnimatedSprites that ride the shared ticker. Views call makeLoopingSprite
 * to get an animated body, falling back to a static sprite when unavailable.
 *
 * To add an element's idle/work cycle: convert its frames to
 * public/assets/anim/<name>/NN.png and add a spec below.
 */
import * as PIXI from 'pixi.js';
import type { RenderTheme } from '../config/render-mode';

interface AnimSpec {
  name: string;
  frames: number;
  /** Milliseconds per frame (from the .TTS cycle). */
  frameMs: number;
  /** Centre/registration anchor (frames are baked pre-aligned to this). */
  anchor: [number, number];
}

const ANIMATIONS: AnimSpec[] = [
  // ROBOT.TTS cycle 13 (idle fidget); frames baked to a uniform 161x207 canvas.
  { name: 'robot-wait', frames: 12, frameMs: 200, anchor: [0.416, 0.406] },
  // One-shot effects (centered):
  { name: 'explode', frames: 5, frameMs: 80, anchor: [0.5, 0.5] }, // EXPLODE.TTS
  { name: 'dusty-suck', frames: 7, frameMs: 70, anchor: [0.5, 0.5] }, // SUCK0–7
];

const specs = new Map<string, AnimSpec>(ANIMATIONS.map((a) => [a.name, a]));
const loaded = new Map<string, PIXI.Texture[]>();

export async function loadAnimations(theme: RenderTheme): Promise<void> {
  const scaleMode =
    theme.scaleMode === 'nearest' ? PIXI.SCALE_MODES.NEAREST : PIXI.SCALE_MODES.LINEAR;
  await Promise.all(
    ANIMATIONS.map(async (a) => {
      const texs: PIXI.Texture[] = [];
      for (let i = 0; i < a.frames; i++) {
        try {
          const t = await PIXI.Assets.load(`/assets/anim/${a.name}/${String(i).padStart(2, '0')}.png`);
          t.baseTexture.scaleMode = scaleMode;
          texs.push(t);
        } catch {
          // Skip a missing frame; the animation still plays the rest.
        }
      }
      if (texs.length) loaded.set(a.name, texs);
    }),
  );
}

export function hasAnimation(name: string): boolean {
  return loaded.has(name);
}

/** Play a named cycle once at (x, y) on `parent`, removing it when finished. */
export function playOnce(name: string, parent: PIXI.Container, x: number, y: number): void {
  const texs = loaded.get(name);
  const spec = specs.get(name);
  if (!texs || texs.length === 0 || !spec) return;
  const sprite = new PIXI.AnimatedSprite(texs);
  sprite.anchor.set(spec.anchor[0], spec.anchor[1]);
  sprite.position.set(x, y);
  sprite.zIndex = 9999;
  sprite.animationSpeed = 1000 / spec.frameMs / 60;
  sprite.loop = false;
  sprite.onComplete = () => sprite.destroy();
  parent.addChild(sprite);
  sprite.play();
}

/**
 * An AnimatedSprite (anchored at centre) that plays the named cycle, then rests
 * on frame 0 for `restMs` before fidgeting again — like an idling robot. Returns
 * null if the animation isn't loaded.
 */
export function makeIdleSprite(name: string, restMs = 2600): PIXI.AnimatedSprite | null {
  const texs = loaded.get(name);
  const spec = specs.get(name);
  if (!texs || texs.length === 0 || !spec) return null;
  const sprite = new PIXI.AnimatedSprite(texs);
  sprite.anchor.set(spec.anchor[0], spec.anchor[1]);
  // PIXI advances `animationSpeed` frames per shared-ticker tick (~60fps).
  sprite.animationSpeed = 1000 / spec.frameMs / 60;
  sprite.loop = false;
  sprite.onComplete = () => {
    sprite.gotoAndStop(0); // settle on the neutral pose
    window.setTimeout(() => {
      if (!sprite.destroyed) sprite.gotoAndPlay(0);
    }, restMs);
  };
  sprite.play();
  return sprite;
}
