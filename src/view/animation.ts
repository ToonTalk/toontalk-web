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
  { name: 'bird-fly', frames: 6, frameMs: 90, anchor: [0.5, 0.5] }, // BIRD.TTS flight
  // MOUSEHAM: the mouse with the big red hammer that "bams" a lego brick into
  // its clay form (call_in_a_mouse). Anchor on the mouse body (bottom-centre).
  { name: 'mouse', frames: 4, frameMs: 100, anchor: [0.5, 0.6] },
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

/**
 * A bird flaps from (fromX,fromY) to (toX,toY) and back (a delivery run), then
 * removes itself. The resting bird sprite is hidden for the trip.
 */
export function flyBird(
  parent: PIXI.Container,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  hide?: PIXI.Container,
): void {
  const texs = loaded.get('bird-fly');
  const spec = specs.get('bird-fly');
  if (!texs || texs.length === 0 || !spec) return;
  const sprite = new PIXI.AnimatedSprite(texs);
  sprite.anchor.set(0.5);
  sprite.scale.set(0.8);
  sprite.animationSpeed = 1000 / spec.frameMs / 60;
  sprite.loop = true;
  sprite.zIndex = 9998;
  sprite.position.set(fromX, fromY);
  parent.addChild(sprite);
  sprite.play();
  if (hide) hide.visible = false;

  const durationMs = 950;
  const start = performance.now();
  const step = (): void => {
    const t = Math.min(1, (performance.now() - start) / durationMs);
    const p = t < 0.5 ? t * 2 : (1 - t) * 2; // out (0→1) then back (1→0)
    sprite.position.set(fromX + (toX - fromX) * p, fromY + (toY - fromY) * p);
    if (t >= 1) {
      PIXI.Ticker.shared.remove(step);
      sprite.destroy();
      if (hide && !hide.destroyed) hide.visible = true;
    }
  };
  PIXI.Ticker.shared.add(step);
}

/** Ease a node's scale from `from`× to `to`× over `ms` (used for cubby fit/restore). */
export function tweenScale(node: PIXI.Container, from: number, to: number, ms = 170): void {
  const start = performance.now();
  node.scale.set(from);
  const step = (): void => {
    if (node.destroyed) {
      PIXI.Ticker.shared.remove(step);
      return;
    }
    const t = Math.min(1, (performance.now() - start) / ms);
    const e = 1 - (1 - t) * (1 - t); // ease-out
    node.scale.set(from + (to - from) * e);
    if (t >= 1) PIXI.Ticker.shared.remove(step);
  };
  PIXI.Ticker.shared.add(step);
}

/**
 * The "bam" mouse runs in from `from`, reaches `bam` (where it swings its
 * hammer — `onBam` fires), then runs out to `out` and removes itself
 * (mouse.cpp `call_in_a_mouse`). All points are in `parent`'s coordinate space.
 */
export function runMouse(
  parent: PIXI.Container,
  from: { x: number; y: number },
  bam: { x: number; y: number },
  out: { x: number; y: number },
  onBam: () => void,
): void {
  const texs = loaded.get('mouse');
  const spec = specs.get('mouse');
  if (!texs || texs.length === 0 || !spec) {
    onBam(); // no art — just morph, no mouse
    return;
  }
  const sprite = new PIXI.AnimatedSprite(texs);
  sprite.anchor.set(spec.anchor[0], spec.anchor[1]);
  sprite.scale.set(0.55);
  sprite.animationSpeed = 1000 / spec.frameMs / 60;
  sprite.loop = true;
  sprite.zIndex = 9997;
  sprite.position.set(from.x, from.y);
  parent.addChild(sprite);
  sprite.play();

  const inMs = 720;
  const outMs = 540;
  const start = performance.now();
  let bammed = false;
  const step = (): void => {
    if (sprite.destroyed) {
      PIXI.Ticker.shared.remove(step);
      return;
    }
    const now = performance.now() - start;
    if (now <= inMs) {
      const t = now / inMs;
      const e = 1 - (1 - t) * (1 - t); // ease-out as it runs in
      sprite.position.set(from.x + (bam.x - from.x) * e, from.y + (bam.y - from.y) * e);
    } else {
      if (!bammed) {
        bammed = true;
        onBam();
      }
      const t = Math.min(1, (now - inMs) / outMs);
      const e = t * t; // ease-in as it runs back out
      sprite.position.set(bam.x + (out.x - bam.x) * e, bam.y + (out.y - bam.y) * e);
      if (t >= 1) {
        PIXI.Ticker.shared.remove(step);
        sprite.destroy();
      }
    }
  };
  PIXI.Ticker.shared.add(step);
}

/**
 * Lego→clay morph when an element is pulled from Tooly: a flat lego brick
 * (`legoTex`, e.g. CUBBYB) sits at the spot while the bam-mouse runs in; on the
 * bam the brick is replaced by the clay element (`clay`), which pops to full
 * size. `from`/`out` are the mouse's off-screen entry/exit, in `parent` space.
 */
export function morphFromToolbox(
  parent: PIXI.Container,
  clay: PIXI.Container,
  legoTex: PIXI.Texture | undefined,
  worldX: number,
  worldY: number,
  from: { x: number; y: number },
  out: { x: number; y: number },
): void {
  clay.visible = false; // hidden until the bam reveals the clay form
  let lego: PIXI.Sprite | null = null;
  if (legoTex && legoTex !== PIXI.Texture.WHITE) {
    lego = new PIXI.Sprite(legoTex);
    lego.anchor.set(0.5);
    lego.width = 60;
    lego.height = 42;
    lego.position.set(worldX, worldY);
    lego.zIndex = 60;
    parent.addChild(lego);
  }
  let revealed = false;
  const reveal = (): void => {
    if (revealed) return;
    revealed = true;
    if (lego && !lego.destroyed) lego.destroy();
    if (clay.destroyed) return;
    clay.visible = true;
    tweenScale(clay, 0.3, 1, 200); // brick → full clay
  };
  runMouse(parent, from, { x: worldX, y: worldY }, out, reveal);
  window.setTimeout(reveal, 1500); // safety: never leave the element hidden
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
