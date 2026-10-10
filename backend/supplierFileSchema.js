/**
 * Supplier-file schema adapters. No network requests, filesystem access or
 * write operations. Mapping is explicitly allowlisted to known target fields.
 */
import { XMLParser, XMLValidator } from "fast-xml-parser";

export const SUPPLIER_FILE_TARGETS = Object.freeze([
  "product_id","product_name","product_url","category","description",
  "variant_id","supplier_sku","variant_name","currency","cost","image_url",
  "brand","mpn","gtin","supplier_stock",
]);
const VALID_KEY=/^[a-z][a-z0-9_]{0,79}$/;
const OPTION_KEY=/^option_[a-z][a-z0-9_]{0,48}$/;
const MAX_XML_CHARS=512*1024;
const XML_PRODUCT_LISTS = ["products","catalog","feed","items"];
function fail(message,statusCode=422) {
  const e=new Error(message);e.statusCode=statusCode;throw e;
}
export function supplierColumnName(input) {
  return String(input??"").trim().replace(/([a-z])([A-Z])/g,"$1_$2")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,80);
}
function flatXml(row) {
  if(row===null||typeof row!=="object"||Array.isArray(row))return {};
  const result=Object.create(null);
  for(const [key,value] of Object.entries(row)) {
    const name=supplierColumnName(key.startsWith("@_")?key.slice(2):key);
    if (!name || !VALID_KEY.test(name) || name==="__proto__" || name==="constructor") continue;
    if(value===null||typeof value==="string"||typeof value==="number"||typeof value==="boolean") {
      result[name]=String(value??"");
    } else if(value && typeof value==="object" && !Array.isArray(value)) {
      if (name==="options"||name==="attributes") {
        for(const [child,datum] of Object.entries(value)) {
          const opt=supplierColumnName(child.startsWith("@_")?child.slice(2):child);
          if(OPTION_KEY.test("option_"+opt) && (typeof datum==="string"||typeof datum==="number"))
            result["option_"+opt]=String(datum);
        }
      } else if(typeof value["#text"]==="string" || typeof value["#text"]==="number") {
        result[name]=String(value["#text"]);
      }
    }
  }
  return result;
}
function flattenXmlProduct(item) {
  if(!item||typeof item!=="object"||Array.isArray(item))fail("Cada producto XML debe ser un objeto.");
  const outer={...item};
  const nested=outer.variants?.variant ?? outer.variants?.item ?? outer.variants?.option ??
    outer.variants?.row ?? outer.variant ?? null;
  delete outer.variants;delete outer.variant;
  const parent=flatXml(outer);
  const items=nested==null?[null]:Array.isArray(nested)?nested:[nested];
  if(items.length>60)fail("Un producto XML tiene más de 60 variantes.");
  return items.map(variant=>{
    const child=variant?flatXml(variant):{};
    // Keep the original product title/identity even when a variant has a name.
    const row={...parent,...child};
    row.product_id=parent.product_id||parent.id||parent.productid||parent.item_group_id||"";
    row.product_name=parent.product_name||parent.name||parent.title||"";
    if(variant)row.variant_name=child.variant_name||child.name||"";
    return row;
  });
}
export function parseSupplierXml(input) {
  const xml=String(input||"").replace(/^\uFEFF/,"").trim();
  if(!xml)fail("El documento XML está vacío.");
  if(Buffer.byteLength(xml,"utf8")>MAX_XML_CHARS)fail("El XML supera 512 KB.",413);
  // Disallow DTD/external entities, entity declarations and HTML-like content.
  if(/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml))fail("XML con DOCTYPE o entidades está prohibido.");
  if(/<\?(?!xml(?:\s|\?>))/i.test(xml))fail("El XML incluye instrucciones de procesamiento no admitidas.");
  const validation=XMLValidator.validate(xml,{
    allowBooleanAttributes:false,
    unpairedTags:[],
  });
  if(validation!==true)fail("XML mal formado: revisa etiquetas, atributos y caracteres.");
  let parsed;
  try {
    const parser=new XMLParser({
      ignoreAttributes:false,attributeNamePrefix:"@_",textNodeName:"#text",
      parseTagValue:false,parseAttributeValue:false,trimValues:true,
      processEntities:false,removeNSPrefix:true,allowBooleanAttributes:false,
      maxNestedTags:16,maxEntityCount:0,stopNodes:[],
    });
    parsed=parser.parse(xml);
  } catch {
    fail("No fue posible leer el XML con seguridad.");
  }
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))fail("La raíz XML es incorrecta.");
  const root=Object.keys(parsed).filter(key=>!key.startsWith("?"));
  if(root.length!==1)fail("El XML requiere un único elemento raíz de catálogo.");
  const rootName=supplierColumnName(root[0]);
  if(!XML_PRODUCT_LISTS.includes(rootName))fail("La raíz XML debe ser products, catalog, feed o items.");
  const holder=parsed[root[0]];
  if(!holder||typeof holder!=="object"||Array.isArray(holder))fail("El XML no contiene productos.");
  const raw=holder.product??holder.item??holder.row??holder.entry;
  if(raw===undefined)fail("El XML debe contener elementos <product>, <item>, <row> o <entry>.");
  const products=Array.isArray(raw)?raw:[raw];
  if(products.length>300)fail("Máximo 300 entradas XML.",413);
  const rows=products.flatMap(flattenXmlProduct);
  if(rows.length>300)fail("Máximo 300 variantes XML.",413);
  return rows;
}
/**
 * columnMap: keys are canonical field names, values are existing normalized
 * source column keys. Never accept object prototype paths or arbitrary targets.
 * Supports up to 4 named option_* keys to match current frontend selectors.
 */
export function normalizeSupplierColumnMap(raw, columns=[]) {
  if(raw===null||raw===undefined)return {};
  if(typeof raw!=="object"||Array.isArray(raw))fail("Mapeo de columnas incorrecto.");
  const available=new Set(columns.map(supplierColumnName));
  const entries=Object.entries(raw);
  if(entries.length>15)fail("El mapeo tiene demasiados campos.");
  const result=Object.create(null);
  const usedSources=new Set();
  let optionCount=0;
  for(const [targetRaw,sourceRaw] of entries) {
    const target=supplierColumnName(targetRaw);
    if(target!==targetRaw || (!SUPPLIER_FILE_TARGETS.includes(target)&&!OPTION_KEY.test(target)))
      fail("Campo de destino no admitido en el mapeo: "+String(targetRaw).slice(0,80));
    if(OPTION_KEY.test(target))optionCount++;
    if(optionCount>4)fail("Se admiten como máximo cuatro atributos de variante.");
    if(typeof sourceRaw!=="string" || sourceRaw!==sourceRaw.trim() ||
       !VALID_KEY.test(sourceRaw) || !available.has(sourceRaw)) {
      fail("La columna de origen no existe en este archivo: "+String(sourceRaw).slice(0,60));
    }
    if(usedSources.has(sourceRaw))fail("La misma columna de origen no puede asignarse a varios campos.");
    usedSources.add(sourceRaw);
    result[target]=sourceRaw;
  }
  return result;
}
export function mappedSupplierRows(rows, columnMap={}) {
  const columns=[...new Set(rows.flatMap(row=>Object.keys(row)))].slice(0,61);
  const mappings=normalizeSupplierColumnMap(columnMap,columns);
  if(!Object.keys(mappings).length)return rows;
  return rows.map((row)=>{
    const converted={...row};
    for(const [target,source] of Object.entries(mappings)){
      const existing=String(row[target]??"");
      const incoming=String(row[source]??"");
      if(existing && existing!==incoming && target!==source)
        fail("Mapeo ambiguo: la columna "+target+" ya contiene un valor diferente.");
      converted[target]=row[source];
    }
    return converted;
  });
}
export function inspectSupplierRows(rows=[]) {
  if(!Array.isArray(rows)||rows.length>300)fail("Catálogo no válido para inspección.");
  const keys=[...new Set(rows.flatMap(row=>Object.keys(row)))];
  if(keys.length>60)fail("El catálogo contiene demasiadas columnas.");
  return {
    ok:true,
    columns:keys.map(key=>({
      key,
      example:String(rows.find(row=>row[key]!==undefined && row[key]!==null)?.[key]??"").slice(0,70),
    })),
    targets:SUPPLIER_FILE_TARGETS,
    maximumOptions:4,
    readOnly:true,
  };
}
