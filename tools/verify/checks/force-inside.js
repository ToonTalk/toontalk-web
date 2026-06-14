const c = window.__ttCity, m = c.model;
m.mode = 'walking';
const h = m.houses[1];
m.streetY = 1200; m.cy = 1200 - 90; m.cx = h.x;   // up at house B's door
m.enterHouse();                                    // -> inside (standing room view)
m.ix = 0.45; m.iy = 0.6;                            // standing on the floor
c.toolyIX = 0.3; c.toolyIY = 0.55;
