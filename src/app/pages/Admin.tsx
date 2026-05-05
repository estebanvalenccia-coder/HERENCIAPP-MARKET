import { useState, useEffect } from "react";
import { Palette, Type, Image as ImageIcon, Moon, Sun, Eye, Save, RotateCcw, Lock, MessageSquare, ExternalLink, Bot } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { backendApi, backendStorage } from "../lib/backendStorage";

export function Admin() {
  // Todos los hooks deben estar al inicio
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [chatboxUrl, setChatboxUrl] = useState("");
  const [chatboxEnabled, setChatboxEnabled] = useState(false);
  const [herenciaUrl, setHerenciaUrl] = useState("");
  const [herenciaEnabled, setHerenciaEnabled] = useState(false);
  const [theme, setTheme] = useState({
    primaryColor: "#2d5f3f",
    secondaryColor: "#7fa88f",
    backgroundColor: "#fdfcfa",
    foregroundColor: "#1f2b1f",
    accentColor: "#c4dfd0",
    borderColor: "rgba(125, 168, 143, 0.2)",
    borderRadius: "0.75rem",
    fontFamily: "system-ui",
    headingFont: "system-ui",
  });
  const [isDark, setIsDark] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    backendApi.adminSession()
      .then(({ authenticated }) => setIsAuthenticated(authenticated))
      .catch(() => setIsAuthenticated(false));

    const savedChatbox = backendStorage.getItem("chatboxSettings");
    if (savedChatbox) {
      const settings = JSON.parse(savedChatbox);
      setChatboxUrl(settings.url || "");
      setChatboxEnabled(settings.enabled || false);
    }

    const savedHerencia = backendStorage.getItem("herenciaSettings");
    if (savedHerencia) {
      const settings = JSON.parse(savedHerencia);
      setHerenciaUrl(settings.url || "");
      setHerenciaEnabled(settings.enabled || false);
    }

    const savedTheme = backendStorage.getItem("customTheme");
    if (savedTheme) {
      setTheme(JSON.parse(savedTheme));
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await backendApi.adminLogin(username, password);
      await backendStorage.refresh();
      setIsAuthenticated(true);
      toast.success("Bienvenido");
    } catch {
      toast.error("Usuario o contraseña incorrectos");
    }
  };

  const handleLogout = async () => {
    await backendApi.adminLogout().catch(() => null);
    setIsAuthenticated(false);
    setUsername("");
    setPassword("");
    toast.success("Sesión cerrada");
    navigate("/");
  };

  const saveChatboxSettings = () => {
    backendStorage.setItem("chatboxSettings", JSON.stringify({
      url: chatboxUrl,
      enabled: chatboxEnabled,
    }));
    toast.success("Configuración del chatbox guardada");
  };

  const saveHerenciaSettings = () => {
    backendStorage.setItem("herenciaSettings", JSON.stringify({
      url: herenciaUrl,
      enabled: herenciaEnabled,
    }));
    window.dispatchEvent(new Event("storage"));
    toast.success("Configuración de Herenc(IA) guardada");
  };

  const applyTheme = () => {
    const root = document.documentElement;
    root.style.setProperty("--primary", theme.primaryColor);
    root.style.setProperty("--secondary", theme.secondaryColor);
    root.style.setProperty("--background", theme.backgroundColor);
    root.style.setProperty("--foreground", theme.foregroundColor);
    root.style.setProperty("--accent", theme.accentColor);
    root.style.setProperty("--border", theme.borderColor);
    root.style.setProperty("--radius", theme.borderRadius);
  };

  const handleSave = () => {
    backendStorage.setItem("customTheme", JSON.stringify(theme));
    backendStorage.setItem("chatboxSettings", JSON.stringify({
      url: chatboxUrl,
      enabled: chatboxEnabled,
    }));
    backendStorage.setItem("herenciaSettings", JSON.stringify({
      url: herenciaUrl,
      enabled: herenciaEnabled,
    }));
    window.dispatchEvent(new Event("storage"));
    applyTheme();
    toast.success("Configuración guardada exitosamente");
  };

  const handleReset = () => {
    const defaultTheme = {
      primaryColor: "#2d5f3f",
      secondaryColor: "#7fa88f",
      backgroundColor: "#fdfcfa",
      foregroundColor: "#1f2b1f",
      accentColor: "#c4dfd0",
      borderColor: "rgba(125, 168, 143, 0.2)",
      borderRadius: "0.75rem",
      fontFamily: "system-ui",
      headingFont: "system-ui",
    };
    setTheme(defaultTheme);
    backendStorage.removeItem("customTheme");
    toast.success("Tema restaurado a valores por defecto");
  };

  const updateTheme = (key: string, value: string) => {
    setTheme({ ...theme, [key]: value });
  };

  const presets = [
    { name: "Verde Natural", primary: "#2d5f3f", secondary: "#7fa88f", accent: "#c4dfd0" },
    { name: "Lavanda", primary: "#7c4dff", secondary: "#b388ff", accent: "#ede7f6" },
    { name: "Océano", primary: "#0277bd", secondary: "#4fc3f7", accent: "#b3e5fc" },
    { name: "Terracota", primary: "#d84315", secondary: "#ff8a65", accent: "#ffccbc" },
  ];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted/30 to-background px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-card border border-border rounded-3xl p-8 shadow-lg">
            <div className="flex items-center justify-center mb-8">
              <div className="bg-primary p-4 rounded-2xl">
                <Lock className="w-10 h-10 text-primary-foreground" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-foreground text-center mb-2">
              Acceso Administrativo
            </h2>
            <p className="text-muted-foreground text-center mb-8">
              Panel de administración - Acceso restringido
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Usuario
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ingresa tu usuario"
                  required
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  required
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-medium"
              >
                Iniciar Sesión
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-muted/30 border-b border-border">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Panel de Administración
              </h1>
              <p className="text-muted-foreground">
                Personaliza el aspecto visual de tu aplicación
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-xl hover:bg-accent transition-colors"
              >
                <Eye className="w-4 h-4" />
                {showPreview ? "Ocultar" : "Mostrar"} Vista Previa
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
              >
                <Lock className="w-4 h-4" />
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls */}
          <div className="lg:col-span-1 space-y-6">
            {/* Chatbox IA */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <MessageSquare className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold text-foreground">Chatbox IA</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    URL del Chatbox
                  </label>
                  <input
                    type="url"
                    value={chatboxUrl}
                    onChange={(e) => setChatboxUrl(e.target.value)}
                    placeholder="https://tu-chatbox-ia.com/embed"
                    className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Pega el enlace de tu chatbox de IA aquí
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                  <span className="text-sm font-medium text-foreground">Activar Chatbox</span>
                  <button
                    onClick={() => setChatboxEnabled(!chatboxEnabled)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      chatboxEnabled ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        chatboxEnabled ? "translate-x-6" : ""
                      }`}
                    />
                  </button>
                </div>

                {chatboxUrl && (
                  <a
                    href={chatboxUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Abrir Chatbox
                  </a>
                )}

                <button
                  onClick={saveChatboxSettings}
                  className="w-full py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors text-sm"
                >
                  Guardar Configuración
                </button>
              </div>
            </div>

            {/* Herenc(IA) */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <Bot className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold text-foreground">Herenc(IA)</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    URL de Herenc(IA)
                  </label>
                  <input
                    type="url"
                    value={herenciaUrl}
                    onChange={(e) => setHerenciaUrl(e.target.value)}
                    placeholder="https://tu-ia-herencia.com"
                    className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Enlace a tu asistente de IA personalizado
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                  <span className="text-sm font-medium text-foreground">Activar Herenc(IA)</span>
                  <button
                    onClick={() => setHerenciaEnabled(!herenciaEnabled)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      herenciaEnabled ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        herenciaEnabled ? "translate-x-6" : ""
                      }`}
                    />
                  </button>
                </div>

                {herenciaUrl && (
                  <a
                    href={herenciaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Abrir Herenc(IA)
                  </a>
                )}

                <button
                  onClick={saveHerenciaSettings}
                  className="w-full py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors text-sm"
                >
                  Guardar Configuración
                </button>
              </div>
            </div>

            {/* Colors */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <Palette className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold text-foreground">Colores</h2>
              </div>

              <div className="space-y-4">
                <ColorPicker
                  label="Color Principal"
                  value={theme.primaryColor}
                  onChange={(v) => updateTheme("primaryColor", v)}
                />
                <ColorPicker
                  label="Color Secundario"
                  value={theme.secondaryColor}
                  onChange={(v) => updateTheme("secondaryColor", v)}
                />
                <ColorPicker
                  label="Color de Fondo"
                  value={theme.backgroundColor}
                  onChange={(v) => updateTheme("backgroundColor", v)}
                />
                <ColorPicker
                  label="Color de Texto"
                  value={theme.foregroundColor}
                  onChange={(v) => updateTheme("foregroundColor", v)}
                />
                <ColorPicker
                  label="Color de Acento"
                  value={theme.accentColor}
                  onChange={(v) => updateTheme("accentColor", v)}
                />
              </div>

              <div className="mt-6 pt-6 border-t border-border">
                <h3 className="text-sm font-semibold text-foreground mb-3">Presets</h3>
                <div className="grid grid-cols-2 gap-2">
                  {presets.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => {
                        updateTheme("primaryColor", preset.primary);
                        updateTheme("secondaryColor", preset.secondary);
                        updateTheme("accentColor", preset.accent);
                      }}
                      className="px-3 py-2 text-sm bg-muted hover:bg-accent rounded-lg transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: preset.primary }}
                        />
                        <span className="text-foreground font-medium">{preset.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Typography */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <Type className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold text-foreground">Tipografía</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Fuente Principal
                  </label>
                  <select
                    value={theme.fontFamily}
                    onChange={(e) => updateTheme("fontFamily", e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="system-ui">System UI</option>
                    <option value="serif">Serif</option>
                    <option value="monospace">Monospace</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Fuente de Títulos
                  </label>
                  <select
                    value={theme.headingFont}
                    onChange={(e) => updateTheme("headingFont", e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="system-ui">System UI</option>
                    <option value="serif">Serif</option>
                    <option value="monospace">Monospace</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Theme Mode */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6">
                {isDark ? <Moon className="w-5 h-5 text-primary" /> : <Sun className="w-5 h-5 text-primary" />}
                <h2 className="text-xl font-bold text-foreground">Modo</h2>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setIsDark(false);
                    document.documentElement.classList.remove("dark");
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-colors ${
                    !isDark ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  <Sun className="w-4 h-4" />
                  Claro
                </button>
                <button
                  onClick={() => {
                    setIsDark(true);
                    document.documentElement.classList.add("dark");
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-colors ${
                    isDark ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  <Moon className="w-4 h-4" />
                  Oscuro
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
              >
                <Save className="w-4 h-4" />
                Guardar
              </button>
              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-muted text-foreground rounded-xl hover:bg-accent transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Preview */}
          {showPreview && (
            <div className="lg:col-span-2">
              <div className="bg-card border border-border rounded-2xl p-6 sticky top-24">
                <h2 className="text-xl font-bold text-foreground mb-6">Vista Previa en Tiempo Real</h2>
                <div
                  className="rounded-xl overflow-hidden border"
                  style={{
                    backgroundColor: theme.backgroundColor,
                    color: theme.foregroundColor,
                    borderColor: theme.borderColor,
                    borderRadius: theme.borderRadius,
                  }}
                >
                  <div
                    className="p-6"
                    style={{ backgroundColor: theme.primaryColor, color: "#ffffff" }}
                  >
                    <h3 className="text-2xl font-bold mb-2">Herencia Floristería</h3>
                    <p className="opacity-90">Vista previa del tema personalizado</p>
                  </div>

                  <div className="p-6 space-y-4">
                    <div>
                      <h4 className="text-lg font-semibold mb-2" style={{ color: theme.foregroundColor }}>
                        Ejemplo de Título
                      </h4>
                      <p style={{ color: theme.foregroundColor, opacity: 0.7 }}>
                        Este es un ejemplo de cómo se verá el texto en tu aplicación con los colores personalizados.
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        className="px-6 py-3 rounded-lg font-medium transition-colors"
                        style={{
                          backgroundColor: theme.primaryColor,
                          color: "#ffffff",
                          borderRadius: theme.borderRadius,
                        }}
                      >
                        Botón Principal
                      </button>
                      <button
                        className="px-6 py-3 rounded-lg font-medium transition-colors"
                        style={{
                          backgroundColor: theme.accentColor,
                          color: theme.foregroundColor,
                          borderRadius: theme.borderRadius,
                        }}
                      >
                        Botón Secundario
                      </button>
                    </div>

                    <div
                      className="p-4 rounded-lg"
                      style={{
                        backgroundColor: theme.accentColor,
                        borderRadius: theme.borderRadius,
                      }}
                    >
                      <p style={{ color: theme.foregroundColor }}>
                        Ejemplo de tarjeta o contenedor con color de acento
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-muted/30 rounded-xl">
                  <h3 className="font-semibold text-foreground mb-2">💡 Sugerencias</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Usa colores con suficiente contraste para accesibilidad</li>
                    <li>• El color principal debe destacar sobre el fondo</li>
                    <li>• Prueba ambos modos (claro/oscuro) antes de guardar</li>
                    <li>• Los cambios se aplicarán inmediatamente al guardar</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">{label}</label>
      <div className="flex gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-10 rounded-lg border border-border cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
    </div>
  );
}
