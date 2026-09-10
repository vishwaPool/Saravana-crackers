import {useAsyncAction} from "../../state/useAsyncAction";
import AsyncButton from "../../components/AsyncButton";
import {useState} from "react";
import {api} from "../../api";

const money=n=>Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});

export default function ReturnsAdmin(){
  const {run,pending,error}=useAsyncAction();
  const [invoice,setInvoice]=useState("");
  const [sale,setSale]=useState(null);
  const [items,setItems]=useState({});
  const [message,setMessage]=useState("");

  async function findInvoiceImpl(){
    if(!invoice.trim()) throw new Error("Enter an invoice number.");
    setSale(null);
    setItems({});
    setMessage("");
    setSale(await api(`/admin/sales/${encodeURIComponent(invoice.trim())}`));
  }

  async function submitReturnImpl(){
    if(!sale)throw new Error("Find an invoice first.");
    if(Object.values(items).some(quantity=>!Number.isInteger(Number(quantity))||Number(quantity)<0))throw new Error("Return quantities must be non-negative whole numbers.");
    const selected=Object.entries(items).map(([saleItemId,quantity])=>({saleItemId:Number(saleItemId),quantity:Number(quantity)})).filter(i=>i.quantity>0);
    if(!selected.length){setMessage("Select returned quantity.");return}
    try{
      const ret=await api("/admin/returns",{method:"POST",body:JSON.stringify({saleId:sale.id,items:selected,remarks:"Counter sales return"})});
      setMessage(`Return saved: ${ret.returnNumber}, refund Rs. ${money(ret.refundAmount)}`);
      setItems({});
      setSale(current=>({...current,items:current.items.map(item=>({...item,returnedQuantity:item.returnedQuantity+(selected.find(line=>line.saleItemId===item.id)?.quantity||0)}))}));
      try{setSale(await api(`/admin/sales/${sale.id}`))}catch{setMessage(`Return saved: ${ret.returnNumber}. Refresh the invoice to reload its latest status.`)}
    }catch(e){setMessage(e.message)}
  }

  const findInvoice=()=>run(findInvoiceImpl);
  const submitReturn=()=>run(submitReturnImpl);
  return <div>
    <h1>Sales Return</h1>{error&&<div className="alert" role="alert">{error}</div>}
    <div className="panel compact-form">
      <input className="input" placeholder="Invoice Number" value={invoice} onChange={e=>setInvoice(e.target.value)} />
      <AsyncButton disabled={pending} className="btn" onClick={findInvoice}>Search Invoice</AsyncButton>
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
              <td><input disabled={pending} className="cell-input" type="number" step="1" min="0" max={remaining} value={items[item.id]||""} onChange={e=>setItems({...items,[item.id]:Math.min(Number(e.target.value),remaining)})}/></td>
              <td>Rs. {money((Number(sale.subtotal)>0?Number(item.total)*Number(sale.grandTotal)/Number(sale.subtotal)/item.quantity:0)*Number(items[item.id]||0))}</td>
            </tr>
          })}</tbody>
        </table>
      </div>
      <AsyncButton disabled={pending} className="btn complete" onClick={submitReturn}>Save Return</AsyncButton>
    </div>}
  </div>
}
