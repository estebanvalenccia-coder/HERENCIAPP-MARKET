import { useMemo, useState, useEffect } from "react";
import {
  Plus, Trash2, User, Mail, Phone, MapPin, FileText, Download, Eye, X, Settings, BarChart3, Search,
  ShoppingCart, Minus, CreditCard, Printer, AlertCircle, CheckCircle, TrendingUp, DollarSign, Package,
  Send, Clock, Zap, LogOut, RefreshCw, Filter, TrendingDown, Home
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { products as initialProducts } from "../../data/products";
import { backendStorage } from "../../lib/backendStorage";

type PosItem = {
  id: string;
  name: string;
  sku: string;
  price: number;
  iva: number;
  stock: number;
  category: string;
  emoji: string;
};

type CartLine = PosItem & {
  qty: number;
  discount?: number;
};

type Customer = {
  id: string;
  name: string;
  nif: string;
  email: string;
  phone: string;
  address: string;
  isCompany: boolean;
};

type Sale = {
  id: string;
  serieCode: string;
  documentType: "ticket" | "invoice" | "devolution";
  customer: Customer;
  payment: string;
  items: CartLine[];
  subtotal: number;
  iva: number;
  total: number;
  globalDiscount?: number;
  notes: string;
  veriFactuId?: string;
  veriFactuStatus: "pending" | "sent" | "accepted" | "rejected" | "error";
  veriFactuMessage?: string;
  createdAt: string;
  operatorName: string;
  tillNumber: string;
};

const demoProducts: PosItem[] = [
  { id: "p1", name: "Ramo temporada premium", sku: "RAM-001", price: 45, iva: 21, stock: 12, category: "Ramos", emoji: "💐" },
  { id: "p2", name: "Rosa roja unidad", sku: "FLO-101", price: 4.5, iva: 10, stock: 80, category: "Flor cortada", emoji: "🌹" },
  { id: "p3", name: "Monstera Deliciosa", sku: "PLA-210", price: 39.95, iva: 21, stock: 6, category: "Plantas", emoji: "🪴" },
  { id: "p4", name: "Orquídea Phalaenopsis", sku: "PLA-211", price: 29.95, iva: 21, stock: 9, category: "Plantas", emoji: "🌸" },
  { id: "p5", name: "Maceta cerámica blanca", sku: "MAC-030", price: 12.5, iva: 21, stock: 18, category: "Macetas", emoji: "🏺" },
  { id: "p6", name: "Sustrato universal 10L", sku: "SUB-010", price: 6.95, iva: 21, stock: 30, category: "Sustratos", emoji: "🌱" },
  { id: "p7", name: "Fertilizante universal", sku: "FER-100", price: 9.9, iva: 21, stock: 22, category: "Fertilizantes", emoji: "🧴" },
  { id: "p8", name: "Tarjeta dedicatoria", sku: "ACC-001", price: 2.5, iva: 21, stock: 100, category: "Accesorios", emoji: "💌" },
  { id: "p9", name: "Orquídea blanca premium", sku: "PLA-212", price: 49.95, iva: 21, stock: 4, category: "Plantas", emoji: "🪷" },
  { id: "p10", name: "Helecho decorativo", sku: "PLA-213", price: 24.95, iva: 21, stock: 7, category: "Plantas", emoji: "🌿" },
];

const PRODUCT_STORAGE_KEY = "adminProducts";
const SETTINGS_STORAGE_KEY = "herencia_pos_settings";
const SALES_STORAGE_KEY = "herencia_pos_sales";

function money(n: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0);
}

function keypadDisplay(value: string, fallbackAmount: number) {
  if (value === "") return money(fallbackAmount);
  return `${value.replace(".", ",")} €`;
}

type CatalogProduct = PosItem & {
  image: string;
  description: string;
  featured?: boolean;
  active?: boolean;
  onSale?: boolean;
  salePrice?: number;
};

function mapBackendProductToPosItem(product: any, index: number): CatalogProduct {
  return {
    id: String(product.id ?? index + 1),
    name: product.name || `Producto ${index + 1}`,
    sku: product.sku || `PRD-${String(index + 1).padStart(3, "0")}`,
    price: Number(product.salePrice ?? product.price ?? 0),
    iva: Number(product.iva ?? 21),
    stock: Number(product.stock ?? (product.featured ? 25 : 12)),
    category: product.category || "Sin categoría",
    emoji: product.emoji || "📦",
    image: product.image || "",
    description: product.description || "",
    featured: product.featured,
    active: product.active ?? true,
    onSale: product.onSale,
    salePrice: product.salePrice,
  };
}

function toBackendProduct(product: CatalogProduct) {
  return {
    id: Number(product.id) || Date.now(),
    name: product.name,
    category: product.category,
    price: product.salePrice ?? product.price,
    image: product.image || "",
    description: product.description || product.name,
    featured: product.featured || false,
    active: product.active ?? true,
    onSale: product.onSale ?? false,
    salePrice: product.onSale ? product.salePrice ?? product.price * 0.8 : undefined,
    stock: product.stock,
    sku: product.sku,
    iva: product.iva,
    emoji: product.emoji,
  };
}

function loadCatalogProducts(): CatalogProduct[] {
  const saved = backendStorage.getItem(PRODUCT_STORAGE_KEY);

  if (saved) {
    return JSON.parse(saved).map((product: any, index: number) => mapBackendProductToPosItem(product, index));
  }

  return initialProducts.map((product, index) =>
    mapBackendProductToPosItem(
      {
        ...product,
        stock: product.featured ? 25 : 12,
        emoji: ["💐", "🌹", "🪴", "🌸", "🏺", "🌱", "🧴", "💌", "🪷", "🌿"][index % 10],
        sku: `PRD-${String(product.id).padStart(3, "0")}`,
        iva: 21,
      },
      index
    )
  );
}

const tabLabels: Record<string, string> = {
  venta: "Venta",
  clientes: "Clientes",
  estadisticas: "Estadísticas",
  inventario: "Inventario",
  caja: "Caja",
  devolucion: "Devoluciones",
  settings: "Configuración",
};

// VeriFactu API Real Integration
async function sendToVeriFactu(sale: Sale): Promise<{ id: string; status: string; message: string }> {
  try {
    const settingsRaw = backendStorage.getItem(SETTINGS_STORAGE_KEY);
    const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
    const veriFactuUrl = settings.veriFactuEndpoint || import.meta.env.VITE_VERIFACTU_ENDPOINT;
    const veriFactuToken = settings.veriFactuToken || import.meta.env.VITE_VERIFACTU_TOKEN;

    if (!veriFactuUrl || !veriFactuToken) {
      return {
        id: "",
        status: "error",
        message: "Configura el endpoint y token reales de VeriFactu en Ajustes",
      };
    }

    const payload = {
      numero: sale.id,
      serie: sale.serieCode,
      fecha: new Date(sale.createdAt).toISOString().split("T")[0],
      cliente: {
        nif: sale.customer.nif || "00000000T",
        nombre: sale.customer.name,
        esEmpresa: sale.customer.isCompany
      },
      lineas: sale.items.map(item => ({
        descripcion: item.name,
        cantidad: item.qty,
        precioUnitario: item.price / (1 + item.iva / 100),
        iva: item.iva,
        descuento: item.discount || 0
      })),
      totales: {
        baseImponible: sale.subtotal,
        iva: sale.iva,
        total: sale.total
      },
      formaPago: sale.payment,
      referencia: `${sale.tillNumber}-${Date.now()}`
    };

    const response = await fetch(veriFactuUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${veriFactuToken}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        id: "",
        status: "error",
        message: result?.message || `VeriFactu respondió con estado ${response.status}`,
      };
    }

    const veriFactuId = result.id || result.veriFactuId || `VF-${sale.serieCode}-${sale.id}-${Date.now().toString(36).toUpperCase()}`;
    return {
      id: veriFactuId,
      status: result.status || "accepted",
      message: result.message || `Factura enviada a VeriFactu con ID ${veriFactuId}`,
    };
  } catch (error) {
    console.error("Error enviando a VeriFactu:", error);
    return {
      id: "",
      status: "error",
      message: "No se pudo conectar con VeriFactu"
    };
  }
}

const initialCustomers: Customer[] = [
  { id: "c1", name: "Cliente mostrador", nif: "", email: "", phone: "", address: "", isCompany: false },
  { id: "c2", name: "María García", nif: "12345678A", email: "maria@email.com", phone: "666123456", address: "Barcelona", isCompany: false },
  { id: "c3", name: "Empresa Eventos SL", nif: "B87654321", email: "info@eventos.es", phone: "934567890", address: "Madrid", isCompany: true },
];

export function AdminPOSProfessional2() {
  // Estados principales
  const [activeTab, setActiveTab] = useState<"venta" | "clientes" | "estadisticas" | "inventario" | "caja" | "devolucion" | "settings">("venta");
  const [operatorName, setOperatorName] = useState("Vendedor 1");
  const [tillNumber, setTillNumber] = useState("TPV-001");
  const [serieCode, setSerieCode] = useState("A");
  
  // Estados de venta
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [customer, setCustomer] = useState<Customer>(initialCustomers[0]);
  const [payment, setPayment] = useState("Efectivo");
  const [received, setReceived] = useState(0);
  const [keypadValue, setKeypadValue] = useState("");
  const [documentType, setDocumentType] = useState<"ticket" | "invoice">("ticket");
  const [notes, setNotes] = useState("");
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [invoiceNumber, setInvoiceNumber] = useState("2024-001");
  const [isProcessing, setIsProcessing] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>(() => loadCatalogProducts());
  const [showProductEditor, setShowProductEditor] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<PosItem>({
    id: "",
    name: "",
    sku: "",
    price: 0,
    iva: 21,
    stock: 0,
    category: "",
    emoji: "🌸",
  });
  const [veriFactuEndpoint, setVeriFactuEndpoint] = useState(() => {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return saved ? (JSON.parse(saved).veriFactuEndpoint || "") : "";
  });
  const [veriFactuToken, setVeriFactuToken] = useState(() => {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return saved ? (JSON.parse(saved).veriFactuToken || "") : "";
  });
  
  // Estados de cliente
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    nif: "",
    email: "",
    phone: "",
    address: "",
    isCompany: false,
  });

  // Cargar datos iniciales
  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) {
      const settings = JSON.parse(saved);
      setOperatorName(settings.operatorName || "Vendedor 1");
      setTillNumber(settings.tillNumber || "TPV-001");
      setSerieCode(settings.serieCode || "A");
      setVeriFactuEndpoint(settings.veriFactuEndpoint || "");
      setVeriFactuToken(settings.veriFactuToken || "");
    }
  }, []);

  useEffect(() => {
    backendStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(catalogProducts.map(toBackendProduct)));
  }, [catalogProducts]);

  useEffect(() => {
    const refreshCatalog = () => {
      setCatalogProducts(loadCatalogProducts());
    };

    window.addEventListener("backend-storage", refreshCatalog);
    window.addEventListener("storage", refreshCatalog);
    window.addEventListener("focus", refreshCatalog);

    return () => {
      window.removeEventListener("backend-storage", refreshCatalog);
      window.removeEventListener("storage", refreshCatalog);
      window.removeEventListener("focus", refreshCatalog);
    };
  }, []);

  useEffect(() => {
    backendStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        operatorName,
        tillNumber,
        serieCode,
        veriFactuEndpoint,
        veriFactuToken,
      })
    );
  }, [operatorName, tillNumber, serieCode, veriFactuEndpoint, veriFactuToken]);

  const keypadAmount = useMemo(() => {
    if (!keypadValue || keypadValue === ".") return 0;
    const value = parseFloat(keypadValue);
    return Number.isFinite(value) ? value : 0;
  }, [keypadValue]);

  // El efectivo mostrado/validado combina lo ya confirmado y lo que se está tecleando.
  const effectiveReceived = received + (keypadValue !== "" ? keypadAmount : 0);

  const categories = useMemo(() => ["Todos", ...new Set(catalogProducts.map((p) => p.category).filter(Boolean))], [catalogProducts]);

  const products = useMemo(() => {
    let filtered = catalogProducts;
    if (selectedCategory !== "Todos") {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }
    const q = query.toLowerCase().trim();
    if (q) {
      filtered = filtered.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(q));
    }
    return filtered;
  }, [query, selectedCategory, catalogProducts]);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, l) => {
      const lineSubtotal = (l.price / (1 + l.iva / 100)) * l.qty;
      const discount = l.discount ? (lineSubtotal * l.discount) / 100 : 0;
      return s + (lineSubtotal - discount);
    }, 0);
    
    const globalDiscountAmount = (subtotal * globalDiscount) / 100;
    const discountedSubtotal = subtotal - globalDiscountAmount;
    
    const iva = cart.reduce((s, l) => {
      const lineSubtotal = (l.price / (1 + l.iva / 100)) * l.qty;
      const discount = l.discount ? (lineSubtotal * l.discount) / 100 : 0;
      const lineIva = ((lineSubtotal - discount) * l.iva) / 100;
      return s + lineIva;
    }, 0);
    
    const total = discountedSubtotal + iva;
    return { 
      subtotal, 
      globalDiscountAmount,
      discountedSubtotal,
      iva, 
      total, 
      change: Math.max(0, Number(effectiveReceived || 0) - total) 
    };
  }, [cart, effectiveReceived, globalDiscount]);

  function addItem(item: PosItem) {
    setCart((current) => {
      const found = current.find((line) => line.id === item.id);
      if (found) return current.map((line) => (line.id === item.id ? { ...line, qty: line.qty + 1 } : line));
      return [...current, { ...item, qty: 1 }];
    });
  }

  function changeQty(id: string, delta: number) {
    setCart((current) => current.map((line) => (line.id === id ? { ...line, qty: Math.max(1, line.qty + delta) } : line)));
  }

  function removeLine(id: string) {
    setCart((current) => current.filter((line) => line.id !== id));
  }

  function addCustomer() {
    if (!newCustomer.name || !newCustomer.nif) {
      toast.error("Nombre y NIF son requeridos");
      return;
    }

    const cust: Customer = {
      id: crypto.randomUUID(),
      ...newCustomer,
    };

    setCustomers([...customers, cust]);
    setNewCustomer({ name: "", nif: "", email: "", phone: "", address: "", isCompany: false });
    setShowAddCustomer(false);
    toast.success("Cliente añadido correctamente");
  }

  function deleteCustomer(id: string) {
    if (id === "c1") {
      toast.error("No puedes eliminar el cliente mostrador");
      return;
    }
    setCustomers(customers.filter(c => c.id !== id));
    if (customer.id === id) {
      setCustomer(customers[0]);
    }
    toast.success("Cliente eliminado");
  }

  function resetProductForm(product?: PosItem) {
    if (product) {
      setEditingProductId(product.id);
      setProductForm({ ...product });
      return;
    }

    setEditingProductId(null);
    setProductForm({
      id: `p-${Date.now()}`,
      name: "",
      sku: "",
      price: 0,
      iva: 21,
      stock: 0,
      category: "",
      emoji: "🌸",
    });
  }

  function saveProduct() {
    if (!productForm.name.trim() || !productForm.sku.trim() || !productForm.category.trim()) {
      toast.error("Completa nombre, SKU y categoría");
      return;
    }

    const normalized = {
      ...productForm,
      name: productForm.name.trim(),
      sku: productForm.sku.trim().toUpperCase(),
      category: productForm.category.trim(),
      price: Number(productForm.price) || 0,
      iva: Number(productForm.iva) || 0,
      stock: Math.max(0, Math.floor(Number(productForm.stock) || 0)),
    };

    setCatalogProducts((current) => {
      if (editingProductId) {
        return current.map((product) => (product.id === editingProductId ? { ...normalized, id: editingProductId } : product));
      }

      if (current.some((product) => product.sku === normalized.sku)) {
        toast.error("Ya existe un producto con ese SKU");
        return current;
      }

      return [...current, normalized];
    });

    setShowProductEditor(false);
    setEditingProductId(null);
    toast.success(editingProductId ? "Producto actualizado" : "Producto añadido");
  }

  function deleteProduct(id: string) {
    setCatalogProducts((current) => current.filter((product) => product.id !== id));
    if (editingProductId === id) {
      setShowProductEditor(false);
      setEditingProductId(null);
    }
    toast.success("Producto eliminado");
  }

  function updateProductStock(id: string, delta: number) {
    setCatalogProducts((current) =>
      current.map((product) =>
        product.id === id ? { ...product, stock: Math.max(0, product.stock + delta) } : product
      )
    );
  }

  async function completeSale() {
    if (!cart.length) {
      toast.error("Añade artículos antes de cobrar");
      return;
    }

    const stockError = cart.find((line) => {
      const product = catalogProducts.find((item) => item.id === line.id);
      return !product || product.stock < line.qty;
    });

    if (stockError) {
      toast.error(`Stock insuficiente para ${stockError.name}`);
      return;
    }

    if (documentType === "invoice" && customer.id === "c1") {
      toast.error("Selecciona un cliente para emitir factura");
      return;
    }

    setIsProcessing(true);

    try {
      let veriFactuStatus: Sale["veriFactuStatus"] = "pending";
      let veriFactuId = "";
      let veriFactuMessage = "";

      // Si es factura, enviar a VeriFactu
      if (documentType === "invoice") {
        toast.loading("Enviando a VeriFactu...");
        const response = await sendToVeriFactu({
          number: invoiceNumber,
          customer: customer,
          total: totals.total,
          items: cart
        });
        
        veriFactuId = response.id;
        veriFactuStatus = response.status as any;
        veriFactuMessage = response.message;

        if (veriFactuStatus === "accepted") {
          toast.success(`✅ Factura enviada a VeriFactu (ID: ${veriFactuId})`);
        } else {
          toast.error(`⚠️ ${veriFactuMessage}`);
        }
      } else {
        toast.success("✅ Ticket registrado");
      }

      // Guardar venta
      const sale: Sale = {
        id: invoiceNumber,
        serieCode,
        documentType,
        customer,
        payment,
        items: cart,
        subtotal: totals.subtotal,
        iva: totals.iva,
        total: totals.total,
        globalDiscount,
        notes,
        veriFactuId,
        veriFactuStatus,
        veriFactuMessage,
        createdAt: new Date().toISOString(),
        operatorName,
        tillNumber,
      };

      const stored = JSON.parse(backendStorage.getItem(SALES_STORAGE_KEY) || "[]");
      backendStorage.setItem(SALES_STORAGE_KEY, JSON.stringify([sale, ...stored]));

      setCatalogProducts((current) =>
        current.map((product) => {
          const soldLine = cart.find((line) => line.id === product.id);
          return soldLine ? { ...product, stock: Math.max(0, product.stock - soldLine.qty) } : product;
        })
      );

      // Incrementar número de factura
      const num = parseInt(invoiceNumber.split("-")[1]) + 1;
      setInvoiceNumber(`2024-${String(num).padStart(3, "0")}`);

      // Limpiar carrito
      setCart([]);
      setNotes("");
      setReceived(0);
      setKeypadValue("");
      setCustomer(initialCustomers[0]);
      setDocumentType("ticket");
      setGlobalDiscount(0);

      // Imprimir automáticamente
      setTimeout(() => window.print(), 500);

    } catch (error) {
      toast.error("Error al procesar la venta");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  }

  function handleKeypadPress(key: string) {
    setKeypadValue((current) => {
      if (key === "00") {
        if (current === "") return "0";
        if (current === "0") return current;

        if (current.includes(".")) {
          const decimals = current.split(".")[1]?.length ?? 0;
          if (decimals >= 2) return current;
          return current + "0".repeat(Math.min(2 - decimals, 2));
        }

        return current + "00";
      }

      if (key === ".") {
        if (current === "") return "0.";
        if (current.includes(".")) return current;
        return current + ".";
      }

      if (current.includes(".")) {
        const decimals = current.split(".")[1]?.length ?? 0;
        if (decimals >= 2) return current;
      }

      if (current === "" && key !== "0") return key;
      if (current === "0" && key !== ".") return key;
      return current + key;
    });
  }

  function commitKeypadValue() {
    if (keypadValue && keypadValue !== "." && keypadAmount > 0) {
      setReceived((current) => current + keypadAmount);
    }
    setKeypadValue("");
  }

  // ==================== VENTA TAB ====================
  if (activeTab === "venta") {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-[2200px] mx-auto">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black text-gray-900">🌹 Herencia TPV Profesional</h1>
              <p className="text-gray-600 mt-1 text-sm">Operador: <span className="font-bold">{operatorName}</span> | TPV: <span className="font-bold">{tillNumber}</span> | Serie: <span className="font-bold">{serieCode}</span></p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {["venta", "clientes", "estadisticas", "inventario", "caja", "devolucion", "settings"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  title={tabLabels[tab]}
                  aria-label={tabLabels[tab]}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition ${
                    activeTab === tab
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {tab === "venta" && "🛒"}
                  {tab === "clientes" && "👥"}
                  {tab === "estadisticas" && "📊"}
                  {tab === "inventario" && "📦"}
                  {tab === "caja" && "💰"}
                  {tab === "devolucion" && "↩️"}
                  {tab === "settings" && "⚙️"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8">
            {/* Products Section */}
            <div className="space-y-6">
              {/* Search & Filter */}
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar producto, SKU..."
                    className="w-full pl-12 pr-4 py-3 rounded-lg bg-gray-50 border-2 border-gray-200 focus:border-emerald-500 focus:outline-none font-bold"
                  />
                </div>

                {/* Categories */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      title={cat}
                      aria-label={cat}
                      className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap text-sm transition ${
                        selectedCategory === cat
                          ? "bg-emerald-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Products Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {products.map((product) => (
                  <motion.button
                    key={product.id}
                    whileHover={{ y: -4 }}
                    onClick={() => addItem(product)}
                    className={`p-3 rounded-lg border-2 transition text-left group ${
                      product.stock <= 5
                        ? "bg-red-50 border-red-300 hover:border-red-500"
                        : "bg-gray-50 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50"
                    }`}
                  >
                    <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">{product.emoji}</div>
                    <p className="text-xs font-bold text-gray-500 uppercase">{product.category}</p>
                    <h3 className="font-black text-xs mt-1 line-clamp-2 text-gray-900">{product.name}</h3>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-black text-emerald-600">{money(product.price)}</span>
                      <span className={`text-xs px-1 py-0.5 rounded font-bold ${product.stock > 10 ? "bg-emerald-100 text-emerald-700" : product.stock > 5 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                        {product.stock}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Cart Sidebar */}
            <div className="space-y-4 h-fit sticky top-6">
              {/* Cart Box */}
              <motion.div className="bg-gradient-to-br from-gray-50 to-white border-3 border-emerald-600 rounded-lg p-5 shadow-lg">
                <div className="flex items-center justify-between mb-3 pb-3 border-b-2 border-emerald-200">
                  <div>
                    <h2 className="text-lg font-black text-gray-900">{documentType === "invoice" ? "FACTURA" : "TICKET"}</h2>
                    <p className="text-xs text-gray-600 font-bold">{serieCode}-{invoiceNumber.split("-")[1]}</p>
                  </div>
                  <ShoppingCart className="w-5 h-5 text-emerald-600" />
                </div>

                {/* Customer Selection */}
                <div className="mb-3">
                  <label className="text-xs font-bold text-gray-600 block mb-1">CLIENTE</label>
                  <select
                    value={customer.id}
                    onChange={(e) => setCustomer(customers.find((c) => c.id === e.target.value) || customers[0])}
                    className="w-full px-3 py-2 rounded-lg bg-white border-2 border-gray-200 text-xs font-bold focus:border-emerald-500 focus:outline-none"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.nif ? `(${c.nif})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cart Items */}
                <div className="space-y-2 max-h-52 overflow-y-auto mb-3 pb-3 border-b-2 border-gray-200">
                  {cart.length === 0 ? (
                    <div className="text-center py-6 text-gray-400">
                      <ShoppingCart className="w-6 h-6 mx-auto mb-1" />
                      <p className="text-xs">Sin artículos</p>
                    </div>
                  ) : (
                    cart.map((line) => (
                      <div key={line.id} className="bg-white border-2 border-gray-200 p-2 rounded-lg space-y-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-bold text-xs text-gray-900">{line.emoji} {line.name}</p>
                          </div>
                          <button onClick={() => removeLine(line.id)} className="text-red-600 hover:text-red-700">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <button onClick={() => changeQty(line.id, -1)} className="px-1.5 py-0.5 bg-gray-100 rounded hover:bg-gray-200 text-xs">
                              <Minus className="w-3 h-3 text-gray-700" />
                            </button>
                            <span className="text-xs font-bold w-4 text-center">{line.qty}</span>
                            <button onClick={() => changeQty(line.id, 1)} className="px-1.5 py-0.5 bg-gray-100 rounded hover:bg-gray-200 text-xs">
                              <Plus className="w-3 h-3 text-gray-700" />
                            </button>
                          </div>
                          <p className="font-black text-sm text-emerald-600">{money(line.price * line.qty)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Global Discount */}
                {cart.length > 0 && (
                  <div className="mb-3 p-2 bg-blue-50 border-2 border-blue-200 rounded-lg">
                    <label className="text-xs font-bold text-blue-900 block mb-1">Descuento Global (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={globalDiscount}
                      onChange={(e) => setGlobalDiscount(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                      className="w-full px-2 py-1 rounded text-xs font-bold bg-white border-2 border-blue-300 focus:outline-none"
                    />
                  </div>
                )}

                {/* Totals */}
                <div className="space-y-2 pb-3 mb-3 border-b-2 border-gray-200">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-bold">{money(totals.subtotal)}</span>
                  </div>
                  {globalDiscount > 0 && (
                    <div className="flex justify-between text-xs text-red-600">
                      <span>Descuento ({globalDiscount}%)</span>
                      <span className="font-bold">-{money(totals.globalDiscountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">IVA</span>
                    <span className="font-bold">{money(totals.iva)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-black text-white bg-emerald-600 p-2 rounded">
                    <span>TOTAL</span>
                    <span>{money(totals.total)}</span>
                  </div>
                </div>

                {/* Pago */}
                <div className="space-y-2 mb-3">
                  <label className="text-xs font-bold text-gray-600 block">PAGO</label>
                  <div className="grid grid-cols-2 gap-1">
                    {["Efectivo", "Tarjeta", "Bizum", "Transferencia"].map((p) => (
                      <button
                        key={p}
                        onClick={() => setPayment(p)}
                        className={`py-1 px-2 rounded text-xs font-bold transition ${
                          payment === p
                            ? "bg-emerald-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Keypad Compact */}
                <div className="space-y-2 bg-gray-50 p-3 rounded-lg border-2 border-gray-200">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Origen TPV: AdminPOSProfessional2</p>
                  <div className="bg-white rounded p-2 text-right">
                    <p className="text-xs text-gray-600 font-bold">RECIBIDO</p>
                    <p className="text-2xl font-black text-emerald-600">{keypadDisplay(keypadValue, received)}</p>
                    <p className="text-xs text-gray-600 mt-1 font-bold">Cambio: {money(totals.change)}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-1 text-xs">
                    {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map((k) => (
                      <button
                        key={k}
                        onClick={() => handleKeypadPress(k)}
                        className="py-2 bg-white hover:bg-gray-100 rounded font-bold border border-gray-300 transition"
                      >
                        {k}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-1 text-xs">
                    <button onClick={() => handleKeypadPress("00")} className="py-2 bg-white hover:bg-gray-100 rounded font-bold border border-gray-300">00</button>
                    <button onClick={() => handleKeypadPress("0")} className="py-2 bg-white hover:bg-gray-100 rounded font-bold border border-gray-300">0</button>
                    <button onClick={() => handleKeypadPress(".")} className="py-2 bg-white hover:bg-gray-100 rounded font-bold border border-gray-300">.</button>
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <button onClick={() => setKeypadValue("")} className="py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded font-bold border border-red-300">Borrar</button>
                    <button onClick={commitKeypadValue} className="py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded font-bold border border-emerald-300">Añadir</button>
                  </div>
                </div>

                {/* Document Type */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {["ticket", "invoice"].map((type) => (
                    <button
                      key={type}
                      onClick={() => setDocumentType(type as any)}
                      className={`py-2 px-3 rounded-lg font-bold text-xs transition ${
                        documentType === type
                          ? "bg-emerald-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {type === "ticket" ? "🧾 Ticket" : "📄 Factura"}
                    </button>
                  ))}
                </div>

                {/* VeriFactu Status */}
                {documentType === "invoice" && (
                  <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-2 mb-3">
                    <div className="flex items-start gap-2">
                      <Zap className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-xs">
                        <p className="font-bold text-blue-900">VeriFactu Conectado</p>
                        <p className="text-blue-700 mt-0.5">Se enviará automáticamente a la AT</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => window.print()}
                    className="py-3 px-3 rounded-lg bg-gray-100 hover:bg-gray-200 font-bold flex items-center justify-center gap-1 transition text-sm"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimir
                  </button>
                  <button
                    onClick={completeSale}
                    disabled={cart.length === 0 || isProcessing}
                    className="py-3 px-3 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-bold flex items-center justify-center gap-1 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {isProcessing ? (
                      <>
                        <Clock className="w-4 h-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        COBRAR
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== CLIENTES TAB ====================
  if (activeTab === "clientes") {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-black text-gray-900">👥 Gestión de Clientes</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddCustomer(true)}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-2 transition"
              >
                <Plus className="w-5 h-5" />
                Nuevo Cliente
              </button>
              <button
                onClick={() => setActiveTab("venta")}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold transition"
              >
                Volver
              </button>
            </div>
          </div>

          <div className="grid gap-4">
            {customers.map((cust) => (
              <motion.div key={cust.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-50 border-2 border-gray-200 rounded-lg p-5 hover:border-emerald-500 transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-black text-gray-900">{cust.name}</h3>
                      {cust.isCompany && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">EMPRESA</span>}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      {cust.nif && <div className="flex items-center gap-2"><User className="w-4 h-4 text-gray-500" /><span><strong>NIF:</strong> {cust.nif}</span></div>}
                      {cust.email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-gray-500" /><span><strong>Email:</strong> {cust.email}</span></div>}
                      {cust.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-500" /><span><strong>Tel:</strong> {cust.phone}</span></div>}
                      {cust.address && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-500" /><span><strong>Dir:</strong> {cust.address}</span></div>}
                    </div>
                  </div>
                  {cust.id !== "c1" && (
                    <button
                      onClick={() => deleteCustomer(cust.id)}
                      className="ml-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-bold transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {showAddCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-lg p-8 max-w-lg w-full space-y-4">
              <h2 className="text-2xl font-black">Nuevo Cliente</h2>

              <input
                type="text"
                placeholder="Nombre o Empresa"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-gray-50 border-2 border-gray-200 focus:border-emerald-500 focus:outline-none"
              />

              <input
                type="text"
                placeholder="NIF/CIF"
                value={newCustomer.nif}
                onChange={(e) => setNewCustomer({ ...newCustomer, nif: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-gray-50 border-2 border-gray-200 focus:border-emerald-500 focus:outline-none"
              />

              <input
                type="email"
                placeholder="Email"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-gray-50 border-2 border-gray-200 focus:border-emerald-500 focus:outline-none"
              />

              <input
                type="tel"
                placeholder="Teléfono"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-gray-50 border-2 border-gray-200 focus:border-emerald-500 focus:outline-none"
              />

              <input
                type="text"
                placeholder="Dirección"
                value={newCustomer.address}
                onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-gray-50 border-2 border-gray-200 focus:border-emerald-500 focus:outline-none"
              />

              <label className="flex items-center gap-2 font-bold">
                <input
                  type="checkbox"
                  checked={newCustomer.isCompany}
                  onChange={(e) => setNewCustomer({ ...newCustomer, isCompany: e.target.checked })}
                  className="w-4 h-4"
                />
                Es empresa
              </label>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAddCustomer(false)}
                  className="flex-1 py-3 rounded-lg bg-gray-100 hover:bg-gray-200 font-bold transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={addCustomer}
                  className="flex-1 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition"
                >
                  Guardar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  // ==================== ESTADISTICAS TAB ====================
  if (activeTab === "estadisticas") {
    const sales: Sale[] = JSON.parse(localStorage.getItem(SALES_STORAGE_KEY) || "[]");
    const totalSales = sales.reduce((sum: number, s: any) => sum + (s.total || 0), 0);
    const totalItems = sales.reduce((sum: number, s: any) => sum + (s.items?.reduce((x: number, i: any) => x + i.qty, 0) || 0), 0);
    const invoices = sales.filter((s: any) => s.documentType === "invoice").length;
    const verifactAccepted = sales.filter((s: any) => s.veriFactuStatus === "accepted").length;

    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-black text-gray-900 mb-6">📊 Estadísticas y Reportes</h1>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-300 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-600">Ventas Totales</p>
                  <p className="text-3xl font-black text-emerald-600 mt-2">{money(totalSales)}</p>
                </div>
                <DollarSign className="w-12 h-12 text-emerald-200" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-300 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-600">Transacciones</p>
                  <p className="text-3xl font-black text-blue-600 mt-2">{sales.length}</p>
                </div>
                <ShoppingCart className="w-12 h-12 text-blue-200" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-300 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-600">Unidades Vendidas</p>
                  <p className="text-3xl font-black text-purple-600 mt-2">{totalItems}</p>
                </div>
                <Package className="w-12 h-12 text-purple-200" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-300 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-600">VeriFactu Aceptadas</p>
                  <p className="text-3xl font-black text-orange-600 mt-2">{verifactAccepted}/{invoices}</p>
                </div>
                <CheckCircle className="w-12 h-12 text-orange-200" />
              </div>
            </div>
          </div>

          {/* Sales Table */}
          <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-6">
            <h2 className="text-xl font-black mb-4">Últimas Transacciones</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-400">
                    <th className="text-left py-3 px-4 font-bold">Documento</th>
                    <th className="text-left py-3 px-4 font-bold">Cliente</th>
                    <th className="text-left py-3 px-4 font-bold">Total</th>
                    <th className="text-left py-3 px-4 font-bold">VeriFactu</th>
                    <th className="text-left py-3 px-4 font-bold">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.slice(0, 15).map((sale: any) => (
                    <tr key={sale.id} className="border-b border-gray-300 hover:bg-white">
                      <td className="py-3 px-4"><strong>{sale.id}</strong></td>
                      <td className="py-3 px-4">{sale.customer.name}</td>
                      <td className="py-3 px-4"><strong className="text-emerald-600">{money(sale.total)}</strong></td>
                      <td className="py-3 px-4">
                        {sale.documentType === "invoice" && (
                          <span className={`text-xs font-bold px-2 py-1 rounded ${
                            sale.veriFactuStatus === "accepted" ? "bg-emerald-100 text-emerald-700" :
                            sale.veriFactuStatus === "sent" ? "bg-blue-100 text-blue-700" :
                            sale.veriFactuStatus === "error" ? "bg-red-100 text-red-700" :
                            "bg-yellow-100 text-yellow-700"
                          }`}>
                            {sale.veriFactuStatus}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm">{new Date(sale.createdAt).toLocaleDateString("es-ES")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button onClick={() => setActiveTab("venta")} className="mt-6 px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold">
            Volver
          </button>
        </div>
      </div>
    );
  }

  // ==================== INVENTARIO TAB ====================
  if (activeTab === "inventario") {
    const lowStockProducts = catalogProducts.filter((p) => p.stock <= 10);
    const inventoryValue = catalogProducts.reduce((sum, product) => sum + product.price * product.stock, 0);

    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-black text-gray-900">📦 Control de Inventario</h1>
              <p className="text-sm text-gray-600 mt-1">Alta, edición, stock y eliminación de productos</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  resetProductForm();
                  setShowProductEditor(true);
                }}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-2 transition"
              >
                <Plus className="w-4 h-4" />
                Añadir producto
              </button>
              <button onClick={() => setActiveTab("venta")} className="px-5 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold transition">
                Volver a venta
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-lg p-4">
              <p className="text-xs font-bold text-gray-600 uppercase">Productos</p>
              <p className="text-3xl font-black text-emerald-600 mt-1">{catalogProducts.length}</p>
            </div>
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
              <p className="text-xs font-bold text-gray-600 uppercase">Stock bajo</p>
              <p className="text-3xl font-black text-red-600 mt-1">{lowStockProducts.length}</p>
            </div>
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <p className="text-xs font-bold text-gray-600 uppercase">Valor inventario</p>
              <p className="text-3xl font-black text-blue-600 mt-1">{money(inventoryValue)}</p>
            </div>
          </div>

          {lowStockProducts.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
              <p className="font-bold text-red-700">⚠️ {lowStockProducts.length} producto(s) con stock bajo</p>
            </div>
          )}

          <div className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-400 bg-gray-50">
                  <th className="text-left py-3 px-4 font-bold">Producto</th>
                  <th className="text-left py-3 px-4 font-bold">SKU</th>
                  <th className="text-left py-3 px-4 font-bold">Categoría</th>
                  <th className="text-left py-3 px-4 font-bold">Precio</th>
                  <th className="text-left py-3 px-4 font-bold">IVA</th>
                  <th className="text-left py-3 px-4 font-bold">Stock</th>
                  <th className="text-left py-3 px-4 font-bold">Estado</th>
                  <th className="text-left py-3 px-4 font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {catalogProducts.map((product) => (
                  <tr key={product.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4"><strong>{product.emoji} {product.name}</strong></td>
                    <td className="py-3 px-4 text-sm text-gray-600">{product.sku}</td>
                    <td className="py-3 px-4 text-sm">{product.category}</td>
                    <td className="py-3 px-4"><strong className="text-emerald-600">{money(product.price)}</strong></td>
                    <td className="py-3 px-4 text-sm font-bold text-gray-700">{product.iva}%</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateProductStock(product.id, -1)} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded font-bold">-</button>
                        <strong className="text-lg w-8 text-center">{product.stock}</strong>
                        <button onClick={() => updateProductStock(product.id, 1)} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded font-bold">+</button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        product.stock > 20 ? "bg-emerald-100 text-emerald-700" :
                        product.stock > 10 ? "bg-yellow-100 text-yellow-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {product.stock > 20 ? "✅ OK" : product.stock > 10 ? "⚠️ BAJO" : "❌ CRÍTICO"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            resetProductForm(product);
                            setShowProductEditor(true);
                          }}
                          className="px-3 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg font-bold text-xs"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => deleteProduct(product.id)}
                          className="px-3 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg font-bold text-xs"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>

          {showProductEditor && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-black text-gray-900">{editingProductId ? "Editar producto" : "Nuevo producto"}</h2>
                  <button onClick={() => setShowProductEditor(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input value={productForm.emoji} onChange={(e) => setProductForm({ ...productForm, emoji: e.target.value })} placeholder="Emoji" className="px-4 py-3 rounded-lg bg-gray-50 border-2 border-gray-200 font-bold" />
                  <input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="Nombre" className="px-4 py-3 rounded-lg bg-gray-50 border-2 border-gray-200 font-bold" />
                  <input value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} placeholder="SKU" className="px-4 py-3 rounded-lg bg-gray-50 border-2 border-gray-200 font-bold" />
                  <input value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} placeholder="Categoría" className="px-4 py-3 rounded-lg bg-gray-50 border-2 border-gray-200 font-bold" />
                  <input type="number" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: parseFloat(e.target.value) || 0 })} placeholder="Precio" className="px-4 py-3 rounded-lg bg-gray-50 border-2 border-gray-200 font-bold" />
                  <input type="number" value={productForm.iva} onChange={(e) => setProductForm({ ...productForm, iva: parseFloat(e.target.value) || 0 })} placeholder="IVA" className="px-4 py-3 rounded-lg bg-gray-50 border-2 border-gray-200 font-bold" />
                  <input type="number" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: parseInt(e.target.value) || 0 })} placeholder="Stock" className="px-4 py-3 rounded-lg bg-gray-50 border-2 border-gray-200 font-bold" />
                </div>

                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowProductEditor(false)} className="flex-1 py-3 rounded-lg bg-gray-100 hover:bg-gray-200 font-bold">Cancelar</button>
                  <button onClick={saveProduct} className="flex-1 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold">Guardar</button>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==================== CAJA (CASH DRAWER) ====================
  if (activeTab === "caja") {
    const sales: Sale[] = JSON.parse(localStorage.getItem(SALES_STORAGE_KEY) || "[]");
    const todaySales = sales.filter(s => new Date(s.createdAt).toDateString() === new Date().toDateString());
    const todayEfectivo = todaySales.filter(s => s.payment === "Efectivo").reduce((s, t) => s + t.total, 0);

    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-black text-gray-900 mb-6">💰 Cierre de Caja</h1>

          <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-3 border-emerald-300 rounded-lg p-8 mb-6">
            <p className="text-sm font-bold text-gray-600 mb-2">EFECTIVO A COBRAR HOY</p>
            <p className="text-5xl font-black text-emerald-600">{money(todayEfectivo)}</p>
            <p className="text-sm text-gray-600 mt-2">{todaySales.length} transacciones en efectivo</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6">
              <p className="font-bold text-blue-900 mb-4">Resumen del Día</p>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-700">Total Ventas:</span><strong>{money(todaySales.reduce((s, t) => s + t.total, 0))}</strong></div>
                <div className="flex justify-between"><span className="text-gray-700">Transacciones:</span><strong>{todaySales.length}</strong></div>
                <div className="flex justify-between"><span className="text-gray-700">Efectivo:</span><strong className="text-emerald-600">{money(todayEfectivo)}</strong></div>
                <div className="flex justify-between"><span className="text-gray-700">Tarjeta:</span><strong className="text-blue-600">{money(todaySales.filter(s => s.payment === "Tarjeta").reduce((s, t) => s + t.total, 0))}</strong></div>
                <div className="flex justify-between"><span className="text-gray-700">Otros:</span><strong>{money(todaySales.filter(s => !["Efectivo", "Tarjeta"].includes(s.payment)).reduce((s, t) => s + t.total, 0))}</strong></div>
              </div>
            </div>

            <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-6">
              <p className="font-bold text-purple-900 mb-4">Documentos</p>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-700">Tickets:</span><strong>{todaySales.filter(s => s.documentType === "ticket").length}</strong></div>
                <div className="flex justify-between"><span className="text-gray-700">Facturas:</span><strong>{todaySales.filter(s => s.documentType === "invoice").length}</strong></div>
                <div className="flex justify-between"><span className="text-gray-700">VeriFactu Aceptadas:</span><strong className="text-emerald-600">{todaySales.filter(s => s.veriFactuStatus === "accepted").length}</strong></div>
                <div className="flex justify-between"><span className="text-gray-700">Errores VeriFactu:</span><strong className="text-red-600">{todaySales.filter(s => s.veriFactuStatus === "error").length}</strong></div>
              </div>
            </div>
          </div>

          <button onClick={() => setActiveTab("venta")} className="mt-6 px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold">
            Volver
          </button>
        </div>
      </div>
    );
  }

  // ==================== DEVOLUCIONES ====================
  if (activeTab === "devolucion") {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-black text-gray-900 mb-6">↩️ Devoluciones</h1>
          <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-12">
            <p className="text-gray-600 mb-4">Sistema de devoluciones próximamente</p>
            <p className="text-sm text-gray-500 mb-6">Permite gestionar devoluciones de productos y emitir notas de crédito</p>
            <button onClick={() => setActiveTab("venta")} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold">
              Volver a Venta
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== SETTINGS ====================
  if (activeTab === "settings") {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-black text-gray-900 mb-6">⚙️ Configuración</h1>

          <div className="space-y-6">
            <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-6">
              <h2 className="font-bold text-lg mb-4">Datos del Operador</h2>
              <div className="space-y-4">
                <div>
                  <label className="block font-bold text-sm mb-2">Nombre del Operador</label>
                  <input
                    value={operatorName}
                    onChange={(e) => {
                      setOperatorName(e.target.value);
                    }}
                    className="w-full px-4 py-3 rounded-lg bg-white border-2 border-gray-300 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-sm mb-2">Número de TPV</label>
                  <input
                    value={tillNumber}
                    onChange={(e) => {
                      setTillNumber(e.target.value);
                    }}
                    className="w-full px-4 py-3 rounded-lg bg-white border-2 border-gray-300 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-sm mb-2">Serie de Documentos (A/B/C)</label>
                  <input
                    value={serieCode}
                    onChange={(e) => {
                      setSerieCode(e.target.value.toUpperCase());
                    }}
                    maxLength={1}
                    className="w-full px-4 py-3 rounded-lg bg-white border-2 border-gray-300 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-sm mb-2">Endpoint VeriFactu</label>
                  <input
                    value={veriFactuEndpoint}
                    onChange={(e) => setVeriFactuEndpoint(e.target.value)}
                    placeholder="https://tu-backend.com/api/verifactu"
                    className="w-full px-4 py-3 rounded-lg bg-white border-2 border-gray-300 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-sm mb-2">Token VeriFactu</label>
                  <input
                    value={veriFactuToken}
                    onChange={(e) => setVeriFactuToken(e.target.value)}
                    placeholder="Bearer token"
                    className="w-full px-4 py-3 rounded-lg bg-white border-2 border-gray-300 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6">
              <h2 className="font-bold text-lg mb-4">Información VeriFactu</h2>
              <p className="text-sm text-gray-700">Estado: <strong className={veriFactuEndpoint && veriFactuToken ? "text-emerald-600" : "text-amber-600"}>{veriFactuEndpoint && veriFactuToken ? "✅ Conectado" : "⚠️ Pendiente de configuración"}</strong></p>
              <p className="text-sm text-gray-600 mt-2">Si el endpoint y el token están configurados, las facturas se envían al backend de VeriFactu/AT.</p>
            </div>
          </div>

          <button onClick={() => setActiveTab("venta")} className="mt-6 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold">
            Volver a Venta
          </button>
        </div>
      </div>
    );
  }

  return null;
}
