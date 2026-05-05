import { Link } from "react-router";
import { Leaf, Truck, GraduationCap, Heart, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import logo from "figma:asset/8c5f2b4f88c45fd4812e5bb91610bff5272333d7.png";
import ctaBackground from "figma:asset/d5382b123a27fa7c9d1abc7d1b3ca1c479f8df01.png";

export function Home() {
  const features = [
    { icon: Leaf, title: "Productos naturales", desc: "Flores y plantas frescas" },
    { icon: Truck, title: "Entrega a domicilio", desc: "Envío rápido y seguro" },
    { icon: GraduationCap, title: "Cursos disponibles", desc: "Aprende jardinería" },
    { icon: Heart, title: "Asesoría personalizada", desc: "Te ayudamos a elegir" },
  ];

  const categories = [
    { name: "Flores", image: "https://images.unsplash.com/photo-1637426456082-e0b7c02daec5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600" },
    { name: "Plantas de Interior", image: "https://images.unsplash.com/photo-1612366211377-357e2bc523cb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600" },
    { name: "Orquídeas", image: "https://images.unsplash.com/photo-1768368052646-a6185df478c1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600" },
    { name: "Jardín Exterior", image: "https://images.unsplash.com/photo-1703113690930-fc391676e0de?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600" },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="relative h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1760618511409-9d80f26e36f4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920"
            alt="Floristería Herencia"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-transparent" />
        </div>

        <div className="relative mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground tracking-wide">Bienvenido a</span>
            </div>
            <div className="mb-6">
              <img
                src={logo}
                alt="Herencia Floristería"
                className="h-32 md:h-40 w-auto"
              />
            </div>
            <p className="text-lg text-muted-foreground mb-8 max-w-lg">
              Descubre la belleza natural. Flores, plantas y servicios de jardinería con elegancia y dedicación.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/productos"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all hover:scale-105"
              >
                Ver catálogo
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/servicios"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-border bg-card text-foreground rounded-xl hover:bg-accent transition-all"
              >
                Nuestros servicios
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-muted/30">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 text-primary rounded-2xl mb-4">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-20">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Explora nuestras categorías
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Encuentra todo lo que necesitas para crear espacios llenos de vida
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((category, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.05 }}
              >
                <Link to="/productos" className="group block">
                  <div className="relative h-64 rounded-2xl overflow-hidden mb-4">
                    <img
                      src={category.image}
                      alt={category.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <h3 className="text-white font-semibold text-lg">{category.name}</h3>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={ctaBackground}
            alt="Fondo natural"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-primary/50 via-primary/40 to-primary/60" />
        </div>
        <div className="relative mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2
              className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-white"
              style={{
                textShadow: '0 4px 8px rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.3), 2px 2px 0 rgba(45,95,63,0.8), 4px 4px 0 rgba(45,95,63,0.6)',
                letterSpacing: '-0.02em'
              }}
            >
              ¿Listo para transformar tu espacio?
            </h2>
            <p
              className="text-lg md:text-xl mb-10 max-w-2xl mx-auto text-white font-medium"
              style={{
                textShadow: '0 2px 4px rgba(0,0,0,0.5), 0 4px 8px rgba(0,0,0,0.3), 1px 1px 0 rgba(45,95,63,0.7)'
              }}
            >
              Descubre nuestra colección completa de flores, plantas y accesorios para el jardín
            </p>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                to="/productos"
                className="inline-flex items-center gap-2 px-10 py-5 bg-white text-primary rounded-xl hover:bg-white/95 transition-all shadow-2xl font-semibold text-lg"
                style={{
                  boxShadow: '0 10px 25px rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.2)'
                }}
              >
                Explorar productos
                <ArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
