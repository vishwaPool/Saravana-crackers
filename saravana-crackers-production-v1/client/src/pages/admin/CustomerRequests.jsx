import { useEffect, useState } from "react";
import { api } from "../../api";

const blankItem = () => ({ productId: "", productName: "", quantity: 1, unit: "Box", notes: "" });
const units = ["Box", "Packet", "Piece", "Bundle", "Set"];

export default function CustomerRequests() {
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([blankItem()]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [historyStatus, setHistoryStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadHistory = () => {
    const query = new URLSearchParams();
    if (historyStatus) query.set("status", historyStatus);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return api(`/customer-requests/my-requests${query.toString() ? `?${query}` : ""}`).then(setHistory).catch(e => setError(e.message));
  };
  useEffect(() => { loadHistory(); }, []);
  useEffect(() => {
    if (!search.trim()) return setProducts([]);
    const timer = setTimeout(() => api(`/products?search=${encodeURIComponent(search.trim())}`).then(setProducts).catch(e => setError(e.message)), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const updateItem = (index, key, value) => setItems(current => current.map((item, i) => i === index ? { ...item, [key]: value } : item));
  const submit = async event => {
    event.preventDefault();
    setError(""); setMessage("");
    try {
      const result = await api("/customer-requests", { method: "POST", body: JSON.stringify({ customerName, notes, items }) });
      setMessage(`Request ${result.requestNumber} sent to the store.`);
      setCustomerName(""); setNotes(""); setItems([blankItem()]); setSearch(""); setProducts([]);
      loadHistory();
    } catch (e) { setError(e.message); }
  };
  return <div>
    <div className="row"><div><h1>Customer Request</h1><p>Save a customer's product requirements as a note for indoor staff.</p></div></div>
    {message && <div className="alert" role="status">{message}</div>}
    {error && <div className="alert" role="alert">{error}</div>}
    <form className="panel form" onSubmit={submit}>
      <label>Customer name (optional)<input className="input" value={customerName} onChange={e => setCustomerName(e.target.value)} maxLength="120" /></label>
      <h2>Requested products</h2>
      {items.map((item, index) => <div className="request-item" key={index}>
        <div className="search-box"><input className="input" placeholder="Search catalogue" value={searchIndex === index ? search : item.productName} onFocus={() => { setSearchIndex(index); setSearch(item.productName); }} onChange={e => { setSearchIndex(index); setSearch(e.target.value); updateItem(index, "productId", ""); updateItem(index, "productName", e.target.value); }} />
          {searchIndex === index && products.length > 0 && <div className="suggestions inline">{products.slice(0, 8).map(product => <button type="button" key={product.id} onClick={() => { updateItem(index, "productId", product.id); updateItem(index, "productName", product.name); setSearch(""); setSearchIndex(-1); setProducts([]); }}><span>{product.sku}</span><strong>{product.name}</strong></button>)}</div>}
        </div>
        <input type="number" min="1" step="1" className="input" aria-label="Quantity" value={item.quantity} onChange={e => updateItem(index, "quantity", e.target.value)} />
        <select className="input" value={item.unit} onChange={e => updateItem(index, "unit", e.target.value)}>{units.map(unit => <option key={unit}>{unit}</option>)}</select>
        <button type="button" className="danger" disabled={items.length === 1} onClick={() => setItems(current => current.filter((_, i) => i !== index))}>Remove</button>
      </div>)}
      <button type="button" className="btn ghost" onClick={() => setItems(current => [...current, blankItem()])}>Add another product</button>
      <label>Additional instructions<textarea className="input" rows="3" maxLength="2000" value={notes} onChange={e => setNotes(e.target.value)} /></label>
      <button className="btn" type="submit">Save Request</button>
    </form>
    <section className="panel"><h2>Notes List</h2><div className="compact-form"><label>From<input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} /></label><label>To<input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} /></label><label>Status<select className="input" value={historyStatus} onChange={e => setHistoryStatus(e.target.value)}><option value="">All statuses</option>{["PENDING", "ACKNOWLEDGED", "PROCESSING", "COMPLETED", "REJECTED"].map(value => <option key={value}>{value}</option>)}</select></label><button type="button" className="btn" onClick={loadHistory}>Filter</button></div>{history.length === 0 ? <p className="empty">No saved requests yet.</p> : history.map(request => <button type="button" className="order note-row" key={request.id} onClick={() => setSelected(request)}><div><b>{request.requestNumber}</b><div>{request.items.map(item => `${item.productNameSnapshot} (${item.quantity} ${item.unit})`).join(", ")}</div><small>{new Date(request.createdAt).toLocaleString()} {request.customerName && `· ${request.customerName}`}</small></div><span className={`status ${request.status.toLowerCase()}`}>{request.status}</span></button>)}</section>
    {selected&&<div className="modal" role="dialog" aria-modal="true" aria-label="Customer request note"><div className="modal-box"><div className="row"><h2>{selected.requestNumber}</h2><button type="button" onClick={()=>setSelected(null)}>Close</button></div><p><b>Customer:</b> {selected.customerName||"Not provided"}</p><p><b>Saved:</b> {new Date(selected.createdAt).toLocaleString()}</p><h3>Products</h3>{selected.items.map(item=><div className="rank" key={item.id}><b>{item.productNameSnapshot}</b><span>{item.quantity} {item.unit}</span></div>)}{selected.notes&&<><h3>Additional notes</h3><p>{selected.notes}</p></>} </div></div>}
  </div>;
}
