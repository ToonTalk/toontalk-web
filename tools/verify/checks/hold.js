const drag = window.__ttDrag, room = window.__ttRoom;
room.onPick('dusty', 640, 380);                 // take Dusty into hand
drag.onPointerMove({ global: { x: 640, y: 380 } }); // tool follows the cursor
room.setHand(640, 380);                          // hand cursor at the same point
