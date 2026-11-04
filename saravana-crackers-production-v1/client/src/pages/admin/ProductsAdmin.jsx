import AsyncButton from "../../components/AsyncButton";
import ActionForm from "../../components/ActionForm";
import {useEffect,useState} from "react";
import {api} from "../../api";

const blank={sku:"",barcode:"",name:"",purchasePrice:"",mrp:"",retailPrice:"",wholesalePrice:"",stock:"",minStock:"",unit:"1 Box",brand:"",description:"",imageUrl:"",featured:false,active:true};
const configuredApiUrl=import.meta.env.VITE_API_URL||"http://localhost:4000";
const base=configuredApiUrl.replace(/\/$/,"").endsWith("/api")?configuredApiUrl.replace(/\/$/,""):`${configuredApiUrl.replace(/\/$/,"")}/api`;

export default function ProductsAdmin(){const[loadError,setLoadError]=useState("");
  const [products,setProducts]=useState([]);
  const [form,setForm]=useState(blank);
  const [id,setId]=useState(null);
  const [csv,setCsv]=useState("");
  const [preview,setPreview]=useState(null);
  const [message,setMessage]=useState("");
  const [categoryMappings,setCategoryMappings]=useState("");
  const [defaultMinimumStock,setDefaultMinimumStock]=useState("5");

  const load=()=>api("/admin/products").then(setProducts).catch(e=>setLoadError(e.message));
  useEffect(()=>{load()},[]);
  const set=(k,v)=>setForm(x=>({...x,[k]:v}));

  function chooseFile(e){
    const file=e.target.files?.[0];
    if(!file)return;
    if(!file.name.toLowerCase().endsWith(".csv")){
      setMessage("CSV files only. XLSX files are not supported by this importer.");
      e.target.value="";
      return;
    }
    const reader=new FileReader();
    reader.onload=()=>{setCsv(String(reader.result||""));setPreview(null)};
    reader.onerror=()=>setMessage("Unable to read the selected CSV file.");
    reader.readAsText(file);
  }

  async function exportStock(){
    const response=await fetch(`${base}/admin/export/stock`,{credentials:"include"});
    if(!response.ok){
      const data=await response.json().catch(()=>({}));
      throw new Error(data.error||"Unable to export stock CSV.");
    }
    const blob=await response.blob();
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");
    link.href=url;
    link.download="saravana-crackers-stock.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

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
    setForm({...blank,...product,barcode:product.barcode||""});
  }

  async function previewImport(){
    if(!csv.trim())throw new Error("Paste product CSV before previewing.");
    setPreview(await api("/admin/products/import",{method:"POST",body:JSON.stringify({csv,preview:true,categoryMappings,defaultMinimumStock})}));
  }

  async function runImport(){
    const result=await api("/admin/products/import",{method:"POST",body:JSON.stringify({csv,preview:false,categoryMappings,defaultMinimumStock})});
    setMessage(`Imported ${result.imported} products. Skipped duplicates: ${result.skipped||0}.`);
    setCsv("");
    setPreview(null);
    load();
  }

  return <>
    <h1>Products</h1>{loadError&&<div className="alert" role="alert">Unable to load data: {loadError} <button type="button" onClick={()=>window.location.reload()}>Retry</button></div>}
    <ActionForm className="panel form" onSubmit={save}>
      <div className="grid">
        {["sku","barcode","name","brand","purchasePrice","mrp","retailPrice","wholesalePrice","stock","minStock","unit","imageUrl"].map(k=><label key={k}>{k}<input required={["name","retailPrice","stock"].includes(k)} type={["purchasePrice","mrp","retailPrice","wholesalePrice","stock","minStock"].includes(k)?"number":"text"} min="0" step={["stock","minStock"].includes(k)?"1":"any"} className="input" value={form[k]??""} onChange={e=>set(k,e.target.value)} /></label>)}
        <label><input type="checkbox" checked={form.featured} onChange={e=>set("featured",e.target.checked)}/> Featured</label>
        <label><input type="checkbox" checked={form.active} onChange={e=>set("active",e.target.checked)}/> Active</label>
      </div>
      <button className="btn">{id?"Update":"Add"} Product</button>
    </ActionForm>

    <div className="panel form">
      <h2>Import Products CSV</h2>
      <input className="input" type="file" accept=".csv,text/csv" onChange={chooseFile}/>
      <label>Default minimum stock when CSV is blank<input className="input" type="number" min="0" step="1" value={defaultMinimumStock} onChange={e=>{setDefaultMinimumStock(e.target.value);setPreview(null)}}/></label>
      <label>Category mappings (one per line: <code>Product Name|Category</code>)<textarea className="input" value={categoryMappings} onChange={e=>{setCategoryMappings(e.target.value);setPreview(null)}} placeholder={'Example Product|Sparklers'}/></label>
      <textarea className="input csv-box" value={csv} onChange={e=>{setCsv(e.target.value);setPreview(null)}} placeholder="ProductCode,ProductName,Category,Brand,PurchasePrice,SellingPrice,MRP,OpeningStock,MinimumStock,Barcode (only ProductName and SellingPrice are required; blank stock becomes 0)"/>
      <div className="row"><AsyncButton className="btn ghost" onClick={previewImport}>Preview Import</AsyncButton><AsyncButton className="btn" onClick={runImport} disabled={!preview||!preview.validProducts||preview.errors?.length}>Import Valid Products</AsyncButton><AsyncButton className="btn ghost" onClick={exportStock}>Export Stock CSV</AsyncButton></div>
      {preview&&<div className="alert">Detected: {preview.totalRows}. Valid: {preview.validProducts}. Duplicates: {preview.duplicateProducts||0}. Errors: {preview.invalidProducts||preview.errors.length}</div>}
      {preview?.errors?.length>0&&<div className="table"><table><thead><tr><th>Row</th><th>Product</th><th>Reason</th></tr></thead><tbody>{preview.errors.map(error=><tr key={`${error.line}-${error.productName}`}><td>{error.line}</td><td>{error.productName||"(blank)"}</td><td>{error.reason||error.error}</td></tr>)}</tbody></table></div>}
      {message&&<div className="alert">{message}</div>}
    </div>

    <div className="table">
      <table><thead><tr><th>Code</th><th>Barcode</th><th>Name</th><th>Category</th><th>Retail</th><th>Stock</th><th>Status</th><th></th></tr></thead><tbody>{products.map(x=><tr key={x.id}><td>{x.sku}</td><td>{x.barcode}</td><td>{x.name}</td><td>{x.category?.name}</td><td>Rs. {x.retailPrice}</td><td>{x.stock}</td><td>{x.active?"Active":"Inactive"}</td><td><button onClick={()=>edit(x)}>Edit</button></td></tr>)}</tbody></table>
    </div>
  </>;
}
