import React, { useEffect } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { toast } from "sonner";
import { backendStorage } from "./lib/backendStorage";

type RuntimeTheme = {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  accentColor?: string;
  borderColor?: string;
  borderRadius?: string;
  fontFamily?: string;
  headingFont?: string;
};

function applyRuntimeTheme(theme: RuntimeTheme | null) {
  if (!theme) return;

  const root = document.documentElement;
  if (theme.primaryColor) root.style.setProperty("--primary", theme.primaryColor);
  if (theme.secondaryColor) root.style.setProperty("--secondary", theme.secondaryColor);
  if (theme.backgroundColor) root.style.setProperty("--background", theme.backgroundColor);
  if (theme.foregroundColor) root.style.setProperty("--foreground", theme.foregroundColor);
  if (theme.accentColor) root.style.setProperty("--accent", theme.accentColor);
  if (theme.borderColor) root.style.setProperty("--border", theme.borderColor);
  if (theme.borderRadius) root.style.setProperty("--radius", theme.borderRadius);
  if (theme.fontFamily) root.style.setProperty("--app-font-family", theme.fontFamily);
  if (theme.headingFont) root.style.setProperty("--app-heading-font", theme.headingFont);
}

function loadAndApplyTheme() {
  try {
    const raw = backendStorage.getItem("customTheme");
    if (!raw) return;
    const parsed = JSON.parse(raw) as RuntimeTheme;
    applyRuntimeTheme(parsed);
  } catch {
    // Ignora temas inválidos para no romper la app.
  }
}

export default function App() {
  useEffect(() => {
    loadAndApplyTheme();

    const onBackendStorageError = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const message = detail.message || "No se pudo sincronizar con el backend";

      toast.error(`Backend/Supabase: ${message}`);
    };

    backendStorage.refresh().catch(() => null);

    const syncInterval = window.setInterval(() => {
      backendStorage.refresh().catch(() => null);
    }, 5000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        backendStorage.refresh().catch(() => null);
      }
    };

    const onStorageChange = () => {
      loadAndApplyTheme();
    };

    window.addEventListener("backend-storage-error", onBackendStorageError);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("storage", onStorageChange);
    window.addEventListener("backend-storage", onStorageChange);

    return () => {
      window.removeEventListener("backend-storage-error", onBackendStorageError);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("storage", onStorageChange);
      window.removeEventListener("backend-storage", onStorageChange);
      window.clearInterval(syncInterval);
    };
  }, []);

  return <RouterProvider router={router} />;
}
