function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizePaymentMethod(value = "") {
  const method = String(value).trim().toLowerCase();
  if (["cash", "efectivo"].includes(method)) return "cash";
  if (["card", "tarjeta"].includes(method)) return "card";
  if (method === "bizum") return "bizum";
  if (["transfer", "transferencia", "bank_transfer"].includes(method)) return "transfer";
  return method || "cash";
}

export function paymentStatusForMethod(value = "") {
  const method = normalizePaymentMethod(value);
  if (method === "cash") return "paid";
  if (method === "card") return "payment_pending";
  if (method === "bizum") return "pending_bizum_review";
  if (method === "transfer") return "pending_transfer_review";
  return "pending_manual_review";
}

export function normalizePosProduct(product = {}) {
  const onSale = product.onSale === true && asNumber(product.salePrice, 0) > 0;
  const price = Math.max(0, onSale ? asNumber(product.salePrice, 0) : asNumber(product.price, 0));
  const stock = Math.max(0, Math.floor(asNumber(product.stock, 0)));
  const iva = Math.max(0, asNumber(product.iva, 21));
  const id = String(product.id ?? "").trim();

  return {
    ...product,
    id,
    name: String(product.name || "Producto"),
    sku: String(product.sku || `SKU-${id || "SIN-ID"}`),
    category: String(product.category || "Sin categoría"),
    price,
    iva,
    stock,
    active: product.active !== false,
  };
}

export function calculatePosTotals(items = [], received = 0) {
  let total = 0;
  let subtotal = 0;

  for (const item of items) {
    const qty = Math.max(0, Math.floor(asNumber(item.quantity ?? item.qty, 0)));
    const price = Math.max(0, asNumber(item.price, 0));
    const iva = Math.max(0, asNumber(item.iva, 21));
    const discountPercent = Math.max(0, Math.min(100, asNumber(item.discountPercent ?? item.discount, 0)));
    const grossLineTotal = price * qty;
    const lineTotal = grossLineTotal * (1 - discountPercent / 100);
    total += lineTotal;
    subtotal += lineTotal / (1 + iva / 100);
  }

  const roundedTotal = Math.round(total * 100) / 100;
  const roundedSubtotal = Math.round(subtotal * 100) / 100;
  const tax = Math.round((roundedTotal - roundedSubtotal) * 100) / 100;
  const receivedNumber = Math.max(0, asNumber(received, 0));

  return {
    subtotal: roundedSubtotal,
    tax,
    total: roundedTotal,
    received: receivedNumber,
    change: Math.max(0, Math.round((receivedNumber - roundedTotal) * 100) / 100),
  };
}

export function validateAndApplyStock(products = [], requestedItems = []) {
  if (!Array.isArray(products) || !Array.isArray(requestedItems) || requestedItems.length === 0) {
    throw new Error("La venta no contiene artículos");
  }

  const normalizedProducts = products.map(normalizePosProduct);
  const byId = new Map(normalizedProducts.map((product) => [product.id, product]));
  const mergedRequested = new Map();
  const manualItems = [];

  for (const raw of requestedItems) {
    const id = String(raw?.id ?? "").trim();
    const qty = Math.floor(asNumber(raw?.quantity ?? raw?.qty, 0));
    if (!id || qty <= 0) throw new Error("Artículo o cantidad inválida");

    const isManual = raw?.manual === true && id.startsWith("manual-");
    if (isManual) {
      const rawPrice = asNumber(raw?.price, NaN);
      if (!Number.isFinite(rawPrice) || rawPrice <= 0) {
        throw new Error("El artículo manual necesita un importe válido");
      }

      const price = Math.round(rawPrice * 100) / 100;
      const iva = Math.max(0, Math.min(100, asNumber(raw?.iva, 21)));
      const name = String(raw?.name || "Artículo").trim() || "Artículo";
      const discountPercent = Math.max(0, Math.min(100, asNumber(raw?.discountPercent ?? raw?.discount, 0)));

      manualItems.push({
        id,
        name,
        sku: String(raw?.sku || "VENTA-LIBRE"),
        category: "Venta libre",
        price,
        iva,
        quantity: qty,
        qty,
        manual: true,
        discountPercent,
      });
      continue;
    }

    mergedRequested.set(id, (mergedRequested.get(id) || 0) + qty);
  }

  const authoritativeItems = [...manualItems];

  for (const [id, qty] of mergedRequested.entries()) {
    const product = byId.get(id);
    if (!product) throw new Error(`Producto no encontrado: ${id}`);
    if (!product.active) throw new Error(`Producto inactivo: ${product.name}`);
    if (product.stock < qty) {
      throw new Error(`Stock insuficiente para ${product.name}. Disponible: ${product.stock}`);
    }

    const requested = requestedItems.find((raw) => String(raw?.id ?? "").trim() === id);
    const discountPercent = Math.max(0, Math.min(100, asNumber(requested?.discountPercent ?? requested?.discount, 0)));

    authoritativeItems.push({
      id: product.id,
      name: product.name,
      sku: product.sku,
      category: product.category,
      price: product.price,
      iva: product.iva,
      quantity: qty,
      qty,
      discountPercent,
    });
  }

  const updatedProducts = products.map((raw) => {
    const id = String(raw?.id ?? "").trim();
    const qty = mergedRequested.get(id) || 0;
    if (!qty) return raw;
    return { ...raw, stock: Math.max(0, Math.floor(asNumber(raw.stock, 0)) - qty) };
  });

  return {
    items: authoritativeItems,
    updatedProducts,
    totals: calculatePosTotals(authoritativeItems),
  };
}

export function nextPosDocumentNumber(documentType = "ticket", year = new Date().getFullYear(), counter = 1) {
  const prefix = documentType === "invoice" ? "FAC" : "TIC";
  const safeCounter = Math.max(1, Math.floor(asNumber(counter, 1)));
  return `${prefix}-${year}-${String(safeCounter).padStart(6, "0")}`;
}
