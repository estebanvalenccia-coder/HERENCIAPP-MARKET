// Currency-aware CJ profitability estimates. Never used as a payment authorization.
const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const normalized = (value) => finite(value) && Number(value) >= 0 ? Number(value) : null;

export function estimateCjProfitability({
  salePriceEur, productUsd, shippingUsd, postageUsd, usdEurRate,
  vatRate = 21, minMarginPercent = 30,
  processingRatePercent = 1.5, processingFixedEur = 0.25,
  currencyBufferPercent = 3,
} = {}) {
  const price = normalized(salePriceEur);
  const product = normalized(productUsd);
  const shipping = normalized(postageUsd) ?? normalized(shippingUsd);
  const rate = normalized(usdEurRate);
  if (price == null || product == null || shipping == null || rate == null || rate <= 0) {
    return { available: false, reason: "Falta un precio o tipo de cambio verificable. No habilitar compras automáticas." };
  }
  const vat = Math.max(0, Math.min(40, Number(vatRate) || 0)) / 100;
  const targetMargin = Math.max(0, Math.min(90, Number(minMarginPercent) || 0)) / 100;
  const processing = Math.max(0, Math.min(10, Number(processingRatePercent) || 0)) / 100;
  const fixed = Math.max(0, Number(processingFixedEur) || 0);
  const buffer = Math.max(0, Math.min(20, Number(currencyBufferPercent) || 0)) / 100;
  const providerUsd = product + shipping;
  const providerEur = providerUsd * rate * (1 + buffer);
  const netRevenueEur = price / (1 + vat);
  const paymentFeeEur = price * processing + fixed;
  const profitEur = netRevenueEur - providerEur - paymentFeeEur;
  const marginPercent = netRevenueEur > 0 ? profitEur / netRevenueEur * 100 : -100;
  const denom = (1 - targetMargin) / (1 + vat) - processing;
  const recommendedPriceEur = denom > 0 ? Math.ceil((providerEur + fixed) / denom * 100) / 100 : null;
  return {
    available: true, currency: "EUR", salePriceEur: money(price),
    supplierPriceUsd: money(product), postageUsd: money(shipping), supplierTotalUsd: money(providerUsd),
    usdEurRate: rate, costEur: money(providerEur), netRevenueEur: money(netRevenueEur),
    estimatedPaymentFeeEur: money(paymentFeeEur), estimatedProfitEur: money(profitEur),
    estimatedMarginPercent: money(marginPercent),
    recommendedMinimumPriceEur: recommendedPriceEur,
    minMarginPercent: money(targetMargin * 100),
    vatRate: money(vat * 100), currencyBufferPercent: money(buffer * 100),
    feasible: profitEur >= 0 && marginPercent >= targetMargin * 100,
    caution: "Estimación para una unidad. IVA, comisiones y cambios de divisa pueden variar; no equivale a un presupuesto firme de CJ.",
  };
}

let cached = null;
export async function getUsdToEurRate() {
  if (cached && Date.now() < cached.expiresAt) return cached.value;
  const response = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR", {
    signal: AbortSignal.timeout(7000),
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error("No se pudo obtener el cambio USD/EUR");
  const data = await response.json();
  const rate = Number(data?.rates?.EUR);
  const date = String(data?.date || "");
  if (!(rate > 0 && rate < 3 && /^\d{4}-\d{2}-\d{2}$/.test(date))) {
    throw new Error("El proveedor de cambio no devolvió un tipo de cambio verificable");
  }
  const age = Date.now() - Date.parse(date + "T00:00:00Z");
  if (age > 8 * 86400000 || age < -86400000) throw new Error("El tipo de cambio publicado no es reciente");
  const value = { rate, date, provider: "Frankfurter", checkedAt: new Date().toISOString() };
  cached = { value, expiresAt: Date.now() + 30 * 60 * 1000 };
  return value;
}
