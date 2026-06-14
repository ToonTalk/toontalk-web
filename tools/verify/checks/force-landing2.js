const c = window.__ttCity, m = c.model;
const h = m.houses[1];                 // centre house, whatever the city size
m.mode = 'flying'; m.scale = 101; m.cx = h.x; m.cy = h.y;
m.fly(0, 0, -1, 200);                  // → landing on the road south of the block
m.landY = 0.35; m.cx = h.x;            // mid-descent, lined up with the houses
