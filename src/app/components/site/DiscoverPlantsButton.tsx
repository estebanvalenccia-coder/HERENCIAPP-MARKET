import { Link } from "react-router";
import { ArrowRight } from "lucide-react";

export default function DiscoverPlantsButton() {
  return (
    <div className="mt-6 flex justify-center">
      <Link
        to="/productos"
        className="inline-flex items-center gap-2 rounded-full bg-[#315b42] px-6 py-3.5 font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#234832]"
      >
        Descubre nuestras plantas
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
