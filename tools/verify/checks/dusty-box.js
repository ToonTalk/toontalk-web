const drag = window.__ttDrag, room = window.__ttRoom, w = window.__ttWorld;
room.onPick('dusty', 500, 400);                  // take Dusty (suck) into hand
const heldKind = drag.heldTool && drag.heldTool.thing.kind;
const guard = drag.justGrabbedTool;              // pickup guard set
room.onPick('box', 660, 420);                    // spawn an EMPTY box
const box = w.all().find(t => t.kind === 'box');
drag.applyHeldTool(box.x, box.y);                // suck the whole box
const boxGone = !w.all().some(t => t.id === box.id);
const stomach = drag.heldTool ? drag.heldTool.thing.stomach.length : -1;
const heldAfter = drag.heldTool && drag.heldTool.thing.kind;
drag.applyHeldTool(99999, 99999);                // click empty floor → drop
const heldAfterEmpty = drag.heldTool ? drag.heldTool.thing.kind : null;
return { heldKind, guard, boxGone, stomach, heldAfter, heldAfterEmpty };
