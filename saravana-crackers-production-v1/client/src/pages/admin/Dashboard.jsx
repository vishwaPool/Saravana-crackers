import {useEffect,useState} from "react";
import {api} from "../../api";

const money=n=>Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});

export default function Dashboard(){const[loadError,setLoadError]=useState("");
  const [d,setD]=useState(null);
  useEffect(()=>{api("/admin/dashboard/pos").then(setD).catch(e=>setLoadError(e.message))},[]);
  if(!d)return loadError?<div role="alert">{loadError}<button onClick={()=>window.location.reload()}>Retry</button></div>:"Loading...";
  return <>
    <h1>Dashboard</h1>{loadError&&<div className="alert" role="alert">Unable to load data: {loadError} <button type="button" onClick={()=>window.location.reload()}>Retry</button></div>}
    <div className="stats">
      {Object.entries({
        "Today's Sales":`Rs. ${money(d.todaySales)}`,
        "Today's Bills":d.todayBills,
        "Items Sold":d.todayItemsSold,
        "Cash Sales":`Rs. ${money(d.cashSales)}`,
        "UPI Sales":`Rs. ${money(d.upiSales)}`,
        "Card Sales":`Rs. ${money(d.cardSales)}`,
        "Credit Sales":`Rs. ${money(d.creditSales)}`,
        "Stock Value":`Rs. ${money(d.currentStockValue)}`,
        "Low Stock":d.lowStock
      }).map(([k,v])=><div className="stat" key={k}><span>{k}</span><b>{v}</b></div>)}
    </div>
    <div className="report-grid">
      <div className="panel">
        <h2>Low Stock Items</h2>
        {d.lowStockProducts.map(p=><div className="rank" key={p.id}><b>{p.name}</b><span>Stock {p.stock} / Min {p.minStock}</span></div>)}
      </div>
      <div className="panel">
        <h2>Top Selling Today</h2>
        {d.topSellingProducts.map((p,i)=><div className="rank" key={p.productId}><b>{i+1}. {p.name}</b><span>{p.quantity} Qty</span></div>)}
      </div>
    </div>
  </>;
}
