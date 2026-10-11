import { Link } from "react-router-dom";

export function ConsejosJardineria() {
  return (
    <section className="max-w-4xl mx-auto p-6">
      <h1 className="text-4xl font-black mb-6 text-center">Consejos de Jardinería</h1>
      <ul className="space-y-8">
        <li>
          <h2 className="text-2xl font-bold mb-2">Riego</h2>
          <p className="text-lg">Riega tus plantas temprano en la mañana o al atardecer para reducir la evaporación. Usa agua a temperatura ambiente y evita encharcar el sustrato.</p>
        </li>
        <li>
          <h2 className="text-2xl font-bold mb-2">Iluminación</h2>
          <p className="text-lg">Asegúrate de que cada planta reciba la cantidad de luz adecuada según su especie. Las plantas de interior suelen necesitar luz indirecta, mientras que las de exterior prefieren sol directo.</p>
        </li>
        <li>
          <h2 className="text-2xl font-bold mb-2">Cuidado general</h2>
          <p className="text-lg">Poda las hojas secas, controla plagas con métodos naturales y fertiliza cada 4‑6 semanas con un fertilizante equilibrado.</p>
        </li>
      </ul>
      <div className="mt-10 text-center">
        <Link to="/" className="inline-block bg-[#315b42] text-white px-6 py-3 rounded-full font-bold hover:bg-[#274d33] transition">
          Volver al inicio
        </Link>
      </div>
    </section>
  );
}
