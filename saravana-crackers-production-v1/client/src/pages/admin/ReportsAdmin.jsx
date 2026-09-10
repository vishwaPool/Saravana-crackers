import {useEffect,useState} from "react";
import {api} from "../../api";

const money=n=>Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});

export default function ReportsAdmin(){
  const [daily,setDaily]=useState(null);
  const [profit,setProfit]=useState(null);
  const [category,setCategory]=useState([]);
  const [error,setError]=useState("");

  useEffect(()=>{
    Promise.all([
      api("/admin/reports/daily"),
      api("/admin/reports/category-sales"),
      api("/admin/reports/profit").catch(e=>({error:e.message}))
    ]).then(([d,c,p])=>{setDaily(d);setCategory(c);p.error?setError(p.error):setProfit(p)}).catch(e=>setError(e.message));
  },[]);

  if(!daily)return error?<div role="alert">{error}<button onClick={()=>window.location.reload()}>Retry</button></div>:"Loading...";

  return <div>
    <h1>Reports</h1>
    <div className="stats">
      <div className="stat"><span>Total Sales</span><b>Rs. {money(daily.todaySales)}</b></div>
      <div className="stat"><span>Bills</span><b>{daily.todayBills}</b></div>
      <div className="stat"><span>Items Sold</span><b>{daily.todayItemsSold}</b></div>
      <div className="stat"><span>Cash</span><b>Rs. {money(daily.cashSales)}</b></div>
      <div className="stat"><span>UPI</span><b>Rs. {money(daily.upiSales)}</b></div>
      <div className="stat"><span>Card</span><b>Rs. {money(daily.cardSales)}</b></div>
      <div className="stat"><span>Credit</span><b>Rs. {money(daily.creditSales)}</b></div>
      <div className="stat"><span>Stock Value</span><b>Rs. {money(daily.currentStockValue)}</b></div>
      <div className="stat"><span>Low Stock</span><b>{daily.lowStock}</b></div>
    </div>
    <div className="report-grid">
      <div className="panel">
        <h2>Top Selling Products Today</h2>
        {daily.topSellingProducts.map((p,i)=><div className="rank" key={p.productId}><b>{i+1}. {p.name}</b><span>{p.quantity} Qty</span></div>)}
      </div>
      <div className="panel">
        <h2>Category Wise Sales</h2>
        {category.map(row=><div className="rank" key={row.category}><b>{row.category}</b><span>Rs. {money(row.total)}</span></div>)}
      </div>
    </div>
    {error&&<div className="alert">{error}</div>}
    {profit&&<div className="panel">
      <h2>Profit Report</h2>
      <div className="stat inline"><span>Today's Profit</span><b>Rs. {money(profit.todayProfit)}</b></div>
      <div className="table">
        <table><thead><tr><th>Product</th><th>Qty Sold</th><th>Sales</th><th>Profit</th></tr></thead><tbody>{profit.products.map(p=><tr key={p.productId}><td>{p.name}</td><td>{p.quantity}</td><td>Rs. {money(p.sales)}</td><td>Rs. {money(p.profit)}</td></tr>)}</tbody></table>
      </div>
    </div>}
  </div>
}
