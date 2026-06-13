const c = window.__ttCity, m = c.model;
m.mode = 'walking';
m.streetY = 1200; m.cy = 1200; m.cx = 1320;
m.landX = 200;           // copter far away — no re-board
c.toolyX = 1390;
window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
