import { useState, useEffect } from "react";
import { Calendar, Clock, MapPin, Users, Scissors, BookOpen, Check } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useLocation } from "react-router";

export function Services() {
  const location = useLocation();
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);

  // Leer tipo de servicio desde la URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tipo = params.get("tipo");
    if (tipo) {
      // Scroll al servicio correspondiente
      const element = document.getElementById(tipo);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      }
    }
  }, [location.search]);

  const gardeningServices = [
    {
      id: "diseno",
      title: "Diseño de Jardines",
      description: "Creamos el jardín de tus sueños con diseño personalizado",
      price: "Desde $150",
      duration: "2-4 horas",
      icon: Scissors,
    },
    {
      id: "mantenimiento",
      title: "Mantenimiento Regular",
      description: "Cuidado continuo para mantener tu jardín impecable",
      price: "Desde $80/mes",
      duration: "Semanal o quincenal",
      icon: Calendar,
    },
    {
      id: "poda",
      title: "Poda y Limpieza",
      description: "Servicio profesional de poda y limpieza de áreas verdes",
      price: "Desde $60",
      duration: "1-2 horas",
      icon: Scissors,
    },
  ];

  const courses = [
    {
      id: "basico",
      title: "Jardinería Básica",
      description: "Aprende los fundamentos del cuidado de plantas",
      date: "15 de Mayo, 2026",
      duration: "4 semanas",
      capacity: "15 personas",
      price: "$120",
      image: "https://images.unsplash.com/photo-1771131404869-5a813dcf9796?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
    },
    {
      id: "avanzado",
      title: "Diseño de Jardines",
      description: "Técnicas avanzadas de diseño y planificación",
      date: "22 de Mayo, 2026",
      duration: "6 semanas",
      capacity: "12 personas",
      price: "$180",
      image: "https://images.unsplash.com/photo-1612366206518-535bea7db163?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
    },
    {
      id: "orquideas",
      title: "Cuidado de Orquídeas",
      description: "Especialización en el cultivo de orquídeas",
      date: "5 de Junio, 2026",
      duration: "3 semanas",
      capacity: "10 personas",
      price: "$95",
      image: "https://images.unsplash.com/photo-1768368052646-a6185df478c1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
    },
  ];

  const handleServiceBooking = (serviceId: string) => {
    setSelectedService(serviceId);
    toast.success("Solicitud enviada. Te contactaremos pronto para confirmar tu cita.");
  };

  const handleCourseEnrollment = (courseId: string) => {
    setSelectedCourse(courseId);
    toast.success("¡Inscripción exitosa! Recibirás un email con los detalles.");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-muted/30 border-b border-border">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Nuestros Servicios
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Expertos en jardinería y educación para transformar tus espacios verdes
          </p>
        </div>
      </div>

      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-12">
        {/* Gardening Services */}
        <section id="jardineria" className="mb-16 scroll-mt-20">
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Servicios de Jardinería
            </h2>
            <p className="text-muted-foreground">
              Profesionales especializados para el cuidado de tus plantas
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {gardeningServices.map((service, index) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-card border border-border rounded-2xl p-6 hover:shadow-lg transition-all"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 text-primary rounded-xl mb-4">
                  <service.icon className="w-6 h-6" />
                </div>

                <h3 className="text-xl font-bold text-foreground mb-2">{service.title}</h3>
                <p className="text-muted-foreground mb-4">{service.description}</p>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {service.duration}
                  </div>
                  <div className="text-lg font-bold text-primary">{service.price}</div>
                </div>

                <button
                  onClick={() => handleServiceBooking(service.id)}
                  className="w-full py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
                >
                  Agendar cita
                </button>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Courses */}
        <section id="cursos" className="scroll-mt-20">
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Cursos Disponibles
            </h2>
            <p className="text-muted-foreground">
              Aprende con nuestros expertos y desarrolla tus habilidades
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-all"
              >
                <div className="h-48 overflow-hidden bg-muted">
                  <img
                    src={course.image}
                    alt={course.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="p-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full mb-3">
                    <BookOpen className="w-3 h-3" />
                    Curso
                  </div>

                  <h3 className="text-xl font-bold text-foreground mb-2">{course.title}</h3>
                  <p className="text-muted-foreground mb-4">{course.description}</p>

                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      Inicia: {course.date}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      Duración: {course.duration}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      Cupo: {course.capacity}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-bold text-primary">{course.price}</span>
                  </div>

                  <button
                    onClick={() => handleCourseEnrollment(course.id)}
                    className="w-full py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
                  >
                    Inscribirse ahora
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Delivery Service */}
        <section id="entrega" className="mt-16 scroll-mt-20">
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Servicio de Entrega
            </h2>
            <p className="text-muted-foreground">
              Llevamos tus plantas y flores directamente a tu puerta
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 text-primary rounded-xl mb-4">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Entrega Express</h3>
              <p className="text-muted-foreground mb-4">
                Entrega el mismo día para pedidos realizados antes de las 2:00 PM
              </p>
              <p className="text-lg font-bold text-primary">$10 - $20</p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 text-primary rounded-xl mb-4">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Entrega Programada</h3>
              <p className="text-muted-foreground mb-4">
                Elige el día y hora que prefieras para recibir tu pedido
              </p>
              <p className="text-lg font-bold text-primary">$5 - $15</p>
            </div>
          </div>
        </section>

        {/* Advisory Service */}
        <section id="asesoria" className="mt-16 scroll-mt-20">
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Asesoría Personalizada
            </h2>
            <p className="text-muted-foreground">
              Consultoría experta para el cuidado de tus plantas
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 text-primary rounded-xl mb-4">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Consulta Virtual</h3>
              <p className="text-muted-foreground mb-4">
                Videollamada de 30 minutos con nuestros expertos
              </p>
              <p className="text-lg font-bold text-primary mb-4">$40</p>
              <button
                onClick={() => toast.success("Solicitud enviada. Te contactaremos pronto.")}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Agendar
              </button>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 text-primary rounded-xl mb-4">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Visita a Domicilio</h3>
              <p className="text-muted-foreground mb-4">
                Evaluación presencial de tu jardín o espacio verde
              </p>
              <p className="text-lg font-bold text-primary mb-4">$80</p>
              <button
                onClick={() => toast.success("Solicitud enviada. Te contactaremos pronto.")}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Solicitar
              </button>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 text-primary rounded-xl mb-4">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Plan Mensual</h3>
              <p className="text-muted-foreground mb-4">
                Asesoría continua con seguimiento de tus plantas
              </p>
              <p className="text-lg font-bold text-primary mb-4">$120/mes</p>
              <button
                onClick={() => toast.success("Solicitud enviada. Te contactaremos pronto.")}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Contratar
              </button>
            </div>
          </div>
        </section>

        {/* Contact CTA */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-3xl p-8 md:p-12 text-center border border-border"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            ¿Necesitas un servicio personalizado?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Contáctanos para diseñar un plan a medida según tus necesidades
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => toast.info("WhatsApp: +1 234 567 8900")}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
            >
              <MapPin className="w-5 h-5" />
              Contactar por WhatsApp
            </button>
            <button
              onClick={() => toast.info("Tel: +1 234 567 8900")}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-border bg-background text-foreground rounded-xl hover:bg-accent transition-colors"
            >
              Llamar ahora
            </button>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
