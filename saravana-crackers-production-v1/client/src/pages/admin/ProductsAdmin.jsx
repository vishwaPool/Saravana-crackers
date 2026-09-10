import AsyncButton from "../../components/AsyncButton";
import ActionForm from "../../components/ActionForm";
import {useEffect,useState} from "react";
import {api} from "../../api";

const blank={sku:"",barcode:"",name:"",categoryId:"",purchasePrice:0,mrp:0,retailPrice:0,wholesalePrice:0,stock:0,minStock:0,unit:"1 Box",brand:"",description:"",imageUrl:"",featured:false,active:true};
const base=import.meta.env.VITE_API_URL||"http://localhost:4000/api";

export default function ProductsAdmin(){const[loadError,setLoadError]=useState("");
  const [products,setProducts]=useState([]);
  const [categories,setCategories]=useState([]);
  const [form,setForm]=useState(blank);
  const [id,setId]=useState(null);
  const [csv,setCsv]=useState("");
  const [preview,setPreview]=useState(null);
  const [message,setMessage]=useState("");

  const load=()=>Promise.all([api("/admin/products"),api("/admin/categories")]).then(([a,b])=>{setProducts(a);setCategories(b)}).catch(e=>setLoadError(e.message));
  useEffect(()=>{load()},[]);
  const set=(k,v)=>setForm(x=>({...x,[k]:v}));

  async function save(e){
    e.preventDefault();
    await api(id?`/admin/products/${id}`:"/admin/products",{method:id?"PUT":"POST",body:JSON.stringify(form)});
    setForm(blank);
    setId(null);
    load();
  }

  function edit(product){
    setMessage("Editing " + product.name + ". Update the fields above and select Update Product.");
    window.scrollTo({top:0,behavior:"smooth"});
    setId(product.id);
    setForm({...blank,...product,categoryId:product.categoryId,barcode:product.barcode||""});
  }

  async function previewImport(){
    if(!csv.trim())throw new Error("Paste product CSV before previewing.");
    setPreview(await api("/admin/products/import",{method:"POST",body:JSON.stringify({csv,preview:true})}));
  }

  async function runImport(){
    const result=await api("/admin/products/import",{method:"POST",body:JSON.stringify({csv,preview:false})});
    setMessage(`Imported ${result.imported} products.`);
    setCsv("");
    setPreview(null);
    load();
  }

  return <>
    <h1>Products</h1>{loadError&&<div className="alert" role="alert">Unable to load data: {loadError} <button type="button" onClick={()=>window.location.reload()}>Retry</button></div>}
    <ActionForm className="panel form" onSubmit={save}>
      <div className="grid">
        {["sku","barcode","name","brand","purchasePrice","mrp","retailPrice","wholesalePrice","stock","minStock","unit","imageUrl"].map(k=><label key={k}>{k}<input required={["sku","name","purchasePrice","mrp","retailPrice","stock","minStock","unit"].includes(k)} type={["purchasePrice","mrp","retailPrice","wholesalePrice","stock","minStock"].includes(k)?"number":"text"} min="0" step={["stock","minStock"].includes(k)?"1":"any"} className="input" value={form[k]??""} onChange={e=>set(k,e.target.value)} /></label>)}
        <label>Category<select required className="input" value={form.categoryId} onChange={e=>set("categoryId",e.target.value)}><option value="">Select category</option>{categories.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label>
        <label><input type="checkbox" checked={form.featured} onChange={e=>set("featured",e.target.checked)}/> Featured</label>
        <label><input type="checkbox" checked={form.active} onChange={e=>set("active",e.target.checked)}/> Active</label>
      </div>
      <button className="btn">{id?"Update":"Add"} Product</button>
    </ActionForm>

    <div className="panel form">
      <h2>Import Products CSV</h2>
      <textarea className="input csv-box" value={csv} onChange={e=>{setCsv(e.target.value);setPreview(null)}} placeholder="ProductCode,ProductName,Category,Brand,PurchasePrice,SellingPrice,MRP,OpeningStock,MinimumStock,Barcode"/>
      <div className="row"><AsyncButton className="btn ghost" onClick={previewImport}>Preview Import</AsyncButton><AsyncButton className="btn" onClick={runImport} disabled={!preview||!preview.validProducts||preview.errors?.length}>Import Valid Products</AsyncButton><a className="btn ghost" href={`${base}/admin/export/stock`}>Export Stock CSV</a></div>
      {preview&&<div className="alert">Valid Products: {preview.validProducts}. Errors: {preview.errors.length}</div>}
      {message&&<div className="alert">{message}</div>}
    </div>

    <div className="table">
      <table><thead><tr><th>Code</th><th>Barcode</th><th>Name</th><th>Category</th><th>Retail</th><th>Stock</th><th>Status</th><th></th></tr></thead><tbody>{products.map(x=><tr key={x.id}><td>{x.sku}</td><td>{x.barcode}</td><td>{x.name}</td><td>{x.category?.name}</td><td>Rs. {x.retailPrice}</td><td>{x.stock}</td><td>{x.active?"Active":"Inactive"}</td><td><button onClick={()=>edit(x)}>Edit</button></td></tr>)}</tbody></table>
    </div>
  </>;
}
