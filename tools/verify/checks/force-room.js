const c = window.__ttCity, m = c.model;
m.mode = 'walking';
const h = m.houses[1]; // house B (blue floor)
m.cx = h.x; m.cy = h.y; // standing at the door
m.enterHouse();
m.ix = 0.55; m.iy = 0.5;
c.toolyIX = 0.22; c.toolyIY = 0.78;
