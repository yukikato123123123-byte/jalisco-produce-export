import { test, expect } from '@playwright/test';
// UI response stubs below validate presentation/navigation only. Provider email
// delivery and real credentials are deliberately outside this regression suite.
test('public homepage and Leaflet map remain open without authentication', async ({ page }) => {
  await page.route('https://tiles.stadiamaps.com/**', r => r.abort());
  await page.goto('/'); await expect(page.getByRole('heading', { name: /Fresh nopal/ })).toBeVisible();
  await page.getByRole('tab', { name: 'LOGISTICS', exact: true }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
  await expect(page.getByText('2.5D · Illustrative depth', { exact: true })).toBeVisible();
});
test('signup validates fields and only shows conditional email guidance after an accepted API response', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/auth/signup', async r => { requests++; expect(r.request().postDataJSON().role).toBe('producer'); await r.fulfill({ json: { message: 'If this address is eligible, check your inbox.' } }); });
  await page.goto('/signup'); await page.getByRole('button', { name: 'Create account', exact: true }).click(); expect(requests).toBe(0);
  await page.getByRole('radio', { name: /Producer/ }).check();
  await page.getByLabel('Full name', { exact: true }).fill('Test Person'); await page.getByLabel('Company or farm name').fill('Test Farm'); await page.getByLabel('Country', { exact: true }).fill('Mexico'); await page.getByLabel('Email address', { exact: true }).fill('person@example.test'); await page.getByLabel('Password', { exact: true }).fill('valid-password-123');
  await page.getByRole('button', { name: 'Create account', exact: true }).click(); await expect(page.getByRole('status')).toContainText('If this address is eligible'); expect(requests).toBe(1);
});
test('login errors never imply success; protected routes do not reveal workspace content', async ({ page }) => {
  await page.route('**/api/auth/**', r => r.fulfill({ status: 401, json: { error: 'Please sign in to continue.' } }));
  await page.goto('/login'); await page.getByLabel('Email address').fill('person@example.test'); await page.getByLabel('Password', { exact: true }).fill('invalid-password'); await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('Please sign in'); expect(new URL(page.url()).pathname).toBe('/login');
  await page.goto('/producer/dashboard'); await expect(page.getByRole('alert')).toContainText('Access unavailable'); await expect(page.getByText('Inventory, sourcing', { exact: false })).toHaveCount(0);
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
  await page.route('**/api/buyer/dashboard', r => r.fulfill({ json: { profile, message: 'Inventory, sourcing, orders and logistics integrations are not implemented.' } }));
  let loggedOut = false; await page.route('**/api/auth/logout', r => { loggedOut = true; return r.fulfill({ json: { ok: true } }); });
  await page.goto('/buyer/dashboard'); await expect(page.getByRole('heading', { name: 'Welcome, Test Buyer.' })).toBeVisible(); await expect(page.getByText('Inventory, sourcing', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click(); await expect(page).toHaveURL(/\/login$/); expect(loggedOut).toBe(true);
});
test('recovery session updates password only after API success', async ({ page }) => {
  await page.route('**/api/auth/session', r => r.fulfill({ json: { user: { email: 'test@example.test' }, profile: null, recovery: true } }));
  let reset = false; await page.route('**/api/auth/reset-password', r => { reset = true; expect(r.request().postDataJSON().password).toBe('changed-password-123'); return r.fulfill({ json: { ok: true } }); });
  await page.goto('/reset-password'); await page.getByLabel('New password', { exact: true }).fill('changed-password-123'); await page.getByRole('button', { name: 'Update password' }).click(); await expect(page.getByRole('status')).toContainText('Your password has been updated'); expect(reset).toBe(true);
});
test('successful sign-in uses server session to enter the producer workspace', async ({ page }) => {
  const profile = { full_name: 'Test Producer', company: 'Test Farm', country: 'Mexico', role: 'producer' };
  await page.route('**/api/auth/login', r => r.fulfill({ json: { ok: true } }));
  await page.route('**/api/auth/session', r => r.fulfill({ json: { user: { email: 'producer@example.test' }, profile, recovery: false } }));
  await page.route('**/api/producer/dashboard', r => r.fulfill({ json: { profile, message: 'Account workspace only.' } }));
  await page.goto('/login'); await page.getByLabel('Email address').fill('producer@example.test'); await page.getByLabel('Password', { exact: true }).fill('valid-password-123'); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/producer\/dashboard$/); await expect(page.getByRole('heading', { name: 'Welcome, Test Producer.' })).toBeVisible();
});
test('public homepage and map remain usable at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 }); await page.route('https://tiles.stadiamaps.com/**', r => r.abort());
  await page.goto('/'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('link', { name: 'Account / Sign in' })).toBeVisible();
  await page.getByRole('tab', { name: 'LOGISTICS', exact: true }).click(); await expect(page.locator('.leaflet-container')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
for (const [status, message] of [[400, 'Check the submitted details and try again.'], [401, 'Authentication service is temporarily unavailable.'], [403, 'Authentication service is temporarily unavailable.'], [422, 'Choose a different, stronger password.'], [429, 'Too many attempts. Please wait.'], [503, 'Authentication service is temporarily unavailable.']] as const) {
  test(`email request HTTP ${status} retains form values and never presents acceptance`, async ({ page }) => {
    // HTTP/UI contract only; Worker classification is tested separately against provider statuses.
    await page.route('**/api/auth/signup', r => r.fulfill({ status, headers: status === 429 ? { 'Retry-After': '2' } : {}, json: { error: message } }));
    await page.goto('/signup'); await page.getByRole('radio', { name: /Producer/ }).check();
    await page.getByLabel('Full name', { exact: true }).fill('Test Person'); await page.getByLabel('Company or farm name').fill('Test Farm'); await page.getByLabel('Country', { exact: true }).fill('Mexico'); await page.getByLabel('Email address', { exact: true }).fill('test@example.test'); await page.getByLabel('Password', { exact: true }).fill('valid-password-123');
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
