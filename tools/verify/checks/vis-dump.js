const app = window.__ttApp, c = window.__ttCity;
const layers = app.stage.children.map(ch => ({ z: ch.zIndex, vis: ch.visible, sortable: !!ch.sortableChildren }));
return { cityActive: c.isActive, cityContainerVisible: c.container.visible, mode: c.model.mode, layers };
