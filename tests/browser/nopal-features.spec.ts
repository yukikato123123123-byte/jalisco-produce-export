import {test,expect} from '@playwright/test';
test.use({hasTouch:true});
for(const width of [375,1440])test(`PRODUCT, ritual keyboard/touch and launch anchors at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/#ritual');await expect(page.locator('#ritual')).toBeInViewport();const ritualTop=await page.locator('#ritual').evaluate(e=>e.getBoundingClientRect().top);expect(ritualTop).toBeGreaterThanOrEqual(0);expect(ritualTop).toBeLessThan(40);
 const tabs=page.getByRole('tab'),panel=page.getByRole('tabpanel');await expect(tabs).toHaveCount(3);
 await expect(tabs.nth(0)).toHaveAttribute('aria-selected','true');await tabs.nth(1).tap();await expect(tabs.nth(1)).toHaveAttribute('aria-selected','true');await expect(panel).toContainText('mixing ratio');await expect(panel.locator('svg')).toHaveAttribute('viewBox','620 411 482 121');
 await tabs.nth(1).press('ArrowRight');await expect(tabs.nth(2)).toBeFocused();await expect(tabs.nth(2)).toHaveAttribute('aria-selected','true');await expect(panel).toContainText('not a demonstration');
 await tabs.nth(2).press('Home');await expect(tabs.nth(0)).toBeFocused();await expect(panel).toContainText('final formula');
 await tabs.nth(0).press('End');await expect(tabs.nth(2)).toBeFocused();await tabs.nth(2).press('ArrowRight');await expect(tabs.nth(0)).toBeFocused();await tabs.nth(0).press('ArrowUp');await expect(tabs.nth(2)).toBeFocused();await tabs.nth(2).press('ArrowDown');await expect(tabs.nth(0)).toBeFocused();
 await page.locator('.nopal-header').getByRole('link',{name:'PRODUCT',exact:true}).click();await expect(page.locator('#producto')).toBeInViewport();await expect(page.locator('#producto')).toContainText('COMING SOON');await expect(page.locator('#producto')).toContainText('Not yet confirmed');await expect(page.getByRole('button',{name:/buy|purchase/i})).toHaveCount(0);
 await page.getByRole('link',{name:'EXPLORE THE RITUAL',exact:true}).click();await expect(page).toHaveURL(/#ritual$/);
 await page.getByRole('link',{name:'GET LAUNCH UPDATES',exact:true}).click();await expect(page).toHaveURL(/#launch$/);await expect(page.getByLabel('Email address',{exact:true})).toBeVisible();await page.reload();await expect(page.locator('.nopal-page')).toBeVisible();await expect(page.locator('#launch')).toBeInViewport();
 await page.locator('.nopal-header').getByRole('link',{name:'ORIGIN',exact:true}).click();await expect(page.locator('#origen')).toContainText('does not establish a formula');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await page.locator('.nopal-language button').first().evaluate(e=>getComputedStyle(e).transitionDuration)).toBe('0s');
 await page.screenshot({path:`.wrangler/nopal-features/${width}.png`,fullPage:true});
 await page.locator('.nopal-header').getByRole('button',{name:'Español',exact:true}).click();await tabs.nth(2).click();await expect(panel).toContainText('no una demostración');await expect(page.locator('#producto')).toContainText('PRÓXIMAMENTE');expect(errors).toEqual([]);
});
for(const lang of ['en','es'])test(`${lang} launch form validates, preserves errors, prevents duplicate sends and confirms only server success`,async({page})=>{
 await page.goto('/#launch');if(lang==='es')await page.locator('.nopal-header').getByRole('button',{name:'Español',exact:true}).click();
 const form=page.locator('.nopal-launch form'),email=form.locator('[name=email]'),consent=form.locator('[name=consent]'),submit=form.getByRole('button');
 let calls=0,mode='fail';let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
 await page.route('**/api/public/launch-subscriptions',async r=>{calls++;const body=r.request().postDataJSON();expect(body).toMatchObject({email:'launch@example.test',consent:true,language:lang,consentVersion:'nopal-launch-v1'});if(mode==='pending')await gate;await r.fulfill(mode==='fail'?{status:503,json:{code:'temporarily_unavailable'}}:mode==='rate'?{status:429,json:{code:'rate_limited'}}:{status:202,json:{status:'saved'}});});
 await email.fill('invalid');await submit.click();expect(calls).toBe(0);expect(await email.evaluate((e:HTMLInputElement)=>e.validity.valid)).toBe(false);
 await email.fill('launch@example.test');await submit.click();expect(calls).toBe(0);await consent.check();await submit.click();await expect(form.getByRole('alert')).toContainText(lang==='es'?'No se pudo guardar':'could not be saved');await expect(email).toHaveValue('launch@example.test');await expect(page.locator('.nopal-launch [role=status]')).toHaveCount(0);
 mode='rate';await submit.click();await expect(form.getByRole('alert')).toContainText(lang==='es'?'Demasiadas solicitudes':'Too many requests');
 mode='pending';await submit.click();await expect(submit).toBeDisabled();await form.evaluate(el=>{el.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});expect(calls).toBe(3);release();await expect(page.locator('.nopal-launch [role=status]')).toContainText(lang==='es'?'Tu solicitud se ha guardado.':'Your request is saved.');await expect(page.locator('.nopal-launch [role=status]')).toContainText(lang==='es'?'No se ha enviado ningún correo.':'No email has been sent.');
});
test('launch form treats malformed success and transport failure as errors',async({page})=>{
 await page.goto('/#launch');const form=page.locator('.nopal-launch form');await form.locator('[name=email]').fill('launch@example.test');await form.locator('[name=consent]').check();
 await page.route('**/api/public/launch-subscriptions',r=>r.fulfill({status:200,json:{ok:true}}));await form.getByRole('button').click();await expect(form.getByRole('alert')).toContainText('could not be saved');
 await page.unroute('**/api/public/launch-subscriptions');await page.route('**/api/public/launch-subscriptions',r=>r.abort());await form.getByRole('button').click();await expect(form.getByRole('alert')).toContainText('could not be saved');await expect(page.locator('.nopal-launch [role=status]')).toHaveCount(0);
});
