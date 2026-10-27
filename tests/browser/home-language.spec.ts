import {test,expect} from '@playwright/test';
for(const width of [375,768,1440])test(`NopaHua bilingual reference layout, artwork and navigation at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});
 const errors:string[]=[];const api:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))api.push(r.url());});
 const artwork=page.waitForResponse(r=>r.url().endsWith('/images/nopal-reference.png'));
 await page.goto('/');expect((await artwork).status()).toBe(200);
 const header=page.locator('.nopal-header');const footer=page.locator('.nopal-footer');
 await expect(header.getByRole('link',{name:'NopaHua home',exact:true})).toBeVisible();
 for(const [lang,label,title,cta,product,origin,note] of [
  ['es','Español','NO ES UNA CREMA.ES UN ENCUENTRO.','DESCUBRE EL CONCEPTO','PRODUCTO','ORIGEN','No disponible para compra.'],
  ['en','English','IT IS NOT A CREAM.IT IS AN ENCOUNTER.','DISCOVER THE CONCEPT','PRODUCT','ORIGIN','Not available for purchase.']
 ]){
  await header.getByRole('button',{name:label,exact:true}).click();
  for(const chrome of [header,footer]){
   await expect(chrome.getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-pressed','true');
   await expect(chrome.getByRole('button',{name:label==='English'?'Español':'English',exact:true})).toHaveAttribute('aria-pressed','false');
   const box=await chrome.getByRole('group',{name:'Language / Idioma',exact:true}).boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);
  }
  await expect(page.locator('h1')).toHaveText(title);await expect(page.locator('html')).toHaveAttribute('lang',lang==='es'?'es-MX':'en');await expect(page).toHaveTitle(lang==='es'?'NopaHua · Polvo y agua':'NopaHua · Powder and water');
  await expect(page.locator('.nopal-proposal')).toContainText(note);
  await expect(page.locator('.nopal-hero-copy>p').last()).toHaveText(lang==='es'?'Dos elementos. Una nueva experiencia.':'Two elements. A new experience.');
  await expect(page.locator('.nopal-stage-title')).toHaveText(lang==='es'?['EL POLVO','EL ENCUENTRO','LA TRANSFORMACIÓN']:['THE POWDER','THE ENCOUNTER','THE TRANSFORMATION']);
  await expect(page.locator('.nopal-art image')).toHaveCount(9);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`.wrangler/nopal/${width}-${lang}.png`,fullPage:true});
  await header.getByRole('link',{name:product,exact:true}).click();await expect(page).toHaveURL(/#producto$/);await expect(page.locator('#producto')).toBeInViewport();
  await page.reload();await expect(page.locator('h1')).toHaveText(title);await expect(page.locator('.nopal-page')).toBeVisible();
  await header.getByRole('link',{name:'RITUAL',exact:true}).click();await expect(page.locator('#ritual')).toBeInViewport();
  await header.getByRole('link',{name:origin,exact:true}).click();await expect(page.locator('#origen')).toBeInViewport();
  await footer.getByRole('link',{name:lang==='es'?'NopaHua volver arriba':'NopaHua back to top',exact:true}).click();await expect(page.locator('.nopal-header')).toBeInViewport();
  await page.getByRole('link',{name:cta,exact:true}).click();await expect(page.locator('#producto')).toBeInViewport();
  await page.goto('/login');await expect(page.getByRole('combobox',{name:'Language / Idioma',exact:true})).toHaveValue(lang);
  await page.goto('/');await expect(header.getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-pressed','true');
 }
 await footer.getByRole('button',{name:'Español',exact:true}).click();await expect(header.getByRole('button',{name:'Español',exact:true})).toHaveAttribute('aria-pressed','true');
 expect(api.filter(url=>new URL(url).pathname==='/api/public/produce')).toHaveLength(0);expect(errors).toEqual([]);
});
test('NopaHua is public when local authentication is unconfigured and admin denial UI remains intact',async({page})=>{
 await page.goto('/');await expect(page.locator('.nopal-wordmark').first()).toHaveText('NopaHua');
 // The existing local config intentionally has no provider keys. Its real API fails closed.
 const response=await page.request.get('/api/admin/overview');expect(response.status()).toBe(503);
 await expect(response.json()).resolves.toEqual({error:'Authentication is not configured. Public pages remain available.'});
 // Denial presentation is a contract check; real staging 401 is checked after deployment.
 await page.route('**/api/admin/**',r=>r.fulfill({status:401,json:{error:'Please sign in to continue.'}}));
 await page.goto('/admin');await expect(page.getByRole('alert')).toContainText('sign in');await expect(page.locator('.admin-sidebar')).toHaveCount(0);
 await page.goto('/signup');await expect(page.getByLabel('Display name (optional)',{exact:true})).toBeVisible();
 await page.goto('/forgot-password');await expect(page.getByRole('button',{name:'Send recovery code',exact:true})).toBeVisible();
});
