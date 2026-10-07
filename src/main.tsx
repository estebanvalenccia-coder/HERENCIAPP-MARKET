import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import { backendApi } from "./app/lib/backendStorage";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("No se encontró el contenedor #root");
}

const root = createRoot(rootElement);

backendApi.preload().finally(() => {
  root.render(<App />);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js?v=4", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch((error) => {
        console.warn("No se pudo registrar el service worker de Herencia", error);
      });
  });
}
