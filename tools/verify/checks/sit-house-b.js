const c = window.__ttCity, m = c.model;
m.mode='walking';
const h = m.houses[1]; // style 'b' (blue)
m.streetY = Math.round(h.y/32000)*32000; m.cx=h.x; m.cy=m.streetY+7201+1;
m.enterHouse();           // -> inside
window.dispatchEvent(new KeyboardEvent('keydown',{key:'s'})); // sit -> floor
