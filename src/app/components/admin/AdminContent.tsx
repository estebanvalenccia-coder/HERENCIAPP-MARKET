import { useState } from "react";
import { Upload, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { backendStorage } from "../../lib/backendStorage";

export function AdminContent() {
  const [heroBanner, setHeroBanner] = useState("");
  const [ctaBanner, setCtaBanner] = useState("");

  const handleImageUpload = (type: "hero" | "cta", file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (type === "hero") {
        setHeroBanner(result);
        backendStorage.setItem("heroBanner", result);
      } else {
        setCtaBanner(result);
        backendStorage.setItem("ctaBanner", result);
      }
      toast.success("Imagen actualizada");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 p-3 rounded-xl">
          <ImageIcon className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Gestión de Contenido</h2>
          <p className="text-muted-foreground">Administra las imágenes de tu sitio web</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hero Banner */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Banner Principal (Hero)
          </h3>
          {heroBanner ? (
            <div className="relative">
              <img
                src={heroBanner}
                alt="Hero Banner"
                className="w-full h-48 object-cover rounded-xl"
              />
              <button
                onClick={() => {
                  setHeroBanner("");
                  backendStorage.removeItem("heroBanner");
                  toast.success("Banner eliminado");
                }}
                className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-lg hover:bg-black/70"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-accent/50 transition-colors">
              <Upload className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-foreground font-medium">
                Subir imagen Hero
              </p>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload("hero", file);
                }}
              />
            </label>
          )}
        </div>

        {/* CTA Banner */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Banner CTA
          </h3>
          {ctaBanner ? (
            <div className="relative">
              <img
                src={ctaBanner}
                alt="CTA Banner"
                className="w-full h-48 object-cover rounded-xl"
              />
              <button
                onClick={() => {
                  setCtaBanner("");
                  backendStorage.removeItem("ctaBanner");
                  toast.success("Banner eliminado");
                }}
                className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-lg hover:bg-black/70"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-accent/50 transition-colors">
              <Upload className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-foreground font-medium">
                Subir imagen CTA
              </p>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload("cta", file);
                }}
              />
            </label>
          )}
        </div>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          💡 Consejos para las imágenes
        </h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Usa imágenes de alta calidad (mínimo 1920x1080px)</li>
          <li>• Formato recomendado: JPG o PNG</li>
          <li>• Tamaño máximo: 5MB por imagen</li>
          <li>• Las imágenes se optimizarán automáticamente</li>
        </ul>
      </div>
    </div>
  );
}
