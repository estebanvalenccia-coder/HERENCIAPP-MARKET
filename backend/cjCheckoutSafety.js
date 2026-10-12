// CJ-only checkout verification. All supplier requests are read-only. Never creates orders.
import { verifyCjVariantPrice, quoteCjVariantShipping, queryCjVariantStock, queryCjVariantWarehouses, queryCjFactorySupply } from "./cjCatalogImporter.js";
import { extractCjProductId } from "./cjProductIds.js";
import { estimateCjProfitability, getUsdToEurRate } from "./cjProfitability.js";
import { resolveCjPurchasedVariant, assertCjSupplierIdentity } from "./cjVariantIdentity.js";
import {assessCjDistanceSaleCompliance} from "./cjDistanceSaleCompliance.js";

function invalid(message) {
  const error = new Error(message);
  error.statusCode = 409;
  throw error;
}
function isCjProduct(product) {
  const meta = product?.metadata && typeof product.metadata === "object" ? product.metadata : {};
  let host = String(meta.sourceHost || "").toLowerCase().replace(/^www\./, "");
  if (!host && meta.sourceProductUrl) {
    try { host = new URL(meta.sourceProductUrl).hostname.toLowerCase().replace(/^www\./, ""); } catch {}
  }
  return host === "cjdropshipping.com" && String(meta.fulfillmentType || "").toLowerCase() === "dropship";
}
function countryCode(value) {
  const v=String(value || "").trim().toLowerCase();
  if (v==="es"||v==="españa"||v==="spain") return "ES";
  return v.toUpperCase();
}
export function canProceedWithVerifiedCjCosts({ profitability, promotionAuthorized = false, discount = 0 } = {}) {
  return Boolean(profitability?.available) &&
    (Boolean(profitability?.feasible) || (promotionAuthorized === true && Number(discount) > 0));
}

export async function evaluateCjCheckout({ lines, catalog, shippingAddress, discount = 0, promotionAuthorized = false, suppliers = [], deps = {} } = {}) {
  const byId = new Map((Array.isArray(catalog) ? catalog : []).map((p) => [String(p?.id || ""),p]));
  const items = Array.isArray(lines) ? lines : [];
  const cjItems = items.filter((item) => isCjProduct(byId.get(String(item?.id || ""))));
  if (!cjItems.length) return { cjOnly: false };
  if (cjItems.length !== items.length) invalid("Los productos de CJ y el reparto local de Herencia requieren pedidos separados por ahora.");
  if (cjItems.length !== 1 || Number(cjItems[0]?.quantity || 0) !== 1) {
    invalid("CJdropshipping requiere una unidad por pedido en esta fase de pruebas. Divide la compra para calcular el transporte correcto.");
  }
  if (countryCode(shippingAddress?.country) !== "ES") invalid("Este artículo de CJ solo tiene envío configurado a España.");
  if (!/^\d{5}$/.test(String(shippingAddress?.postalCode || "").trim())) invalid("Introduce un código postal español válido de 5 dígitos para el envío CJ.");
  const item = cjItems[0];
  const product = byId.get(String(item.id));
  const meta = product?.metadata && typeof product.metadata === "object" ? product.metadata : {};
  const supplier = suppliers.find((entry)=>String(entry.id)===String(meta.supplierId || ""));
  if (!supplier || supplier.active === false || supplier.integrationType !== "cj") invalid("La conexión del proveedor CJ no está disponible.");
  // A registered CJ API key is not proof of a production fulfillment account.
  // Never charge a customer while the mapped CJ supplier is still in Sandbox.
  if (supplier.cjSandbox !== false) invalid("Este artículo CJ no está disponible para la venta: el proveedor sigue en modo de pruebas (Sandbox). No se realizará ningún cobro.");
  const compliance=assessCjDistanceSaleCompliance(product);
  if(!compliance.ready) invalid("Este artículo CJ no tiene completos los datos de seguridad y aduanas para vender legalmente. " + compliance.blockers[0] + " No se realizará ningún cobro.");
  // Resolve from the server-side persisted variants, never the cart's VID/SKU.
  const identity = resolveCjPurchasedVariant(product, item.selectedVariant);
  const vid = identity.vid;
  const preferredLogisticName = String(meta.cjPreferredLogisticName || "").trim();
  // Parallel read-only lookups. No personal name, phone or street address goes to CJ.
  const pid = extractCjProductId(meta.sourceProductUrl);
  if (!pid) invalid("Falta el producto de origen CJ para verificar su variante.");
  // Diagnostic messages are deliberately generic: never leak supplier API payloads or credentials.
  const checks = await Promise.allSettled([
    (deps.verifyVariant || verifyCjVariantPrice)({ pid, vid }),
    (deps.quoteShipping || quoteCjVariantShipping)({vid, quantity:1, origin:"CN", destination:"ES",zip:String(shippingAddress.postalCode)}),
    (deps.getRate || getUsdToEurRate)(),
    (deps.getStock || queryCjVariantStock)({vid,origin:"CN"}),
  ]);
  const firstFailure = checks.findIndex((check) =>
    check.status === "rejected" && (checks.indexOf(check) === 0 || checks.indexOf(check) === 2));
  if (firstFailure !== -1) {
    const error = checks[firstFailure].reason;
    if (error?.code === "CJ_RATE_LIMITED" || error?.code === "CJ_QUOTA_EXHAUSTED") {
      const unavailable = new Error("CJ está limitando temporalmente la verificación de precio o divisa. No se realizará ningún cobro.");
      unavailable.code = error.code;
      unavailable.statusCode = 503;
      throw unavailable;
    }
    invalid(firstFailure === 0 ? "CJ no pudo verificar el VID/SKU y el precio actual. No se realizará ningún cobro." :
      "No se pudo verificar el cambio USD/EUR. No se realizará ningún cobro.");
  }
  const selectedVariant = checks[0].value;
  const fx = checks[2].value;
  if (!Number.isFinite(Number(fx?.rate)) || Number(fx.rate) <= 0)
    invalid("El cambio USD/EUR no es válido. No se realizará ningún cobro.");
  if (!selectedVariant || selectedVariant.priceUsd == null)
    invalid("CJ no confirmó el coste de la variante seleccionada.");
  assertCjSupplierIdentity(identity, selectedVariant);
  const effectiveUnitPrice = Number(item.price || 0) - Math.max(0, Number(discount || 0));
  const storeFundedPromotion = promotionAuthorized === true && Number(discount) > 0;
  const postalCode = String(shippingAddress.postalCode).trim();
  const shippingLookup = deps.quoteShipping || quoteCjVariantShipping;
  const stockLookup = deps.getStock || queryCjVariantStock;
  const warehouseLookup = deps.getWarehouses || queryCjVariantWarehouses;
  const factoryLookup = deps.getSupply || queryCjFactorySupply;
  const admissible = (origin,stock) => Boolean(
    stock?.verified === true && stock?.available === true &&
    stock?.vid === vid && stock?.origin === origin &&
    Number.isSafeInteger(stock?.quantity) && stock.quantity > 0);
  const pricedMethods = (freight,origin) => {
    if (!Array.isArray(freight?.methods) || freight?.vid !== vid ||
        freight?.destination !== "ES" || String(freight?.zip||"") !== postalCode ||
        (freight.origin && freight.origin !== origin) ||
        (origin !== "CN" && freight.origin !== origin)) return [];
    return freight.methods.filter(method =>
      String(method?.name||"").trim() && method?.totalPostageUsd != null &&
      Number.isFinite(Number(method.totalPostageUsd)) &&
      Number(method.totalPostageUsd) >= 0).map(method => ({
      method,
      profitability: estimateCjProfitability({
        salePriceEur:effectiveUnitPrice, productUsd:selectedVariant.priceUsd,
        postageUsd:method.totalPostageUsd, usdEurRate:fx.rate,
        vatRate:Number(product.iva ?? product.taxRate ?? 21),
        minMarginPercent:Math.max(0,Number(supplier.minMarginPercent ?? 30)),
        additionalImportCostEur:compliance.additionalImportCostEur,
      }),
    })).filter(entry=>canProceedWithVerifiedCjCosts({
      profitability:entry.profitability,promotionAuthorized,discount,
    })).sort((a,b)=>Number(a.method.totalPostageUsd)-Number(b.method.totalPostageUsd));
  };
  let chosen = null;
  const candidates = [];
  const cnStock = checks[3].status === "fulfilled" ? checks[3].value : null;
  if (admissible("CN",cnStock))
    candidates.push({origin:"CN",stock:cnStock,mode:"warehouse"});
  else {
    // Supplier-owned verified factory inventory, never merchant-owned units.
    try {
      const factory=await factoryLookup({pid,vid,origin:"CN"});
      if(factory?.source === "cj_api" && factory?.mode === "factory" &&
         admissible("CN",factory))
        candidates.push({origin:"CN",stock:factory,mode:"factory_verified"});
    }catch(error){
      console.warn("[cj.checkout] CJ factory supply lookup unavailable",
        String(error?.code||"UPSTREAM").slice(0,40));
    }
  }
  if (candidates.length && checks[1].status === "fulfilled") {
    const options = pricedMethods(checks[1].value,"CN");
    const choice = options.find(entry=>entry.method.name===preferredLogisticName)||options[0];
    if(choice) chosen={...choice,...candidates[0]};
  }
  // A zero/unknown CN stock or a missing CN→ES rate must not mask a real,
  // authenticated warehouse elsewhere. Every alternative route is verified
  // for exact VID, origin, address, total freight and profitability.
  if (!chosen) {
    let available = [];
    try {
      const result = await warehouseLookup({vid});
      if (result?.vid === vid && Array.isArray(result?.warehouses))
        available = result.warehouses.filter(w=>w?.verified === true &&
          w?.available === true && Number.isSafeInteger(w.quantity) &&
          w.quantity > 0 && /^[A-Z]{2}$/.test(String(w.countryCode||"")) &&
          w.countryCode !== "CN");
    } catch(error){
      console.warn("[cj.checkout] warehouse alternatives unavailable",
        String(error?.code||"UPSTREAM").slice(0,40));
    }
    const preferred=["DE","ES","FR","PL","IT","NL","BE","PT","CZ","AT"];
    available.sort((a,b)=>{
      const ai=preferred.indexOf(a.countryCode),bi=preferred.indexOf(b.countryCode);
      return (ai<0?99:ai)-(bi<0?99:bi) ||
        b.quantity-a.quantity || a.countryCode.localeCompare(b.countryCode);
    });
    for(const row of available.slice(0,3)){
      const origin=row.countryCode;
      try {
        const stock=await stockLookup({vid,origin});
        if(!admissible(origin,stock)) continue;
        const freight=await shippingLookup({vid,quantity:1,origin,destination:"ES",zip:postalCode});
        const options=pricedMethods(freight,origin);
        const choice=options.find(entry=>entry.method.name===preferredLogisticName)||options[0];
        if(choice){chosen={...choice,origin,stock,mode:"warehouse"};break;}
      }catch(error) {
        console.warn("[cj.checkout] alternative origin not quoteable",{
          origin, code:String(error?.code||"UPSTREAM").slice(0,40),
        });
      }
    }
  }
  if (!chosen && candidates.length && checks[1].status==="fulfilled" &&
      (checks[1].value?.vid !== vid || checks[1].value?.destination !== "ES" ||
       String(checks[1].value?.zip||"") !== postalCode ||
       (checks[1].value?.origin && checks[1].value.origin !== "CN")))
    invalid("La cotización CJ no coincide con la variante o el destino. No se realizará ningún cobro.");
  if (!chosen) {
    // Never charge if the exact variant cannot be supplied and shipped with
    // a complete profitable CJ quote for the real destination.
    const cnAvailable = candidates.length > 0;
    invalid(cnAvailable
      ? "CJ no confirmó un transporte con coste completo y margen permitido para esta dirección, desde ningún almacén verificado. No se realizará ningún cobro."
      : "CJ no confirmó existencias verificadas y transporte rentable para esta variante en ningún almacén. No se realizará ningún cobro.");
  }
  const {origin,stock,mode,method:selectedFreight,profitability} = chosen;
  const logisticName=String(selectedFreight.name);
  const factoryReady=mode==="factory_verified";
  return {
    cjOnly:true, profitability, storeFundedPromotion,
    verifiedQuote: {
      ...profitability,
      available: true, vid:identity.vid, sku:identity.sku,
      selectedVariant:identity.name, destination:"ES", postalCode:String(shippingAddress.postalCode).trim(),
      methodName: logisticName, origin, checkedAt:new Date().toISOString(),
      stockAtQuote: stock.quantity,
      supplierSupplyMode: mode,
    },
    shippingQuote: {
      ok:true, price:0, currency:"EUR", distanceKm:0, distanceText:"Envío directo CJ",
      durationText:String(selectedFreight.time || ""),
      destination:"España", origin:"Proveedor CJdropshipping · "+origin,
      deliveryProvider:"cj", logisticName, quotedAt:new Date().toISOString(),
      warning:storeFundedPromotion
        ? "Cupón autorizado: Herencia asume la diferencia de coste del proveedor y el envío."
        : factoryReady
        ? "CJ confirma unidades verificadas en fábrica; la preparación puede tardar más. Se revalidarán stock y costes antes de cumplir."
        : "El transporte del proveedor está incluido en el precio de venta. Se revisará antes del cumplimiento.",
    },
  };
}
