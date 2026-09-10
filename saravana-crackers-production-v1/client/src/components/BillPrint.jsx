import {createPortal} from "react-dom";
const money=value=>Number(value||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});

export function Invoice({sale}) {
  if(!sale)return null;
  const date=new Date(sale.createdAt);
  const customerName=String(sale.customerName||sale.customer?.name||"").trim();
  return <article className="invoice thermal" aria-label={`Invoice ${sale.invoiceNumber}`}>
    <h1>SARAVANAN CRACKERS</h1><h2>By Ravi Agro Service</h2>
    <p>Tirukovilur Main Road<br/>Rishivandhiyam - 606205<br/>Mob: 9965936977</p><hr/>
    <p>Bill No: <strong>{sale.invoiceNumber}</strong><br/>Date: {date.toLocaleDateString("en-IN")} {date.toLocaleTimeString("en-IN")}</p>
    {sale.status!=="COMPLETED"&&<h2>{sale.status}</h2>}
    {(customerName||sale.customer?.phone)&&<p>{customerName&&<>Customer: {customerName}<br/></>}{sale.customer?.phone&&<>Mobile: {sale.customer.phone}</>}</p>}
    <table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Discount</th><th>Amount</th></tr></thead><tbody>{sale.items.map(item=><tr key={item.id}><td>{item.productNameSnapshot}</td><td>{item.quantity}</td><td>{money(item.sellingPrice)}</td><td>{money(item.discount)}</td><td>{money(item.total)}</td></tr>)}</tbody></table>
    <div className="print-line"><span>Subtotal</span><b>Rs. {money(sale.subtotal)}</b></div>
    <div className="print-line"><span>Bill discount</span><b>Rs. {money(sale.discountAmount)}</b></div>
    <div className="print-line"><span>GST</span><b>Rs. {money(sale.gst)}</b></div>
    <div className="print-line"><span>Round off</span><b>Rs. {money(sale.roundOff)}</b></div>
    <div className="print-total"><span>GRAND TOTAL</span><b>Rs. {money(sale.grandTotal)}</b></div>
    <p>Payment: {sale.paymentMethod}</p><h2>THANK YOU</h2><h2>HAPPY DEEPAVALI</h2>
  </article>;
}

export default function BillPrint({sale}) {
  return sale?createPortal(<div className="receipt-print"><Invoice sale={sale}/></div>,document.body):null;
}
