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
  /**
   * If set, the cycle is directional: frames live in `anim/<name>/<d>/NN.png`
   * for d in 0..dirs-1 (Direction enum E,SE,S,SW,W,NW,N,NE) and load into
   * `loaded` under the key `<name>:<d>`. All directions share one canvas/anchor.
   */
  dirs?: number;
}

const ANIMATIONS: AnimSpec[] = [
  // ROBOT.TTS cycle 13 (idle fidget); frames baked to a uniform 161x207 canvas.
  { name: 'robot-wait', frames: 12, frameMs: 200, anchor: [0.416, 0.406] },
  // One-shot effects (centered):
  { name: 'explode', frames: 5, frameMs: 80, anchor: [0.5, 0.5] }, // EXPLODE.TTS
  { name: 'dusty-suck', frames: 7, frameMs: 70, anchor: [0.5, 0.5] }, // SUCK0–7
  // BIRD.TTS flight cycles 0-7 (E,SE,S,SW,W,NW,N,NE) — the bird faces the way
  // it flies (bird.cpp fly_to sets the cycle to direction(dx,dy)).
  { name: 'bird-fly', frames: 6, frameMs: 90, anchor: [0.495, 0.446], dirs: 8 },
  // NEST.TTS cycle 2 (HATCH02-14): the egg cracks open and the bird emerges
  // (bird.cpp Nest::hatch_bird). Anchored on the egg (nestAnchor from
  // tools/bake-nest.py) so it overlays the static nest exactly.
  { name: 'nest-hatch', frames: 13, frameMs: 70, anchor: [0.442, 0.649] },
  // MOUSEHAM: the mouse with the big red hammer that "bams" a lego brick into
  // its clay form (call_in_a_mouse). All 22 frames baked to one canvas
  // (tools/bake-mouse.py) in playback order — run-in [0..3], smash [4..17]
  // (windup→slam→lift), run-out [18..21]; runMouse drives the sub-ranges.
  { name: 'mouse', frames: 22, frameMs: 100, anchor: [0.403, 0.709] },
];

const specs = new Map<string, AnimSpec>(ANIMATIONS.map((a) => [a.name, a]));
const loaded = new Map<string, PIXI.Texture[]>();

export async function loadAnimations(theme: RenderTheme): Promise<void> {
  const scaleMode =
    theme.scaleMode === 'nearest' ? PIXI.SCALE_MODES.NEAREST : PIXI.SCALE_MODES.LINEAR;
  const loadFrames = async (dir: string, key: string, count: number): Promise<void> => {
    const texs: PIXI.Texture[] = [];
    for (let i = 0; i < count; i++) {
      try {
        const t = await PIXI.Assets.load(`/assets/anim/${dir}/${String(i).padStart(2, '0')}.png`);
        t.baseTexture.scaleMode = scaleMode;
        texs.push(t);
      } catch {
        // Skip a missing frame; the animation still plays the rest.
      }
    }
    if (texs.length) loaded.set(key, texs);
  };
  await Promise.all(
    ANIMATIONS.flatMap((a) =>
      a.dirs
        ? Array.from({ length: a.dirs }, (_, d) => loadFrames(`${a.name}/${d}`, `${a.name}:${d}`, a.frames))
        : [loadFrames(a.name, a.name, a.frames)],
    ),
  );
}

export function hasAnimation(name: string): boolean {
  return loaded.has(name);
}

/**
 * Flight-direction cycle index from a screen-space delta — the Direction enum
 * E,SE,S,SW,W,NW,N,NE (0..7), matching bird.cpp `direction(dx,dy)`. Screen +y is
 * down (south), so atan2(dy,dx)=0→E, +π/2→S, ±π→W, -π/2→N.
 */
function flightDir(dx: number, dy: number): number {
  return ((Math.round((Math.atan2(dy, dx) * 4) / Math.PI) % 8) + 8) % 8;
}

/**
 * A bird flaps from (fromX,fromY) to (toX,toY) and back (a delivery run), facing
 * the way it flies — out in one direction, then the opposite on the return leg
 * (bird.cpp sets the cycle to `direction(dx,dy)`) — then removes itself. The
 * resting bird sprite is hidden for the trip.
 */
export function flyBird(
  parent: PIXI.Container,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  hide?: PIXI.Container,
): void {
  const spec = specs.get('bird-fly');
  if (!spec) return;
  const outDir = flightDir(toX - fromX, toY - fromY);
  const backDir = (outDir + 4) % 8; // opposite octant for the return
  const texOut = loaded.get(`bird-fly:${outDir}`);
  const texBack = loaded.get(`bird-fly:${backDir}`);
  if (!texOut || texOut.length === 0 || !texBack) return;
  const sprite = new PIXI.AnimatedSprite(texOut);
  sprite.anchor.set(spec.anchor[0], spec.anchor[1]);
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
  let flipped = false;
  const step = (): void => {
    if (sprite.destroyed) {
      PIXI.Ticker.shared.remove(step);
      return;
    }
    const t = Math.min(1, (performance.now() - start) / durationMs);
    const p = t < 0.5 ? t * 2 : (1 - t) * 2; // out (0→1) then back (1→0)
    // Turn around for the return leg — seamless: all directions share one canvas.
    if (t >= 0.5 && !flipped && texBack.length) {
      flipped = true;
      sprite.textures = texBack;
      sprite.animationSpeed = 1000 / spec.frameMs / 60;
      sprite.loop = true;
      sprite.play();
    }
    sprite.position.set(fromX + (toX - fromX) * p, fromY + (toY - fromY) * p);
    if (t >= 1) {
      PIXI.Ticker.shared.remove(step);
      sprite.destroy();
      if (hide && !hide.destroyed) hide.visible = true;
    }
  };
  PIXI.Ticker.shared.add(step);
}

/**
 * A freshly hatched bird flies one-way up out of the nest to (toX,toY), growing
 * from tiny to full size as it goes (bird.cpp `bird_has_hatched`:
 * `animate_to_size_percents` + `fly_to`), facing its flight direction. Reveals
 * `reveal` (the real bird) when it lands, then removes itself.
 */
function flyUpBird(
  parent: PIXI.Container,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  reveal?: PIXI.Container,
): void {
  const spec = specs.get('bird-fly');
  const texs = spec && loaded.get(`bird-fly:${flightDir(toX - fromX, toY - fromY)}`);
  if (!spec || !texs || texs.length === 0) {
    if (reveal && !reveal.destroyed) reveal.visible = true;
    return;
  }
  const sprite = new PIXI.AnimatedSprite(texs);
  sprite.anchor.set(spec.anchor[0], spec.anchor[1]);
  sprite.animationSpeed = 1000 / spec.frameMs / 60;
  sprite.loop = true;
  sprite.zIndex = 9998;
  sprite.position.set(fromX, fromY);
  sprite.scale.set(0.3);
  parent.addChild(sprite);
  sprite.play();
  const durationMs = 750;
  const start = performance.now();
  const step = (): void => {
    if (sprite.destroyed) {
      PIXI.Ticker.shared.remove(step);
      return;
    }
    const t = Math.min(1, (performance.now() - start) / durationMs);
    const e = 1 - (1 - t) * (1 - t); // ease-out
    sprite.position.set(fromX + (toX - fromX) * e, fromY + (toY - fromY) * e);
    sprite.scale.set(0.3 + 0.5 * e); // grow to full size on the way up
    if (t >= 1) {
      PIXI.Ticker.shared.remove(step);
      sprite.destroy();
      if (reveal && !reveal.destroyed) reveal.visible = true;
    }
  };
  PIXI.Ticker.shared.add(step);
}

/**
 * The egg in a nest cracks open and a bird hatches out, then flies up to its
 * resting spot (toX,toY) — a port of bird.cpp `Nest::hatch_bird` →
 * `bird_has_hatched`. The static nest (`hideNest`) and the real bird
 * (`hideBird`) are hidden for the sequence; the egg-crack overlay plays once at
 * the nest, the bird emerges near the end and flies up, and the (now empty)
 * nest reappears. Falls back to just revealing both if the art is missing.
 */
export function hatchNest(
  parent: PIXI.Container,
  nestX: number,
  nestY: number,
  toX: number,
  toY: number,
  hideNest?: PIXI.Container,
  hideBird?: PIXI.Container,
): void {
  const spec = specs.get('nest-hatch');
  const texs = loaded.get('nest-hatch');
  if (!spec || !texs || texs.length === 0) {
    flyUpBird(parent, nestX, nestY, toX, toY, hideBird);
    return;
  }
  if (hideNest) hideNest.visible = false;
  if (hideBird) hideBird.visible = false;
  const egg = new PIXI.AnimatedSprite(texs);
  egg.anchor.set(spec.anchor[0], spec.anchor[1]); // egg centred on the nest
  egg.position.set(nestX, nestY);
  egg.zIndex = 9996;
  egg.loop = false;
  egg.animationSpeed = 1000 / spec.frameMs / 60;
  parent.addChild(egg);
  egg.play();
  let launched = false;
  const launchAt = texs.length - 2; // the bird leaves the nest near the last frame
  egg.onFrameChange = (frame): void => {
    if (!launched && frame >= launchAt) {
      launched = true;
      flyUpBird(parent, nestX, nestY - 20, toX, toY, hideBird);
    }
  };
  egg.onComplete = (): void => {
    if (!launched) flyUpBird(parent, nestX, nestY - 20, toX, toY, hideBird);
    egg.destroy();
    if (hideNest && !hideNest.destroyed) hideNest.visible = true; // empty nest returns
  };
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

// MOUSEHAM playback sub-ranges baked by tools/bake-mouse.py (frame indices).
const MOUSE_RUN_IN: [number, number] = [0, 4]; // running toward the item
const MOUSE_SMASH: [number, number] = [4, 18]; // windup → slam → lift
const MOUSE_RUN_OUT: [number, number] = [18, 22]; // running back out
const MOUSE_STRIKE = 9; // frame where the hammer connects (the "bam")

/**
 * The "bam" mouse runs in from `from`, reaches `bam` and swings its big red
 * hammer DOWN to smash the item into its clay form (`onBam` fires at the moment
 * of impact), then runs out to `out` and removes itself (mouse.cpp
 * `call_in_a_mouse`). Drives the three MOUSEHAM cycles by frame: a looping run
 * while travelling, the one-shot smash while paused at the item. All points are
 * in `parent`'s coordinate space.
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
  if (!texs || texs.length < MOUSE_SMASH[1] || !spec) {
    onBam(); // no art — just morph, no mouse
    return;
  }
  const sprite = new PIXI.AnimatedSprite(texs);
  sprite.anchor.set(spec.anchor[0], spec.anchor[1]);
  sprite.scale.set(0.5);
  sprite.loop = false; // we drive frames manually per phase
  sprite.zIndex = 9997;
  sprite.position.set(from.x, from.y);
  parent.addChild(sprite);

  const inMs = 850; // run in
  const smashMs = 950; // pause at the item: wind up, slam, lift (the hammer comes down)
  const outMs = 600; // run back out
  const runFps = 12; // run-cycle playback speed
  const loopFrame = (range: [number, number], ms: number): number =>
    range[0] + (Math.floor((ms / 1000) * runFps) % (range[1] - range[0]));
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
      sprite.gotoAndStop(loopFrame(MOUSE_RUN_IN, now));
    } else if (now <= inMs + smashMs) {
      // Planted at the item: play the smash cycle once, hammer slamming down.
      sprite.position.set(bam.x, bam.y);
      const span = MOUSE_SMASH[1] - MOUSE_SMASH[0];
      const f = MOUSE_SMASH[0] + Math.min(span - 1, Math.floor(((now - inMs) / smashMs) * span));
      sprite.gotoAndStop(f);
      if (!bammed && f >= MOUSE_STRIKE) {
        bammed = true;
        onBam(); // the hammer connects
      }
    } else {
      if (!bammed) {
        bammed = true;
        onBam();
      }
      const since = now - inMs - smashMs;
      const t = Math.min(1, since / outMs);
      const e = t * t; // ease-in as it runs back out
      sprite.position.set(bam.x + (out.x - bam.x) * e, bam.y + (out.y - bam.y) * e);
      sprite.gotoAndStop(loopFrame(MOUSE_RUN_OUT, since));
      if (t >= 1) {
        PIXI.Ticker.shared.remove(step);
        sprite.destroy();
      }
    }
  };
  PIXI.Ticker.shared.add(step);
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
