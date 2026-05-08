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
