import {chromium} from '../../artifacts/analytics-qa/tools/node_modules/playwright/index.mjs';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fixture} from './analytics-fixture.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[],requests=[];let fail=false,empty=false;let holds=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('503'))errors.push(m.text())});
await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(path==='/api/auth/me')return route.fulfill({json:{user:{id:1,name:'Analytics QA',role:'ADMIN'}}});
  if(path==='/api/analytics/overview'){
    requests.push(Object.fromEntries(url.searchParams));
    if(fail)return route.fulfill({status:503,json:{error:'Analytics test: service unavailable'}});
    const d=await fixture(Object.fromEntries(url.searchParams));
    if(empty){for(const k of Object.keys(d.overview))d.overview[k]=0;d.top=[];d.categories=[];d.suppliers=[];d.slow=[];d.fast=[];d.returns.top=[];d.products={rows:[],total:0,page:1,pageSize:25};d.stockMovement=d.stockMovement.map(r=>({...r,count:0,value:0}));d.channels=d.channels.map(r=>({...r,revenue:0}));}
    return route.fulfill({json:d});
  }
  if(path==='/api/admin/held-sales'){if(route.request().method()==='POST'){const body=route.request().postDataJSON();holds=[{id:1,referenceNumber:'HOLD-QA',customerData:body.customer,items:body.items}];return route.fulfill({json:holds[0]})}return route.fulfill({json:holds})}
  if(path==='/api/admin/held-sales/1'){holds=[];return route.fulfill({json:{ok:true}})}
  if(path==='/api/admin/products/search')return route.fulfill({json:[{id:1,name:'QA Sparkler',sku:'QA-1',stock:10,sellingPrice:100,retailPrice:100,category:'Sparklers'}]});
  if(path==='/api/admin/settings')return route.fulfill({json:{shopName:'Saravana Crackers'}});
  return route.fulfill({json:[]});
});
const ready=()=>page.waitForFunction(()=>document.querySelector('.analytics')?.getAttribute('aria-busy')==='false');
try {
  await page.goto('http://127.0.0.1:5173/admin/analytics');await ready();
  assert.equal(await page.locator('.an-kpi').count(),10);
  await page.getByLabel('Date range',{exact:true}).selectOption('Today');await ready();
  await page.getByLabel('Sales channel',{exact:true}).selectOption('Online');await ready();assert.equal(requests.at(-1).channel,'Online');
  await page.getByLabel('Category',{exact:true}).selectOption('1');await ready();assert.equal(requests.at(-1).category,'1');
  await page.getByLabel('Brand',{exact:true}).selectOption('Test Brand');await ready();assert.equal(requests.at(-1).brand,'Test Brand');
  await page.getByLabel('Supplier',{exact:true}).selectOption('1');await ready();assert.equal(requests.at(-1).supplier,'1');
  await page.getByLabel('Product search',{exact:true}).fill('Rocket');await ready();assert.equal(requests.at(-1).search,'Rocket');
  await page.getByRole('button',{name:'Weekly',exact:true}).click();
  await page.getByRole('button',{name:'Slow moving products',exact:false}).click();await ready();assert.equal(requests.at(-1).view,'slow');
  await page.getByRole('button',{name:'Reset drill-down'}).click();await ready();
  await page.getByRole('button',{name:'Next',exact:true}).click();await ready();assert.equal(requests.at(-1).page,'2');
  await page.getByRole('button',{name:'Previous',exact:true}).click();await ready();
  await page.waitForTimeout(1600);console.log('CHART CHECK',await page.locator('.recharts-sector').count());assert.ok(await page.locator('.recharts-sector').count()>0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'No desktop overflow');await page.evaluate(()=>window.scrollTo(0,0));await mkdir(new URL('../../artifacts/analytics-qa/',import.meta.url),{recursive:true});
  await page.screenshot({path:new URL('../../artifacts/analytics-qa/desktop.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
  for(const width of [768,390]){await page.setViewportSize({width,height:900});await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,`No page overflow at ${width}px`)}
  await page.screenshot({path:new URL('../../artifacts/analytics-qa/mobile.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
  fail=true;await page.getByRole('button',{name:'Refresh'}).click();await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').textContent(),/service unavailable/);
  fail=false;empty=true;await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByText('No matching activity for this selection.').first().waitFor();await ready();assert.ok(await page.getByText('No matching activity for this selection.').count()>0);
  await page.goto('http://127.0.0.1:5173/admin/billing');await page.getByRole('button',{name:'Hold Bills',exact:true}).click();await page.getByRole('heading',{name:'Hold Bills',exact:true}).waitFor();assert.equal(await page.getByText('No Hold Bills.',{exact:true}).count(),1);assert.equal(await page.getByText(/Held Bills/i).count(),0);
  await page.getByRole('button',{name:'Close',exact:true}).click();await page.getByPlaceholder('Search crackers by name, code or category...').fill('QA');await page.locator('.suggestions button').first().click();await page.getByRole('button',{name:'HOLD BILL',exact:true}).click();await page.getByText('Hold Bill HOLD-QA saved',{exact:true}).waitFor();assert.equal(holds.length,1);assert.equal(holds[0].items[0].quantity,1);await page.getByRole('button',{name:'Hold Bills',exact:true}).click();await page.locator('.held-row').click();assert.equal(holds.length,0);await page.locator('.bill-table').getByText('QA Sparkler',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);console.log('PASS browser: desktop, tablet, mobile, filters, chart toggle, drill-down, pagination, error/retry, empty state, Hold Bills dialog, no JS errors (fixture API)');
}finally{await browser.close()}
