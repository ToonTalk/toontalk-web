const c = window.__ttCity, m = c.model;
// Descend onto the road in block 7 (where the 3 houses are), near house B.
m.mode = 'flying'; m.scale = 101; m.cx = 300000; m.cy = 240000;
m.fly(0, 0, -1, 200);          // → landing; touches down on road y=224000
m.landY = 0.35; m.cx = 300000; // mid-descent, between houses A and B so both show
