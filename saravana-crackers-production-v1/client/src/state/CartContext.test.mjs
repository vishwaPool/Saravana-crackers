import test from "node:test";
import assert from "node:assert/strict";
import {build} from "esbuild";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";

// Exercise the real provider and product component with React's server renderer.
// This catches the missing context API that broke Add, quantity and checkout.
async function renderCart() {
  const output=await build({
    stdin:{contents:`
      import React from "react";
      import {renderToStaticMarkup} from "react-dom/server";
      import {CartProvider,useCart} from "./CartContext.jsx";
      import ProductCard from "../components/ProductCard.jsx";
      let cart;
      function Probe(){cart=useCart();return null;}
      const html=renderToStaticMarkup(<CartProvider><Probe/><ProductCard p={{id:1,name:"Sparkler",stock:0,retailPrice:10,mrp:20}}/></CartProvider>);
      export {cart,html};
    `,resolveDir:fileURLToPath(new URL(".",import.meta.url)),loader:"jsx"},
    bundle:true,write:false,platform:"node",format:"cjs",packages:"external",jsx:"automatic",loader:{".png":"dataurl"}
  });
  const result={exports:{}};
  new Function("require","module","exports",output.outputFiles[0].text)(createRequire(import.meta.url),result,result.exports);
  return result.exports;
}
test("cart exposes the functions consumed by storefront, quantity controls and checkout",async()=>{
  const {cart}=await renderCart();
  for(const key of ["add","qty","clear","addItem","updateQuantity","removeItem","clearCart"]) assert.equal(typeof cart[key],"function",`${key} must be callable`);
  assert.equal(cart.add,cart.addItem);
  assert.equal(cart.qty,cart.updateQuantity);
  assert.equal(cart.clear,cart.clearCart);
  assert.equal(cart.count,0);
  assert.equal(cart.total,0);
  assert.deepEqual(cart.items,[]);
});
test("out-of-stock product cannot be added",async()=>{
  const {html}=await renderCart();
  assert.match(html,/<button[^>]*disabled/);
  assert.match(html,/Out of Stock/);
});
