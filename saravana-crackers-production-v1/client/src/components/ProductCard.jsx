import {productImage} from "../assets/productImages";
import {useCart} from "../state/CartContext";

export default function ProductCard({p}){
  const {addItem,items}=useCart();
  const quantity=items.find(item=>item.id===p.id)?.quantity||0;
  const stock=Number(p.stock);
  const price=Number(p.retailPrice);
  const mrp=Number(p.mrp);
  const off=mrp>price?Math.round((mrp-price)/mrp*100):0;

  return <article className="product">
    <div className="pic">
      <img src={productImage(p)} alt={p.name}/>
      {off>0&&<b>{off}% OFF</b>}
    </div>
    <div className="pad">
      <small>{p.category?.name}</small>
      <h3>{p.name}</h3>
      <p>{p.unit}</p>
      <div className="price">
        <strong>Rs. {price.toLocaleString("en-IN")}</strong>
        <del>Rs. {mrp.toLocaleString("en-IN")}</del>
      </div>
      <button disabled={!Number.isInteger(stock)||stock<=quantity} className="btn" onClick={()=>addItem(p)}>
        {stock<=0?"Out of Stock":quantity>=stock?"Stock limit reached":"Add to Cart"}
      </button>
      <p role="status" aria-live="polite">{quantity>0?`${quantity} in cart`:""}</p>
    </div>
  </article>;
}
