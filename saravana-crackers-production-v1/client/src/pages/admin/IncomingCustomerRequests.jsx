import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api";

const statuses = ["PENDING", "ACKNOWLEDGED", "PROCESSING", "COMPLETED", "REJECTED"];
export default function IncomingCustomerRequests() {
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [searchParams] = useSearchParams();
  const load = () => { const query = new URLSearchParams(); if (status) query.set("status", status); if (from) query.set("from", from); if (to) query.set("to", to); return api(`/customer-requests${query.toString() ? `?${query}` : ""}`).then(setRequests).catch(e => setError(e.message)); };
  useEffect(() => { load(); }, [status]);
  useEffect(() => {
    const requestId = searchParams.get("requestId");
    if (requestId) api(`/customer-requests/${requestId}`).then(setSelected).catch(e => setError(e.message));
  }, [searchParams]);
  const update = async (request, nextStatus) => {
    let rejectionReason = "";
    if (nextStatus === "REJECTED") { rejectionReason = window.prompt("Reason for rejection") || ""; if (!rejectionReason.trim()) return; }
    try { await api(`/customer-requests/${request.id}/status`, { method: "PATCH", body: JSON.stringify({ status: nextStatus, rejectionReason }) }); load(); }
    catch (e) { setError(e.message); }
  };
  return <div><h1>Incoming Customer Requests</h1><p>Requests from outdoor salespeople.</p>{error && <div className="alert" role="alert">{error}</div>}
    <div className="compact-form"><label>From<input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} /></label><label>To<input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} /></label><label>Status<select className="input" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{statuses.map(value => <option key={value}>{value}</option>)}</select></label><button type="button" className="btn" onClick={load}>Filter</button></div>
    <div className="table"><table><thead><tr><th>Request</th><th>Customer</th><th>Products</th><th>Salesperson</th><th>Submitted</th><th>Status</th><th>Actions</th></tr></thead><tbody>{requests.map(request => <tr key={request.id} onClick={() => setSelected(request)} className="clickable-row"><td><b>{request.requestNumber}</b>{request.notes && <small><br />{request.notes}</small>}</td><td>{request.customerName || "Walk-in"}</td><td>{request.items.map(item => <div key={item.id}>{item.productNameSnapshot} — {item.quantity} {item.unit}</div>)}</td><td>{request.createdBy?.name}</td><td>{new Date(request.createdAt).toLocaleString()}</td><td><span className={`status ${request.status.toLowerCase()}`}>{request.status}</span></td><td onClick={event => event.stopPropagation()}><div className="actions">{request.status === "PENDING" && <button onClick={() => update(request, "ACKNOWLEDGED")}>Acknowledge</button>}{request.status === "ACKNOWLEDGED" && <button onClick={() => update(request, "PROCESSING")}>Start processing</button>}{request.status === "PROCESSING" && <button onClick={() => update(request, "COMPLETED")}>Complete</button>}{!["COMPLETED", "REJECTED"].includes(request.status) && <button className="danger" onClick={() => update(request, "REJECTED")}>Reject</button>}</div></td></tr>)}</tbody></table></div>
    {selected&&<div className="modal" role="dialog" aria-modal="true" aria-label="Customer request note"><div className="modal-box"><div className="row"><h2>{selected.requestNumber}</h2><button type="button" onClick={()=>setSelected(null)}>Close</button></div><p><b>Customer:</b> {selected.customerName||"Not provided"}</p><p><b>Salesperson:</b> {selected.createdBy?.name}</p><p><b>Saved:</b> {new Date(selected.createdAt).toLocaleString()}</p><h3>Products</h3>{selected.items.map(item=><div className="rank" key={item.id}><b>{item.productNameSnapshot}</b><span>{item.quantity} {item.unit}</span></div>)}{selected.notes&&<><h3>Additional notes</h3><p>{selected.notes}</p></>}</div></div>}
  </div>;
}
