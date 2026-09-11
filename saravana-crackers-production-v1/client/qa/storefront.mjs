import assert from "node:assert/strict";
import {pathToFileURL} from "node:url";
import {join} from "node:path";
import {mkdir} from "node:fs/promises";
const playwrightPath = process.env.PLAYWRIGHT_PATH || join(process.env.TEMP, "saravana-storefront-qa/node_modules/playwright/index.mjs");
const {chromium} = await import(pathToFileURL(playwrightPath));
const apiOrigin = process.env.QA_API_URL || "http://localhost:4000";
const site = process.env.QA_SITE_URL || "http://localhost:5173";
const data = Object.fromEntries(await Promise.all(["products", "categories", "offers", "settings"].map(async key => {
  const response = await fetch(`${apiOrigin}/api/${key}`);
  assert.ok(response.ok, `Read ${key}: ${response.status}`);
  return [key, await response.json()];
})));
const output = join(process.env.TEMP, "saravana-storefront-qa/screenshots");
await mkdir(output, {recursive:true});
const browser = await chromium.launch({channel: "chrome", headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors = [], consoleErrors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => {if(message.type() === "error") consoleErrors.push(message.text());});
let failOffers = false, empty = false;
await page.route("**/api/**", async route => {
  const request = route.request(), url = new URL(request.url()), key = url.pathname.split("/")[2];
  // All browser traffic is served from a read-only snapshot; mutations never reach a database.
  if (request.method() === "OPTIONS") return route.fulfill({status:204});
  if (request.method() !== "GET") return route.fulfill({status:400,json:{error:"QA blocks mutations"}});
  if (key === "offers" && failOffers) return route.fulfill({status:503,json:{error:"QA simulated outage"}});
  if (!(key in data)) return route.fulfill({status:401,json:{error:"Unauthorized"}});
  let result = data[key];
  if (empty && Array.isArray(result)) result = [];
  if (key === "products" && url.searchParams.get("category")) result = result.filter(p => p.category?.slug === url.searchParams.get("category"));
  return route.fulfill({json:result});
});
async function check(name, run) {await run(); console.log(`PASS ${name}`);}
async function waitProducts(count) {await page.waitForFunction(expected => document.querySelectorAll(".product").length === expected, count);}
async function home() {await page.goto(site); await page.getByRole("heading", {name:"Popular Products"}).waitFor(); await page.getByText("Loading products…", {exact:true}).waitFor({state:"hidden"});}
try {
  await home();
  await check("six-product homepage and actual category mapping", async () => {
    assert.equal(await page.locator(".product").count(), Math.min(6,data.products.length));
    assert.equal(await page.locator(".category-card").count(),data.categories.length);
    assert.equal(await page.locator(".offer-card").count(),Math.min(3,data.offers.length));
    for (const width of [1440,1024,768,390,320]) {
      await page.setViewportSize({width,height:1000});
      await page.locator(".store-footer").scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No overflow at ${width}`);
      await page.evaluate(() => scrollTo(0,0));
      await page.screenshot({path:join(output,`home-${width}.png`),fullPage:true});
    }
    const broken = await page.locator("img").evaluateAll(images => images.filter(image => image.complete && !image.naturalWidth).map(image => image.src));
    assert.deepEqual(broken,[]);
  });
  await page.setViewportSize({width:1440,height:1000});
  await check("offer rules, expansion, and settings-driven contact", async () => {
    for (const offer of data.offers.slice(0,3)) {
      const card = page.locator(".offer-card").filter({has:page.getByRole("heading",{name:offer.title,exact:true})});
      const minimum = Number(offer.minOrder);
      await card.getByText(minimum > 0 ? `On orders of ₹${minimum.toLocaleString("en-IN")} or more` : "On all orders",{exact:true}).waitFor();
      if (offer.type === "PERCENTAGE" && minimum > 0) assert.equal(await card.locator('img[src*="offer-festival"]').count(),0);
    }
    await page.getByRole("button",{name:"View All Offers",exact:false}).click();
    assert.equal(await page.locator(".offer-card").count(),data.offers.length);
    for (const field of ["phone","email","address"]) {
      if (data.settings[field]) await page.locator("#contact").getByText(data.settings[field],{exact:true}).waitFor();
    }
  });
  await check("carousel controls and pause", async () => {
    const before = await page.locator(".store-hero img").getAttribute("src");
    await page.getByRole("button",{name:"Next banner",exact:true}).click();
    assert.notEqual(await page.locator(".store-hero img").getAttribute("src"), before);
    await page.getByRole("button",{name:"Play slideshow",exact:true}).waitFor();
  });
  await check("View All Products and category filtering", async () => {
    await page.getByRole("link",{name:"View All Products",exact:false}).first().click();
    await page.getByRole("heading",{name:"All Products",exact:true}).waitFor();
    await page.getByText("Loading products…",{exact:true}).waitFor({state:"hidden"});
    await waitProducts(data.products.length);
    assert.equal(await page.locator(".product").count(),data.products.length);
    const category = data.categories.find(c => data.products.some(p => p.category?.slug === c.slug));
    await home();
    await page.locator(".category-card").filter({hasText:category.name}).click();
    await page.getByRole("heading",{name:category.name,exact:true}).waitFor();
    await page.getByText("Loading products…",{exact:true}).waitFor({state:"hidden"});
    await waitProducts(data.products.filter(p => p.category?.slug === category.slug).length);
    assert.ok(page.url().includes(`/products/${category.slug}`));
    assert.equal(await page.locator(".product").count(),data.products.filter(p => p.category?.slug === category.slug).length);
  });
  await check("header search and cart survive navigation", async () => {
    const product = data.products.find(p => p.stock > 0);
    assert.ok(product,"At least one stocked product is needed for cart QA");
    await page.getByRole("search").getByRole("searchbox").fill(product.name);
    await page.getByRole("button",{name:"Submit search"}).click();
    await page.getByText("Loading products…",{exact:true}).waitFor({state:"hidden"});
    const card = page.locator(".product").filter({has:page.getByRole("heading",{name:product.name,exact:true})}).first();
    await card.getByRole("button",{name:"Add to Cart",exact:true}).click();
    await page.getByRole("link",{name:"Cart, 1 items",exact:true}).click();
    await page.getByText(product.name,{exact:true}).first().waitFor();
    assert.ok(await page.getByRole("link",{name:/checkout/i}).count());
    if (product.stock > 1) {
      await page.getByRole("button",{name:`Increase ${product.name} quantity`,exact:true}).click();
      await page.getByRole("link",{name:"Cart, 2 items",exact:true}).waitFor();
      await page.getByRole("button",{name:`Decrease ${product.name} quantity`,exact:true}).click();
      await page.getByRole("link",{name:"Cart, 1 items",exact:true}).waitFor();
    }
    await page.getByRole("link",{name:"Checkout",exact:true}).click();
    await page.getByRole("button",{name:"Place Order",exact:true}).waitFor();
  });
  await check("mobile navigation, login link, and footer anchors", async () => {
    await page.setViewportSize({width:390,height:844}); await home();
    await page.getByRole("button",{name:/Menu/}).click();
    assert.equal(await page.getByRole("button",{name:/Menu/}).getAttribute("aria-expanded"),"true");
    await page.getByRole("navigation",{name:"Main navigation",exact:true}).getByRole("link",{name:"Contact",exact:true}).click();
    assert.equal(await page.getByRole("button",{name:/Menu/}).getAttribute("aria-expanded"),"false");
    assert.equal(await page.locator(".store-header-actions a").first().getAttribute("href"),"/admin/login");
  });
  await check("partial API failure and recovery", async () => {
    failOffers = true; await home();
    await page.getByRole("alert").filter({hasText:"Unable to load offers"}).waitFor();
    assert.ok(await page.locator(".product").count() > 0);
    failOffers = false; await page.getByRole("button",{name:"Try again"}).click();
    await page.getByRole("alert").waitFor({state:"hidden"});
  });
  await check("empty API responses", async () => {
    empty = true; await home();
    await page.getByText("Categories will be available soon.",{exact:true}).waitFor();
    assert.equal(await page.locator(".product").count(),0);
  });
  assert.deepEqual(errors,[],"No uncaught browser errors");
  const unexpected = consoleErrors.filter(message => !message.includes("503"));
  assert.deepEqual(unexpected,[],"No unexpected console errors");
  console.log(`Screenshots: ${output}`);
  console.log("No uncaught browser errors; simulated 503 is the only expected console error.");
} finally {await browser.close();}
