import {test,expect} from '@playwright/test';
const items=Array.from({length:4},(_,i)=>({id:`item-${i}`,producer_id:`farm-${i}`,name:`Published crop ${i+1}`,description:'Producer-reported seasonal produce',category:'Vegetables',quantity:12,unit:'kg',price:null,currency:'',availability:'Confirm harvest date',company:`Actual Farm ${i+1}`,country:'Mexico',region:'Jalisco',bio:'',business_email:'',business_phone:''}));
for(const width of [375,768,1440])test(`Home original hero, real listing cards and CTA navigation at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/public/produce*',r=>r.fulfill({json:{items,page:1,hasMore:false}}));
 await page.goto('/');await expect(page.locator('h1')).toHaveText('From Jaliscoto the World');
 await expect(page.locator('.home-product-card')).toHaveCount(3);await expect(page.getByRole('heading',{name:'Published crop 4',exact:true})).toHaveCount(0);
 for(const title of ['Premium Quality','Reliable Export','Global Reach','Strong Partnerships'])await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
 const hero=page.locator('.origin-photo img');await expect(hero).toHaveAttribute('src','/images/jalisco-sunrise-hero-v1.png');await expect(hero).toHaveJSProperty('complete',true);expect(await hero.evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBeGreaterThan(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.locator('.home-product-card').first().getByRole('link',{name:'Actual Farm 1 →'})).toHaveAttribute('href','/producers/farm-0');
 await page.screenshot({path:`.wrangler/home-design/home-${width}.png`,fullPage:true});
 await page.locator('.hero-cta').getByRole('link',{name:'Explore Produce'}).click();await expect(page).toHaveURL(/\/explore$/);
 await page.goto('/');await page.locator('.hero-cta').getByRole('link',{name:'Meet the producers'}).click();await expect(page).toHaveURL(/\/producers$/);
 await page.goto('/');await page.locator('.home-next-actions').getByRole('link',{name:'Create an account'}).click();await expect(page).toHaveURL(/\/signup$/);
 expect(errors).toEqual([]);
});
test('Home data failure can retry and empty results do not invent product cards',async({page})=>{
 let fail=true;await page.route('**/api/public/produce*',r=>r.fulfill(fail?{status:503,json:{error:'Unavailable'}}:{json:{items:[],page:1,hasMore:false}}));
 await page.goto('/');await expect(page.getByRole('alert')).toContainText('could not be loaded');await expect(page.locator('.home-product-card')).toHaveCount(0);
 fail=false;await page.getByRole('button',{name:'Retry produce',exact:true}).click();await expect(page.getByRole('status')).toContainText('No public produce');await expect(page.locator('.home-product-card')).toHaveCount(0);
});
test('Home shows loading until API responds, without sample inventory',async({page})=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});await page.route('**/api/public/produce*',async r=>{await gate;await r.fulfill({json:{items,page:1,hasMore:false}});});
 await page.goto('/');await expect(page.getByRole('status')).toContainText('Loading published produce');await expect(page.locator('.home-product-card')).toHaveCount(0);release();await expect(page.locator('.home-product-card')).toHaveCount(3);
});
