import {useState} from "react";
import {api} from "../api";
import ActionForm from "../components/ActionForm";
export default function Track(){
  const [order,setOrder]=useState(""),[phone,setPhone]=useState(""),[result,setResult]=useState(null);
  async function track(event){
    event.preventDefault();
    setResult(null);
    setResult(await api(`/orders/track/${encodeURIComponent(order.trim())}?phone=${encodeURIComponent(phone.trim())}`));
  }
  return <section className="section"><div className="container narrow"><h1>Track Order</h1><ActionForm className="panel form" onSubmit={track} successMessage="Order found."><label>Order number *<input required className="input" value={order} onChange={event=>setOrder(event.target.value)}/></label><label>Phone *<input required type="tel" className="input" value={phone} onChange={event=>setPhone(event.target.value)}/></label><button className="btn">Track</button></ActionForm>{result&&<div className="panel"><h2>{result.orderNumber}</h2><p>Status: <b>{result.status}</b></p><p>Total: Rs. {result.total}</p></div>}</div></section>;
}