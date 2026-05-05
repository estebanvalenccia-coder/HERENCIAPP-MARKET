import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Products } from "./pages/Products";
import { ProductDetail } from "./pages/ProductDetail";
import { Services } from "./pages/Services";
import { Contact } from "./pages/Contact";
import { HerencIA } from "./pages/HerencIA";
import { Cart } from "./pages/Cart";
import { Profile } from "./pages/Profile";
import { AdminDashboard } from "./pages/AdminDashboard";
import { Login } from "./pages/Login";
import { Privacy } from "./pages/Privacy";
import { Cookies } from "./pages/Cookies";
import { Terms } from "./pages/Terms";
import { NotFound } from "./pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: "productos", Component: Products },
      { path: "producto/:id", Component: ProductDetail },
      { path: "servicios", Component: Services },
      { path: "contacto", Component: Contact },
      { path: "herencia", Component: HerencIA },
      { path: "carrito", Component: Cart },
      { path: "perfil", Component: Profile },
      { path: "login", Component: Login },
      { path: "privacidad", Component: Privacy },
      { path: "cookies", Component: Cookies },
      { path: "terminos", Component: Terms },
      { path: "*", Component: NotFound },
    ],
  },
  {
    path: "/admin",
    Component: AdminDashboard,
  },
]);
