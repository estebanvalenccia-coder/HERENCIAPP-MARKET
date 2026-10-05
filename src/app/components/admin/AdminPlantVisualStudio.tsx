import { useEffect, useState } from "react";
import { Home, Images, Sparkles, Sun } from "lucide-react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";

export type HerenciaVisualStyle =
  | "automatico"
  | "casa-herencia"
  | "herencia-claro"
  | "mis-fotos";

type Props = {
  plantName: string;
  style: HerenciaVisualStyle;
  onStyleChange: (style: HerenciaVisualStyle) => void;
  selectedCount: number;
  onGeneratedImage: (dataUrl: string, style: HerenciaVisualStyle) => void;
};

const HOUSE_BASE = `
Identidad visual oficial de Herencia Floristería.
La fotografía debe parecer tomada en la misma Casa Herencia que el resto del catálogo:
interior mediterráneo-orgánico cálido, paredes marfil/crema, madera natural clara,
ventana grande con luz solar lateral suave, sombras reales y elegantes,
detalles vegetales discretos al fondo, decoración neutra y sin elementos llamativos.
Usa una maceta de cerámica crema clara, cilíndrica, elegante y coherente con el catálogo.
Aspecto fotográfico realista, premium y natural, nunca ilustración ni render 3D.
`.trim();

const CLEAR_BASE = `
Identidad visual oficial de Herencia Floristería.
Fotografía tomada en el rincón claro de la misma Casa Herencia.
No uses blanco clínico ni fondo infinito de estudio.
El fondo es marfil/blanco cálido con profundidad real, luz natural lateral,
sombras suaves, superficie crema clara y la misma maceta de cerámica crema del catálogo.
El resultado debe seguir pareciendo una casa mediterránea-orgánica elegante,
solo que con un encuadre más limpio y luminoso.
Aspecto fotográfico realista, premium y natural, nunca ilustración ni render 3D.
`.trim();

const SHOTS = [
  "Vista principal completa, encuadre frontal y equilibrado, planta protagonista.",
  "Vista ligeramente lateral, manteniendo exactamente la misma identidad de casa y maceta.",
  "Detalle botánico de hojas y textura, con profundidad de campo natural.",
];

function promptFor(style: HerenciaVisualStyle, plantName: string, shotIndex: number) {
  const safeName = plantName.trim();
  const base = style === "herencia-claro" ? CLEAR_BASE : HOUSE_BASE;
  return `${base}

Producto: ${safeName}.
Representa la especie de forma botánicamente reconocible y creíble.
${SHOTS[shotIndex % SHOTS.length]}
No cambies la identidad visual Herencia, la familia de maceta ni la temperatura de color.
`;
}

export function AdminPlantVisualStudio({
  plantName,
  style,
  onStyleChange,
  selectedCount,
  onGeneratedImage,
}: Props) {
  const [generating, setGenerating] = useState(false);
  const [references, setReferences] = useState<Array<{ name: string; url: string }>>([]);
  const [selectedReferenceUrl, setSelectedReferenceUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    backendApi
      .listCommerceProducts({ collection: "plantas", status: "active" })
      .then((result) => {
        if (cancelled) return;
        const products = Array.isArray(result.products) ? result.products : [];
        const preferredNames = [
          "zamioculca",
          "palma areca",
          "calathea orbifolia",
          "philodendron brasil",
          "begonia maculata",
        ];

        const rows = products
          .map((product: any) => ({
            name: String(product?.name || "Producto Herencia"),
            url: String(product?.image || product?.images?.[0] || "").trim(),
          }))
          .filter((item) => /^https:\/\//i.test(item.url));

        const preferred = preferredNames
          .map((name) => rows.find((item) => item.name.toLowerCase().includes(name)))
          .filter(Boolean) as Array<{ name: string; url: string }>;

        const merged = [...preferred, ...rows].filter(
          (item, index, all) => item.url && all.findIndex((candidate) => candidate.url === item.url) === index
        ).slice(0, 6);

        setReferences(merged);
        setSelectedReferenceUrl((current) => current || merged[0]?.url || "");
      })
      .catch(() => {
        if (!cancelled) setReferences([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function generateGallery() {
    const name = plantName.trim();
    if (!name) return toast.error("Escribe primero el nombre de la planta");
    if (style === "mis-fotos") {
      return toast.message("Tus fotos propias se mantienen intactas y no se regeneran");
    }

    const remaining = Math.max(0, 8 - selectedCount);
    if (!remaining) return toast.error("Ya tienes el máximo de 8 imágenes");

    const requested = style === "automatico" ? 3 : 2;
    const count = Math.min(requested, remaining);

    try {
      setGenerating(true);
      for (let index = 0; index < count; index += 1) {
        const generationStyle: HerenciaVisualStyle =
          style === "automatico"
            ? index === count - 1
              ? "herencia-claro"
              : "casa-herencia"
            : style;

        const result = await backendApi.generateAdminProductImage({
          prompt: promptFor(generationStyle, name, index),
          format: "portrait",
          referenceUrls: selectedReferenceUrl ? [selectedReferenceUrl] : [],
        });

        if (!result.image) throw new Error("La IA no devolvió una imagen");
        onGeneratedImage(result.image, generationStyle);
      }
      toast.success(`Se generaron ${count} imágenes con identidad Herencia`);
    } catch (error: any) {
      toast.error(error?.message || "No se pudieron generar las imágenes");
    } finally {
      setGenerating(false);
    }
  }

  const options: Array<{
    id: HerenciaVisualStyle;
    title: string;
    description: string;
    icon: typeof Sparkles;
  }> = [
    {
      id: "automatico",
      title: "Automático",
      description: "Casa Herencia + Herencia Claro",
      icon: Sparkles,
    },
    {
      id: "casa-herencia",
      title: "Casa Herencia",
      description: "Misma casa, rincones cálidos",
      icon: Home,
    },
    {
      id: "herencia-claro",
      title: "Herencia Claro",
      description: "Marfil cálido, nunca blanco clínico",
      icon: Sun,
    },
    {
      id: "mis-fotos",
      title: "Mis propias fotos",
      description: "Hasta 8, sin modificar",
      icon: Images,
    },
  ];

  return (
    <div className="mb-4 rounded-2xl border border-border bg-muted/20 p-4">
      <div className="mb-3">
        <p className="text-sm font-black">Plantillas visuales Herencia</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Mejora la galería actual sin sustituirla. La IA mantiene la misma casa, maceta y lenguaje visual.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const Icon = option.icon;
          const active = style === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onStyleChange(option.id)}
              className={`rounded-xl border p-3 text-left transition ${
                active
                  ? "border-primary bg-primary/10 ring-2 ring-primary/10"
                  : "border-border bg-background hover:bg-muted/50"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="mt-2 block text-xs font-black">{option.title}</span>
              <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                {option.description}
              </span>
            </button>
          );
        })}
      </div>

      {style === "mis-fotos" ? (
        <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-3 text-xs leading-5">
          <strong>Tus fotos no cambian.</strong> Se guardan exactamente como las subes: mismo fondo,
          encuadre, color y contenido. Solo puedes ordenarlas, elegir principal, eliminar o sustituir.
          Máximo 8 imágenes.
        </div>
      ) : (
        <>
          {references.length > 0 && (
            <div className="mt-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
                  Escenario de referencia
                </p>
                <span className="text-[10px] text-muted-foreground">Tus productos actuales</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {references.map((reference) => {
                  const selected = selectedReferenceUrl === reference.url;
                  return (
                    <button
                      key={reference.url}
                      type="button"
                      onClick={() => setSelectedReferenceUrl(reference.url)}
                      className={`overflow-hidden rounded-xl border text-left transition ${
                        selected ? "border-primary ring-2 ring-primary/10" : "border-border"
                      }`}
                      title={reference.name}
                    >
                      <img
                        src={reference.url}
                        alt={reference.name}
                        className="aspect-square w-full object-cover"
                      />
                      <span className="block truncate px-2 py-1.5 text-[10px] font-bold">
                        {reference.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                La IA usa esta foto como guía del rincón, luz y maceta; no copia la planta.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => void generateGallery()}
            disabled={generating || !plantName.trim() || selectedCount >= 8}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {generating ? "Generando galería…" : "Generar imágenes con IA"}
          </button>
        </>
      )}
    </div>
  );
}
