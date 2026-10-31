import { isCarrierEligibleProduct } from "./catalogShippingRules.js";
/**
 * Computes a conservative one-box quote for own permitted merchandise.
 * Live plants, external fulfillment, perishables and restricted goods are
 * excluded. Missing size/weight => no quote, never an invented price.
 * Dimensions for multiple goods assume a line of individually packed items.
 */
const finite = x => Number.isFinite(x) && x > 0;
/**
 * Use the category actually hydrated by Neon Commerce Core. Products that
 * include live plants remain excluded even when catalogued with 3D pots.
 */
export function is3DShippingProduct(product) {
  if (!product || product.type === "plant" || product.type === "service") return false;
  const category=String(product.category||"").toLowerCase();
  const collection=String(product.collection||"").toLowerCase();
  const collections=Array.isArray(product.collections)?product.collections.map(x=>String(x).toLowerCase()):[];
  const is3D=/^(?:macetas|jarrones|decoracion|figuras|organizacion|cocina-hogar|creaciones)-3d$/.test(category) ||
    collection==="creaciones-3d" || collections.includes("creaciones-3d");
  if (!is3D) return false;
  if (product.metadata?.containsLivePlant===true || product.metadata?.isLivePlant===true ||
    product.metadata?.plantIncluded===true || product.containsLivePlant===true) return false;
  // Safety-first: false negatives for decorative items bearing plant names are
  // preferable to exposing live plants to Sendcloud services.
  const name=String(product.name||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  if (/\b(planta|plantas|planta viva|cactus|suculenta|orquidea|arbol|flores? naturales?)\b/.test(name)) return false;
  return true;
}
export function verified3DParcel({items,catalog,settings}) {
  const config=settings?.sendcloud || {};
  if(config.checkoutEnabled!==true)return null;
  const fromZip=String(config.originPostalCode||"");
  if(!/^\d{5}$/.test(fromZip)||!Array.isArray(items)||items.length<1||items.length>12)return null;
  const byId=new Map((catalog||[]).map(p=>[String(p.id),p]));
  let totalWeight=0,totalLength=0,maxWidth=0,maxHeight=0,units=0;
  for(const line of items) {
    const qty=Number(line.quantity);
    if(!Number.isSafeInteger(qty)||qty<1||qty>10)return null;
    units+=qty;
    const product=byId.get(String(line.id));
    if(!product||product.active===false||product.deletedAt||!isCarrierEligibleProduct(product))return null;
    const raw=String(product.metadata?.dimensions||product.dimensions||"").replace(/,/g,".");
    const parts=raw.match(/\d+(?:\.\d+)?/g)||[];
    if(parts.length!==3)return null;
    const dims=parts.map(Number);
    if(!dims.every(n=>Number.isFinite(n)&&n>=1&&n<=120))return null;
    const rawWeight=String(product.metadata?.weight||product.weight||"").trim().replace(",",".");
    const match=rawWeight.match(/^(\d+(?:\.\d+)?)\s*(kg|g)$/i);
    if(!match)return null;
    const weight=Number(match[1])*(match[2].toLowerCase()==="g"?0.001:1);
    if(!Number.isFinite(weight)||weight<0.01)return null;
    totalLength+=dims[0]*qty;
    maxWidth=Math.max(maxWidth,dims[1]);
    maxHeight=Math.max(maxHeight,dims[2]);
    totalWeight+=weight*qty;
  }
  if(units>12)return null;
  // Additional packaging allowance for grouped parcels; merchants must
  // validate real box dimensions before enabling shipping for a product.
  const padding=units>1?2:0;
  const parcel={
    length:Math.ceil(totalLength+padding),
    width:Math.ceil(maxWidth+padding),
    height:Math.ceil(maxHeight+padding),
    weight:Number((totalWeight+(units>1?0.2:0)).toFixed(3)),
  };
  if([parcel.length,parcel.width,parcel.height].some(n=>n>120)||parcel.weight>40)return null;
  return {fromZip,parcel,units,packaging:"single_box"};
}
export function offeredShippingOption(quotes,choice){
  if(!choice||choice.method!=="sendcloud"||typeof choice.optionCode!=="string") return null;
  return (quotes||[]).find(x=>x.code===choice.optionCode && typeof x.price==="number"
    && Number.isFinite(x.price) && x.price>=0 && x.currency==="EUR")||null;
}
