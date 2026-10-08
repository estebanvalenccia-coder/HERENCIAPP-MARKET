import { useState } from "react";
import { X } from "lucide-react";

/**
 * A small green button placed in the admin header that opens a modal
 * confirming that HERENCIA Neural works correctly.
 */
export function NeuralTestButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
        title="Prueba Neural"
      >
        🌿 PRUEBA NEURAL
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-card shadow-xl p-6">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="mb-4 text-xl font-bold text-foreground">
              ¡Enhorabuena!
            </h2>
            <p className="text-foreground/80">
              HERENCIA Neural funciona correctamente
            </p>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setOpen(false)}
                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
