import { CustomerSupportV2 } from "../components/CustomerSupportV2";
import { FormEvent, useEffect, useState } from "react";
import { Instagram, MapPin, MessageCircle, Phone, Send, ImagePlus, Loader2 } from "lucide-react";
import { backendStorage } from "../lib/backendStorage";
import {
  defaultSiteContent,
  normalizePhoneForHref,
  normalizeWhatsAppPhone,
  parseSiteContent,
  type SiteContent,
} from "../lib/siteContent";
import { getMarketExperience } from "../lib/marketExperience";

export function Contact() {
  const [site, setSite] = useState<SiteContent>(defaultSiteContent);
  const [name, setName] = useState("");
  const [photos,setPhotos] = useState<File[]>([]);
  const [sendingPhotos,setSendingPhotos] = useState(false);
  const [photoStatus,setPhotoStatus] = useState("");
  const [message, setMessage] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("asunto") === "diseno-3d" ? "Hola, quiero solicitar un diseño 3D personalizado. Mi idea es: " : "");

  useEffect(() => {
    const load = () => setSite(parseSiteContent(backendStorage.getItem("siteContent")));
    load();
    window.addEventListener("storage", load);
    window.addEventListener("backend-storage", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("backend-storage", load);
    };
  }, []);

  const market = getMarketExperience(site);
  const whatsapp = normalizeWhatsAppPhone(site.footer.whatsappPhone);
  const phone = normalizePhoneForHref(site.footer.callPhone);

  async function submitWithPhotos(event: FormEvent) {
    event.preventDefault();
    if (!message.trim() || sendingPhotos) return;
    setSendingPhotos(true);setPhotoStatus("");
    try {
      const session=await fetch("/api/support/v2/session",{credentials:"include"});
      if (!session.ok) throw new Error("No se pudo iniciar la sesión de contacto");
      const created=await fetch("/api/support/v2/tickets",{
        method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({subject:new URLSearchParams(window.location.search).get("asunto")==="diseno-3d"?"Solicitud de diseño 3D con fotos":"Consulta con fotografías",name:name.trim()||"Cliente",text:message.trim()})
      });
      const data=await created.json().catch(()=>({}));
      if(!created.ok || !data.thread?.id)throw new Error(data.error||"No se pudo crear la consulta");
      let sent=0;
      for(const file of photos){
        const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("No se pudo leer la foto"));reader.readAsDataURL(file);});
        const response=await fetch("/api/support/v2/tickets/"+encodeURIComponent(data.thread.id)+"/attachments",{
          method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({filename:file.name,dataUrl})
        });
        if(!response.ok) {const error=await response.json().catch(()=>({}));throw new Error(error.error||"No se pudo adjuntar "+file.name);}
        sent++;
      }
      setPhotos([]);setMessage("");
      setPhotoStatus("Consulta enviada correctamente. "+sent+" foto(s) recibidas por nuestro sistema de atención. Puedes consultar la respuesta en Atención al cliente.");
    }catch(error:any){setPhotoStatus("No se completó el envío: "+(error?.message||"Error de conexión")+". Si se creó la consulta, compruébala en Atención al cliente antes de repetir el envío.");}
    finally{setSendingPhotos(false);}
  }
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = [
      "Hola, contacto desde la web de Tropical Plants.",
      name.trim() ? `Nombre: ${name.trim()}` : "",
      message.trim() ? `Mensaje: ${message.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="bg-[#fbfaf6] text-[#173126]">
      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:px-10 lg:py-16">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#718076]">
            CONTACTO
          </p>
          <h1 className="mt-4 text-5xl font-medium sm:text-6xl">
            {site.contactPage.title}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-[#66736b]">
            {site.contactPage.subtitle} · {market.locationLabel}.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-3xl border border-[#dfdbd1] bg-white p-5 transition hover:-translate-y-1 hover:shadow-md"
            >
              <MessageCircle className="h-6 w-6 text-[#315b42]" />
              <p className="mt-4 font-black">WhatsApp</p>
              <p className="mt-1 text-sm text-[#6c786f]">{site.footer.whatsappLabel}</p>
            </a>
            <a
              href={`tel:${phone}`}
              className="rounded-3xl border border-[#dfdbd1] bg-white p-5 transition hover:-translate-y-1 hover:shadow-md"
            >
              <Phone className="h-6 w-6 text-[#315b42]" />
              <p className="mt-4 font-black">Teléfono</p>
              <p className="mt-1 text-sm text-[#6c786f]">{site.footer.callLabel}</p>
            </a>
            <a
              href={site.footer.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-3xl border border-[#dfdbd1] bg-white p-5 transition hover:-translate-y-1 hover:shadow-md"
            >
              <Instagram className="h-6 w-6 text-[#315b42]" />
              <p className="mt-4 font-black">Instagram</p>
              <p className="mt-1 text-sm text-[#6c786f]">{site.footer.instagramLabel}</p>
            </a>
            <div className="rounded-3xl border border-[#dfdbd1] bg-white p-5">
              <MapPin className="h-6 w-6 text-[#315b42]" />
              <p className="mt-4 font-black">Ubicación</p>
              <p className="mt-1 text-sm text-[#6c786f]">{market.locationLabel}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-[#dfdbd1] bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#718076]">
            ESCRÍBENOS
          </p>
          <h2 className="mt-2 text-3xl font-medium">{site.contactPage.helpTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-[#6c786f]">
{site.contactPage.helpIntro}
          </p>

          <div className="mt-7"><CustomerSupportV2 compact /></div>
          <div className="mt-7 border-t border-[#dfdbd1] pt-6">
            <h3 className="text-base font-black">¿Prefieres WhatsApp?</h3>
            <p className="mt-1 text-xs text-[#6c786f]">Este canal es externo: los mensajes de WhatsApp todavía no se sincronizan con el historial de servicio al cliente de tu cuenta.</p>
          </div>
          <form onSubmit={submitWithPhotos} className="mt-5 space-y-4 rounded-2xl border border-[#d9e6d8] bg-[#f5faf3] p-5">
            <h3 className="flex items-center gap-2 text-lg font-bold"><ImagePlus size={21}/> Envíanos tus fotos y tu idea</h3>
            <p className="text-sm text-[#617467]">Adjunta hasta 5 fotos de referencia. Las recibiremos en Administración → Servicio al cliente, junto con tu mensaje. No necesitas WhatsApp.</p>
            <label className="block text-sm font-semibold">Tu nombre<input value={name} onChange={e=>setName(e.target.value)} className="mt-2 w-full rounded-xl border bg-white px-4 py-3" placeholder="Nombre"/></label>
            <label className="block text-sm font-semibold">¿Qué necesitas?<textarea required value={message} onChange={e=>setMessage(e.target.value)} rows={4} maxLength={2000} className="mt-2 w-full rounded-xl border bg-white px-4 py-3" placeholder="Describe tu idea o consulta..."/></label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[#8ba58c] bg-white p-4 text-sm font-semibold"><ImagePlus size={20}/> Seleccionar fotos (JPG, PNG o WebP)<input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e=>{const files=Array.from(e.target.files||[]);if(files.length>5 || files.some(f=>f.size>1_500_000)){setPhotoStatus("Máximo 5 fotos de 1,5 MB cada una.");setPhotos([]);}else{setPhotos(files);setPhotoStatus("");}}}/></label>
            {photos.length>0&&<div className="flex flex-wrap gap-2">{photos.map((file,i)=><span key={i} className="rounded-full bg-[#dcebd9] px-3 py-1 text-xs">{file.name}</span>)}</div>}
            <p className="text-xs text-[#66796a]">Los archivos se guardan como adjuntos privados de una consulta de atención al cliente. Solo el equipo autorizado y tú podéis abrirlos.</p>
            {photoStatus&&<p role="status" className="rounded-lg bg-white p-3 text-sm">{photoStatus}</p>}
            <button disabled={sendingPhotos} type="submit" className="inline-flex items-center gap-2 rounded-full bg-[#315b42] px-6 py-3 font-bold text-white disabled:opacity-60">{sendingPhotos?<Loader2 size={18} className="animate-spin"/>:<Send size={18}/>} Enviar mensaje y fotos</button>
          </form>
          <h3 className="mt-8 text-base font-bold">O continuar por WhatsApp</h3>
          <form onSubmit={submit} className="mt-5 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-black">Nombre</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Tu nombre"
                className="w-full rounded-2xl border border-[#dfdbd1] bg-[#fbfaf6] px-4 py-3 outline-none focus:border-[#315b42]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-black">Mensaje</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Cuéntanos qué producto, servicio o proyecto buscas..."
                rows={7}
                required
                className="w-full resize-none rounded-2xl border border-[#dfdbd1] bg-[#fbfaf6] px-4 py-3 outline-none focus:border-[#315b42]"
              />
            </label>

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-[#315b42] px-6 py-3.5 text-sm font-black text-white"
            >
              <Send className="h-4 w-4" /> Continuar por WhatsApp
            </button>
          </form>
        </div>
      </section>

      <section className="border-y border-[#ded9cd] bg-[#f4f1e8]">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
          <h2 className="text-2xl font-medium">Horario de atención</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {site.contactPage.hours.map((row) => (
              <div key={row.label} className="rounded-2xl border border-[#dfdbd1] bg-white p-4">
                <p className="text-sm font-black">{row.label}</p>
                <p className="mt-1 text-sm text-[#6c786f]">{row.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
