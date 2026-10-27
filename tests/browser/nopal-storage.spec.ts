import {test,expect} from '@playwright/test';
test('real local Worker/D1 persists a launch request without auth and deduplicates it',async({page})=>{
 const origin='http://localhost:8787',email=`nopal-local-${crypto.randomUUID()}@example.test`;
 // Each disposable local test uses a synthetic trusted-edge IP to isolate durable rate buckets.
 const ip=`198.18.${Math.floor(Math.random()*256)}.${Math.floor(Math.random()*256)}`;await page.setExtraHTTPHeaders({'CF-Connecting-IP':ip});
 await page.goto(origin+'/#launch');const form=page.locator('.nopal-launch form');await form.locator('[name=email]').fill(email);await form.locator('[name=consent]').check();
 const saved=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/public/launch-subscriptions'&&r.request().method()==='POST');await form.getByRole('button',{name:'NOTIFY ME',exact:true}).click();const response=await saved;expect(response.status()).toBe(202);expect(response.headers()['set-cookie']).toBeUndefined();await expect(page.locator('.nopal-launch [role=status]')).toContainText('Your request is saved.');
 const duplicate=await page.request.post(origin+'/api/public/launch-subscriptions',{headers:{Origin:origin,'CF-Connecting-IP':ip},data:{email:email.toUpperCase(),language:'es',consent:true,consentVersion:'nopal-launch-v1'}});expect(duplicate.status()).toBe(202);expect(await duplicate.json()).toEqual({status:'saved'});
 const invalid=await page.request.post(origin+'/api/public/launch-subscriptions',{headers:{Origin:origin,'CF-Connecting-IP':ip},data:{email:'invalid',language:'en',consent:true,consentVersion:'nopal-launch-v1'}});expect(invalid.status()).toBe(400);expect(await invalid.json()).toEqual({code:'invalid_email'});
 expect((await page.request.get(origin+'/api/public/launch-subscriptions')).status()).toBe(405);
 await page.reload();await page.locator('.nopal-header').getByRole('button',{name:'Español',exact:true}).click();await form.locator('[name=email]').fill(email);await form.locator('[name=consent]').check();await form.getByRole('button',{name:'AVÍSAME',exact:true}).click();await expect(page.locator('.nopal-launch [role=status]')).toContainText('Tu solicitud se ha guardado.');
});
