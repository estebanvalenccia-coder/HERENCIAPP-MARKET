import EasyCarePlantCard from "./EasyCarePlantCard";
import { REAL_PLANT_CATALOG_DRAFTS } from "../../data/realPlantCatalogDrafts";

type Props = { catalog: any[] };

export default function EasyCarePlantsSection({ catalog }: Props) {
  // Filter drafts with easy difficulty ("Fácil" or "Muy fácil")
  const easyDrafts = REAL_PLANT_CATALOG_DRAFTS.filter((d) => /fácil/i.test(d.difficulty));

  // Match drafts with real products from the catalog by name (case‑insensitive)
  const matched = easyDrafts
    .map((draft) => {
      const product = catalog.find(
        (p) => p.name && p.name.toLowerCase() === draft.name.toLowerCase()
      );
      return product ? { product, draft } : null;
    })
    .filter(Boolean)
    .slice(0, 4) as { product: any; draft: any }[];

  return (
    <section className="bg-[#f4f1e8]">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#6d7d72]">
              Plantas fáciles de cuidar
            </p>
            <h2 className="mt-2 text-3xl font-medium sm:text-4xl">
              Plantas fáciles de cuidar
            </h2>
          </div>
        </div>
        {matched.length === 0 ? (
          <p className="mt-8 text-center text-[#6d7d72]">
            No hay plantas fáciles de cuidar disponibles en este momento.
          </p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {matched.map(({ product }) => (
              <EasyCarePlantCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
