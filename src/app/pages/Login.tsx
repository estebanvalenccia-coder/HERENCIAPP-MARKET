import { useEffect, useState } from "react";
import { Leaf, Mail, Lock, User, Phone, MapPin } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import logo from "figma:asset/8c5f2b4f88c45fd4812e5bb91610bff5272333d7.png";
import { backendStorage } from "../lib/backendStorage";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function readSavedUser() {
  try {
    return JSON.parse(backendStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

export function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    password: "",
  });
  const navigate = useNavigate();

  useEffect(() => {
    const savedUser = readSavedUser();
    if (savedUser?.email) {
      setFormData((prev) => ({
        ...prev,
        name: savedUser.name || "",
        email: savedUser.email || "",
        phone: savedUser.phone || "",
        address: savedUser.address || "",
      }));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const email = normalizeEmail(formData.email);
    if (!email || !formData.password) {
      toast.error("Completa email y contraseña");
      return;
    }

    if (!isLogin && !formData.name.trim()) {
      toast.error("Escribe tu nombre completo");
      return;
    }

    try {
      setLoading(true);
      const savedUser = readSavedUser();
      const sameCustomer = savedUser?.email && normalizeEmail(savedUser.email) === email;
      const user = {
        ...(sameCustomer ? savedUser : {}),
        id: sameCustomer ? savedUser.id : crypto.randomUUID(),
        email,
        name: isLogin ? savedUser?.name || email.split("@")[0] : formData.name.trim(),
        phone: formData.phone.trim() || savedUser?.phone || "",
        address: formData.address.trim() || savedUser?.address || "",
        isLoggedIn: true,
        updatedAt: new Date().toISOString(),
        orderHistory: sameCustomer && Array.isArray(savedUser?.orderHistory) ? savedUser.orderHistory : [],
        notifications: sameCustomer && Array.isArray(savedUser?.notifications) ? savedUser.notifications : [],
      };

      const result = await backendStorage.setItem("user", JSON.stringify(user));
      if (!result.ok) {
        toast.warning("Sesión guardada en este navegador. El backend no respondió ahora mismo.");
      } else {
        toast.success(isLogin ? "¡Bienvenido de vuelta!" : "¡Cuenta creada exitosamente!");
      }

      navigate("/perfil");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted/30 to-background px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-card border border-border rounded-3xl p-8 shadow-lg">
          <div className="flex justify-center mb-8">
            <img src={logo} alt="Herencia Floristería" className="h-20 w-auto" />
          </div>

          <div className="flex gap-2 mb-6 bg-muted p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 rounded-lg transition-colors ${
                isLogin ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 rounded-lg transition-colors ${
                !isLogin ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Registrarse
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Nombre completo</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Tu nombre"
                    required={!isLogin}
                    className="w-full pl-11 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Correo electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="tu@email.com"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Teléfono</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+34 600 000 000"
                      className="w-full pl-11 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Dirección habitual</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Calle, número, ciudad"
                      className="w-full pl-11 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {isLogin && (
              <div className="text-right">
                <button type="button" className="text-sm text-primary hover:underline">
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-medium disabled:opacity-60"
            >
              {loading ? "Conectando..." : isLogin ? "Iniciar sesión" : "Crear cuenta"}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {isLogin ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
            <button onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline">
              {isLogin ? "Regístrate" : "Inicia sesión"}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
