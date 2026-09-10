import 'dotenv/config';
import assert from 'node:assert/strict';
import {analytics,filters,movement} from '../src/services/analyticsService.js';
import {prisma} from '../src/lib/prisma.js';

for(const [sold,stock,status] of [[80,20,'Fast Moving'],[50,50,'Good Moving'],[20,80,'Slow Moving'],[5,95,'Very Slow'],[0,100,'Not Moving'],[-2,10,'Not Moving'],[0,0,'Not Moving']]) assert.equal(movement(sold,stock).status,status);
assert.equal(movement(5,95).sellThrough,5);
assert.throws(()=>filters({from:'2026-02-30'}));
assert.throws(()=>filters({from:'2026-09-10',to:'2026-09-01'}));
assert.equal(filters({from:'2026-09-10',to:'2026-09-10'}).start.toISOString(),'2026-09-09T18:30:00.000Z');
const marker='analytics-qa-'+Date.now();
try {
  try {await prisma.$transaction(async tx=>{
    const c=await tx.category.create({data:{name:marker,slug:marker}});
    const p=await tx.product.create({data:{name:marker,sku:marker,slug:marker,categoryId:c.id,brand:marker,purchasePrice:40,mrp:100,retailPrice:100,stock:87,minStock:90}});
    const customer=await tx.customer.create({data:{name:marker,phone:marker}});
    const supplier=await tx.supplier.create({data:{name:marker}});
    await tx.purchase.create({data:{number:marker,supplierId:supplier.id,subtotal:4000,total:4000,createdAt:new Date('2035-09-10T05:00:00Z'),items:{create:{productId:p.id,quantity:100,unitCost:40,lineTotal:4000}}}});
    const sale=await tx.sale.create({data:{invoiceNumber:marker,subtotal:1000,discountAmount:100,gst:90,grandTotal:990,createdAt:new Date('2035-09-10T06:00:00Z'),items:{create:{productId:p.id,productNameSnapshot:marker,skuSnapshot:marker,purchasePriceSnapshot:40,sellingPrice:100,quantity:10,total:1000,returnedQuantity:2}}},include:{items:true}});
    await tx.saleReturn.create({data:{saleId:sale.id,returnNumber:marker,refundAmount:198,createdAt:new Date('2035-09-10T07:00:00Z'),items:{create:{productId:p.id,saleItemId:sale.items[0].id,quantity:2,amount:198}}}});
    for(const [suffix,status,createdAt] of [['previous','COMPLETED','2035-09-09T06:00:00Z'],['void','VOIDED','2035-09-10T06:00:00Z']]) await tx.sale.create({data:{invoiceNumber:marker+suffix,status,subtotal:200,grandTotal:200,createdAt:new Date(createdAt),items:{create:{productId:p.id,productNameSnapshot:marker,skuSnapshot:marker,purchasePriceSnapshot:40,sellingPrice:100,quantity:2,total:200}}}});
    await tx.heldSale.create({data:{referenceNumber:marker,items:[{productId:p.id,quantity:50}]}});
    for(const status of ['DELIVERED','NEW','CANCELLED']) await tx.order.create({data:{orderNumber:marker+status,customerId:customer.id,status,subtotal:500,discount:50,deliveryCharge:25,total:475,createdAt:new Date('2035-09-10T08:00:00Z'),items:{create:{productId:p.id,productName:marker,sku:marker,quantity:5,unitPrice:100,lineTotal:500}}}});
    const base={from:'2035-09-10',to:'2035-09-10',search:marker};
    const d=await analytics(base,tx);
    assert.equal(d.overview.revenue,1170);assert.equal(d.overview.profit,650);assert.equal(d.overview.quantity,13);assert.equal(d.overview.bills,2);
    assert.equal(d.overview.refund,198);assert.equal(d.previous.revenue,200);assert.equal(d.products.total,1);
    assert.equal(d.products.rows[0].sellThrough,13);assert.equal(d.products.rows[0].status,'Very Slow');assert.equal(d.overview.slowValue,3480);
    assert.equal(d.returns.quantity,2);assert.equal(d.returns.count,1);assert.equal(d.products.rows[0].purchased,100);
    assert.equal(d.channels.find(r=>r.name==='Online').revenue,450);assert.equal(d.suppliers[0].name,marker);
    const pos=await analytics({...base,channel:'POS',category:String(c.id),brand:marker,supplier:String(supplier.id)},tx);
    assert.equal(pos.overview.revenue,720);assert.equal(pos.overview.profit,400);assert.equal(pos.overview.bills,1);
    const online=await analytics({...base,channel:'Online'},tx);assert.equal(online.overview.revenue,450);assert.equal(online.returns.amount,0);
    const empty=await analytics({...base,search:marker+'-missing'},tx);assert.equal(empty.products.total,0);assert.equal(empty.overview.revenue,0);
    console.log('PASS real MySQL aggregation: discounts, tax exclusion, cost snapshots, returns, channels, previous period, filters, held/void/cancelled exclusion, quantity movement, supplier attribution');
    throw new Error('ROLLBACK_ANALYTICS_QA');
  },{timeout:120000,maxWait:10000})} catch(e){if(e.message!=='ROLLBACK_ANALYTICS_QA')throw e}
  assert.equal(await prisma.product.count({where:{sku:marker}}),0);
  console.log('PASS fixtures rolled back; no persistent test data');
} finally {await prisma.$disconnect()}
