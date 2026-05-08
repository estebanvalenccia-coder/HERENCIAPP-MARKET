import React, { useEffect } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { toast } from "sonner";

export default function App() {
  useEffect(() => {
    const onBackendStorageError = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const message = detail.message || "No se pudo sincronizar con el backend";

      toast.error(`Backend/Supabase: ${message}`);
    };

    window.addEventListener("backend-storage-error", onBackendStorageError);

    return () => {
      window.removeEventListener("backend-storage-error", onBackendStorageError);
    };
  }, []);

  return <RouterProvider router={router} />;
}
