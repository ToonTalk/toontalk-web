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
import { Bird, hatchFromNest } from './model/bird';
import { Wand } from './model/wand';
import { Dusty } from './model/dusty';
import { Bomb } from './model/bomb';
import { Scale, recomputeScales } from './model/scale';
import { Robot } from './model/robot';
import { Truck } from './model/truck';
import { House, runHouse } from './model/house';
import { Notebook } from './model/notebook';
import { Pumpy } from './model/pumpy';
import { Trainer } from './model/trainer';
import { resolveDrop } from './model/interactions';
import { serialize, loadWorld } from './model/persistence';
import { saveMainNotebook, loadMainNotebook, clearMainNotebook } from './model/notebook-store';
import { Renderer } from './view/renderer';
import { ThingView } from './view/thing-view';
import { createThingView } from './view/view-factory';
import { renderThingDisplay } from './view/display';
import { floorCamera, FLOOR_W, FLOOR_H, clampFloorCamera } from './view/floor-camera';
import { BoxView } from './view/box-view';
import { loadAssets } from './view/assets';
import { Room, loadRoomTextures } from './view/room';
import { loadAnimations, playOnce, flyBird } from './view/animation';
import { DragController } from './input/drag-controller';
import { InputTracker } from './input/input-state';
import { updateSensors } from './model/sensor-runtime';
import { makeSensor, SENSOR_TYPES } from './model/sensor';
import { CityScene } from './city/city-scene';
import { loadCityAssets } from './city/city-sprites';
import { BLOCK_W, BLOCK_H } from './city/city-model';
import { getRenderMode, themeFor, type RenderMode } from './config/render-mode';

/**
 * A human-readable build tag shown in the HUD so you can confirm a hard-refresh
 * actually picked up the latest code (vs. a cached page). Bump it whenever you
 * want a visible "this is the new version" marker.
 */
const BUILD = 'build 2026-06-15j (held tools sit in the hand grip)';

function setHud(text: string): void {
  const hud = document.getElementById('hud');
  if (hud) hud.textContent = text;
}

async function start(): Promise<void> {
  const mode: RenderMode = getRenderMode();
  const theme = themeFor(mode);
  // The floor starts faithful & near-empty: just Tooly's three tools. The full
  // element showcase is opt-in for development via ?demo=1.
  const demoMode = new URLSearchParams(location.search).get('demo') === '1';

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
  // Picking a tool out of Tooly puts it straight into the hand (like the
  // original); picking an element drops it on the floor to drag.
  const room = new Room(renderer, roomTextures, textures, theme, (key, x, y) => {
    const made = spawnTool(key, x, y);
    if (made instanceof Wand || made instanceof Dusty || made instanceof Pumpy) {
      dragController.holdTool(made);
    }
  });
  (window as unknown as { __ttRoom?: unknown }).__ttRoom = room;
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
  (window as unknown as { __ttWorld?: unknown }).__ttWorld = world;
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

  const dragController = new DragController(
    world,
    renderer,
    views,
    (dragged, target, ctx) => {
      const result = resolveDrop(world, dragged, target, ctx);
      // One-shot effects at the action site.
      if (result === 'exploded') {
        playOnce('explode', renderer.thingLayer, dragged.x, dragged.y);
      } else if (result === 'erased' || result === 'sucked') {
        const at = target ?? dragged;
        playOnce('dusty-suck', renderer.thingLayer, at.x, at.y);
      } else if ((result === 'filled' || result === 'combined') && target instanceof Box && ctx.holeIndex != null) {
        // The dropped item shrinks to fit the hole.
        const bv = views.get(target.id);
        if (bv instanceof BoxView) bv.popHole(ctx.holeIndex);
      } else if (result === 'delivered' && target instanceof Bird && target.nests.length > 0) {
        // The bird flies the gift to its nest(s) and back.
        const nest0 = target.nests[0]!;
        flyBird(renderer.thingLayer, target.x, target.y, nest0.x, nest0.y,
          views.get(target.id)?.container);
        for (const nest of target.nests.slice(1)) {
          flyBird(renderer.thingLayer, target.x, target.y, nest.x, nest.y);
        }
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
  (window as unknown as { __ttDrag?: unknown }).__ttDrag = dragController;

  // Houses are running processes: each tick, every house offers its box to its
  // robot team and the first matching robot runs (so a house keeps reacting).
  setInterval(() => {
    for (const t of world.all()) if (t instanceof House) runHouse(world, t);
  }, 800);

  // The outdoor city: fly the helicopter, land it, walk around. The app boots
  // into the city; the room (inside a house) is the existing World view.
  // Walking up to a house and entering it is a later step — for now the
  // backquote (`) key is a dev seam to flip between the city and the room so
  // both stay reachable and testable.
  const cityAssets = await loadCityAssets(theme);
  const city = new CityScene(renderer, cityAssets, {
    // Walking up to a house door, or sitting on the grass ('s'), drops you onto
    // a working floor — the room/World view. (Distinct per-house contents is a
    // later step; for now every house + the grass share the one floor.)
    onEnter: (where, house) =>
      enterRoom(where === 'house' ? (house?.style ?? 'a') : 'c', city.model.ix, city.model.iy),
    // Escape while walking the street raises the street menu.
    onEscape: () => showStreetMenu(),
    // The room standing view shows the working floor's things in miniature, at
    // their floor positions (normalised to the canvas the floor view fills).
    floorItems: () => {
      // Positions are normalised to the whole (large) floor, so the room view
      // shows the entire work area in miniature and you can sit anywhere on it.
      return world.all().map((t) => ({
        fx: Math.max(0.02, Math.min(0.98, t.x / FLOOR_W)),
        fy: Math.max(0.05, Math.min(0.98, t.y / FLOOR_H)),
        node: renderThingDisplay(t, textures, theme, 64),
      }));
    },
  });
  (window as unknown as { __ttCity?: unknown }).__ttCity = city;

  // Sensors: one input tracker feeds a per-frame snapshot to every sensor pad in
  // the world. handVisible follows the room hand (hidden while flying the city);
  // the address comes from the current city block.
  const input = new InputTracker(renderer.view, () => renderer.width, () => renderer.height);
  input.handVisible = () => !city.isActive;
  input.address = () => ({
    road: Math.max(0, Math.floor(city.model.cx / BLOCK_W)),
    street: Math.max(0, Math.floor(city.model.cy / BLOCK_H)),
  });
  (window as unknown as { __ttInput?: unknown }).__ttInput = input;
  renderer.app.ticker.add(() => updateSensors(world, input.sample(renderer.app.ticker.deltaMS)));

  const CITY_HUD =
    `ToonTalk City — fly · land · walk\n` +
    `click the city to take the controls (the mouse is captured; Esc = menu)\n` +
    `mouse / arrow keys steer · left button / ↓ descends · right button / Shift / ↑ climbs\n` +
    `street: walk any direction (every street) · up to a door enters the house · click or 's' sits on the grass\n` +
    `in the room: click (or walk to the front / 's') to sit & work · Esc steps back out\n` +
    `walk into the parked copter to take off · H calls the helicopter · Esc = leave menu`;

  /** Show the city (street/flying); hide the room/World and its input. */
  function showCity(): void {
    city.setActive(true);
    room.setVisible(false);
    renderer.thingLayer.visible = false;
    dragController.setEnabled(false);
    setHud(CITY_HUD);
  }
  /** Point the floor camera at a spot on the big floor (top-left = world point),
   * clamped to the walls; pan the things + baseplate, leave the toolbox on
   * screen. */
  function setFloorCamera(camX: number, camY: number): void {
    const c = clampFloorCamera(camX, camY, renderer.width, renderer.height);
    floorCamera.x = c.x;
    floorCamera.y = c.y;
    renderer.thingLayer.position.set(-c.x, -c.y);
    room.setFloorPan(c.x, c.y);
  }
  (window as unknown as { __ttSetFloorCamera?: unknown }).__ttSetFloorCamera = setFloorCamera;
  /** Sit down — switch to the working floor (room/World view), with the floor
   * coloured to match the house you entered (grass uses the default tan), and
   * the floor scrolled so where you sat (`sitFx`,`sitFy` ∈ 0..1 of the whole
   * floor) is centred — the toolbox stays at hand, things stay where you left
   * them. */
  function enterRoom(style: 'a' | 'b' | 'c' = 'a', sitFx = 0.5, sitFy = 0.5): void {
    room.setFloorStyle(style);
    setFloorCamera(sitFx * FLOOR_W - renderer.width / 2, sitFy * FLOOR_H - renderer.height / 2);
    city.setActive(false);
    room.setVisible(true);
    renderer.thingLayer.visible = true;
    dragController.setEnabled(true);
    updateHud('none');
  }
  /** Stand up from the floor and walk the street again (clear of the door). */
  function returnToStreet(): void {
    city.resume();
    room.setVisible(false);
    renderer.thingLayer.visible = false;
    dragController.setEnabled(false);
    setHud(CITY_HUD);
  }
  // Dev seam: backquote flips city ⇄ room directly.
  window.addEventListener('keydown', (ev) => {
    if (ev.key === '`') (city.isActive ? enterRoom() : returnToStreet());
  });

  // --- the Escape menus (leave / save / cancel) ---------------------------
  /** A simple modal overlay of buttons (the street / sitting menu). */
  interface MenuOption {
    label: string;
    onClick: () => void;
  }
  function menuOpen(): boolean {
    return document.getElementById('tt-menu') != null;
  }
  function showMenu(title: string, options: MenuOption[]): void {
    if (menuOpen()) return;
    const overlay = document.createElement('div');
    overlay.id = 'tt-menu';
    overlay.style.cssText =
      'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.45);z-index:9999;font-family:sans-serif';
    const panel = document.createElement('div');
    panel.style.cssText =
      'background:#2b3037;color:#fff;border:2px solid #565e69;border-radius:12px;' +
      'padding:22px 26px;min-width:220px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.5)';
    const h = document.createElement('div');
    h.textContent = title;
    h.style.cssText = 'font-weight:bold;font-size:18px;margin-bottom:16px';
    panel.appendChild(h);
    const close = (): void => overlay.remove();
    for (const opt of options) {
      const b = document.createElement('button');
      b.textContent = opt.label;
      b.style.cssText =
        'display:block;width:100%;margin:8px 0;padding:10px 14px;font-size:15px;' +
        'background:#474e57;color:#fff;border:1px solid #6b7280;border-radius:7px;cursor:pointer';
      b.onmouseenter = () => (b.style.background = '#5a626c');
      b.onmouseleave = () => (b.style.background = '#474e57');
      b.onclick = () => {
        close();
        opt.onClick();
      };
      panel.appendChild(b);
    }
    overlay.appendChild(panel);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(); // click outside = cancel
    });
    document.body.appendChild(overlay);
  }

  function showStreetMenu(): void {
    showMenu('In the city', [
      { label: 'Take off ✈', onClick: () => city.model.callHelicopter() },
      { label: 'Save', onClick: () => document.getElementById('save-btn')?.click() },
      { label: 'Keep exploring', onClick: () => {} },
    ]);
  }
  function showRoomMenu(): void {
    showMenu('Sitting down', [
      { label: 'Stand up', onClick: () => returnToStreet() },
      { label: 'Save', onClick: () => document.getElementById('save-btn')?.click() },
      { label: 'Keep working', onClick: () => {} },
    ]);
  }
  // Escape in the room (when not training) opens the room menu.
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !city.isActive && !trainer.active && !menuOpen()) {
      ev.preventDefault();
      showRoomMenu();
    }
  });

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

  // Pull a fresh element out of the toolbox at (x, y) — an infinite stack, so
  // the toolbox keeps its copy. Spawned under the cursor; the drag controller
  // (same pointerdown, bubbled) then picks it up so it drags out of the box.
  function spawnTool(key: string, sx: number, sy: number): Thing | null {
    // The toolbox is screen-fixed; convert the click to world coords so a fresh
    // element appears under the cursor even when the floor is scrolled.
    const x = sx + floorCamera.x;
    const y = sy + floorCamera.y;
    let made: Thing | null = null;
    switch (key) {
      case 'number': made = world.add(new NumberThing({ value: 1, x, y })); break;
      case 'text': made = world.add(new TextThing({ value: 'a', x, y })); break;
      case 'box': made = world.add(new Box({ size: 1, x, y })); break; // cubby.h: 1 hole by default
      case 'nest': {
        // A fresh nest holds an egg (the nest view draws it). After a beat it
        // hatches and the bird flies to a nearby spot (bird.cpp hatch).
        const nest = new Nest({ x, y });
        made = world.add(nest);
        window.setTimeout(() => {
          if (!world.all().includes(nest)) return; // nest was picked up/removed
          const bx = x + 120;
          const by = y - 80;
          const bird = hatchFromNest(world, nest, bx, by);
          if (bird) flyBird(renderer.thingLayer, x, y, bx, by, views.get(bird.id)?.container);
        }, 650);
        break;
      }
      case 'scale': made = world.add(new Scale({ x, y })); break;
      case 'robot': made = world.add(new Robot({ x, y })); break;
      case 'bomb': made = world.add(new Bomb({ x, y })); break;
      case 'wand': made = world.add(new Wand({ x, y })); break;
      case 'dusty': made = world.add(new Dusty({ x, y })); break;
      case 'pumpy': made = world.add(new Pumpy({ x, y })); break;
      case 'truck': made = world.add(new Truck({ x, y })); break;
      case 'bird': {
        const nest = new Nest({ x: x + 90, y: y + 40 });
        world.add(nest);
        made = world.add(new Bird({ nests: [nest], x, y }));
        break;
      }
      default: return null;
    }
    updateHud('none');
    return made;
  }

  // The faithful initial floor: you sit down and your toolbox (Tooly) is there
  // with the three hand tools that come out of it — the magic wand (copy), Dusty
  // the vacuum (remove), and Pumpy the pump (resize). Everything else lives in
  // the toolbox/notebook chrome until you pull it out.
  function seedFloor(): void {
    // The hand tools (wand, Dusty, Pumpy) LIVE WITH the toolbox now (chrome, at
    // hand — see room.ts), so the working floor starts empty; you pull tools and
    // elements out of the toolbox kit as you need them.
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
    world.add(new Bird({ nests: [nest], x: 560, y: 300 }));

    world.add(new Wand({ x: 520, y: 460 }));
    // Dusty the vacuum: drop on a thing to erase it (→ wildcard for robots).
    world.add(new Dusty({ x: 410, y: 470 }));
    // The bomb: drop on a thing to blow it up (the bomb is consumed).
    world.add(new Bomb({ x: 300, y: 470 }));
    // The truck: drop a robot + a box into it and it builds a running house.
    world.add(new Truck({ x: 470, y: 560 }));
    // Pumpy the resize tool: drop on a thing to grow/shrink it (space cycles modes).
    world.add(new Pumpy({ x: 380, y: 470 }));
    // A notebook with two pages: drop things on it to file pages, drop a number
    // to flip to that page, drag the page off to pull a copy out.
    const notebook = new Notebook({ x: 620, y: 580 });
    notebook.store(new NumberThing({ value: 42 }));
    notebook.store(new TextThing({ value: 'hi' }));
    world.add(notebook);

    // A notebook full of sensors (like page 4 of the original first notebook):
    // drag a page off to pull out a *live* sensor pad. Plus two loose sensors on
    // the floor so the live updating is visible right away.
    const sensors = new Notebook({ x: 760, y: 580 });
    for (const t of SENSOR_TYPES) sensors.store(makeSensor(t));
    world.add(sensors);
    world.add(makeSensor('random', { x: 120, y: 360 }));
    world.add(makeSensor('mouse-vx', { x: 120, y: 470 }));

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

    // "Swap if the first is less than the second": a scale-guarded robot that
    // swaps the two numbers when the balance tips right (first < second). Drop
    // it on the box to run it.
    world.add(
      new Robot({
        condition: ['number', 'scale', 'number'],
        exactValues: [null, new Scale({ tilt: 'right' }), null],
        actions: [{ type: 'swap', a: 0, b: 2 }],
        x: 1000,
        y: 470,
      }),
    );
    const swapBox = new Box({
      holes: [new NumberThing({ value: 3 }), new Scale(), new NumberThing({ value: 8 })],
      x: 1000,
      y: 330,
    });
    recomputeScales(swapBox);
    world.add(swapBox);

    // Module demo (the recursion primitive): a house whose robot, each tick,
    // pulls a *copy* of page 1 of its module (the number 1) into the empty hole
    // and adds it to the accumulator — so the counter climbs, driven entirely by
    // the module it was given. `fromModule` is how a house's robots draw on the
    // notebook handed to the truck that built them.
    const moduleNb = new Notebook({ pages: [new NumberThing({ value: 1 })] });
    const counterBox = new Box({ holes: [new NumberThing({ value: 0 }), null] });
    const counterRobot = new Robot({
      condition: ['number', null],
      actions: [
        { type: 'fromModule', page: 1, to: 1 },
        { type: 'combine', from: 1, to: 0 },
      ],
    });
    world.add(new House({ x: 1000, y: 590, robot: counterRobot, box: counterBox, module: moduleNb }));
  }

  // The faithful ToonTalk save model: **only the main notebook persists**. The
  // floor is transient working space — reseeded fresh each load — while the main
  // notebook (the one in your toolbox) keeps whatever you file onto it. A fresh
  // main notebook starts with a single welcome page.
  function seedMainNotebook(): Notebook {
    const nb = new Notebook({ x: 500, y: 600, isMain: true });
    nb.store(new TextThing({ value: 'Pictures' })); // the original opens to its "Pictures" page
    return nb;
  }
  function installMainNotebook(): Notebook {
    const nb = loadMainNotebook() ?? seedMainNotebook();
    nb.moveTo({ x: FLOOR_W / 2, y: FLOOR_H / 2 + 200 }); // near the floor centre, below the tools
    world.add(nb);
    return nb;
  }

  if (demoMode) seedDemo();
  else seedFloor();
  let mainNotebook = installMainNotebook();

  // Saving = filing onto the main notebook. Persist it whenever it changes;
  // identity-check so the ~60fps sensor ticks don't trigger a save each frame.
  world.subscribe((event) => {
    if (event.type === 'changed' && event.thing === mainNotebook) saveMainNotebook(mainNotebook);
  });

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
    clearMainNotebook();
    world.clear();
    if (demoMode) seedDemo();
    else seedFloor();
    mainNotebook = installMainNotebook();
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
      `ToonTalk Web — Phase 4 · ${BUILD}\n` +
        `render mode: ${mode}\n` +
        `things: ${world.size}\n` +
        `trained robot + 2-number box → it adds · UNtrained robot + filled box → train it\n` +
        `numbers add · text joins · box holes fill · bird→nest · wand copies · dusty sucks/erases · bomb destroys · robot on robot → team\n` +
        `hold a number, press + − ×(x) ÷(/) % ^ = to set its op · − negates · number on a text pad → digits (blank) or next letter (non-blank)\n` +
        `a scale between two holes tips toward the bigger (robots can match the tilt) · drop a box on another box's edge to join` +
        (lastResult && lastResult !== 'none' && lastResult !== 'train'
          ? `\nlast drop: ${lastResult}`
          : ''),
    );
  }
  updateHud();

  // Boot into the outdoor city (flying the helicopter).
  showCity();

  // Signals tools (tools/verify/snap.mjs) that boot is fully complete.
  (window as unknown as { __ttReady?: boolean }).__ttReady = true;
}

start().catch((err) => {
  console.error(err);
  setHud(`Error: ${err instanceof Error ? err.message : String(err)}`);
});
