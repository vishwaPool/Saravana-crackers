import {useState} from "react";
import {api} from "../../api";

const money=n=>Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});

export default function ReturnsAdmin(){
  const [invoice,setInvoice]=useState("");
  const [sale,setSale]=useState(null);
  const [items,setItems]=useState({});
  const [message,setMessage]=useState("");

  async function findInvoice(){
    setMessage("");
    setSale(await api(`/admin/sales/${encodeURIComponent(invoice)}`));
  }

  async function submitReturn(){
    const selected=Object.entries(items).map(([saleItemId,quantity])=>({saleItemId:Number(saleItemId),quantity:Number(quantity)})).filter(i=>i.quantity>0);
    if(!selected.length){setMessage("Select returned quantity.");return}
    try{
      const ret=await api("/admin/returns",{method:"POST",body:JSON.stringify({saleId:sale.id,items:selected,remarks:"Counter sales return"})});
      setMessage(`Return saved: ${ret.returnNumber}, refund Rs. ${money(ret.refundAmount)}`);
      setSale(await api(`/admin/sales/${sale.id}`));
      setItems({});
    }catch(e){setMessage(e.message)}
  }

  return <div>
    <h1>Sales Return</h1>
    <div className="panel compact-form">
      <input className="input" placeholder="Invoice Number" value={invoice} onChange={e=>setInvoice(e.target.value)} onKeyDown={e=>e.key==="Enter"&&findInvoice()}/>
      <button className="btn" onClick={findInvoice}>Search Invoice</button>
    </div>
    {message&&<div className="alert">{message}</div>}
    {sale&&<div className="panel">
      <h2>{sale.invoiceNumber}</h2>
      <p>{new Date(sale.createdAt).toLocaleString()} · {sale.customer?.name||"Walk-in"} · Rs. {money(sale.grandTotal)}</p>
      <div className="table">
        <table>
          <thead><tr><th>Product</th><th>Sold</th><th>Returned</th><th>Return Now</th><th>Amount</th></tr></thead>
          <tbody>{sale.items.map(item=>{
            const remaining=item.quantity-item.returnedQuantity;
            return <tr key={item.id}>
              <td>{item.productNameSnapshot}</td>
              <td>{item.quantity}</td>
              <td>{item.returnedQuantity}</td>
              <td><input className="cell-input" type="number" min="0" max={remaining} value={items[item.id]||""} onChange={e=>setItems({...items,[item.id]:Math.min(Number(e.target.value),remaining)})}/></td>
              <td>Rs. {money((Number(item.total)/item.quantity)*Number(items[item.id]||0))}</td>
            </tr>
          })}</tbody>
        </table>
      </div>
      <button className="btn complete" onClick={submitReturn}>Save Return</button>
    </div>}
  </div>
}
