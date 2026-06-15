const drag = window.__ttDrag, room = window.__ttRoom, w = window.__ttWorld;
room.onPick('dusty', 500, 400);                 // take Dusty into hand
const heldAfterPick = !!drag.heldTool && drag.heldTool.thing.kind;
drag.applyHeldTool(99999, 99999);               // "click" empty floor
const heldAfterEmpty = !!drag.heldTool && drag.heldTool.thing.kind;
room.onPick('number', 650, 400);                // spawn a target number
const num = w.all().find(t => t.kind === 'number');
drag.applyHeldTool(num.x, num.y);               // apply Dusty (suck) on it
const numGone = !w.all().some(t => t.id === num.id);
const heldAfterApply = !!drag.heldTool && drag.heldTool.thing.kind;
drag.putDownTool();                             // Escape
const heldAfterEsc = !!drag.heldTool && drag.heldTool.thing.kind;
return { heldAfterPick, heldAfterEmpty, numGone, heldAfterApply, heldAfterEsc };
