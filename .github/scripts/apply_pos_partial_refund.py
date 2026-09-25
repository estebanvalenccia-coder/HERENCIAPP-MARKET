from pathlib import Path

path = Path("src/app/components/admin/AdminPOS.tsx")
text = path.read_text()

if "async function refundPartialSale(" in text:
    print("Partial refund UI already present")
    raise SystemExit(0)

marker = '    async function refundSale(orderId: string) {'
if marker not in text:
    raise SystemExit("refundSale marker not found")

partial_fn = '''    async function refundPartialSale(orderId: string) {
    const sale = recentSales.find((item) => String(item.id) === String(orderId));
    if (!sale) return;
    if (!hasPosPermission("refund")) return toast.error("Este empleado no puede realizar devoluciones");
    const saleItems = Array.isArray(sale.items) ? sale.items : [];
    if (!saleItems.length) return toast.error("Esta venta no conserva líneas para una devolución parcial");

    const previousRefunds = Array.isArray(sale.metadata?.refunds) ? sale.metadata.refunds : [];
    const alreadyRefunded = new Map<string, number>();
    for (const refund of previousRefunds) {
      for (const item of Array.isArray(refund?.items) ? refund.items : []) {
        const id = String(item?.id || "");
        const qty = Math.max(0, Math.floor(Number(item?.quantity ?? item?.qty ?? 0)));
        if (id && qty) alreadyRefunded.set(id, (alreadyRefunded.get(id) || 0) + qty);
      }
    }

    const selected: Array<{ id: string; quantity: number }> = [];
    for (const item of saleItems) {
      const id = String(item?.id || "");
      const soldQty = Math.max(0, Math.floor(Number(item?.quantity ?? item?.qty ?? 0)));
      const remainingQty = Math.max(0, soldQty - Number(alreadyRefunded.get(id) || 0));
      if (!id || remainingQty <= 0) continue;
      const raw = window.prompt(
        `${item?.name || "Artículo"} · disponibles para devolver: ${remainingQty}. Cantidad a devolver:`,
        "0"
      );
      if (raw === null) return;
      const quantity = Math.floor(Number(String(raw).replace(",", ".")));
      if (!Number.isFinite(quantity) || quantity < 0 || quantity > remainingQty) {
        return toast.error(`Cantidad inválida para ${item?.name || "el artículo"}`);
      }
      if (quantity > 0) selected.push({ id, quantity });
    }

    if (!selected.length) return toast.error("No seleccionaste unidades para devolver");
    const reason = window.prompt("Motivo de la devolución parcial", "Devolución parcial de cliente");
    if (reason === null) return;

    try {
      const result = await backendApi.refundPartialPosSale({
        orderId,
        items: selected,
        reason,
        staff: currentStaff
          ? { id: currentStaff.id, name: currentStaff.name, role: currentStaff.role }
          : { id: "owner", name: "Propietario / administrador", role: "admin" },
      });
      setProducts((Array.isArray(result.inventory) ? result.inventory : []).map(toPosItem));
      if (result.cashSession) setCashSession(result.cashSession);
      setRecentSales((current) => current.map((item) =>
        String(item.id) === String(orderId) ? result.order : item
      ));
      await refreshReport();
      if (Array.isArray(result.manualRefunds) && result.manualRefunds.length) {
        toast.warning(`${result.refund.refundNumber}: devolución registrada. Revisa el reintegro manual de Bizum/transferencia.`);
      } else {
        toast.success(`Devolución parcial registrada: ${result.refund.refundNumber}`);
      }
    } catch (error: any) {
      toast.error(error?.message || "No se pudo registrar la devolución parcial");
    }
  }

'''
text = text.replace(marker, partial_fn + marker, 1)

old_button = '''                      {sale.status !== "refunded" && (
                        <button
                          type="button"
                          onClick={() => void refundSale(String(sale.id))}
                          className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-black text-rose-700"
                        >
                          Devolver venta
                        </button>
                      )}'''

new_button = '''                      {sale.status !== "refunded" && (
                        <>
                          <button
                            type="button"
                            onClick={() => void refundPartialSale(String(sale.id))}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black text-amber-800"
                          >
                            Devolver artículos
                          </button>
                          {!Array.isArray(sale.metadata?.refunds) || sale.metadata.refunds.length === 0 ? (
                            <button
                              type="button"
                              onClick={() => void refundSale(String(sale.id))}
                              className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-black text-rose-700"
                            >
                              Devolver todo
                            </button>
                          ) : null}
                        </>
                      )}'''

if old_button not in text:
    raise SystemExit("refund history button marker not found")

text = text.replace(old_button, new_button, 1)
path.write_text(text)
print("Partial refund UI patch applied")
