import {useEffect, useState} from "react";
import {Link, useNavigate, useParams, useSearchParams} from "react-router-dom";
import {api} from "../api";
import ProductCard from "../components/ProductCard";
export default function Products() {
  const {category} = useParams(), navigate = useNavigate();
  const [params, setParams] = useSearchParams(), q = params.get("q") || "";
  const [products, setProducts] = useState([]), [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [categoryError, setCategoryError] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {let active = true; setCategoryError(false); api("/categories").then(value => {if (active) setCategories(value);}).catch(() => {if (active) setCategoryError(true);}); return () => {active = false;};}, [attempt]);
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    api(category ? `/products?category=${encodeURIComponent(category)}` : "/products").then(value => {if (active) setProducts(value);}).catch(err => {if (active) setError(err.message);}).finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
  }, [category, attempt]);
  const shown = products.filter(product => `${product.name} ${product.category?.name || ""} ${product.sku || ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  const title = categories.find(item => item.slug === category)?.name || (category ? category.replace(/-/g, " ") : "All Products");
  return <section className="store-section container store-catalogue"><p className="store-breadcrumb"><Link to="/">Home</Link> / {title}</p><div className="store-section-header"><div><h1>{title}</h1><p>Find your favourites. Make it a celebration.</p></div>{!loading && !error && <span>{shown.length} products</span>}</div>
    <div className="catalogue-filters"><label>Search products<input className="input" type="search" placeholder="Product name, category or SKU" value={q} onChange={event => {const next = new URLSearchParams(params); event.target.value ? next.set("q", event.target.value) : next.delete("q"); setParams(next, {replace: true});}}/></label><label>Category<select className="input" value={category || ""} onChange={event => navigate(`/products${event.target.value ? `/${encodeURIComponent(event.target.value)}` : ""}${q ? `?q=${encodeURIComponent(q)}` : ""}`)}><option value="">All categories</option>{category && !categories.some(item => item.slug === category) && <option value={category}>{title}</option>}{categories.map(item => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label><Link className="store-text-link" to="/products">Clear filters</Link></div>
    {categoryError && <p role="status">Category filters are unavailable. <button onClick={() => setAttempt(value => value + 1)}>Retry</button></p>}
    {loading ? <p className="store-state" role="status">Loading products…</p> : error ? <p className="store-state" role="alert">{error} <button onClick={() => setAttempt(value => value + 1)}>Try again</button></p> : shown.length ? <div className="products">{shown.map(product => <ProductCard key={product.id} p={product}/>)}</div> : <div className="store-state"><h2>No products found</h2><p>Try another search or category.</p><Link className="btn" to="/products">View All Products</Link></div>}
  </section>;
}
