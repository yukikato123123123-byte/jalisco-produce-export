import {test,expect} from '@playwright/test';
// Synthetic link values only. Never replay real tokens in this suite or its reports.
for(const purpose of ['signup','recovery'])test(`one-time ${purpose} query link is scrubbed and submitted once`,async({page})=>{
 let calls=0;
 await page.route('**/api/auth/confirm-link',async r=>{
  calls++;expect(r.request().headers()['referer']).toBeUndefined();expect(r.request().postDataJSON()).toEqual({token_hash:'synthetic-link-hash-proof',type:purpose});
  expect(new URL(page.url()).searchParams.has('token_hash')).toBe(false);
  await r.fulfill({status:400,json:{error:'The verification link or code is invalid, expired or already used. Request a new email for the intended action.'}});
 });
 await page.goto(`/verify-email?token_hash=synthetic-link-hash-proof&type=${purpose}`);
 await expect(page.getByRole('alert')).toContainText('invalid, expired or already used');
 await expect(page.getByLabel('Code purpose')).toHaveValue(purpose);expect(calls).toBe(1);
 await expect(page).toHaveURL(purpose==='recovery'?/\/verify-email\?purpose=recovery$/:/\/verify-email$/);
});
for(const purpose of ['signup','recovery'])test(`valid ${purpose} query link reaches the correct next step`,async({page})=>{
 let callbacks=0;
 await page.route('**/api/auth/confirm-link',r=>{callbacks++;return r.fulfill({json:{ok:true}});});
 await page.route('**/api/auth/session',r=>r.fulfill({json:{profile:null,user:{email:'test@example.test'},recovery:purpose==='recovery'}}));
 await page.goto(`/verify-email?token_hash=synthetic-link-hash-proof&type=${purpose}`);
 await expect(page).toHaveURL(purpose==='recovery'?/\/reset-password$/:/\/account$/);expect(callbacks).toBe(1);
 if(purpose==='recovery')await expect(page.getByRole('button',{name:'Update password',exact:true})).toBeVisible();else await expect(page.getByRole('link',{name:'Open market research',exact:true})).toBeVisible();
});
test('PKCE code and wrong-purpose links are rejected locally without automatic network verification',async({page})=>{
 let calls=0;await page.route('**/api/auth/confirm-link',r=>{calls++;return r.fulfill({status:400,json:{error:'Unexpected'}});});
 await page.goto('/verify-email?code=synthetic-code');await expect(page.getByRole('alert')).toContainText('PKCE');await expect(page).toHaveURL(/\/verify-email$/);
 await page.goto('/verify-email?type=invite&token_hash=synthetic-link-hash-proof');await expect(page.getByRole('alert')).toContainText('different authentication action');expect(calls).toBe(0);
});
test('implicit signup callback is retained and duplicate effects do not submit twice',async({page})=>{
 let calls=0;await page.route('**/api/auth/callback',r=>{calls++;expect(r.request().postDataJSON().type).toBe('signup');return r.fulfill({json:{ok:true}});});
 await page.route('**/api/auth/session',r=>r.fulfill({json:{profile:null,user:{email:'test@example.test'},recovery:false}}));
 await page.goto('/verify-email#type=signup&access_token=synthetic-access-token-value');await expect(page).toHaveURL(/\/account$/);expect(calls).toBe(1);
});

test('provider verify recovery redirect reaches reset form, saves password and allows subsequent sign-in',async({page,baseURL})=>{
 // Real redirect shape; provider and password storage are synthetic in this
 // regression test. No deployed user password or real email is touched.
 let recovery=false,changed=false,callbacks=0;
 const token='synthetic-access-token-value';
 const profile={full_name:'Test Buyer',company:'Buyer',country:'Japan',role:'buyer',region:'',bio:''};
 await page.route('https://synthetic-provider.example/auth/v1/verify?*',r=>{
  const url=new URL(r.request().url());expect(url.searchParams.get('type')).toBe('recovery');
  const redirect=new URL(url.searchParams.get('redirect_to')!);redirect.hash=`access_token=${token}&refresh_token=synthetic-refresh&expires_in=3600&token_type=bearer&type=recovery`;
  return r.fulfill({status:303,headers:{Location:redirect.href},body:''});
 });
 await page.route('**/api/auth/callback',r=>{callbacks++;expect(r.request().postDataJSON()).toEqual({access_token:token,type:'recovery'});expect(r.request().headers()['referer']).toBeUndefined();recovery=true;return r.fulfill({json:{ok:true}});});
 await page.route('**/api/auth/session',r=>r.fulfill({json:{profile,user:{email:'test@example.test'},recovery}}));
 await page.route('**/api/auth/reset-password',r=>{expect(recovery).toBe(true);expect(r.request().postDataJSON().password).toBe('changed-synthetic-password-123');changed=true;recovery=false;return r.fulfill({json:{ok:true}});});
 await page.route('**/api/auth/login',r=>{expect(changed).toBe(true);expect(r.request().postDataJSON().password).toBe('changed-synthetic-password-123');return r.fulfill({json:{ok:true}});});
 await page.route('**/api/buyer/dashboard',r=>r.fulfill({json:{profile,savedItems:[],page:1,hasMore:false}}));
 await page.route('**/api/public/produce*',r=>r.fulfill({json:{items:[],page:1,hasMore:false}}));
 const redirect=baseURL+'/verify-email?purpose=recovery';
 await page.goto(`https://synthetic-provider.example/auth/v1/verify?token=synthetic-mail-proof&type=recovery&redirect_to=${encodeURIComponent(redirect)}`);
 await expect(page).toHaveURL(/\/reset-password$/);expect(callbacks).toBe(1);
 await expect(page.getByText('legacy session-token',{exact:false})).toHaveCount(0);
 await page.getByLabel('New password',{exact:true}).fill('changed-synthetic-password-123');await page.getByRole('button',{name:'Update password',exact:true}).click();await expect(page.getByRole('status')).toContainText('Your password has been updated');
 await page.goto('/login');await page.getByLabel('Email address',{exact:true}).fill('test@example.test');await page.getByLabel('Password',{exact:true}).fill('changed-synthetic-password-123');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(/\/account$/);
});
test('expired provider recovery redirect and reused callback show recovery errors without entering reset form',async({page})=>{
 let calls=0;await page.route('**/api/auth/callback',r=>{calls++;return r.fulfill({status:400,json:{error:'This recovery session is invalid, expired or already used. Request a new recovery email.'}});});
 await page.goto('/verify-email?purpose=recovery#error=access_denied&error_code=otp_expired&type=recovery');await expect(page.getByRole('alert')).toContainText('password recovery link is invalid, expired or already used');expect(calls).toBe(0);
 await page.goto('/verify-email?purpose=recovery#access_token=synthetic-access-token-value&type=recovery');await page.reload();
 await expect(page.getByRole('alert')).toContainText('recovery session is invalid, expired or already used');expect(calls).toBe(1);await expect(page.getByRole('button',{name:'Update password',exact:true})).toHaveCount(0);
});
