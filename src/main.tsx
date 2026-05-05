import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import { backendApi } from "./app/lib/backendStorage";

backendApi.preload().finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
