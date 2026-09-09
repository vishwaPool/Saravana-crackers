import {useEffect,useState} from "react";
import {api} from "../../api";

const money=n=>Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});

export default function SalesAdmin(){
  const [sales,setSales]=useState([]);
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState(null);
  const [error,setError]=useState("");

  async function load(){
    const qs=search?`?search=${encodeURIComponent(search)}`:"";
    setSales(await api(`/admin/sales${qs}`));
  }

  useEffect(()=>{load()},[]);

  async function view(id){
    setSelected(await api(`/admin/sales/${id}`));
  }

  async function voidInvoice(sale){
    const reason=window.prompt(`Are you sure you want to void invoice ${sale.invoiceNumber}? Stock will be restored. Enter reason:`);
    if(!reason)return;
    try{
      await api(`/admin/sales/${sale.id}/void`,{method:"POST",body:JSON.stringify({reason})});
      await load();
      setSelected(null);
    }catch(e){setError(e.message)}
  }

  return <div>
    <div className="no-print">
      <h1>Sales History</h1>
      <div className="panel compact-form">
        <input className="input" placeholder="Invoice number, customer or mobile" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load()}/>
        <button className="btn" onClick={load}>Search</button>
        <a className="btn ghost" href={`${import.meta.env.VITE_API_URL||"http://localhost:4000/api"}/admin/export/sales`}>Export Sales</a>
      </div>
      {error&&<div className="alert">{error}</div>}
      <div className="table">
        <table>
          <thead><tr><th>Invoice No</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Discount</th><th>Payment</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{sales.map(sale=><tr key={sale.id}>
            <td>{sale.invoiceNumber}</td>
            <td>{new Date(sale.createdAt).toLocaleString()}</td>
            <td>{sale.customer?.name||"Walk-in"}<small>{sale.customer?.phone||""}</small></td>
            <td>{sale.items.length}</td>
            <td>Rs. {money(sale.grandTotal)}</td>
            <td>Rs. {money(sale.discountAmount)}</td>
            <td>{sale.paymentMethod}</td>
            <td><b className={`status ${sale.status.toLowerCase()}`}>{sale.status}</b></td>
            <td><button onClick={()=>view(sale.id)}>View</button> <button onClick={()=>view(sale.id).then(()=>setTimeout(()=>window.print(),50))}>Reprint</button> {sale.status==="COMPLETED"&&<button className="danger" onClick={()=>voidInvoice(sale)}>Void</button>}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
    {selected&&<div className="print-area visible-preview">
      <div className="invoice">
        <h1>SARAVANAN CRACKERS</h1>
        <h2>By Ravi Agro Service</h2>
        <p>Tirukovilur Main Road, Rishivandhiyam - 606205<br/>Mob: 9965936977</p>
        <p>Bill No: {selected.invoiceNumber}<br/>Date: {new Date(selected.createdAt).toLocaleString()}</p>
        {selected.status!=="COMPLETED"&&<h2>Duplicate / Reprint - {selected.status}</h2>}
        <table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>{selected.items.map(item=><tr key={item.id}><td>{item.productNameSnapshot}</td><td>{item.quantity}</td><td>{money(item.sellingPrice)}</td><td>{money(item.total)}</td></tr>)}</tbody></table>
        <div className="print-line"><span>Subtotal</span><b>Rs. {money(selected.subtotal)}</b></div>
        <div className="print-line"><span>Discount</span><b>Rs. {money(selected.discountAmount)}</b></div>
        <div className="print-total"><span>GRAND TOTAL</span><b>Rs. {money(selected.grandTotal)}</b></div>
        <p>Payment: {selected.paymentMethod}</p>
        <button className="btn no-print" onClick={()=>window.print()}>Print</button>
        <button className="btn ghost no-print" onClick={()=>setSelected(null)}>Close</button>
      </div>
    </div>}
  </div>
}
