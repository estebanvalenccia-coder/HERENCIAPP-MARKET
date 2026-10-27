/** Only CSS-safe, bounded presentation values are accepted from published content. */
const isColor = (value) => typeof value === "string" && /^#[a-fA-F0-9]{6}$/.test(value);
const bounded = (value, low, high) => {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(low, Math.min(high, n)) : undefined;
};
export function normalizeComponentDesign(input) {
  const value = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const result = {};
  if (isColor(value.backgroundColor)) result.backgroundColor = value.backgroundColor;
  if (isColor(value.textColor)) result.textColor = value.textColor;
  const numbers = { paddingY:[0,140], marginY:[0,100], radius:[0,80], headingSize:[14,90], minHeight:[0,900], maxWidth:[320,1600] };
  for (const [key,range] of Object.entries(numbers)) {
    const n = bounded(value[key],range[0],range[1]);
    if (n !== undefined) result[key] = n;
  }
  if (["none","small","medium","large"].includes(value.shadow)) result.shadow = value.shadow;
  if (["inherit","sans","serif"].includes(value.fontFamily)) result.fontFamily = value.fontFamily;
  if (["none","fade-in","slide-up"].includes(value.animation)) result.animation = value.animation;
  return result;
}
