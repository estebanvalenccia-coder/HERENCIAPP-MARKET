import { useState, useEffect } from "react";
import {
  Palette, Type, Moon, Sun, Eye, Save, RotateCcw, Bot, MessageSquare, ExternalLink,
  Home, House, Sparkles, Flower, Flower2, Leaf, LeafyGreen, Package, ShoppingBag,
  Briefcase, Scissors, Store, Building, Brain, Zap, Star, Truck
} from "lucide-react";
import { backendStorage } from "../../lib/backendStorage";
import { toast } from "sonner";

type TpvLeftBlockId = "status" | "currentSale" | "payment" | "keypad";
type TpvLayoutSettings = {
  leftBlockOrder: TpvLeftBlockId[];
  showStatus: boolean;
  showCurrentSale: boolean;
  showPayment: boolean;
  showKeypad: boolean;
  showCatalogHeader: boolean;
  showCatalogGrid: boolean;
  productColumns: 2 | 3 | 4;
};

const defaultTpvLayout: TpvLayoutSettings = {
  leftBlockOrder: ["status", "currentSale", "payment", "keypad"],
  showStatus: true,
  showCurrentSale: true,
  showPayment: true,
  showKeypad: true,
  showCatalogHeader: true,
  showCatalogGrid: true,
  productColumns: 4,
};

function parseTpvLayout(raw: string | null): TpvLayoutSettings {
  if (!raw) return defaultTpvLayout;
  try {
    const parsed = JSON.parse(raw);
    const nextOrder = Array.isArray(parsed?.leftBlockOrder)
      ? parsed.leftBlockOrder.filter((id: unknown) =>
          ["status", "currentSale", "payment", "keypad"].includes(String(id))
        ) as TpvLeftBlockId[]
      : [];

    const orderWithFallback = ["status", "currentSale", "payment", "keypad"].filter(
      (id) => nextOrder.includes(id as TpvLeftBlockId)
    ) as TpvLeftBlockId[];

    const completedOrder = [
      ...orderWithFallback,
      ...(["status", "currentSale", "payment", "keypad"] as TpvLeftBlockId[]).filter(
        (id) => !orderWithFallback.includes(id)
      ),
    ];

    const productColumns = Number(parsed?.productColumns);

    return {
      leftBlockOrder: completedOrder,
      showStatus: parsed?.showStatus !== false,
      showCurrentSale: parsed?.showCurrentSale !== false,
      showPayment: parsed?.showPayment !== false,
      showKeypad: parsed?.showKeypad !== false,
      showCatalogHeader: parsed?.showCatalogHeader !== false,
      showCatalogGrid: parsed?.showCatalogGrid !== false,
      productColumns: productColumns === 2 || productColumns === 3 || productColumns === 4 ? productColumns : 4,
    };
  } catch {
    return defaultTpvLayout;
  }
}

function parseBannerUrl(raw: string | null): string {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    return String(parsed?.imageUrl || "").trim();
  } catch {
    return "";
  }
}

export function AdminSettings() {
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
    fontFamily: '"DM Sans", "Segoe UI", sans-serif',
    headingFont: '"Playfair Display", Georgia, serif',
  });
  const [isDark, setIsDark] = useState(false);
  const [menuIcons, setMenuIcons] = useState({
    home: "Home",
    products: "Leaf",
    services: "Briefcase",
    herencia: "Bot",
  });
  const [stripePublishableKey, setStripePublishableKey] = useState("");
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseAnonKey, setSupabaseAnonKey] = useState("");
  const [supabaseEnabled, setSupabaseEnabled] = useState(false);
  const [shippingCost, setShippingCost] = useState(5);
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiProvider, setAiProvider] = useState<"openai" | "groq">("groq");
  const [heroBannerUrl, setHeroBannerUrl] = useState("");
  const [ctaBannerUrl, setCtaBannerUrl] = useState("");
  const [tpvLayout, setTpvLayout] = useState<TpvLayoutSettings>(defaultTpvLayout);

  const availableIcons = [
    { name: "Home", icon: Home, label: "Casa" },
    { name: "House", icon: House, label: "Hogar" },
    { name: "Sparkles", icon: Sparkles, label: "Estrellas" },
    { name: "Flower", icon: Flower, label: "Flor" },
    { name: "Flower2", icon: Flower2, label: "Flor 2" },
    { name: "Leaf", icon: Leaf, label: "Hoja" },
    { name: "LeafyGreen", icon: LeafyGreen, label: "Hojas" },
    { name: "Package", icon: Package, label: "Paquete" },
    { name: "ShoppingBag", icon: ShoppingBag, label: "Bolsa" },
    { name: "Briefcase", icon: Briefcase, label: "Maletín" },
    { name: "Scissors", icon: Scissors, label: "Tijeras" },
    { name: "Store", icon: Store, label: "Tienda" },
    { name: "Building", icon: Building, label: "Edificio" },
    { name: "Bot", icon: Bot, label: "Robot" },
    { name: "Brain", icon: Brain, label: "Cerebro" },
    { name: "Zap", icon: Zap, label: "Rayo" },
    { name: "Star", icon: Star, label: "Estrella" },
  ];

  useEffect(() => {
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

    const savedIcons = backendStorage.getItem("menuIcons");
    if (savedIcons) {
      setMenuIcons(JSON.parse(savedIcons));
    }

    const savedStripe = backendStorage.getItem("stripeSettings");
    if (savedStripe) {
      const settings = JSON.parse(savedStripe);
      setStripePublishableKey(settings.publishableKey || "");
      setStripeEnabled(settings.enabled || false);
    }

    const savedSupabase = backendStorage.getItem("supabaseSettings");
    if (savedSupabase) {
      const settings = JSON.parse(savedSupabase);
      setSupabaseUrl(settings.url || "");
      setSupabaseAnonKey(settings.anonKey || "");
      setSupabaseEnabled(settings.enabled || false);
    }

    const savedShipping = backendStorage.getItem("shippingSettings");
    if (savedShipping) {
      const settings = JSON.parse(savedShipping);
      setShippingCost(settings.cost || 5);
    }

    const savedAi = backendStorage.getItem("aiSettings");
    if (savedAi) {
      const settings = JSON.parse(savedAi);
      setAiApiKey(settings.apiKey || "");
      setAiEnabled(settings.enabled || false);
      setAiProvider(settings.provider || "groq");
    }

    setHeroBannerUrl(parseBannerUrl(backendStorage.getItem("heroBanner")));
    setCtaBannerUrl(parseBannerUrl(backendStorage.getItem("ctaBanner")));
    setTpvLayout(parseTpvLayout(backendStorage.getItem("tpvLayoutSettings")));
  }, []);

  const moveLeftBlock = (index: number, direction: -1 | 1) => {
    setTpvLayout((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.leftBlockOrder.length) return current;
      const nextOrder = [...current.leftBlockOrder];
      const temp = nextOrder[index];
      nextOrder[index] = nextOrder[nextIndex];
      nextOrder[nextIndex] = temp;
      return { ...current, leftBlockOrder: nextOrder };
    });
  };

  const saveChatboxSettings = () => {
    try {
      const settings = {
        url: chatboxUrl,
        enabled: chatboxEnabled,
      };
      backendStorage.setItem("chatboxSettings", JSON.stringify(settings));
      window.dispatchEvent(new Event("storage"));
      console.log("✅ Chatbox guardado:", settings);
      toast.success("✅ Configuración del chatbox guardada correctamente");
    } catch (error) {
      console.error("❌ Error al guardar Chatbox:", error);
      toast.error("Error al guardar la configuración");
    }
  };

  const saveHerenciaSettings = () => {
    try {
      const settings = {
        url: herenciaUrl,
        enabled: herenciaEnabled,
      };
      backendStorage.setItem("herenciaSettings", JSON.stringify(settings));
      window.dispatchEvent(new Event("storage"));
      console.log("✅ Herenc(IA) guardado:", settings);
      toast.success("✅ Configuración de Herenc(IA) guardada correctamente");
    } catch (error) {
      console.error("❌ Error al guardar Herenc(IA):", error);
      toast.error("Error al guardar la configuración");
    }
  };

  const saveStripeSettings = () => {
    try {
      const settings = {
        publishableKey: stripePublishableKey,
        enabled: stripeEnabled,
      };
      backendStorage.setItem("stripeSettings", JSON.stringify(settings));
      window.dispatchEvent(new Event("storage"));
      console.log("✅ Stripe guardado:", settings);
      toast.success("✅ Configuración de Stripe guardada correctamente");
    } catch (error) {
      console.error("❌ Error al guardar Stripe:", error);
      toast.error("Error al guardar la configuración");
    }
  };

  const saveSupabaseSettings = () => {
    try {
      const settings = {
        url: supabaseUrl,
        anonKey: supabaseAnonKey,
        enabled: supabaseEnabled,
      };
      backendStorage.setItem("supabaseSettings", JSON.stringify(settings));
      window.dispatchEvent(new Event("storage"));
      console.log("✅ Supabase guardado:", settings);
      toast.success("✅ Configuración de Supabase guardada correctamente");
    } catch (error) {
      console.error("❌ Error al guardar Supabase:", error);
      toast.error("Error al guardar la configuración");
    }
  };

  const saveShippingSettings = () => {
    try {
      const settings = {
        cost: shippingCost,
      };
      backendStorage.setItem("shippingSettings", JSON.stringify(settings));
      window.dispatchEvent(new Event("storage"));
      console.log("✅ Shipping guardado:", settings);
      toast.success("✅ Configuración de envío guardada correctamente");
    } catch (error) {
      console.error("❌ Error al guardar Shipping:", error);
      toast.error("Error al guardar la configuración");
    }
  };

  const saveAiSettings = () => {
    try {
      const settings = {
        apiKey: aiApiKey,
        enabled: aiEnabled,
        provider: aiProvider,
      };
      backendStorage.setItem("aiSettings", JSON.stringify(settings));
      window.dispatchEvent(new Event("storage"));
      console.log("✅ IA guardado:", settings);
      toast.success(`✅ Configuración de ${aiProvider === "groq" ? "Groq" : "OpenAI"} guardada correctamente`);
    } catch (error) {
      console.error("❌ Error al guardar IA:", error);
      toast.error("Error al guardar la configuración");
    }
  };

  const saveAll = () => {
    try {
      backendStorage.setItem("chatboxSettings", JSON.stringify({
        url: chatboxUrl,
        enabled: chatboxEnabled,
      }));
      backendStorage.setItem("herenciaSettings", JSON.stringify({
        url: herenciaUrl,
        enabled: herenciaEnabled,
      }));
      backendStorage.setItem("customTheme", JSON.stringify(theme));
      backendStorage.setItem("menuIcons", JSON.stringify(menuIcons));
      backendStorage.setItem("stripeSettings", JSON.stringify({
        publishableKey: stripePublishableKey,
        enabled: stripeEnabled,
      }));
      backendStorage.setItem("supabaseSettings", JSON.stringify({
        url: supabaseUrl,
        anonKey: supabaseAnonKey,
        enabled: supabaseEnabled,
      }));
      backendStorage.setItem("shippingSettings", JSON.stringify({
        cost: shippingCost,
      }));
      backendStorage.setItem("aiSettings", JSON.stringify({
        apiKey: aiApiKey,
        enabled: aiEnabled,
        provider: aiProvider,
      }));
      backendStorage.setItem("heroBanner", JSON.stringify({ imageUrl: heroBannerUrl.trim() }));
      backendStorage.setItem("ctaBanner", JSON.stringify({ imageUrl: ctaBannerUrl.trim() }));
      backendStorage.setItem("tpvLayoutSettings", JSON.stringify(tpvLayout));
      window.dispatchEvent(new Event("storage"));
      console.log("✅ Toda la configuración guardada correctamente");
      toast.success("✅ Toda la configuración guardada correctamente");
    } catch (error) {
      console.error("❌ Error al guardar configuración:", error);
      toast.error("Error al guardar la configuración");
    }
  };

  const reloadSettings = () => {
    try {
      console.log("🔄 Recargando configuración desde backend...");

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

      const savedStripe = backendStorage.getItem("stripeSettings");
      if (savedStripe) {
        const settings = JSON.parse(savedStripe);
        setStripePublishableKey(settings.publishableKey || "");
        setStripeEnabled(settings.enabled || false);
      }

      const savedSupabase = backendStorage.getItem("supabaseSettings");
      if (savedSupabase) {
        const settings = JSON.parse(savedSupabase);
        setSupabaseUrl(settings.url || "");
        setSupabaseAnonKey(settings.anonKey || "");
        setSupabaseEnabled(settings.enabled || false);
      }

      const savedShipping = backendStorage.getItem("shippingSettings");
      if (savedShipping) {
        const settings = JSON.parse(savedShipping);
        setShippingCost(settings.cost || 5);
      }

      const savedAi = backendStorage.getItem("aiSettings");
      if (savedAi) {
        const settings = JSON.parse(savedAi);
        setAiApiKey(settings.apiKey || "");
        setAiEnabled(settings.enabled || false);
        setAiProvider(settings.provider || "groq");
      }

      const savedTheme = backendStorage.getItem("customTheme");
      if (savedTheme) {
        setTheme(JSON.parse(savedTheme));
      }

      setHeroBannerUrl(parseBannerUrl(backendStorage.getItem("heroBanner")));
      setCtaBannerUrl(parseBannerUrl(backendStorage.getItem("ctaBanner")));
      setTpvLayout(parseTpvLayout(backendStorage.getItem("tpvLayoutSettings")));

      const savedIcons = backendStorage.getItem("menuIcons");
      if (savedIcons) {
        setMenuIcons(JSON.parse(savedIcons));
      }

      console.log("✅ Configuración recargada correctamente");
      toast.success("✅ Configuración recargada desde backend");
    } catch (error) {
      console.error("❌ Error al recargar configuración:", error);
      toast.error("Error al recargar la configuración");
    }
  };

  const checkStoredData = () => {
    console.log("=== DIAGNÓSTICO DE CONFIGURACIÓN ===");
    console.log("🔍 Backend disponible:", typeof backendStorage !== "undefined");
    console.log("");

    const herencia = backendStorage.getItem("herenciaSettings");
    console.log("Herenc(IA) RAW:", herencia);
    console.log("Herenc(IA) PARSED:", herencia ? JSON.parse(herencia) : "❌ No guardado");
    console.log("");

    const stripe = backendStorage.getItem("stripeSettings");
    console.log("Stripe RAW:", stripe);
    console.log("Stripe PARSED:", stripe ? JSON.parse(stripe) : "❌ No guardado");
    console.log("");

    const supabase = backendStorage.getItem("supabaseSettings");
    console.log("Supabase RAW:", supabase);
    console.log("Supabase PARSED:", supabase ? JSON.parse(supabase) : "❌ No guardado");
    console.log("");

    const shipping = backendStorage.getItem("shippingSettings");
    console.log("Shipping RAW:", shipping);
    console.log("Shipping PARSED:", shipping ? JSON.parse(shipping) : "❌ No guardado");
    console.log("");

    const ai = backendStorage.getItem("aiSettings");
    console.log("IA RAW:", ai);
    console.log("IA PARSED:", ai ? JSON.parse(ai) : "❌ No guardado");
    console.log("");

    const chatbox = backendStorage.getItem("chatboxSettings");
    console.log("Chatbox RAW:", chatbox);
    console.log("Chatbox PARSED:", chatbox ? JSON.parse(chatbox) : "❌ No guardado");
    console.log("");

    const icons = backendStorage.getItem("menuIcons");
    console.log("Menu Icons RAW:", icons);
    console.log("Menu Icons PARSED:", icons ? JSON.parse(icons) : "❌ No guardado");
    console.log("");

    console.log("=== ESTADO ACTUAL EN MEMORIA ===");
    console.log("Herenc(IA) URL actual:", herenciaUrl);
    console.log("Herenc(IA) enabled actual:", herenciaEnabled);
    console.log("Stripe key actual:", stripePublishableKey ? "***" + stripePublishableKey.slice(-10) : "vacío");
    console.log("Stripe enabled actual:", stripeEnabled);
    console.log("");

    toast.info("✅ Revisa la consola del navegador (F12) para ver el diagnóstico completo");
  };

  const isBackendStorageAvailable = () => {
    try {
      const test = "__backendStorage_test__";
      backendStorage.setItem(test, test);
      backendStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Configuración General</h2>
        <p className="text-muted-foreground">Personaliza tu aplicación</p>
      </div>

      {/* Backend Status */}
      {!isBackendStorageAvailable() && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
          <p className="text-sm text-destructive font-medium mb-2">
            ⚠️ backend no está disponible
          </p>
          <p className="text-xs text-muted-foreground">
            El backend no respondió correctamente. Revisa VITE_API_URL, CORS y las variables de Supabase del servidor.
          </p>
        </div>
      )}

      {/* Chatbox IA */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-bold text-foreground">Chatbox IA (Widget Flotante)</h3>
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
              Aparecerá como widget flotante en todas las páginas
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

          <button
            onClick={saveChatboxSettings}
            className="w-full py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors text-sm"
          >
            Guardar Chatbox
          </button>
        </div>
      </div>

      {/* Herenc(IA) */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Bot className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-bold text-foreground">Herenc(IA) (Página dedicada)</h3>
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
              Aparecerá como botón en el menú principal
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
            Guardar Herenc(IA)
          </button>
        </div>
      </div>

      {/* Supabase Backend */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13.9 1.6c-.5-.4-1.2-.4-1.7 0L1.3 10.2c-.4.3-.6.8-.4 1.3.2.5.7.8 1.2.8h2.5V21c0 .6.4 1 1 1h13c.6 0 1-.4 1-1v-8.7h2.5c.5 0 1-.3 1.2-.8.2-.5 0-1-.4-1.3L13.9 1.6z"/>
          </svg>
          <h3 className="text-xl font-bold text-foreground">Supabase Backend</h3>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
            <p className="text-sm text-foreground mb-2">
              🚀 <strong>Base de Datos y Backend</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              Conecta tu proyecto de Supabase para guardar pedidos, productos y gestionar todo en tiempo real.
              Encuentra tus credenciales en: <a href="https://supabase.com/dashboard/project/_/settings/api" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Dashboard → Settings → API</a>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Project URL
            </label>
            <input
              type="url"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://xxxxx.supabase.co"
              className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-2">
              URL de tu proyecto Supabase
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Anon/Public Key
            </label>
            <input
              type="password"
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-2">
              ⚠️ Usa la clave <strong>anon public</strong>, no la service_role
            </p>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
            <div>
              <span className="text-sm font-medium text-foreground">Activar Supabase</span>
              <p className="text-xs text-muted-foreground mt-1">
                Base de datos y backend en tiempo real
              </p>
            </div>
            <button
              onClick={() => setSupabaseEnabled(!supabaseEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                supabaseEnabled ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  supabaseEnabled ? "translate-x-6" : ""
                }`}
              />
            </button>
          </div>

          {supabaseEnabled && (!supabaseUrl || !supabaseAnonKey) && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
              <p className="text-sm text-destructive">
                ⚠️ Debes ingresar URL y Anon Key para activar Supabase
              </p>
            </div>
          )}

          <button
            onClick={saveSupabaseSettings}
            className="w-full py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors text-sm"
          >
            Guardar Configuración de Supabase
          </button>
        </div>
      </div>

      {/* Shipping Configuration */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Truck className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-bold text-foreground">Configuración de Envío</h3>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
            <p className="text-sm text-foreground mb-2">
              🚚 <strong>Precio de Envío a Domicilio</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              Configura el costo de envío que se aplicará cuando el cliente elija "Envío a domicilio". La opción "Recoger en tienda" siempre será gratis.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Costo de Envío (€)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={shippingCost}
              onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
              placeholder="5.00"
              className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Este precio se mostrará en el carrito cuando el cliente seleccione envío a domicilio
            </p>
          </div>

          <div className="p-3 bg-muted rounded-xl">
            <p className="text-sm text-foreground font-medium mb-1">Vista previa</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Envío a domicilio:</span>
              <span className="font-bold text-foreground">€{shippingCost.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-muted-foreground">Recoger en tienda:</span>
              <span className="font-bold text-primary">¡Gratis!</span>
            </div>
          </div>

          <button
            onClick={saveShippingSettings}
            className="w-full py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors text-sm"
          >
            Guardar Configuración de Envío
          </button>
        </div>
      </div>

      {/* AI Configuration (Groq/OpenAI) */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Brain className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-bold text-foreground">IA - Descripciones Automáticas</h3>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
            <p className="text-sm text-foreground mb-2">
              🤖 <strong>Generación Automática de Descripciones</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              Usa Groq (recomendado - más rápido y económico) o OpenAI para generar descripciones detalladas de plantas.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Proveedor de IA
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setAiProvider("groq")}
                className={`p-4 rounded-xl border-2 transition-all ${
                  aiProvider === "groq"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted"
                }`}
              >
                <div className="text-center">
                  <p className="font-bold text-foreground mb-1">Groq</p>
                  <p className="text-xs text-muted-foreground">Súper rápido</p>
                  {aiProvider === "groq" && (
                    <p className="text-xs text-primary mt-2">✓ Seleccionado</p>
                  )}
                </div>
              </button>
              <button
                onClick={() => setAiProvider("openai")}
                className={`p-4 rounded-xl border-2 transition-all ${
                  aiProvider === "openai"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted"
                }`}
              >
                <div className="text-center">
                  <p className="font-bold text-foreground mb-1">OpenAI</p>
                  <p className="text-xs text-muted-foreground">GPT-3.5/4</p>
                  {aiProvider === "openai" && (
                    <p className="text-xs text-primary mt-2">✓ Seleccionado</p>
                  )}
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {aiProvider === "groq" ? "Groq API Key" : "OpenAI API Key"}
            </label>
            <input
              type="password"
              value={aiApiKey}
              onChange={(e) => setAiApiKey(e.target.value)}
              placeholder={aiProvider === "groq" ? "gsk_..." : "sk-..."}
              className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {aiProvider === "groq" ? (
                <>
                  Obtén tu API Key gratis en: <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Groq Console</a>
                </>
              ) : (
                <>
                  Obtén tu API Key en: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OpenAI Platform</a>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
            <div>
              <span className="text-sm font-medium text-foreground">Activar IA</span>
              <p className="text-xs text-muted-foreground mt-1">
                Genera descripciones automáticas al ver productos
              </p>
            </div>
            <button
              onClick={() => setAiEnabled(!aiEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                aiEnabled ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  aiEnabled ? "translate-x-6" : ""
                }`}
              />
            </button>
          </div>

          {aiEnabled && !aiApiKey && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
              <p className="text-sm text-destructive">
                ⚠️ Debes ingresar tu API Key de {aiProvider === "groq" ? "Groq" : "OpenAI"} para activar esta función
              </p>
            </div>
          )}

          <div className="p-3 bg-muted rounded-xl">
            <p className="text-sm text-foreground font-medium mb-2">¿Qué se generará?</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>✓ Descripción detallada de la planta</li>
              <li>✓ Guía de cuidados (riego, luz, temperatura, fertilización)</li>
              <li>✓ Beneficios y características principales</li>
              <li>✓ Consejos de experto personalizados</li>
            </ul>
          </div>

          {aiProvider === "groq" && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl">
              <p className="text-xs text-foreground">
                💡 <strong>Groq es recomendado:</strong> Es gratuito, súper rápido (10x más que OpenAI) y usa modelos avanzados como Llama 3.
              </p>
            </div>
          )}

          <button
            onClick={saveAiSettings}
            className="w-full py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors text-sm"
          >
            Guardar Configuración de IA
          </button>
        </div>
      </div>

      {/* Stripe Payment */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z"/>
          </svg>
          <h3 className="text-xl font-bold text-foreground">Pagos con Stripe</h3>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
            <p className="text-sm text-foreground mb-2">
              🔐 <strong>Configuración de Pagos Reales</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              Ingresa tu clave pública de Stripe para aceptar pagos con tarjeta.
              Encuentra tus claves en: <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Dashboard → API Keys</a>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Publishable Key (pk_...)
            </label>
            <input
              type="text"
              value={stripePublishableKey}
              onChange={(e) => setStripePublishableKey(e.target.value)}
              placeholder="pk_test_... o pk_live_..."
              className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-2">
              ⚠️ Solo usa la clave <strong>PUBLISHABLE</strong> (pk_...), nunca la SECRET key
            </p>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
            <div>
              <span className="text-sm font-medium text-foreground">Activar Pagos con Stripe</span>
              <p className="text-xs text-muted-foreground mt-1">
                Los clientes podrán pagar con tarjeta
              </p>
            </div>
            <button
              onClick={() => setStripeEnabled(!stripeEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                stripeEnabled ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  stripeEnabled ? "translate-x-6" : ""
                }`}
              />
            </button>
          </div>

          {stripeEnabled && !stripePublishableKey && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
              <p className="text-sm text-destructive">
                ⚠️ Debes ingresar tu Publishable Key para activar Stripe
              </p>
            </div>
          )}

          <button
            onClick={saveStripeSettings}
            className="w-full py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors text-sm"
          >
            Guardar Configuración de Stripe
          </button>
        </div>
      </div>

      {/* Colors */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Palette className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-bold text-foreground">Colores del Tema</h3>
        </div>

        <div className="space-y-4">
          <ColorPicker
            label="Color Principal"
            value={theme.primaryColor}
            onChange={(v) => setTheme({ ...theme, primaryColor: v })}
          />
          <ColorPicker
            label="Color Secundario"
            value={theme.secondaryColor}
            onChange={(v) => setTheme({ ...theme, secondaryColor: v })}
          />
          <ColorPicker
            label="Color de Acento"
            value={theme.accentColor}
            onChange={(v) => setTheme({ ...theme, accentColor: v })}
          />
          <ColorPicker
            label="Color de Fondo"
            value={theme.backgroundColor}
            onChange={(v) => setTheme({ ...theme, backgroundColor: v })}
          />
          <ColorPicker
            label="Color de Texto"
            value={theme.foregroundColor}
            onChange={(v) => setTheme({ ...theme, foregroundColor: v })}
          />
          <ColorPicker
            label="Color de Bordes"
            value={theme.borderColor}
            onChange={(v) => setTheme({ ...theme, borderColor: v })}
          />
        </div>
      </div>

      {/* Typography and Radius */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Type className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-bold text-foreground">Tipografía y Estilo</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Fuente base</label>
            <select
              value={theme.fontFamily}
              onChange={(e) => setTheme({ ...theme, fontFamily: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-border rounded-xl"
            >
              <option value='"DM Sans", "Segoe UI", sans-serif'>DM Sans</option>
              <option value='"Nunito Sans", "Segoe UI", sans-serif'>Nunito Sans</option>
              <option value='"Poppins", "Segoe UI", sans-serif'>Poppins</option>
              <option value='"Manrope", "Segoe UI", sans-serif'>Manrope</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Fuente de títulos</label>
            <select
              value={theme.headingFont}
              onChange={(e) => setTheme({ ...theme, headingFont: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-border rounded-xl"
            >
              <option value='"Playfair Display", Georgia, serif'>Playfair Display</option>
              <option value='"Cormorant Garamond", Georgia, serif'>Cormorant Garamond</option>
              <option value='"Merriweather", Georgia, serif'>Merriweather</option>
              <option value='"Bodoni Moda", Georgia, serif'>Bodoni Moda</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Redondeado global</label>
            <select
              value={theme.borderRadius}
              onChange={(e) => setTheme({ ...theme, borderRadius: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-border rounded-xl"
            >
              <option value="0.5rem">Suave</option>
              <option value="0.75rem">Equilibrado</option>
              <option value="1rem">Moderno</option>
              <option value="1.25rem">Bold</option>
            </select>
          </div>
        </div>
      </div>

      {/* Home banners */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Palette className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-bold text-foreground">Imágenes Home</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Hero principal (URL imagen)</label>
            <input
              type="url"
              value={heroBannerUrl}
              onChange={(e) => setHeroBannerUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-2 bg-background border border-border rounded-xl"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Banner CTA inferior (URL imagen)</label>
            <input
              type="url"
              value={ctaBannerUrl}
              onChange={(e) => setCtaBannerUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-2 bg-background border border-border rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* TPV layout editor */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Package className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-bold text-foreground">Editor de TPV (bloques y columnas)</h3>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ToggleRow label="Mostrar estado" enabled={tpvLayout.showStatus} onToggle={() => setTpvLayout({ ...tpvLayout, showStatus: !tpvLayout.showStatus })} />
            <ToggleRow label="Mostrar venta actual" enabled={tpvLayout.showCurrentSale} onToggle={() => setTpvLayout({ ...tpvLayout, showCurrentSale: !tpvLayout.showCurrentSale })} />
            <ToggleRow label="Mostrar panel de pago" enabled={tpvLayout.showPayment} onToggle={() => setTpvLayout({ ...tpvLayout, showPayment: !tpvLayout.showPayment })} />
            <ToggleRow label="Mostrar teclado" enabled={tpvLayout.showKeypad} onToggle={() => setTpvLayout({ ...tpvLayout, showKeypad: !tpvLayout.showKeypad })} />
            <ToggleRow label="Mostrar cabecera catálogo" enabled={tpvLayout.showCatalogHeader} onToggle={() => setTpvLayout({ ...tpvLayout, showCatalogHeader: !tpvLayout.showCatalogHeader })} />
            <ToggleRow label="Mostrar catálogo productos" enabled={tpvLayout.showCatalogGrid} onToggle={() => setTpvLayout({ ...tpvLayout, showCatalogGrid: !tpvLayout.showCatalogGrid })} />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Columnas de artículos</label>
            <select
              value={tpvLayout.productColumns}
              onChange={(e) => setTpvLayout({ ...tpvLayout, productColumns: Number(e.target.value) as 2 | 3 | 4 })}
              className="w-full px-4 py-2 bg-background border border-border rounded-xl"
            >
              <option value={2}>2 columnas</option>
              <option value={3}>3 columnas</option>
              <option value={4}>4 columnas</option>
            </select>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-2">Orden de bloques (columna izquierda)</p>
            <div className="space-y-2">
              {tpvLayout.leftBlockOrder.map((block, index) => (
                <div key={block} className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                  <span className="text-sm text-foreground">{blockLabel(block)}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => moveLeftBlock(index, -1)}
                      className="px-3 py-1 rounded-lg bg-muted hover:bg-accent text-sm"
                    >
                      Subir
                    </button>
                    <button
                      type="button"
                      onClick={() => moveLeftBlock(index, 1)}
                      className="px-3 py-1 rounded-lg bg-muted hover:bg-accent text-sm"
                    >
                      Bajar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Menu Icons */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-bold text-foreground">Iconos del Menú</h3>
        </div>

        <div className="space-y-6">
          <IconSelector
            label="Icono Inicio"
            value={menuIcons.home}
            onChange={(icon) => setMenuIcons({ ...menuIcons, home: icon })}
            icons={availableIcons}
          />
          <IconSelector
            label="Icono Productos"
            value={menuIcons.products}
            onChange={(icon) => setMenuIcons({ ...menuIcons, products: icon })}
            icons={availableIcons}
          />
          <IconSelector
            label="Icono Servicios"
            value={menuIcons.services}
            onChange={(icon) => setMenuIcons({ ...menuIcons, services: icon })}
            icons={availableIcons}
          />
          <IconSelector
            label="Icono Herenc(IA)"
            value={menuIcons.herencia}
            onChange={(icon) => setMenuIcons({ ...menuIcons, herencia: icon })}
            icons={availableIcons}
          />
        </div>
      </div>

      {/* Save All Button */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={saveAll}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Save className="w-4 h-4" />
            Guardar Todo
          </button>
          <button
            onClick={reloadSettings}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-muted text-foreground rounded-xl hover:bg-accent transition-colors"
            title="Recargar configuración desde backend"
          >
            <RotateCcw className="w-4 h-4" />
            Recargar
          </button>
          <button
            onClick={checkStoredData}
            className="px-4 py-3 bg-muted text-foreground rounded-xl hover:bg-accent transition-colors flex items-center justify-center gap-2"
            title="Ver configuración guardada en consola"
          >
            <Eye className="w-4 h-4" />
            Diagnóstico
          </button>
        </div>

        {/* Ayuda */}
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <p className="text-sm text-foreground font-medium mb-3">
            🔧 Guía de Uso
          </p>
          <div className="space-y-3 text-xs text-muted-foreground">
            <div>
              <p className="font-medium text-foreground mb-1">📝 Guardar Todo</p>
              <p>Guarda toda la configuración en backend real</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">🔄 Recargar</p>
              <p>Recarga la configuración guardada en backend (útil si los valores no se muestran)</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">👁️ Diagnóstico</p>
              <p>Muestra en la consola (F12) todos los datos guardados. Úsalo para verificar que todo se guardó correctamente</p>
            </div>
            <div className="pt-2 border-t border-border">
              <p className="font-medium text-foreground mb-1">⚠️ ¿Los datos desaparecen?</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Verifica que el backend esté desplegado y activo</li>
                <li>Verifica que Supabase tenga las tablas creadas y la service role configurada</li>
                <li>Usa el botón "Diagnóstico" para verificar qué está guardado</li>
                <li>Después de guardar, usa "Recargar" para confirmar que los datos persisten</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function IconSelector({ label, value, onChange, icons }: {
  label: string;
  value: string;
  onChange: (icon: string) => void;
  icons: Array<{ name: string; icon: any; label: string }>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const currentIcon = icons.find(i => i.name === value);

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-background border border-border rounded-xl hover:bg-accent transition-colors"
        >
          <div className="flex items-center gap-3">
            {currentIcon && <currentIcon.icon className="w-5 h-5 text-foreground" />}
            <span className="text-foreground">{currentIcon?.label || value}</span>
          </div>
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto">
            <div className="p-2 grid grid-cols-3 gap-2">
              {icons.map((icon) => (
                <button
                  key={icon.name}
                  type="button"
                  onClick={() => {
                    onChange(icon.name);
                    setIsOpen(false);
                  }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-colors ${
                    value === icon.name
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent text-foreground"
                  }`}
                >
                  <icon.icon className="w-6 h-6" />
                  <span className="text-xs text-center">{icon.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
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

function ToggleRow({ label, enabled, onToggle }: { label: string; enabled: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <button
        type="button"
        onClick={onToggle}
        className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
      >
        <div
          className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${enabled ? "translate-x-6" : ""}`}
        />
      </button>
    </div>
  );
}

function blockLabel(block: TpvLeftBlockId) {
  if (block === "status") return "Estado";
  if (block === "currentSale") return "Venta actual";
  if (block === "payment") return "Pago y emisión";
  return "Teclado numérico";
}
