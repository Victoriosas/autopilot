async (page) => {
 const origin = new URL(page.url()).origin;
 const results=[];
 const writes=[];
 const blockWrites=async route=>{const req=route.request();if(['POST','PUT','PATCH','DELETE'].includes(req.method())){writes.push(req.method()+' '+new URL(req.url()).pathname);await route.abort();}else await route.continue();};
 await page.route('**/*',blockWrites);
 for(const width of [1440,768,390,320]) {
  await page.setViewportSize({width,height:900});
  await page.goto(origin);
  await page.getByRole('heading',{name:'Un momento de calma. Un cuidado para vos.'}).waitFor();
  const check=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,forms:document.forms.length,h1:document.querySelectorAll('h1').length,badLinks:[...document.querySelectorAll('a')].filter(a=>/carrito|checkout|dropshipping|proveedor|admin|beauty-professional/i.test(a.textContent+' '+a.getAttribute('href'))).length,brokenAnchors:[...document.querySelectorAll('a[href^="#"]')].filter(a=>!document.getElementById(a.hash.slice(1))).length}));
  if(check.overflow||check.forms||check.h1!==1||check.badLinks||check.brokenAnchors)throw Error(JSON.stringify({width,...check}));
  await page.getByText('¿Dónde puedo consultar por atención?',{exact:true}).click();
  if(!await page.locator('details[open]').count())throw Error('FAQ did not open');
  await page.keyboard.press('Tab');
  await page.screenshot({path:`output/playwright/verified-${width}.png`,fullPage:true});
  results.push({width,...check,faq:true});
 }
 for(const path of ['/servicios','/contacto','/victoria','/carrito','/checkout','/servicios-sofia.html']) {
  await page.goto(origin+path);
  await page.getByRole('link',{name:'Consultar por WhatsApp',exact:true}).first().waitFor();
  if(await page.locator('form').count())throw Error('Unexpected form '+path);
  if(await page.locator('h1').count()!==1)throw Error('Heading count '+path);
 }
 await page.evaluate(()=>{localStorage.setItem('victoriosa.cart.v1','[{"productId":"synthetic-preserve","quantity":1}]');localStorage.setItem('victoriosa.wishlist.v1','["synthetic-preserve"]');});
 await page.goto(origin+'/admin');
 await page.getByRole('heading',{name:'Acceso administrativo'}).waitFor();
 if(await page.getByText('Productos destacados',{exact:true}).count())throw Error('Store leaked into private access');
 await page.goto(origin+'/beauty-professional');
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
 const waitlist=await page.request.post(origin+'/api/storefront/waitlist',{data:{}});
 if(waitlist.status()!==503)throw Error('Waitlist must stay closed: '+waitlist.status());
 return {results,commit:health.commit,waitlist:waitlist.status(),unexpectedWrites:writes.length,storagePreserved,whatsappLinkValidated:true,messageSent:false};
}
