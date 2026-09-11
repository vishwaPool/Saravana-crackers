import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {pathToFileURL} from "node:url";
const {chromium} = await import(process.env.PLAYWRIGHT_PATH ? pathToFileURL(process.env.PLAYWRIGHT_PATH).href : "../../artifacts/analytics-qa/tools/node_modules/playwright/index.mjs");
const output = join(tmpdir(), "saravana-billing-layout-qa");
await mkdir(output, {recursive:true});
const browser = await chromium.launch({channel:"chrome", headless:true});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const products = Array.from({length:12}, (_, i) => ({id:i+1, name:`Celebration crackers product ${i+1}`, sku:`QA${i+1}`, category:"Sparklers", stock:100, minimumStock:5, sellingPrice:100}));
let held = [], saved, posted;
// All requests are intercepted: billing and hold checks never touch a real database.
await page.route("**/api/**", async route => {
  const req = route.request(), url = new URL(req.url()), path = url.pathname;
  if (req.method() === "OPTIONS") return route.fulfill({status:204});
  let data;
  if (path.endsWith("/auth/me")) data = {user:{role:"ADMIN"}};
  else if (path.endsWith("/products/search")) data = products.filter(p => p.sku === url.searchParams.get("q"));
  else if (path.endsWith("/held-sales") && req.method() === "POST") {
    held = [{...req.postDataJSON(), id:1, referenceNumber:"HOLD-QA", createdAt:new Date().toISOString()}]; data = held[0];
  } else if (path.endsWith("/held-sales")) data = held;
  else if (path.endsWith("/held-sales/1")) {held = []; data = {};}
  else if (path.endsWith("/sales") && req.method() === "POST") {
    posted = req.postDataJSON();
    saved = {id:1, invoiceNumber:"QA-001", createdAt:new Date().toISOString(), status:"COMPLETED", customerName:posted.customer.name, paymentMethod:posted.paymentMethod, subtotal:1200, discountAmount:120, gst:18, roundOff:0, grandTotal:1098, items:posted.items.map((p,i)=>({...p,id:i+1,productNameSnapshot:p.name,total:p.quantity*p.sellingPrice-p.discount}))};
    data = saved;
  } else if (path.endsWith("/sales/1")) data = saved;
  else if (path.endsWith("/sales")) data = saved ? [saved] : [];
  else return route.fulfill({status:404,json:{error:`Unexpected QA route ${path}`}});
  return route.fulfill({json:data});
});
const summary = page.locator(".pos-summary");
async function add(i) {
  await page.locator(".pos-search").fill(`QA${i}`);
  await page.locator(".suggestions button").waitFor();
  await page.locator(".pos-search").press("Enter");
}
async function layout(width, height, generated=false) {
  await page.setViewportSize({width,height});
  const metrics = await page.evaluate(() => {
    const panel = document.querySelector(".pos-billing-panel"), summary = document.querySelector(".pos-summary");
    return {overflow:document.documentElement.scrollWidth > innerWidth, position:getComputedStyle(summary).position,
      fields:[...document.querySelectorAll(".pos-adjustments label")].map(e=>({y:e.getBoundingClientRect().y,w:e.getBoundingClientRect().width})),
      scrolls:[panel,summary,document.querySelector(".bill-preview")].filter(Boolean).map(e=>getComputedStyle(e).overflowY),
      side:panel.getBoundingClientRect().x > document.querySelector(".pos-main").getBoundingClientRect().x};
  });
  assert.equal(metrics.overflow,false, `No page horizontal overflow at ${width}`);
  assert.equal(metrics.position,"static");
  assert.ok(metrics.scrolls.every(v=>v === "visible"));
  assert.equal(metrics.side,width>1100);
  if(width>380) {
    assert.ok(metrics.fields.every(f=>Math.abs(f.y-metrics.fields[0].y)<1));
    assert.ok(metrics.fields.every(f=>Math.abs(f.w-metrics.fields[0].w)<1));
  }
  for(const selector of generated ? [".grand", ".bill-preview .print-total", ".bill-preview .pos-secondary-actions"] : [".grand", ".complete"]) {
    const locator = page.locator(selector); await locator.scrollIntoViewIfNeeded();
    const bounds = await locator.boundingBox(); assert.ok(bounds.y>=0 && bounds.y+bounds.height<=height+1,`${selector} reachable at ${width}x${height}`);
  }
}
try {
  await page.setViewportSize({width:1366,height:768});
  await page.goto(process.env.QA_SITE_URL || "http://localhost:5173/admin/billing");
  await summary.waitFor();
  await page.evaluate(()=>{window.print=()=>{window.qaPrintCalls=(window.qaPrintCalls||0)+1;};});
  await layout(1366,768);
  assert.equal(await page.locator(".complete").isDisabled(),true);
  await add(1);
  await page.locator(".qty button").last().click();
  assert.match(await page.locator(".grand").innerText(),/200.00/);
  await page.locator(".qty button").first().click();
  await summary.getByRole("button",{name:"HOLD BILL",exact:true}).click();
  await page.getByRole("button",{name:"Hold Bills",exact:true}).click();
  await page.locator(".held-row").click();
  assert.equal(await page.locator(".bill-table tbody tr").count(),1);
  for(let i=2;i<=12;i++) await add(i);
  await summary.locator(".pos-adjustments select").selectOption("FIXED");
  await page.locator("#bill-discount").fill("50");
  assert.match(await page.locator(".grand").innerText(),/1,150.00/);
  await summary.locator(".pos-adjustments select").selectOption("PERCENTAGE");
  await page.locator("#bill-discount").fill("10");
  await summary.getByLabel("GST",{exact:true}).fill("18");
  assert.match(await page.locator(".grand").innerText(),/1,098.00/);
  await layout(1366,768);
  await page.locator(".complete").click();
  await page.locator(".bill-preview").waitFor();
  assert.equal(posted.items.length,12);
  assert.equal(posted.discountType,"PERCENTAGE");
  assert.equal(posted.gst,18);
  assert.match(await page.locator(".bill-preview .print-total").innerText(),/1,098.00/);
  assert.equal(await page.locator(".pos-billing-panel .bill-preview").count(),1);
  for(const [w,h] of [[1366,768],[1440,900],[1536,864],[1920,1080],[1024,768],[390,844],[320,740]]) {
    await layout(w,h,true);
    await page.screenshot({path:join(output,`billing-${w}.png`),fullPage:true});
  }
  await page.getByRole("button",{name:"Print / Save PDF",exact:true}).click();
  assert.equal(await page.evaluate(()=>window.qaPrintCalls),1);
  await page.emulateMedia({media:"print"});
  assert.equal(await page.locator("#root").isVisible(),false);
  assert.equal(await page.locator(".receipt-print .print-total").isVisible(),true);
  await page.pdf({path:join(output,"receipt.pdf"),width:"80mm",printBackground:true});
  await page.emulateMedia({media:"screen"});
  await page.goto("http://localhost:5173/admin/sales");
  await page.getByPlaceholder("Invoice number, customer or mobile").fill("QA-001");
  await page.getByRole("button",{name:"Search",exact:true}).click();
  await page.getByRole("button",{name:"View",exact:true}).click();
  assert.match(await page.locator(".visible-preview .print-total").innerText(),/1,098.00/);
  assert.deepEqual(errors,[]);
  console.log(`PASS: empty/one/12 products, quantity, fixed/percentage discount, GST, hold/resume, generate, invoice totals, seven viewports at 100% zoom, print portal/PDF, existing invoice search. Artifacts: ${output}`);
} finally { await browser.close(); }
