/* global process, URL, setTimeout, window, getComputedStyle, document, innerWidth, console */
// Browser layout evidence. All authenticated/data-rich states are synthetic API fixtures;
// public and signed-out routes use actual HTTP responses. No live write is permitted.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const origin=process.env.AUDIT_ORIGIN||'https://jalisco-auth-staging.yukikato123123123.workers.dev';
if(!['http://localhost:8787','http://127.0.0.1:8787','https://jalisco-auth-staging.yukikato123123123.workers.dev'].includes(origin))throw Error('Audit origin must be local or staging');
const output=process.env.AUDIT_OUTPUT||'.wrangler/layout-audit/before';
const sizes=[[375,812],[390,844],[768,1024],[1366,768],[1440,900]];
const long='JaliscoSustainableHarvestAndInternationalProduceSupply'.repeat(3);
const profile={full_name:long.slice(0,120),company:'Sierra Verde Cooperative',country:'Mexico',region:'Jalisco',bio:'A family cooperative sharing seasonal produce from Jalisco. '.repeat(8),business_email:long+'@example.test',business_phone:'+52 555 0100',public_contact:1};
const item={id:'audit-only',name:long.slice(0,120),description:'Fresh seasonal harvest, carefully grown and packed. '.repeat(5),category:'Seasonal produce',quantity:2400,unit:'kg',price:2,currency:'USD',availability:'November to February',company:profile.company,country:'Mexico',region:'Jalisco',bio:profile.bio,business_email:profile.business_email,business_phone:profile.business_phone,status:'public'};
const produce={profile:{...profile,role:'producer'},items:[item,{...item,id:'audit-2',name:'Fresh nopal',status:'draft'}],summary:{total:2,public:1,quantities:{kg:2400},profileCompletion:100}};
const buyer={profile:{...profile,role:'buyer'},savedItems:[item,{...item,id:'audit-2',name:'Fresh nopal',description:'Seasonal supply.'}],page:1,hasMore:false};
const cases=[
 {id:'landing',path:'/'}, {id:'logistics',path:'/',tab:'LOGISTICS'},
 {id:'commercial-form',path:'/',tab:'COMMERCIAL',inquiry:true}, {id:'readiness',path:'/',tab:'READINESS'},
 ...['explore','login','signup','verify-email','forgot-password','reset-password','onboarding','account','producer/dashboard','buyer/dashboard','workspace','buyer'].map(p=>({id:p.replaceAll('/','-'),path:'/'+p})),
 {id:'produce-detail-long',path:'/explore?id=audit-only',fixture:'detail'},
 {id:'explore-empty',path:'/explore',fixture:'empty'}, {id:'explore-error',path:'/explore',fixture:'error'}, {id:'explore-loading',path:'/explore',fixture:'loading'},
 {id:'producer-long',path:'/producer/dashboard',fixture:'producer'}, {id:'buyer-long',path:'/buyer/dashboard',fixture:'buyer'},
 {id:'reset-authorized',path:'/reset-password',fixture:'recovery'}, {id:'onboarding-form',path:'/onboarding',fixture:'onboarding'},
 {id:'verify-error',path:'/verify-email?purpose=recovery&error_code=otp_expired&type=recovery'},
 {id:'login-error',path:'/login',fixture:'login-error'},
 ...['producer-empty','buyer-empty','producer-success','producer-saving','buyer-error'].map(id=>({id,path:id.startsWith('buyer')?'/buyer/dashboard':'/producer/dashboard',fixture:id})),
 {id:'signup-selected',path:'/signup',fixture:'selected'},
];
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results=[];
await mkdir(output,{recursive:true});
try {
 for(const [width,height] of sizes){
  for(const scenario of cases.filter(c=>!process.env.AUDIT_CASES||process.env.AUDIT_CASES.split(',').includes(c.id))){
   const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
   const page=await context.newPage();page.setDefaultTimeout(6000);
   const result={id:scenario.id,width,height,mode:scenario.fixture?'synthetic API fixture':'actual HTTP, signed out',origin};
   try {
    await page.route('**/api/**',async route=>{
     const req=route.request(), path=new URL(req.url()).pathname;
     if(!scenario.fixture){if(req.method()!=='GET')return route.abort();return route.continue();}
     if(path==='/api/auth/session')return route.fulfill({json:scenario.fixture==='login-error'?{}:{user:{email:profile.business_email},profile:scenario.fixture==='onboarding'?null:{...profile,role:scenario.fixture.startsWith('buyer')?'buyer':'producer'},recovery:scenario.fixture==='recovery'}});
     if(path==='/api/producer/dashboard')return route.fulfill({json:scenario.fixture==='producer-empty'?{...produce,items:[],summary:{total:0,public:0,quantities:{},profileCompletion:100}}:produce});
     if(path==='/api/buyer/dashboard')return route.fulfill({json:scenario.fixture==='buyer-empty'?{...buyer,savedItems:[]}:buyer});
     if(path==='/api/producer/profile'||path==='/api/buyer/profile'){
      if(scenario.fixture==='producer-saving')await new Promise(r=>setTimeout(r,2500));
      if(scenario.fixture==='buyer-error')return route.fulfill({status:503,json:{error:'Unable to save your changes. Please try again. '+long}});
      return route.fulfill({json:path.includes('/producer/')?produce:buyer}).catch(()=>{});
     }
     if(path==='/api/auth/login')return route.fulfill({status:400,json:{error:'Unable to sign in. Check your email address and password. '+long}});
     if(path==='/api/public/produce'){
      if(scenario.fixture==='loading'){await new Promise(r=>setTimeout(r,2500));return route.fulfill({json:{items:[],page:1,hasMore:false}}).catch(()=>{});}
      if(scenario.fixture==='error')return route.fulfill({status:503,json:{error:'We could not load the harvest directory. Please try again. '+long}});
      return route.fulfill({json:{items:scenario.fixture==='empty'?[]:scenario.fixture==='detail'?[item]:[item,{...item,id:'audit-2',name:'Fresh nopal',description:'Seasonal supply.'},{...item,id:'audit-3',name:'Hass avocado',description:'Harvest ready.'}],page:1,hasMore:false}});
     }
     return route.fulfill({status:403,json:{error:'Audit blocks all other requests'}});
    });
    const response=await page.goto(origin+scenario.path,{waitUntil:'domcontentloaded',timeout:30000});result.http=response?.status();
    if(scenario.tab)await page.getByRole('tab',{name:scenario.tab,exact:true}).click();
    if(scenario.inquiry)await page.locator('.inquiry-opener').click();
    if(scenario.fixture?.startsWith('producer'))await page.getByRole('button',{name:'Save profile',exact:true}).waitFor();
    if(scenario.fixture?.startsWith('buyer'))await page.getByRole('button',{name:'Save buyer profile',exact:true}).waitFor();
    if(scenario.fixture==='recovery')await page.getByRole('button',{name:'Update password',exact:true}).waitFor();
    if(scenario.fixture==='onboarding')await page.getByRole('button',{name:'Complete onboarding',exact:true}).waitFor();
    if(scenario.fixture==='selected')await page.getByRole('radio',{name:/Buyer/}).check();
    if(scenario.fixture==='producer-success'||scenario.fixture==='producer-saving'){
     await page.getByRole('button',{name:'Save profile',exact:true}).click();
     if(scenario.fixture==='producer-success')await page.getByText('Changes saved.',{exact:true}).waitFor();
    }
    if(scenario.fixture==='buyer-error'){await page.getByRole('button',{name:'Save buyer profile',exact:true}).click();await page.getByRole('alert').waitFor();}
    if(scenario.fixture==='detail')await page.locator('.produce-card details').first().evaluate(el=>el.open=true);
    if(scenario.fixture==='login-error'){
     await page.getByLabel('Email address',{exact:true}).fill(profile.business_email.slice(0,230));
     await page.getByLabel('Password',{exact:true}).fill('Synthetic-not-a-real-password');
     await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('alert').waitFor();
    }
    if(!scenario.fixture&&scenario.path!=='/'&&scenario.path!=='/explore')await page.waitForTimeout(250);
    if(!scenario.fixture&&scenario.path==='/explore')await page.locator('[role="status"], [role="alert"]').first().waitFor();
    await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(80);
    result.metrics=await page.evaluate(()=>{
     const visible=el=>!!el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
     const rect=el=>{if(!el)return null;const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};
     const header=document.querySelector('header'),brand=header?.querySelector('.brand'),nav=header?.querySelector('.site-nav');
     const overflow=[...document.querySelectorAll('h1,h2,h3,h4,p,button,input,select,textarea,article,fieldset,main,nav,dl')].filter(visible).filter(el=>!el.closest('.leaflet-pane')).filter(el=>{const r=el.getBoundingClientRect();return r.right>innerWidth+1||r.left< -1;}).map(el=>({tag:el.tagName,class:el.className,text:el.textContent?.slice(0,60),...rect(el)}));
     const controls=[...document.querySelectorAll('button,a,input,select,summary')].filter(visible).filter(el=>!el.closest('.leaflet-control-attribution')).map(el=>({text:(el.getAttribute('aria-label')||el.textContent||el.getAttribute('name')||'').slice(0,50),...rect(el)}));
     const smallTargets=controls.filter(r=>r.height<44&&r.width<44);
     const main=document.querySelector('main');
     const color=sel=>{const el=document.querySelector(sel);return el?{foreground:getComputedStyle(el).color,background:getComputedStyle(el.closest('.account-card')||el).backgroundColor}:null;};
     const headings=[...document.querySelectorAll('h1,h2,h3,h4')].filter(visible).map(el=>({text:el.textContent?.slice(0,40),...rect(el)}));
     return {eyebrowColor:color('.account-card .eyebrow'),viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyHeight:document.documentElement.scrollHeight,header:rect(header),brand:rect(brand),nav:rect(nav),main:rect(main),overflow,smallTargets,headings,gridColumns:[...document.querySelectorAll('.produce-grid')].map(el=>getComputedStyle(el).gridTemplateColumns)};
    });
    const prefix=`${output}/${scenario.id}-${width}x${height}`;
    await page.screenshot({path:prefix+'.png',fullPage:true});
    if(['producer-long','buyer-long','commercial-form','logistics'].includes(scenario.id))await page.screenshot({path:prefix+'-viewport.png'});
    result.screenshot=prefix+'.png';
   } catch(e){result.error=String(e.message).split('\n')[0];}
   results.push(result);await context.close();
  }
  console.log(`Captured ${width}x${height}: ${results.filter(r=>r.width===width).length} states`);
  await writeFile(output+'/metrics.json',JSON.stringify(results,null,2));
 }
} finally{await browser.close();await writeFile(output+'/metrics.json',JSON.stringify(results,null,2));}
console.log(JSON.stringify({total:results.length,errors:results.filter(r=>r.error).map(r=>({id:r.id,width:r.width,error:r.error})),overflow:results.filter(r=>r.metrics?.scrollWidth>r.width).map(r=>({id:r.id,width:r.width,scroll:r.metrics.scrollWidth}))}));
