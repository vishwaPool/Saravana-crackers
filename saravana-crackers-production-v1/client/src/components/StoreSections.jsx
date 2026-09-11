import {Link} from "react-router-dom";
import {categoryImage} from "../assets/categoryImages";
import combo from "../assets/offers/offer-combo.webp.png";
import festival from "../assets/offers/offer-festival.webp.png";
import flat from "../assets/offers/offer-flat-discount.webp.png";
import StoreImage from "./StoreImage";
import StoreIcon from "./StoreIcon";
export const money = value => `₹${Number(value).toLocaleString("en-IN")}`;
export function SectionHeader({title, subtitle, children}) {
  return <div className="store-section-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{children}</div>;
}
export function CategoryCards({categories, products}) {
  return <div className="category-grid">{categories.map(category => <Link className="category-card" key={category.id} to={`/products/${encodeURIComponent(category.slug)}`}><StoreImage className="category-image" src={categoryImage(category, products)} alt={category.name}/><span>{category.name}</span></Link>)}</div>;
}
export function OfferCards({offers, categories}) {
  const comboCategory = categories.find(category => /combo/i.test(category.name));
  return <div className="offer-grid">{offers.map(offer => {
    const isCombo = /combo/i.test(offer.title);
    // These supplied assets have baked-in claims. Only use them with matching API rules.
    const image = isCombo ? combo : offer.type === "PERCENTAGE" && Number(offer.value) === 10 && !Number(offer.minOrder) ? festival : offer.type === "FIXED" && Number(offer.value) === 100 && Number(offer.minOrder) === 1000 ? flat : null;
    return <article className={`offer-card ${isCombo ? "combo-offer" : ""}`} key={offer.id}>
      <div className="offer-copy"><span className="eyebrow">{isCombo ? "Celebration favourites" : "Festival special"}</span><h3>{offer.title}</h3><strong>{offer.type === "PERCENTAGE" ? `${Number(offer.value)}%` : money(offer.value)} OFF</strong><p>{Number(offer.minOrder) > 0 ? `On orders of ${money(offer.minOrder)} or more` : "On all orders"}</p><Link to={isCombo && comboCategory ? `/products/${encodeURIComponent(comboCategory.slug)}` : "/products"}>{isCombo ? "Shop Combos" : "Shop Now"} <span aria-hidden="true">→</span></Link></div>
      {image ? <StoreImage src={image} alt=""/> : <div className="offer-symbol"><StoreIcon name="gift" width="76" height="76"/></div>}
    </article>;
  })}</div>;
}
export function Benefits() {
  return <section className="store-benefits container" aria-label="Why shop with us">{[["cart", "Fast & Easy Orders", "Hassle-free shopping"], ["shield", "Quality Assured", "Trusted products"], ["gift", "Best Prices", "Great festival offers"], ["support", "Local Support", "We're here to help"]].map(([icon, title, copy]) => <div key={title}><StoreIcon name={icon}/><div><strong>{title}</strong><p>{copy}</p></div></div>)}</section>;
}
