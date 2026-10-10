// Pure validation for administrator-only, read-only CJ EU shipping previews.
// NEVER relax the live checkout restriction (ES, one unit) using this helper.
import { EU_COUNTRIES } from "./supplierMarketplace.js";

export function validateCjEuFreightPreview({ destination = "ES", zip = "" } = {}) {
  const country = String(destination || "").trim().toUpperCase();
  const postalCode = String(zip || "").trim().toUpperCase();
  const error = (message) => {
    const failure = new Error(message);
    failure.statusCode = 422;
    throw failure;
  };
  if (!EU_COUNTRIES.includes(country)) error("La consulta de tarifas está limitada a los países de la UE.");
  // CJ supports country-only preliminary ES queries for historical compatibility.
  // A non-Spanish EU estimate always needs a postal code.
  if (!postalCode && country !== "ES") error("Introduce el código postal del destino europeo.");
  if (postalCode && !/^[A-Z0-9][A-Z0-9 -]{0,13}[A-Z0-9]$/.test(postalCode))
    error("El código postal tiene un formato no admitido.");
  if (country === "ES" && postalCode && !/^\d{5}$/.test(postalCode))
    error("El código postal de España debe tener cinco cifras.");
  return {
    destination:country, zip:postalCode,
    origin:"CN", quantity:1,
    checkoutEnabled:false, // A preview never authorizes customer charging.
    manualReviewRequired:true,
    disclaimer:"Solo presupuesto informativo del proveedor. No reserva stock, no valida IVA/IOSS por destino ni autoriza pedidos.",
  };
}
