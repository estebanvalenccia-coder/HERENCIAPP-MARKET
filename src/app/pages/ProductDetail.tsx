import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowLeft, ShoppingCart, Heart, Leaf, Droplets, Sun, ThermometerSun, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../lib/backendStorage";

export function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [aiDescription, setAiDescription] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const { scrollY } = useScroll();

  const opacity = useTransform(scrollY, [0, 300], [1, 0]);
  const scale = useTransform(scrollY, [0, 300], [1, 0.8]);

  useEffect(() => {
    // Cargar producto
    const adminProducts = backendStorage.getItem("adminProducts");
    if (adminProducts) {
      const products = JSON.parse(adminProducts);
      const found = products.find((p: any) => p.id === parseInt(id || ""));
      if (found) {
        setProduct(found);
        generateAIDescription(found.name, found.description || "");
      }
    }
  }, [id]);

  const generateAIDescription = async (plantName: string, baseDescription: string) => {
    setLoadingAI(true);

    try {
      const { result } = await backendApi.generatePlantDescription({ plantName, baseDescription });
      setAiDescription(JSON.stringify(result));
      setLoadingAI(false);
    } catch (error) {
      console.error("Error al generar descripción desde backend:", error);
      generateMockDescription(plantName, baseDescription);
    }
  };

  const generateMockDescription = (plantName: string, baseDescription: string) => {
    setTimeout(() => {
      const mockAIResponse = {
        description: `${plantName} es una planta extraordinaria que aporta vida y frescura a cualquier espacio. ${baseDescription || "Esta planta es perfecta para decorar tu hogar u oficina."}`,
        care: {
          water: "Riego moderado 2-3 veces por semana. Mantener el sustrato húmedo pero no encharcado.",
          light: "Luz indirecta brillante. Evitar la exposición directa al sol durante las horas más intensas.",
          temperature: "Temperatura ideal entre 18-24°C. Proteger de corrientes de aire frío.",
          fertilizer: "Fertilizar cada 2-3 semanas durante la primavera y verano con fertilizante líquido diluido.",
        },
        benefits: [
          "Purifica el aire eliminando toxinas comunes",
          "Aumenta la humedad ambiental naturalmente",
          "Reduce el estrés y mejora el estado de ánimo",
          "Fácil de cuidar, ideal para principiantes",
        ],
        tips: "Limpiar las hojas con un paño húmedo una vez al mes para mantenerlas saludables y brillantes. Rotar la planta cada semana para asegurar un crecimiento uniforme."
      };

      setAiDescription(JSON.stringify(mockAIResponse));
      setLoadingAI(false);
    }, 1500);
  };

  const addToCart = () => {
    if (!product) return;

    const cart = JSON.parse(backendStorage.getItem("cart") || "[]");
    const existingItem = cart.find((item: any) => item.id === product.id);

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.push({ ...product, quantity });
    }

    backendStorage.setItem("cart", JSON.stringify(cart));
    window.dispatchEvent(new Event("storage"));
    toast.success(`${quantity} ${quantity === 1 ? "producto añadido" : "productos añadidos"} al carrito`);
  };

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Cargando producto...</p>
        </div>
      </div>
    );
  }

  const aiData = aiDescription ? JSON.parse(aiDescription) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header con efecto fade */}
      <motion.div
        style={{ opacity, scale }}
        className="sticky top-0 z-40 bg-card/80 backdrop-blur-lg border-b border-border"
      >
        <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-4">
          <button
            onClick={() => navigate("/productos")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver a productos
          </button>
        </div>
      </motion.div>

      {/* Producto Hero Section */}
      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          {/* Imagen */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative"
          >
            <div className="sticky top-24">
              <div className="aspect-square rounded-3xl overflow-hidden bg-muted shadow-2xl">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
              {product.onSale && (
                <div className="absolute top-6 right-6 px-4 py-2 bg-primary text-primary-foreground rounded-full font-bold text-lg shadow-lg">
                  ¡OFERTA!
                </div>
              )}
            </div>
          </motion.div>

          {/* Opciones de Compra */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3">
                {product.name}
              </h1>
              <p className="text-muted-foreground text-lg">
                {product.description}
              </p>
            </div>

            {/* Precio */}
            <div className="flex items-baseline gap-4">
              {product.onSale && product.salePrice ? (
                <>
                  <span className="text-5xl font-bold text-primary">
                    €{(product.salePrice || 0).toFixed(2)}
                  </span>
                  <span className="text-2xl text-muted-foreground line-through">
                    €{(product.price || 0).toFixed(2)}
                  </span>
                  <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-semibold">
                    Ahorra €{((product.price || 0) - (product.salePrice || 0)).toFixed(2)}
                  </span>
                </>
              ) : (
                <span className="text-5xl font-bold text-primary">
                  €{(product.price || 0).toFixed(2)}
                </span>
              )}
            </div>

            {/* Categoría */}
            <div className="flex items-center gap-2">
              <span className="px-4 py-2 bg-muted rounded-xl text-foreground font-medium capitalize">
                {product.category?.replace("-", " ")}
              </span>
              {product.featured && (
                <span className="px-4 py-2 bg-primary/10 text-primary rounded-xl font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Destacado
                </span>
              )}
            </div>

            {/* Selector de Cantidad */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-foreground">
                Cantidad
              </label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-12 h-12 rounded-xl bg-muted hover:bg-accent transition-colors flex items-center justify-center text-xl font-bold"
                >
                  −
                </button>
                <span className="text-2xl font-bold w-16 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-12 h-12 rounded-xl bg-muted hover:bg-accent transition-colors flex items-center justify-center text-xl font-bold"
                >
                  +
                </button>
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex gap-4">
              <button
                onClick={addToCart}
                className="flex-1 flex items-center justify-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-semibold text-lg shadow-lg"
              >
                <ShoppingCart className="w-6 h-6" />
                Añadir al Carrito
              </button>
              <button className="w-16 h-16 flex items-center justify-center bg-muted hover:bg-accent rounded-xl transition-colors">
                <Heart className="w-6 h-6" />
              </button>
            </div>

            {/* Stock Info */}
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <p className="text-sm text-foreground flex items-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                Producto disponible - Envío en 24-48 horas
              </p>
            </div>
          </motion.div>
        </div>

        {/* Descripción generada por IA */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="space-y-8"
        >
          {/* Título de sección */}
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              Todo sobre tu planta
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Información detallada y consejos de cuidado generados por IA
            </p>
          </div>

          {loadingAI ? (
            <div className="text-center py-20">
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-primary/10 rounded-full">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-primary font-medium">Generando información con IA...</span>
              </div>
            </div>
          ) : aiData ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Descripción General */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="bg-card border border-border rounded-2xl p-8"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <Leaf className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">Descripción</h3>
                </div>
                <p className="text-foreground leading-relaxed mb-6">
                  {aiData.description}
                </p>
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground mb-3">Beneficios:</h4>
                  {aiData.benefits.map((benefit: string, index: number) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2" />
                      <p className="text-muted-foreground">{benefit}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Cuidados */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="space-y-4"
              >
                {/* Agua */}
                <div className="bg-card border border-border rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Droplets className="w-5 h-5 text-blue-600" />
                    </div>
                    <h4 className="font-bold text-foreground">Riego</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">{aiData.care.water}</p>
                </div>

                {/* Luz */}
                <div className="bg-card border border-border rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Sun className="w-5 h-5 text-yellow-600" />
                    </div>
                    <h4 className="font-bold text-foreground">Iluminación</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">{aiData.care.light}</p>
                </div>

                {/* Temperatura */}
                <div className="bg-card border border-border rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <ThermometerSun className="w-5 h-5 text-orange-600" />
                    </div>
                    <h4 className="font-bold text-foreground">Temperatura</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">{aiData.care.temperature}</p>
                </div>

                {/* Fertilizante */}
                <div className="bg-card border border-border rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Leaf className="w-5 h-5 text-green-600" />
                    </div>
                    <h4 className="font-bold text-foreground">Fertilización</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">{aiData.care.fertilizer}</p>
                </div>
              </motion.div>

              {/* Consejos Adicionales */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="lg:col-span-2 bg-gradient-to-br from-primary/5 to-secondary/5 border border-border rounded-2xl p-8"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">Consejos del Experto</h3>
                </div>
                <p className="text-foreground leading-relaxed">
                  {aiData.tips}
                </p>
              </motion.div>
            </div>
          ) : null}
        </motion.div>
      </div>
    </div>
  );
}
