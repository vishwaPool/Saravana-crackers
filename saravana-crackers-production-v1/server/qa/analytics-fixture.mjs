import {analytics} from '../src/services/analyticsService.js';
export async function fixture(query={}) {
  let call=0;
  const stock=Array.from({length:32},(_,i)=>({id:i+1,name:['Flower Pot Deluxe','Ground Chakkar','Colour Sparklers','Rocket Deluxe'][i%4]+' '+(i+1),sku:'TEST-'+i,category:i%2?'Sparklers':'Flower Pots',brand:'Test Brand',supplier:'Test Supplier',stock:100-i*3,minStock:20,purchasePrice:40,quantity:i*3,grossQty:i*3+2,returned:2,revenue:i*300,cost:i*120,refund:200,purchased:100}));
  const daily=[{date:'2026-09-09',channel:'POS',revenue:1000,cost:400,quantity:10,grossQty:10,returned:0,refund:0,bills:2,returnsCount:0},{date:'2026-09-10',channel:'POS',revenue:900,cost:360,quantity:9,grossQty:11,returned:2,refund:200,bills:3,returnsCount:1},{date:'2026-09-10',channel:'Online',revenue:500,cost:200,quantity:5,grossQty:5,returned:0,refund:0,bills:1,returnsCount:0}];
  const db={
    $queryRaw:async()=>[stock,daily,[{hour:11,revenue:1400,bills:4}]][call++],
    category:{findMany:async()=>[{id:1,name:'Flower Pots'},{id:2,name:'Sparklers'}]},
    product:{findMany:async()=>[{brand:'Test Brand'}]},supplier:{findMany:async()=>[{id:1,name:'Test Supplier'}]}
  };
  return analytics({from:'2026-09-10',to:'2026-09-10',...query},db);
}
