import { test, expect } from '@playwright/test';
const viewports=[{width:375,height:812},{width:390,height:844},{width:768,height:1024},{width:1366,height:768},{width:1440,height:900}];
for(const viewport of viewports){
 test(`shared chrome, form entry and focus fit ${viewport.width}px`,async({page})=>{
  await page.setViewportSize(viewport);
  await page.route('**/api/public/produce*',r=>r.fulfill({json:{items:[],page:1,hasMore:false}}));
  let headerHeight:number|undefined;
  for(const path of ['/login','/signup','/verify-email','/forgot-password','/explore']){
   await page.goto(path);
   const header=await page.locator('.site-header').boundingBox();
   const brand=await page.locator('.site-header .brand').boundingBox();
   const nav=await page.getByRole('navigation',{name:'Main navigation'}).boundingBox();
   expect(header).not.toBeNull();expect(brand).not.toBeNull();expect(nav).not.toBeNull();
   if(headerHeight===undefined)headerHeight=header!.height;
   expect(Math.abs(header!.height-headerHeight)).toBeLessThan(1);
   const overlap=Math.min(brand!.x+brand!.width,nav!.x+nav!.width)-Math.max(brand!.x,nav!.x)>0&&Math.min(brand!.y+brand!.height,nav!.y+nav!.height)-Math.max(brand!.y,nav!.y)>0;
   expect(overlap).toBe(false);
   const contentStart=await page.locator('main').evaluate(el=>el.getBoundingClientRect().x+(el.classList.contains('account-layout')?parseFloat(getComputedStyle(el).paddingLeft):0));
   expect(Math.abs(brand!.x-contentStart)).toBeLessThan(1);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await expect(page.locator('.site-footer')).toBeVisible();
  }
  await page.goto('/login');
  const email=page.getByLabel('Email address',{exact:true});
  const bounds=await email.boundingBox();expect(bounds!.y+bounds!.height).toBeLessThan(viewport.height);
  await email.focus();expect(await email.evaluate(el=>el.matches(':focus-visible'))).toBe(true);
  expect(await email.evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');
  if(viewport.width>700){
   await page.goto('/#overview');
   await page.locator('.header-actions .quote-button').click();
   const contact=await page.locator('#contact').boundingBox();
   const header=await page.locator('header').boundingBox();
   expect(contact!.y).toBeGreaterThanOrEqual(Math.max(0,header!.y+header!.height));
   const intro=await page.locator('#contact .business-heading').boundingBox();
   expect(intro!.width).toBeGreaterThanOrEqual(300);
   await page.locator('.site-footer').getByRole('link',{name:'Back to top',exact:true}).click();
   await expect(page.getByRole('tab',{name:'PRODUCER',exact:true})).toHaveAttribute('aria-selected','true');
  }
 });
 for(const role of ['producer','buyer'])test(`long ${role} data and workspace fields fit ${viewport.width}px`,async({page})=>{
  await page.setViewportSize(viewport);
  const profile={role,full_name:'A'.repeat(120),company:'Family farm',country:'Mexico',region:'Jalisco',bio:'Long introduction. '.repeat(40),business_email:'a'.repeat(64)+'@'+'b'.repeat(60)+'.example.test',business_phone:'',public_contact:0};
  const item={id:'layout-only',name:'C'.repeat(120),description:'Seasonal produce',category:'Hass',quantity:25,unit:'kg',price:2,currency:'USD',status:'private',availability:'',company:profile.company,country:profile.country,region:profile.region,bio:profile.bio,business_email:'',business_phone:''};
  await page.route('**/api/auth/session',r=>r.fulfill({json:{user:{email:profile.business_email},profile,recovery:false}}));
  await page.route('**/api/producer/dashboard*',r=>r.fulfill({json:{profile,items:[item],summary:{total:1,public:0,quantities:{},profileCompletion:100}}}));
  await page.route('**/api/buyer/dashboard*',r=>r.fulfill({json:{profile,savedItems:[item],page:1,hasMore:false}}));
  await page.route('**/api/public/produce*',r=>r.fulfill({json:{items:[],page:1,hasMore:false}}));
  await page.goto(`/${role}/dashboard`);
  await expect(page.getByRole('button',{name:role==='producer'?'Save profile':'Save buyer profile',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const bio=page.getByRole('textbox',{name:role==='producer'?'Introduction':'Buyer introduction',exact:true});
  await expect(bio).toHaveJSProperty('tagName','TEXTAREA');
  await expect(bio).toHaveValue(profile.bio);
  if(role==='producer'){
    await expect(page.locator('input[name=public_contact]')).toHaveCSS('margin-top','2px');
   await page.getByRole('button',{name:`Edit ${item.name}`,exact:true}).click();
   await expect(page.getByRole('textbox',{name:'Description',exact:true})).toHaveValue(item.description);
   await page.getByRole('combobox',{name:/^Status/}).selectOption('public');
   await expect(page.getByRole('combobox',{name:/^Status/})).toHaveValue('public');
  }
 });
}
