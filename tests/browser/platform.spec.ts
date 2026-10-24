import { test, expect } from '@playwright/test';
const item={id:'public-1',name:'Nopal from a published farm',description:'Seasonal harvest',category:'Cactus',quantity:250,unit:'kg',price:null,currency:'',availability:'Ask about the next harvest',company:'Public Farm',country:'Mexico',region:'Jalisco',bio:'A producer-provided introduction',business_email:'',business_phone:''};
const producer={id:item.id,company:item.company,country:item.country,region:item.region,bio:item.bio,business_email:'',business_phone:'',items:[item]};
for(const viewport of [{width:375,height:812},{width:390,height:844},{width:768,height:1024},{width:1366,height:768},{width:1440,height:900}]){
  test(`platform routes and supplied photos fit ${viewport.width}px`,async({page})=>{
    await page.setViewportSize(viewport);
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/api/public/produce?*',r=>r.fulfill({json:{items:[item],page:1,hasMore:false}}));
    await page.route('**/api/public/producers?*',r=>r.fulfill({json:{items:[producer],page:1,hasMore:false}}));
    await page.route('**/api/public/buyers?*',r=>r.fulfill({json:{items:[],page:1,hasMore:false}}));
    await page.route('**/api/admin/**',r=>r.fulfill({status:403,json:{error:'Operator access is not configured.'}}));
    for(const path of ['/','/producers','/producers/public-1','/producers/field-notes','/buyers','/buyers/unavailable','/explore?id=public-1','/admin']){
      const response=await page.goto(path);expect(response?.status()).toBe(200);
      if(path==='/'){const photo=await page.locator('.origin-photo').boundingBox();const content=await page.locator('.origin-copy').boundingBox();if(viewport.width<=900){expect(content!.width).toBeGreaterThan(viewport.width-80);expect(content!.y).toBeGreaterThanOrEqual(photo!.y);expect(content!.y+content!.height).toBeLessThanOrEqual(photo!.y+photo!.height+1);const cta=await page.locator('.hero-cta .platform-button').boundingBox();expect(cta!.width).toBeLessThan(viewport.width);}await page.screenshot({path:`.wrangler/design-release/screenshots/home-viewport-${viewport.width}.png`});}
      if(path==='/producers/public-1')await expect(page.getByRole('heading',{name:'Public Farm',exact:true})).toBeVisible();
      if(path==='/buyers')await expect(page.getByRole('status')).toContainText('No public buyer');
      if(path==='/admin')await expect(page.getByRole('alert')).toContainText('not configured');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      for(const img of await page.locator('img:visible').all()){
        await img.scrollIntoViewIfNeeded();await expect(img).toHaveJSProperty('complete',true);expect(await img.evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBeGreaterThan(0);
      }
      await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:`.wrangler/design-release/screenshots/${path.replaceAll('/','-').replace('?','-')||'home'}-${viewport.width}.png`,fullPage:true});
    }
    expect(errors).toEqual([]);
  });
}
test('producer filters and details retain public item and contact links',async({page})=>{
  await page.route('**/api/public/producers?*',r=>{
    const params=new URL(r.request().url()).searchParams;
    return r.fulfill({json:{items:params.get('q')==='missing'?[]:[producer],page:1,hasMore:false}});
  });
  await page.goto('/producers');await expect(page.getByRole('heading',{name:'Public Farm',exact:true})).toBeVisible();
  await page.getByLabel('Producer or produce',{exact:true}).fill('missing');await page.getByRole('button',{name:'Search producers',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('No published producers');expect(new URL(page.url()).searchParams.get('q')).toBe('missing');
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();await expect(page.getByLabel('Producer or produce',{exact:true})).toHaveValue('');
  await page.getByRole('link',{name:'View producer & public supply →'}).click();
  await expect(page.getByRole('heading',{name:'Published produce & supply'})).toBeVisible();await expect(page.getByRole('link',{name:item.name+' ↗'})).toHaveAttribute('href','/explore?id=public-1');
  await expect(page.getByText('This producer has not published business contact details. No message has been sent.')).toBeVisible();
});
test('directory API errors provide retry and do not manufacture profiles',async({page})=>{
  let fail=true;await page.route('**/api/public/producers?*',r=>r.fulfill(fail?{status:503,json:{error:'Directory unavailable'}}:{json:{items:[],page:1,hasMore:false}}));
  await page.goto('/producers');await expect(page.getByRole('alert')).toContainText('Directory unavailable');
  fail=false;await page.getByRole('button',{name:'Try again',exact:true}).click();await expect(page.getByRole('status')).toContainText('No published producers');
});
test('failed map tiles give a clean fallback and keep GIS controls usable',async({page})=>{
  await page.route('https://tile.openstreetmap.org/**',r=>r.fulfill({status:503,body:'Unavailable'}));
  await page.goto('/#overview');await page.getByRole('tab',{name:'LOGISTICS',exact:true}).click();
  await expect(page.locator('.tile-warning')).toBeVisible();await expect(page.locator('.map-stage')).toHaveClass(/basemap-unavailable/);
  await expect(page.locator('.leaflet-tile-pane')).toHaveCSS('visibility','hidden');
  const layer=page.getByRole('checkbox',{name:/Production Sites/});await layer.uncheck();await expect(layer).not.toBeChecked();await page.getByRole('button',{name:'Restore all layers',exact:true}).click();await expect(layer).toBeChecked();
  await page.screenshot({path:'.wrangler/design-release/screenshots/map-fallback.png',fullPage:true});
});

test('farm inquiry deep link opens the existing commercial form and section hashes preserve tabs',async({page})=>{
  await page.goto('/#contact');await expect(page.getByRole('tab',{name:'COMMERCIAL',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.locator('#contact')).toBeVisible();
  await page.goto('/#documents');await expect(page.getByRole('tab',{name:'READINESS',exact:true})).toHaveAttribute('aria-selected','true');
  await page.goto('/#overview');await expect(page.getByRole('tab',{name:'PRODUCER',exact:true})).toHaveAttribute('aria-selected','true');
});
test('buyer filters preserve query without inventing companies or revealing private profiles',async({page})=>{
  const queries:string[]=[];await page.route('**/api/public/buyers?*',r=>{queries.push(new URL(r.request().url()).search);return r.fulfill({json:{items:[],page:1,hasMore:false,publication:'unavailable'}});});
  await page.goto('/buyers');await page.getByLabel('Company or sourcing interest',{exact:true}).fill('Nopal');await page.getByLabel('Country or market',{exact:true}).fill('US');await page.getByRole('button',{name:'Search buyers',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('No public buyer');expect(new URL(page.url()).searchParams.get('q')).toBe('Nopal');expect(queries.at(-1)).toContain('country=US');await expect(page.locator('.producer-directory-entry')).toHaveCount(0);
});
for(const role of ['producer','buyer'])test(`${role} workspace filters existing data without making write requests`,async({page})=>{
  const profile={role,full_name:'Synthetic Member',company:'Public Farm',country:'Mexico',region:'Jalisco',bio:'Farm introduction',business_email:'',business_phone:'',public_contact:0};
  const items=[{...item,status:'public'},{...item,id:'draft-2',name:'Avocado',status:'draft'}];
  let writes=0;
  await page.route('**/api/**',r=>{const req=r.request(),path=new URL(req.url()).pathname;if(req.method()!=='GET'){writes++;return r.abort();}if(path==='/api/auth/session')return r.fulfill({json:{user:{email:'member@example.test'},profile,recovery:false}});if(path==='/api/producer/dashboard')return r.fulfill({json:{profile,items,summary:{total:2,public:1,quantities:{kg:250},profileCompletion:80}}});if(path==='/api/buyer/dashboard')return r.fulfill({json:{profile,savedItems:items,page:1,hasMore:false}});return r.fulfill({json:{items:[],page:1,hasMore:false}});});
  await page.goto(`/${role}/dashboard`);
  if(role==='producer'){
    await expect(page.getByRole('button',{name:'Edit Avocado',exact:true})).toBeVisible();
    await page.getByRole('combobox',{name:'Publication filter',exact:true}).selectOption('public');await expect(page.getByRole('button',{name:'Edit Avocado',exact:true})).toHaveCount(0);
    await page.getByLabel('Find your produce',{exact:true}).fill('missing');await expect(page.getByRole('status')).toContainText('No items match your filters.');
  }else{
    await expect(page.getByRole('heading',{name:'Avocado',exact:true})).toBeVisible();await page.getByLabel('Search saved produce on this page',{exact:true}).fill('missing');await expect(page.getByText('No saved items match your search on this page.')).toBeVisible();await expect(page.getByRole('heading',{name:'Avocado',exact:true})).toHaveCount(0);
  }
  expect(writes).toBe(0);
});
