import {useEffect,useState} from "react";
import {api} from "../../api";

export default function StockAdmin(){
  const [movements,setMovements]=useState([]);
  const [q,setQ]=useState("");
  const [products,setProducts]=useState([]);
  const [selected,setSelected]=useState(null);
  const [receive,setReceive]=useState({quantity:"",supplier:"",purchaseInvoiceNumber:"",purchasePrice:"",remarks:""});
  const [adjust,setAdjust]=useState({physicalStock:"",reason:""});
  const [message,setMessage]=useState("");

  const load=()=>api("/admin/stock/movements").then(setMovements);
  useEffect(()=>{load()},[]);
  useEffect(()=>{
    if(!q.trim()){setProducts([]);return}
    let live=true;
    api(`/admin/products/search?q=${encodeURIComponent(q)}`).then(data=>live&&setProducts(data));
    return()=>{live=false};
  },[q]);

  async function saveReceive(e){
    e.preventDefault();
    await api("/admin/stock/receive",{method:"POST",body:JSON.stringify({...receive,productId:selected?.id})});
    setMessage("Stock received and movement saved.");
    setReceive({quantity:"",supplier:"",purchaseInvoiceNumber:"",purchasePrice:"",remarks:""});
    setSelected(null);
    setQ("");
    load();
  }

  async function saveAdjust(e){
    e.preventDefault();
    const ok=window.confirm(`Confirm stock adjustment for ${selected?.name}? This will create an audit record.`);
    if(!ok)return;
    await api("/admin/stock/adjust",{method:"POST",body:JSON.stringify({...adjust,productId:selected?.id})});
    setMessage("Stock adjustment saved.");
    setAdjust({physicalStock:"",reason:""});
    setSelected(null);
    setQ("");
    load();
  }

  return <div>
    <h1>Stock Management</h1>
    <div className="panel">
      <input className="pos-search small" placeholder="Search product for stock entry..." value={q} onChange={e=>setQ(e.target.value)}/>
      {products.length>0&&<div className="suggestions inline">{products.map(p=><button key={p.id} onClick={()=>{setSelected(p);setProducts([]);setQ(p.name)}}><b>{p.name}</b><span>{p.sku} · Current {p.stock}</span></button>)}</div>}
      {selected&&<div className="selected-stock"><b>{selected.name}</b><span>Current stock: {selected.stock}</span></div>}
      {message&&<div className="alert">{message}</div>}
    </div>

    <div className="report-grid">
      <form className="panel form" onSubmit={saveReceive}>
        <h2>Receive Stock</h2>
        <input className="input" placeholder="Received Quantity" value={receive.quantity} onChange={e=>setReceive({...receive,quantity:e.target.value})}/>
        <input className="input" placeholder="Supplier" value={receive.supplier} onChange={e=>setReceive({...receive,supplier:e.target.value})}/>
        <input className="input" placeholder="Purchase Invoice Number" value={receive.purchaseInvoiceNumber} onChange={e=>setReceive({...receive,purchaseInvoiceNumber:e.target.value})}/>
        <input className="input" placeholder="Purchase Price" value={receive.purchasePrice} onChange={e=>setReceive({...receive,purchasePrice:e.target.value})}/>
        <input className="input" placeholder="Remarks" value={receive.remarks} onChange={e=>setReceive({...receive,remarks:e.target.value})}/>
        <button className="btn" disabled={!selected}>Save Stock Received</button>
      </form>
      <form className="panel form" onSubmit={saveAdjust}>
        <h2>Stock Adjustment</h2>
        <input className="input" placeholder="Physical Stock" value={adjust.physicalStock} onChange={e=>setAdjust({...adjust,physicalStock:e.target.value})}/>
        <input className="input" placeholder="Reason: damaged, missing, correction..." value={adjust.reason} onChange={e=>setAdjust({...adjust,reason:e.target.value})}/>
        <button className="btn danger-bg" disabled={!selected}>Save Adjustment</button>
      </form>
    </div>

    <h2>Stock Movement History</h2>
    <div className="table">
      <table><thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Before</th><th>After</th><th>Reference</th><th>Remarks</th></tr></thead><tbody>{movements.map(x=><tr key={x.id}><td>{new Date(x.createdAt).toLocaleString()}</td><td>{x.product?.name}</td><td>{x.type}</td><td>{x.quantity}</td><td>{x.previousStock}</td><td>{x.newStock}</td><td>{x.referenceId}</td><td>{x.remarks}</td></tr>)}</tbody></table>
    </div>
  </div>;
}
