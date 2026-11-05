import BillPrint from "../../components/BillPrint";
import CompletedBillPreview from "../../components/CompletedBillPreview";
import {useAsyncAction} from "../../state/useAsyncAction";
import {useEffect,useMemo,useRef,useState} from "react";
import {api} from "../../api";
import {io} from "socket.io-client";
import {useNavigate} from "react-router-dom";
import "./billing.css";

const money=n=>Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
const emptyCustomer={name:"",mobile:"",address:""};

export default function Billing(){
  const {run,pending,error:actionError}=useAsyncAction();
  const searchRef=useRef(null);
  const searchRequestRef=useRef(0);
  const submittedBill=useRef(null);
  const [showPreview,setShowPreview]=useState(false);
  const [q,setQ]=useState("");
  const [results,setResults]=useState([]);
  const [selected,setSelected]=useState(0);
  const [quantityProduct,setQuantityProduct]=useState(null);
  const [quantity,setQuantity]=useState("1");
  const [items,setItems]=useState([]);
  const [customer,setCustomer]=useState(emptyCustomer);
  const [showCustomer,setShowCustomer]=useState(false);
  const [discountType,setDiscountType]=useState("FIXED");
  const [discountValue,setDiscountValue]=useState(0);
  const [gst,setGst]=useState(0);
  const [paymentMethod,setPaymentMethod]=useState("CASH");
  const [held,setHeld]=useState([]);
  const [showHeld,setShowHeld]=useState(false);
  const [lastSale,setLastSale]=useState(null);
  const [error,setError]=useState("");
  const [pendingRequests,setPendingRequests]=useState([]);
  const [showRequestNotifications,setShowRequestNotifications]=useState(false);
  const [expandedRequest,setExpandedRequest]=useState(null);
  const quantityInputRef=useRef(null);
  const notificationRef=useRef(null);
  const navigate=useNavigate();

  const loadPendingRequests=()=>{
    api("/customer-requests?status=PENDING")
      .then(setPendingRequests)
      .catch(e=>setError(e.message));
  };

  useEffect(()=>{
    searchRef.current?.focus();
    let live=true;
    const id=sessionStorage.getItem("sc-last-sale");
    if(id)api(`/admin/sales/${encodeURIComponent(id)}`).then(sale=>{if(live)setLastSale(current=>current||sale)}).catch(()=>sessionStorage.removeItem("sc-last-sale"));
    return()=>{live=false};
  },[]);

  useEffect(()=>{
    loadPendingRequests();
    const timer=setInterval(loadPendingRequests,30000);
    const socketUrl=import.meta.env.VITE_SOCKET_URL;
    const socket=socketUrl?io(socketUrl,{withCredentials:true}):null;
    socket?.on("notification",loadPendingRequests);
    return()=>{
      clearInterval(timer);
      socket?.disconnect();
    };
  },[]);

  useEffect(()=>{
    const closeOnOutside=e=>{
      if(showRequestNotifications&&!notificationRef.current?.contains(e.target))setShowRequestNotifications(false);
    };
    document.addEventListener("mousedown",closeOnOutside);
    return()=>document.removeEventListener("mousedown",closeOnOutside);
  },[showRequestNotifications]);

  useEffect(()=>{
    let live=true;
    const text=q.trim();
    const requestId=++searchRequestRef.current;
    if(!text){setResults([]);return}
    api(`/admin/products/search?q=${encodeURIComponent(text)}`).then(data=>{
      if(live&&requestId===searchRequestRef.current){setResults(data);setSelected(0)}
    }).catch(e=>live&&setError(e.message));
    return()=>{live=false};
  },[q]);

  const summary=useMemo(()=>{
    const itemCount=items.length;
    const totalQuantity=items.reduce((s,i)=>s+Number(i.quantity||0),0);
    const subtotal=items.reduce((s,i)=>s+(Number(i.sellingPrice||0)*Number(i.quantity||0)-Number(i.discount||0)),0);
    const disc=discountType==="PERCENTAGE"?subtotal*Math.min(Number(discountValue||0),100)/100:Number(discountValue||0);
    const discountAmount=Math.min(Math.max(disc,0),subtotal);
    const beforeRound=subtotal-discountAmount+Number(gst||0);
    const grandTotal=Math.round(beforeRound);
    const roundOff=grandTotal-beforeRound;
    return {itemCount,totalQuantity,subtotal,discountAmount,gst:Number(gst||0),roundOff,grandTotal};
  },[items,discountType,discountValue,gst]);

  function focusSearch(){
    requestAnimationFrame(()=>searchRef.current?.focus());
  }

  useEffect(()=>{
    if(!quantityProduct)return;
    requestAnimationFrame(()=>{
      quantityInputRef.current?.focus();
      quantityInputRef.current?.select();
    });
  },[quantityProduct]);

  function openQuantityPopup(product){
    if(!product)return;
    const productId=Number(product.id);
    if(!Number.isInteger(productId)||productId<=0){
      setError("Unable to add this product because its database ID is invalid.");
      return;
    }
    setError("");
    setQuantity("1");
    setQuantityProduct(product);
    setResults([]);
  }

  function closeQuantityPopup(){
    setQuantityProduct(null);
    setQuantity("1");
    focusSearch();
  }

  function addProductToBill(){
    if(!quantityProduct)return;
    const parsed=Number(quantity);
    if(!/^\d+$/.test(String(quantity).trim())||!Number.isSafeInteger(parsed)||parsed<1){
      setError("Quantity must be a positive whole number.");
      quantityInputRef.current?.focus();
      return;
    }
    const product=quantityProduct;
    const productId=Number(product.id);
    const stock=Number.isFinite(Number(product.stock))?Number(product.stock):0;
    const sellingPrice=Number(product.retailPrice??product.sellingPrice);
    const existing=items.find(item=>item.productId===productId);
    if(stock>0&&(existing?.quantity||0)+parsed>stock){
      setError(`Only ${stock} items available in stock.`);
      quantityInputRef.current?.focus();
      return;
    }
    setError("");
    setItems(current=>{
      const existing=current.find(i=>i.productId===productId);
      const nextQuantity=(existing?.quantity||0)+parsed;
      if(existing)return [
        {...existing,quantity:nextQuantity},
        ...current.filter(i=>i.productId!==productId)
      ];
      return [{
        productId,
        sku:product.sku,
        name:product.name,
        category:product.category,
        stock,
        minStock:product.minimumStock,
        quantity:parsed,
        sellingPrice:Number.isFinite(sellingPrice)?sellingPrice:0,
        discount:0
      },...current];
    });
    setQuantityProduct(null);
    setQuantity("1");
    setQ("");
    focusSearch();
  }

  function updateItem(productId,patch){
    setItems(current=>current.map(item=>{
      if(item.productId!==productId)return item;
      const next={...item,...patch};
      next.quantity=Math.max(1,Number(next.quantity||1));
      next.sellingPrice=Math.max(0,Number(next.sellingPrice||0));
      next.discount=Math.max(0,Number(next.discount||0));
      if(item.stock>0&&next.quantity>item.stock){
        setError(`Only ${item.stock} items available in stock.`);
        next.quantity=item.stock;
      }
      if(next.discount>next.sellingPrice*next.quantity){
        next.discount=next.sellingPrice*next.quantity;
      }
      return next;
    }));
  }

  function removeItem(productId){
    setItems(current=>current.filter(item=>item.productId!==productId));
    focusSearch();
  }

  async function completeSaleImpl(){
    if(!items.length){setError("Add at least one product before completing sale.");return}
    setError("");
    try{
      const payload={
        customer:{...customer,name:customer.name.trim()},
        customerName:customer.name.trim()||null,
        items,
        discountType,
        discountValue:Number(discountValue||0),
        gst:Number(gst||0),
        paymentMethod
      };
      const signature=JSON.stringify(payload);
      if(submittedBill.current?.signature!==signature)submittedBill.current={signature,key:crypto.randomUUID()};
      const sale=await api("/admin/sales",{method:"POST",body:JSON.stringify({...payload,requestKey:submittedBill.current.key})});
      if(!sale?.id||!sale.invoiceNumber||!Array.isArray(sale.items))throw new Error("The server did not return the saved bill. Please retry.");
      submittedBill.current=null;
      setLastSale(sale);
      try{sessionStorage.setItem("sc-last-sale",String(sale.id))}catch{}
      setShowPreview(true);
      setQ("");setResults([]);
      setItems([]);
      setCustomer(emptyCustomer);
      setDiscountValue(0);
      setGst(0);
      setPaymentMethod("CASH");
      focusSearch();
    }catch(e){setError(e.message)}
  }

  async function holdBillImpl(){
    if(!items.length){setError("Cannot hold an empty bill.");return}
    const saved=await api("/admin/held-sales",{method:"POST",body:JSON.stringify({customer,items})});
    setHeld(h=>[saved,...h]);
    setItems([]);
    setCustomer(emptyCustomer);
    setError(`Hold Bill ${saved.referenceNumber} saved`);
    focusSearch();
  }

  async function loadHeldImpl(){
    const data=await api("/admin/held-sales");
    setHeld(data);
    setShowHeld(true);
  }

  async function resumeHeldImpl(bill){
    if(items.length)throw new Error("Hold or complete the current bill before resuming another.");
    await api(`/admin/held-sales/${bill.id}`,{method:"DELETE"});
    setCustomer(bill.customerData||emptyCustomer);
    setItems(bill.items||[]);
    setShowPreview(false);
    setShowHeld(false);
    focusSearch();
  }

  const completeSale=()=>run(completeSaleImpl);
  const holdBill=()=>run(holdBillImpl);
  const loadHeld=()=>run(loadHeldImpl);
  const resumeHeld=bill=>run(()=>resumeHeldImpl(bill));

  async function onSearchKey(e){
    if(e.key==="ArrowDown"){e.preventDefault();setSelected(i=>Math.min(i+1,results.length-1))}
    if(e.key==="ArrowUp"){e.preventDefault();setSelected(i=>Math.max(i-1,0))}
    if(e.key==="Enter"){
      e.preventDefault();
      const text=q.trim();
      if(!text)return;
      let product=results[selected];
      if(!product){
        try{
          const matches=await api(`/admin/products/search?q=${encodeURIComponent(text)}`);
          const needle=text.toLowerCase();
          product=matches.find(item=>[item.sku,item.barcode,item.name].some(value=>String(value||"").toLowerCase()===needle))||matches[0];
        }catch(error){
          setError(error.message);
          return;
        }
      }
      if(product)openQuantityPopup(product);
      else setError(`No product found for "${text}".`);
    }
  }

  useEffect(()=>{
    const handler=e=>{
      if(pending){if(["F4","F10"].includes(e.key))e.preventDefault();return}
      if(e.key==="F2"){e.preventDefault();focusSearch()}
      if(e.key==="F4"){e.preventDefault();holdBill()}
      if(e.key==="F6"){e.preventDefault();setShowCustomer(v=>!v)}
      if(e.key==="F8"){e.preventDefault();document.getElementById("bill-discount")?.focus()}
      if(e.key==="F9"){e.preventDefault();document.getElementById("payment-method")?.focus()}
      if(e.key==="F10"){e.preventDefault();completeSale()}
      if(e.ctrlKey&&e.key.toLowerCase()==="p"&&lastSale){e.preventDefault();window.print()}
      if(e.key==="Escape"){
        if(quantityProduct){closeQuantityPopup();return}
        setShowHeld(false);setError("")
      }
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  });

  return <fieldset className="pos-page action-container" disabled={pending} aria-busy={pending}>
      <div className="pos-toolbar no-print">
        <h1>Billing / POS</h1>
        <div className="pos-toolbar-actions">
          <div className="pos-request-notifications" ref={notificationRef}>
            <button type="button" className="btn ghost request-bell" aria-label="Pending customer requests" aria-expanded={showRequestNotifications} onClick={()=>{setShowRequestNotifications(value=>!value);loadPendingRequests()}}>
              <span aria-hidden="true">🔔</span>{pendingRequests.length>0&&<b className="badge">{pendingRequests.length}</b>}
            </button>
            {showRequestNotifications&&<div className="pos-request-popover">
              <div className="pos-request-popover-header"><b>Pending Customer Requests</b><span>{pendingRequests.length}</span></div>
              {!pendingRequests.length?<p className="empty">No new customer requests</p>:pendingRequests.map(request=><div className="pos-request-notification" key={request.id}>
                <button type="button" className="pos-request-summary" onClick={()=>setExpandedRequest(expandedRequest===request.id?null:request.id)}>
                  <span><b>{request.customerName||"Walk-in customer"}</b><small>{request.requestNumber} · {new Date(request.createdAt).toLocaleString()}</small></span>
                  <span><b>{request.items.length}</b><small>products</small></span>
                </button>
                {expandedRequest===request.id&&<div className="pos-request-details">
                  {request.items.map(item=><div className="pos-request-item" key={item.id}><b>{item.productNameSnapshot}</b><span>{item.quantity} {item.unit}</span><small>{item.productCode||"No code"}{item.category?` · ${item.category}`:""}</small></div>)}
                  {request.notes&&<p><b>Notes:</b> {request.notes}</p>}
                  <button type="button" className="btn ghost" onClick={()=>navigate(`/admin/incoming-customer-requests?requestId=${request.id}`)}>Open complete request</button>
                </div>}
              </div>)}
              <button type="button" className="btn ghost pos-request-view-all" onClick={()=>navigate("/admin/incoming-customer-requests")}>View Customer Requests</button>
            </div>}
          </div>
          <button className="btn ghost" onClick={loadHeld}>Hold Bills</button>
        </div>
      </div>
    <div className="pos-main no-print">
      <div className="search-box">
        <input ref={searchRef} className="pos-search" value={q} onChange={e=>{setQ(e.target.value);if(e.target.value.length)setShowPreview(false)}} onKeyDown={onSearchKey} placeholder="Search crackers by name, code or category..." />
        {results.length>0&&<div className="suggestions">{results.map((p,i)=>
          <button type="button" key={p.id} className={i===selected?"active":""} onClick={()=>openQuantityPopup(p)}>
            <b>{p.name}</b><span>{p.sku} - {p.category} - Stock {p.stock}</span><strong>Rs. {money(p.sellingPrice)}</strong>
          </button>
        )}</div>}
      </div>

      {lastSale&&showPreview&&<CompletedBillPreview sale={lastSale} onClose={()=>setShowPreview(false)}/>}

      {pending&&<p role="status">Processing, please wait...</p>}
      {actionError&&<div className="alert" role="alert">{actionError}</div>}
      {error&&<div className="alert" role="status">{error}</div>}

      {quantityProduct&&<div className="modal quantity-modal no-print" role="dialog" aria-modal="true" aria-labelledby="quantity-modal-title">
        <div className="modal-box quantity-modal-box">
          <div className="quantity-modal-header">
            <div><span className="quantity-modal-eyebrow">Add to bill</span><h2 id="quantity-modal-title">{quantityProduct.name}</h2></div>
            <button type="button" className="quantity-close" aria-label="Cancel quantity entry" onClick={closeQuantityPopup}>×</button>
          </div>
          <div className="quantity-product-meta"><span>Price</span><b>Rs. {money(quantityProduct.retailPrice??quantityProduct.sellingPrice)}</b></div>
          <label className="quantity-entry-label">Quantity
            <div className="quantity-entry">
              <button type="button" aria-label="Decrease quantity" onClick={()=>setQuantity(value=>String(Math.max(1,(Number(value)||1)-1)))}>-</button>
              <input ref={quantityInputRef} autoComplete="off" inputMode="numeric" pattern="[0-9]*" aria-label="Quantity" value={quantity} onChange={e=>setQuantity(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addProductToBill()}if(e.key==="Escape"){e.preventDefault();closeQuantityPopup()}}}/>
              <button type="button" aria-label="Increase quantity" onClick={()=>setQuantity(value=>String((Number(value)||1)+1))}>+</button>
            </div>
          </label>
          <div className="quantity-subtotal"><span>Subtotal</span><strong>Rs. {money((Number(quantityProduct.retailPrice??quantityProduct.sellingPrice)||0)*(Number(quantity)||0))}</strong></div>
          <div className="quantity-modal-actions"><button type="button" className="btn ghost" onClick={closeQuantityPopup}>Cancel</button><button type="button" className="btn complete" onClick={addProductToBill}>Add to Bill</button></div>
        </div>
      </div>}

      {showCustomer&&<div className="panel compact-form">
        <input className="input" placeholder="Customer Name" value={customer.name} onChange={e=>setCustomer({...customer,name:e.target.value})}/>
        <input className="input" placeholder="Mobile Number" value={customer.mobile} onChange={e=>setCustomer({...customer,mobile:e.target.value})}/>
        <input className="input" placeholder="Address" value={customer.address} onChange={e=>setCustomer({...customer,address:e.target.value})}/>
      </div>}

      <div className="table bill-table">
        <table>
          <thead><tr><th>S.No</th><th>Product</th><th>Qty</th><th>Rate</th><th>Discount</th><th>Amount</th><th>Remove</th></tr></thead>
          <tbody>
            {items.map((item,index)=>{
              const amount=item.quantity*item.sellingPrice-item.discount;
              return <tr key={item.productId}>
                <td>{index+1}</td>
                <td><b>{item.name}</b><small>Available: {item.stock} - After Sale: {item.stock-item.quantity}</small></td>
                <td><div className="qty"><button onClick={()=>updateItem(item.productId,{quantity:item.quantity-1})}>-</button><input value={item.quantity} onChange={e=>updateItem(item.productId,{quantity:e.target.value})}/><button onClick={()=>updateItem(item.productId,{quantity:item.quantity+1})}>+</button></div></td>
                <td><input className="cell-input" value={item.sellingPrice} onChange={e=>updateItem(item.productId,{sellingPrice:e.target.value})}/></td>
                <td><input className="cell-input" value={item.discount} onChange={e=>updateItem(item.productId,{discount:e.target.value})}/></td>
                <td><b>Rs. {money(amount)}</b></td>
                <td><button className="danger" onClick={()=>removeItem(item.productId)}>Remove</button></td>
              </tr>;
            })}
            {!items.length&&<tr><td colSpan="7" className="empty">Search and press Enter to add crackers.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>

    <section className="pos-billing-panel no-print" aria-label="Billing panel">
    <div className="pos-summary">
      <h2>Bill Summary</h2>
      <label>Customer Name<input className="input" placeholder="Customer name (optional)" value={customer.name} onChange={e=>setCustomer({...customer,name:e.target.value})}/></label>
      <div className="pos-counts"><div className="summary-line"><span>Items</span><b>{summary.itemCount}</b></div>
      <div className="summary-line"><span>Total Quantity</span><b>{summary.totalQuantity}</b></div>
      </div>
      <div className="summary-line"><span>Subtotal</span><b>Rs. {money(summary.subtotal)}</b></div>
      <div className="pos-adjustments">
      <label>Discount Type<select className="input" value={discountType} onChange={e=>setDiscountType(e.target.value)}><option value="FIXED">Fixed</option><option value="PERCENTAGE">Percentage</option></select></label>
      <label>Discount<input id="bill-discount" className="input" value={discountValue} onChange={e=>setDiscountValue(e.target.value)}/></label>
      <label>GST<input className="input" value={gst} onChange={e=>setGst(e.target.value)}/></label>
      </div>
      <div className="summary-line"><span>Discount</span><b>Rs. {money(summary.discountAmount)}</b></div>
      <div className="summary-line"><span>Round Off</span><b>Rs. {money(summary.roundOff)}</b></div>
      <div className="grand"><span>GRAND TOTAL</span><strong>Rs. {money(summary.grandTotal)}</strong></div>
      <label>Payment Method<select id="payment-method" className="input" value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option>CASH</option><option>UPI</option><option>CARD</option><option>CREDIT</option></select></label>
      <button className="btn complete" disabled={!items.length} onClick={completeSale}>COMPLETE SALE</button>
      <div className="pos-secondary-actions">
      <button className="btn ghost" disabled={!items.length} onClick={holdBill}>HOLD BILL</button>
      <button className="btn ghost" onClick={()=>lastSale&&window.print()} disabled={!lastSale}>PRINT BILL</button>
      </div>
      {lastSale&&<div className="last-sale">Last completed bill: <b>{lastSale.invoiceNumber}</b><button className="btn ghost" onClick={()=>{setQ("");setResults([]);setShowPreview(true);focusSearch()}}>View Last Bill</button></div>}
    </div>
    </section>

    {showHeld&&<div className="modal no-print"><div className="modal-box">
      <h2>Hold Bills</h2>
      {held.map(bill=><button className="held-row" key={bill.id} onClick={()=>resumeHeld(bill)}>
        <b>{bill.referenceNumber}</b><span>{(bill.items||[]).length} items - {new Date(bill.createdAt).toLocaleString()}</span>
      </button>)}
      {!held.length&&<p>No Hold Bills.</p>}
      <button className="btn ghost" onClick={()=>setShowHeld(false)}>Close</button>
    </div></div>}

    <BillPrint sale={lastSale}/>
  </fieldset>;
}
