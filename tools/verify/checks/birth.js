const room = window.__ttRoom, drag = window.__ttDrag, w = window.__ttWorld;
room.onPick('box', 300, 300);
const box = w.all().find(t => t.kind === 'box');
const v = drag.views.get(box.id);
return { scaleAtBirth: Math.round(v.container.scale.x * 100) / 100 };
