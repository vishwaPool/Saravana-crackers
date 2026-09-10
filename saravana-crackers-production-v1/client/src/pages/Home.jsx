import {useEffect,useState} from "react";
import {Link} from "react-router-dom";
import bannerImage from "../assets/banner.svg";
import {api} from "../api";
import ProductCard from "../components/ProductCard";

export default function Home(){
  const [p,setP]=useState([]);
  const [c,setC]=useState([]);
  const [o,setO]=useState([]);
  const [s,setS]=useState({});

  useEffect(()=>{
    Promise.all([api("/products"),api("/categories"),api("/offers"),api("/settings")])
      .then(([a,b,d,e])=>{setP(a);setC(b);setO(d);setS(e)});
  },[]);

  return <>
    <section className="hero">
      <div className="container">
        <img src={bannerImage} alt="Saravana Crackers"/>
      </div>
    </section>

    {o.length>0&&<section className="section">
      <div className="container">
        <h2>Offers</h2>
        <div className="cards">{o.map(x=><div className="card" key={x.id}><b>{x.title}</b><p>{x.description}</p></div>)}</div>
      </div>
    </section>}

    <section className="section soft">
      <div className="container">
        <h2>Categories</h2>
        <div className="cats">{c.map(x=><Link className="cat" key={x.id} to={`/products/${x.slug}`}><b>{x.name}</b></Link>)}</div>
      </div>
    </section>

    <section className="section">
      <div className="container">
        <h2>Featured Products</h2>
        <div className="products">{p.filter(x=>x.featured).map(x=><ProductCard key={x.id} p={x}/>)}</div>
      </div>
    </section>
  </>;
}
