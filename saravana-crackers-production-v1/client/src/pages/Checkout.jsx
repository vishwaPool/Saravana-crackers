import {useState} from "react";
import {Link} from "react-router-dom";
import {useCart} from "../state/CartContext";
import {api} from "../api";
import ActionForm from "../components/ActionForm";

export default function Checkout(){
  const {items,clearCart}=useCart();
  const [form,setForm]=useState({name:"",phone:"",address:"",city:"",deliveryMethod:"PICKUP"});
  const [order,setOrder]=useState(null);
  const set=(key,value)=>setForm(current=>({...current,[key]:value}));
  async function submit(event){
    event.preventDefault();
    if(!items.length) throw new Error("Add at least one product before placing an order.");
    const customer=Object.fromEntries(Object.entries(form).map(([key,value])=>[key,value.trim()]));
    const result=await api("/orders",{method:"POST",body:JSON.stringify({customer,deliveryMethod:form.deliveryMethod,items:items.map(item=>({productId:item.id,quantity:item.quantity}))})});
    setOrder(result);
    clearCart();
  }
  if(order){
    const message=`Hi Saravana Crackers,\nOrder: ${order.orderNumber}\nTotal: Rs. ${order.total}`;
    return <section className="section"><div className="container narrow panel"><h1>Order placed successfully</h1><p role="status">Your order number is <strong>{order.orderNumber}</strong>.</p><p>Total: Rs. {Number(order.total).toLocaleString("en-IN")}</p>{order.whatsapp&&<a className="btn" href={`https://wa.me/${String(order.whatsapp).replace(/\D/g,"")}?text=${encodeURIComponent(message)}`}>Continue on WhatsApp</a>} <Link to="/track-order">Track your order</Link></div></section>;
  }
  if(!items.length)return <section className="section"><div className="container"><h1>Your cart is empty</h1><Link className="btn" to="/products">Browse products</Link></div></section>;
  return <section className="section"><div className="container narrow"><h1>Checkout</h1><ActionForm className="panel form" onSubmit={submit}>
    <label>Name *<input className="input" autoComplete="name" value={form.name} onChange={e=>set("name",e.target.value)} required/></label>
    <label>Phone *<input className="input" type="tel" autoComplete="tel" pattern="[+0-9 ()-]{7,20}" title="Enter a valid phone number (7–20 characters)." value={form.phone} onChange={e=>set("phone",e.target.value)} required/></label>
    <label>Address *<textarea className="input" autoComplete="street-address" value={form.address} onChange={e=>set("address",e.target.value)} required/></label>
    <label>City *<input className="input" autoComplete="address-level2" value={form.city} onChange={e=>set("city",e.target.value)} required/></label>
    <label>Delivery<select className="input" value={form.deliveryMethod} onChange={e=>set("deliveryMethod",e.target.value)}><option value="PICKUP">Store Pickup</option><option value="DELIVERY">Local Delivery</option></select></label>
    <button className="btn">Place Order</button>
  </ActionForm></div></section>;
}