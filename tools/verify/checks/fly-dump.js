const c = window.__ttCity, m = c.model;
return { mode: m.mode, scale: Math.round(m.scale), cx: Math.round(m.cx), cy: Math.round(m.cy),
         dir: m.dir, cityW: undefined };
