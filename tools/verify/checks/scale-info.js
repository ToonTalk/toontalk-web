const w = window.__ttWorld;
const s = w.all().find(t => t.id === window.__scaleId);
return { exists: !!s, tilt: s && s.tilt };
