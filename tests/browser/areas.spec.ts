import { test, expect } from '@playwright/test';
// These browser contract tests mock API responses. Database/authorization tests
// use the actual Worker and disposable SQLite separately; live results are recorded separately.
const item={id:'public-1',name:'Avocado',description:'Fresh harvest',category:'Hass',quantity:25,unit:'kg',price:2,currency:'USD',availability:'November',company:'Origin Farm',country:'Mexico',region:'Jalisco',bio:'Family farm',business_email:'',business_phone:''};
for(const width of [390,1440])test(`Explore Produce public search and navigation fit ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.route('**/api/public/produce*',r=>{const q=new URL(r.request().url()).searchParams.get('q');return r.fulfill({json:{items:q==='missing'?[]:[item],page:1,hasMore:false}});});
 await page.goto('/explore');await expect(page.getByRole('heading',{name:'Explore Produce',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Avocado'})).toBeVisible();
 await page.getByText('Producer and supply details',{exact:true}).click();await expect(page.getByText('Family farm',{exact:true})).toBeVisible();await expect(page.getByText('Business contact details are not public.')).toBeVisible();
 await page.getByLabel('Produce or producer',{exact:true}).fill('missing');await page.getByRole('button',{name:'Search produce',exact:true}).click();await expect(page.getByRole('status')).toContainText('No public produce');await expect(page).toHaveURL(/q=missing/);
 await page.getByRole('button',{name:'Reset search',exact:true}).click();await expect(page.getByRole('heading',{name:'Avocado'})).toBeVisible();
 for(const label of ['Explore Produce','Buyer Center','My Workspace','Sign in / Account'])await expect(page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:label,exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('Buyer Center saves profile, reloads it and manages saved produce',async({page})=>{
 const profile={full_name:'Buyer Person',role:'buyer',company:'Buyer Co',country:'US',region:'',bio:''};
 let data={profile,savedItems:[] as typeof item[],page:1,hasMore:false};
 await page.route('**/api/auth/session',r=>r.fulfill({json:{user:{email:'buyer@example.test'},profile,recovery:false}}));
 await page.route('**/api/buyer/dashboard*',r=>r.fulfill({json:data}));
 await page.route('**/api/public/produce*',r=>r.fulfill({json:{items:[item],page:1,hasMore:false}}));
 await page.route('**/api/buyer/profile',r=>{data={...data,profile:{...profile,...r.request().postDataJSON()}};return r.fulfill({json:data});});
 await page.route('**/api/buyer/saved-items',r=>{data={...data,savedItems:r.request().postDataJSON().action==='save'?[item]:[]};return r.fulfill({json:data});});
 await page.goto('/buyer/dashboard');await page.getByLabel('Buyer company',{exact:true}).fill('Saved Buyer');await page.getByRole('button',{name:'Save buyer profile',exact:true}).click();await expect(page.getByText('Changes saved.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Save Avocado',exact:true}).click();await expect(page.getByRole('button',{name:'Remove Avocado'})).toBeVisible();await page.reload();await expect(page.getByLabel('Buyer company',{exact:true})).toHaveValue('Saved Buyer');await expect(page.getByRole('button',{name:'Remove Avocado'})).toBeVisible();
 await page.getByRole('button',{name:'Remove Avocado'}).click();await expect(page.getByText('No public items saved yet.')).toBeVisible();
});
test('wrong role is given its own workspace link without exposing buyer controls',async({page})=>{
 await page.route('**/api/auth/session',r=>r.fulfill({json:{profile:{full_name:'Person',role:'producer',company:'Farm',country:'Mexico'},user:{email:'p@example.test'},recovery:false}}));
 await page.goto('/buyer/dashboard');await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('link',{name:'Open your My Workspace'})).toHaveAttribute('href','/producer/dashboard');await expect(page.getByRole('button',{name:'Save buyer profile'})).toHaveCount(0);
});
test('account entry sends an onboarded buyer to Buyer Center',async({page})=>{
 const profile={full_name:'Person',role:'buyer',company:'Buyer',country:'US'};
 await page.route('**/api/auth/session',r=>r.fulfill({json:{profile,user:{email:'b@example.test'},recovery:false}}));
 await page.route('**/api/buyer/dashboard',r=>r.fulfill({json:{profile:{...profile,region:'',bio:''},savedItems:[],page:1,hasMore:false}}));
 await page.route('**/api/public/produce*',r=>r.fulfill({json:{items:[],page:1,hasMore:false}}));
 await page.goto('/account');await expect(page).toHaveURL(/\/buyer\/dashboard$/);await expect(page.getByRole('heading',{name:'Buyer Center',exact:true})).toBeVisible();
});
test('unauthenticated legacy workspace alias shows sign-in guidance',async({page})=>{
 await page.route('**/api/auth/session',r=>r.fulfill({status:401,json:{error:'Please sign in.'}}));
 await page.goto('/workspace');await expect(page.getByRole('alert')).toContainText('Access unavailable');await expect(page.getByRole('button',{name:'Save profile',exact:true})).toHaveCount(0);await expect(page.getByRole('navigation',{name:'Account navigation'}).getByRole('link',{name:'Sign in',exact:true})).toBeVisible();
});
