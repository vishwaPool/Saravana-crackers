import{useEffect,useState}from"react";import{api}from"../../api";
export default function AuditAdmin(){const[a,setA]=useState([]);useEffect(()=>{api("/admin/audit-logs").then(setA)},[]);return <><h1>Audit Logs</h1>{a.map(x=><div className="card" key={x.id}>{new Date(x.createdAt).toLocaleString()} · {x.user?.name||"-"} · {x.action} · {x.entity}</div>)}</>}
