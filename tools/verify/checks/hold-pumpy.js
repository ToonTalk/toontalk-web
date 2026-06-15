const drag = window.__ttDrag, room = window.__ttRoom;
room.onPick('pumpy', 640, 380);
drag.onPointerMove({ global: { x: 640, y: 380 } });
room.setHand(640, 380);
