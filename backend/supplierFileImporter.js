/**
 * Universal supplier file import, independent of any supplier API.
 * CSV / JSON / XML, with a bounded XML parser and explicit column mapping.
 * Pure parser/validator: no side effects, publishing or payments.
 */
import crypto from "node:crypto";
import { parseSupplierXml, mappedSupplierRows, inspectSupplierRows } from "./supplierFileSchema.js";

const MAX_BYTES = 512 * 1024;
const MAX_ROWS = 300;
const MAX_PRODUCTS = 30;
const MAX_VARIANTS = 60;
const MAX_COLUMNS = 60;
const MAX_OPTIONS = 4;

function error(message, statusCode = 422) {
  const result = new Error(message);
  result.statusCode = statusCode;
  throw result;
}

function clean(value, limit = 300) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, limit);
}

function normalizedKey(name) {
  return clean(name, 120).replace(/([a-z])([A-Z])/g, "$1_$2").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

const NAMES = Object.freeze({
  productId: ["product_id", "productid", "group_id", "parent_id", "id_producto", "idproducto", "handle", "item_group_id"],
  name: ["product_name", "name", "title", "nombre", "nombre_producto", "product_title"],
  productUrl: ["product_url", "url_producto", "source_url", "url", "link", "product_link"],
  category: ["category", "categoria", "product_category"],
  description: ["description", "descripcion", "product_description"],
  variantId: ["variant_id", "supplier_variant_id", "vid", "id_variante"],
  sku: ["supplier_sku", "variant_sku", "sku", "sku_proveedor", "seller_sku"],
  variantName: ["variant_name", "option_name", "nombre_variante", "variant"],
  currency: ["currency", "moneda", "supplier_currency"],
  cost: ["cost", "supplier_cost", "supplier_price", "precio_compra", "purchase_price", "wholesale_price"],
  image: ["image", "image_url", "foto", "imagen", "picture", "photo_url"],
  brand: ["manufacturer", "brand", "marca", "fabricante"],
  mpn: ["mpn", "manufacturer_part_number", "modelo_fabricante"],
  gtin: ["gtin", "ean", "upc", "barcode", "codigo_barras"],
  stock: ["supplier_stock", "stock", "supplier_quantity", "existencias_proveedor"],
});

function field(row, key) {
  const names = NAMES[key];
  for (const name of names) {
    if (Object.hasOwn(row, name)) return clean(row[name], key === "description" ? 2000 : 2000);
  }
  return "";
}

function currency(raw) {
  const value = clean(raw, 10).toUpperCase();
  if (value && !/^[A-Z]{3}$/.test(value)) error("Moneda no válida: se requiere un código ISO de 3 letras.");
  return value;
}
function price(raw) {
  const value = clean(raw, 40);
  if (!value) return null;
  // Do not guess locale-specific thousands separator, currency symbols or FX.
  const normalized = value.replace(",", ".");
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(normalized) ||
      !Number.isFinite(Number(normalized)) || Number(normalized) > 1000000) {
    error("Coste de compra no válido. Utiliza cifras como 12.50, sin símbolos ni separadores de miles.");
  }
  return Number(normalized);
}
function safeUrl(raw) {
  const value = clean(raw, 2000);
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.hash ||
        !url.hostname.includes(".") || url.hostname === "localhost") throw Error("invalid");
    return url.href;
  } catch {
    error("Hay una URL no válida; solo se admiten direcciones HTTPS públicas sin credenciales.");
  }
}

export function parseSupplierCsv(input) {
  const raw = String(input || "").replace(/^\uFEFF/, "");
  if (!raw.trim()) error("El archivo CSV está vacío.");
  if (Buffer.byteLength(raw, "utf8") > MAX_BYTES) error("Archivo CSV demasiado grande (máximo 512 KB).", 413);
  if (/^\s*sep=[,;\t]\s*\r?\n/i.test(raw)) error("Elimina la línea 'sep=' del CSV y vuelve a importarlo.");
  const firstLine = raw.split(/\r?\n/, 1)[0];
  const delimiter = [";", ",", "\t"].sort((a,b)=>
    firstLine.split(b).length-firstLine.split(a).length)[0];
  const records = [];
  let row = [], value = "", quoting = false;
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (char === '"') {
      if (quoting && raw[i+1] === '"') { value += '"'; i++; }
      else if (quoting) quoting = false;
      else if (!value.length) quoting = true;
      else error("Comillas CSV mal colocadas.");
    } else if (char === delimiter && !quoting) {
      row.push(value); value = "";
    } else if ((char === "\n" || char === "\r") && !quoting) {
      if (char === "\r" && raw[i+1] === "\n") i++;
      row.push(value);value="";
      if (row.some(cell=>cell.trim())) records.push(row);
      row=[];
      if(records.length>MAX_ROWS+1) error("El archivo excede el límite de 300 filas.",413);
    } else {
      value+=char;
      if (value.length>4096) error("Una celda CSV es demasiado grande.");
    }
  }
  if (quoting) error("CSV mal formado: comillas sin cerrar.");
  row.push(value);
  if (row.some(cell=>cell.trim())) records.push(row);
  const header=(records.shift()||[]).map(normalizedKey);
  if (!header.length || header.length>MAX_COLUMNS || header.some(key=>!key) ||
      new Set(header).size!==header.length) error("El CSV tiene cabeceras vacías, duplicadas o demasiadas columnas.");
  if (records.length>MAX_ROWS) error("Máximo 300 filas por catálogo.");
  return records.map((values,i)=>{
    if (values.length !== header.length) error("La fila "+(i+2)+" tiene un número de columnas distinto de la cabecera.");
    return Object.fromEntries(header.map((key,index)=>[key,values[index]]));
  });
}

export function parseSupplierJson(input) {
  let json;
  try { json=JSON.parse(String(input || "")); }
  catch { error("El archivo JSON no tiene una estructura válida."); }
  const list=Array.isArray(json)?json:json && typeof json==="object"?json.products:null;
  if (!Array.isArray(list)) error("El JSON debe ser un array o un objeto con un array 'products'.");
  if (list.length>MAX_ROWS) error("Máximo 300 entradas por catálogo.");
  const flat=[];
  for(const product of list) {
    if (!product || typeof product!=="object" || Array.isArray(product)) error("Cada producto JSON debe ser un objeto.");
    const variants=Array.isArray(product.variants)?product.variants:null;
    if(variants&&variants.length>MAX_VARIANTS) error("Un producto tiene más de 60 variantes.");
    if (variants && variants.length) {
      const outer={...product};
      delete outer.variants;
      for (const variant of variants) {
        if (!variant || typeof variant!=="object" || Array.isArray(variant)) error("Las variantes JSON deben ser objetos.");
        const merged={
          ...outer,...variant,
          product_id: product.product_id ?? product.productId ?? product.id,
          product_name: product.product_name ?? product.productName ?? product.name ?? product.title,
          variant_name: variant.variant_name ?? variant.variantName ?? variant.name,
        };
        flat.push(merged);
      }
    } else flat.push(product);
  }
  if(flat.length>MAX_ROWS) error("Máximo 300 variantes por archivo.");
  return flat.map(row=>{
    const cleaned={};
    for(const [key,val] of Object.entries(row)) {
      if (val!=null && typeof val==="object") {
        // Accept explicit option attributes as a nested object, nothing else.
        if (["options","option_values","attributes"].includes(normalizedKey(key)) &&
            !Array.isArray(val)) for (const [option,value] of Object.entries(val)) {
          cleaned["option_"+normalizedKey(option)] = value;
        }
        continue;
      }
      cleaned[normalizedKey(key)]=val;
    }
    return cleaned;
  });
}

function rowsForFile(format, content) {
  const text=String(content || "");
  if (Buffer.byteLength(text,"utf8")>MAX_BYTES) error("El catálogo supera 512 KB.",413);
  if (format==="csv") return parseSupplierCsv(text);
  if (format==="json") return parseSupplierJson(text);
  if (format==="xml") return parseSupplierXml(text);
  error("Solo se admiten catálogos CSV, JSON o XML de origen autorizado.");
}

function optionNames(row) {
  const optional=Object.keys(row).filter(key=>/^(option|attribute|variant)_[a-z0-9_]+$/.test(key) &&
    !["option_name","variant_name","variant_sku","variant_id","variant_price",
      "option_values","variant_variant_id"].includes(key));
  const common=["color","size","talla","plug","enchufe","capacity","material","tamano"];
  const selected=[...optional,...common.filter(key=>Object.hasOwn(row,key))];
  if (selected.length>MAX_OPTIONS) error("Hay más de cuatro atributos de variante. Revísalos y divide el catálogo.");
  return selected;
}

function asImportRow(row, index) {
  const key=field(row,"productId")||field(row,"productUrl")||field(row,"sku");
  const name=field(row,"name").slice(0,220);
  if(!key || !name) error("Fila "+(index+1)+": faltan identificador de producto o nombre.");
  if(key.length>180 || name.length>220) error("Fila "+(index+1)+": nombre o ID demasiado largo.");
  const rawCost=field(row,"cost");
  const rawCurrency=field(row,"currency");
  const labels=optionNames(row);
  const values=labels.map(label=>clean(row[label],120));
  if (labels.some((label,i)=>!values[i])) error("Fila "+(index+1)+": atributo "+labels.join(", ")+" vacío.");
  const variantName=field(row,"variantName").slice(0,220) || (values.length ? values.join(" · ") : "");
  return {
    key, name, category:field(row,"category").slice(0,120),
    description:field(row,"description").slice(0,2000),
    productUrl:safeUrl(field(row,"productUrl")),
    imageUrl:safeUrl(field(row,"image")),
    supplierVariantId:field(row,"variantId").slice(0,100),
    supplierSku:field(row,"sku").slice(0,100),
    variantName,
    optionLabels:labels.map(label=>label.replace(/^(option|attribute|variant)_/,"")),
    optionValues:values,
    cost:price(rawCost),
    currency:currency(rawCurrency),
    brand:field(row,"brand").slice(0,120),
    mpn:field(row,"mpn").slice(0,120),
    gtin:field(row,"gtin").slice(0,24),
    supplierStock:(()=>{
      const value=field(row,"stock");
      if(!value) return null;
      if(!/^(?:0|[1-9][0-9]{0,8})$/.test(value))error("Inventario del proveedor no válido.");
      return Number(value);
    })(),
  };
}

export function inspectSupplierFile({ format, content } = {}) {
  const rows=rowsForFile(String(format||"").toLowerCase(),content);
  return {...inspectSupplierRows(rows),format:String(format||"").toLowerCase(),rows:rows.length};
}

export function previewSupplierFile({ format, content, supplierId, columnMap = {} } = {}) {
  const id=clean(supplierId,100);
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) error("Selecciona un proveedor registrado válido.");
  const sourceRows=rowsForFile(String(format||"").toLowerCase(),content);
  const rows=mappedSupplierRows(sourceRows,columnMap).map(asImportRow);
  if(!rows.length) error("El catálogo no contiene productos.");
  const groups=new Map();
  for(const row of rows) {
    if (!groups.has(row.key)) {
      if(groups.size>=MAX_PRODUCTS) error("Máximo 30 productos diferentes por archivo.");
      groups.set(row.key,[]);
    }
    const group=groups.get(row.key);
    if(group.length>=MAX_VARIANTS) error("Un producto supera 60 variantes.");
    group.push(row);
  }
  const products=[];
  for(const [key,items] of groups) {
    const first=items[0];
    if(items.some(x=>x.name!==first.name))error("El producto "+key+" tiene nombres de producto contradictorios.");
    const optionLabels=first.optionLabels;
    if(items.some(x=>x.optionLabels.join("|")!==optionLabels.join("|"))) {
      error("El producto "+key+" tiene columnas de opciones inconsistentes.");
    }
    const rawCurrencies=[...new Set(items.map(x=>x.currency).filter(Boolean))];
    if(rawCurrencies.length>1)error("El producto "+key+" mezcla monedas diferentes.");
    const seenNames=new Set(),seenSkus=new Set(),seenIds=new Set();
    const variants=[];
    for (const item of items) {
      const name=item.variantName;
      if(items.length>1 && !name)error("El producto "+key+" contiene varias variantes sin un nombre de opción.");
      if(items.length>1 && !item.supplierSku && !item.supplierVariantId) {
        error("El producto "+key+" tiene variantes sin SKU ni identificador original.");
      }
      if(name) {
        const normalized=name.toLowerCase();
        if(seenNames.has(normalized)) error("El producto "+key+" repite la combinación "+name+".");
        seenNames.add(normalized);
      }
      if(item.supplierSku) {
        if(seenSkus.has(item.supplierSku))error("El producto "+key+" repite el SKU "+item.supplierSku+".");
        seenSkus.add(item.supplierSku);
      }
      if(item.supplierVariantId) {
        if(seenIds.has(item.supplierVariantId))error("El producto "+key+" repite el identificador de variante.");
        seenIds.add(item.supplierVariantId);
      }
      if(name)variants.push({
        name,sku:"",stock:0,
        supplierVariantId:item.supplierVariantId,supplierSku:item.supplierSku,
        optionValues:item.optionValues,
      });
    }
    const originalUrl=items.find(row=>row.productUrl)?.productUrl||"";
    if(items.some(row=>row.productUrl && row.productUrl!==originalUrl)) {
      error("El producto "+key+" incluye URLs originales contradictorias.");
    }
    const stableId="supplierfile_"+crypto.createHash("sha256")
      .update(id+"\u0000"+key).digest("hex").slice(0,32);
    products.push({
      id:stableId,supplierId:id,supplierProductId:key,
      brand:items.every(x=>x.brand===first.brand)?first.brand:"",
      mpn:items.every(x=>x.mpn===first.mpn)?first.mpn:"",
      // GTIN is commonly per variant. A mixed GTIN cannot justify treating
      // two products from different suppliers as an identical family.
      gtin:items.every(x=>x.gtin===first.gtin)?first.gtin:"",
      name:first.name,category:first.category||"otros",
      description:first.description,sourceProductUrl:originalUrl,
      sourceImageUrl:items.find(row=>row.imageUrl)?.imageUrl||"",
      currency:rawCurrencies[0]||"",
      minSupplierCost:items.every(row=>row.cost!==null)?Math.min(...items.map(row=>row.cost)):null,
      variants,optionLabels,variantCount:variants.length,
      originalOffers:items.map(row=>({
        supplierVariantId:row.supplierVariantId,supplierSku:row.supplierSku,
        variantName:row.variantName,cost:row.cost,currency:row.currency,stock:row.supplierStock,
      })),
      warnings:[
        "Requiere verificar precios, stock, portes y autorización del proveedor antes de vender.",
        "Sin imágenes copiadas a R2: adjunta fotografías autorizadas desde Administración.",
        ...(items.some(row=>row.cost===null)?["Hay variantes sin coste de compra."]:[]),
        ...(items.some(row=>!row.supplierSku)?["Hay variantes sin SKU del proveedor."]:[]),
      ],
    });
  }
  return {
    ok:true,source:"supplier_file",format, supplierId:id,
    rows:rows.length,products,
    warnings:["Vista previa. No se ha modificado Neon ni se ha publicado nada."],
  };
}

export function draftForSupplierFile(product, supplier = {}) {
  if (!product?.id || !product?.supplierProductId)error("Faltan identificadores de importación.");
  return {
    id:product.id,
    name:product.name,description:product.description||"",
    category:product.category||"otros",collection:"",
    collections:[],type:"product",department:"Catálogo",
    area:"Importados",family:"Proveedor",
    status:"draft",active:false,featured:false,
    price:0,stock:0,trackInventory:true,
    image:"",images:[],
    variants:product.variants,
    metadata:{
      importedFromFile:true,supplierId:product.supplierId,
      supplierProductId:product.supplierProductId,
      supplierFileOriginalUrl:product.sourceProductUrl,
      sourceImageUrl:product.sourceImageUrl,
      sourceHost:clean(supplier?.sourceHost,255),
      fulfillmentType:"dropship",fulfillmentMode:"manual",
      supplierOriginalPrice:product.minSupplierCost,
      supplierCurrency:product.currency,
      supplierOffersUnverified:true,
      brand:product.brand||"",manufacturer:product.brand||"",mpn:product.mpn||"",gtin:product.gtin||"",
      supplierVariantPrices:product.originalOffers,
      variantOptionLabels:product.optionLabels,
      missingImportFields:["images","salePrice","verifiedShipping","verifiedStock"],
      importedAt:new Date().toISOString(),
    },
  };
}
