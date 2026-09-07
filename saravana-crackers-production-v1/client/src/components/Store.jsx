import {NavLink,Outlet} from "react-router-dom";
import {useCart} from "../state/CartContext";
export default function Store(){const{count}=useCart();return <>
<header className="top"><div className="container nav"><NavLink className="brand" to="/">✦ Saravana Crackers</NavLink><nav><NavLink to="/">Home</NavLink><NavLink to="/products">Products</NavLink><NavLink to="/track-order">Track</NavLink><NavLink to="/cart">Cart <b>{count}</b></NavLink></nav></div></header>
<main><Outlet/></main><footer className="footer"><div className="container"><h3>Saravana Crackers</h3><p>Retail · Wholesale · Festival Orders</p></div></footer></>}
