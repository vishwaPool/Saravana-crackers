import AsyncButton from "./AsyncButton";
import {useEffect,useState} from "react";
import {NavLink,Outlet,useNavigate} from "react-router-dom";
import {api} from "../api";

const links=[
  ["billing","Billing POS"],
  ["dashboard","Dashboard"],
  ["analytics","Analytics"],
  ["sales","Sales"],
  ["products","Products"],
  ["reports","Reports"],
  ["returns","Returns"],
  ["categories","Categories"],
  ["orders","Orders"],
  ["offers","Offers"],
  ["customers","Customers"],
  ["suppliers","Suppliers"],
  ["purchases","Purchases"],
  ["stock","Stock"],
  ["settings","Settings"],
  ["audit","Audit Logs"]
];

export default function AdminLayout(){
  const [user,setUser]=useState(null);
  const nav=useNavigate();
  useEffect(()=>{api("/auth/me").then(r=>setUser(r.user)).catch(()=>nav("/admin/login"))},[]);
  if(!user)return <div className="center">Checking session...</div>;
  return <div className="admin">
    <aside className="no-print">
      <h2>Saravana</h2>
      <small>ADMIN / POS</small>
      <nav>{links.filter(([p])=>p!=="analytics"||["ADMIN","SUPER_ADMIN"].includes(user.role)).map(([p,l])=><NavLink key={p} to={`/admin/${p}`}>{p==="analytics"&&<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{marginRight:8}}><path d="M3 3v18h18M7 16v-5m5 5V6m5 10V9"/></svg>}{l}</NavLink>)}</nav>
      <AsyncButton onClick={async()=>{await api("/auth/logout",{method:"POST"});nav("/admin/login")}}>Logout</AsyncButton>
    </aside>
    <section>
      <div className="admin-body"><Outlet/></div>
    </section>
  </div>;
}
