window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
const menu = document.getElementById('tt-menu');
return { cityActive: window.__ttCity.isActive,
         buttons: menu ? Array.from(menu.querySelectorAll('button')).map(b=>b.textContent) : [] };
