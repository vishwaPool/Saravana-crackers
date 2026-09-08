import {useEffect,useMemo,useRef,useState} from "react";
import {api} from "../../api";

const money=n=>Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
const emptyCustomer={name:"",mobile:"",address:""};

function buildPrintDate(date){
  const d=date?new Date(date):new Date();
  return {
    date:d.toLocaleDateString("en-IN"),
    time:d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})
  };
}

export default function Billing(){
  const searchRef=useRef(null);
  const [q,setQ]=useState("");
  const [results,setResults]=useState([]);
  const [selected,setSelected]=useState(0);
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

  useEffect(()=>{searchRef.current?.focus()},[]);

  useEffect(()=>{
    let live=true;
    const text=q.trim();
    if(!text){setResults([]);return}
    api(`/admin/products/search?q=${encodeURIComponent(text)}`).then(data=>{
      if(live){setResults(data);setSelected(0)}
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

  function addProduct(product){
    if(!product)return;
    if(product.stock<=0){setError("OUT OF STOCK");focusSearch();return}
    setError("");
    setItems(current=>{
      const existing=current.find(i=>i.productId===product.id);
      if(existing){
        if(existing.quantity>=product.stock){
          setError(`Only ${product.stock} items available in stock.`);
          return current;
        }
        return current.map(i=>i.productId===product.id?{...i,quantity:i.quantity+1}:i);
      }
      return [...current,{
        productId:product.id,
        sku:product.sku,
        name:product.name,
        category:product.category,
        stock:product.stock,
        minStock:product.minimumStock,
        quantity:1,
        sellingPrice:product.sellingPrice,
        discount:0
      }];
    });
    setQ("");
    setResults([]);
    focusSearch();
  }

  function updateItem(productId,patch){
    setItems(current=>current.map(item=>{
      if(item.productId!==productId)return item;
      const next={...item,...patch};
      next.quantity=Math.max(1,Number(next.quantity||1));
      next.sellingPrice=Math.max(0,Number(next.sellingPrice||0));
      next.discount=Math.max(0,Number(next.discount||0));
      if(next.quantity>item.stock){
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

  async function completeSale(){
    if(!items.length){setError("Add at least one product before completing sale.");return}
    setError("");
    try{
      const sale=await api("/admin/sales",{method:"POST",body:JSON.stringify({
        requestKey:`pos-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        customer,
        items,
        discountType,
        discountValue:Number(discountValue||0),
        gst:Number(gst||0),
        paymentMethod
      })});
      setLastSale(sale);
      setItems([]);
      setCustomer(emptyCustomer);
      setDiscountValue(0);
      setGst(0);
      setPaymentMethod("CASH");
      focusSearch();
    }catch(e){setError(e.message)}
  }

  async function holdBill(){
    if(!items.length){setError("Cannot hold an empty bill.");return}
    const saved=await api("/admin/held-sales",{method:"POST",body:JSON.stringify({customer,items})});
    setHeld(h=>[saved,...h]);
    setItems([]);
    setCustomer(emptyCustomer);
    setError(`Held bill ${saved.referenceNumber}`);
    focusSearch();
  }

  async function loadHeld(){
    const data=await api("/admin/held-sales");
    setHeld(data);
    setShowHeld(true);
  }

  async function resumeHeld(bill){
    setCustomer(bill.customerData||emptyCustomer);
    setItems(bill.items||[]);
    await api(`/admin/held-sales/${bill.id}`,{method:"DELETE"});
    setShowHeld(false);
    focusSearch();
  }

  function onSearchKey(e){
    if(e.key==="ArrowDown"){e.preventDefault();setSelected(i=>Math.min(i+1,results.length-1))}
    if(e.key==="ArrowUp"){e.preventDefault();setSelected(i=>Math.max(i-1,0))}
    if(e.key==="Enter"){e.preventDefault();addProduct(results[selected])}
  }

  useEffect(()=>{
    const handler=e=>{
      if(e.key==="F2"){e.preventDefault();focusSearch()}
      if(e.key==="F4"){e.preventDefault();holdBill()}
      if(e.key==="F6"){e.preventDefault();setShowCustomer(v=>!v)}
      if(e.key==="F8"){e.preventDefault();document.getElementById("bill-discount")?.focus()}
      if(e.key==="F9"){e.preventDefault();document.getElementById("payment-method")?.focus()}
      if(e.key==="F10"){e.preventDefault();completeSale()}
      if(e.ctrlKey&&e.key.toLowerCase()==="p"&&lastSale){e.preventDefault();window.print()}
      if(e.key==="Escape"){setShowHeld(false);setError("")}
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  });

  const printable=lastSale;
  const printDate=buildPrintDate(printable?.createdAt);

  return <div className="pos-page">
    <div className="pos-main no-print">
      <div className="pos-toolbar">
        <div>
          <h1>Billing / POS</h1>
          <p>F2 Search · F4 Hold · F6 Customer · F8 Discount · F9 Payment · F10 Complete</p>
        </div>
        <button className="btn ghost" onClick={loadHeld}>Held Bills</button>
      </div>

      <div className="search-box">
        <input ref={searchRef} className="pos-search" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={onSearchKey} placeholder="Search crackers by name, code or category..." />
        {results.length>0&&<div className="suggestions">{results.map((p,i)=>
          <button key={p.id} className={i===selected?"active":""} onMouseDown={e=>{e.preventDefault();addProduct(p)}}>
            <b>{p.name}</b><span>{p.sku} · {p.category} · Stock {p.stock}</span><strong>Rs. {money(p.sellingPrice)}</strong>
          </button>
        )}</div>}
      </div>

      {error&&<div className="alert">{error}</div>}

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
                <td><b>{item.name}</b><small>Available: {item.stock} · After Sale: {item.stock-item.quantity}</small></td>
                <td><div className="qty"><button onClick={()=>updateItem(item.productId,{quantity:item.quantity-1})}>-</button><input value={item.quantity} onChange={e=>updateItem(item.productId,{quantity:e.target.value})}/><button onClick={()=>updateItem(item.productId,{quantity:item.quantity+1})}>+</button></div></td>
                <td><input className="cell-input" value={item.sellingPrice} onChange={e=>updateItem(item.productId,{sellingPrice:e.target.value})}/></td>
                <td><input className="cell-input" value={item.discount} onChange={e=>updateItem(item.productId,{discount:e.target.value})}/></td>
                <td><b>Rs. {money(amount)}</b></td>
                <td><button className="danger" onClick={()=>removeItem(item.productId)}>Remove</button></td>
              </tr>
            })}
            {!items.length&&<tr><td colSpan="7" className="empty">Search and press Enter to add crackers.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>

    <aside className="pos-summary no-print">
      <h2>Bill Summary</h2>
      <div className="summary-line"><span>Items</span><b>{summary.itemCount}</b></div>
      <div className="summary-line"><span>Total Quantity</span><b>{summary.totalQuantity}</b></div>
      <div className="summary-line"><span>Subtotal</span><b>Rs. {money(summary.subtotal)}</b></div>
      <label>Discount Type<select className="input" value={discountType} onChange={e=>setDiscountType(e.target.value)}><option value="FIXED">Fixed</option><option value="PERCENTAGE">Percentage</option></select></label>
      <label>Discount<input id="bill-discount" className="input" value={discountValue} onChange={e=>setDiscountValue(e.target.value)}/></label>
      <label>GST<input className="input" value={gst} onChange={e=>setGst(e.target.value)}/></label>
      <div className="summary-line"><span>Discount</span><b>Rs. {money(summary.discountAmount)}</b></div>
      <div className="summary-line"><span>Round Off</span><b>Rs. {money(summary.roundOff)}</b></div>
      <div className="grand"><span>GRAND TOTAL</span><strong>Rs. {money(summary.grandTotal)}</strong></div>
      <label>Payment Method<select id="payment-method" className="input" value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option>CASH</option><option>UPI</option><option>CARD</option><option>CREDIT</option></select></label>
      <button className="btn complete" onClick={completeSale}>COMPLETE SALE</button>
      <button className="btn ghost" onClick={holdBill}>HOLD BILL</button>
      <button className="btn ghost" onClick={()=>lastSale&&window.print()} disabled={!lastSale}>PRINT BILL</button>
      {lastSale&&<div className="last-sale">Completed: <b>{lastSale.invoiceNumber}</b></div>}
    </aside>

    {showHeld&&<div className="modal no-print"><div className="modal-box">
      <h2>Held Bills</h2>
      {held.map(bill=><button className="held-row" key={bill.id} onClick={()=>resumeHeld(bill)}>
        <b>{bill.referenceNumber}</b><span>{(bill.items||[]).length} items · {new Date(bill.createdAt).toLocaleString()}</span>
      </button>)}
      {!held.length&&<p>No held bills.</p>}
      <button className="btn ghost" onClick={()=>setShowHeld(false)}>Close</button>
    </div></div>}

    {printable&&<div className="print-area">
      <div className="invoice thermal">
        <h1>SARAVANAN CRACKERS</h1>
        <h2>By Ravi Agro Service</h2>
        <p>Tirukovilur Main Road<br/>Rishivandhiyam - 606205<br/>Mob: 9965936977</p>
        <hr/>
        <p>Bill No: {printable.invoiceNumber}<br/>Date: {printDate.date}<br/>Time: {printDate.time}</p>
        {printable.customer&&<p>Customer: {printable.customer.name}<br/>Mobile: {printable.customer.phone}</p>}
        <table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>{printable.items.map(item=><tr key={item.id}><td>{item.productNameSnapshot}</td><td>{item.quantity}</td><td>{money(item.sellingPrice)}</td><td>{money(item.total)}</td></tr>)}</tbody></table>
        <hr/>
        <div className="print-line"><span>Subtotal</span><b>Rs. {money(printable.subtotal)}</b></div>
        <div className="print-line"><span>Discount</span><b>Rs. {money(printable.discountAmount)}</b></div>
        <div className="print-line"><span>Round Off</span><b>Rs. {money(printable.roundOff)}</b></div>
        <div className="print-total"><span>GRAND TOTAL</span><b>Rs. {money(printable.grandTotal)}</b></div>
        <p>Payment: {printable.paymentMethod}</p>
        <h2>THANK YOU</h2>
        <h2>HAPPY DEEPAVALI</h2>
      </div>
    </div>}
  </div>
}
