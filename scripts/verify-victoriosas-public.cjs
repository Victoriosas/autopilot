async (page) => {
 const origin = new URL(page.url()).origin;
 const results=[];
 const writes=[];
 const previewInfrastructure=[];
 const blockWrites=async route=>{const req=route.request();if(['POST','PUT','PATCH','DELETE'].includes(req.method())){const url=new URL(req.url());if(url.hostname==='vercel.live'&&url.pathname==='/login/validate'){previewInfrastructure.push('Vercel preview toolbar auth');await route.continue();return;}writes.push(req.method()+' '+new URL(req.url()).pathname);await route.abort();}else await route.continue();};
 await page.route('**/*',blockWrites);
 try {
 for(const width of [1440,768,390,320]) {
  await page.setViewportSize({width,height:900});
  await page.goto(origin);
  await page.getByRole('heading',{name:'Para sentirte segura y victoriosa.'}).waitFor();
  const check=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,forms:document.forms.length,h1:document.querySelectorAll('h1').length,badLinks:[...document.querySelectorAll('a')].filter(a=>/carrito|checkout|dropshipping|proveedor|admin|beauty-professional/i.test(a.textContent+' '+a.getAttribute('href'))).length,brokenAnchors:[...document.querySelectorAll('a[href^="#"]')].filter(a=>!document.getElementById(a.hash.slice(1))).length}));
  if(check.overflow||check.forms||check.h1!==1||check.badLinks||check.brokenAnchors)throw Error(JSON.stringify({width,...check}));
  await page.getByText('¿Cómo inicia la atención?',{exact:true}).click();
  if(!await page.locator('details[open]').count())throw Error('FAQ did not open');
  await page.keyboard.press('Tab');
  const photo=await page.locator('.beauty-portrait img').evaluate(img=>({complete:img.complete,width:img.naturalWidth,source:img.currentSrc}));
  if(!photo.complete||!photo.width||!photo.source.includes(width<=700?'hero-mobile.jpg':'hero.jpg'))throw Error('Responsive photograph '+JSON.stringify(photo));
  if(/domicilio|traslado/i.test(await page.locator('main').innerText()))throw Error('Outdated service copy');
  await page.screenshot({path:`output/playwright/approved-copy-${width}.png`,fullPage:true});
  results.push({width,...check,faq:true});
 }
 for(const path of ['/servicios','/contacto','/victoria','/carrito','/checkout','/servicios-sofia.html','/de-mi-para-tix']) {
  await page.goto(origin+path);
  await page.getByRole('link',{name:'Consultar por WhatsApp',exact:true}).first().waitFor();
  if(await page.locator('form').count())throw Error('Unexpected form '+path);
  if(await page.locator('h1').count()!==1)throw Error('Heading count '+path);
 }
 await page.evaluate(()=>{localStorage.setItem('victoriosa.cart.v1','[{"productId":"synthetic-preserve","quantity":1}]');localStorage.setItem('victoriosa.wishlist.v1','["synthetic-preserve"]');});
 await page.goto(origin+'/de-mi-para-ti');
 await page.getByRole('heading',{name:'De mí para ti',exact:true}).waitFor();
 if(!await page.getByText('Un espacio en confianza.',{exact:true}).count())throw Error('Editorial subtitle');
 await page.getByRole('link',{name:'Bienestar',exact:true}).click();
 await page.locator('.editorial-card').first().waitFor();
 if(await page.locator('.editorial-card').count()!==1)throw Error('Category filter');
 await page.getByRole('link',{name:'Leer artículo →',exact:true}).click();
 await page.getByRole('heading',{name:'Una pausa tranquila para vos',exact:true}).waitFor();
 if(!await page.getByText('Borrador para revisión · Fecha pendiente de aprobación',{exact:true}).count())throw Error('Draft label');
 await page.getByRole('link',{name:'Ordenar tu rutina cosmética sin complicarte →',exact:true}).click();
 await page.getByRole('heading',{name:'Ordenar tu rutina cosmética sin complicarte',exact:true}).waitFor();
 await page.screenshot({path:'output/playwright/approved-copy-article.png',fullPage:true});
 await page.goto(origin+'/de-mi-para-ti?categoria='+encodeURIComponent('Secretos y cuidados'));
 await page.getByRole('heading',{name:'Más lecturas, pronto',exact:true}).waitFor();
 await page.goto(origin+'/de-mi-para-ti/no-existe');
 await page.getByRole('heading',{name:'Esta lectura no está disponible.',exact:true}).waitFor();
 await page.goto(origin+'/admin');
 await page.getByRole('heading',{name:'Acceso administrativo'}).waitFor();
 await page.goto(origin+'/admin/');
 await page.getByRole('heading',{name:'Acceso administrativo'}).waitFor();
 if(await page.getByText('Productos destacados',{exact:true}).count())throw Error('Store leaked into private access');
 await page.goto(origin+'/beauty-professional');
 await page.getByRole('heading',{name:'Victoriosas · Espacio profesional'}).waitFor();
 await page.goto(origin+'/beauty-professional/');
 await page.getByRole('heading',{name:'Victoriosas · Espacio profesional'}).waitFor();
 const storagePreserved=await page.evaluate(()=>localStorage.getItem('victoriosa.cart.v1').includes('synthetic-preserve')&&localStorage.getItem('victoriosa.wishlist.v1').includes('synthetic-preserve'));
 if(!storagePreserved)throw Error('Private access modified commerce storage');
 await page.evaluate(()=>{localStorage.removeItem('victoriosa.cart.v1');localStorage.removeItem('victoriosa.wishlist.v1');});
 for(const path of ['/api/beauty/admin/requests','/api/beauty/catalog/admin/services','/api/beauty/professional/evaluations']) {
  const response=await page.request.get(origin+path);
  if(![401,403,503].includes(response.status()))throw Error(path+' '+response.status());
  results.push({path,status:response.status()});
 }
 await page.goto(origin);
 const href=await page.getByRole('link',{name:'Consultar por WhatsApp',exact:true}).first().getAttribute('href');
 if(!href.startsWith('https://wa.me/59897045305?'))throw Error('Contact link mismatch');
 if(writes.length)throw Error('Unexpected writes during navigation: '+JSON.stringify(writes));
 await page.unroute('**/*',blockWrites);
 const health=await (await page.request.get(origin+'/api/health')).json();
 if(health.checkoutEnabled!==false)throw Error('Checkout must stay closed');
 const config=await (await page.request.get(origin+'/api/beauty/config')).json();
 if(config.requestsEnabled!==false)throw Error('Sensitive forms must remain closed');
 const beauty=await page.request.post(origin+'/api/beauty/requests',{data:{}});
 if(beauty.status()!==503)throw Error('Beauty intake must stay closed');
 const waitlist=await page.request.post(origin+'/api/storefront/waitlist',{data:{}});
 if(waitlist.status()!==503)throw Error('Waitlist must stay closed: '+waitlist.status());
 return {results,commit:health.commit,waitlist:waitlist.status(),beautyIntake:beauty.status(),unexpectedWrites:writes.length,previewInfrastructureRequests:previewInfrastructure.length,storagePreserved,whatsappLinkValidated:true,messageSent:false};
 } finally { await page.unroute('**/*',blockWrites); }
}
