import { useState, useEffect } from "react";
import {
  Palette, Type, Moon, Sun, Eye, Save, RotateCcw, Bot, MessageSquare, ExternalLink,
  Home, House, Sparkles, Flower, Flower2, Leaf, LeafyGreen, Package, ShoppingBag,
  Briefcase, Scissors, Store, Building, Brain, Zap, Star, Truck
} from "lucide-react";
import { backendApi, backendStorage } from "../../lib/backendStorage";
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
  const [herenciaEnabled, setHerenciaEnabled] = useState(true);
  const [herenciaMode, setHerenciaMode] = useState<"integrated" | "external">("integrated");
  const [herenciaFeatures, setHerenciaFeatures] = useState({
    createBouquet: false,
    findPlant: false,
    searchByPhoto: false,
    findGift: false,
    surpriseMe: false,
  });
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
  const [draggingBlock, setDraggingBlock] = useState<TpvLeftBlockId | null>(null);
  const [dragOverBlock, setDragOverBlock] = useState<TpvLeftBlockId | null>(null);
  const [readiness, setReadiness] = useState<any>(null);

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
      setHerenciaEnabled(settings.enabled !== false);
      setHerenciaMode(settings.mode === "external" || settings.useIntegrated === false ? "external" : "integrated");
      setHerenciaFeatures({
        createBouquet: Boolean(settings.features?.createBouquet),
        findPlant: Boolean(settings.features?.findPlant),
        searchByPhoto: Boolean(settings.features?.searchByPhoto),
        findGift: Boolean(settings.features?.findGift),
        surpriseMe: Boolean(settings.features?.surpriseMe),
      });
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
    void backendApi.readiness().then(setReadiness).catch(() => setReadiness(null));
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

  const reorderLeftBlock = (source: TpvLeftBlockId, target: TpvLeftBlockId) => {
    if (source === target) return;

    setTpvLayout((current) => {
      const nextOrder = [...current.leftBlockOrder];
      const sourceIndex = nextOrder.indexOf(source);
      const targetIndex = nextOrder.indexOf(target);

      if (sourceIndex === -1 || targetIndex === -1) return current;

      nextOrder.splice(sourceIndex, 1);
      nextOrder.splice(targetIndex, 0, source);

      return { ...current, leftBlockOrder: nextOrder };
    });
  };

  const handleBlockDragStart = (block: TpvLeftBlockId) => {
    setDraggingBlock(block);
    setDragOverBlock(block);
  };

  const handleBlockDrop = (target: TpvLeftBlockId) => {
    if (draggingBlock) {
      reorderLeftBlock(draggingBlock, target);
    }

    setDraggingBlock(null);
    setDragOverBlock(null);
  };

  const handleBlockDragEnd = () => {
    setDraggingBlock(null);
    setDragOverBlock(null);
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
        mode: herenciaMode,
        useIntegrated: herenciaMode === "integrated",
        features: herenciaFeatures,
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
        mode: herenciaMode,
        useIntegrated: herenciaMode === "integrated",
        features: herenciaFeatures,
      }));
      backendStorage.setItem("customTheme", JSON.stringify(theme));
      backendStorage.setItem("menuIcons", JSON.stringify(menuIcons));
      backendStorage.setItem("stripeSettings", JSON.stringify({
        publishableKey: stripePublishableKey,
        enabled: stripeEnabled,
      }));
      backendStorage.setItem("shippingSettings", JSON.stringify({
        cost: shippingCost,
      }));
      backendStorage.setItem("aiSettings", JSON.stringify({
        enabled: aiEnabled,
        provider: "groq",
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
        setHerenciaEnabled(settings.enabled !== false);
        setHerenciaMode(settings.mode === "external" || settings.useIntegrated === false ? "external" : "integrated");
        setHerenciaFeatures({
          createBouquet: Boolean(settings.features?.createBouquet),
          findPlant: Boolean(settings.features?.findPlant),
          searchByPhoto: Boolean(settings.features?.searchByPhoto),
          findGift: Boolean(settings.features?.findGift),
          surpriseMe: Boolean(settings.features?.surpriseMe),
        });
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
            El backend no respondió correctamente. Revisa el proxy /api, CORS y las variables de Railway del servidor.
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
          <h3 className="text-xl font-bold text-foreground">Herenc(IA)</h3>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-sm font-semibold text-foreground">Origen de la aplicación</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Elige la app integrada en Herencia Market o conserva una URL externa como alternativa.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setHerenciaMode("integrated")}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                  herenciaMode === "integrated"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-accent"
                }`}
              >
                App integrada
              </button>
              <button
                type="button"
                onClick={() => setHerenciaMode("external")}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                  herenciaMode === "external"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-accent"
                }`}
              >
                Usar URL
              </button>
            </div>
          </div>

          {herenciaMode === "integrated" ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
              <p className="font-bold text-emerald-800">App integrada seleccionada</p>
              <p className="mt-1 text-xs text-emerald-700">
                Se abre dentro de Herencia Market y utiliza GROQ_API_KEY desde Railway. La clave nunca se expone al navegador.
              </p>
              <a href="/ia" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 font-semibold text-emerald-800">
                <ExternalLink className="h-4 w-4" /> Probar /ia
              </a>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                URL externa de Herenc(IA)
              </label>
              <input
                type="url"
                value={herenciaUrl}
                onChange={(e) => setHerenciaUrl(e.target.value)}
                placeholder="https://tu-ia-herencia.com"
                className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Solo se utiliza cuando seleccionas “Usar URL”.
              </p>
            </div>
          )}

          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-sm font-semibold text-foreground">Funciones opcionales del chat</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Están desactivadas por defecto. Puedes encenderlas cuando quieras sin tocar código.
            </p>
            <div className="mt-4 space-y-2">
              {[
                ["createBouquet", "Crear un ramo"],
                ["findPlant", "Encontrar una planta"],
                ["searchByPhoto", "Buscar por foto"],
                ["findGift", "Buscar un regalo"],
                ["surpriseMe", "Sorpréndeme"],
              ].map(([key, label]) => {
                const enabled = Boolean(herenciaFeatures[key as keyof typeof herenciaFeatures]);
                return (
                  <div key={key} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2">
                    <span className="text-sm font-medium text-foreground">{label}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setHerenciaFeatures((current) => ({
                          ...current,
                          [key]: !current[key as keyof typeof current],
                        }))
                      }
                      className={`relative h-6 w-12 rounded-full transition-colors ${enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
                      aria-pressed={enabled}
                    >
                      <div className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : ""}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
            <div>
              <span className="text-sm font-medium text-foreground">Activar Herenc(IA)</span>
              <p className="text-xs text-muted-foreground">Controla si aparece y puede abrirse desde la tienda.</p>
            </div>
            <button
              type="button"
              onClick={() => setHerenciaEnabled(!herenciaEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                herenciaEnabled ? "bg-primary" : "bg-muted-foreground/30"
              }`}
              aria-pressed={herenciaEnabled}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  herenciaEnabled ? "translate-x-6" : ""
                }`}
              />
            </button>
          </div>

          <button
            onClick={saveHerenciaSettings}
            className="w-full py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors text-sm"
          >
            Guardar Herenc(IA)
          </button>
        </div>
      </div>

      {/* Production infrastructure */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Building className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-bold text-foreground">Infraestructura de producción</h3>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
            <p className="font-semibold text-foreground">Base principal: Neon PostgreSQL</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Las credenciales de base de datos, Stripe, R2, Resend, Maps e IA se administran únicamente en Railway/Vercel. No se guardan claves privadas desde el navegador.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["Neon / base de datos", readiness?.database],
              ["Stripe servidor", readiness?.stripe],
              ["Webhook Stripe", readiness?.stripeWebhook],
              ["Cloudflare R2", readiness?.r2Configured],
              ["Resend / email", readiness?.email],
              ["Google Maps", readiness?.maps],
            ].map(([label, ok]) => (
              <div key={String(label)} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
                <span>{String(label)}</span>
                <span className={ok ? "font-bold text-emerald-600" : "font-bold text-amber-600"}>
                  {readiness == null ? "Comprobando…" : ok ? "OK" : "Pendiente"}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Para una comprobación completa usa Administración → Diagnóstico. Supabase queda solo como compatibilidad heredada y no es la base principal de Commerce.
          </p>
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
              Configura el coste base de la entrega a domicilio. Herencia Market no ofrece recogida en tienda.
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
              <span className="text-muted-foreground">Modalidad:</span>
              <span className="font-bold text-primary">Solo entrega a domicilio</span>
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

      {/* AI Configuration */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Brain className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-bold text-foreground">Inteligencia artificial</h3>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm font-semibold text-foreground">Credenciales protegidas en Railway</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Groq se usa para texto y ventas; Gemini/Nano Banana para funciones visuales cuando están configurados. Las claves privadas no se introducen ni se muestran en Administración.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-3 text-sm">
              <span>IA de texto / ventas</span>
              <span className={readiness?.salesAi ? "font-bold text-emerald-600" : "font-bold text-amber-600"}>
                {readiness == null ? "Comprobando…" : readiness?.salesAi ? "Groq OK" : "Pendiente"}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-3 text-sm">
              <span>IA de imágenes</span>
              <span className={readiness?.imageAi ? "font-bold text-emerald-600" : "font-bold text-amber-600"}>
                {readiness == null ? "Comprobando…" : readiness?.imageAi ? "Proveedor OK" : "Pendiente"}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
            <div>
              <span className="text-sm font-medium text-foreground">Activar funciones IA del catálogo</span>
              <p className="text-xs text-muted-foreground mt-1">Generación automática de información al preparar productos para publicar.</p>
            </div>
            <button
              onClick={() => setAiEnabled(!aiEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${aiEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}
            >
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${aiEnabled ? "translate-x-6" : ""}`} />
            </button>
          </div>
          <button
            onClick={() => {
              void backendStorage.setItem("aiSettings", JSON.stringify({ enabled: aiEnabled, provider: "groq" }));
              window.dispatchEvent(new Event("storage"));
              toast.success("Preferencia de IA guardada");
            }}
            className="w-full py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors text-sm"
          >
            Guardar preferencia de IA
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
                <div
                  key={block}
                  draggable
                  onDragStart={() => handleBlockDragStart(block)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOverBlock(block);
                  }}
                  onDrop={() => handleBlockDrop(block)}
                  onDragEnd={handleBlockDragEnd}
                  className={`flex items-center justify-between rounded-xl border px-3 py-3 transition-all ${
                    draggingBlock === block
                      ? "border-primary bg-primary/10 opacity-70"
                      : dragOverBlock === block && draggingBlock
                      ? "border-emerald-400 bg-emerald-50 shadow-sm"
                      : "border-border bg-background"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="cursor-grab select-none text-lg text-muted-foreground active:cursor-grabbing">::</span>
                    <span className="text-sm text-foreground">{blockLabel(block)}</span>
                  </div>
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
                <li>Verifica que Neon esté disponible y que Railway tenga las variables de producción configuradas</li>
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
