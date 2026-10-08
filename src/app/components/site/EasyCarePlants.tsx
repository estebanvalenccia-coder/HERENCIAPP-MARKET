import { Link } from "react-router";

type Product = {
  id: string;
  name: string;
  price?: number;
  salePrice?: number;
  onSale?: boolean;
  image?: string;
  href?: string;
};

function formatMoney(value: unknown) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

export function EasyCarePlants({ catalog }: { catalog: any[] }) {
  const plants = catalog
    .filter((p) => p?.image && (Number(p?.price) > 0 || Number(p?.salePrice) > 0))
    .slice(0, 4);

  if (!plants.length) {
    return (
      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
        <p className="text-center text-sm text-gray-500">No hay plantas fáciles de cuidar disponibles.</p>
      </section>
    );
  }

  return (
    <section className="bg-[#e8f5e9]">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#6d7d72]">
              Plantas fáciles de cuidar
            </p>
            <h2 className="mt-2 text-3xl font-medium sm:text-4xl">
              Selección para principiantes
            </h2>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plants.map((p) => (
            <div key={p.id} className="group overflow-hidden rounded-3xl border border-[#e5e1d8] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className="h-44 overflow-hidden bg-[#efece4]">
                <img
                  src={p.image}
                  alt={p.name}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
              <div className="flex flex-col p-4">
                <p className="font-black">{p.name}</p>
                <p className="mt-1 text-sm text-[#718076]">
                  {formatMoney(p.onSale && p.salePrice ? p.salePrice : p.price)}
                </p>
                <Link
                  to={p.href || `/producto/${p.id}`}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#315b42] px-4 py-2.5 font-bold text-white hover:bg-[#234832]"
                >
                  Ver producto
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
