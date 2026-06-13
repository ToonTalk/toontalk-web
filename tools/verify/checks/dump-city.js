const m = window.__ttCity.model;
return { mode: m.mode, landY: +m.landY.toFixed(3), cx: Math.round(m.cx), cy: Math.round(m.cy),
         streetY: m.streetY, landX: Math.round(m.landX), takingOff: window.__ttCity.takingOff };
