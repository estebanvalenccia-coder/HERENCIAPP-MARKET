import { useState } from "react";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  CreditCard,
  Mail,
  MapPin,
  RefreshCw,
  Server,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";

type Check = { name: string; ok: boolean; detail: string };

export function AdminSystemAudit() {
  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState<Check[]>([]);
  const [ranAt, setRanAt] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testAddress, setTestAddress] = useState("");
  const [manualBusy, setManualBusy] = useState<"email" | "maps" | "">("");

  const run = async () => {
    setRunning(true);
    const out: Check[] = [];

    try {
      const health = await backendApi.health();
      out.push({
        name: "Backend / Railway",
        ok: !!health.ok,
        detail: health.ok ? "API responde correctamente" : "API sin respuesta válida",
      });
    } catch (error: any) {
      out.push({ name: "Backend / Railway", ok: false, detail: error?.message || "Sin conexión" });
    }

    try {
      const ready = await backendApi.readiness();
      out.push({
        name: "Base de datos primaria",
        ok: !!ready.database,
        detail: ready.database
          ? `Operativa · ${ready.databaseProvider || ready.databasePrimary || "proveedor configurado"}`
          : "No disponible",
      });
      out.push({
        name: "Stripe backend",
        ok: !!ready.stripe,
        detail: ready.stripe ? "Clave servidor configurada" : "Stripe no está configurado",
      });
      out.push({
        name: "Webhook Stripe",
        ok: !!ready.stripeWebhook,
        detail: ready.stripeWebhook ? "Webhook de pagos configurado" : "Webhook de pagos pendiente",
      });
      out.push({
        name: "Email transaccional",
        ok: !!ready.email,
        detail: ready.email ? "Resend configurado" : "Falta proveedor de email",
      });
      out.push({
        name: "Google Maps / reparto",
        ok: !!ready.maps,
        detail: ready.maps ? "Cálculo de distancia configurado" : "Falta Google Maps",
      });
      out.push({
        name: "IA de ventas",
        ok: !!ready.salesAi,
        detail: ready.salesAi ? "Groq configurado en servidor" : "IA comercial no configurada",
      });
      out.push({
        name: "IA de imágenes",
        ok: !!ready.imageAi,
        detail: ready.imageAi ? "Proveedor de imagen configurado" : "IA visual no configurada",
      });
    } catch (error: any) {
      out.push({ name: "Readiness del backend", ok: false, detail: error?.message || "No disponible" });
    }

    try {
      const [commerce, catalog] = await Promise.all([
        backendApi.commerceHealth(),
        backendApi.listCommerceProducts({ includeArchived: true }),
      ]);
      const products = Array.isArray(catalog?.products) ? catalog.products : [];
      const active = products.filter(
        (product: any) =>
          product?.active !== false &&
          !product?.deletedAt &&
          String(product?.status || "active") !== "archived"
      );
      const sellable = active.filter(
        (product: any) =>
          product?.trackInventory === false ||
          Number(product?.stock || 0) > 0 ||
          (Array.isArray(product?.variants) &&
            product.variants.some((variant: any) => Number(variant?.stock || 0) > 0))
      );

      out.push({
        name: "Commerce Core",
        ok: commerce?.ok !== false,
        detail: `${commerce?.products || 0} productos · ${commerce?.collections || 0} colecciones · ${commerce?.source || "sin fuente"}`,
      });
      out.push({
        name: "Catálogo vendible",
        ok: sellable.length > 0,
        detail: `${active.length} activos · ${sellable.length} con disponibilidad de venta`,
      });
    } catch (error: any) {
      out.push({ name: "Commerce Core", ok: false, detail: error?.message || "No accesible" });
    }

    try {
      const media = await backendApi.siteMediaStatus();
      const ready =
        media.provider === "cloudflare_r2" &&
        media.configured &&
        media.connection?.ok !== false;
      out.push({
        name: "Biblioteca multimedia",
        ok: ready,
        detail: ready
          ? "Cloudflare R2 operativo · lectura/escritura comprobadas"
          : media.connection?.error || "R2 pendiente o sin acceso de escritura",
      });
    } catch (error: any) {
      out.push({
        name: "Biblioteca multimedia",
        ok: false,
        detail: error?.message || "No se pudo comprobar",
      });
    }

    try {
      const pos = await backendApi.posSelfTest();
      out.push(
        ...(pos.tests || []).map((test: any) => ({
          name: "TPV · " + test.name,
          ok: !!test.ok,
          detail: test.detail,
        }))
      );
      out.push({
        name: "Stripe / tarjeta TPV",
        ok: !!pos.cardReady,
        detail: pos.cardReady ? "Configuración disponible" : "Falta configuración o validación",
      });
      out.push({
        name: "Datos fiscales",
        ok: !!pos.fiscalReady,
        detail: pos.fiscalReady
          ? "Datos del emisor configurados"
          : "Completa razón social/nombre fiscal, NIF/CIF y domicilio fiscal",
      });
    } catch (error: any) {
      out.push({ name: "TPV", ok: false, detail: error?.message || "No se pudo ejecutar el autotest" });
    }

    try {
      const session = await backendApi.adminSession();
      out.push({
        name: "Sesión de Administración",
        ok: !!session.authenticated,
        detail: session.authenticated
          ? "Cookie de sesión válida en este navegador"
          : "La sesión no está autenticada",
      });
    } catch (error: any) {
      out.push({
        name: "Sesión de Administración",
        ok: false,
        detail: error?.message || "No se pudo validar la sesión",
      });
    }

    try {
      const auth = await backendApi.adminAuthConfig();
      out.push({
        name: "2FA de Administración",
        ok: !!auth.totpRequired,
        detail: auth.totpRequired
          ? "TOTP activado para el acceso administrativo"
          : "Recomendado antes de abrir ventas: configura ADMIN_TOTP_SECRET",
      });
    } catch (error: any) {
      out.push({
        name: "2FA de Administración",
        ok: false,
        detail: error?.message || "No se pudo comprobar 2FA",
      });
    }

    try {
      const neural = await backendApi.neuralSelfTest();
      out.push({
        name: "HERENCIA Neural",
        ok: neural?.ok !== false,
        detail: neural?.ok === false ? neural?.error || "Autotest con incidencias" : "Core Neural responde",
      });
    } catch (error: any) {
      out.push({ name: "HERENCIA Neural", ok: false, detail: error?.message || "Sin respuesta" });
    }

    try {
      const orders = await backendApi.listOrders();
      out.push({
        name: "Pedidos",
        ok: Array.isArray(orders.orders),
        detail: Array.isArray(orders.orders)
          ? orders.orders.length + " pedidos accesibles desde la base primaria"
          : "Respuesta inválida",
      });
    } catch (error: any) {
      out.push({ name: "Pedidos", ok: false, detail: error?.message || "No accesible" });
    }

    out.push({
      name: "PWA / Service Worker",
      ok: "serviceWorker" in navigator,
      detail:
        "serviceWorker" in navigator
          ? "Navegador compatible con instalación offline"
          : "Navegador sin Service Worker",
    });
    out.push({
      name: "Notificaciones navegador",
      ok: typeof Notification !== "undefined",
      detail:
        typeof Notification !== "undefined"
          ? `Soportadas · permiso: ${Notification.permission}`
          : "No compatibles",
    });

    setChecks(out);
    setRanAt(new Date().toLocaleString("es-ES"));
    setRunning(false);
  };

  const testTransactionalEmail = async () => {
    setManualBusy("email");
    try {
      await backendApi.sendAdminSmokeEmail(testEmail.trim());
      toast.success("Email de prueba enviado. Comprueba la bandeja de entrada.");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo enviar el email de prueba");
    } finally {
      setManualBusy("");
    }
  };

  const testDeliveryAddress = async () => {
    if (testAddress.trim().length < 5) {
      toast.error("Escribe una dirección completa para probar el reparto");
      return;
    }
    setManualBusy("maps");
    try {
      const result = await backendApi.calculateShipping({
        address: testAddress.trim(),
        city: "Barcelona",
        province: "Barcelona",
        postalCode: "",
      });
      toast.success(
        `Ruta válida · ${result.distanceText || result.distanceKm + " km"} · envío €${Number(result.price || 0).toFixed(2)}`
      );
    } catch (error: any) {
      toast.error(error?.message || "No se pudo validar la dirección");
    } finally {
      setManualBusy("");
    }
  };

  const ok = checks.filter((check) => check.ok).length;
  const failed = checks.length - ok;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-black">Diagnóstico de producción</h1>
            <p className="mt-2 text-zinc-500">
              Comprueba servicios reales sin crear pedidos ni efectuar cobros.
            </p>
          </div>
          <button
            onClick={run}
            disabled={running}
            className="rounded-2xl bg-zinc-950 px-5 py-3 font-black text-white disabled:opacity-50"
          >
            <RefreshCw className={"mr-2 inline h-4 w-4 " + (running ? "animate-spin" : "")} />
            Ejecutar diagnóstico
          </button>
        </div>

        {checks.length > 0 && (
          <div
            className={`mt-5 rounded-2xl p-4 font-bold ${
              failed === 0 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
            }`}
          >
            {ok}/{checks.length} comprobaciones correctas · {ranAt}
            {failed > 0 ? ` · ${failed} bloqueo(s) pendiente(s)` : " · listo para revisión E2E final"}
          </div>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {checks.map((check, index) => (
          <div
            key={index}
            className={
              "rounded-3xl border p-5 " +
              (check.ok ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50")
            }
          >
            <div className="flex gap-3">
              {check.ok ? (
                <CheckCircle2 className="text-emerald-600" />
              ) : (
                <AlertTriangle className="text-amber-600" />
              )}
              <div>
                <h3 className="font-black">{check.name}</h3>
                <p className="mt-1 text-sm text-zinc-600">{check.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!checks.length && (
        <div className="rounded-3xl border border-dashed p-10 text-center text-zinc-500">
          <Server className="mx-auto mb-3" />
          <p>Ejecuta el diagnóstico para comprobar backend, TPV, pagos, pedidos y Neural.</p>
          <div className="mt-4 flex justify-center gap-4 text-zinc-400">
            <CreditCard />
            <ShoppingBag />
            <Brain />
          </div>
        </div>
      )}

      <section className="rounded-[2rem] border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black">Pruebas manuales seguras</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Comprueban proveedores reales. No cobran ni crean pedidos.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border p-4">
            <div className="flex items-center gap-2 font-black">
              <Mail className="h-4 w-4" />
              Email transaccional
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Déjalo vacío para usar el email configurado de la tienda.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(event) => setTestEmail(event.target.value)}
                placeholder="correo@ejemplo.com"
                className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void testTransactionalEmail()}
                disabled={manualBusy !== ""}
                className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
              >
                Probar
              </button>
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="flex items-center gap-2 font-black">
              <MapPin className="h-4 w-4" />
              Reparto real
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Valida Google Maps, distancia y precio para una dirección de entrega.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={testAddress}
                onChange={(event) => setTestAddress(event.target.value)}
                placeholder="Calle, número y código postal"
                className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void testDeliveryAddress()}
                disabled={manualBusy !== ""}
                className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
              >
                Probar
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
