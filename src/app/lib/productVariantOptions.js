// Product option groups are derived from real, stored variant combinations.
// Never synthesize a SKU, CJ VID, or a combination that the supplier did not return.
export function splitSupplierOptions(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  const parts = raw.split(/\s*\|\s*|\s*;\s*|\s+\/\s+|\s+-\s+|-(?=(?:EU|US|UK|AU)(?:\s|$))/i)
    .map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 && parts.length <= 4 ? parts : [raw];
}

function suggestedLabel(values, index) {
  const text = values.join(" ").toLowerCase();
  if (values.some(v => /^(?:(?:eu|us|uk|au|europa|europe|usa|ee\.?uu\.?)(?:\s*(?:plug|enchufe|socket|adapter|adaptador))?|(?:plug|enchufe)\s*(?:eu|us|uk|au))$/i.test(v.trim()))) return "Enchufe";
  if (values.some(v => /\b(?:black|white|pink|red|blue|green|yellow|purple|gray|grey|brown|orange|negro|blanco|rosa|rojo|azul|verde|amarillo|morado|gris|marrón|naranja)\b/i.test(v))) return "Color";
  if (values.some(v => /^(?:xxs|xs|s|m|l|xl|xxl|xxxl|\d+(?:[.,]\d+)?\s*(?:mm|cm|m|in|inch|gb|ml|l))$/i.test(v.trim()))) return "Tamaño";
  return "Opción " + (index + 1);
}

export function deriveVariantOptionGroups(variants = [], configuredLabels = []) {
  if (!Array.isArray(variants) || variants.length === 0) return [];
  const rows = variants.map(v => Array.isArray(v?.optionValues) && v.optionValues.length
    ? v.optionValues.map(x => String(x || "").trim()).filter(Boolean)
    : splitSupplierOptions(v?.name || v));
  const count = rows[0]?.length || 0;
  if (!count || count > 4 || rows.some(r => r.length !== count)) return [];
  return Array.from({length:count},(_,index)=>{
    const values = [...new Set(rows.map(r=>r[index]).filter(Boolean))];
    return {
      label: String(configuredLabels?.[index] || "").trim() || suggestedLabel(values,index),
      values,
    };
  });
}

export function chooseExistingVariant(variants = [], selectedName = "", optionIndex = 0, value = "") {
  const current = variants.find(v => String(v?.name || v) === String(selectedName)) || variants[0];
  if (!current) return null;
  const all = variants.map(v => ({variant:v,parts:Array.isArray(v?.optionValues) && v.optionValues.length
    ? v.optionValues.map(String):splitSupplierOptions(v?.name || v)}));
  const selectedParts = all.find(x => x.variant === current)?.parts || [];
  const exact = all.find(x => x.parts[optionIndex] === value && x.parts.every((part,i)=>i === optionIndex || part === selectedParts[i]));
  return (exact || all.find(x=>x.parts[optionIndex]===value))?.variant || null;
}
