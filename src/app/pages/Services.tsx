import { useEffect, useState } from "react";
import { Calendar, Clock, MapPin, Users, Scissors, BookOpen, Check, MessageCircle, Phone } from "lucide-react";
import { motion } from "motion/react";
import { useLocation } from "react-router";
import { backendStorage } from "../lib/backendStorage";
import { defaultSiteContent, normalizePhoneForHref, normalizeWhatsAppPhone, readPreviewSiteContent, SiteContent } from "../lib/siteContent";

export function Services() {
  const location = useLocation();
  const [site, setSite] = useState<SiteContent>(defaultSiteContent);

  useEffect(() => {
    const load = () => setSite(readPreviewSiteContent(backendStorage.getItem("siteContent")));
    load();
    window.addEventListener("storage", load);
    window.addEventListener("backend-storage", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("backend-storage", load);
    };
  }, []);

  useEffect(() => {
    const tipo = new URLSearchParams(location.search).get("tipo");
    if (!tipo) return;
    const element = document.getElementById(tipo);
    if (element) window.setTimeout(() => element.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  }, [location.search]);

  const content = site.servicesPage;
  const serviceIcons = [Scissors, Calendar, Scissors];
  const advisoryIcons = [BookOpen, MapPin, Check];

  function openWhatsApp(message: string) {
    const phone = normalizeWhatsAppPhone(site.footer.whatsappPhone || site.floatingWhatsapp.phone);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  function callStore() {
    window.location.href = `tel:${normalizePhoneForHref(site.footer.callPhone)}`;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-muted/30 border-b border-border">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{content.title}</h1>
          <p className="text-muted-foreground max-w-2xl">{content.subtitle}</p>
        </div>
      </div>

      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-12">
        <section id="jardineria" className="mb-16 scroll-mt-20">
          <div className="mb-8"><h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">{content.gardeningHeading}</h2><p className="text-muted-foreground">{content.gardeningDescription}</p></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {content.gardeningServices.map((service, index) => {
              const Icon = serviceIcons[index % serviceIcons.length];
              return <motion.div key={service.id || index} initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:index*0.1}} className="bg-card border border-border rounded-2xl p-6 hover:shadow-lg transition-all">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 text-primary rounded-xl mb-4"><Icon className="w-6 h-6"/></div>
                <h3 className="text-xl font-bold text-foreground mb-2">{service.title}</h3>
                <p className="text-muted-foreground mb-4">{service.description}</p>
                <div className="space-y-2 mb-6"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="w-4 h-4"/>{service.duration}</div><div className="text-lg font-bold text-primary">{service.price}</div></div>
                <button onClick={() => openWhatsApp(`Hola, quiero información sobre el servicio: ${service.title}.`)} className="w-full py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors">{service.buttonLabel}</button>
              </motion.div>;
            })}
          </div>
        </section>

        <section id="cursos" className="scroll-mt-20">
          <div className="mb-8"><h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">{content.coursesHeading}</h2><p className="text-muted-foreground">{content.coursesDescription}</p></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {content.courses.map((course,index) => <motion.div key={course.id || index} initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:index*0.1}} className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-all">
              <div className="h-48 overflow-hidden bg-muted">{course.image && <img src={course.image} alt={course.title} className="w-full h-full object-cover"/>}</div>
              <div className="p-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full mb-3"><BookOpen className="w-3 h-3"/>Curso</div>
                <h3 className="text-xl font-bold text-foreground mb-2">{course.title}</h3><p className="text-muted-foreground mb-4">{course.description}</p>
                <div className="space-y-2 mb-6"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Calendar className="w-4 h-4"/>{course.date}</div><div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="w-4 h-4"/>{course.duration}</div><div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="w-4 h-4"/>{course.capacity}</div></div>
                <div className="text-2xl font-bold text-primary mb-4">{course.price}</div>
                <button onClick={() => openWhatsApp(`Hola, quiero información sobre el curso: ${course.title}.`)} className="w-full py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors">{course.buttonLabel}</button>
              </div>
            </motion.div>)}
          </div>
        </section>

        <section id="entrega" className="mt-16 scroll-mt-20">
          <div className="mb-8"><h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">{content.deliveryHeading}</h2><p className="text-muted-foreground">{content.deliveryDescription}</p></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {content.deliveryOptions.map((option,index) => {
              const Icon = index === 0 ? MapPin : Calendar;
              return <div key={index} className="bg-card border border-border rounded-2xl p-6"><div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 text-primary rounded-xl mb-4"><Icon className="w-6 h-6"/></div><h3 className="text-xl font-bold text-foreground mb-2">{option.title}</h3><p className="text-muted-foreground mb-4">{option.description}</p><p className="text-lg font-bold text-primary">{option.price}</p></div>;
            })}
          </div>
        </section>

        <section id="asesoria" className="mt-16 scroll-mt-20">
          <div className="mb-8"><h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">{content.advisoryHeading}</h2><p className="text-muted-foreground">{content.advisoryDescription}</p></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {content.advisoryOptions.map((option,index) => {
              const Icon = advisoryIcons[index % advisoryIcons.length];
              return <div key={index} className="bg-card border border-border rounded-2xl p-6"><div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 text-primary rounded-xl mb-4"><Icon className="w-6 h-6"/></div><h3 className="text-xl font-bold text-foreground mb-2">{option.title}</h3><p className="text-muted-foreground mb-4">{option.description}</p><p className="text-lg font-bold text-primary mb-4">{option.price}</p><button onClick={() => openWhatsApp(`Hola, quiero información sobre: ${option.title}.`)} className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">{option.buttonLabel}</button></div>;
            })}
          </div>
        </section>

        <motion.section initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} className="mt-16 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-3xl p-8 md:p-12 text-center border border-border">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">{content.ctaTitle}</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">{content.ctaDescription}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => openWhatsApp("Hola, necesito información sobre un servicio personalizado.")} className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"><MessageCircle className="w-5 h-5"/>{content.whatsappButtonLabel}</button>
            <button onClick={callStore} className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-border bg-background text-foreground rounded-xl hover:bg-accent transition-colors"><Phone className="w-5 h-5"/>{content.callButtonLabel}</button>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
