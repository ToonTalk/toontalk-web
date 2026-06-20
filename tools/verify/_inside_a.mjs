const c = window.__ttCity;
const app = window.__ttApp;
c.setActive(true);
c.model.mode = 'inside';
c.model.insideHouse = { style: 'a' };
c.model.ix = 0.5; c.model.iy = 0.72; // real standing position when you enter
for (let i = 0; i < 6; i++) { app.ticker.update(); await new Promise((r) => setTimeout(r, 16)); }
