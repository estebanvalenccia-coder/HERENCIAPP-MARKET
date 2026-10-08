import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { StripeCheckout } from "../components/StripeCheckout";
import { backendApi, backendStorage } from "../lib/backendStorage";
import { parseShippingSettings, shippingQuoteForCart } from "../../../backend/shippingPolicy.js";
import { enrichCartWithCatalog, isCjSupplierItem } from "../lib/cjFulfillmentIdentity.js";

const DELIVERY_SLOTS = ["09:00-12:00", "12:00-15:00", "15:00-18:00", "18:00-21:00"];
const todayInMadrid = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const isServiceItem = (item: any) =>
  item?.serviceBooking === true ||
  item?.type === "service" ||
  item?.collection === "servicios" ||
  (Array.isArray(item?.collections) && item.collections.includes("servicios")) ||
  String(item?.category || "").toLowerCase() === "servicios";

const serviceHoursOf = (item: any) => {
  const min = Math.max(1, Number(item?.serviceMinHours ?? item?.metadata?.serviceMinHours ?? 1));
  const max = Math.max(min, Number(item?.serviceMaxHours ?? item?.metadata?.serviceMaxHours ?? 3));
  const raw = Number(item?.serviceHours ?? (isServiceItem(item) ? item?.quantity : 1) ?? min);
  return Math.min(max, Math.max(min, Number.isFinite(raw) ? raw : min));
};

const lineTotal = (item: any) =>
  isServiceItem(item)
    ? Number(item?.unitPrice ?? item?.price ?? 0) * serviceHoursOf(item)
    : Number(item?.price || 0) * Math.max(1, Number(item?.quantity || 1));

function trackSalesPurchase(amount: number, conversationId = "") {
  try {
    if (localStorage.getItem("herencia_cookie_consent") !== "accepted") return;
    void fetch("/api/analytics/visit", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "sales_purchase",
        eventLabel: "Compra atribuida a HERENCIA SALES",
        amount,
        sessionId: conversationId,
        path: window.location.pathname + window.location.search,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
        language: navigator.language || "",
        metadata: { source: "HERENCIA_SALES" },
      }),
    });
  } catch {
    // La analítica no bloquea el checkout.
  }
}

export function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();

  const paymentMethod = location.state?.paymentMethod || "tarjeta";
  const discount = Math.max(0, Number(location.state?.discount || 0));
  const coupon = String(location.state?.coupon || "");
  const isStripePayment = ["tarjeta", "bizum", "alternativos"].includes(paymentMethod);

  const cartItems = useMemo(() => {
    try {
      const parsed = JSON.parse(backendStorage.getItem("cart") || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);

  const hasServices = useMemo(() => cartItems.some(isServiceItem), [cartItems]);
  const hasPhysicalItems = useMemo(() => cartItems.some((item: any) => !isServiceItem(item)), [cartItems]);
  const onlyServices = hasServices && !hasPhysicalItems;
  // Refresh fulfillment metadata: persisted cart lines can omit CJ supplier fields.
  const [shippingCatalog, setShippingCatalog] = useState<any[] | null>(null);
  const [shippingCatalogError, setShippingCatalogError] = useState("");
  useEffect(() => {
    let active = true;
    backendApi.listCommerceProducts()
      .then(({ products }) => {
        if (!active) return;
        if (!Array.isArray(products)) throw new Error("Catálogo no disponible");
        setShippingCatalog(products);
        setShippingCatalogError("");
      })
      .catch(() => {
        if (active) setShippingCatalogError("No podemos verificar el tipo de envío de los artículos. Recarga el checkout antes de pagar.");
      });
    return () => { active = false; };
  }, []);
  const shippingCartItems = useMemo(
    () => enrichCartWithCatalog(cartItems, shippingCatalog),
    [cartItems, shippingCatalog],
  );
  const hasCjItems = useMemo(() => shippingCartItems.some(isCjSupplierItem), [shippingCartItems]);
  const cjOnly = useMemo(() => shippingCartItems.length > 0 && shippingCartItems.every(isCjSupplierItem), [shippingCartItems]);
  const mixedCjCart = hasCjItems && !cjOnly;
  const shippingCatalogPending = hasPhysicalItems && shippingCatalog === null;
  const deliveryMethod = onlyServices ? "servicio" : "envio";

  const salesAttribution = useMemo(() => {
    const attributed = cartItems.filter((item: any) => String(item?.salesSource || "") === "HERENCIA_SALES");
    return {
      enabled: attributed.length > 0,
      conversationId: String(attributed.find((item: any) => item?.salesConversationId)?.salesConversationId || ""),
      itemCount: attributed.reduce((sum: number, item: any) => sum + (isServiceItem(item) ? serviceHoursOf(item) : Math.max(1, Number(item?.quantity || 1))), 0),
    };
  }, [cartItems]);

  const [loading, setLoading] = useState(false);
  const [showStripe, setShowStripe] = useState(false);
  const [shippingCost, setShippingCost] = useState(5);
  const [shippingPolicy, setShippingPolicy] = useState(() => parseShippingSettings(backendStorage.getItem("shippingSettings")));
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");
  const [deliveryAvailability, setDeliveryAvailability] = useState<any>(null);
  const [deliveryAvailabilityLoading, setDeliveryAvailabilityLoading] = useState(false);
  const [deliveryAvailabilityError, setDeliveryAvailabilityError] = useState("");
  const [businessSuite, setBusinessSuite] = useState<any>({});
  const [shippingInfo, setShippingInfo] = useState<{
    distanceText?: string;
    durationText?: string;
    distanceKm?: number;
    destination?: string;
  } | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "Barcelona",
    postalCode: "",
    province: "Barcelona",
    notes: "",
    requestedDate: "",
    requestedTimeSlot: "",
    deliveryInstructions: "",
  });

  useEffect(() => {
    try {
      setBusinessSuite(JSON.parse(backendStorage.getItem("businessSuiteSettings") || "{}"));
    } catch {
      setBusinessSuite({});
    }
    try {
      const savedShipping = backendStorage.getItem("shippingSettings");
      if (savedShipping) {
        const settings = JSON.parse(savedShipping);
        setShippingPolicy(parseShippingSettings(settings));
        const cost = Number(settings.cost);
        if (Number.isFinite(cost) && cost >= 0) setShippingCost(cost);
      }
    } catch (error) {
      console.warn("No se pudo leer shippingSettings", error);
    }
  }, []);

  useEffect(() => {
    if (shippingCatalogPending) {
      // Do not quote local Barcelona delivery until we know whether CJ fulfills the cart.
      setShippingCost(0);
      setShippingInfo(null);
      setShippingLoading(false);
      setShippingError("");
      return;
    }
    if (cjOnly) {
      setShippingCost(0);
      setShippingInfo({ distanceText: "Envío directo CJ a España", destination: "España" });
      setShippingError("");
      setShippingLoading(false);
      return;
    }
    if (!hasPhysicalItems) {
      setShippingCost(0);
      setShippingInfo(null);
      setShippingError("");
      setShippingLoading(false);
      return;
    }

    const hasMinimumAddress = form.address.trim().length >= 5 && form.postalCode.trim().length >= 4;
    if (!hasMinimumAddress) {
      setShippingInfo(null);
      setShippingError("");
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        setShippingLoading(true);
        setShippingError("");

        const result = await backendApi.calculateShipping({
          address: form.address,
          city: form.city || "Barcelona",
          postalCode: form.postalCode,
          province: form.province || "Barcelona",
        });

        const calculatedDistance = Number(result.distanceKm || 0);
        const maxDeliveryKm = Math.max(0, Number(businessSuite.maxDeliveryKm || 0));
        if (maxDeliveryKm > 0 && calculatedDistance > maxDeliveryKm) {
          throw new Error(`Esta dirección está fuera de nuestro radio de reparto de ${maxDeliveryKm} km`);
        }

        const physicalSubtotal = cartItems
          .filter((item: any) => !isServiceItem(item))
          .reduce((sum: number, item: any) => sum + lineTotal(item), 0);
        const freeShippingFrom = Math.max(0, Number(businessSuite.freeShippingFrom || 0));
        const oldShipping = freeShippingFrom > 0 && physicalSubtotal >= freeShippingFrom ? 0 : Number(result.price || 0);
        const nextShipping = shippingPolicy.advancedEnabled
          ? shippingQuoteForCart({
              settings: shippingPolicy, lines: cartItems.map((item:any) => ({
                ...item, type: isServiceItem(item) ? "service" : "product",
                category: item.category || item.collection || item.collections?.[0] || ""
              })),
              distanceKm: calculatedDistance, legacyPrice: Number(result.price || 0)
            })
          : oldShipping;
        setShippingCost(nextShipping);
        setShippingInfo({
          distanceText: result.distanceText,
          durationText: result.durationText,
          distanceKm: result.distanceKm,
          destination: result.destination,
        });
      } catch (error: any) {
        console.error("No se pudo calcular el envío con Maps", error);
        setShippingInfo(null);
        setShippingError(error?.message || "No se pudo calcular el envío. Revisa la dirección.");
      } finally {
        setShippingLoading(false);
      }
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [
    hasPhysicalItems,
    cjOnly,
    shippingCatalogPending,
    form.address,
    form.city,
    form.postalCode,
    form.province,
    businessSuite.freeShippingFrom,
    businessSuite.maxDeliveryKm,
    shippingPolicy,
    cartItems,
  ]);

  useEffect(() => {
    if (
      !hasPhysicalItems ||
      cjOnly ||
      !form.requestedDate ||
      businessSuite.scheduledOrdersEnabled === false
    ) {
      setDeliveryAvailability(null);
      setDeliveryAvailabilityError("");
      return;
    }

    let active = true;
    setDeliveryAvailabilityLoading(true);
    setDeliveryAvailabilityError("");

    backendApi.deliveryAvailability(form.requestedDate)
      .then((result) => {
        if (!active) return;
        setDeliveryAvailability(result);
        const selected = result.slots?.find((slot: any) => slot.slot === form.requestedTimeSlot);
        if (form.requestedTimeSlot && selected && !selected.available) {
          setForm((current) => ({ ...current, requestedTimeSlot: "" }));
          toast.info("Esa franja acaba de llenarse. Elige otra.");
        }
      })
      .catch((error: any) => {
        if (!active) return;
        setDeliveryAvailability(null);
        setDeliveryAvailabilityError(error?.message || "No hay reparto disponible para ese día.");
      })
      .finally(() => {
        if (active) setDeliveryAvailabilityLoading(false);
      });

    return () => { active = false; };
  }, [form.requestedDate, form.requestedTimeSlot, hasPhysicalItems, cjOnly, businessSuite.scheduledOrdersEnabled]);

  const subtotal = cartItems.reduce((sum: number, item: any) => sum + lineTotal(item), 0);
  const shipping = hasPhysicalItems ? shippingCost : 0;
  const total = Math.max(0, subtotal - discount + shipping);

  const handleChange = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validateForm = () => {
    if (shippingCatalogPending || shippingCatalogError) {
      toast.error(shippingCatalogError || "Espera a que verifiquemos el envío antes de continuar.");
      return false;
    }
    if (mixedCjCart) {
      toast.error("El envío directo de CJ y los productos de reparto local deben comprarse en pedidos separados.");
      return false;
    }
    if (!cartItems.length) {
      toast.error("Tu carrito está vacío");
      navigate("/carrito");
      return false;
    }

    if (!form.name || !form.email || !form.phone) {
      toast.error("Completa tus datos");
      return false;
    }

    if (!form.address) {
      toast.error(onlyServices ? "Introduce la dirección donde se realizará el servicio" : "Introduce la dirección de entrega");
      return false;
    }

    if (hasPhysicalItems && !cjOnly && shippingLoading) {
      toast.error("Espera un momento, estamos calculando el envío");
      return false;
    }

    if (hasPhysicalItems && !cjOnly && shippingError) {
      toast.error("Revisa la dirección de envío antes de continuar");
      return false;
    }

    if (hasPhysicalItems && !cjOnly && form.requestedDate && deliveryAvailabilityError) {
      toast.error(deliveryAvailabilityError);
      return false;
    }

    if (hasPhysicalItems && !cjOnly && deliveryAvailabilityLoading) {
      toast.error("Espera un momento, estamos comprobando la capacidad de reparto");
      return false;
    }

    if (onlyServices && !form.requestedDate) {
      toast.error("Elige una fecha deseada para el servicio");
      return false;
    }

    return true;
  };

  const clearCart = async () => {
    const result = await backendStorage.setItem("cart", JSON.stringify([]));
    if (!result.ok) {
      console.warn("El pedido se guardó, pero no se pudo limpiar el carrito remoto:", result.error);
    }
  };

  const orderMetadata = {
    source: "frontend_checkout",
    herenciaSales: salesAttribution.enabled,
    salesConversationId: salesAttribution.conversationId || null,
    salesAttributedItems: salesAttribution.itemCount,
    discount,
    coupon: coupon || null,
    phone: form.phone,
    notes: form.notes,
    serviceBooking: hasServices,
    serviceOnly: onlyServices,
    shippingDistance: hasPhysicalItems ? shippingInfo : null,
    requestedDate: cjOnly ? null : form.requestedDate || null,
    requestedTimeSlot: cjOnly ? null : form.requestedTimeSlot || null,
    deliveryInstructions: hasPhysicalItems ? form.deliveryInstructions || null : null,
    serviceAddress: hasServices
      ? {
          address: form.address,
          city: form.city,
          postalCode: form.postalCode,
          province: form.province,
        }
      : null,
    shippingAddress: hasPhysicalItems
      ? {
          address: form.address,
          city: form.city,
          postalCode: form.postalCode,
          province: form.province,
          country: "ES",
          name: form.name,
          phone: form.phone,
        }
      : null,
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    if (isStripePayment || (coupon && total === 0)) {
      setShowStripe(true);
      return;
    }

    try {
      setLoading(true);
      await backendApi.createOrder({
        customerName: form.name,
        customerEmail: form.email,
        paymentMethod,
        deliveryMethod,
        status: paymentMethod === "transferencia" ? "pending_transfer_review" : "pending_store_confirmation",
        subtotal,
        shipping,
        total,
        items: cartItems,
        metadata: orderMetadata,
      });

      if (salesAttribution.enabled) trackSalesPurchase(total, salesAttribution.conversationId);
      await clearCart();
      toast.success(onlyServices ? "Reserva recibida. Queda pendiente de confirmación 🌿" : "Pedido recibido. Queda pendiente de confirmación 🌿");
      navigate("/");
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || (onlyServices ? "No se pudo procesar la reserva" : "No se pudo procesar el pedido"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#fbfaf6] text-[#173126]">
      <div className="border-b border-[#ded9cd] bg-[#f4f1e8]">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#718076]">HERENCIA MARKET</p>
          <h1 className="mt-2 text-4xl font-medium">
            {onlyServices ? "Confirma tu reserva" : hasServices ? "Finaliza tu compra y reserva" : "Finaliza tu compra"}
          </h1>
          <p className="mt-2 text-sm text-[#66736b]">
            {onlyServices
              ? "Indica dónde y cuándo necesitas el servicio y realiza el pago de las horas reservadas."
              : hasServices
                ? "Datos de entrega, reserva de servicios y pago en un solo paso."
                : "Datos de entrega, horario y pago en un solo paso."}
          </p>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-4 py-10 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-[#dfdbd1] bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-2xl font-black">
            {onlyServices ? "Datos de la reserva" : hasServices ? "Entrega y servicio" : "Datos de entrega"}
          </h2>

          <div className="space-y-4">
            <input className="w-full rounded-2xl border border-[#ded9cd] bg-[#fbfaf6] p-3 outline-none focus:border-[#315b42]" placeholder="Nombre completo" value={form.name} onChange={(e) => handleChange("name", e.target.value)} />
            <input className="w-full rounded-2xl border border-[#ded9cd] bg-[#fbfaf6] p-3 outline-none focus:border-[#315b42]" placeholder="Correo electrónico" value={form.email} onChange={(e) => handleChange("email", e.target.value)} />
            <input className="w-full rounded-2xl border border-[#ded9cd] bg-[#fbfaf6] p-3 outline-none focus:border-[#315b42]" placeholder="Teléfono" value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} />

            <div className="rounded-2xl border border-[#ded9cd] bg-[#fbfaf6] p-4">
              <p className="mb-3 text-sm font-black">
                {onlyServices ? "¿Dónde se realizará el servicio?" : hasServices ? "Dirección de entrega / servicio" : "Dirección de entrega"}
              </p>
              <div className="space-y-3">
                <input className="w-full rounded-2xl border border-[#ded9cd] bg-white p-3 outline-none focus:border-[#315b42]" placeholder="Dirección" value={form.address} onChange={(e) => handleChange("address", e.target.value)} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className="w-full rounded-2xl border border-[#ded9cd] bg-white p-3 outline-none focus:border-[#315b42]" placeholder="Ciudad" value={form.city} onChange={(e) => handleChange("city", e.target.value)} />
                  <input className="w-full rounded-2xl border border-[#ded9cd] bg-white p-3 outline-none focus:border-[#315b42]" placeholder="Código postal" value={form.postalCode} onChange={(e) => handleChange("postalCode", e.target.value)} />
                </div>
                <input className="w-full rounded-2xl border border-[#ded9cd] bg-white p-3 outline-none focus:border-[#315b42]" placeholder="Provincia" value={form.province} onChange={(e) => handleChange("province", e.target.value)} />
              </div>
            </div>

            {hasPhysicalItems && (
              <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm">
                {shippingCatalogPending ? (
                  <p className="text-muted-foreground">{shippingCatalogError || "Verificando el envío real de los productos..."}</p>
                ) : cjOnly ? (
                  <div className="space-y-1">
                    <p className="font-semibold text-emerald-800">Envío directo de CJdropshipping a España</p>
                    <p className="text-muted-foreground">El transporte está previsto dentro del precio del artículo. Antes de aceptar el pago, verificaremos el coste de CJ para tu código postal y que el producto siga disponible.</p>
                    <p className="font-medium">Revisa la ciudad, provincia y código postal: CJ usará exactamente esos datos para entregar el paquete.</p>
                  </div>
                ) : shippingLoading ? (
                  <p className="text-muted-foreground">Calculando envío con Google Maps...</p>
                ) : shippingError ? (
                  <p className="text-destructive">{shippingError}</p>
                ) : shippingInfo ? (
                  <div className="space-y-1">
                    <p className="font-semibold">Envío calculado: €{shippingCost.toFixed(2)}</p>
                    <p className="text-muted-foreground">
                      Distancia: {shippingInfo.distanceText || `${shippingInfo.distanceKm} km`}
                      {shippingInfo.durationText ? ` · Tiempo estimado: ${shippingInfo.durationText}` : ""}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Introduce dirección y código postal para calcular el envío de los productos físicos.</p>
                )}
              </div>
            )}

            {!cjOnly && businessSuite.scheduledOrdersEnabled !== false && (
              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium">
                    {onlyServices ? "Fecha deseada del servicio" : hasServices ? "Fecha deseada" : "Fecha deseada"}
                    <input type="date" min={todayInMadrid()} value={form.requestedDate} onChange={(e) => handleChange("requestedDate", e.target.value)} className="mt-2 w-full rounded-2xl border border-[#ded9cd] bg-[#fbfaf6] p-3 outline-none focus:border-[#315b42]" />
                  </label>
                  <label className="text-sm font-medium">
                    {onlyServices ? "Franja preferida" : "Franja horaria"}
                    <select value={form.requestedTimeSlot} onChange={(e) => handleChange("requestedTimeSlot", e.target.value)} disabled={hasPhysicalItems && deliveryAvailabilityLoading} className="mt-2 w-full rounded-2xl border border-[#ded9cd] bg-[#fbfaf6] p-3 outline-none focus:border-[#315b42] disabled:opacity-60">
                      <option value="">
                        {hasPhysicalItems && deliveryAvailabilityLoading ? "Comprobando disponibilidad…" : "Sin preferencia"}
                      </option>
                      {DELIVERY_SLOTS.map((slot) => {
                        const availability = hasPhysicalItems
                          ? deliveryAvailability?.slots?.find((entry: any) => entry.slot === slot)
                          : null;
                        const disabled = availability ? !availability.available : false;
                        const label = slot.replace("-", "–") + (
                          availability
                            ? disabled
                              ? " · completo"
                              : ` · quedan ${availability.remaining}`
                            : ""
                        );
                        return <option key={slot} value={slot} disabled={disabled}>{label}</option>;
                      })}
                    </select>
                  </label>
                </div>
                {hasPhysicalItems && deliveryAvailabilityError && <p className="text-sm text-destructive">{deliveryAvailabilityError}</p>}
                {hasPhysicalItems && deliveryAvailability?.capacity && (
                  <p className="text-xs text-muted-foreground">Capacidad máxima por franja: {deliveryAvailability.capacity} pedidos.</p>
                )}
              </div>
            )}

            {hasPhysicalItems && (
              <textarea className="min-h-[90px] w-full rounded-2xl border border-[#ded9cd] bg-[#fbfaf6] p-3 outline-none focus:border-[#315b42]" placeholder="Instrucciones de entrega: no llamar, dejar con portero, sorpresa…" value={form.deliveryInstructions} onChange={(e) => handleChange("deliveryInstructions", e.target.value)} />
            )}
            <textarea
              className="min-h-[120px] w-full rounded-2xl border border-[#ded9cd] bg-[#fbfaf6] p-3 outline-none focus:border-[#315b42]"
              placeholder={onlyServices ? "Cuéntanos qué necesitas, tamaño del espacio, plantas, limpieza o cualquier detalle útil…" : "Notas para el pedido"}
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="sticky top-28 h-fit rounded-[2rem] border border-[#dfdbd1] bg-white p-6 shadow-sm">
            <h2 className="mb-6 text-2xl font-bold">{onlyServices ? "Resumen de la reserva" : "Resumen del pedido"}</h2>

            <div className="mb-6 space-y-3">
              {cartItems.length ? (
                cartItems.map((item: any) => {
                  const service = isServiceItem(item);
                  const hours = serviceHoursOf(item);
                  return (
                    <div key={item.lineKey || item.id} className="flex justify-between gap-3">
                      <span>
                        {item.name}
                        {service ? ` · ${hours} ${hours === 1 ? "hora" : "horas"}` : ` x${item.quantity}`}
                      </span>
                      <span>€{lineTotal(item).toFixed(2)}</span>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">No hay productos ni servicios en el carrito.</p>
              )}
            </div>

            <div className="space-y-2 border-t pt-4">
              <div className="flex justify-between">
                <span>{onlyServices ? "Servicios reservados" : "Subtotal"}</span>
                <span>€{subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Descuento</span><span>−€{discount.toFixed(2)}</span>
                </div>
              )}
              {hasPhysicalItems && (
                <>
                  <div className="flex justify-between">
                    <span>Envío</span>
                    <span>{shippingCatalogPending ? "Verificando..." : shippingLoading ? "Calculando..." : shipping === 0 ? "Incluido / gratis" : `€${shipping.toFixed(2)}`}</span>
                  </div>
                  {shippingInfo && !shippingLoading && (
                    <div className="text-right text-xs text-muted-foreground">
                      {shippingInfo.distanceText}{shippingInfo.durationText ? ` · ${shippingInfo.durationText}` : ""}
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between pt-2 text-lg font-bold">
                <span>{onlyServices ? "Total de la reserva" : "Total"}</span>
                <span>€{total.toFixed(2)}</span>
              </div>
            </div>

            {onlyServices && (
              <p className="mt-4 rounded-2xl bg-[#f4f1e8] p-3 text-xs leading-5 text-[#6c786f]">
                Este importe corresponde a las horas reservadas. Si el servicio necesita más tiempo, las horas adicionales se cobrarán posteriormente.
              </p>
            )}

            {!showStripe && (
              <button
                onClick={handleSubmit}
                disabled={loading || shippingCatalogPending || (hasPhysicalItems && shippingLoading) || !cartItems.length}
                className="mt-6 w-full rounded-full bg-[#315b42] py-3.5 font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Procesando..."
                  : shippingCatalogPending
                    ? shippingCatalogError || "Verificando envío..."
                    : hasPhysicalItems && shippingLoading
                    ? "Calculando envío..."
                    : coupon && total === 0
                      ? "Confirmar pedido gratuito"
                      : isStripePayment
                      ? onlyServices
                        ? "Pagar y reservar"
                        : "Continuar al pago seguro"
                      : onlyServices
                        ? "Confirmar reserva"
                        : "Confirmar pedido"}
              </button>
            )}
          </div>

          {showStripe && (
            <StripeCheckout
              paymentMethod={paymentMethod}
              amount={total}
              customerName={form.name}
              customerEmail={form.email}
              deliveryMethod={deliveryMethod}
              subtotal={subtotal}
              shipping={shipping}
              items={cartItems}
              metadata={{
                ...orderMetadata,
                requestedPaymentMethod: paymentMethod,
              }}
              onCancel={() => setShowStripe(false)}
              onSuccess={({ orderId, paymentIntentId, status }) => {
                if (salesAttribution.enabled) trackSalesPurchase(total, salesAttribution.conversationId);
                if (status === "succeeded") {
                  toast.success(onlyServices ? "Reserva pagada correctamente 🌿" : "Pago realizado correctamente 🌿");
                } else {
                  toast.info("Pago en proceso. No vuelvas a pagar este pedido.");
                }
                navigate(`/pedido-confirmado?orderId=${encodeURIComponent(orderId)}&paymentIntentId=${encodeURIComponent(paymentIntentId)}&status=${encodeURIComponent(status)}`);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
