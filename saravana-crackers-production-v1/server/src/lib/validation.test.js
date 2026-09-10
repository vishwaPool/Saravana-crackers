import test from "node:test";
import assert from "node:assert/strict";
import {validateInput, validateRequest} from "./validation.js";

const order = {customer:{name:"Customer",phone:"9876543210",address:"Main Road",city:"Chennai"},items:[{productId:1,quantity:2}],deliveryMethod:"PICKUP"};
test("valid checkout and purchase requests are accepted",()=>{
  assert.deepEqual(validateInput("/orders","POST",order),[]);
  assert.deepEqual(validateInput("/purchases","POST",{supplierId:"1",items:[{productId:"2",quantity:"1",unitCost:"0"}]}),[]);
});
test("checkout rejects whitespace-only required customer details",()=>{
  for(const key of ["name","phone","address","city"]){
    assert.ok(validateInput("/orders","POST",{...order,customer:{...order.customer,[key]:"   "}}).some(error=>error.includes(key)));
  }
});
test("checkout rejects empty carts, invalid quantities and invalid delivery",()=>{
  for(const quantity of [0,-1,1.5,"",null,"abc",Infinity]) assert.ok(validateInput("/orders","POST",{...order,items:[{productId:1,quantity}]}).length);
  assert.ok(validateInput("/orders","POST",{...order,items:[]}).length);
  assert.ok(validateInput("/orders","POST",{...order,deliveryMethod:"UNKNOWN"}).length);
});
test("purchase placeholder values cannot silently become zero IDs",()=>{
  assert.ok(validateInput("/purchases","POST",{supplierId:"",items:[{productId:"",quantity:1,unitCost:0}]}).length);
});
test("blank physical stock is rejected while explicit zero is accepted",()=>{
  const adjustment={productId:1,physicalStock:0,reason:"Stock count"};
  assert.deepEqual(validateInput("/stock/adjust","POST",adjustment),[]);
  assert.ok(validateInput("/stock/adjust","POST",{...adjustment,physicalStock:""}).length);
  assert.ok(validateInput("/stock/adjust","POST",{...adjustment,reason:" "}).length);
});
test("products require identity, category and valid prices",()=>{
  const product={sku:"A",name:"Sparkler",categoryId:1,purchasePrice:0,mrp:10,retailPrice:8};
  assert.deepEqual(validateInput("/products","POST",product),[]);
  for(const patch of [{sku:" "},{categoryId:""},{retailPrice:-1},{purchasePrice:""},{stock:1.5}]) assert.ok(validateInput("/products/1","PUT",{...product,...patch}).length);
});
test("offers reject reversed dates and percentages above 100",()=>{
  const offer={title:"Festival",type:"PERCENTAGE",value:10,startAt:"2026-09-01",endAt:"2026-09-30"};
  assert.deepEqual(validateInput("/offers","POST",offer),[]);
  assert.ok(validateInput("/offers","POST",{...offer,endAt:"2026-08-01"}).length);
  assert.ok(validateInput("/offers","POST",{...offer,value:101}).length);
});
test("fractional POS and return quantities are rejected before truncation",()=>{
  assert.ok(validateInput("/sales","POST",{items:[{productId:1,quantity:1.5,sellingPrice:10}]}).length);
  assert.ok(validateInput("/returns","POST",{saleId:1,items:[{saleItemId:1,quantity:1.5}]}).length);
});
test("middleware returns helpful 400 errors and does not invoke writes",()=>{
  let status, response, nextCalled=false;
  const res={status(value){status=value;return this},json(value){response=value;return this}};
  validateRequest({path:"/categories",method:"POST",body:{name:" "}},res,()=>{nextCalled=true});
  assert.equal(status,400); assert.equal(nextCalled,false); assert.match(response.error,/Name is required/);
  validateRequest({path:"/categories",method:"POST",body:{name:"Sparklers"}},res,()=>{nextCalled=true});
  assert.equal(nextCalled,true);
});