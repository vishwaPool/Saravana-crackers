import{useEffect,useState}from"react";import{api}from"../../api";
export default function CustomersAdmin(){const[a,setA]=useState([]);useEffect(()=>{api("/admin/customers").then(setA)},[]);return <><h1>Customers</h1>{a.map(x=><div className="card" key={x.id}><b>{x.name}</b> · {x.phone} · Orders {x._count.orders} · ₹{x.totalSpend}</div>)}</>}
