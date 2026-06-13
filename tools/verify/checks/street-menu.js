const c = window.__ttCity, m = c.model;
m.mode = 'walking';
window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
