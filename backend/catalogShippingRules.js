/**
 * Rules shared by every public checkout and the server-side payment validator.
 * No carrier is ever assumed to accept live plants: merchant-managed plant
 * shipping is OFF until the merchant confirms a suitable delivery arrangement.
 */
const canon = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const validZip = z => /^\d{5}$/.test(String(z||"").trim());
export const isSupplierFulfilled = item => {
  const attrs = [item?.supplier, item?.supplierType, item?.supplierSource,
    item?.provider, item?.fulfillmentProvider, item?.metadata?.provider,
    item?.metadata?.supplier, item?.metadata?.supplierType,
    item?.metadata?.fulfillmentProvider, item?.metadata?.publishDestination,
  ].filter(Boolean).map(canon).join(" ");
  return /cj|aliexpress|printful|dropship|external|supplier/.test(attrs);
};
export function isLivePlant(item={}) {
  const m=item.metadata||{};
  if(item.type==="plant" || m.containsLivePlant===true || m.isLivePlant===true ||
    m.plantIncluded===true || item.containsLivePlant===true)return true;
  const cat=canon(item.category),coll=canon(item.collection);
  const joined=Array.isArray(item.collections)?item.collections.map(canon):[];
  if(/^(plantas?|cactus|suculentas|orquideas?|arboles)(?:-|$)/.test(cat) ||
    coll==="plantas" || joined.includes("plantas"))return true;
  const name=canon(item.name);
  // Decorated plant+pot products may be catalogued as decoration or 3D.
  return /\b(planta|plantas|cactus|suculenta|orquidea|bonsai)\b/.test(name) &&
    !/^(maceta|jarron|soporte|porta|cortador|molde|figura|camiseta)\b/.test(name);
}
export const isService = p => p?.type==="service" || p?.serviceBooking===true ||
  canon(p?.category)==="servicios" || canon(p?.collection)==="servicios";
export function isCarrierEligibleProduct(p) {
  if(!p || isService(p) || isLivePlant(p) || isSupplierFulfilled(p))return false;
  const cat=canon(p.category),collection=canon(p.collection),m=p.metadata||{};
  if(m.shippingProhibited===true || m.requiresRefrigeration===true ||
    p.requiresRefrigeration===true)return false;
  if(/insecticid|fungicid|fitosanit|pesticid|acaricid|fertilizant|quimic|producto-perecedero/.test(cat+" "+collection))return false;
  return true;
}
export function cartShippingGroup({lines=[],catalog=[]}={}) {
  if(!Array.isArray(lines)||lines.length===0||lines.length>40)return null;
  const map=new Map((catalog||[]).map(p=>[String(p.id),p]));
  let plants=0,goods=0,total=0;
  for(const line of lines){
    const qty=Number(line.quantity);
    if(!Number.isSafeInteger(qty)||qty<=0||qty>100)return null;
    const product=map.get(String(line.id));
    if(!product||product.deletedAt||product.active===false||
      isService(product)||isSupplierFulfilled(product))return null;
    if(isLivePlant(product)) plants+=qty;
    else goods+=qty;
    total+=qty;
  }
  if(total>100)return null;
  return {group:plants&&goods?"mixed":plants?"plants":"goods",plants,goods,total};
}
export function merchantShippingQuote({settings,lines,catalog,toZip}){
  const cfg=settings?.manualDelivery||{};
  if(cfg.enabled!==true || !validZip(toZip))return null;
  // Peninsular Spain only. Balearic Islands, Canary Islands, Ceuta/Melilla
  // require a separate eligible rate/plant transit agreement.
  const prefix=Number(String(toZip).slice(0,2));
  if(prefix<1||prefix>50||[7,35,38].includes(prefix))return null;
  const cart=cartShippingGroup({lines,catalog});
  if(!cart)return null;
  if(cart.plants>0&&cfg.acceptsLivePlants!==true)return null;
  const carrierName=String(cfg.carrierName||"").trim();
  if(carrierName.length<2||carrierName.length>100)return null;
  const rate=Number(cfg.rates?.[cart.group]);
  if(!Number.isFinite(rate)||rate<0||rate>250)return null;
  const label=cart.group==="plants"?"Envío de plantas":
    cart.group==="mixed"?"Envío combinado de plantas y artículos":"Envío de artículos";
  return {method:"manual_shipping",service:cart.group,label,
    carrier:carrierName,price:Math.round(rate*100)/100,currency:"EUR",
    requiresMerchantBooking:true};
}
