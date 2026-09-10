import product5000Wala from "./product-5000-wala.png";
import productLakshmi4 from "./product-lakshmi-4.png";
import productLakshmi3Half from "./product-lakshmi-3-half.png";
import productLakshmi3HalfAlt from "./product-lakshmi-3-half-alt.png";

const fallbackProductImages=[
  product5000Wala,
  productLakshmi4,
  productLakshmi3Half,
  productLakshmi3HalfAlt
];

function stableIndex(value){
  const text=String(value||"product");
  let hash=0;
  for(let i=0;i<text.length;i+=1)hash=(hash*31+text.charCodeAt(i))>>>0;
  return hash%fallbackProductImages.length;
}

export function productImage(product){
  if(product?.imageUrl)return product.imageUrl;
  return fallbackProductImages[stableIndex(product?.id||product?.sku||product?.name)];
}
