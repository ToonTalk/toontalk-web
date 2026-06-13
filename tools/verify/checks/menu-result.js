const menu = document.getElementById('tt-menu');
return { menuShown: !!menu,
         buttons: menu ? Array.from(menu.querySelectorAll('button')).map(b=>b.textContent) : [] };
