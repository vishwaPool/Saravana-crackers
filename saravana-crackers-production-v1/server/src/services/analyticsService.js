import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export const MOVEMENT = [
  {name:'Fast Moving', min:80, color:'#218467'},
  {name:'Good Moving', min:50, color:'#77a58a'},
  {name:'Slow Moving', min:20, color:'#c99535'},
  {name:'Very Slow', min:0.000001, color:'#c45e50'},
  {name:'Not Moving', min:0, color:'#88909d'}
];
export function movement(sold, stock) {
  const net = Math.max(0, sold), available = net + Math.max(0, stock);
  const sellThrough = available ? net / available * 100 : 0;
  return {available, sellThrough, status:MOVEMENT.find(x=>sellThrough>=x.min).name};
}
const DAY = 86400000;
export function filters(query = {}) {
  const today = new Date(Date.now()+19800000).toISOString().slice(0,10);
  const from = String(query.from || today), to = String(query.to || today);
  const valid = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s;
  if (!valid(from)||!valid(to)) throw Object.assign(new Error('Use valid YYYY-MM-DD dates.'),{status:400});
  const start = new Date(`${from}T00:00:00+05:30`), end = new Date(new Date(`${to}T00:00:00+05:30`).getTime()+DAY);
  const days = (end-start)/DAY;
  if(days<1 || days>366) throw Object.assign(new Error('Select a date range between 1 and 366 days.'),{status:400});
  const channel=String(query.channel||'All');
  if(!['All','POS','Online'].includes(channel)) throw Object.assign(new Error('Invalid sales channel.'),{status:400});
  for(const key of ['category','supplier']) if(query[key] && !/^[1-9]\d*$/.test(String(query[key]))) throw Object.assign(new Error(`Invalid ${key}.`),{status:400});
  return {from,to,start,end,days,previous:new Date(start.getTime()-days*DAY),channel,category:Number(query.category)||null,supplier:Number(query.supplier)||null,brand:String(query.brand||'').slice(0,100),search:String(query.search||'').slice(0,100)};
}

// One event stream: original completed invoices (including subsequently refunded ones),
// delivered web orders, and refunds dated when processed. Holds/voids never enter it.
function events(f) {
  return Prisma.sql`
    SELECT i.productId, s.createdAt at, 'POS' channel, CONCAT('S',s.id) bill, NULL returnId,
      i.quantity qty, i.quantity grossQty, 0 returned,
      i.total * (1-IFNULL(s.discountAmount/NULLIF(s.subtotal,0),0)) revenue,
      i.quantity*i.purchasePriceSnapshot cost, 0 refund
    FROM SaleItem i JOIN Sale s ON s.id=i.saleId
    WHERE s.status IN ('COMPLETED','REFUNDED') AND s.createdAt>=${f.previous} AND s.createdAt<${f.end}
    UNION ALL
    SELECT i.productId,o.createdAt,'Online',CONCAT('O',o.id),NULL,i.quantity,i.quantity,0,
      i.lineTotal*(1-IFNULL(o.discount/NULLIF(o.subtotal,0),0)),i.quantity*p.purchasePrice,0
    FROM OrderItem i JOIN \`Order\` o ON o.id=i.orderId JOIN Product p ON p.id=i.productId
    WHERE o.status='DELIVERED' AND o.createdAt>=${f.previous} AND o.createdAt<${f.end}
    UNION ALL
    SELECT r.productId,t.createdAt,'POS',NULL,t.id,-r.quantity,0,r.quantity,
      -r.amount * IFNULL((s.subtotal-s.discountAmount)/NULLIF(s.grandTotal,0),0),
      -r.quantity*i.purchasePriceSnapshot,r.amount
    FROM ReturnItem r JOIN SaleReturn t ON t.id=r.returnId JOIN SaleItem i ON i.id=r.saleItemId JOIN Sale s ON s.id=t.saleId
    WHERE s.status IN ('COMPLETED','REFUNDED') AND t.createdAt>=${f.previous} AND t.createdAt<${f.end}`;
}
function products(f) {
  // Products have brands, but no supplier foreign key or stock-lot ownership.
  // Assign each product to its latest purchasing supplier, never multiple suppliers.
  return Prisma.sql`SELECT p.*,c.name category,su.name supplier,su.id supplierId FROM Product p
    JOIN Category c ON c.id=p.categoryId
    LEFT JOIN Supplier su ON su.id=(SELECT pu.supplierId FROM PurchaseItem pi JOIN Purchase pu ON pu.id=pi.purchaseId WHERE pi.productId=p.id ORDER BY pu.createdAt DESC,pu.id DESC,pi.id DESC LIMIT 1)
    WHERE (${f.category} IS NULL OR p.categoryId=${f.category})
    AND (${f.brand}='' OR p.brand=${f.brand})
    AND (${f.supplier} IS NULL OR su.id=${f.supplier})
    AND (${f.search}='' OR LOCATE(${f.search},p.name)>0 OR LOCATE(${f.search},p.sku)>0)`;
}
const normalize = rows => rows.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,typeof v==='bigint'||Prisma.Decimal.isDecimal(v)?Number(v):v])));
const sum = (rows,key)=>rows.reduce((n,r)=>n+Number(r[key]||0),0);
function summary(rows) {
  const revenue=sum(rows,'revenue'), cost=sum(rows,'cost'), bills=sum(rows,'bills');
  return {revenue,profit:revenue-cost,bills,quantity:sum(rows,'quantity'),average:bills?revenue/bills:0,refund:sum(rows,'refund')};
}
export async function analytics(query, db=prisma) {
  filters(query); // Reject invalid requests before opening a database transaction.
  if(db===prisma) return db.$transaction(tx=>analytics(query,tx),{isolationLevel:'RepeatableRead',timeout:30000});
  const f=filters(query), ev=events(f), pr=products(f);
  const channel=Prisma.sql`(${f.channel}='All' OR e.channel=${f.channel})`;
  const [stockRows, dailyRows, hourRows, options] = await Promise.all([
    db.$queryRaw(Prisma.sql`SELECT p.id,p.name,p.sku,p.category,p.brand,p.supplier,p.stock,p.minStock,p.purchasePrice,
      IFNULL(a.quantity,0) quantity,IFNULL(a.grossQty,0) grossQty,IFNULL(a.returned,0) returned,IFNULL(a.revenue,0) revenue,IFNULL(a.cost,0) cost,
      IFNULL(a.refund,0) refund,IFNULL(b.purchased,0) purchased
      FROM (${pr}) p LEFT JOIN (SELECT e.productId,SUM(e.qty) quantity,SUM(e.grossQty) grossQty,SUM(e.returned) returned,SUM(e.revenue) revenue,SUM(e.cost) cost,SUM(e.refund) refund
      FROM (${ev}) e WHERE e.at>=${f.start} AND ${channel} GROUP BY e.productId) a ON a.productId=p.id
      LEFT JOIN (SELECT i.productId,SUM(i.quantity) purchased FROM PurchaseItem i JOIN Purchase pu ON pu.id=i.purchaseId WHERE pu.createdAt>=${f.start} AND pu.createdAt<${f.end} GROUP BY i.productId) b ON b.productId=p.id`),
    db.$queryRaw(Prisma.sql`SELECT DATE_FORMAT(DATE_ADD(e.at,INTERVAL 330 MINUTE),'%Y-%m-%d') date,e.channel,
      SUM(e.revenue) revenue,SUM(e.cost) cost,SUM(e.qty) quantity,SUM(e.grossQty) grossQty,SUM(e.returned) returned,SUM(e.refund) refund,COUNT(DISTINCT e.bill) bills,COUNT(DISTINCT e.returnId) returnsCount
      FROM (${ev}) e JOIN (${pr}) p ON p.id=e.productId WHERE ${channel} GROUP BY date,e.channel ORDER BY date`),
    db.$queryRaw(Prisma.sql`SELECT HOUR(DATE_ADD(e.at,INTERVAL 330 MINUTE)) hour,SUM(e.revenue) revenue,COUNT(DISTINCT e.bill) bills
      FROM (${ev}) e JOIN (${pr}) p ON p.id=e.productId WHERE e.at>=${f.start} AND ${channel} GROUP BY hour ORDER BY hour`),
    Promise.all([db.category.findMany({select:{id:true,name:true},orderBy:{name:'asc'}}),db.product.findMany({distinct:['brand'],where:{brand:{not:null}},select:{brand:true}}),db.supplier.findMany({select:{id:true,name:true},orderBy:{name:'asc'}})])
  ]);
  const rows=normalize(stockRows).map(p=>{
    const m=movement(p.quantity,p.stock), high=p.quantity>0&&m.sellThrough>=50, low=p.stock<=p.minStock;
    return {...p,...m,profit:p.revenue-p.cost,stockValue:p.stock*p.purchasePrice,average:p.quantity/f.days,
      demand:m.sellThrough>=80?'Very High':m.sellThrough>=50?'High':m.sellThrough>=20?'Medium':m.sellThrough>0?'Low':'Very Low',
      health:high?(low?'reorder':'healthy'):(low?'avoid':'offer'),reorder:high&&low};
  });
  const days=normalize(dailyRows), current=days.filter(d=>d.date>=f.from), previous=days.filter(d=>d.date<f.from);
  const overview=summary(current), prev=summary(previous);
  const slow=rows.filter(p=>p.sellThrough<50&&p.stock>0);
  Object.assign(overview,{inventory:sum(rows,'stockValue'),slowValue:sum(slow,'stockValue'),lowStock:rows.filter(p=>p.stock>0&&p.stock<=p.minStock).length,outStock:rows.filter(p=>p.stock<=0).length});
  function groups(key) {
    const map=new Map();
    for(const p of rows){const name=p[key]||'Unassigned';const r=map.get(name)||{name,quantity:0,revenue:0,profit:0,stockValue:0,purchased:0,stock:0};for(const k of ['quantity','revenue','profit','stockValue','purchased','stock'])r[k]+=p[k];map.set(name,r)}
    return [...map.values()].map(r=>({...r,...movement(r.quantity,r.stock)})).sort((a,b)=>b.revenue-a.revenue);
  }
  const trend=Array.from({length:f.days},(_,i)=>{
    const date=new Date(Date.parse(f.from)+i*DAY).toISOString().slice(0,10);
    return {date,...summary(current.filter(d=>d.date===date))};
  });
  const stockMovement=MOVEMENT.map(m=>({...m,count:rows.filter(r=>r.status===m.name).length,value:sum(rows.filter(r=>r.status===m.name),'stockValue')}));
  const health=['reorder','healthy','offer','avoid'].map(name=>({name,count:rows.filter(r=>r.health===name).length}));
  const rank=['quantity','revenue','profit'].includes(query.rank)?query.rank:'quantity';
  const top=[...rows].filter(p=>p.grossQty>0).sort((a,b)=>b[rank]-a[rank]).slice(0,10);
  let filtered=rows;
  if(query.movement) filtered=filtered.filter(p=>p.status===query.movement);
  if(query.health) filtered=filtered.filter(p=>p.health===query.health);
  if(query.view==='slow') filtered=filtered.filter(p=>p.sellThrough<50&&p.stock>0);
  if(query.view==='fast') filtered=filtered.filter(p=>p.sellThrough>=50&&p.quantity>0);
  if(query.view==='low') filtered=filtered.filter(p=>p.stock<=p.minStock);
  if(query.view==='top') filtered=filtered.filter(p=>p.id===top[0]?.id);
  filtered.sort(query.view==='fast'?(a,b)=>b.quantity-a.quantity||b.sellThrough-a.sellThrough:(a,b)=>a.sellThrough-b.sellThrough||b.stockValue-a.stockValue);
  const page=Math.max(1,Math.min(Math.max(1,Math.ceil(filtered.length/25)),Math.floor(Number(query.page)||1)));
  const returnQty=sum(current,'returned'), grossQty=sum(current,'grossQty');
  return {overview,previous:prev,trend,top,stockMovement,health,categories:groups('category'),suppliers:groups('supplier'),
    channels:['POS','Online'].map(name=>({name,...summary(current.filter(d=>d.channel===name))})),
    hourly:Array.from({length:24},(_,hour)=>({hour,revenue:0,bills:0,...normalize(hourRows).find(r=>r.hour===hour)})),
    returns:{count:sum(current,'returnsCount'),amount:overview.refund,quantity:returnQty,percentage:grossQty?returnQty/grossQty*100:null,top:[...rows].filter(p=>p.returned>0).sort((a,b)=>b.returned-a.returned).slice(0,10)},
    fast:[...rows].filter(p=>p.sellThrough>=50&&p.quantity>0).sort((a,b)=>b.quantity-a.quantity||b.sellThrough-a.sellThrough).slice(0,5),
    slow:[...slow].sort((a,b)=>a.sellThrough-b.sellThrough||b.stockValue-a.stockValue).slice(0,5),
    products:{rows:filtered.slice((page-1)*25,page*25),total:filtered.length,page,pageSize:25},
    insights:[{title:'Reorder required',value:rows.filter(p=>p.reorder).length,view:'fast',health:'reorder'}, {title:'Low / out of stock',value:rows.filter(p=>p.stock<=p.minStock).length,view:'low'}, {title:'Slow moving products',value:slow.length,view:'slow'}, {title:'Stock value locked',value:overview.slowValue,money:true,view:'slow'}, {title:'Not moving',value:rows.filter(p=>p.sellThrough===0).length,movement:'Not Moving'}, {title:'Top performer',value:top[0]?.name||'No sales',view:'top'}],
    options:{categories:options[0],brands:options[1].map(b=>b.brand).filter(Boolean).sort(),suppliers:options[2]},
    meta:{from:f.from,to:f.to,days:f.days,timeZone:'Asia/Kolkata',generatedAt:new Date().toISOString()}};
}
