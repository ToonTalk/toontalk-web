const c = window.__ttCity, m = c.model;
m.mode = 'walking';
const h = m.houses[1]; // house B (blue floor)
m.streetY = (Math.round(h.y / 32000)) * 32000;
m.cx = h.x; m.cy = m.streetY + 7201 + 1;
m.enterHouse();
m.ix = 0.55; m.iy = 0.5;
c.toolyIX = 0.22; c.toolyIY = 0.78;
