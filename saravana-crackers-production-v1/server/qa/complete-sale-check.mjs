import {config} from "dotenv";
config({path:new URL("../.env",import.meta.url),quiet:true});

const assert=(await import("node:assert/strict")).default;
const {prisma}=await import("../src/lib/prisma.js");
const {completeSale}=await import("../src/services/posService.js");

const marker=`QA-CS-${Date.now()}`;
const rollback=new Error("QA_ROLLBACK");

try {
  const columns=await prisma.$queryRawUnsafe("SHOW COLUMNS FROM Sale LIKE 'customerName'");
  assert.equal(columns.length,1);
  console.log("PASS Sale.customerName column exists");

  try {
    await prisma.$transaction(async tx=>{
      const category=await tx.category.create({data:{name:marker,slug:marker.toLowerCase()}});
      const productA=await tx.product.create({data:{sku:`${marker}-A`,name:`${marker} A`,slug:`${marker}-a`,categoryId:category.id,purchasePrice:25,mrp:100,retailPrice:75,stock:12}});
      const productB=await tx.product.create({data:{sku:`${marker}-B`,name:`${marker} B`,slug:`${marker}-b`,categoryId:category.id,purchasePrice:30,mrp:120,retailPrice:80,stock:7}});
      const db={sale:tx.sale,saleItem:tx.saleItem,product:tx.product,payment:tx.payment,customer:tx.customer,order:tx.order,$transaction:callback=>callback(tx)};

      const noName=await completeSale({requestKey:`${marker}-no-name`,customer:{name:""},items:[{productId:productA.id,quantity:1,sellingPrice:75,discount:0}],discountType:"FIXED",discountValue:0,gst:0,paymentMethod:"CASH"},null,db);
      assert.equal(noName.customerName,null);
      assert.equal(noName.grandTotal,75);
      console.log("PASS complete sale without customer name");

      const withName=await completeSale({requestKey:`${marker}-with-name`,customer:{name:"Ravi Kumar"},items:[{productId:productA.id,quantity:2,sellingPrice:75,discount:5},{productId:productB.id,quantity:1,sellingPrice:80,discount:0}],discountType:"FIXED",discountValue:10,gst:0,paymentMethod:"CASH"},null,db);
      assert.equal(withName.customerName,"Ravi Kumar");
      assert.equal(withName.customerId,null);
      assert.equal(withName.items.length,2);
      assert.equal(withName.grandTotal,215);
      assert.equal((await tx.product.findUnique({where:{id:productA.id}})).stock,9);
      assert.equal((await tx.payment.count({where:{saleId:withName.id}})),1);
      assert.equal((await tx.stockMovement.count({where:{referenceId:withName.invoiceNumber}})),2);
      console.log("PASS complete sale with customer name stores sale.customerName only");

      const retry=await completeSale({requestKey:`${marker}-with-name`,customer:{name:"Ravi Kumar"},items:[{productId:productA.id,quantity:2,sellingPrice:75,discount:5},{productId:productB.id,quantity:1,sellingPrice:80,discount:0}],discountType:"FIXED",discountValue:10,gst:0,paymentMethod:"CASH"},null,db);
      assert.equal(retry.id,withName.id);
      assert.equal((await tx.product.findUnique({where:{id:productA.id}})).stock,9);
      console.log("PASS same idempotency key returns existing sale without duplicate stock deduction");

      await assert.rejects(()=>completeSale({requestKey:`${marker}-overstock`,items:[{productId:productB.id,quantity:100,sellingPrice:80,discount:0}],discountType:"FIXED",discountValue:0,gst:0,paymentMethod:"CASH"},null,db),/stock/);
      assert.equal((await tx.product.findUnique({where:{id:productB.id}})).stock,6);
      console.log("PASS insufficient stock rejects and rolls back");

      throw rollback;
    },{timeout:120000,maxWait:10000});
  } catch (error) {
    if (error!==rollback) throw error;
  }

  assert.equal(await prisma.sale.count({where:{requestKey:{startsWith:marker}}}),0);
  assert.equal(await prisma.product.count({where:{sku:{startsWith:marker}}}),0);
  console.log("PASS QA sale data rolled back");
} finally {
  await prisma.$disconnect();
}
