import { trackTikTokCommerceEvent, trackTikTokConfirmedPurchase } from "../lib/tiktokPixel";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { StripeCheckout } from "../components/StripeCheckout";
import { backendApi, backendStorage } from "../lib/backendStorage";
import { parseShippingSettings, shippingQuoteForCart } from "../../../backend/shippingPolicy.js";
import { localPickupSettings } from "../../../backend/localPickupPolicy.js";
import { isCarrierEligibleProduct } from "../../../backend/catalogShippingRules.js";
import { enrichCartWithCatalog, isCjSupplierItem, validateCjCartComposition } from "../lib/cjFulfillmentIdentity.js";
import { firstUnselectedPrintfulItem } from "../lib/printfulVariantSelection.js";

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
        eventLabel: "Compra atribuida a Tropical Sales",
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
  const cjComposition = useMemo(() => validateCjCartComposition(shippingCartItems), [shippingCartItems]);
  const printfulIssue = useMemo(() => firstUnselectedPrintfulItem(shippingCartItems), [shippingCartItems]);
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
  const [pickupSelected, setPickupSelected] = useState(false);
  const [courierOptions,setCourierOptions] = useState<Array<{code:string,name:string,carrier:string,price:number,currency:string}>>([]);
  const [courierSelected,setCourierSelected] = useState("");
  const [manualOptions,setManualOptions] = useState<Array<{
    method:string,service:string,label:string,carrier:string,price:number,currency:string,
    requiresMerchantBooking:boolean}>>([]);
  const [manualSelected,setManualSelected] = useState("");
  const [courierLoading,setCourierLoading] = useState(false);
  const [courierError,setCourierError] = useState("");
  const [pointLoading,setPointLoading] = useState(false);
  const [servicePoints,setServicePoints] = useState<Array<{id:number,name:string,carrier:string,street:string,city:string,postalCode:string}>>([]);
  const [servicePointId,setServicePointId] = useState<number|null>(null);
  const [pickupPointsVisible,setPickupPointsVisible] = useState(false);
  const pickupSettings = useMemo(() => localPickupSettings(shippingPolicy), [shippingPolicy]);
  const localPickupAllowed = pickupSettings.enabled && hasPhysicalItems && !hasServices &&
    !shippingCatalogPending && !hasCjItems &&
    shippingCartItems.every((item: any) => {
      const supplier = [item?.metadata?.provider, item?.provider, item?.supplierType,
        item?.metadata?.supplier, item?.fulfillmentProvider].filter(Boolean).join(" ").toLowerCase();
      return !/cj|aliexpress|printful|dropship|supplier|external/.test(supplier);
    });
  useEffect(() => {
    if (!localPickupAllowed && pickupSelected) setPickupSelected(false);
  }, [localPickupAllowed, pickupSelected]);

  const ownedCart = hasPhysicalItems && !hasServices && !hasCjItems && !shippingCatalogPending &&
    !mixedCjCart && shippingCartItems.length>0;
  const courierEligible = ownedCart && shippingPolicy?.sendcloud?.checkoutEnabled === true &&
    shippingCartItems.every(isCarrierEligibleProduct);
  const manualEligible = ownedCart && shippingPolicy?.manualDelivery?.enabled === true;
  const shippingMethodsEligible = courierEligible || manualEligible;
  const selectedCourier = courierOptions.find(o=>o.code===courierSelected) || null;
  const selectedManual = manualOptions.find(o=>o.service===manualSelected) || null;
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
  useEffect(()=>{
    setCourierSelected("");
    setCourierOptions([]);
    setManualSelected("");
    setManualOptions([]);
    setCourierError("");
    setCourierLoading(false);
    if(!shippingMethodsEligible || !/^\d{5}$/.test(form.postalCode.trim()))return;
    let active=true;
    const timer=window.setTimeout(async()=>{
      setCourierLoading(true);
      try{
        const response=await fetch("/api/shipping/carriers/quotes",{
          method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({postalCode:form.postalCode,items:shippingCartItems.map((item:any)=>({id:item.id,quantity:item.quantity})),
            ...(servicePointId ? {servicePointId}:{}),}),
        });
        if(!response.ok)throw new Error("Consulta temporalmente no disponible");
        const data=await response.json();
        if(active) {
          setCourierOptions((data.quotes||[]).filter((q:any)=>
            typeof q.price==="number" && Number.isFinite(q.price) && q.currency==="EUR"));
          setManualOptions((data.manualOptions||[]).filter((q:any)=>
            q.method==="manual_shipping" && typeof q.price==="number" && Number.isFinite(q.price) && q.currency==="EUR"));
        }
      }catch(error){
        if(active){
          setCourierOptions([]);
          setManualOptions([]);
          setCourierError(error instanceof Error ? error.message : "No se pudieron consultar las tarifas de envío");
        }
      }
      finally{if(active)setCourierLoading(false);}
    },600);
    return ()=>{active=false;window.clearTimeout(timer);};
  },[shippingMethodsEligible,form.postalCode,shippingCartItems,servicePointId]);
  useEffect(()=>{
    setServicePoints([]);setServicePointId(null);setPickupPointsVisible(false);
  },[form.postalCode, courierEligible]);
  const loadPickupPoints=async()=>{
    if(!courierEligible||!/^\d{5}$/.test(form.postalCode))return;
    setPointLoading(true);setPickupPointsVisible(true);setServicePointId(null);
    try{
      const response=await fetch("/api/shipping/carriers/points",{
        method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({postalCode:form.postalCode,items:shippingCartItems.map((x:any)=>({id:x.id,quantity:x.quantity}))}),
      });
      if(!response.ok)throw new Error("Puntos no disponibles");
      const data=await response.json();
      setServicePoints((data.points||[]).slice(0,15));
    }catch{setServicePoints([]);}
    finally{setPointLoading(false);}
  };


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
    if (pickupSelected && localPickupAllowed) {
      setShippingCost(0);
      setShippingInfo(null);
      setShippingError("");
      setShippingLoading(false);
      return;
    }
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
    pickupSelected,
    localPickupAllowed,
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
      (pickupSelected && localPickupAllowed) ||
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
  }, [form.requestedDate, form.requestedTimeSlot, hasPhysicalItems, cjOnly, pickupSelected, localPickupAllowed, businessSuite.scheduledOrdersEnabled]);

  const subtotal = cartItems.reduce((sum: number, item: any) => sum + lineTotal(item), 0);
  const fullCouponDiscount = Boolean(coupon && subtotal > 0 && discount >= subtotal - 0.001);
  // Existing home delivery calculation remains unchanged.
  const shipping = hasPhysicalItems && !fullCouponDiscount ? shippingCost : 0;
  const checkoutShipping = fullCouponDiscount || (pickupSelected && localPickupAllowed) ? 0 : selectedManual ? selectedManual.price : selectedCourier ? selectedCourier.price : shipping;
  const total = Math.max(0, subtotal - discount + checkoutShipping);

  // A checkout can also be entered directly, without the cart page button.
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (checkoutTracked.current || !cartItems.length) return;
    if (shippingCatalogPending || (hasPhysicalItems && shippingLoading)) return;
    checkoutTracked.current = true;
    trackTikTokCommerceEvent("InitiateCheckout", cartItems.map((item: any) => ({
      id: item.id, price: item.unitPrice ?? item.price, quantity: item.quantity
    })), total);
  }, [cartItems, total, shippingCatalogPending, hasPhysicalItems, shippingLoading]);


  const handleChange = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validateForm = () => {
    if (printfulIssue) {
      toast.error("Antes de pagar, selecciona explícitamente el color y la talla.");
      navigate(`/producto/${printfulIssue.id}`);
      return false;
    }
    if (shippingCatalogPending || shippingCatalogError) {
      toast.error(shippingCatalogError || "Espera a que verifiquemos el envío antes de continuar.");
      return false;
    }
    if (!cjComposition.valid) {
      toast.error(cjComposition.message);
      return false;
    }
    if (hasCjItems && !isStripePayment && !(coupon && total === 0)) {
      toast.error("Los pedidos CJ necesitan tarjeta o Bizum verificado antes de crear el pedido al proveedor.");
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

    if (!form.address && !(pickupSelected && localPickupAllowed)) {
      toast.error(onlyServices ? "Introduce la dirección donde se realizará el servicio" : "Introduce la dirección de entrega");
      return false;
    }

    // CJ requires a real ES postal code; reject locally before initializing Stripe.
    if (hasCjItems && !/^\d{5}$/.test(form.postalCode.trim())) {
      toast.error("Para el envío CJ introduce un código postal español de 5 dígitos (por ejemplo, 08032).");
      return false;
    }

    if (hasPhysicalItems && !cjOnly && !pickupSelected && !selectedCourier && !selectedManual && shippingLoading) {
      toast.error("Espera un momento, estamos calculando el envío");
      return false;
    }

    if (hasPhysicalItems && !cjOnly && !pickupSelected && !selectedCourier && !selectedManual && shippingError) {
      toast.error("Revisa la dirección de envío antes de continuar");
      return false;
    }

    if (hasPhysicalItems && !cjOnly && !pickupSelected && !selectedCourier && !selectedManual && form.requestedDate && deliveryAvailabilityError) {
      toast.error(deliveryAvailabilityError);
      return false;
    }

    if (hasPhysicalItems && !cjOnly && !pickupSelected && !selectedCourier && !selectedManual && deliveryAvailabilityLoading) {
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
    tiktokConsent: (() => { try { return localStorage.getItem("herencia_cookie_consent") === "accepted" && localStorage.getItem("herencia_ads_consent_v1") === "accepted"; } catch { return false; } })(),
    herenciaSales: salesAttribution.enabled,
    salesConversationId: salesAttribution.conversationId || null,
    salesAttributedItems: salesAttribution.itemCount,
    discount,
    coupon: coupon || null,
    phone: form.phone,
    notes: form.notes,
    serviceBooking: hasServices,
    serviceOnly: onlyServices,
    shippingDistance: hasPhysicalItems && !pickupSelected ? shippingInfo : null,
    shippingChoice: pickupSelected && localPickupAllowed ? { method: "local_pickup" } : selectedManual ? {method:"manual_shipping",service:selectedManual.service} : selectedCourier ? { method:"sendcloud",optionCode:selectedCourier.code,
      ...(servicePointId ? {servicePointId}: {}) } : { method:"delivery" },
    requestedDate: cjOnly || pickupSelected || selectedCourier || selectedManual ? null : form.requestedDate || null,
    requestedTimeSlot: cjOnly || pickupSelected || selectedCourier || selectedManual ? null : form.requestedTimeSlot || null,
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
          address: pickupSelected && localPickupAllowed ? "Recogida local en Horta" : form.address,
          city: pickupSelected && localPickupAllowed ? "Barcelona" : form.city,
          postalCode: pickupSelected && localPickupAllowed ? "08032" : form.postalCode,
          province: pickupSelected && localPickupAllowed ? "Barcelona" : form.province,
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
        shipping: checkoutShipping,
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
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#718076]">Tropical Plants</p>
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

            {localPickupAllowed && (
              <fieldset className="rounded-2xl border border-[#ded9cd] bg-emerald-50/40 p-4">
                <legend className="font-black">¿Cómo quieres recibir tu compra?</legend>
                <label className="mt-2 flex cursor-pointer gap-3 text-sm"><input type="radio" name="delivery-choice" checked={!pickupSelected} onChange={() => setPickupSelected(false)} /> Envío a domicilio</label>
                <label className="mt-2 flex cursor-pointer gap-3 text-sm"><input type="radio" name="delivery-choice" checked={pickupSelected} onChange={() => setPickupSelected(true)} /> {pickupSettings.label} · Gratis</label>
                {pickupSelected && <p className="mt-3 text-sm text-emerald-800">{pickupSettings.instructions}</p>}
              </fieldset>
            )}
            {!(pickupSelected && localPickupAllowed) && (
            <div className="rounded-2xl border border-[#ded9cd] bg-[#fbfaf6] p-4">
              <p className="mb-3 text-sm font-black">
                {onlyServices ? "¿Dónde se realizará el servicio?" : hasServices ? "Dirección de entrega / servicio" : "Dirección de entrega"}
              </p>
              <div className="space-y-3">
                <input className="w-full rounded-2xl border border-[#ded9cd] bg-white p-3 outline-none focus:border-[#315b42]" placeholder="Dirección" value={form.address} onChange={(e) => handleChange("address", e.target.value)} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className="w-full rounded-2xl border border-[#ded9cd] bg-white p-3 outline-none focus:border-[#315b42]" placeholder="Ciudad" value={form.city} onChange={(e) => handleChange("city", e.target.value)} />
                  <input inputMode="numeric" autoComplete="postal-code" maxLength={10} className="w-full rounded-2xl border border-[#ded9cd] bg-white p-3 outline-none focus:border-[#315b42]" placeholder="Código postal" value={form.postalCode} onChange={(e) => handleChange("postalCode", e.target.value)} />
                </div>
                <input className="w-full rounded-2xl border border-[#ded9cd] bg-white p-3 outline-none focus:border-[#315b42]" placeholder="Provincia" value={form.province} onChange={(e) => handleChange("province", e.target.value)} />
              </div>
            </div>
            )}

            {shippingMethodsEligible && !pickupSelected && (
              <fieldset className="space-y-2 rounded-2xl border border-[#ded9cd] bg-[#fbfaf6] p-4">
                <legend className="font-black">Elige cómo quieres recibir tu pedido</legend>
                <label className="flex cursor-pointer gap-3 text-sm">
                  <input type="radio" name="courier-choice" checked={!courierSelected && !manualSelected}
                    onChange={()=>{setCourierSelected("");setManualSelected("");}} /> Reparto habitual de la tienda
                </label>
                {courierEligible && <button type="button" onClick={loadPickupPoints} disabled={pointLoading}
                  className="text-sm font-semibold text-emerald-800 underline">
                  {pointLoading ? "Buscando puntos..." : "Elegir punto de recogida del transportista"}
                </button>}
                {pickupPointsVisible && servicePoints.length>0 && <div className="max-h-48 space-y-2 overflow-auto">
                  <label className="flex gap-2 text-sm"><input type="radio" name="service-point"
                    checked={servicePointId===null} onChange={()=>setServicePointId(null)}/> A domicilio (sin punto)</label>
                  {servicePoints.map(point=><label key={point.id} className="flex gap-2 rounded-xl border bg-white p-2 text-xs">
                    <input type="radio" name="service-point" checked={servicePointId===point.id}
                      onChange={()=>setServicePointId(point.id)}/>
                    {point.name} · {point.carrier} · {point.street}, {point.city}
                  </label>)}
                </div>}
                {servicePointId && <p className="text-xs font-semibold text-emerald-800">Calculando tarifas para el punto seleccionado...</p>}
                {courierOptions.map(option=><label key={option.code} className="flex cursor-pointer justify-between gap-3 rounded-lg border bg-white p-3 text-sm">
                  <span><input type="radio" name="courier-choice" checked={courierSelected===option.code}
                    onChange={()=>{setCourierSelected(option.code);setManualSelected("");}}/> <strong>{option.carrier}</strong> · {option.name}</span>
                  <strong>{option.price.toFixed(2)} €</strong>
                </label>)}
                {manualOptions.map(option=><label key={option.service} className="flex cursor-pointer justify-between gap-3 rounded-lg border bg-white p-3 text-sm">
                  <span><input type="radio" name="courier-choice" checked={manualSelected===option.service}
                    onChange={()=>{setManualSelected(option.service);setCourierSelected("");}}/>
                    <strong> {option.label}</strong> · {option.carrier}
                    <small className="block pl-5 text-muted-foreground">La tienda gestionará la contratación y la etiqueta de este envío.</small>
                  </span>
                  <strong>{option.price.toFixed(2)} €</strong>
                </label>)}
                {courierLoading && <p role="status" className="text-xs text-muted-foreground">Consultando métodos y tarifas...</p>}
                {!/^\d{5}$/.test(form.postalCode.trim()) && <p className="text-xs text-muted-foreground">Introduce un código postal español de 5 dígitos para consultar los transportistas.</p>}
                {courierError && <p role="alert" className="text-xs text-red-700">No se pudieron consultar las tarifas verificadas: {courierError}. Puedes comprobar el reparto habitual o intentarlo de nuevo.</p>}
                {!courierLoading && !courierError && /^\d{5}$/.test(form.postalCode.trim()) && courierOptions.length === 0 && manualOptions.length === 0 && (
                  <p role="status" className="text-xs text-amber-800">No hay empresas de transporte disponibles para este carrito y código postal. Comprueba el reparto habitual o la recogida local, si está habilitada.</p>
                )}
                <p className="text-xs text-amber-800">Los transportistas se ofrecen según el contenido del carrito, los datos del paquete y las condiciones de admisión. El envío de plantas usa un servicio confirmado por la tienda, no Packlink PRO.</p>
              </fieldset>
            )}

            {hasPhysicalItems && !hasCjItems && !hasServices && !shippingCatalogPending && !shippingMethodsEligible && !(pickupSelected && localPickupAllowed) && (
              <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Todavía no hay transportistas externos habilitados para los artículos de este pedido. El envío a domicilio se calcula por el sistema de reparto habitual de la tienda. Si tienes disponible la recogida gratuita en Horta, también puedes elegirla arriba.
              </p>
            )}

            {hasPhysicalItems && (
              <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm">
                {shippingCatalogPending ? (
                  <p className="text-muted-foreground">{shippingCatalogError || "Verificando el envío real de los productos..."}</p>
                ) : pickupSelected && localPickupAllowed ? (
                  <p className="font-semibold text-emerald-800">{pickupSettings.label} · Sin gastos de envío. Acordaremos el lugar y la hora.</p>
                ) : selectedManual ? (
                  <p className="font-semibold text-emerald-800">{selectedManual.label} · {selectedManual.carrier} · {selectedManual.price.toFixed(2)} €</p>
                ) : selectedCourier ? (
                  <p className="font-semibold text-emerald-800">Envío con {selectedCourier.carrier} · {selectedCourier.name} · {selectedCourier.price.toFixed(2)} €</p>
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
                    <p className="font-semibold">Envío calculado: €{shipping.toFixed(2)}</p>
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

            {!cjOnly && !selectedCourier && !selectedManual && !(pickupSelected && localPickupAllowed) && businessSuite.scheduledOrdersEnabled !== false && (
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
            {printfulIssue && <div role="alert" className="mb-4 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm font-semibold text-rose-900">Debes confirmar la talla y el color de {printfulIssue.name || "la camiseta"} antes de pagar. <button type="button" onClick={()=>navigate(`/producto/${printfulIssue.id}`)} className="underline">Elegir talla y color</button></div>}

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
                    <span>{pickupSelected && localPickupAllowed ? "Recogida gratis" : selectedManual ? `${selectedManual.price.toFixed(2)} €` : selectedCourier ? `${selectedCourier.price.toFixed(2)} €` : shippingCatalogPending ? "Verificando..." : shippingLoading ? "Calculando..." : shipping === 0 ? "Incluido / gratis" : `€${shipping.toFixed(2)}`}</span>
                  </div>
                  {shippingInfo && !shippingLoading && (
                    <div className="text-right text-xs text-muted-foreground">
                      {shippingInfo.distanceText}{shippingInfo.durationText ? ` · ${shippingInfo.durationText}` : ""}
                    </div>
                  )}
                </>
              )}
              {cjOnly && <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                El subtotal mostrado no incluye el transporte de CJ. El servidor cotizará tu código postal y mostrará el importe definitivo antes de confirmar el pago.
              </p>}
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
                disabled={loading || shippingCatalogPending || (hasPhysicalItems && !pickupSelected && shippingLoading) || !cartItems.length}
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
              shipping={checkoutShipping}
              items={cartItems}
              metadata={{
                ...orderMetadata,
                requestedPaymentMethod: paymentMethod,
              }}
              onCancel={() => setShowStripe(false)}
              onSuccess={({ orderId, paymentIntentId, status, paidTotal }) => {
                if (salesAttribution.enabled) trackSalesPurchase(total, salesAttribution.conversationId);
                if (status === "succeeded" && paymentIntentId) trackTikTokConfirmedPurchase(orderId, paymentIntentId, cartItems.map((item: any) => ({ id: item.id, price: item.unitPrice ?? item.price, quantity: item.quantity })), Number(paidTotal || 0));
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
