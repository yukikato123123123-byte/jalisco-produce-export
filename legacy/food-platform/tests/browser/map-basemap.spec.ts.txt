import {test,expect} from '@playwright/test';
const tile=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/e8AAAAASUVORK5CYII=','base64');
for(const width of [1440,375])test(`public map keeps GIS controls, tile origin referrer and no auth at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});const requests:string[]=[];
 await page.route('https://tile.openstreetmap.org/**',r=>{requests.push(r.request().url());return r.fulfill({status:200,contentType:'image/png',body:tile});});
 await page.goto('/logistics');await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible();await expect(page.locator('.tile-warning')).toHaveCount(0);
 await expect(page.locator('.leaflet-tile').first()).toHaveAttribute('referrerpolicy','origin');
 await expect(page.locator('.leaflet-control-attribution')).toContainText('OpenStreetMap');await expect(page.locator('.gis-marker').first()).toBeAttached();await expect(page.locator('.leaflet-gis-routes-pane path').first()).toBeAttached();
 for(const name of ['Jalisco','Border Corridor','US Markets','Full Network','Focus on Texas','Focus on Illinois']){const button=page.getByRole('button',{name,exact:true});await button.click();await expect(button).toHaveAttribute('aria-pressed','true');}
 const layers=page.locator('.gis-layer-panel input');await layers.first().uncheck();await expect(layers.first()).not.toBeChecked();await page.getByRole('button',{name:'Restore all layers',exact:true}).click();for(const box of await layers.all())await expect(box).toBeChecked();
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.getByRole('button',{name:'Zoom out',exact:true}).click();await page.reload();await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible();expect(requests.length).toBeGreaterThan(0);expect(await page.context().cookies()).toHaveLength(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
