import {flushSync} from "react-dom";
import BillPrint, {Invoice} from "../../components/BillPrint";
import AsyncButton from "../../components/AsyncButton";
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

  useEffect(()=>{load().catch(error=>setError(error.message))},[]);

  async function view(id){
    const sale=await api(`/admin/sales/${id}`);
    flushSync(()=>setSelected(sale));
  }

  async function voidInvoice(sale){
    const reason=window.prompt(`Are you sure you want to void invoice ${sale.invoiceNumber}? Stock will be restored. Enter reason:`);
    if(!reason?.trim())return false;
    try{
      await api(`/admin/sales/${sale.id}/void`,{method:"POST",body:JSON.stringify({reason})});
      await load();
      setSelected(null);
    }catch(e){setError(e.message);return false}
  }

  return <div>
    <div className="no-print">
      <h1>Sales History</h1>
      <div className="panel compact-form">
        <input className="input" placeholder="Invoice number, customer or mobile" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load().catch(error=>setError(error.message))}/>
        <AsyncButton className="btn" onClick={load}>Search</AsyncButton>
        <a className="btn ghost" href={`${import.meta.env.VITE_API_URL||"http://localhost:4000/api"}/admin/export/sales`}>Export Sales</a>
      </div>
      {error&&<div className="alert">{error}</div>}
      <div className="table">
        <table>
          <thead><tr><th>Invoice No</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Discount</th><th>Payment</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{sales.map(sale=><tr key={sale.id}>
            <td>{sale.invoiceNumber}</td>
            <td>{new Date(sale.createdAt).toLocaleString()}</td>
            <td>{sale.customerName||sale.customer?.name||"Walk-in"}<small>{sale.customer?.phone||""}</small></td>
            <td>{sale.items.length}</td>
            <td>Rs. {money(sale.grandTotal)}</td>
            <td>Rs. {money(sale.discountAmount)}</td>
            <td>{sale.paymentMethod}</td>
            <td><b className={`status ${sale.status.toLowerCase()}`}>{sale.status}</b></td>
            <td><AsyncButton onClick={()=>view(sale.id)}>View</AsyncButton> <AsyncButton onClick={()=>view(sale.id).then(()=>window.print())}>Reprint</AsyncButton> {sale.status==="COMPLETED"&&<AsyncButton className="danger" successMessage="Invoice voided." onClick={()=>voidInvoice(sale)}>Void</AsyncButton>}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
    {selected&&<div className="visible-preview no-print"><Invoice sale={selected}/><button className="btn" onClick={()=>window.print()}>Print / Save PDF</button><button className="btn ghost" onClick={()=>setSelected(null)}>Close</button></div>}
    <BillPrint sale={selected}/>
  </div>;
}
