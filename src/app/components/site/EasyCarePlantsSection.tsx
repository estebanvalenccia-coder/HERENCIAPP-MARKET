import * as React from "react";
import { Link } from "react-router";

// Helper to format money like the Home page does
function money(value: unknown) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

interface Props {
  catalog: any[];
}

export default function EasyCarePlantsSection({ catalog }: Props) {
  // Simple heuristic: first items with image and a positive price
  const plants = React.useMemo(() => {
    return catalog
      .filter((p) => p?.image && Number(p?.price ?? 0) > 0)
      .slice(0, 4);
  }, [catalog]);

  return (
    <section className="bg-[#f9faf5] py-14">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#6d7d72]">
              Selección
            </p>
            <h2 className="mt-2 text-3xl font-medium sm:text-4xl">
              Plantas fáciles de cuidar
            </h2>
          </div>
          <Link
            to="/productos"
            className="inline-flex items-center gap-2 text-sm font-black text-[#315b42]"
          >
            Ver toda la tienda <span className="h-4 w-4 inline-block" aria-hidden="true">→</span>
          </Link>
        </div>

        {plants.length ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plants.map((p) => (
              <div
                key={p.id}
                className="group overflow-hidden rounded-3xl border border-[#e5e1d8] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="h-48 overflow-hidden bg-[#efece4]">
                  <img
                    src={p.image}
                    alt={p.name}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-4">
                  <p className="font-black text-lg">{p.name}</p>
                  <p className="mt-1 text-sm text-[#718076]">{money(p.price)}</p>
                  <Link
                    to={p.href || `/producto/${p.id}`}
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#315b42] px-4 py-2 text-sm font-bold text-white hover:bg-[#234832]"
                  >
                    Ver producto
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-8 text-center text-sm text-[#6d7d72]">
            No hay plantas fáciles de cuidar disponibles en este momento.
          </p>
        )}
      </div>
    </section>
  );
}
