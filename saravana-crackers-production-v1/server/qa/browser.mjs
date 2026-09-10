import {config} from "dotenv";
config({path:new URL("../.env",import.meta.url),quiet:true});
import {pathToFileURL} from "node:url";
import {join} from "node:path";
import {readFile,mkdir,stat} from "node:fs/promises";
import assert from "node:assert/strict";
const {chromium}=await import(pathToFileURL(join(process.env.TEMP,"saravana-admin-qa/node_modules/playwright/index.mjs")));
const {prisma}=await import("../src/lib/prisma.js");
const {default:jwt}=await import("jsonwebtoken");
const user=await prisma.user.findFirst({where:{active:true,role:{in:["SUPER_ADMIN","ADMIN"]}},select:{id:true,name:true,email:true,role:true}});
await prisma.$disconnect();
const token=jwt.sign(user,process.env.JWT_SECRET,{expiresIn:"15m"});
const sale=JSON.parse(await readFile(new URL("./receipt-fixture.json",import.meta.url)));
const output=new URL("../../artifacts/admin-qa/",import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addCookies([{name:"sc_admin_token",value:token,url:"http://localhost:5173",httpOnly:true,sameSite:"Lax"}]);
await context.addInitScript(()=>{window.__prints=0;window.print=()=>{window.__prints++}});
const page=await context.newPage();
const errors=[];
page.on("pageerror",error=>errors.push(error.message));
let saleRequests=[];
let failSale=true;
const product={id:sale.items[0].productId,name:"QA Sparkler",sku:"QA-SPARKLER",category:"QA",stock:20,minimumStock:0,sellingPrice:10,retailPrice:10};
await page.route("**/api/**",async route=>{
 const request=route.request(),url=new URL(request.url()),path=url.pathname;
 if(path==="/api/admin/products/search")return route.fulfill({json:[product]});
 if(path===`/api/admin/sales/${sale.id}`)return route.fulfill({json:sale});
 if(request.method()==="GET")return route.continue();
 if(path==="/api/admin/sales"&&request.method()==="POST"){
  saleRequests.push(request.postDataJSON());
  await new Promise(resolve=>setTimeout(resolve,500));
  if(failSale){failSale=false;return route.fulfill({status:503,json:{error:"Database transaction timed out. Please retry."}})}
  return route.fulfill({status:201,json:sale});
 }
 // Browser form checks never mutate the live database.
 return route.fulfill({status:201,json:{id:999999,ok:true,...request.postDataJSON()}});
});
async function check(name,fn){await fn();console.log(`PASS ${name}`)}
try{
 await check("billing failure keeps the bill; retry enables printing and uses the same request key",async()=>{
  await page.goto("http://localhost:5173/admin/billing");
  await page.getByRole("heading",{name:"Billing / POS"}).waitFor();
  assert.equal(await page.getByRole("button",{name:"PRINT BILL",exact:true}).isDisabled(),true);
  await page.getByPlaceholder("Search crackers by name, code or category...").fill("QA");
  await page.locator(".suggestions button").first().click();
  await page.getByRole("button",{name:"COMPLETE SALE",exact:true}).click();
  assert.equal(await page.getByRole("button",{name:"COMPLETE SALE",exact:true}).isDisabled(),true);
  await page.getByText("Database transaction timed out. Please retry.",{exact:true}).waitFor();
  assert.equal(await page.locator(".bill-table tbody tr").count(),1);
  assert.equal(await page.getByRole("button",{name:"PRINT BILL",exact:true}).isDisabled(),true);
  await page.getByRole("button",{name:"COMPLETE SALE",exact:true}).click();
  await page.getByText("Sale completed successfully.",{exact:false}).waitFor();
  assert.equal(await page.getByRole("button",{name:"PRINT BILL",exact:true}).isEnabled(),true);
  assert.equal(saleRequests.length,2);assert.equal(saleRequests[0].requestKey,saleRequests[1].requestKey);
 });
 await check("Print Bill invokes printing and generates a readable PDF receipt",async()=>{
  await page.getByRole("button",{name:"PRINT BILL",exact:true}).click();
  assert.equal(await page.evaluate(()=>window.__prints),1);
  await page.emulateMedia({media:"print"});
  assert.equal(await page.locator("#root").isVisible(),false);
  assert.equal(await page.locator(".receipt-print").isVisible(),true);
  assert.ok((await page.locator(".receipt-print").innerText()).includes(sale.invoiceNumber));
  const pdf=new URL("receipt.pdf",output);
  await page.pdf({path:pdf.pathname.replace(/^\/([A-Z]:)/,"$1"),format:"A4",printBackground:true});
  assert.ok((await stat(pdf)).size>1000);
  await page.emulateMedia({media:"screen"});
  await page.screenshot({path:new URL("billing.png",output).pathname.replace(/^\/([A-Z]:)/,"$1"),fullPage:true});
 });
 await check("last saved bill remains printable after refreshing billing",async()=>{
  await page.reload();await page.getByText("Sale completed successfully.",{exact:false}).waitFor();
  assert.equal(await page.getByRole("button",{name:"PRINT BILL",exact:true}).isEnabled(),true);
 });
 for(const [route,title] of [["dashboard","Dashboard"],["sales","Sales History"],["returns","Sales Return"],["reports","Reports"],["products","Products"],["categories","Categories"],["orders","Orders"],["offers","Offers"],["customers","Customers"],["suppliers","Suppliers"],["purchases","Purchases"],["stock","Stock Management"],["settings","Settings"],["audit","Audit Logs"]]){
  await check(`${title} page loads without a runtime error`,async()=>{
   await page.goto(`http://localhost:5173/admin/${route}`);
   await page.getByRole("heading",{name:title,exact:true}).first().waitFor({timeout:30000});
   await page.waitForTimeout(250);
   assert.equal(await page.getByText("Unable to load data:",{exact:false}).count(),0);
  });
 }
 for(const [route,button] of [["categories","Add"],["suppliers","Add Supplier"],["products","Add Product"],["purchases","Save Purchase"]]){
  await check(`${route} blocks blank required fields`,async()=>{
   await page.goto(`http://localhost:5173/admin/${route}`);
   await page.getByRole("button",{name:button,exact:true}).click();
   await page.getByRole("alert").filter({hasText:"Please complete the required fields"}).waitFor();
  });
 }
 await check("category create shows success feedback",async()=>{
  await page.goto("http://localhost:5173/admin/categories");await page.getByRole("textbox",{name:"Name",exact:true}).fill("QA Category");
  await page.getByRole("button",{name:"Add",exact:true}).click();await page.getByText("Saved successfully.",{exact:true}).waitFor();
 });
 assert.deepEqual(errors,[]);console.log("PASS no uncaught browser errors");
}catch(error){console.log("Browser URL:",page.url());console.log("Browser errors:",errors);console.log((await page.locator("body").innerText()).slice(0,600));throw error}finally{await browser.close()}