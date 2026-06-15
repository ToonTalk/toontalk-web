const w = window.__ttWorld, room = window.__ttRoom;
room.onPick('box', 360, 300);
const box = w.all().find(t => t.kind === 'box');
box.erased = true;
w.notifyChanged(box);
