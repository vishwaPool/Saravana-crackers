import test from 'node:test';
import assert from 'node:assert/strict';
import {filters,movement} from './analyticsService.js';
import {fixture} from '../../qa/analytics-fixture.mjs';
test('quantity movement boundaries, zero stock, negative net returns',()=>{
  for(const [sold,stock,status] of [[80,20,'Fast Moving'],[79,21,'Good Moving'],[50,50,'Good Moving'],[49,51,'Slow Moving'],[20,80,'Slow Moving'],[19,81,'Very Slow'],[5,95,'Very Slow'],[0,100,'Not Moving'],[-2,10,'Not Moving'],[0,0,'Not Moving'],[2,0,'Fast Moving']])assert.equal(movement(sold,stock).status,status);
  assert.equal(movement(5,95).sellThrough,5);
  assert.equal(movement(0.5,99.5).status,'Very Slow');
});
test('strict date validation, IST boundaries and previous equivalent period',()=>{
  const f=filters({from:'2026-09-01',to:'2026-09-10'});
  assert.equal(f.days,10);assert.equal(f.start.toISOString(),'2026-08-31T18:30:00.000Z');assert.equal(f.end.toISOString(),'2026-09-10T18:30:00.000Z');assert.equal(f.previous.toISOString(),'2026-08-21T18:30:00.000Z');
  for(const q of [{from:'2026-02-30'},{from:'2026-09-10',to:'2026-09-01'},{from:'2020-01-01',to:'2026-01-01'},{channel:'Other'},{category:'x'},{supplier:'1 OR 1=1'}])assert.throws(()=>filters(q));
});
test('aggregate response totals, comparisons, classification, bounded pagination and drill-down',async()=>{
  const d=await fixture();
  assert.equal(d.overview.revenue,1400);assert.equal(d.overview.profit,840);assert.equal(d.overview.bills,4);assert.equal(d.overview.quantity,14);assert.equal(d.overview.average,350);assert.equal(d.previous.revenue,1000);
  assert.equal(d.products.rows.length,25);assert.equal(d.products.total,32);assert.equal(d.top.length,10);
  assert.equal(d.stockMovement.reduce((s,r)=>s+r.count,0),32);
  assert.equal(d.health.reduce((s,r)=>s+r.count,0),32);
  assert.equal(d.hourly.length,24);assert.equal(d.returns.count,1);assert.equal(d.returns.percentage,12.5);
  const next=await fixture({page:2});assert.equal(next.products.rows.length,7);
  const high=await fixture({health:'reorder'});assert.ok(high.products.rows.every(p=>p.reorder));
  const slow=await fixture({view:'slow'});assert.ok(slow.products.rows.every(p=>p.sellThrough<50&&p.stock>0));
  const none=await fixture({movement:'Not Moving'});assert.equal(none.products.total,1);
});
