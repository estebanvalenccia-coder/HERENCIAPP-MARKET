/**
 * Conservative Sendcloud checkout eligibility. Only a single merchant-made 3D
 * item with explicit parcel dimensions can be quoted. Never plants or suppliers.
 * The caller MUST reload product data from the DB and must not trust cart fields.
 */
const finite = x => Number.isFinite(x) && x > 0;
export function verified3DParcel({items,catalog,settings}) {
  const config=settings?.sendcloud || {};
  if (config.checkoutEnabled !== true) return null;
  const originZip=String(config.originPostalCode||"");
  if (!/^\d{5}$/.test(originZip)) return null;
  if (!Array.isArray(items)||items.length!==1||Number(items[0]?.quantity)!==1) return null;
  const product=(catalog||[]).find(x=>String(x.id)===String(items[0].id));
  if (!product||product.active===false||product.deletedAt) return null;
  if (String(product.collection||"").toLowerCase()!=="creaciones-3d") return null;
  if (product.metadata?.provider||product.supplier||product.supplierType||product.fulfillmentProvider||
      product.metadata?.supplier || product.metadata?.fulfillmentProvider) return null;
  const raw=String(product.metadata?.dimensions||"").replace(/,/g,".");
  const parts=raw.match(/\d+(?:\.\d+)?/g)||[];
  if(parts.length!==3) return null;
  const numbers=parts.map(Number);
  if(!numbers.every(x=>finite(x)&&x<=120))return null;
  const weightRaw=String(product.metadata?.weight||"").trim().replace(",",".");
  const weightMatch=weightRaw.match(/^(\d+(?:\.\d+)?)\s*(kg|g)$/i);
  if(!weightMatch)return null;
  const kilograms=Number(weightMatch[1])*(weightMatch[2].toLowerCase()==="g"?.001:1);
  if(!finite(kilograms)||kilograms>40)return null;
  return {fromZip:originZip,parcel:{length:Math.ceil(numbers[0]),width:Math.ceil(numbers[1]),
    height:Math.ceil(numbers[2]),weight:Number(kilograms.toFixed(3))}};
}
export function offeredShippingOption(quotes,choice){
  if(!choice||choice.method!=="sendcloud"||typeof choice.optionCode!=="string") return null;
  return (quotes||[]).find(x=>x.code===choice.optionCode && typeof x.price==="number"
    && Number.isFinite(x.price) && x.price>=0 && x.currency==="EUR")||null;
}
