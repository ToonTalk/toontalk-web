const c = window.__ttCity, m = c.model;
m.mode = 'walking';
const h = m.houses[1];
m.streetY = 1200; m.cx = h.x; m.cy = 1200 - 90;
m.enterHouse();          // now inside, standing
m.iy = 0.6;
c.keys.add('ArrowDown'); // walk to the front of the floor -> sit
