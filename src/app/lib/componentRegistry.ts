
export type StorefrontComponentLocation = "header" | "home" | "floating" | "footer";
export type StorefrontComponentKey =
  | "header.announcement" | "header.search" | "header.account" | "header.favorites" | "header.cart"
  | "header.deliverySelector" | "header.herenciaIA" | "home.hero" | "home.delivery" | "home.categoryStrip"
  | "home.plantCta" | "home.feed" | "home.categoriesGrid" | "home.services"
  | "home.featured" | "home.promotions" | "home.trust" | "home.bottomCta"
  | "floating.sales" | "floating.support" | "floating.whatsapp" | "floating.accessibility" | "footer.main";

export type StorefrontComponentControl = {
  enabled?: boolean;
  desktop?: boolean;
  tablet?: boolean;
  mobile?: boolean;
  schedule?: { startAt?: string; endAt?: string };
};

export type StorefrontComponentDefinition = {
  id: StorefrontComponentKey;
  name: string;
  location: StorefrontComponentLocation;
  description: string;
  editingSection: "navegacion" | "portada" | "servicios" | "promociones" | "sales" | "footer";
};

/**
 * A component must opt into this registry AND use the StorefrontComponentBoundary
 * at its rendering site. Adding a row alone cannot magically govern arbitrary JSX.
 */
export const STOREFRONT_COMPONENT_REGISTRY: readonly StorefrontComponentDefinition[] = [
  { id:"header.announcement", name:"Franja informativa", location:"header", editingSection:"navegacion", description:"Mensaje promocional superior" },
  { id:"header.search", name:"Buscador", location:"header", editingSection:"navegacion", description:"Búsqueda de productos y servicios" },
  { id:"header.account", name:"Mi cuenta", location:"header", editingSection:"navegacion", description:"Acceso de clientes" },
  { id:"header.favorites", name:"Favoritos", location:"header", editingSection:"navegacion", description:"Acceso a lista de favoritos" },
  { id:"header.cart", name:"Carrito", location:"header", editingSection:"navegacion", description:"Acceso al carrito de compra" },
  { id:"header.deliverySelector", name:"Selector de entrega", location:"header", editingSection:"navegacion", description:"Destinos de entrega disponibles" },
  { id:"header.herenciaIA", name:"Acceso Herencia IA", location:"header", editingSection:"navegacion", description:"Acceso al asistente de IA cuando esté habilitado" },
  { id:"home.hero", name:"Portada principal", location:"home", editingSection:"portada", description:"Imagen, textos y botones principales" },
  { id:"home.delivery", name:"Banner de entrega internacional", location:"home", editingSection:"portada", description:"Envíos a Colombia" },
  { id:"home.categoryStrip", name:"Categorías circulares", location:"home", editingSection:"portada", description:"Fila de categorías redondas" },
  { id:"home.plantCta", name:"Botón descubrir plantas", location:"home", editingSection:"portada", description:"Acceso principal al catálogo de plantas" },
  { id:"home.feed", name:"Contenido dinámico", location:"home", editingSection:"portada", description:"Bloques alimentados desde el escaparate" },
  { id:"home.categoriesGrid", name:"Tarjetas de categorías", location:"home", editingSection:"portada", description:"Cuadrícula de colecciones" },
  { id:"home.services", name:"Servicios", location:"home", editingSection:"servicios", description:"Tarjetas de servicios" },
  { id:"home.featured", name:"Productos destacados", location:"home", editingSection:"portada", description:"Selección de productos disponibles" },
  { id:"home.promotions", name:"Promociones", location:"home", editingSection:"promociones", description:"Banners Dulce y Moda" },
  { id:"home.trust", name:"Ventajas de Herencia", location:"home", editingSection:"portada", description:"Beneficios de compra y asistencia" },
  { id:"home.bottomCta", name:"Banner inferior", location:"home", editingSection:"promociones", description:"Llamada a la acción de la portada" },
  { id:"floating.sales", name:"Herencia Sales", location:"floating", editingSection:"sales", description:"Chat y botón comercial flotante" },
  { id:"floating.support", name:"Atención al cliente", location:"floating", editingSection:"sales", description:"Centro de soporte flotante" },
  { id:"floating.whatsapp", name:"WhatsApp", location:"floating", editingSection:"sales", description:"Botón de contacto por WhatsApp" },
  { id:"floating.accessibility", name:"Accesibilidad", location:"floating", editingSection:"sales", description:"Panel de preferencias accesibles" },
  { id:"footer.main", name:"Pie de página", location:"footer", editingSection:"footer", description:"Enlaces y datos de contacto" },
] as const;

export function getComponentControl(
  controls: Record<string, StorefrontComponentControl> | undefined,
  id: string
): StorefrontComponentControl {
  return controls?.[id] || {};
}

export { isComponentAllowed, componentDeviceClasses } from "./componentPolicy.mjs";

export function checkComponentRegistry(registeredIds: readonly string[] = STOREFRONT_COMPONENT_REGISTRY.map((item) => item.id)) {
  const duplicates = registeredIds.filter((id, index) => registeredIds.indexOf(id) !== index);
  return { total: registeredIds.length, duplicates: [...new Set(duplicates)] };
}
