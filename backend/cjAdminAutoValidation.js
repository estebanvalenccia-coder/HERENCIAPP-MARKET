/** Read-only CJ admin helpers. Preview rates never authorize payment. */
export function chooseCjValidationVariant(variants, savedVid = "") {
  const list = Array.isArray(variants) ? variants : [];
  const selected = String(savedVid || "").trim();
  const matched = selected ? list.find(row => String(row?.vid || "") === selected) : null;
  if (matched) return {variant:matched,reason:null};
  if (list.length === 1 && list[0]?.vid && list[0]?.sku)
    return {variant:list[0],reason:null};
  return {variant:null,reason:list.length === 0 ? "NO_VARIANTS" : "SELECT_EXACT_VARIANT"};
}
export function cjSpanishFreightPreviewSamples(destination = "ES") {
  return String(destination).toUpperCase() === "ES" ? ["28001","08001"] : [];
}
export function recommendCjPreviewMethod(methods) {
  const eligible = (Array.isArray(methods) ? methods : [])
    .filter(method => method?.name && method?.totalPostageUsd != null &&
      Number.isFinite(Number(method.totalPostageUsd)) && Number(method.totalPostageUsd) >= 0 &&
      method?.profitability?.available === true && method?.profitability?.feasible === true);
  return eligible.sort((a,b) => Number(a.totalPostageUsd)-Number(b.totalPostageUsd))[0] || null;
}