const room = window.__ttRoom, drag = window.__ttDrag, w = window.__ttWorld;
room.onPick('box', 320, 300);
const box = w.all().find(t => t.kind === 'box');
const v = drag.views.get(box.id);
const layer = v.container.parent;
const kinds = layer.children.map(c => (c.constructor ? c.constructor.name : '?'));
return { hiddenAtStart: !v.container.visible, kinds };
