import {useEffect, useState} from "react";
import {Link, NavLink, Outlet, useLocation, useNavigate} from "react-router-dom";
import {useCart} from "../state/CartContext";
import {api} from "../api";
import StoreIcon from "./StoreIcon";
import saravanaLogo from "../assets/Saravana_crackers_logo-transparent.png";
import "../storefront.css";

const links = [["Home", "/"], ["All Products", "/products"], ["Offers", "/#offers"], ["Categories", "/#categories"], ["About Us", "/#about"], ["Contact", "/#contact"]];
function safeSocial(value) {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export default function Store() {
  const {count} = useCart();
  const [settings, setSettings] = useState({}), [settingsError, setSettingsError] = useState("");
  const [query, setQuery] = useState(""), [menu, setMenu] = useState(false);
  const location = useLocation(), navigate = useNavigate();
  const loadSettings = () => {setSettingsError(""); api("/settings").then(setSettings).catch(() => setSettingsError("Contact details are temporarily unavailable."));};
  useEffect(loadSettings, []);
  useEffect(() => {
    setMenu(false);
    setQuery(new URLSearchParams(location.search).get("q") || "");
    if (!location.hash) window.scrollTo(0, 0);
    else requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView());
  }, [location.pathname, location.search, location.hash]);
  const shopName = settings.shopName || "Saravana Crackers";
  const whatsapp = String(settings.whatsapp || "").replace(/\D/g, "");
  const socials = [["facebook", "Facebook", settings.facebookUrl], ["instagram", "Instagram", settings.instagramUrl], ["whatsapp", "WhatsApp", whatsapp ? `https://wa.me/${whatsapp}` : null], ["youtube", "YouTube", settings.youtubeUrl]].filter(([, , url]) => safeSocial(url));
  return <div className="storefront">
    <a href="#store-main" className="store-skip">Skip to content</a>
    <header className="store-header"><div className="container store-header-main">
      <Link className="store-brand" to="/"><img src={saravanaLogo} alt="Saravana Crackers" className="brand-logo" width="68" height="68"/><span>{shopName}<small>Celebrate brighter moments</small></span></Link>
      <form className="store-search" role="search" onSubmit={event => {event.preventDefault(); navigate(`/products${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);}}><input type="search" aria-label="Search products" placeholder="Search your celebration favourites…" value={query} onChange={event => setQuery(event.target.value)}/><button aria-label="Submit search"><StoreIcon name="search"/></button></form>
      <div className="store-header-actions"><Link to="/admin/login" aria-label="Login"><StoreIcon name="user"/><span>Login</span></Link><Link to="/cart" aria-label={`Cart, ${count} items`}><StoreIcon name="cart"/><span>Cart</span><b>{count}</b></Link></div>
    </div><div className="store-nav-bar"><div className="container store-nav-inner"><button className="store-menu-toggle" aria-expanded={menu} aria-controls="store-navigation" onClick={() => setMenu(value => !value)}>☰ <span>Menu</span></button><nav id="store-navigation" className={menu ? "is-open" : ""} aria-label="Main navigation">{links.map(([label, to]) => to.includes("#") ? <Link key={label} to={to} onClick={() => setMenu(false)}>{label}</Link> : <NavLink end key={label} to={to}>{label}</NavLink>)}</nav><span className="diwali-badge">✦ Happy Diwali! ✦</span></div></div></header>
    <main id="store-main"><Outlet context={{settings}}/></main>
    <footer className="store-footer"><div className="container footer-grid">
      <div id="about"><div className="store-brand footer-brand"><StoreIcon width="30" height="30"/><span>{shopName}</span></div><p className="footer-tagline">A little sparkle. A lot of joy.</p><p>Your destination for quality crackers and joyful celebrations. Explore our collection for your next family celebration.</p>{socials.length > 0 && <div className="store-socials">{socials.map(([icon, label, url]) => <a key={icon} href={safeSocial(url)} aria-label={label} target="_blank" rel="noreferrer"><StoreIcon name={icon}/></a>)}</div>}</div>
      <div><h3>Quick Links</h3><nav aria-label="Footer navigation">{links.map(([label, to]) => <Link key={label} to={to}>{label}</Link>)}<Link to="/track-order">Track Your Order</Link></nav></div>
      <div id="contact"><h3>Contact Us</h3>{settings.phone && <a href={`tel:${String(settings.phone).replace(/[^+\d]/g, "")}`}>{settings.phone}</a>}{settings.email && <a href={`mailto:${settings.email}`}>{settings.email}</a>}{settings.address && <address>{settings.address}</address>}{settings.businessHours && <p>{settings.businessHours}</p>}{whatsapp && <a href={`https://wa.me/${whatsapp}`}>Chat on WhatsApp →</a>}{settingsError && <p role="status">{settingsError} <button onClick={loadSettings}>Retry</button></p>}{!settingsError && !settings.phone && !settings.email && !settings.address && !whatsapp && <p>Contact details will appear here when available.</p>}</div>
      <div><h3>We Accept</h3><div className="store-payments"><span>UPI</span><span>Cash</span><span>Card</span></div><p>For in-store payments.</p><h3>Made for celebrations</h3><p>Browse, add your favourites, and place your order.</p><Link className="footer-shop" to="/products">Explore the collection →</Link></div>
    </div><div className="container footer-bottom"><span>© {new Date().getFullYear()} {shopName}. All rights reserved.</span><span>Made with ♡ in India</span></div></footer>
  </div>;
}
