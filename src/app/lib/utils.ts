/**
 * Formatea un precio de manera segura, manejando valores undefined/null
 */
export function formatPrice(price: number | undefined | null): string {
  return `$${(price || 0).toFixed(2)}`;
}

/**
 * Obtiene el precio de un producto de manera segura
 */
export function getProductPrice(product: any): number {
  return product?.price || 0;
}

/**
 * Obtiene el precio de venta de un producto de manera segura
 */
export function getSalePrice(product: any): number {
  return product?.salePrice || product?.price || 0;
}
