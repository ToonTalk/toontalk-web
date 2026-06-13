const c = window.__ttCity, m = c.model;
m.mode = 'walking';
m.streetY = 1200; m.cy = 1200;
m.cx = m.houses[1].x;   // stand at house B's x
m.landX = 100;          // copter far away (no re-board)
window.__ttEntered = null;
// observe the enter callback by checking active flips
window.__ttCity.keys.add('ArrowUp');   // walk north into the door
