function colorLuminance(input) {
  if (!/^#[0-9a-fA-F]{6}$/.test(String(input || ""))) return null;
  const components = [1,3,5].map((i) => Number.parseInt(input.slice(i,i+2),16) / 255)
    .map((c) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return .2126 * components[0] + .7152 * components[1] + .0722 * components[2];
}
export function contrastRatio(foreground,background) {
  const x = colorLuminance(foreground);
  const y = colorLuminance(background);
  if(x===null||y===null)return null;
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
export function diagnoseMarketSite(site,market,registryIds=[]) {
  const warnings = [];
  if(!site||!market)return warnings;
  const registered = new Set(registryIds);
  const seen = new Map();
  for(const item of market.navigation || []) {
    if(item.visible===false)continue;
    const href=String(item.href||"").trim();
    if(!href)warnings.push(`Menú «${item.label||"Sin nombre"}»: sin enlace`);
    else if(seen.has(href))warnings.push(`Menú: «${item.label}» y «${seen.get(href)}» comparten destino`);
    else seen.set(href,item.label);
  }
  for(const item of market.home?.categories || []) {
    if(item.visible===false)continue;
    if(!String(item.title||"").trim())warnings.push("Una categoría visible no tiene título");
    if(!String(item.imageUrl||"").trim())warnings.push(`Categoría «${item.title}»: sin imagen`);
    if(!String(item.href||"").trim())warnings.push(`Categoría «${item.title}»: sin enlace`);
  }
  for(const item of market.home?.services || []) {
    if(item.visible===false)continue;
    if(!String(item.imageUrl||"").trim())warnings.push(`Servicio «${item.title}»: sin imagen`);
    if(!String(item.href||"").trim())warnings.push(`Servicio «${item.title}»: sin enlace`);
  }
  if(site.brand?.logoUrl && !String(site.brand.logoAlt||"").trim())warnings.push("El logotipo no tiene texto alternativo");
  if(!String(market.home?.title||"").trim())warnings.push("La portada no tiene título principal");
  for(const [id,config] of Object.entries(market.componentControls || {})){
    if(!registered.has(id))warnings.push(`Componente «${id}»: configuración sin registro frontend`);
    if(config?.enabled!==false && config?.mobile===false && config?.tablet===false && config?.desktop===false)warnings.push(`Componente «${id}»: activado pero oculto en todos los dispositivos`);
    const ratio=contrastRatio(config?.design?.textColor,config?.design?.backgroundColor);
    if(ratio!==null && ratio<4.5)warnings.push(`Componente «${id}»: contraste bajo (${ratio.toFixed(1)}:1; recomendado al menos 4.5:1)`);
  }
  const ids=new Set();
  for(const block of site.builder?.blocks || []){
    if(ids.has(block.id))warnings.push(`Bloque visual «${block.name}»: ID duplicado`);
    ids.add(block.id);
    if(block.visible===false)continue;
    if(block.type==="gallery" && !Array.isArray(block.data?.images))warnings.push(`Galería «${block.name}»: no tiene imágenes válidas`);
  }
  return warnings;
}
