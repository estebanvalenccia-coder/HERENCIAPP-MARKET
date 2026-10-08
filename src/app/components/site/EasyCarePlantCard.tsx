import { Link } from "react-router";

type Props = { product: any };

export default function EasyCarePlantCard({ product }: Props) {
  const price = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(Number(product.price || 0));

  const href = product.href || `/productos?search=${encodeURIComponent(product.name || "")}`;

  return (
    <div className="group overflow-hidden rounded-3xl border border-[#e5e1d8] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="h-44 overflow-hidden bg-[#efece4]">
        <img
          src={product.image || product.imageUrl || ""}
          alt={product.name || ""}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div className="p-4 flex flex-col gap-2">
        <p className="font-black">{product.name}</p>
        <p className="text-sm text-[#718076]">{price}</p>
        <Link
          to={href}
          className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#315b42] px-4 py-2 text-sm font-bold text-white hover:bg-[#234832]"
        >
          Ver producto
        </Link>
      </div>
    </div>
  );
}
