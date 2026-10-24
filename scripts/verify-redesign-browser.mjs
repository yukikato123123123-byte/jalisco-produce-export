// Live, read-only browser verification. No credentials, signup or email submission.
import { chromium } from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import console from 'node:console';
const origin='https://jalisco-auth-staging.yukikato123123123.workers.dev';
mkdirSync('.wrangler/redesign/live',{recursive:true});
const results=[];const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 for(const width of [375,1440]){
  const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.name));
  for(const path of ['/','/explore','/producers','/buyers','/logistics','/commercial','/readiness','/login','/signup','/forgot-password','/verify-email','/account','/producer/dashboard','/buyer/dashboard','/admin']){
   const response=await page.goto(origin+path);await page.locator('h1').waitFor();
   if(path==='/producers')await page.locator('.producer-directory-entry').first().waitFor();
   if(path==='/admin')await page.getByRole('alert').waitFor();
   if(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth>globalThis.innerWidth))throw new Error(`Page overflow at ${width} ${path}`);
   if(response.status()!==200)throw new Error(`HTTP ${response.status()} at ${path}`);
   if(path==='/'&&!((await page.locator('h1').innerText()).includes('Rooted in Jalisco.')))throw new Error('Home not deployed');
   if(path==='/producers'&&await page.locator('.producer-directory-entry').count()!==1)throw new Error('Unexpected producer count');
   if(path==='/admin'&&!((await page.getByRole('alert').innerText()).includes('sign in')))throw new Error('Anonymous administrator access did not fail closed');
   if(['/','/producers','/admin','/login'].includes(path))await page.screenshot({path:`.wrangler/redesign/live/${path.replaceAll('/','-')||'home'}-${width}.png`,fullPage:true});
   results.push({path,width,status:response.status(),overflow:false,result:'PASS'});
  }
  if(errors.length)throw new Error(`Browser script errors: ${errors.join(',')}`);await page.close();
 }
 writeFileSync('.wrangler/redesign/live-browser.json',JSON.stringify(results,null,2));console.log(JSON.stringify({result:'PASS',checks:results.length,viewports:[375,1440],apiInterception:false},null,2));
}finally{await browser.close();}
