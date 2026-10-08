// Pure selector: the storefront must never invent products or declare random
// catalogue entries "easy care". Every card comes from the live product list.
export function normalizePlantName(text){
 return String(text??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}
export function selectEasyCareProducts(catalog,plantDrafts,limit=4){
 const reference=(Array.isArray(plantDrafts)?plantDrafts:[])
  .filter(d=>/^(muy\s+)?f[aá]cil$/i.test(String(d.difficulty||"").trim()))
  .flatMap(d=>[d.name,d.scientificName].map(normalizePlantName).filter(n=>n.length>=5));
 return (Array.isArray(catalog)?catalog:[]).filter(product=>{
  if(!product||product.active===false||product.deletedAt||["archived","draft"].includes(String(product.status||"").toLowerCase()))return false;
  const amount=Number(product.onSale&&product.salePrice?product.salePrice:product.price);
  if(!Number.isFinite(amount)||amount<=0||!String(product.image||product.imageUrl||"").trim())return false;
  if(product.trackInventory!==false&&!(Number(product.stock||0)>0||
    (Array.isArray(product.variants)&&product.variants.some(v=>Number(v?.stock||0)>0))))return false;
  const direct=String(product.difficulty||product.careDifficulty||product.careLevel||product?.metadata?.difficulty||"").trim();
  if(direct)return /^(muy\s+)?f[aá]cil$/i.test(direct);
  const name=normalizePlantName(product.name);
  const scientific=normalizePlantName(product.scientificName);
  return reference.some(ref=>name===ref||scientific===ref||
    (ref.length>8&&(name.includes(ref)||scientific.includes(ref))));
 }).slice(0,Math.max(0,Math.min(4,Number(limit)||4)));
}
