const c = window.__ttCity, m = c.model;
const h = m.houses[1];
m.mode = 'walking';
m.cx = h.x; m.cy = h.y - 6000; m.streetY = Math.floor(m.cy / 32000) * 32000;
m.parkedX = h.x - 30000; m.parkedY = m.streetY; m.landX = m.parkedX;
c.toolyX = h.x + 6000; c.streetCamCx = m.cx; c.streetCamCy = m.cy;
