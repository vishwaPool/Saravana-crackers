import {useEffect, useState} from "react";
import {Link, useLocation} from "react-router-dom";
import {api} from "../api";
import ProductCard from "../components/ProductCard";
import HeroCarousel from "../components/HeroCarousel";
import {Benefits, CategoryCards, OfferCards, SectionHeader} from "../components/StoreSections";

export default function Home() {
  const [data, setData] = useState({products: [], categories: [], offers: []});
  const [errors, setErrors] = useState({}), [loading, setLoading] = useState(true), [attempt, setAttempt] = useState(0);
  const [allOffers, setAllOffers] = useState(false);
  const location = useLocation();
  useEffect(() => {
    let active = true; setLoading(true); setErrors({});
    Promise.allSettled([api("/products"), api("/categories"), api("/offers")]).then(results => {
      if (!active) return;
      const next = {}, failures = {};
      ["products", "categories", "offers"].forEach((key, index) => {const result = results[index]; next[key] = result.status === "fulfilled" ? result.value : []; if (result.status === "rejected") failures[key] = true;});
      setData(next); setErrors(failures); setLoading(false);
    });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => {if (!loading && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();}, [loading, location.hash]);
  const state = (key, empty) => loading ? <p className="store-state" role="status">Loading {key}…</p> : errors[key] ? <p className="store-state" role="alert">Unable to load {key}. <button onClick={() => setAttempt(value => value + 1)}>Try again</button></p> : !data[key].length ? <p className="store-state">{empty}</p> : null;
  const popular = [...data.products].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured))).slice(0, 6);
  return <>
    <HeroCarousel/>
    <section id="offers" className="store-section container"><SectionHeader title="Special Offers" subtitle="Grab the best deals and make your celebrations bigger!"><button className="store-text-link" onClick={() => setAllOffers(value => !value)} aria-expanded={allOffers}>{allOffers ? "Show Featured Offers" : "View All Offers"} →</button></SectionHeader>{state("offers", "New festival offers are on their way. Explore the collection in the meantime.")}<OfferCards offers={allOffers ? data.offers : data.offers.slice(0, 3)} categories={data.categories}/></section>
    <section id="categories" className="store-section category-section"><div className="container"><SectionHeader title="Shop By Categories" subtitle="A little something for every celebration."><a className="store-text-link" href="#category-list">View All Categories →</a></SectionHeader>{state("categories", "Categories will be available soon.")}<div id="category-list"><CategoryCards categories={data.categories} products={data.products}/></div></div></section>
    <section className="store-section container"><SectionHeader title="Popular Products" subtitle="Explore our popular crackers this season."><Link className="store-text-link" to="/products">View All Products →</Link></SectionHeader>{state("products", "Our collection is being updated. Please check back soon.")}<div className="products">{popular.map(product => <ProductCard key={product.id} p={product}/>)}</div><div className="catalogue-cta"><Link className="btn" to="/products">Explore All Products <span aria-hidden="true">→</span></Link></div></section>
    <Benefits/>
  </>;
}
