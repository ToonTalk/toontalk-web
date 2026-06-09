/**
 * ToonTalk Web — Phase 1 bootstrap.
 *
 * Wires the pure model (World) to the view (Renderer + ThingViews), loads the
 * original art, seeds real ToonTalk objects (numbers, text, a box) plus a few
 * sprite placeholders, and resolves drops through the model. Model and view
 * stay in sync purely through World events.
 */

import { World } from './model/world';
import type { Thing } from './model/thing';
import { NumberThing } from './model/number';
import { TextThing } from './model/text';
import { Box } from './model/box';
import { Nest } from './model/nest';
import { Bird } from './model/bird';
import { Wand } from './model/wand';
import { Dusty } from './model/dusty';
import { Bomb } from './model/bomb';
import { Scale, recomputeScales } from './model/scale';
import { Robot } from './model/robot';
import { Trainer } from './model/trainer';
import { resolveDrop } from './model/interactions';
import { serialize, loadWorld } from './model/persistence';
import { Renderer } from './view/renderer';
import { ThingView } from './view/thing-view';
import { createThingView } from './view/view-factory';
import { BoxView } from './view/box-view';
import { loadAssets } from './view/assets';
import { Room, loadRoomTextures } from './view/room';
import { loadAnimations, playOnce, flyBird } from './view/animation';
import { DragController } from './input/drag-controller';
import { getRenderMode, themeFor, type RenderMode } from './config/render-mode';

function setHud(text: string): void {
  const hud = document.getElementById('hud');
  if (hud) hud.textContent = text;
}

async function start(): Promise<void> {
  const mode: RenderMode = getRenderMode();
  const theme = themeFor(mode);

  const renderer = new Renderer(theme);
  const container = document.getElementById('game-container');
  if (!container) throw new Error('#game-container missing');
  container.appendChild(renderer.view);

  setHud('Loading ToonTalk graphics…');
  const { textures } = await loadAssets(theme);
  await loadAnimations(theme);

  // The ToonTalk room: tan floor, toolbox, notebook, tools, and the hand cursor.
  // Clicking a toolbox/tool icon pulls a fresh element onto the floor.
  const roomTextures = await loadRoomTextures(theme);
  const room = new Room(renderer, roomTextures, textures, theme, (key, x, y) => spawnTool(key, x, y));
  window.addEventListener('resize', () => room.resize());

  // Replace the OS cursor with ToonTalk's hand, which tracks the pointer.
  const cursorStyles = renderer.app.renderer.events.cursorStyles;
  cursorStyles.default = 'none';
  cursorStyles.grab = 'none';
  cursorStyles.grabbing = 'none';
  cursorStyles.pointer = 'none';
  renderer.view.style.cursor = 'none';
  renderer.app.stage.on('pointermove', (e) => room.setHand(e.global.x, e.global.y));

  // Debug hook: lets tools pause the render loop to capture a still of the
  // (otherwise continuously animating) canvas. Harmless in production.
  (window as unknown as { __ttApp?: unknown }).__ttApp = renderer.app;

  // Model <-> view bookkeeping.
  const world = new World();
  const views = new Map<string, ThingView>();

  world.subscribe((event) => {
    switch (event.type) {
      case 'added': {
        const view = createThingView(event.thing, textures, theme);
        views.set(event.thing.id, view);
        renderer.thingLayer.addChild(view.container);
        break;
      }
      case 'moved':
        views.get(event.thing.id)?.syncPosition();
        break;
      case 'changed':
        views.get(event.thing.id)?.refresh();
        break;
      case 'removed': {
        const view = views.get(event.id);
        if (view) {
          view.destroy();
          views.delete(event.id);
        }
        break;
      }
    }
  });

  const trainer = new Trainer(world);

  // Drive the hand cursor's pose by what it's holding: the wand → holding-wand
  // (and the floor wand is hidden, since it's now in the cursor), any other
  // thing → grab, nothing → point.
  let carriedWand: ThingView | undefined;
  const onGrab = (thing: Thing | null): void => {
    if (thing instanceof Wand) {
      room.setPose('holdwand');
      carriedWand = views.get(thing.id);
      if (carriedWand) carriedWand.container.alpha = 0;
    } else if (thing) {
      room.setPose('grab');
    } else {
      room.setPose('open');
      carriedWand = undefined; // its alpha is restored by setDragging(false)
    }
  };

  new DragController(
    world,
    renderer,
    views,
    (dragged, target, ctx) => {
      const result = resolveDrop(world, dragged, target, ctx);
      // One-shot effects at the action site.
      if (result === 'exploded') {
        playOnce('explode', renderer.thingLayer, dragged.x, dragged.y);
      } else if (result === 'erased') {
        const at = target ?? dragged;
        playOnce('dusty-suck', renderer.thingLayer, at.x, at.y);
      } else if ((result === 'filled' || result === 'combined') && target instanceof Box && ctx.holeIndex != null) {
        // The dropped item shrinks to fit the hole.
        const bv = views.get(target.id);
        if (bv instanceof BoxView) bv.popHole(ctx.holeIndex);
      } else if (result === 'delivered' && target instanceof Bird && target.nest) {
        // The bird flies the gift to its nest and back.
        flyBird(renderer.thingLayer, target.x, target.y, target.nest.x, target.nest.y,
          views.get(target.id)?.container);
      }
      if (result === 'train') {
        const robot = (dragged instanceof Robot ? dragged : target) as Robot;
        const box = dragged instanceof Box ? dragged : (target as Box);
        trainer.start(robot, box);
        // Sit the robot just above the box it's learning from.
        world.moveThing(robot.id, { x: box.x, y: box.y - 96 });
      }
      updateHud(result);
    },
    trainer,
    (from, to) => {
      trainer.recordCombine(from, to);
      updateHud('train');
    },
    textures,
    theme,
    onGrab,
  );

  // Escape finishes training (the original ToonTalk gesture). Backspace cancels
  // — there's no "cancel training" in the manual, so this is a web-only helper.
  window.addEventListener('keydown', (ev) => {
    if (!trainer.active) return;
    if (ev.key === 'Escape') {
      const box = trainer.box;
      const robot = trainer.finish();
      if (robot && box) world.moveThing(robot.id, { x: box.x + 170, y: box.y - 96 });
      updateHud('none');
    } else if (ev.key === 'Backspace') {
      ev.preventDefault();
      trainer.cancel();
      updateHud('none');
    }
  });

  const STORAGE_KEY = 'toontalk-world-v1';

  // Pull a fresh element out of the toolbox at (x, y) — an infinite stack, so
  // the toolbox keeps its copy. Spawned under the cursor; the drag controller
  // (same pointerdown, bubbled) then picks it up so it drags out of the box.
  function spawnTool(key: string, x: number, y: number): void {
    switch (key) {
      case 'number': world.add(new NumberThing({ value: 1, x, y })); break;
      case 'text': world.add(new TextThing({ value: 'a', x, y })); break;
      case 'box': world.add(new Box({ size: 2, x, y })); break;
      case 'nest': {
        const nest = new Nest({ x, y });
        world.add(nest);
        world.add(new Bird({ nest, x: x - 90, y: y - 40 }));
        break;
      }
      case 'scale': world.add(new Scale({ x, y })); break;
      case 'robot': world.add(new Robot({ x, y })); break;
      case 'bomb': world.add(new Bomb({ x, y })); break;
      case 'wand': world.add(new Wand({ x, y })); break;
      case 'dusty': world.add(new Dusty({ x, y })); break;
      default: return;
    }
    updateHud('none');
  }

  function seedDemo(): void {
    world.add(new NumberThing({ value: 5, x: 180, y: 140 }));
    world.add(new NumberThing({ value: 3, x: 320, y: 140 }));
    world.add(new NumberThing({ value: 2, operation: '*', x: 460, y: 140 }));
    world.add(new TextThing({ value: 'Hello ', x: 200, y: 260 }));
    world.add(new TextThing({ value: 'World', x: 360, y: 260 }));
    world.add(new Box({ size: 2, x: 300, y: 400 }));

    const nest = new Nest({ x: 700, y: 380 });
    world.add(nest);
    world.add(new Bird({ nest, x: 560, y: 300 }));

    world.add(new Wand({ x: 520, y: 460 }));
    // Dusty the vacuum: drop on a thing to erase it (→ wildcard for robots).
    world.add(new Dusty({ x: 410, y: 470 }));
    // The bomb: drop on a thing to blow it up (the bomb is consumed).
    world.add(new Bomb({ x: 300, y: 470 }));

    // Pre-trained "adder" robot + a ready box to run it on.
    world.add(
      new Robot({
        condition: ['number', 'number'],
        actions: [{ type: 'combine', from: 1, to: 0 }],
        x: 660,
        y: 470,
      }),
    );
    world.add(
      new Box({ holes: [new NumberThing({ value: 4 }), new NumberThing({ value: 5 })], x: 660, y: 330 }),
    );

    // Fresh (untrained) robot + a box to teach it by example.
    world.add(new Robot({ x: 820, y: 470 }));
    world.add(
      new Box({ holes: [new NumberThing({ value: 6 }), new NumberThing({ value: 7 })], x: 820, y: 330 }),
    );

    // A balance weighing 3 against 5: it tips toward the bigger number (right).
    const scaleBox = new Box({
      holes: [new NumberThing({ value: 3 }), new Scale(), new NumberThing({ value: 5 })],
      x: 180,
      y: 560,
    });
    recomputeScales(scaleBox);
    world.add(scaleBox);
  }

  // Restore the last session if there is one; otherwise seed the demo world.
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      loadWorld(world, saved);
    } catch {
      seedDemo();
    }
  } else {
    seedDemo();
  }

  // Autosave on every change.
  world.subscribe(() => localStorage.setItem(STORAGE_KEY, serialize(world)));

  // Save / Load / Reset controls.
  document.getElementById('save-btn')?.addEventListener('click', () => {
    const blob = new Blob([serialize(world)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'toontalk-world.json';
    a.click();
    URL.revokeObjectURL(url);
  });
  const loadInput = document.getElementById('load-input') as HTMLInputElement | null;
  document.getElementById('load-btn')?.addEventListener('click', () => loadInput?.click());
  loadInput?.addEventListener('change', async () => {
    const file = loadInput.files?.[0];
    if (!file) return;
    try {
      loadWorld(world, await file.text());
      updateHud('none');
    } catch {
      setHud('Could not load that file.');
    }
    loadInput.value = '';
  });
  document.getElementById('reset-btn')?.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    world.clear();
    seedDemo();
    updateHud('none');
  });

  // Render-mode toggle link.
  const toggle = document.getElementById('mode-toggle') as HTMLAnchorElement | null;
  if (toggle) {
    const next = mode === 'faithful' ? 'modern' : 'faithful';
    toggle.textContent = `mode: ${mode} → switch to ${next}`;
    toggle.href = `?mode=${next}`;
  }

  function updateHud(lastResult?: string): void {
    if (trainer.active) {
      setHud(
        `TRAINING (${trainer.stepCount} step${trainer.stepCount === 1 ? '' : 's'})\n` +
          `Demonstrate: drag from one box hole onto another to combine them.\n` +
          `Esc = done (the robot learns it) · Backspace = cancel`,
      );
      return;
    }
    setHud(
      `ToonTalk Web — Phase 4\n` +
        `render mode: ${mode}\n` +
        `things: ${world.size}\n` +
        `trained robot + 2-number box → it adds · UNtrained robot + filled box → train it\n` +
        `numbers add · text joins · box holes fill · bird→nest · wand copies · dusty erases · bomb destroys\n` +
        `hold a number, press + − ×(x) ÷(/) % ^ = to set its op · − negates · number on a blank text pad → digits\n` +
        `a scale between two holes tips toward the bigger (robots can match the tilt) · drop a box on another box's edge to join` +
        (lastResult && lastResult !== 'none' && lastResult !== 'train'
          ? `\nlast drop: ${lastResult}`
          : ''),
    );
  }
  updateHud();
}

start().catch((err) => {
  console.error(err);
  setHud(`Error: ${err instanceof Error ? err.message : String(err)}`);
});
