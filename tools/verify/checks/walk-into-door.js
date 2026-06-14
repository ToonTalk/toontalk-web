const c = window.__ttCity, m = c.model;
m.mode = 'walking';
const h = m.houses[1];
m.streetY = 1200; m.cx = h.x; m.cy = 1200;
m.landX = 100;                 // copter far (no board)
c.keys.add('ArrowUp');         // walk north into the door
