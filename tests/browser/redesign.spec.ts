import {test,expect} from '@playwright/test';
for(const width of [375,768,1440])test(`new Home and trade routes at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.route('**/api/public/produce*',r=>r.fulfill({json:{items:[],page:1,hasMore:false}}));
 await page.route('**/api/auth/session',r=>r.fulfill({status:401,json:{error:'Please sign in to continue.'}}));
 await page.route('https://tiles.stadiamaps.com/**',r=>r.fulfill({status:401,body:'Unavailable'}));
 for(const path of ['/','/logistics','/commercial','/readiness']){
  await page.goto(path);await expect(page.locator('h1')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const label of ['Home','Explore Produce','Producers','Buyers','Logistics','Commercial','Readiness'])await expect(page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:label,exact:true})).toBeVisible();
  if(path==='/'){await expect(page.locator('h1')).toHaveText('From Jaliscoto the World');await expect(page.getByRole('tab')).toHaveCount(0);await expect(page.locator('.origin-photo img')).toHaveJSProperty('naturalWidth',1959);await page.screenshot({path:`.wrangler/redesign/home-${width}.png`,fullPage:true});}
  if(path==='/commercial')await expect(page.getByRole('status')).toContainText('No public listings');
  if(path==='/readiness')await expect(page.getByText('Unverified · no supporting document records')).toHaveCount(2);
 }
});
test('Home language remains selectable and persists across navigation',async({page})=>{await page.goto('/');await page.getByRole('combobox',{name:'Language / Idioma',exact:true}).selectOption('es');await expect(page.locator('h1')).toContainText('De Jalisco');await page.reload();await expect(page.locator('h1')).toContainText('De Jalisco');});
test('admin table inspection, confirmation and reason precede a publication mutation',async({page})=>{
 let writes=0;const product={id:'p1',name:'Nopal',state:'public',producer:'Farm',quantity:20,unit:'kg'};
 await page.route('**/api/admin/**',r=>{const path=new URL(r.request().url()).pathname;if(r.request().method()==='POST'){writes++;expect(r.request().postDataJSON()).toMatchObject({action:'product_status',target_id:'p1',before_state:'public',after_state:'private',reason:'Requested review'});product.state='private';return r.fulfill({json:{ok:true}});}return r.fulfill({json:path.endsWith('overview')?{counts:{products:1},health:{database:'Query succeeded'},recent:[]}:{items:[product],page:1,hasMore:false}});});
 await page.goto('/admin');await page.getByText('More operational details',{exact:true}).click();await expect(page.getByText('Query succeeded')).toBeVisible();await page.getByRole('button',{name:'Products',exact:true}).click();await page.getByRole('button',{name:'View details',exact:true}).click();await expect(page.locator('.record-detail-information').getByText('Farm',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Set private',exact:true}).click();expect(writes).toBe(0);await page.getByLabel('Reason for this change').fill('Requested review');await page.getByRole('button',{name:'Confirm change',exact:true}).click();await page.getByRole('button',{name:'View details',exact:true}).click();await expect(page.getByRole('button',{name:'Set public',exact:true})).toBeVisible();expect(writes).toBe(1);
});
