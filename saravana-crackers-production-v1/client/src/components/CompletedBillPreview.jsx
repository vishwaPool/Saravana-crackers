const money=value=>Number(value||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});

export default function CompletedBillPreview({sale,onClose}) {
  const date=new Date(sale.createdAt);
  return <section className="bill-preview" aria-label={`Completed bill ${sale.invoiceNumber}`}>
    <header className="completed-header">
      <h2>SARAVANA CRACKERS</h2><p>By Ravi Agro Service</p>
      <span className="completed-badge" role="status">✓ Sale Completed</span>
    </header>
    <div className="completed-info">
      <span>Bill No: <b>{sale.invoiceNumber}</b></span>
      <span>Date: {date.toLocaleDateString("en-IN")}</span>
      <span>Time: {date.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true})}</span>
      <span>Payment: <b>{sale.paymentMethod}</b></span>
      {(sale.customerName||sale.customer?.name)&&<span>Customer: {sale.customerName||sale.customer.name}</span>}
    </div>
    <table className="completed-products">
      <thead><tr><th>Product</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
      <tbody>{sale.items.map((item,index)=><tr key={item.id||index}>
        <td>{item.productNameSnapshot}{Number(item.discount)>0&&<small>Item discount: ₹{money(item.discount)}</small>}</td>
        <td>{item.quantity}</td><td>₹{money(item.sellingPrice)}</td><td>₹{money(item.total)}</td>
      </tr>)}</tbody>
    </table>
    <div className="completed-totals">
      <div className="print-line"><span>Subtotal</span><b>₹{money(sale.subtotal)}</b></div>
      <div className="print-line"><span>Bill discount</span><b>₹{money(sale.discountAmount)}</b></div>
      <div className="print-line"><span>GST</span><b>₹{money(sale.gst)}</b></div>
      <div className="print-line"><span>Round off</span><b>₹{money(sale.roundOff)}</b></div>
      <div className="print-total"><span>GRAND TOTAL</span><b>₹{money(sale.grandTotal)}</b></div>
    </div>
    <div className="pos-secondary-actions"><button className="btn completed-print" onClick={()=>window.print()}>PRINT BILL</button><button className="btn ghost" onClick={onClose}>Close Preview</button></div>
  </section>;
}
