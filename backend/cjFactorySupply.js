/**
 * Read-only CJ factory supply evidence for an EXACT product and variant.
 *
 * CJ getInventoryByPid returns variantInventories[] by VID. Factory stock is
 * different from CJ physical warehouse stock and must never be represented as
 * goods held by the merchant or as a reservation.
 * verifiedWarehouse=1 is CJ's documented verified inventory marker; 2 is
 * explicitly UNVERIFIED. Unknown or conflicting values fail closed.
 */
function units(value) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}
export function inspectCjFactorySupply(data, vidInput, originInput = "CN") {
  const vid=String(vidInput||"").trim(),origin=String(originInput||"CN").trim().toUpperCase();
  const unknown=(reason)=>({source:"cj_api",vid,origin,verified:false,available:false,
    quantity:null,mode:"factory",reason,notReserved:true});
  if (!vid || !/^[A-Z]{2}$/.test(origin) || !Array.isArray(data?.variantInventories))
    return unknown("INVALID_FACTORY_RESPONSE");
  const variants=data.variantInventories.filter(item=>String(item?.vid||"")===vid);
  if(variants.length!==1 || !Array.isArray(variants[0].inventory))
    return unknown("FACTORY_VARIANT_NOT_REPORTED");
  const matching=variants[0].inventory.filter(item=>String(item?.countryCode||"").toUpperCase()===origin);
  if(matching.length!==1)return unknown("FACTORY_ORIGIN_NOT_REPORTED");
  const record=matching[0];
  const factory=units(record.factoryInventory);
  if(factory===null)return unknown("FACTORY_INVENTORY_UNKNOWN");
  // 1 verified, 2 unverified; zero or unknown verification never becomes
  // available even if CJ reports a large factory quantity.
  if(Number(record.verifiedWarehouse)!==1)return {...unknown("FACTORY_NOT_VERIFIED"),reportedQuantity:factory};
  return {source:"cj_api",vid,origin,verified:true,available:factory>0,
    quantity:factory,mode:"factory",reason:factory===0?"FACTORY_OUT_OF_STOCK":null,
    notReserved:true};
}
