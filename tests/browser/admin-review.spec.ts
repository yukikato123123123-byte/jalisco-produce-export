import {test,expect} from '@playwright/test';
for(const status of [401,403])test(`admin access ${status} shows no private workspace or action controls`,async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('role','admin'));
 await page.route('**/api/admin/**',r=>r.fulfill({status,json:{error:status===401?'Please sign in to continue.':'A trusted owner grant is required.'}}));
 await page.goto('/admin?workspace=legacy');await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('navigation',{name:'Admin sections'})).toHaveCount(0);await expect(page.getByRole('table')).toHaveCount(0);await expect(page.getByRole('button',{name:'Confirm change',exact:true})).toHaveCount(0);
});
test('authorized accounts distinguish missing onboarding without exposing credentials',async({page})=>{
 await page.route('**/api/admin/**',r=>r.fulfill({json:new URL(r.request().url()).pathname.endsWith('overview')?{counts:{account_profiles:1,pending_onboarding:1},health:{account_scope:'Application records only'},recent:[]}:{items:[{id:'pending-subject',full_name:null,company:null,role:null,state:'onboarding_required'}],page:1,hasMore:false}}));
 await page.goto('/admin?workspace=legacy');await page.getByRole('button',{name:'Accounts',exact:true}).click();await expect(page.getByRole('cell',{name:'onboarding_required',exact:true})).toBeVisible();await expect(page.getByText('pending-subject').first()).toBeVisible();await page.getByRole('button',{name:'View details',exact:true}).click();await expect(page.getByText('Not provided').first()).toBeVisible();
});
test('access revoked during an action clears old data and blocks repeated confirmation',async({page})=>{
 let writes=0;await page.route('**/api/admin/**',r=>{const path=new URL(r.request().url()).pathname;if(r.request().method()==='POST'){writes++;return r.fulfill({status:403,json:{error:'Access was revoked.'}});}return r.fulfill({json:path.endsWith('overview')?{counts:{products:1},health:{},recent:[]}:{items:[{id:'private-id',name:'Protected Crop',state:'public'}],page:1,hasMore:false}});});
 await page.goto('/admin?workspace=legacy');await page.getByRole('button',{name:'Products',exact:true}).click();await page.getByRole('button',{name:'View details',exact:true}).click();await page.getByRole('button',{name:'Set private',exact:true}).click();await page.getByLabel('Reason for this change').fill('Owner review');await page.getByRole('button',{name:'Confirm change',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Access was revoked');await expect(page.getByText('Protected Crop',{exact:true})).toHaveCount(0);await expect(page.getByRole('navigation',{name:'Admin sections'})).toHaveCount(0);expect(writes).toBe(1);
});
test('access history displays real event fields without grant or revoke controls',async({page})=>{
 await page.route('**/api/admin/**',r=>r.fulfill({json:new URL(r.request().url()).pathname.endsWith('overview')?{counts:{grant_events:1},health:{},recent:[]}:{items:[{id:'grant-event-1',kind:'access',actor_id:'cf-token:operator',approver_id:'owner-key',target_id:'subject-id',action:'grant',state:'grant',created_at:'2026-10-23T00:00:00Z',approval_ref:'approval-123',reason:'Approved console access'}],page:1,hasMore:false}}));
 await page.goto('/admin?workspace=legacy');await page.getByRole('button',{name:'Access History',exact:true}).click();await page.getByRole('button',{name:'View details',exact:true}).click();await expect(page.getByText('cf-token:operator',{exact:true})).toBeVisible();await expect(page.getByText('approval-123',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/^(Grant|Revoke|Set)/})).toHaveCount(0);
});
test('dashboard uses returned counts, omits unsupported menus and keeps unknown values distinct',async({page})=>{
 await page.route('**/api/admin/**',r=>r.fulfill({json:{counts:{products:0,producers:2,buyers:1,account_profiles:3,drafts:0,audit_events:0,grant_events:1},health:{database:'Query succeeded',email_delivery:'Not measured'},recent:[]}}));
 await page.goto('/admin?workspace=legacy');const nav=page.getByRole('navigation',{name:'Admin sections'});
 await expect(nav.getByRole('button')).toHaveCount(12);
 await expect(nav.getByRole('button',{name:/Orders|Settings|Analytics|Content|Notifications/})).toHaveCount(0);
 await expect(page.locator('.overview-kpi').filter({hasText:'Registered products'}).getByRole('strong')).toHaveText('0');
 await page.getByText('More operational details',{exact:true}).click();await expect(page.getByRole('button',{name:/Pending onboarding/})).toContainText('Not queried');
 await expect(page.getByText('Email delivery is not configured.',{exact:true})).toBeVisible();
 await expect(page.getByText('Not measured',{exact:true})).toBeVisible();
});
test('dashboard work queue applies the server filter and mobile layout stays within viewport',async({page})=>{
 const queries:string[]=[];
 await page.route('**/api/admin/**',r=>{const u=new URL(r.request().url());queries.push(u.pathname+u.search);return r.fulfill({json:u.pathname.endsWith('overview')?{counts:{products:1,drafts:1},health:{},recent:[]}:{items:[],page:1,hasMore:false}});});
 await page.setViewportSize({width:375,height:812});await page.goto('/admin?workspace=legacy');
 await page.getByText('More operational details',{exact:true}).click();await page.getByRole('button',{name:/Draft products/}).click();
 await expect(page.getByRole('heading',{name:'No records match this view'})).toBeVisible();
 await expect(page.getByLabel('Status filter')).toHaveValue('draft');
 expect(queries.some(q=>q.includes('/products?status=draft'))).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.getByRole('navigation',{name:'Admin sections'}).getByRole('button',{name:'Products',exact:true})).toHaveAttribute('aria-current','page');
});
test('successful publication change displays confirmation only after the protected API succeeds',async({page})=>{
 let writes=0;
 await page.route('**/api/admin/**',r=>{const path=new URL(r.request().url()).pathname;if(r.request().method()==='POST'){writes++;expect(JSON.parse(r.request().postData()||'{}').reason).toBe('Reviewed publication');return r.fulfill({json:{ok:true}});}return r.fulfill({json:path.endsWith('overview')?{counts:{products:1},health:{},recent:[]}:{items:[{id:'test-product',name:'Test Product',state:'draft'}],page:1,hasMore:false}});});
 await page.goto('/admin?workspace=legacy');await page.getByRole('button',{name:'Products',exact:true}).click();await page.getByRole('button',{name:'View details',exact:true}).click();await page.getByRole('button',{name:'Set public',exact:true}).click();
 await page.getByLabel('Reason for this change').fill('Reviewed publication');await page.getByRole('button',{name:'Confirm change',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Change saved.'})).toBeVisible();expect(writes).toBe(1);
});
test('admin sign out uses the existing logout endpoint and returns to login',async({page})=>{
 let logoutCalls=0;
 await page.route('**/api/admin/**',r=>r.fulfill({json:{counts:{products:0},health:{},recent:[]}}));
 await page.route('**/api/auth/logout',r=>{logoutCalls++;expect(r.request().method()).toBe('POST');return r.fulfill({json:{ok:true}});});
 await page.goto('/admin?workspace=legacy');await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page).toHaveURL(/\/login$/);expect(logoutCalls).toBe(1);
});
