import { test, expect } from '@playwright/test';
// UI response stubs below validate presentation/navigation only. Provider email
// delivery and real credentials are deliberately outside this regression suite.
test('public NopaHua concept stays open without authentication or a commerce map',async({page})=>{await page.goto('/');await expect(page.locator('.nopal-wordmark').first()).toHaveText('NopaHua');await expect(page.locator('.leaflet-container')).toHaveCount(0);await expect(page.getByRole('link',{name:'MARKET RESEARCH',exact:true})).toBeVisible();});
test('signup validates fields and only shows conditional email guidance after an accepted API response', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/auth/signup', async r => { requests++; expect(r.request().postDataJSON().registration_type).toBe('research');expect(r.request().postDataJSON().role).toBeUndefined(); await r.fulfill({ json: { message: 'If this address is eligible, check your inbox.' } }); });
  await page.goto('/signup'); await page.getByRole('button', { name: 'Create account', exact: true }).click(); expect(requests).toBe(0);
  await page.getByLabel('Email address', { exact: true }).fill('person@example.test'); await page.getByLabel('Password', { exact: true }).fill('valid-password-123'); if(new URL(page.url()).pathname==='/signup'){await page.getByLabel('Confirm password',{exact:true}).fill('valid-password-123');await page.locator('.signup-acknowledgement input').check();}
  await page.getByRole('button', { name: 'Create account', exact: true }).click(); await expect(page.getByRole('status')).toContainText('If this address is eligible'); expect(requests).toBe(1);
});
test('login errors never imply success; protected routes do not reveal workspace content', async ({ page }) => {
  await page.route('**/api/auth/**', r => r.fulfill({ status: 401, json: { error: 'Please sign in to continue.' } }));
  await page.goto('/login'); await page.getByLabel('Email address').fill('person@example.test'); await page.getByLabel('Password', { exact: true }).fill('invalid-password'); await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('Please sign in'); expect(new URL(page.url()).pathname).toBe('/login');
  const retired=await page.goto('/producer/dashboard');expect(retired!.status()).toBe(410); await expect(page.getByText('Inventory, sourcing', { exact: false })).toHaveCount(0);
});
test('expired email codes show an error; recovery email request and password reset use separate steps', async ({ page }) => {
  await page.route('**/api/auth/verify', r => r.fulfill({ status: 400, json: { error: 'Code is invalid or expired.' } }));
  await page.goto('/verify-email'); await page.getByLabel('Email address', { exact: true }).first().fill('person@example.test'); await page.getByLabel('Email confirmation code').fill('000000'); await page.getByRole('button', { name: 'Verify code' }).click(); await expect(page.getByRole('alert')).toContainText('expired');
  await page.route('**/api/auth/forgot-password', r => r.fulfill({ json: { message: 'If this address is eligible, check your inbox.' } }));
  await page.goto('/forgot-password'); await page.getByLabel('Email address').fill('person@example.test'); await page.getByRole('button', { name: 'Send recovery code' }).click(); await expect(page.getByRole('status')).toContainText('If this address is eligible');
});
for (const width of [390, 1440]) test(`account forms fit ${width}px viewport`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  for (const route of ['/login', '/signup', '/forgot-password', '/verify-email']) { await page.goto(route); await expect(page.locator('#account-title')).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
});
test('role workspace and logout show server-confirmed state only', async ({ page }) => {
  const profile = { full_name: 'Test Buyer', company: 'Test Company', country: 'United States', role: 'buyer' };
  await page.route('**/api/auth/session', r => r.fulfill({ json: { user: { email: 'buyer@example.test' }, profile, recovery: false } }));
  await page.route('**/api/buyer/dashboard', r => r.fulfill({ json: { profile: { ...profile, region: '', bio: '' }, savedItems: [], page: 1, hasMore: false } }));
  let loggedOut = false; await page.route('**/api/auth/logout', r => { loggedOut = true; return r.fulfill({ json: { ok: true } }); });
  await page.goto('/account');await expect(page.getByRole('heading',{name:'Your NopaHua account.',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Open market research',exact:true})).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click(); await expect(page).toHaveURL(/\/login$/); expect(loggedOut).toBe(true);
});
test('recovery session updates password only after API success', async ({ page }) => {
  await page.route('**/api/auth/session', r => r.fulfill({ json: { user: { email: 'test@example.test' }, profile: null, recovery: true } }));
  let reset = false; await page.route('**/api/auth/reset-password', r => { reset = true; expect(r.request().postDataJSON().password).toBe('changed-password-123'); return r.fulfill({ json: { ok: true } }); });
  await page.goto('/reset-password'); await page.getByLabel('New password', { exact: true }).fill('changed-password-123'); await page.getByRole('button', { name: 'Update password' }).click(); await expect(page.getByRole('status')).toContainText('Your password has been updated'); expect(reset).toBe(true);
});
test('successful sign-in uses server session to enter the NopaHua account', async ({ page }) => {
  const profile = { full_name: 'Test Producer', company: 'Test Farm', country: 'Mexico', role: 'producer' };
  await page.route('**/api/auth/login', r => r.fulfill({ json: { ok: true } }));
  await page.route('**/api/auth/session', r => r.fulfill({ json: { user: { email: 'producer@example.test' }, profile, recovery: false } }));
  await page.route('**/api/producer/dashboard', r => r.fulfill({ json: { profile: { ...profile, region: '', bio: '', business_email: '', business_phone: '', public_contact: 0 }, items: [], summary: { total: 0, public: 0, quantities: {}, profileCompletion: 40 } } }));
  await page.goto('/login'); await page.getByLabel('Email address').fill('producer@example.test'); await page.getByLabel('Password', { exact: true }).fill('valid-password-123'); if(new URL(page.url()).pathname==='/signup'){await page.getByLabel('Confirm password',{exact:true}).fill('valid-password-123');await page.locator('.signup-acknowledgement input').check();} await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);await expect(page.getByRole('heading',{name:'Your NopaHua account.',exact:true})).toBeVisible();
});
test('public NopaHua homepage and its login link work at mobile width',async({page})=>{await page.setViewportSize({width:375,height:900});await page.goto('/');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('.nopal-header').getByRole('link',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(/\/login$/);await expect(page.getByLabel('Password',{exact:true})).toBeVisible();await expect(page.locator('.leaflet-container')).toHaveCount(0);});
for (const [status, message] of [[400, 'Check the submitted details and try again.'], [401, 'Authentication service is temporarily unavailable.'], [403, 'Authentication service is temporarily unavailable.'], [422, 'Choose a different, stronger password.'], [429, 'Too many attempts. Please wait.'], [503, 'Authentication service is temporarily unavailable.']] as const) {
  test(`email request HTTP ${status} retains form values and never presents acceptance`, async ({ page }) => {
    // HTTP/UI contract only; Worker classification is tested separately against provider statuses.
    await page.route('**/api/auth/signup', r => r.fulfill({ status, headers: status === 429 ? { 'Retry-After': '2' } : {}, json: { error: message } }));
    await page.goto('/signup'); await page.getByLabel('Email address', { exact: true }).fill('test@example.test'); await page.getByLabel('Password', { exact: true }).fill('valid-password-123'); if(new URL(page.url()).pathname==='/signup'){await page.getByLabel('Confirm password',{exact:true}).fill('valid-password-123');await page.locator('.signup-acknowledgement input').check();}
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(message); await expect(page.getByRole('status')).toHaveCount(0);
    await expect(page.getByLabel('Email address', { exact: true })).toHaveValue('test@example.test'); await expect(page.getByLabel('Password', { exact: true })).toHaveValue('valid-password-123');
    if (status === 429) { await expect(page.getByRole('button', { name: /Try again in/ })).toBeDisabled(); await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeEnabled({ timeout: 5000 }); }
    else await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeEnabled();
  });
}
test('recovery and resend service failures keep email fields and do not show acceptance', async ({ page }) => {
  await page.route('**/api/auth/forgot-password', r => r.fulfill({ status: 503, json: { error: 'Authentication service is temporarily unavailable.' } }));
  await page.route('**/api/auth/resend', r => r.fulfill({ status: 503, json: { error: 'Authentication service is temporarily unavailable.' } }));
  await page.goto('/forgot-password'); await page.getByLabel('Email address').fill('test@example.test'); await page.getByRole('button', { name: 'Send recovery code' }).click();
  await expect(page.getByRole('alert')).toContainText('temporarily unavailable'); await expect(page.getByLabel('Email address')).toHaveValue('test@example.test'); await expect(page.getByRole('status')).toHaveCount(0);
  await page.goto('/verify-email'); await page.getByText('Need a new confirmation code?').click(); await page.locator('details input[name="email"]').fill('test@example.test'); await page.getByRole('button', { name: 'Resend confirmation code' }).click();
  await expect(page.getByRole('alert')).toContainText('temporarily unavailable'); await expect(page.locator('details input[name="email"]')).toHaveValue('test@example.test'); await expect(page.getByRole('status')).toHaveCount(0);
});
test('a consumed recovery proof hides the reset form and explains how to restart', async ({ page }) => {
  await page.route('**/api/auth/session', r => r.fulfill({ json: { user: { email: 'test@example.test' }, profile: null, recovery: true } }));
  await page.route('**/api/auth/reset-password', r => r.fulfill({ status: 503, headers: { 'Retry-After': '120' }, json: { recoveryConsumed: true, error: 'Recovery could not be confirmed. Request a new recovery code.' } }));
  await page.goto('/reset-password'); await page.getByLabel('New password', { exact: true }).fill('changed-password-123'); await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('alert')).toContainText('new recovery code'); await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0); await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Enter email code' })).toBeVisible();
});
test('resend failure clears guidance left by an earlier accepted request', async ({ page }) => {
  let count = 0;
  await page.route('**/api/auth/resend', r => ++count === 1 ? r.fulfill({ json: { message: 'If this address is eligible, check your inbox.' } }) : r.fulfill({ status: 503, json: { error: 'Authentication service is temporarily unavailable.' } }));
  await page.goto('/verify-email'); await page.getByText('Need a new confirmation code?').click(); await page.locator('details input[name="email"]').fill('test@example.test');
  await page.getByRole('button', { name: 'Resend confirmation code' }).click(); await expect(page.getByRole('status')).toContainText('eligible');
  await page.getByRole('button', { name: 'Resend confirmation code' }).click(); await expect(page.getByRole('alert')).toContainText('temporarily unavailable'); await expect(page.getByRole('status')).toHaveCount(0);
});

for (const [fragment, message] of [
  ['error=access_denied&error_description=expired', 'The confirmation link is invalid, expired or already used. Request a new confirmation email.'],
  ['type=invite&access_token=synthetic-test-token', 'This link is for a different authentication action. Use a signup confirmation or password recovery email.'],
] as const) {
  test(`invalid confirmation link shows its initial error: ${message}`, async ({ page }) => {
    let callbackRequests = 0;
    await page.route('**/api/auth/callback', route => {
      callbackRequests++;
      return route.fulfill({ status: 400, json: { error: 'Unexpected callback request' } });
    });
    await page.goto(`/verify-email#${fragment}`);
    await expect(page.getByRole('alert')).toHaveText(message);
    await expect(page).toHaveURL(/\/verify-email(?:\?purpose=recovery)?$/);
    await expect(page.getByRole('button', { name: 'Verify code', exact: true })).toBeVisible();
    expect(callbackRequests).toBe(0);
  });
}

test('synchronous duplicate signup submissions produce one request', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/auth/signup', route => {
    requests++;
    return route.fulfill({ json: { message: 'If this address is eligible, check your inbox.' } });
  });
  await page.goto('/signup');
  await page.getByLabel('Email address', { exact: true }).fill('test@example.test');
  await page.getByLabel('Password', { exact: true }).fill('valid-password-123'); if(new URL(page.url()).pathname==='/signup'){await page.getByLabel('Confirm password',{exact:true}).fill('valid-password-123');await page.locator('.signup-acknowledgement input').check();}
  const calls = await page.evaluate(() => {
    let calls = 0;
    const original = window.fetch;
    window.fetch = (...args) => { if (String(args[0]).endsWith('/api/auth/signup')) calls++; return original(...args); };
    const form = document.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    return calls;
  });
  expect(calls).toBe(1);
  await expect(page.getByRole('status')).toContainText('eligible');
  expect(requests).toBe(1);
});
test('duplicate resend and cooldown submissions never trigger automatic retries', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/auth/resend', route => {
    requests++;
    return route.fulfill({ status: 429, headers: { 'Retry-After': '2' }, json: { code: 'email_rate_limited', error: 'Too many attempts. Please wait before trying again.' } });
  });
  await page.goto('/verify-email');
  await page.getByText('Need a new confirmation code?').click();
  await page.locator('details input[name="email"]').fill('test@example.test');
  const calls = await page.evaluate(() => {
    let calls = 0;
    const original = window.fetch;
    window.fetch = (...args) => { if (String(args[0]).endsWith('/api/auth/resend')) calls++; return original(...args); };
    const form = document.querySelector('details form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    return calls;
  });
  expect(calls).toBe(1);
  await expect(page.getByRole('alert')).toContainText('timer does not guarantee');
  await page.locator('details form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await expect(page.getByRole('button', { name: 'Resend confirmation code', exact: true })).toBeEnabled({ timeout: 5000 });
  expect(requests).toBe(1);
});

test('retired inventory pages cannot trigger business requests',async({page})=>{let writes=0;await page.route('**/api/producer/**',r=>{writes++;return r.fulfill({status:410,json:{error:'Retired'}});});for(const path of ['/producer/dashboard','/buyer/dashboard']){const r=await page.goto(path);expect(r!.status()).toBe(410);await expect(page.getByRole('button',{name:'Save item',exact:true})).toHaveCount(0);}expect(writes).toBe(0);});
