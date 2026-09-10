import {useEffect,useState} from "react";
import {api} from "../../api";
import {useAsyncAction} from "../../state/useAsyncAction";
const statuses=["NEW","CONFIRMED","PACKING","READY","OUT_FOR_DELIVERY","DELIVERED","CANCELLED"];
export default function OrdersAdmin(){
  const [orders,setOrders]=useState([]),[message,setMessage]=useState("");
  const {run,pending,error}=useAsyncAction();
  const load=()=>api("/admin/orders").then(setOrders);
  useEffect(()=>{run(load)},[]);
  async function update(order,status){
    setMessage("");
    await run(async()=>{
      await api(`/admin/orders/${order.id}/status`,{method:"PUT",body:JSON.stringify({status})});
      setOrders(current=>current.map(item=>item.id===order.id?{...item,status}:item));
      setMessage(`${order.orderNumber} updated to ${status}.`);
    });
  }
  return <><h1>Orders</h1>{pending&&<p role="status">Please wait...</p>}{error&&<div className="alert" role="alert">{error}</div>}{message&&<p className="success-message" role="status">{message}</p>}{orders.map(order=><div className="order" key={order.id}><b>{order.orderNumber}</b> · {order.customer.name} · Rs. {order.total}<select aria-label={`Status for ${order.orderNumber}`} disabled={pending} value={order.status} onChange={event=>update(order,event.target.value)}>{statuses.map(status=><option key={status}>{status}</option>)}</select></div>)}</>;
}