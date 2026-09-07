import{useEffect,useState}from"react";import{api}from"../../api";
export default function StockAdmin(){const[a,setA]=useState([]);useEffect(()=>{api("/admin/stock-transactions").then(setA)},[]);return <><h1>Stock Movements</h1>{a.map(x=><div className="card" key={x.id}>{new Date(x.createdAt).toLocaleString()} · {x.product.name} · {x.type} · {x.quantity}</div>)}</>}
