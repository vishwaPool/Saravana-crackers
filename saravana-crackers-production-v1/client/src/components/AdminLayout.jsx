import AsyncButton from "./AsyncButton";
import {useEffect,useState} from "react";
import {NavLink,Outlet,useNavigate} from "react-router-dom";
import {api} from "../api";
import {io} from "socket.io-client";
import {registerPushNotifications} from "../notifications";

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
  const [unread,setUnread]=useState(0);
  const [notifications,setNotifications]=useState([]);
  const [showNotifications,setShowNotifications]=useState(false);
  const [toast,setToast]=useState("");
  const nav=useNavigate();
  useEffect(()=>{
    api("/auth/me")
      .then(async r=>{
        setUser(r.user);
        try {
          const items=await api("/notifications");
          setNotifications(items);
          setUnread(items.filter(item=>!item.isRead).length);
        } catch(error) {
          console.error("Unable to load notifications",error);
        }
      })
      .catch(()=>nav("/admin/login"));
  },[]);
  useEffect(()=>{
    if(!user)return;
    if(["ADMIN","SUPER_ADMIN","INDOOR_STAFF","ORDER_MANAGER"].includes(user.role)) registerPushNotifications().catch(error=>console.error("Push notification registration failed",error));
    const socketUrl=import.meta.env.VITE_SOCKET_URL;
    if(!socketUrl)return;
    const socket=io(socketUrl,{withCredentials:true});
    socket.on("notification",notification=>{
      setNotifications(current=>[notification,...current.filter(item=>item.id!==notification.id)]);
      setUnread(count=>count+1);
      setToast(notification.title);
      setTimeout(()=>setToast(""),5000);
    });
    return ()=>socket.disconnect();
  },[user]);
  const openNotification=async notification=>{
    if(!notification.isRead){
      await api(`/notifications/${notification.id}/read`,{method:"PATCH"});
      setNotifications(current=>current.map(item=>item.id===notification.id?{...item,isRead:true}:item));
      setUnread(count=>Math.max(0,count-1));
    }
    setShowNotifications(false);
    nav(`/admin/incoming-customer-requests?requestId=${notification.requestId}`);
  };
  if(!user)return <div className="center">Checking session...</div>;
  return <div className="admin">{toast&&<div className="toast" role="status">{toast}</div>}
    <aside className="no-print">
      <h2>Saravana</h2>
      <small>ADMIN / POS</small>
      <nav>{links.filter(([p])=>p!=="analytics"||["ADMIN","SUPER_ADMIN"].includes(user.role)).map(([p,l])=><NavLink key={p} to={`/admin/${p}`}>{p==="analytics"&&<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{marginRight:8}}><path d="M3 3v18h18M7 16v-5m5 5V6m5 10V9"/></svg>}{l}</NavLink>)}
        {["OUTDOOR_SALESPERSON","ADMIN","SUPER_ADMIN","INDOOR_STAFF","ORDER_MANAGER"].includes(user.role) && <NavLink to="/admin/customer-requests">Customer Request</NavLink>}
        {["ADMIN","SUPER_ADMIN","INDOOR_STAFF","ORDER_MANAGER"].includes(user.role) && <NavLink to="/admin/incoming-customer-requests">Incoming Customer Requests {unread > 0 && <b className="badge">{unread}</b>}</NavLink>}
      </nav>
      <AsyncButton onClick={async()=>{await api("/auth/logout",{method:"POST"});nav("/admin/login")}}>Logout</AsyncButton>
    </aside>
    <section>
      <header className="admin-topbar no-print">
        <div className="topbar-spacer"/>
        {["ADMIN","SUPER_ADMIN","INDOOR_STAFF","ORDER_MANAGER"].includes(user.role) && <div className="notification-wrap">
          <button type="button" className="notification-button" aria-label="Notifications" aria-expanded={showNotifications} onClick={()=>setShowNotifications(value=>!value)}>
            <span aria-hidden="true">🔔</span>{unread>0&&<b className="badge">{unread}</b>}
          </button>
          {showNotifications&&<div className="notification-dropdown">
            <strong>Customer Requests</strong>
            {notifications.length===0?<p className="empty">No notifications</p>:notifications.slice(0,10).map(notification=><button type="button" className={`notification-row ${notification.isRead?"":"unread"}`} key={notification.id} onClick={()=>openNotification(notification)}>
              <span><b>{notification.title}</b><small>{notification.message}</small><small>{new Date(notification.createdAt).toLocaleString()}</small></span>
            </button>)}
          </div>}
        </div>}
      </header>
      <div className="admin-body"><Outlet/></div>
    </section>
  </div>;
}
