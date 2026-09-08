import {useEffect,useState} from "react";
import {NavLink,Outlet,useNavigate} from "react-router-dom";
import {api} from "../api";

const links=[
  ["dashboard","Dashboard"],
  ["billing","Billing POS"],
  ["sales","Sales"],
  ["returns","Returns"],
  ["reports","Reports"],
  ["products","Products"],
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
      <nav>{links.map(([p,l])=><NavLink key={p} to={`/admin/${p}`}>{l}</NavLink>)}</nav>
      <button onClick={async()=>{await api("/auth/logout",{method:"POST"});nav("/admin/login")}}>Logout</button>
    </aside>
    <section>
      <header className="no-print"><b>{user.name}</b> · {user.role}</header>
      <div className="admin-body"><Outlet/></div>
    </section>
  </div>;
}
