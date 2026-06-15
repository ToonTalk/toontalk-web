const drag = window.__ttDrag, room = window.__ttRoom, w = window.__ttWorld;
room.onPick('dusty', 500, 400);                  // Dusty (suck) in hand
room.onPick('box', 660, 420);
const box = w.all().find(t => t.kind === 'box');
drag.applyHeldTool(box.x, box.y);                // suck the box
const stomach1 = drag.heldTool.thing.stomach.length;
drag.heldTool.thing.mode = 'reverse';
drag.applyHeldTool(99999, 99999);                // spit onto empty floor
const stomach2 = drag.heldTool.thing.stomach.length;
const spatBack = w.all().some(t => t.kind === 'box');
const heldStill = !!drag.heldTool;
// erase a fresh box and inspect its view
room.onPick('box', 300, 300);
const box2 = w.all().filter(t => t.kind === 'box').pop();
drag.heldTool.thing.mode = 'erase';
drag.applyHeldTool(box2.x, box2.y);
const v = drag.views.get(box2.id);
return { stomach1, stomach2, spatBack, heldStill, erased: box2.erased, viewAlpha: v.container.alpha };
